-- CryoScope Database Schema
-- PostgreSQL 15 + PostGIS 3.3

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─────────────────────────────────────────────────
-- WEATHER STATIONS
-- ─────────────────────────────────────────────────
CREATE TABLE weather_stations (
  id            SERIAL PRIMARY KEY,
  station_id    VARCHAR(32)  UNIQUE NOT NULL,
  name          TEXT         NOT NULL,
  network       VARCHAR(32)  NOT NULL DEFAULT 'NOAA',  -- NOAA | OpenWeather | User
  location      GEOMETRY(Point, 4326) NOT NULL,
  elevation_m   NUMERIC(8,2),
  country       VARCHAR(3)   NOT NULL DEFAULT 'US',
  state         VARCHAR(64),
  timezone      VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  active        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_location ON weather_stations USING GIST(location);
CREATE INDEX idx_stations_network   ON weather_stations(network);

-- ─────────────────────────────────────────────────
-- WEATHER OBSERVATIONS (time-series core)
-- ─────────────────────────────────────────────────
CREATE TABLE weather_observations (
  id                BIGSERIAL   PRIMARY KEY,
  station_id        VARCHAR(32) REFERENCES weather_stations(station_id) ON DELETE CASCADE,
  observed_at       TIMESTAMPTZ NOT NULL,
  location          GEOMETRY(Point, 4326) NOT NULL,

  -- Temperature
  temp_c            NUMERIC(6,2),
  temp_min_c        NUMERIC(6,2),
  temp_max_c        NUMERIC(6,2),
  feels_like_c      NUMERIC(6,2),
  dew_point_c       NUMERIC(6,2),

  -- Precipitation / Snow
  precip_mm         NUMERIC(8,2),
  snowfall_cm       NUMERIC(8,2),
  snow_depth_cm     NUMERIC(8,2),

  -- Atmosphere
  humidity_pct      NUMERIC(5,2),
  pressure_hpa      NUMERIC(8,2),
  visibility_km     NUMERIC(8,2),
  cloud_cover_pct   NUMERIC(5,2),
  uv_index          NUMERIC(4,2),

  -- Wind
  wind_speed_ms     NUMERIC(6,2),
  wind_gust_ms      NUMERIC(6,2),
  wind_direction_deg SMALLINT,

  -- Metadata
  condition_code    INTEGER,
  condition_text    TEXT,
  source            VARCHAR(32) NOT NULL DEFAULT 'api',  -- api | user | forecast
  raw_json          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance at scale
CREATE INDEX idx_obs_station_time ON weather_observations(station_id, observed_at DESC);
CREATE INDEX idx_obs_location     ON weather_observations USING GIST(location);
CREATE INDEX idx_obs_time         ON weather_observations(observed_at DESC);
CREATE INDEX idx_obs_snowfall     ON weather_observations(snowfall_cm DESC) WHERE snowfall_cm > 0;

-- ─────────────────────────────────────────────────
-- FORECASTS (for accuracy comparison)
-- ─────────────────────────────────────────────────
CREATE TABLE forecasts (
  id              BIGSERIAL   PRIMARY KEY,
  station_id      VARCHAR(32) REFERENCES weather_stations(station_id) ON DELETE CASCADE,
  location        GEOMETRY(Point, 4326) NOT NULL,
  issued_at       TIMESTAMPTZ NOT NULL,
  valid_for       TIMESTAMPTZ NOT NULL,  -- the time the forecast was predicting

  forecast_temp_c       NUMERIC(6,2),
  forecast_precip_mm    NUMERIC(8,2),
  forecast_snowfall_cm  NUMERIC(8,2),
  forecast_wind_ms      NUMERIC(6,2),
  forecast_condition    TEXT,
  confidence_pct        NUMERIC(5,2),
  source                VARCHAR(32) NOT NULL DEFAULT 'openweather',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecasts_station_valid ON forecasts(station_id, valid_for DESC);

-- ─────────────────────────────────────────────────
-- STORM EVENTS
-- ─────────────────────────────────────────────────
CREATE TABLE storm_events (
  id              SERIAL      PRIMARY KEY,
  name            TEXT        NOT NULL,
  slug            VARCHAR(64) UNIQUE NOT NULL,
  category        VARCHAR(32) NOT NULL DEFAULT 'blizzard', -- blizzard|snowstorm|ice_storm|nor'easter
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  peak_at         TIMESTAMPTZ,

  -- Affected area (polygon)
  affected_area   GEOMETRY(MultiPolygon, 4326),

  -- Summary stats
  max_snowfall_cm   NUMERIC(8,2),
  max_wind_ms       NUMERIC(6,2),
  min_temp_c        NUMERIC(6,2),
  affected_stations INTEGER,
  total_precip_mm   NUMERIC(8,2),
  fatalities        INTEGER     DEFAULT 0,
  damage_usd        BIGINT,

  description     TEXT,
  tags            TEXT[]      DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storms_time     ON storm_events(started_at DESC);
CREATE INDEX idx_storms_area     ON storm_events USING GIST(affected_area);
CREATE INDEX idx_storms_category ON storm_events(category);

-- ─────────────────────────────────────────────────
-- STORM ↔ OBSERVATION LINK
-- ─────────────────────────────────────────────────
CREATE TABLE storm_observations (
  storm_id   INTEGER REFERENCES storm_events(id) ON DELETE CASCADE,
  obs_id     BIGINT  REFERENCES weather_observations(id) ON DELETE CASCADE,
  PRIMARY KEY (storm_id, obs_id)
);

-- ─────────────────────────────────────────────────
-- USER OBSERVATIONS (crowdsourced)
-- ─────────────────────────────────────────────────
CREATE TABLE user_observations (
  id            BIGSERIAL   PRIMARY KEY,
  user_label    TEXT,
  observed_at   TIMESTAMPTZ NOT NULL,
  location      GEOMETRY(Point, 4326) NOT NULL,
  snowfall_cm   NUMERIC(8,2),
  snow_depth_cm NUMERIC(8,2),
  temp_c        NUMERIC(6,2),
  notes         TEXT,
  photo_url     TEXT,
  verified      BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_obs_location ON user_observations USING GIST(location);
CREATE INDEX idx_user_obs_time     ON user_observations(observed_at DESC);

-- ─────────────────────────────────────────────────
-- SAVED QUERIES / USER WATCHLIST
-- ─────────────────────────────────────────────────
CREATE TABLE saved_queries (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  query_json  JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────
CREATE VIEW daily_snow_summary AS
SELECT
  station_id,
  DATE(observed_at AT TIME ZONE 'UTC') AS obs_date,
  AVG(temp_c)         AS avg_temp_c,
  MIN(temp_min_c)     AS min_temp_c,
  MAX(temp_max_c)     AS max_temp_c,
  SUM(snowfall_cm)    AS total_snowfall_cm,
  MAX(snow_depth_cm)  AS max_snow_depth_cm,
  SUM(precip_mm)      AS total_precip_mm,
  AVG(wind_speed_ms)  AS avg_wind_ms,
  MAX(wind_gust_ms)   AS max_wind_gust_ms,
  COUNT(*)            AS reading_count
FROM weather_observations
GROUP BY station_id, DATE(observed_at AT TIME ZONE 'UTC');

-- ─────────────────────────────────────────────────
-- SEED: WEATHER STATIONS
-- ─────────────────────────────────────────────────
INSERT INTO weather_stations (station_id, name, network, location, elevation_m, state, timezone) VALUES
  ('USW00094728', 'New York Central Park',       'NOAA', ST_GeomFromText('POINT(-73.9654 40.7829)', 4326),  39.6, 'NY', 'America/New_York'),
  ('USW00014895', 'Chicago O''Hare',             'NOAA', ST_GeomFromText('POINT(-87.9073 41.9742)', 4326), 204.8, 'IL', 'America/Chicago'),
  ('USW00026451', 'Denver Stapleton',            'NOAA', ST_GeomFromText('POINT(-104.8631 39.7392)', 4326),1611.2, 'CO', 'America/Denver'),
  ('USW00024229', 'Salt Lake City Intl',         'NOAA', ST_GeomFromText('POINT(-111.9780 40.7884)', 4326),1288.1, 'UT', 'America/Denver'),
  ('USW00014733', 'Boston Logan',                'NOAA', ST_GeomFromText('POINT(-71.0096 42.3656)', 4326),   9.0, 'MA', 'America/New_York'),
  ('USW00024233', 'Seattle-Tacoma Intl',         'NOAA', ST_GeomFromText('POINT(-122.3088 47.4502)', 4326), 136.9, 'WA', 'America/Los_Angeles'),
  ('USW00003017', 'Minneapolis St Paul',         'NOAA', ST_GeomFromText('POINT(-93.2218 44.8831)', 4326), 287.7, 'MN', 'America/Chicago'),
  ('USW00024090', 'Buffalo Niagara',             'NOAA', ST_GeomFromText('POINT(-78.7322 42.9404)', 4326), 215.2, 'NY', 'America/New_York'),
  ('USW00026617', 'Anchorage Intl',              'NOAA', ST_GeomFromText('POINT(-149.9961 61.1743)', 4326),  40.2, 'AK', 'America/Anchorage'),
  ('USW00094823', 'Detroit Metro',               'NOAA', ST_GeomFromText('POINT(-83.3455 42.2124)', 4326), 195.1, 'MI', 'America/Detroit'),
  ('USW00014923', 'Cleveland Hopkins',           'NOAA', ST_GeomFromText('POINT(-81.8518 41.4117)', 4326), 245.0, 'OH', 'America/New_York'),
  ('USW00094847', 'Pittsburgh Intl',             'NOAA', ST_GeomFromText('POINT(-80.2313 40.4914)', 4326), 374.6, 'PA', 'America/New_York'),
  ('USW00024151', 'Boise Air Terminal',          'NOAA', ST_GeomFromText('POINT(-116.2230 43.5644)', 4326), 874.0, 'ID', 'America/Boise'),
  ('USW00094960', 'Portland Intl',               'NOAA', ST_GeomFromText('POINT(-122.5975 45.5898)', 4326),   6.1, 'OR', 'America/Los_Angeles'),
  ('USW00094910', 'Burlington VT',               'NOAA', ST_GeomFromText('POINT(-73.1535 44.4720)', 4326), 101.5, 'VT', 'America/New_York')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- SEED: HISTORIC STORMS
-- ─────────────────────────────────────────────────
INSERT INTO storm_events (name, slug, category, started_at, ended_at, peak_at, max_snowfall_cm, max_wind_ms, min_temp_c, affected_stations, description, tags) VALUES
  ('Blizzard of 2022',       'blizzard-2022-01',    'blizzard',    '2022-01-28 18:00+00', '2022-01-30 06:00+00', '2022-01-29 12:00+00', 91.4, 24.6, -18.3, 8,  'Powerful nor''easter brought historic snowfall to the Northeast corridor.', ARRAY['nor''easter','northeast','historic']),
  ('Christmas Storm 2022',   'xmas-storm-2022',     'blizzard',    '2022-12-22 00:00+00', '2022-12-27 00:00+00', '2022-12-24 06:00+00', 127.0, 31.2, -43.0, 12, 'Bomb cyclone brought record cold and blizzard conditions across much of the US.', ARRAY['bomb-cyclone','record-cold','midwest']),
  ('Nor''easter March 2023', 'noreaster-2023-03',   'nor''easter', '2023-03-14 06:00+00', '2023-03-15 18:00+00', '2023-03-14 18:00+00', 55.9, 20.1, -8.9,  5,  'Late season nor''easter impacted New England and mid-Atlantic states.', ARRAY['nor''easter','spring','new-england']),
  ('Great Lakes Effect 2023','lake-effect-2023-11', 'snowstorm',   '2023-11-17 00:00+00', '2023-11-20 12:00+00', '2023-11-18 12:00+00', 152.4, 18.5, -12.2, 4,  'Intense lake-effect snow event buried Buffalo under record accumulations.', ARRAY['lake-effect','buffalo','record']),
  ('New England Ice Storm',  'ice-storm-2024-01',   'ice_storm',   '2024-01-09 12:00+00', '2024-01-11 00:00+00', '2024-01-10 00:00+00', 5.1, 16.0, -15.6, 6,  'Widespread ice accumulations caused major power outages across New England.', ARRAY['ice','new-england','outages']),
  ('Denver Bomb Cyclone',    'denver-bomb-2024-03', 'blizzard',    '2024-03-13 00:00+00', '2024-03-15 12:00+00', '2024-03-14 06:00+00', 76.2, 28.9, -22.8, 3,  'Explosive cyclogenesis dropped heavy snow and dangerous wind chills across Colorado.', ARRAY['bomb-cyclone','colorado','rockies'])
ON CONFLICT DO NOTHING;
