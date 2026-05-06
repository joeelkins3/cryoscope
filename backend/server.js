require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { startScheduledIngestion } = require('./services/ingestion');
const db = require('./db');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ───────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/weather',  require('./routes/weather'));
app.use('/api/storms',   require('./routes/storms'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/query',    require('./routes/query'));

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      openweather: Boolean(process.env.OPENWEATHER_API_KEY),
      ts: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

// User observations (lightweight inline route)
app.post('/api/observations', async (req, res, next) => {
  try {
    const { lat, lon, observed_at, snowfall_cm, snow_depth_cm, temp_c, notes, user_label } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const { rows } = await db.query(`
      INSERT INTO user_observations (user_label, observed_at, location, snowfall_cm, snow_depth_cm, temp_c, notes)
      VALUES ($1, $2, ST_GeomFromText($3,4326), $4, $5, $6, $7) RETURNING *
    `, [user_label||'Anonymous', observed_at||new Date(), `POINT(${lon} ${lat})`, snowfall_cm, snow_depth_cm, temp_c, notes]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// 404
app.use((req, res) => res.status(404).json({ error: `Route ${req.path} not found` }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🌨  CryoScope API running on http://localhost:${PORT}`);
  console.log(`    OpenWeather: ${process.env.OPENWEATHER_API_KEY ? '✅ configured' : '⚠️  not set (demo mode)'}`);

  try {
    await db.query('SELECT PostGIS_Version()');
    console.log('    PostGIS:     ✅ connected');
    startScheduledIngestion();
  } catch (err) {
    console.log('    PostGIS:     ⚠️  not connected —', err.message);
    console.log('    Running in demo mode without live DB');
  }
});

module.exports = app;
