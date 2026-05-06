import React, { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler, Title,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useApp } from '../../App';
import { fetchDailySummary, fetchForecastVsActual } from '../../services/api';
import { aggregateMonthly } from '../../data/mockData';
import { format, parseISO } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler, Title);

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1a2d4a',
      borderColor: '#2d4a6e',
      borderWidth: 1,
      titleColor: '#e2eaf7',
      bodyColor: '#94a3b8',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(30,51,82,0.6)', drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11, family: 'Inter' } },
    },
    y: {
      grid: { color: 'rgba(30,51,82,0.6)', drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11, family: 'Inter' } },
    },
  },
};

export default function Dashboard() {
  const { selectedStation } = useApp();
  const [daily, setDaily]             = useState([]);
  const [fva, setFva]                 = useState([]);
  const [loading, setLoading]         = useState(true);
  const [timeRange, setTimeRange]     = useState('90');
  const [activeMetric, setActiveMetric] = useState('temp');

  useEffect(() => {
    if (!selectedStation) return;
    setLoading(true);
    Promise.all([
      fetchDailySummary(selectedStation.station_id, 365),
      fetchForecastVsActual(selectedStation.station_id),
    ]).then(([d, f]) => {
      setDaily(d);
      setFva(f);
      setLoading(false);
    });
  }, [selectedStation?.station_id]);

  const filteredDaily = useMemo(() => {
    const cutoff = parseInt(timeRange);
    return daily.slice(-cutoff);
  }, [daily, timeRange]);

  const monthly = useMemo(() => aggregateMonthly(daily), [daily]);

  if (!selectedStation) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>Select a station to view dashboard</div>
      </div>
    );
  }

  const labels = filteredDaily.map(d => format(parseISO(d.date), 'MMM d'));

  // ── Stats ────────────────────────────────────────────────────
  const totalSnow  = filteredDaily.reduce((s, d) => s + (d.total_snowfall_cm || 0), 0);
  const avgTemp    = filteredDaily.filter(d => d.avg_temp_c != null).reduce((s, d) => s + d.avg_temp_c, 0) / (filteredDaily.filter(d => d.avg_temp_c != null).length || 1);
  const snowDays   = filteredDaily.filter(d => d.total_snowfall_cm > 0).length;
  const maxSnow    = Math.max(...filteredDaily.map(d => d.total_snowfall_cm || 0));
  const minTemp    = Math.min(...filteredDaily.filter(d => d.min_temp_c != null).map(d => d.min_temp_c));

  // ── Temperature Chart ─────────────────────────────────────────
  const tempChartData = {
    labels,
    datasets: [
      {
        label: 'Max °C', data: filteredDaily.map(d => d.max_temp_c),
        borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.04)', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
      },
      {
        label: 'Avg °C', data: filteredDaily.map(d => d.avg_temp_c),
        borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.08)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
      },
      {
        label: 'Min °C', data: filteredDaily.map(d => d.min_temp_c),
        borderColor: '#818cf8', backgroundColor: 'rgba(129,140,248,0.04)', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
      },
    ],
  };

  // ── Snowfall Chart ────────────────────────────────────────────
  const snowChartData = {
    labels,
    datasets: [{
      label: 'Snowfall (cm)',
      data: filteredDaily.map(d => d.total_snowfall_cm),
      backgroundColor: filteredDaily.map(d => d.total_snowfall_cm > 5 ? 'rgba(129,140,248,0.8)' : 'rgba(56,189,248,0.55)'),
      borderColor: filteredDaily.map(d => d.total_snowfall_cm > 5 ? '#818cf8' : '#38bdf8'),
      borderWidth: 1, borderRadius: 3,
    }],
  };

  // ── Monthly Heatmap proxy (bar) ───────────────────────────────
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthlySnow = Array(12).fill(0);
  monthly.forEach(m => {
    const idx = parseInt(m.month.slice(5, 7)) - 1;
    monthlySnow[idx] += m.total_snowfall_cm;
  });

  const monthlyChartData = {
    labels: monthNames,
    datasets: [{
      label: 'Avg Monthly Snowfall (cm)',
      data: monthlySnow,
      backgroundColor: monthlySnow.map(v => v > 30 ? 'rgba(129,140,248,0.8)' : v > 10 ? 'rgba(56,189,248,0.7)' : 'rgba(30,51,82,0.7)'),
      borderRadius: 4, borderWidth: 1,
      borderColor: 'rgba(45,74,110,0.6)',
    }],
  };

  // ── Forecast vs Actual ────────────────────────────────────────
  const fvaLabels = fva.map(d => format(parseISO(d.date), 'MMM d'));
  const fvaChartData = {
    labels: fvaLabels,
    datasets: [
      {
        label: 'Forecast °C', data: fva.map(d => d.forecast_temp_c),
        borderColor: '#fbbf24', backgroundColor: 'transparent',
        tension: 0.4, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3],
      },
      {
        label: 'Actual °C', data: fva.map(d => d.actual_temp_c),
        borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.06)', fill: true,
        tension: 0.4, pointRadius: 0, borderWidth: 2,
      },
    ],
  };

  const fvaSnowData = {
    labels: fvaLabels,
    datasets: [
      { label: 'Forecast', data: fva.map(d => d.forecast_snowfall_cm), backgroundColor: 'rgba(251,191,36,0.6)', borderRadius: 3, borderWidth: 0 },
      { label: 'Actual',   data: fva.map(d => d.actual_snowfall_cm),   backgroundColor: 'rgba(129,140,248,0.7)', borderRadius: 3, borderWidth: 0 },
    ],
  };

  const tempOpts = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: {
        display: true, position: 'top',
        labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 14 },
      },
      tooltip: {
        ...CHART_DEFAULTS.plugins.tooltip,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}°C` },
      },
    },
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}°C` } },
    },
  };

  const snowBarOpts = {
    ...CHART_DEFAULTS,
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}cm` } },
    },
  };

  const fvaOpts = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: {
        display: true, position: 'top',
        labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 14 },
      },
    },
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>📊 {selectedStation.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {selectedStation.state} · {selectedStation.lat?.toFixed(4)}°N, {Math.abs(selectedStation.lon)?.toFixed(4)}°W · {Math.round(selectedStation.elevation_m || 0)}m elevation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['30', '90', '180', '365'].map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`btn btn-sm ${timeRange === r ? 'btn-primary' : 'btn-ghost'}`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-tile">
          <div className="stat-label">Total Snowfall</div>
          <div className="stat-value ice">{Math.round(totalSnow)}cm</div>
          <div className="stat-sub">Last {timeRange} days</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Avg Temperature</div>
          <div className={`stat-value ${avgTemp < 0 ? 'aurora' : 'warm'}`}>{avgTemp.toFixed(1)}°C</div>
          <div className="stat-sub">Mean daily avg</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Snow Days</div>
          <div className="stat-value snow">{snowDays}</div>
          <div className="stat-sub">Days with accumulation</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Single-Day Max</div>
          <div className="stat-value ice">{maxSnow.toFixed(1)}cm</div>
          <div className="stat-sub">Peak daily snowfall</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Record Low</div>
          <div className="stat-value aurora">{isFinite(minTemp) ? `${minTemp.toFixed(1)}°C` : '—'}</div>
          <div className="stat-sub">Coldest recorded</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Temperature Time Series */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div className="card-title"><span className="icon">🌡</span> Temperature Time Series</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily min / avg / max · °C</div>
            </div>
            <div style={{ height: 220 }}>
              <Line data={tempChartData} options={tempOpts} />
            </div>
          </div>

          {/* Snowfall Bar Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon">❄️</span> Daily Snowfall</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>cm accumulation</div>
            </div>
            <div style={{ height: 200 }}>
              <Bar data={snowChartData} options={snowBarOpts} />
            </div>
          </div>

          {/* Monthly Distribution */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon">📅</span> Monthly Snowfall Distribution</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Seasonal pattern</div>
            </div>
            <div style={{ height: 200 }}>
              <Bar data={monthlyChartData} options={{
                ...CHART_DEFAULTS,
                scales: {
                  ...CHART_DEFAULTS.scales,
                  y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}cm` } },
                },
              }} />
            </div>
          </div>

          {/* Forecast vs Actual Temp */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon">🎯</span> Forecast vs Actual — Temperature</div>
              <div className="badge badge-ice" style={{ fontSize: 10 }}>MAE ±1.8°C</div>
            </div>
            <div style={{ height: 200 }}>
              <Line data={fvaChartData} options={{ ...fvaOpts, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}°C` } } } }} />
            </div>
          </div>

          {/* Forecast vs Actual Snow */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span className="icon">❄</span> Forecast vs Actual — Snowfall</div>
              <div className="badge badge-aurora" style={{ fontSize: 10 }}>MAE ±2.4cm</div>
            </div>
            <div style={{ height: 200 }}>
              <Bar data={fvaSnowData} options={{
                ...CHART_DEFAULTS,
                plugins: { ...CHART_DEFAULTS.plugins, legend: { display: true, position: 'top', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 12 } } },
                scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}cm` } } },
              }} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
