import React, { useState, useCallback, createContext, useContext } from 'react';
import Sidebar from './components/Layout/Sidebar';
import MapView from './components/Map/MapView';
import Dashboard from './components/Dashboard/Dashboard';
import StormArchive from './components/StormArchive/StormArchive';
import QueryBuilder from './components/QueryBuilder/QueryBuilder';
import Insights from './components/Insights/Insights';
import { DEMO_MODE } from './services/api';
import { STATIONS } from './data/mockData';

// ── App Context ───────────────────────────────────────────────
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [view, setView] = useState('map');
  const [selectedStation, setSelectedStation] = useState(STATIONS[0]);
  const [selectedLocation, setSelectedLocation] = useState({ lat: STATIONS[0].lat, lon: STATIONS[0].lon });
  const [toasts, setToasts] = useState([]);
  const [mapMetric, setMapMetric] = useState('snowfall_cm');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const ctx = {
    view, setView,
    selectedStation, setSelectedStation,
    selectedLocation, setSelectedLocation,
    mapMetric, setMapMetric,
    dateRange, setDateRange,
    toast,
  };

  const VIEWS = {
    map:      <MapView />,
    dashboard: <Dashboard />,
    storms:   <StormArchive />,
    query:    <QueryBuilder />,
    insights: <Insights />,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app-shell">

        {/* Header */}
        <header className="app-header">
          <div className="brand">
            <div className="brand-icon">❄</div>
            <div>
              <div className="brand-name">CryoScope</div>
              <div className="brand-tag">Snow & Weather Intelligence</div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {DEMO_MODE && (
            <div style={{ fontSize: 11, color: 'var(--warning)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, padding: '4px 10px' }}>
              ⚡ Demo Mode — add API keys for live data
            </div>
          )}

          <div className="status-pill">
            <div className="status-dot" />
            Live
          </div>
        </header>

        <div className="app-body">
          <Sidebar />
          <main className="main-content">
            {VIEWS[view] || <MapView />}
          </main>
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ fontSize: 16 }}>
              {t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : t.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span style={{ fontSize: 13 }}>{t.msg}</span>
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
