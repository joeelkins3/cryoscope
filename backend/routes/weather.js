const router = require('express').Router();
const db = require('../db');
const ow = require('../services/openweather');

// GET /api/weather/stations
router.get('/stations', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT station_id, name, network, state, timezone, elevation_m, active,
             ST_X(location) AS lon, ST_Y(location) AS lat
      FROM weather_stations ORDER BY name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/weather/current?lat=&lon=
router.get('/current', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

    // Try live API first, fallback to most recent DB record
    let live = null;
    try { live = await ow.getCurrentWeather(parseFloat(lat), parseFloat(lon)); } catch (_) {}

    const { rows } = await db.query(`
      SELECT *,
             ST_X(location) AS lon, ST_Y(location) AS lat,
             ST_Distance(location::geography,
               ST_GeomFromText($1, 4326)::geography) AS dist_m
      FROM weather_observations
      WHERE ST_DWithin(location::geography,
              ST_GeomFromText($1, 4326)::geography, 50000)
      ORDER BY observed_at DESC LIMIT 1
    `, [`POINT(${lon} ${lat})`]);

    res.json({ live, nearest_db: rows[0] || null });
  } catch (err) { next(err); }
});

// GET /api/weather/history?lat=&lon=&start=&end=&station_id=
router.get('/history', async (req, res, next) => {
  try {
    const { lat, lon, start, end, station_id, limit = 500 } = req.query;
    let rows;

    if (station_id) {
      ({ rows } = await db.query(`
        SELECT observed_at, temp_c, temp_min_c, temp_max_c,
               snowfall_cm, snow_depth_cm, precip_mm,
               humidity_pct, pressure_hpa, wind_speed_ms, wind_gust_ms,
               condition_text, condition_code,
               ST_X(location) AS lon, ST_Y(location) AS lat
        FROM weather_observations
        WHERE station_id = $1
          AND observed_at BETWEEN $2 AND $3
        ORDER BY observed_at ASC
        LIMIT $4
      `, [station_id, start || '1970-01-01', end || 'now()', Math.min(parseInt(limit), 5000)]));
    } else {
      if (!lat || !lon) return res.status(400).json({ error: 'lat/lon or station_id required' });
      ({ rows } = await db.query(`
        SELECT o.observed_at, o.temp_c, o.temp_min_c, o.temp_max_c,
               o.snowfall_cm, o.snow_depth_cm, o.precip_mm,
               o.humidity_pct, o.pressure_hpa, o.wind_speed_ms, o.wind_gust_ms,
               o.condition_text, o.condition_code,
               ST_X(o.location) AS lon, ST_Y(o.location) AS lat,
               o.station_id, s.name AS station_name
        FROM weather_observations o
        LEFT JOIN weather_stations s ON s.station_id = o.station_id
        WHERE ST_DWithin(o.location::geography,
                ST_GeomFromText($1, 4326)::geography, 80000)
          AND o.observed_at BETWEEN $2 AND $3
        ORDER BY o.observed_at ASC
        LIMIT $4
      `, [`POINT(${lon} ${lat})`, start || '1970-01-01', end || 'now()', Math.min(parseInt(limit), 5000)]));
    }

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/weather/heatmap?metric=snowfall&start=&end=
router.get('/heatmap', async (req, res, next) => {
  try {
    const { metric = 'snowfall_cm', start, end } = req.query;
    const allowed = ['snowfall_cm', 'temp_c', 'wind_speed_ms', 'precip_mm', 'snow_depth_cm'];
    if (!allowed.includes(metric)) return res.status(400).json({ error: 'Invalid metric' });

    const { rows } = await db.query(`
      SELECT
        station_id,
        ST_X(location)    AS lon,
        ST_Y(location)    AS lat,
        AVG(${metric})    AS value,
        MAX(${metric})    AS max_value,
        COUNT(*)          AS readings
      FROM weather_observations
      WHERE observed_at BETWEEN $1 AND $2
        AND ${metric} IS NOT NULL
      GROUP BY station_id, location
    `, [start || (new Date(Date.now() - 30 * 86400000)).toISOString(), end || new Date().toISOString()]);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/weather/timeline?lat=&lon=&date=YYYY-MM-DD (hourly for that day)
router.get('/timeline', async (req, res, next) => {
  try {
    const { lat, lon, date } = req.query;
    if (!lat || !lon || !date) return res.status(400).json({ error: 'lat, lon, date required' });

    const { rows } = await db.query(`
      SELECT observed_at, temp_c, snowfall_cm, wind_speed_ms, condition_text, condition_code,
             ST_X(location) AS lon, ST_Y(location) AS lat
      FROM weather_observations
      WHERE ST_DWithin(location::geography,
              ST_GeomFromText($1, 4326)::geography, 80000)
        AND DATE(observed_at AT TIME ZONE 'UTC') = $2::date
      ORDER BY observed_at ASC
    `, [`POINT(${lon} ${lat})`, date]);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/weather/nearby?lat=&lon=&radius_km=100
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lon, radius_km = 200 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

    const { rows } = await db.query(`
      SELECT s.station_id, s.name, s.state, s.elevation_m,
             ST_X(s.location) AS lon, ST_Y(s.location) AS lat,
             ST_Distance(s.location::geography,
               ST_GeomFromText($1, 4326)::geography) / 1000 AS dist_km,
             o.temp_c, o.snowfall_cm, o.snow_depth_cm,
             o.wind_speed_ms, o.condition_text, o.observed_at
      FROM weather_stations s
      LEFT JOIN LATERAL (
        SELECT * FROM weather_observations
        WHERE station_id = s.station_id
        ORDER BY observed_at DESC LIMIT 1
      ) o ON true
      WHERE ST_DWithin(s.location::geography,
              ST_GeomFromText($1, 4326)::geography, $2 * 1000)
      ORDER BY dist_km ASC
    `, [`POINT(${lon} ${lat})`, parseFloat(radius_km)]);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/weather/daily-summary?station_id=&year=
router.get('/daily-summary', async (req, res, next) => {
  try {
    const { station_id, year } = req.query;
    if (!station_id) return res.status(400).json({ error: 'station_id required' });

    const { rows } = await db.query(`
      SELECT * FROM daily_snow_summary
      WHERE station_id = $1
        AND EXTRACT(YEAR FROM obs_date) = $2
      ORDER BY obs_date ASC
    `, [station_id, year || new Date().getFullYear()]);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
