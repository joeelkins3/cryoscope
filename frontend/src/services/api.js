import axios from 'axios';
import {
  STATIONS, STORMS,
  generateObservations, aggregateDaily, aggregateMonthly,
  getForecastVsActual, getHeatmapData, getInsightsSummary, getYearlyTrend,
} from '../data/mockData';

const API_URL = import.meta.env.VITE_API_URL || '';
const DEMO_MODE = !API_URL || API_URL === '';

const http = axios.create({ baseURL: API_URL, timeout: 10000 });

// Try real API, silently fall back to mock
async function tryReal(fn, fallback) {
  if (DEMO_MODE) return fallback();
  try { return await fn(); }
  catch { return fallback(); }
}

// ── Stations ─────────────────────────────────────────────────
export const fetchStations = () =>
  tryReal(
    async () => (await http.get('/api/weather/stations')).data,
    () => STATIONS,
  );

// ── Current weather at a point ────────────────────────────────
export const fetchCurrentWeather = (lat, lon) =>
  tryReal(
    async () => (await http.get('/api/weather/current', { params: { lat, lon } })).data,
    () => {
      const nearest = [...STATIONS].sort((a, b) =>
        haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon)
      )[0];
      const obs = generateObservations(nearest.station_id, 2);
      const latest = obs[obs.length - 1];
      return { live: latest, nearest_db: latest, station: nearest };
    },
  );

// ── History for a station ─────────────────────────────────────
export const fetchHistory = (stationId, start, end) =>
  tryReal(
    async () => (await http.get('/api/weather/history', { params: { station_id: stationId, start, end } })).data,
    () => {
      const obs = generateObservations(stationId, 365);
      if (!start && !end) return obs.slice(-8760);
      return obs.filter(o => {
        const t = new Date(o.observed_at);
        return (!start || t >= new Date(start)) && (!end || t <= new Date(end));
      });
    },
  );

// ── Daily aggregated summary ──────────────────────────────────
export const fetchDailySummary = (stationId, days = 365) =>
  tryReal(
    async () => (await http.get('/api/weather/daily-summary', { params: { station_id: stationId } })).data,
    () => aggregateDaily(generateObservations(stationId, days)),
  );

// ── Heatmap data ──────────────────────────────────────────────
export const fetchHeatmap = (metric = 'snowfall_cm') =>
  tryReal(
    async () => (await http.get('/api/weather/heatmap', { params: { metric } })).data,
    () => getHeatmapData(metric),
  );

// ── Timeline for a single day ─────────────────────────────────
export const fetchTimeline = (lat, lon, date) =>
  tryReal(
    async () => (await http.get('/api/weather/timeline', { params: { lat, lon, date } })).data,
    () => {
      const nearest = [...STATIONS].sort((a, b) =>
        haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon)
      )[0];
      return generateObservations(nearest.station_id, 1).slice(-24);
    },
  );

// ── Nearby stations ───────────────────────────────────────────
export const fetchNearby = (lat, lon, radiusKm = 500) =>
  tryReal(
    async () => (await http.get('/api/weather/nearby', { params: { lat, lon, radius_km: radiusKm } })).data,
    () => STATIONS
      .map(s => ({ ...s, dist_km: Math.round(haversine(lat, lon, s.lat, s.lon)) }))
      .filter(s => s.dist_km <= radiusKm)
      .sort((a, b) => a.dist_km - b.dist_km),
  );

// ── Storms ───────────────────────────────────────────────────
export const fetchStorms = (params = {}) =>
  tryReal(
    async () => (await http.get('/api/storms', { params })).data,
    () => {
      let storms = [...STORMS];
      if (params.category) storms = storms.filter(s => s.category === params.category);
      if (params.year)     storms = storms.filter(s => new Date(s.started_at).getFullYear() === parseInt(params.year));
      return storms;
    },
  );

export const fetchStorm = (slug) =>
  tryReal(
    async () => (await http.get(`/api/storms/${slug}`)).data,
    () => {
      const storm = STORMS.find(s => s.slug === slug);
      if (!storm) return null;
      // Synthesize observations for the storm window
      const observations = STATIONS.slice(0, storm.affected_stations).flatMap(st => {
        const obs = generateObservations(st.station_id, 3);
        return obs.map(o => ({ ...o, station_name: st.name }));
      });
      return { ...storm, observations };
    },
  );

// ── Insights ─────────────────────────────────────────────────
export const fetchInsights = (stationId) =>
  tryReal(
    async () => (await http.get('/api/insights/summary', { params: { station_id: stationId } })).data,
    () => getInsightsSummary(stationId),
  );

export const fetchForecastVsActual = (stationId) =>
  tryReal(
    async () => (await http.get('/api/insights/forecast-vs-actual', { params: { station_id: stationId } })).data,
    () => getForecastVsActual(stationId),
  );

export const fetchTrends = (stationId) =>
  tryReal(
    async () => (await http.get('/api/insights/trends', { params: { station_id: stationId } })).data,
    () => getYearlyTrend(stationId),
  );

// ── Query builder ─────────────────────────────────────────────
export const runQuery = (body) =>
  tryReal(
    async () => (await http.post('/api/query', body)).data,
    () => {
      const stationId = body.station_ids?.[0] || STATIONS[0].station_id;
      const daily = aggregateDaily(generateObservations(stationId, 90));
      return { count: daily.length, metrics: body.metrics || ['temp_c', 'snowfall_cm'], aggregate: body.aggregate || 'daily', data: daily };
    },
  );

export const saveQuery = (body) =>
  tryReal(
    async () => (await http.post('/api/query/save', body)).data,
    () => ({ ...body, id: Date.now(), created_at: new Date().toISOString() }),
  );

// ── Submit user observation ───────────────────────────────────
export const submitObservation = (body) =>
  tryReal(
    async () => (await http.post('/api/observations', body)).data,
    () => ({ ...body, id: Date.now(), verified: false }),
  );

// ── Utilities ────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export { DEMO_MODE };
