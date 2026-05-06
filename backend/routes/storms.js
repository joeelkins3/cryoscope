const router = require('express').Router();
const db = require('../db');

// GET /api/storms
router.get('/', async (req, res, next) => {
  try {
    const { category, year, limit = 50 } = req.query;
    let params = [];
    let conditions = [];
    let paramIdx = 1;

    if (category) { conditions.push(`category = $${paramIdx++}`); params.push(category); }
    if (year)     { conditions.push(`EXTRACT(YEAR FROM started_at) = $${paramIdx++}`); params.push(parseInt(year)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(`
      SELECT id, name, slug, category, started_at, ended_at, peak_at,
             max_snowfall_cm, max_wind_ms, min_temp_c,
             affected_stations, total_precip_mm, fatalities, damage_usd,
             description, tags,
             EXTRACT(EPOCH FROM (ended_at - started_at))/3600 AS duration_hours
      FROM storm_events
      ${where}
      ORDER BY started_at DESC
      LIMIT $${paramIdx}
    `, [...params, parseInt(limit)]);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/storms/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT se.*,
             EXTRACT(EPOCH FROM (ended_at - started_at))/3600 AS duration_hours
      FROM storm_events se
      WHERE slug = $1
    `, [req.params.slug]);

    if (!rows.length) return res.status(404).json({ error: 'Storm not found' });

    const storm = rows[0];

    // Get observations during storm window
    const { rows: obs } = await db.query(`
      SELECT o.station_id, ws.name AS station_name,
             o.observed_at, o.temp_c, o.snowfall_cm, o.snow_depth_cm,
             o.wind_speed_ms, o.wind_gust_ms, o.condition_text,
             ST_X(o.location) AS lon, ST_Y(o.location) AS lat
      FROM weather_observations o
      JOIN weather_stations ws ON ws.station_id = o.station_id
      WHERE o.observed_at BETWEEN $1 AND $2
        AND o.snowfall_cm > 0
      ORDER BY o.observed_at ASC
      LIMIT 2000
    `, [storm.started_at, storm.ended_at || new Date()]);

    res.json({ ...storm, observations: obs });
  } catch (err) { next(err); }
});

// GET /api/storms/compare?slugs=slug1,slug2
router.get('/compare', async (req, res, next) => {
  try {
    const slugs = (req.query.slugs || '').split(',').filter(Boolean);
    if (slugs.length < 2) return res.status(400).json({ error: 'Provide at least 2 slugs' });

    const { rows } = await db.query(`
      SELECT id, name, slug, category, started_at, ended_at,
             max_snowfall_cm, max_wind_ms, min_temp_c,
             affected_stations, duration_hours,
             EXTRACT(EPOCH FROM (ended_at - started_at))/3600 AS duration_hours
      FROM storm_events
      WHERE slug = ANY($1)
    `, [slugs]);

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
