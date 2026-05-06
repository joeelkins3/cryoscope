const router = require('express').Router();
const db = require('../db');

const ALLOWED_METRICS = [
  'temp_c','temp_min_c','temp_max_c','feels_like_c',
  'snowfall_cm','snow_depth_cm','precip_mm',
  'humidity_pct','pressure_hpa','wind_speed_ms','wind_gust_ms',
  'visibility_km','cloud_cover_pct',
];

// POST /api/query  — structured query builder
router.post('/', async (req, res, next) => {
  try {
    const {
      station_ids,
      lat, lon, radius_km = 100,
      start_date,
      end_date,
      metrics = ['temp_c', 'snowfall_cm'],
      min_snowfall,
      max_temp,
      min_wind,
      aggregate = 'raw',  // raw | hourly | daily | monthly
      limit = 1000,
    } = req.body;

    // Validate metrics
    const safeMetrics = metrics.filter(m => ALLOWED_METRICS.includes(m));
    if (!safeMetrics.length) return res.status(400).json({ error: 'No valid metrics specified' });

    const params = [];
    const conditions = [];
    let paramIdx = 1;

    // Spatial filter
    if (station_ids?.length) {
      conditions.push(`station_id = ANY($${paramIdx++})`);
      params.push(station_ids);
    } else if (lat && lon) {
      conditions.push(`ST_DWithin(location::geography, ST_GeomFromText($${paramIdx++},4326)::geography, $${paramIdx++})`);
      params.push(`POINT(${lon} ${lat})`, parseFloat(radius_km) * 1000);
    }

    // Time range
    if (start_date) { conditions.push(`observed_at >= $${paramIdx++}`); params.push(start_date); }
    if (end_date)   { conditions.push(`observed_at <= $${paramIdx++}`); params.push(end_date); }

    // Threshold filters
    if (min_snowfall) { conditions.push(`snowfall_cm >= $${paramIdx++}`); params.push(parseFloat(min_snowfall)); }
    if (max_temp)     { conditions.push(`temp_c <= $${paramIdx++}`); params.push(parseFloat(max_temp)); }
    if (min_wind)     { conditions.push(`wind_speed_ms >= $${paramIdx++}`); params.push(parseFloat(min_wind)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const metricSelect = safeMetrics.map(m =>
      aggregate === 'raw' ? m : `AVG(${m}) AS ${m}, MIN(${m}) AS min_${m}, MAX(${m}) AS max_${m}`
    ).join(', ');

    let sql;
    if (aggregate === 'raw') {
      sql = `
        SELECT observed_at, station_id,
               ST_X(location) AS lon, ST_Y(location) AS lat,
               ${metricSelect}, condition_text
        FROM weather_observations ${where}
        ORDER BY observed_at DESC LIMIT $${paramIdx}
      `;
    } else {
      const truncTo = { hourly: 'hour', daily: 'day', monthly: 'month' }[aggregate] || 'day';
      sql = `
        SELECT date_trunc('${truncTo}', observed_at) AS period,
               station_id, ${metricSelect}, COUNT(*) AS readings
        FROM weather_observations ${where}
        GROUP BY 1, 2 ORDER BY 1 DESC LIMIT $${paramIdx}
      `;
    }

    params.push(Math.min(parseInt(limit), 10000));
    const { rows } = await db.query(sql, params);

    res.json({
      count: rows.length,
      metrics: safeMetrics,
      aggregate,
      data: rows,
    });
  } catch (err) { next(err); }
});

// GET /api/query/saved
router.get('/saved', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM saved_queries ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/query/save
router.post('/save', async (req, res, next) => {
  try {
    const { name, description, query_json } = req.body;
    const { rows } = await db.query(
      'INSERT INTO saved_queries (name, description, query_json) VALUES ($1,$2,$3) RETURNING *',
      [name, description || '', JSON.stringify(query_json)]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/query/export?format=csv  (after running a saved query)
router.post('/export', async (req, res, next) => {
  try {
    const { data = [], format = 'json', filename = 'cryoscope_export' } = req.body;

    if (format === 'csv') {
      if (!data.length) return res.status(400).json({ error: 'No data to export' });
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(r => Object.values(r).map(v => JSON.stringify(v ?? '')).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send([headers, ...rows].join('\n'));
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
