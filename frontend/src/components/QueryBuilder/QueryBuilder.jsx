import React, { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useApp } from '../../App';
import { runQuery, saveQuery } from '../../services/api';
import { STATIONS } from '../../data/mockData';
import { format, parseISO, subDays } from 'date-fns';

const METRICS = [
  { value: 'temp_c',        label: 'Temperature (°C)', icon: '🌡' },
  { value: 'snowfall_cm',   label: 'Snowfall (cm)',     icon: '❄️' },
  { value: 'snow_depth_cm', label: 'Snow Depth (cm)',   icon: '🏔' },
  { value: 'precip_mm',     label: 'Precipitation (mm)',icon: '💧' },
  { value: 'wind_speed_ms', label: 'Wind Speed (m/s)',  icon: '💨' },
  { value: 'humidity_pct',  label: 'Humidity (%)',      icon: '🌫' },
  { value: 'pressure_hpa',  label: 'Pressure (hPa)',    icon: '📊' },
];

export default function QueryBuilder() {
  const { toast } = useApp();
  const [form, setForm] = useState({
    station_ids: [STATIONS[0].station_id],
    start_date: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    metrics: ['temp_c', 'snowfall_cm'],
    aggregate: 'daily',
    min_snowfall: '',
    max_temp: '',
    min_wind: '',
    limit: '500',
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [chartType, setChartType] = useState('line');
  const [activeMetricChart, setActiveMetricChart] = useState('temp_c');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleStation = (id) => {
    set('station_ids', form.station_ids.includes(id)
      ? form.station_ids.filter(s => s !== id)
      : [...form.station_ids, id]);
  };

  const toggleMetric = (m) => {
    set('metrics', form.metrics.includes(m)
      ? form.metrics.filter(x => x !== m)
      : [...form.metrics, m]);
  };

  const handleRun = async () => {
    if (!form.station_ids.length) { toast('Select at least one station', 'warning'); return; }
    if (!form.metrics.length)     { toast('Select at least one metric', 'warning'); return; }
    setLoading(true);
    try {
      const res = await runQuery({
        station_ids: form.station_ids,
        start_date: form.start_date,
        end_date: form.end_date,
        metrics: form.metrics,
        aggregate: form.aggregate,
        min_snowfall: form.min_snowfall || undefined,
        max_temp: form.max_temp || undefined,
        min_wind: form.min_wind || undefined,
        limit: parseInt(form.limit),
      });
      setResult(res);
      if (!activeMetricChart || !form.metrics.includes(activeMetricChart)) setActiveMetricChart(form.metrics[0]);
      toast(`Query returned ${res.count} rows`, 'success');
    } catch (e) {
      toast('Query failed: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!queryName.trim()) { toast('Enter a name for this query', 'warning'); return; }
    await saveQuery({ name: queryName, query_json: form });
    toast(`Query "${queryName}" saved`, 'success');
    setQueryName('');
  };

  const handleExport = (format) => {
    if (!result?.data?.length) return;
    const blob = format === 'json'
      ? new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      : new Blob([toCSV(result.data)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `cryoscope_export.${format}`; a.click();
    URL.revokeObjectURL(url);
    toast(`Exported as ${format.toUpperCase()}`, 'success');
  };

  const chartData = result?.data?.length ? buildChartData(result.data, activeMetricChart, form.aggregate) : null;
  const CHART_OPTS = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1a2d4a', borderColor: '#2d4a6e', borderWidth: 1, titleColor: '#e2eaf7', bodyColor: '#94a3b8', padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { color: 'rgba(30,51,82,0.6)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' }, maxTicksLimit: 12 } },
      y: { grid: { color: 'rgba(30,51,82,0.6)' }, ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } } },
    },
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* Left: Query Form */}
      <div style={{ width: 320, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px', flexShrink: 0 }}>
        <h3 style={{ marginBottom: 14 }}>🔍 Query Builder</h3>

        {/* Stations */}
        <div className="form-group">
          <label className="form-label">Stations</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STATIONS.map(s => (
              <label key={s.station_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: form.station_ids.includes(s.station_id) ? 'rgba(56,189,248,0.06)' : 'transparent', border: `1px solid ${form.station_ids.includes(s.station_id) ? 'rgba(56,189,248,0.3)' : 'transparent'}` }}>
                <input type="checkbox" checked={form.station_ids.includes(s.station_id)} onChange={() => toggleStation(s.station_id)} style={{ accentColor: 'var(--ice-dim)', width: 13, height: 13 }} />
                <span style={{ fontSize: 12, flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.state}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="form-group">
          <label className="form-label">Date Range</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="date" className="form-input" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={{ flex: 1 }} />
            <input type="date" className="form-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
            {[7, 30, 90, 365].map(d => (
              <span key={d} className="chip" style={{ fontSize: 10 }}
                onClick={() => { set('start_date', format(subDays(new Date(), d), 'yyyy-MM-dd')); set('end_date', format(new Date(), 'yyyy-MM-dd')); }}>
                {d}d
              </span>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="form-group">
          <label className="form-label">Metrics</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {METRICS.map(m => (
              <span key={m.value} className={`chip ${form.metrics.includes(m.value) ? 'active' : ''}`}
                style={{ fontSize: 11 }} onClick={() => toggleMetric(m.value)}>
                {m.icon} {m.label.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Aggregation */}
        <div className="form-group">
          <label className="form-label">Aggregation</label>
          <select className="form-select" value={form.aggregate} onChange={e => set('aggregate', e.target.value)}>
            <option value="raw">Raw (hourly)</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Thresholds */}
        <div className="form-group">
          <label className="form-label">Threshold Filters</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Min Snowfall (cm)</div>
              <input type="number" className="form-input" placeholder="e.g. 2" value={form.min_snowfall} onChange={e => set('min_snowfall', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Max Temp (°C)</div>
              <input type="number" className="form-input" placeholder="e.g. 0" value={form.max_temp} onChange={e => set('max_temp', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Min Wind (m/s)</div>
              <input type="number" className="form-input" placeholder="e.g. 5" value={form.min_wind} onChange={e => set('min_wind', e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Row Limit</div>
              <input type="number" className="form-input" value={form.limit} onChange={e => set('limit', e.target.value)} />
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={handleRun} disabled={loading}>
          {loading ? '⏳ Running…' : '▶ Run Query'}
        </button>

        {/* Save Query */}
        {result && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input className="form-input" placeholder="Query name…" value={queryName} onChange={e => setQueryName(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={handleSave}>Save</button>
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {result ? (
          <>
            {/* Results Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--ice)', fontWeight: 800 }}>{result.count.toLocaleString()}</span> rows · {result.aggregate} aggregation
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['line', 'bar'].map(t => (
                  <button key={t} className={`btn btn-sm ${chartType === t ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setChartType(t)}>{t === 'line' ? '📈' : '📊'} {t}</button>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>⬇ CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')}>⬇ JSON</button>
              </div>
            </div>

            {/* Metric Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {form.metrics.map(m => {
                const meta = METRICS.find(x => x.value === m);
                return (
                  <button key={m} onClick={() => setActiveMetricChart(m)}
                    className={`btn btn-sm ${activeMetricChart === m ? 'btn-primary' : 'btn-ghost'}`}>
                    {meta?.icon} {meta?.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            {/* Chart */}
            {chartData && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', height: 220, flexShrink: 0 }}>
                {chartType === 'line'
                  ? <Line data={chartData} options={CHART_OPTS} />
                  : <Bar data={chartData} options={CHART_OPTS} />
                }
              </div>
            )}

            {/* Data Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date / Period</th>
                    <th>Station</th>
                    {form.metrics.map(m => {
                      const meta = METRICS.find(x => x.value === m);
                      return <th key={m}>{meta?.icon} {meta?.label}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {result.data.slice(0, 200).map((row, i) => (
                    <tr key={i}>
                      <td className="mono">{row.date || row.period?.slice(0, 10) || row.observed_at?.slice(0, 16)}</td>
                      <td>{row.station_id || '—'}</td>
                      {form.metrics.map(m => (
                        <td key={m} className={m === 'snowfall_cm' ? 'snow' : m === 'temp_c' ? 'cold' : ''}>
                          {row[m] != null ? Number(row[m]).toFixed(1) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.data.length > 200 && (
                <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Showing 200 of {result.count} rows. Export for full dataset.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>Configure your query and click Run</div>
            <div style={{ fontSize: 13, maxWidth: 320, textAlign: 'center' }}>Filter by station, date range, metrics, and thresholds. Results auto-generate charts and a data table you can export.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildChartData(data, metric, aggregate) {
  const metricMeta = {
    temp_c: '#38bdf8', snowfall_cm: '#818cf8', snow_depth_cm: '#60a5fa',
    precip_mm: '#34d399', wind_speed_ms: '#fbbf24', humidity_pct: '#a78bfa', pressure_hpa: '#94a3b8',
  };
  const color = metricMeta[metric] || '#38bdf8';
  const labels = data.map(d => (d.date || d.period?.slice(0, 10) || d.observed_at?.slice(0, 10) || '').slice(5));
  return {
    labels,
    datasets: [{
      label: metric,
      data: data.map(d => d[metric]),
      borderColor: color,
      backgroundColor: color + '22',
      fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
      borderRadius: 3,
    }],
  };
}

function toCSV(data) {
  if (!data.length) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(r => Object.values(r).map(v => JSON.stringify(v ?? '')).join(','));
  return [headers, ...rows].join('\n');
}
