import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { fetchStorms, fetchStorm } from '../../services/api';
import { useApp } from '../../App';
import { format, parseISO, differenceInHours } from 'date-fns';

const CATEGORY_META = {
  blizzard:    { color: '#818cf8', icon: '🌨', label: 'Blizzard' },
  "nor'easter": { color: '#38bdf8', icon: '🌀', label: "Nor'easter" },
  snowstorm:   { color: '#60a5fa', icon: '❄️', label: 'Snowstorm' },
  ice_storm:   { color: '#a78bfa', icon: '🧊', label: 'Ice Storm' },
};

export default function StormArchive() {
  const { toast } = useApp();
  const [storms, setStorms]           = useState([]);
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterCat, setFilterCat]     = useState('all');
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [replayStep, setReplayStep]   = useState(0);
  const [replaying, setReplaying]     = useState(false);
  const mapRef   = useRef(null);
  const mapObj   = useRef(null);
  const markersRef = useRef(L.layerGroup());
  const replayRef  = useRef(null);

  useEffect(() => {
    fetchStorms().then(setStorms);
  }, []);

  // Init replay map
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, {
      center: [42, -90], zoom: 4, zoomControl: false, attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', zIndex: 10 }).addTo(map);
    markersRef.current.addTo(map);
    mapObj.current = map;
  }, []);

  // Load storm detail
  const selectStorm = async (storm) => {
    setSelected(storm);
    setLoadingDetail(true);
    setReplayStep(0);
    setReplaying(false);
    const d = await fetchStorm(storm.slug);
    setDetail(d);
    setLoadingDetail(false);
    if (mapObj.current) {
      mapObj.current.flyTo([43, -88], 5, { animate: true, duration: 1 });
    }
  };

  // Replay animation
  useEffect(() => {
    if (!replaying || !detail?.observations?.length) return;
    const maxStep = Math.floor(detail.observations.length / 10);
    replayRef.current = setInterval(() => {
      setReplayStep(s => {
        if (s >= maxStep) { setReplaying(false); return maxStep; }
        return s + 1;
      });
    }, 400);
    return () => clearInterval(replayRef.current);
  }, [replaying, detail]);

  // Draw replay frame
  useEffect(() => {
    if (!mapObj.current || !detail?.observations) return;
    markersRef.current.clearLayers();
    const slice = detail.observations.slice(0, (replayStep + 1) * 10);
    const byStation = {};
    slice.forEach(o => {
      if (!byStation[o.station_id] || o.snowfall_cm > byStation[o.station_id].snowfall_cm) {
        byStation[o.station_id] = o;
      }
    });
    Object.values(byStation).forEach(o => {
      if (!o.lat || !o.lon) return;
      const r = Math.max(6, Math.min(24, 6 + (o.snowfall_cm || 0) * 0.8));
      const alpha = Math.min(0.9, 0.4 + (o.snowfall_cm || 0) / 20);
      L.circleMarker([o.lat, o.lon], {
        radius: r, fillColor: '#818cf8', fillOpacity: alpha,
        color: '#e0e7ff', weight: 1.5, opacity: 0.9,
      })
        .bindTooltip(`${o.station_name || o.station_id}: ${o.snowfall_cm || 0}cm`)
        .addTo(markersRef.current);
    });
  }, [replayStep, detail]);

  const toggleCompare = (storm) => {
    setCompareList(prev => {
      if (prev.find(s => s.id === storm.id)) return prev.filter(s => s.id !== storm.id);
      if (prev.length >= 4) { toast('Max 4 storms in comparison', 'warning'); return prev; }
      return [...prev, storm];
    });
  };

  const filtered = filterCat === 'all' ? storms : storms.filter(s => s.category === filterCat);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* Left: Storm List */}
      <div style={{ width: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ marginBottom: 10 }}>🌨 Storm Archive</h3>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['all', 'blizzard', "nor'easter", 'snowstorm', 'ice_storm'].map(c => (
              <span key={c} className={`chip ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}
                style={{ fontSize: 11, padding: '3px 9px' }}>
                {CATEGORY_META[c]?.icon || '❄'} {CATEGORY_META[c]?.label || 'All'}
              </span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filtered.map(storm => {
            const meta = CATEGORY_META[storm.category] || CATEGORY_META.blizzard;
            const isActive = selected?.id === storm.id;
            const inCompare = compareList.find(s => s.id === storm.id);
            return (
              <div
                key={storm.id}
                onClick={() => selectStorm(storm)}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
                  background: isActive ? 'rgba(129,140,248,0.1)' : 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'rgba(129,140,248,0.4)' : 'var(--border)'}`,
                  transition: '0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{meta.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{storm.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {format(parseISO(storm.started_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toggleCompare(storm); }}
                    style={{
                      padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-bright)',
                      background: inCompare ? 'rgba(56,189,248,0.1)' : 'transparent',
                      color: inCompare ? 'var(--ice)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 11, fontFamily: 'Inter',
                    }}
                  >
                    {inCompare ? '✓' : '+'} Compare
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--frost)' }}>❄ {storm.max_snowfall_cm}cm max</span>
                  <span style={{ fontSize: 11, color: 'var(--aurora)' }}>🌡 {storm.min_temp_c}°C low</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💨 {storm.max_wind_ms}m/s</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {Math.round(storm.duration_hours)}h</span>
                </div>

                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  {(storm.tags || []).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(45,74,110,0.5)', color: 'var(--text-muted)' }}>{t}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {compareList.length >= 2 && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowCompare(true)}>
              ⚖ Compare {compareList.length} Storms
            </button>
          </div>
        )}
      </div>

      {/* Right: Detail + Replay Map */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Storm Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2>{selected.name}</h2>
                    <span className="badge badge-aurora">{CATEGORY_META[selected.category]?.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {format(parseISO(selected.started_at), 'MMM d')} – {selected.ended_at ? format(parseISO(selected.ended_at), 'MMM d, yyyy') : 'Ongoing'}
                    &nbsp;·&nbsp;{Math.round(selected.duration_hours || 0)} hours&nbsp;·&nbsp;
                    {selected.affected_stations} stations affected
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {detail?.observations?.length > 0 && (
                    <button
                      className={`btn ${replaying ? 'btn-danger' : 'btn-primary'} btn-sm`}
                      onClick={() => {
                        if (replaying) { setReplaying(false); } else { setReplayStep(0); setReplaying(true); }
                      }}
                    >
                      {replaying ? '⏹ Stop' : '▶ Replay Storm'}
                    </button>
                  )}
                  {!replaying && detail && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setReplayStep(0); }}>⏮ Reset</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'Max Snowfall', value: `${selected.max_snowfall_cm}cm`, color: 'var(--frost)' },
                  { label: 'Min Temp',    value: `${selected.min_temp_c}°C`,      color: 'var(--aurora)' },
                  { label: 'Max Wind',    value: `${selected.max_wind_ms}m/s`,    color: 'var(--ice)' },
                  { label: 'Duration',    value: `${Math.round(selected.duration_hours)}h`, color: 'var(--text-secondary)' },
                  { label: 'Stations',    value: selected.affected_stations,      color: 'var(--ice-dim)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {selected.description}
              </div>
            </div>

            {/* Replay Map */}
            <div style={{ flex: 1, position: 'relative' }}>
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              {loadingDetail && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,13,26,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }} />
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading storm data…</div>
                  </div>
                </div>
              )}
              {replaying && detail?.observations && (
                <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(13,24,41,0.9)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--ice)', backdropFilter: 'blur(8px)', zIndex: 500 }}>
                  ▶ Replaying — {Math.round((replayStep / (detail.observations.length / 10)) * 100)}% complete
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 14, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64 }}>🌨️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>Select a storm to explore</div>
            <div style={{ fontSize: 13, maxWidth: 300, textAlign: 'center' }}>Click any storm in the archive to view details, replay its progression on the map, and compare with other events.</div>
          </div>
        )}
      </div>

      {/* Compare Modal */}
      {showCompare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowCompare(false)}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-bright)', borderRadius: 16, padding: '24px', minWidth: 560, maxWidth: 800, maxHeight: '80vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3>⚖ Storm Comparison</h3>
              <button className="panel-close" onClick={() => setShowCompare(false)}>✕</button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Storm</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Max Snow</th>
                  <th>Min Temp</th>
                  <th>Max Wind</th>
                  <th>Duration</th>
                  <th>Stations</th>
                </tr>
              </thead>
              <tbody>
                {compareList.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                    <td><span className="badge badge-aurora">{CATEGORY_META[s.category]?.label}</span></td>
                    <td className="mono">{format(parseISO(s.started_at), 'MMM yyyy')}</td>
                    <td className="snow">{s.max_snowfall_cm}cm</td>
                    <td className="cold">{s.min_temp_c}°C</td>
                    <td>{s.max_wind_ms}m/s</td>
                    <td>{Math.round(s.duration_hours)}h</td>
                    <td className="accent">{s.affected_stations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
