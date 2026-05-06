const db = require('../db');
const ow = require('./openweather');
const cron = require('node-cron');

let ingestionActive = false;

async function ingestStation(station) {
  if (!ow.isConfigured()) return;
  try {
    const [lon, lat] = station.location_coords;
    const obs = await ow.getCurrentWeather(lat, lon);
    if (!obs) return;

    await db.query(`
      INSERT INTO weather_observations
        (station_id, observed_at, location, temp_c, temp_min_c, temp_max_c,
         feels_like_c, humidity_pct, pressure_hpa, visibility_km, cloud_cover_pct,
         wind_speed_ms, wind_gust_ms, wind_direction_deg,
         snowfall_cm, snow_depth_cm, precip_mm,
         condition_code, condition_text, source, raw_json)
      VALUES ($1,$2,ST_GeomFromText($3,4326),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      ON CONFLICT DO NOTHING
    `, [
      station.station_id,
      obs.observed_at,
      `POINT(${lon} ${lat})`,
      obs.temp_c, obs.temp_min_c, obs.temp_max_c,
      obs.feels_like_c, obs.humidity_pct, obs.pressure_hpa, obs.visibility_km,
      obs.cloud_cover_pct, obs.wind_speed_ms, obs.wind_gust_ms, obs.wind_direction_deg,
      obs.snowfall_cm, obs.snow_depth_cm, obs.precip_mm,
      obs.condition_code, obs.condition_text, obs.source, JSON.stringify(obs.raw_json),
    ]);
  } catch (err) {
    console.error(`Ingestion failed for ${station.station_id}:`, err.message);
  }
}

async function ingestAllStations() {
  if (ingestionActive) return;
  ingestionActive = true;
  try {
    const { rows } = await db.query(`
      SELECT station_id,
             ST_X(location) AS lon,
             ST_Y(location) AS lat,
             ARRAY[ST_X(location), ST_Y(location)] AS location_coords
      FROM weather_stations WHERE active = true
    `);
    await Promise.allSettled(rows.map(r => ingestStation(r)));
    console.log(`[Ingestion] Completed ${rows.length} stations at ${new Date().toISOString()}`);
  } finally {
    ingestionActive = false;
  }
}

async function detectStormEvents() {
  // Identify periods where ≥3 stations report snowfall_cm > 5 within 12h window
  const { rows } = await db.query(`
    WITH heavy_snow AS (
      SELECT
        date_trunc('hour', observed_at) AS hour_bucket,
        COUNT(DISTINCT station_id)      AS station_count,
        MAX(snowfall_cm)                AS max_snow,
        MIN(temp_c)                     AS min_temp
      FROM weather_observations
      WHERE snowfall_cm > 5
        AND observed_at > NOW() - INTERVAL '7 days'
      GROUP BY 1
    )
    SELECT * FROM heavy_snow WHERE station_count >= 3 ORDER BY hour_bucket DESC LIMIT 20
  `);
  return rows;
}

function startScheduledIngestion() {
  const intervalMin = parseInt(process.env.INGESTION_INTERVAL_MINUTES || '15');
  console.log(`[Ingestion] Scheduled every ${intervalMin} minutes`);

  // Run immediately on startup
  ingestAllStations();

  // Then on schedule
  cron.schedule(`*/${intervalMin} * * * *`, () => ingestAllStations());
}

module.exports = { ingestAllStations, startScheduledIngestion, detectStormEvents };
