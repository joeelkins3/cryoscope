import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';
import { fetchDailySummary } from '../../services/api';
import { format, subDays } from 'date-fns';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export default function WeatherPopup({ station, obs, onClose }) {
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchDailySummary(station.station_id, 30).then(data => {
      setDaily(data.slice(-14));
      setLoading(false);
    });
  }, [station.station_id]);

  const labels = daily.map(d => format(new Date(d.date), 'MMM d'));
  const tempData = daily.map(d => d.avg_temp_c);
  const snowData = daily.map(d => d.total_snowfall_cm);

  const tempChart = {
    labels,
    datasets: [{
      data: tempData,
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      borderWidth: 1.5,
    }],
  };

  const snowChart = {
    labels,
    datasets: [{
      data: snowData,
      borderColor: '#818cf8',
      backgroundColor: 'rgba(129,140,248,0.12)',
      fill: true,
      tension: 0.2,
      pointRadius: 2,
      borderWidth: 1.5,
    }],
  };

  const miniOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  const conditionEmoji = (code) => {
    if (!code) return '🌫';
    if (code >= 600 && code < 700) return '❄️';
    if (code >= 700 && code < 800) return '🌫️';
    if (code === 800) return '☀️';
    if (code > 800) return '☁️';
    if (code >= 500) return '🌧️';
    if (code >= 300) return '🌦️';
    if (code >= 200) return '⛈️';
    return '🌡️';
  };

  return (
    <div style={{
      position: 'absolute', top: 14, right: 14, zIndex: 600,
      width: 320, background: 'var(--bg-surface)',
      border: '1px solid var(--border-bright)', borderRadius: 14,
      boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      animation: 'slideInRight 0.25s ease',
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(30px); opacity: 0; } }`}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{station.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {station.state} · {station.lat?.toFixed(4)}°N, {Math.abs(station.lon)?.toFixed(4)}°W · {Math.round(station.elevation_m || 0)}m
          </div>
        </div>
        <button onClick={onClose} className="panel-close">✕</button>
      </div>

      {/* Current conditions */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 40 }}>{conditionEmoji(obs?.condition_code)}</div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, color: obs?.temp_c < 0 ? 'var(--aurora)' : 'var(--ice)', lineHeight: 1 }}>
              {obs?.temp_c != null ? `${obs.temp_c > 0 ? '+' : ''}${obs.temp_c}°C` : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{obs?.condition_text || 'No data'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
          {[
            { label: 'Snow',    value: obs?.snowfall_cm != null ? `${obs.snowfall_cm}cm` : '—', icon: '❄️', color: 'var(--frost)' },
            { label: 'Depth',   value: obs?.snow_depth_cm != null ? `${obs.snow_depth_cm}cm` : '—', icon: '🏔', color: 'var(--ice)' },
            { label: 'Wind',    value: obs?.wind_speed_ms != null ? `${obs.wind_speed_ms}m/s` : '—', icon: '💨', color: 'var(--text-secondary)' },
            { label: 'Humidity',value: obs?.humidity_pct != null ? `${obs.humidity_pct}%` : '—', icon: '💧', color: 'var(--info)' },
            { label: 'Pressure',value: obs?.pressure_hpa != null ? `${obs.pressure_hpa}hPa` : '—', icon: '📊', color: 'var(--text-secondary)' },
            { label: 'Feels',   value: obs?.feels_like_c != null ? `${obs.feels_like_c}°C` : '—', icon: '🌡', color: 'var(--aurora)' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{item.icon} {item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 14-day mini charts */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          14-Day Trend
        </div>
        {loading ? (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ice)', marginBottom: 4 }}>Temperature (°C)</div>
              <div style={{ height: 50 }}><Line data={tempChart} options={miniOpts} /></div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--aurora)', marginBottom: 4 }}>Snowfall (cm)</div>
              <div style={{ height: 50 }}><Line data={snowChart} options={miniOpts} /></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => { }}>📊 Full Dashboard</button>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>🔍 Query Data</button>
      </div>
    </div>
  );
}
