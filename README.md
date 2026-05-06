# ❄ CryoScope

**Geospatial Weather & Snow Data Platform**

CryoScope is a full-stack web application for collecting, storing, querying, and visualizing historical and real-time weather data — with a strong emphasis on snowfall, geospatial analysis, and time-series visualization.

---

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + Vite, Leaflet, Chart.js |
| Backend   | Node.js + Express |
| Database  | PostgreSQL 15 + PostGIS 3.3 |
| Container | Docker Compose |
| Data APIs | OpenWeatherMap, NOAA GHCN |

---

## Features

- **Interactive Map** — Leaflet dark map with station markers, heatmap overlay, metric selector, and timeline playback slider
- **Dashboard** — Temperature time-series, daily snowfall bars, monthly distribution, forecast vs actual comparison
- **Storm Archive** — Browse 6 historic storms, replay progression on map, compare storms side-by-side
- **Query Builder** — Filter by station, date range, metric, thresholds; export CSV/JSON; auto-generated charts
- **Insights** — Monthly snowfall profile, long-term warming trend, record days, forecast accuracy metrics
- **Live Mode** — Demo works fully in-browser with realistic mock data; swap in API keys for live feeds

---

## Quick Start

### Option A — Docker (full stack)

```bash
cp backend/.env.example backend/.env
# Add your OPENWEATHER_API_KEY to backend/.env

docker-compose up --build
```

- Frontend: http://localhost:3000
- API:      http://localhost:4000
- Database: localhost:5432

### Option B — Frontend only (demo mode)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — runs entirely on mock data, no backend needed.

### Option C — Frontend + Backend (no Docker)

```bash
# Terminal 1 — Postgres (needs PostGIS)
psql -U postgres -c "CREATE DATABASE cryoscope;"
psql -U postgres -d cryoscope -f database/init.sql

# Terminal 2 — API
cd backend && cp .env.example .env && npm install && npm run dev

# Terminal 3 — UI
cd frontend && npm install && npm run dev
```

---

## API Keys (optional)

| Key | Where to get | Used for |
|-----|-------------|---------|
| `OPENWEATHER_API_KEY` | openweathermap.org/api | Live current + forecast data |
| `NOAA_TOKEN` | ncdc.noaa.gov/cdo-web/token | Historical observations |

Without keys, the app runs in **demo mode** with procedurally generated realistic data.

---

## API Endpoints

```
GET  /api/weather/stations          All active stations
GET  /api/weather/current           Current conditions at lat/lon
GET  /api/weather/history           Historical observations
GET  /api/weather/heatmap           Aggregated spatial data
GET  /api/weather/timeline          Hourly data for a date
GET  /api/weather/nearby            Stations near a point
GET  /api/weather/daily-summary     Daily aggregates for a station

GET  /api/storms                    Storm list (filter by category/year)
GET  /api/storms/:slug              Storm detail + observations

GET  /api/insights/summary          Snowiest days, coldest, monthly stats
GET  /api/insights/trends           Long-term trend data
GET  /api/insights/forecast-vs-actual  Accuracy metrics

POST /api/query                     Structured data query
POST /api/query/save                Save a named query
POST /api/query/export              Export as CSV or JSON
POST /api/observations              Submit user observation

GET  /health                        Health check
```

---

## Database Schema

Key tables (all in PostgreSQL + PostGIS):

- `weather_stations` — Station registry with GIST-indexed geometry
- `weather_observations` — Core time-series with PostGIS point, indexed on `(station_id, observed_at)`
- `forecasts` — Issued forecasts for accuracy comparison
- `storm_events` — Identified storms with MultiPolygon affected area
- `user_observations` — Crowdsourced microclimate data
- `saved_queries` — Persisted query builder configs

---

## Project Structure

```
cryoscope/
├── docker-compose.yml
├── database/
│   └── init.sql              PostGIS schema + seed data
├── backend/
│   ├── server.js             Express app
│   ├── routes/               weather, storms, insights, query
│   ├── services/             openweather.js, ingestion.js
│   └── db/index.js           pg connection pool
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── Map/          MapView, WeatherPopup, TimelineSlider
    │   │   ├── Dashboard/    Charts (temp, snow, forecast vs actual)
    │   │   ├── StormArchive/ Storm list, replay map, comparison
    │   │   ├── QueryBuilder/ Filter form, results table, export
    │   │   └── Insights/     Analytics, trends, forecast accuracy
    │   ├── data/mockData.js  Seeded weather generator (demo mode)
    │   └── services/api.js   API client with mock fallback
    └── vite.config.js
```
