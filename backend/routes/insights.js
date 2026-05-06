const router = require('express').Router();
const db = require('../db');

// GET /api/insights/summary?station_id=
router.get('/summary', async (req, res, next) => {
  try {
    const { station_id } = req.query;
    const filter = station_id ? `AND station_id = '${station_id.replace(/'/g,'')}'` : '';

    const [snowiest, coldest, trends, forecastAcc] = await Promise.all([
      // Top 10 snowiest days ever recorded
      db.query(`
        SELECT DATE(observed_at) AS date, station_id,
               SUM(snowfall_cm) AS total_snowfall_cm,
               MIN(temp_c)      AS min_temp_c
        FROM weather_observations
        WHERE snowfall_cm > 0 ${filter}
        GROUP BY DATE(observed_at), station_id
        ORDER BY total_snowfall_cm DESC LIMIT 10
      `),

      // Top 10 coldest recorded temps
      db.query(`
        SELECT observed_at, station_id, temp_c, snowfall_cm
        FROM weather_observations
        WHERE temp_c IS NOT NULL ${filter}
        ORDER BY temp_c ASC LIMIT 10
      `),

      // Year-over-year trend (avg winter temp & total snow per year)
      db.query(`
        SELECT
          EXTRACT(YEAR FROM observed_at)  AS year,
          AVG(temp_c)                     AS avg_temp_c,
          SUM(snowfall_cm)                AS total_snowfall_cm,
          COUNT(*)                        AS readings
        FROM weather_observations
        WHERE EXTRACT(MONTH FROM observed_at) IN (11,12,1,2,3)
        ${filter}
        GROUP BY 1
        ORDER BY 1 ASC
      `),

      // Forecast accuracy (mean absolute error vs actual)
      db.query(`
        SELECT
          AVG(ABS(f.forecast_temp_c - o.temp_c))       AS mae_temp_c,
          AVG(ABS(f.forecast_snowfall_cm - COALESCE(o.snowfall_cm,0))) AS mae_snowfall_cm,
          COUNT(*)                                       AS pairs
        FROM forecasts f
        JOIN weather_observations o
          ON o.station_id = f.station_id
         AND ABS(EXTRACT(EPOCH FROM (o.observed_at - f.valid_for))) < 1800
        WHERE f.forecast_temp_c IS NOT NULL
        LIMIT 1
      `),
    ]);

    // Monthly snowfall distribution
    const { rows: monthly } = await db.query(`
      SELECT
        EXTRACT(MONTH FROM observed_at) AS month,
        AVG(snowfall_cm)   AS avg_snowfall_cm,
        SUM(snowfall_cm)   AS total_snowfall_cm,
        COUNT(*)           AS readings
      FROM weather_observations
      WHERE snowfall_cm > 0 ${filter}
      GROUP BY 1 ORDER BY 1
    `);

    res.json({
      snowiest_days:      snowiest.rows,
      coldest_readings:   coldest.rows,
      yearly_trends:      trends.rows,
      forecast_accuracy:  forecastAcc.rows[0] || null,
      monthly_snowfall:   monthly,
    });
  } catch (err) { next(err); }
});

// GET /api/insights/trends?station_id=&metric=temp_c&interval=month
router.get('/trends', async (req, res, next) => {
  try {
    const { station_id, metric = 'temp_c', interval = 'month' } = req.query;
    const allowed = ['temp_c', 'snowfall_cm', 'snow_depth_cm', 'precip_mm', 'wind_speed_ms'];
    if (!allowed.includes(metric)) return res.status(400).json({ error: 'Invalid metric' });

    const filter = station_id ? `AND station_id = $1` : '';
    const params = station_id ? [station_id] : [];

    const { rows } = await db.query(`
      SELECT
        date_trunc('${interval}', observed_at) AS period,
        AVG(${metric})  AS avg_value,
        MIN(${metric})  AS min_value,
        MAX(${metric})  AS max_value,
        COUNT(*)        AS readings
      FROM weather_observations
      WHERE ${metric} IS NOT NULL ${filter}
      GROUP BY 1 ORDER BY 1 ASC
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/insights/forecast-vs-actual?station_id=&start=&end=
router.get('/forecast-vs-actual', async (req, res, next) => {
  try {
    const { station_id, start, end } = req.query;
    if (!station_id) return res.status(400).json({ error: 'station_id required' });

    const { rows } = await db.query(`
      SELECT
        f.valid_for AS date,
        f.forecast_temp_c,
        f.forecast_snowfall_cm,
        o.temp_c           AS actual_temp_c,
        o.snowfall_cm      AS actual_snowfall_cm,
        f.forecast_temp_c - o.temp_c AS temp_error,
        f.forecast_snowfall_cm - COALESCE(o.snowfall_cm,0) AS snow_error
      FROM forecasts f
      JOIN weather_observations o
        ON o.station_id = f.station_id
       AND ABS(EXTRACT(EPOCH FROM (o.observed_at - f.valid_for))) < 1800
      WHERE f.station_id = $1
        AND f.valid_for BETWEEN $2 AND $3
      ORDER BY f.valid_for ASC
    `, [station_id, start || '2024-01-01', end || new Date().toISOString()]);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
