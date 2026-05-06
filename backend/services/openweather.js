const axios = require('axios');

const BASE = 'https://api.openweathermap.org/data/2.5';
const BASE_3 = 'https://api.openweathermap.org/data/3.0';
const KEY = process.env.OPENWEATHER_API_KEY;

function isConfigured() {
  return Boolean(KEY && KEY.length > 10);
}

async function getCurrentWeather(lat, lon) {
  if (!isConfigured()) return null;
  const { data } = await axios.get(`${BASE}/weather`, {
    params: { lat, lon, appid: KEY, units: 'metric' },
    timeout: 8000,
  });
  return normalize(data, 'current');
}

async function getForecast(lat, lon) {
  if (!isConfigured()) return [];
  const { data } = await axios.get(`${BASE}/forecast`, {
    params: { lat, lon, appid: KEY, units: 'metric', cnt: 40 },
    timeout: 8000,
  });
  return data.list.map(item => normalize(item, 'forecast'));
}

async function getAirPollution(lat, lon) {
  if (!isConfigured()) return null;
  const { data } = await axios.get(`${BASE}/air_pollution`, {
    params: { lat, lon, appid: KEY },
    timeout: 8000,
  });
  return data.list[0] || null;
}

// Normalize OpenWeather response → CryoScope schema
function normalize(raw, source = 'api') {
  const snow = raw.snow || {};
  const wind = raw.wind || {};
  const main = raw.main || {};
  const clouds = raw.clouds || {};

  return {
    observed_at: new Date((raw.dt || Date.now() / 1000) * 1000).toISOString(),
    lat: raw.coord?.lat ?? null,
    lon: raw.coord?.lon ?? null,
    temp_c: main.temp ?? null,
    temp_min_c: main.temp_min ?? null,
    temp_max_c: main.temp_max ?? null,
    feels_like_c: main.feels_like ?? null,
    humidity_pct: main.humidity ?? null,
    pressure_hpa: main.pressure ?? null,
    visibility_km: raw.visibility ? raw.visibility / 1000 : null,
    cloud_cover_pct: clouds.all ?? null,
    wind_speed_ms: wind.speed ?? null,
    wind_gust_ms: wind.gust ?? null,
    wind_direction_deg: wind.deg ?? null,
    snowfall_cm: snow['1h'] ? snow['1h'] * 10 : null,
    snow_depth_cm: snow['3h'] ? snow['3h'] * 10 : null,
    precip_mm: (raw.rain?.['1h'] || raw.rain?.['3h'] || 0) + (snow['1h'] || snow['3h'] || 0) * 10,
    condition_code: raw.weather?.[0]?.id ?? null,
    condition_text: raw.weather?.[0]?.description ?? null,
    source,
    raw_json: raw,
  };
}

module.exports = { getCurrentWeather, getForecast, getAirPollution, isConfigured };
