import { subDays, subHours, addHours, format } from 'date-fns';

// ── Stations ─────────────────────────────────────────────────
export const STATIONS = [
  { station_id: 'USW00094728', name: 'New York Central Park', state: 'NY', lat: 40.7829, lon: -73.9654, elevation_m: 39.6 },
  { station_id: 'USW00014895', name: "Chicago O'Hare",        state: 'IL', lat: 41.9742, lon: -87.9073, elevation_m: 204.8 },
  { station_id: 'USW00026451', name: 'Denver Stapleton',      state: 'CO', lat: 39.7392, lon: -104.8631, elevation_m: 1611 },
  { station_id: 'USW00024229', name: 'Salt Lake City Intl',   state: 'UT', lat: 40.7884, lon: -111.978, elevation_m: 1288 },
  { station_id: 'USW00014733', name: 'Boston Logan',          state: 'MA', lat: 42.3656, lon: -71.0096, elevation_m: 9 },
  { station_id: 'USW00024233', name: 'Seattle-Tacoma Intl',   state: 'WA', lat: 47.4502, lon: -122.3088, elevation_m: 137 },
  { station_id: 'USW00003017', name: 'Minneapolis St Paul',   state: 'MN', lat: 44.8831, lon: -93.2218, elevation_m: 288 },
  { station_id: 'USW00024090', name: 'Buffalo Niagara',       state: 'NY', lat: 42.9404, lon: -78.7322, elevation_m: 215 },
  { station_id: 'USW00026617', name: 'Anchorage Intl',        state: 'AK', lat: 61.1743, lon: -149.9961, elevation_m: 40 },
  { station_id: 'USW00094823', name: 'Detroit Metro',         state: 'MI', lat: 42.2124, lon: -83.3455, elevation_m: 195 },
  { station_id: 'USW00014923', name: 'Cleveland Hopkins',     state: 'OH', lat: 41.4117, lon: -81.8518, elevation_m: 245 },
  { station_id: 'USW00094847', name: 'Pittsburgh Intl',       state: 'PA', lat: 40.4914, lon: -80.2313, elevation_m: 374 },
  { station_id: 'USW00094910', name: 'Burlington VT',         state: 'VT', lat: 44.4720, lon: -73.1535, elevation_m: 101 },
];

// ── Storms ───────────────────────────────────────────────────
export const STORMS = [
  {
    id: 1, name: 'Blizzard of 2022', slug: 'blizzard-2022-01',
    category: 'blizzard',
    started_at: '2022-01-28T18:00:00Z', ended_at: '2022-01-30T06:00:00Z', peak_at: '2022-01-29T12:00:00Z',
    max_snowfall_cm: 91.4, max_wind_ms: 24.6, min_temp_c: -18.3, affected_stations: 8, duration_hours: 36,
    description: "Powerful nor'easter brought historic snowfall to the Northeast corridor. Philadelphia recorded its second-highest single-storm total. States of emergency declared across 6 states.",
    tags: ["nor'easter", 'northeast', 'historic'],
  },
  {
    id: 2, name: 'Christmas Storm 2022', slug: 'xmas-storm-2022',
    category: 'blizzard',
    started_at: '2022-12-22T00:00:00Z', ended_at: '2022-12-27T00:00:00Z', peak_at: '2022-12-24T06:00:00Z',
    max_snowfall_cm: 127.0, max_wind_ms: 31.2, min_temp_c: -43.0, affected_stations: 12, duration_hours: 120,
    description: 'Bomb cyclone brought record cold and blizzard conditions across much of the US. Buffalo was hit hardest with over 4 feet of snow. 60+ deaths reported nationally.',
    tags: ['bomb-cyclone', 'record-cold', 'midwest'],
  },
  {
    id: 3, name: "Nor'easter March 2023", slug: 'noreaster-2023-03',
    category: "nor'easter",
    started_at: '2023-03-14T06:00:00Z', ended_at: '2023-03-15T18:00:00Z', peak_at: '2023-03-14T18:00:00Z',
    max_snowfall_cm: 55.9, max_wind_ms: 20.1, min_temp_c: -8.9, affected_stations: 5, duration_hours: 36,
    description: 'Late season nor\'easter impacted New England and mid-Atlantic states. Boston Logan recorded 22 inches. Power outages affected over 100,000 customers.',
    tags: ["nor'easter", 'spring', 'new-england'],
  },
  {
    id: 4, name: 'Great Lakes Effect 2023', slug: 'lake-effect-2023-11',
    category: 'snowstorm',
    started_at: '2023-11-17T00:00:00Z', ended_at: '2023-11-20T12:00:00Z', peak_at: '2023-11-18T12:00:00Z',
    max_snowfall_cm: 152.4, max_wind_ms: 18.5, min_temp_c: -12.2, affected_stations: 4, duration_hours: 84,
    description: 'Intense lake-effect snow event buried Buffalo under record accumulations. Some areas received over 60 inches. Lake-effect bands stalled for 3 days producing localized extreme totals.',
    tags: ['lake-effect', 'buffalo', 'record'],
  },
  {
    id: 5, name: 'New England Ice Storm', slug: 'ice-storm-2024-01',
    category: 'ice_storm',
    started_at: '2024-01-09T12:00:00Z', ended_at: '2024-01-11T00:00:00Z', peak_at: '2024-01-10T00:00:00Z',
    max_snowfall_cm: 5.1, max_wind_ms: 16.0, min_temp_c: -15.6, affected_stations: 6, duration_hours: 36,
    description: 'Widespread ice accumulations of up to 0.75 inches caused major power outages across New England. Over 400,000 customers lost power. Multiple highway closures.',
    tags: ['ice', 'new-england', 'outages'],
  },
  {
    id: 6, name: 'Denver Bomb Cyclone', slug: 'denver-bomb-2024-03',
    category: 'blizzard',
    started_at: '2024-03-13T00:00:00Z', ended_at: '2024-03-15T12:00:00Z', peak_at: '2024-03-14T06:00:00Z',
    max_snowfall_cm: 76.2, max_wind_ms: 28.9, min_temp_c: -22.8, affected_stations: 3, duration_hours: 60,
    description: 'Explosive cyclogenesis dropped heavy snow and dangerous wind chills across Colorado. Denver International Airport closed for 24+ hours. 2,000+ flights cancelled.',
    tags: ['bomb-cyclone', 'colorado', 'rockies'],
  },
];

// ── Seeded random (consistent results) ───────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Generate hourly observations for a station ───────────────
export function generateObservations(stationId, days = 365) {
  const station = STATIONS.find(s => s.station_id === stationId);
  if (!station) return [];

  const rng = seededRandom(stationId.charCodeAt(3) * 1000 + stationId.charCodeAt(5) * 7);
  const observations = [];
  const now = new Date();

  // Climate profiles per station
  const profiles = {
    'USW00094728': { baseTemp: 12,  snowMonths: [11,12,1,2,3],  snowIntensity: 1.2 },
    'USW00014895': { baseTemp: 9,   snowMonths: [11,12,1,2,3],  snowIntensity: 1.5 },
    'USW00026451': { baseTemp: 10,  snowMonths: [10,11,12,1,2,3,4], snowIntensity: 2.0 },
    'USW00024229': { baseTemp: 11,  snowMonths: [11,12,1,2,3],  snowIntensity: 1.8 },
    'USW00014733': { baseTemp: 10,  snowMonths: [11,12,1,2,3],  snowIntensity: 1.6 },
    'USW00024233': { baseTemp: 12,  snowMonths: [11,12,1,2],    snowIntensity: 0.8 },
    'USW00003017': { baseTemp: 6,   snowMonths: [10,11,12,1,2,3,4], snowIntensity: 2.2 },
    'USW00024090': { baseTemp: 9,   snowMonths: [11,12,1,2,3],  snowIntensity: 3.0 },
    'USW00026617': { baseTemp: 2,   snowMonths: [9,10,11,12,1,2,3,4,5], snowIntensity: 2.5 },
    'USW00094823': { baseTemp: 9,   snowMonths: [11,12,1,2,3],  snowIntensity: 1.4 },
    'USW00014923': { baseTemp: 10,  snowMonths: [11,12,1,2,3],  snowIntensity: 1.8 },
    'USW00094847': { baseTemp: 11,  snowMonths: [11,12,1,2,3],  snowIntensity: 1.3 },
    'USW00094910': { baseTemp: 8,   snowMonths: [11,12,1,2,3,4], snowIntensity: 2.0 },
  };

  const profile = profiles[stationId] || { baseTemp: 10, snowMonths: [12,1,2], snowIntensity: 1.0 };
  let snowDepth = 0;

  for (let d = days; d >= 0; d -= 1/24) {
    const ts = subHours(now, d * 24);
    const month = ts.getMonth() + 1;
    const dayOfYear = Math.floor(d);

    // Temperature: sinusoidal annual cycle
    const annualCycle = Math.sin((month - 1) / 12 * 2 * Math.PI - Math.PI / 2);
    const temp = profile.baseTemp + annualCycle * 18 + (rng() - 0.5) * 6;

    // Snow: probabilistic based on month and temp
    const isSnowMonth = profile.snowMonths.includes(month);
    const snowProb = isSnowMonth && temp < 2 ? 0.12 * profile.snowIntensity : 0.01;
    const snowfall = rng() < snowProb ? Math.pow(rng(), 1.5) * 8 * profile.snowIntensity : 0;

    snowDepth = Math.max(0, snowDepth + snowfall - (temp > 2 ? rng() * 0.5 : 0));
    if (temp > 5) snowDepth = Math.max(0, snowDepth - 2);

    observations.push({
      observed_at: ts.toISOString(),
      station_id: stationId,
      lat: station.lat, lon: station.lon,
      temp_c: Math.round(temp * 10) / 10,
      temp_min_c: Math.round((temp - rng() * 3) * 10) / 10,
      temp_max_c: Math.round((temp + rng() * 3) * 10) / 10,
      feels_like_c: Math.round((temp - rng() * 4) * 10) / 10,
      humidity_pct: Math.round(50 + rng() * 40),
      pressure_hpa: Math.round(1000 + (rng() - 0.5) * 30),
      wind_speed_ms: Math.round(rng() * 12 * 10) / 10,
      wind_gust_ms: Math.round(rng() * 18 * 10) / 10,
      wind_direction_deg: Math.floor(rng() * 360),
      snowfall_cm: Math.round(snowfall * 10) / 10,
      snow_depth_cm: Math.round(snowDepth * 10) / 10,
      precip_mm: Math.round((snowfall * 10 + (rng() < 0.1 && temp > 0 ? rng() * 5 : 0)) * 10) / 10,
      visibility_km: snowfall > 2 ? Math.round((1 + rng() * 5) * 10) / 10 : Math.round((8 + rng() * 12) * 10) / 10,
      cloud_cover_pct: Math.round(snowfall > 0 ? 70 + rng() * 30 : rng() * 100),
      condition_text: getCondition(temp, snowfall, rng()),
      condition_code: getConditionCode(temp, snowfall),
    });
  }

  return observations;
}

function getCondition(temp, snow, r) {
  if (snow > 5) return 'Heavy Snow';
  if (snow > 1) return 'Snow';
  if (snow > 0) return 'Light Snow';
  if (temp < -10) return 'Extreme Cold';
  if (temp < 0) return 'Freezing';
  if (r < 0.15) return 'Rain';
  if (r < 0.3) return 'Overcast';
  if (r < 0.5) return 'Partly Cloudy';
  return 'Clear';
}

function getConditionCode(temp, snow) {
  if (snow > 5) return 602;
  if (snow > 0) return 601;
  if (temp < 0) return 611;
  return 800;
}

// ── Aggregate by day ──────────────────────────────────────────
export function aggregateDaily(observations) {
  const byDay = {};
  for (const obs of observations) {
    const day = obs.observed_at.slice(0, 10);
    if (!byDay[day]) {
      byDay[day] = { date: day, temps: [], snow: 0, depth: [], wind: [], precip: 0, readings: 0 };
    }
    const b = byDay[day];
    if (obs.temp_c != null) b.temps.push(obs.temp_c);
    b.snow += obs.snowfall_cm || 0;
    if (obs.snow_depth_cm != null) b.depth.push(obs.snow_depth_cm);
    if (obs.wind_speed_ms != null) b.wind.push(obs.wind_speed_ms);
    b.precip += obs.precip_mm || 0;
    b.readings++;
  }

  return Object.values(byDay).map(d => ({
    date: d.date,
    avg_temp_c: d.temps.length ? Math.round(avg(d.temps) * 10) / 10 : null,
    min_temp_c: d.temps.length ? Math.round(Math.min(...d.temps) * 10) / 10 : null,
    max_temp_c: d.temps.length ? Math.round(Math.max(...d.temps) * 10) / 10 : null,
    total_snowfall_cm: Math.round(d.snow * 10) / 10,
    max_snow_depth_cm: d.depth.length ? Math.round(Math.max(...d.depth) * 10) / 10 : 0,
    avg_wind_ms: d.wind.length ? Math.round(avg(d.wind) * 10) / 10 : null,
    total_precip_mm: Math.round(d.precip * 10) / 10,
    readings: d.readings,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Aggregate by month ────────────────────────────────────────
export function aggregateMonthly(daily) {
  const byMonth = {};
  for (const d of daily) {
    const m = d.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { month: m, temps: [], snow: 0, precip: 0, days: 0 };
    if (d.avg_temp_c != null) byMonth[m].temps.push(d.avg_temp_c);
    byMonth[m].snow += d.total_snowfall_cm;
    byMonth[m].precip += d.total_precip_mm;
    byMonth[m].days++;
  }
  return Object.values(byMonth).map(m => ({
    month: m.month,
    avg_temp_c: m.temps.length ? Math.round(avg(m.temps) * 10) / 10 : null,
    total_snowfall_cm: Math.round(m.snow * 10) / 10,
    total_precip_mm: Math.round(m.precip * 10) / 10,
    days: m.days,
  })).sort((a, b) => a.month.localeCompare(b.month));
}

// ── Yearly trend ──────────────────────────────────────────────
export function getYearlyTrend(stationId) {
  const rng = seededRandom(stationId.charCodeAt(0) * 99);
  const years = [];
  for (let y = 2015; y <= 2024; y++) {
    years.push({
      year: y,
      avg_temp_c: Math.round((10 + (y - 2015) * 0.08 + (rng() - 0.5) * 1.5) * 10) / 10,
      total_snowfall_cm: Math.round((180 - (y - 2015) * 1.2 + (rng() - 0.5) * 30) * 10) / 10,
      snow_days: Math.round(38 - (y - 2015) * 0.3 + (rng() - 0.5) * 5),
    });
  }
  return years;
}

// ── Forecast vs actual ────────────────────────────────────────
export function getForecastVsActual(stationId, days = 60) {
  const rng = seededRandom(stationId.charCodeAt(1) * 44);
  const rows = [];
  for (let d = days; d >= 1; d--) {
    const date = format(subDays(new Date(), d), 'yyyy-MM-dd');
    const actual_temp = Math.round((rng() * 30 - 10) * 10) / 10;
    const actual_snow = rng() < 0.2 ? Math.round(rng() * 10 * 10) / 10 : 0;
    rows.push({
      date,
      forecast_temp_c: Math.round((actual_temp + (rng() - 0.5) * 3) * 10) / 10,
      actual_temp_c: actual_temp,
      forecast_snowfall_cm: Math.round(Math.max(0, actual_snow + (rng() - 0.5) * 4) * 10) / 10,
      actual_snowfall_cm: actual_snow,
    });
  }
  return rows;
}

// ── Heatmap data (all stations latest) ───────────────────────
export function getHeatmapData(metric = 'snowfall_cm') {
  const rng = seededRandom(42);
  return STATIONS.map(s => ({
    lat: s.lat,
    lon: s.lon,
    station_id: s.station_id,
    name: s.name,
    value: metric === 'snowfall_cm'
      ? Math.round(rng() * 15 * 10) / 10
      : metric === 'temp_c'
        ? Math.round((rng() * 25 - 10) * 10) / 10
        : Math.round(rng() * 10 * 10) / 10,
  }));
}

// ── Insights ──────────────────────────────────────────────────
export function getInsightsSummary(stationId) {
  const daily = aggregateDaily(generateObservations(stationId, 365));
  const sorted = [...daily].sort((a, b) => b.total_snowfall_cm - a.total_snowfall_cm);
  const coldest = [...daily].filter(d => d.min_temp_c != null).sort((a, b) => a.min_temp_c - b.min_temp_c);

  const months = [0,0,0,0,0,0,0,0,0,0,0,0];
  let totalSnow = 0, snowDays = 0;
  for (const d of daily) {
    const m = parseInt(d.date.slice(5, 7)) - 1;
    months[m] += d.total_snowfall_cm;
    totalSnow += d.total_snowfall_cm;
    if (d.total_snowfall_cm > 0) snowDays++;
  }

  return {
    snowiest_days: sorted.slice(0, 10),
    coldest_days:  coldest.slice(0, 10),
    monthly_snowfall: months.map((v, i) => ({
      month: i + 1,
      total_snowfall_cm: Math.round(v * 10) / 10,
    })),
    total_snowfall_cm: Math.round(totalSnow * 10) / 10,
    snow_days: snowDays,
    yearly_trends: getYearlyTrend(stationId),
    forecast_accuracy: { mae_temp_c: 1.8, mae_snowfall_cm: 2.4, pairs: 142 },
  };
}

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
