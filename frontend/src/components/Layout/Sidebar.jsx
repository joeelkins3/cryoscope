import React, { useEffect, useState } from 'react';
import { useApp } from '../../App';
import { fetchStations } from '../../services/api';
import { generateObservations } from '../../data/mockData';

const NAV = [
  { id: 'map',       icon: '🗺️',  label: 'Live Map',      badge: null },
  { id: 'dashboard', icon: '📊',  label: 'Dashboard',     badge: null },
  { id: 'storms',    icon: '🌨️', label: 'Storm Archive',  badge: '6' },
  { id: 'query',     icon: '🔍',  label: 'Query Builder', badge: null },
  { id: 'insights',  icon: '📈',  label: 'Insights',      badge: null },
];

export default function Sidebar() {
  const { view, setView, selectedStation, setSelectedStation } = useApp();
  const [stations, setStations]   = useState([]);
  const [liveData, setLiveData]   = useState({});

  useEffect(() => {
    fetchStations().then(s => setStations(s));
  }, []);

  // Simulate live temps on stations
  useEffect(() => {
    if (!stations.length) return;
    const update = () => {
      const map = {};
      stations.forEach(s => {
        const obs = generateObservations(s.station_id, 0.04);
        const latest = obs[obs.length - 1];
        map[s.station_id] = latest;
      });
      setLiveData(map);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [stations]);

  return (
    <nav className="sidebar">
      {/* Navigation */}
      <div className="nav-section">
        <div className="nav-label">Navigation</div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item ${view === n.id ? 'active' : ''}`}
            onClick={() => setView(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </div>
        ))}
      </div>

      <div className="divider" style={{ margin: '8px 10px' }} />

      {/* Stations */}
      <div style={{ padding: '0 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="nav-label" style={{ margin: 0 }}>Stations</div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stations.length} active</span>
      </div>

      <div className="sidebar-stations">
        {stations.map(s => {
          const live = liveData[s.station_id];
          const temp = live?.temp_c;
          const snow = live?.snowfall_cm;
          const isActive = selectedStation?.station_id === s.station_id;
          return (
            <div
              key={s.station_id}
              className={`station-item ${isActive ? 'active' : ''}`}
              onClick={() => { setSelectedStation(s); }}
            >
              <div className="station-name">{s.name}</div>
              <div className="station-meta">
                <span>{s.state}</span>
                {temp != null && (
                  <span className="station-temp">{temp > 0 ? '+' : ''}{temp}°C</span>
                )}
                {snow > 0 && (
                  <span className="station-snow">❄ {snow}cm</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>Data Sources</div>
          <div>NOAA GHCN · OpenWeather API</div>
          <div>Updated every 15 min</div>
        </div>
      </div>
    </nav>
  );
}
