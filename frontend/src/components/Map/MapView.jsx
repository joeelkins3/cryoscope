import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../App';
import { fetchStations, fetchCurrentWeather, fetchDailySummary, fetchHeatmap } from '../../services/api';
import { STATIONS, generateObservations } from '../../data/mockData';
import WeatherPopup from './WeatherPopup';
import TimelineSlider from './TimelineSlider';

const METRIC_OPTIONS = [
  { value: 'snowfall_cm',   label: '❄ Snowfall',    unit: 'cm',   colorScale: ['#0f2942','#1a4a7a','#2563eb','#60a5fa','#e0f2fe'] },
  { value: 'temp_c',        label: '🌡 Temperature', unit: '°C',   colorScale: ['#1e40af','#3b82f6','#6ee7b7','#fde68a','#f87171'] },
  { value: 'snow_depth_cm', label: '🏔 Snow Depth',  unit: 'cm',   colorScale: ['#0f2942','#1e4d7a','#1d4ed8','#93c5fd','#f0f9ff'] },
  { value: 'wind_speed_ms', label: '💨 Wind Speed',  unit: 'm/s',  colorScale: ['#1c1917','#78350f','#d97706','#fbbf24','#fef3c7'] },
];

function getMarkerColor(value, metric) {
  if (value == null) return '#334155';
  if (metric === 'temp_c') {
    if (value < -15) return '#818cf8';
    if (value < -5)  return '#60a5fa';
    if (value < 0)   return '#93c5fd';
    if (value < 5)   return '#6ee7b7';
    if (value < 15)  return '#fde68a';
    return '#f87171';
  }
  if (metric === 'snowfall_cm' || metric === 'snow_depth_cm') {
    if (value === 0) return '#1e3352';
    if (value < 2)   return '#2563eb';
    if (value < 5)   return '#60a5fa';
    if (value < 10)  return '#bae6fd';
    return '#f0f9ff';
  }
  if (metric === 'wind_speed_ms') {
    if (value < 3)  return '#1e3352';
    if (value < 8)  return '#d97706';
    if (value < 15) return '#fbbf24';
    return '#fef3c7';
  }
  return '#60a5fa';
}

function createStationMarker(station, obs, metric, onClick) {
  const value = obs?.[metric];
  const color = getMarkerColor(value, metric);
  const radius = value > 0 ? Math.max(8, Math.min(22, 8 + (value || 0) * 0.8)) : 8;

  const marker = L.circleMarker([station.lat, station.lon], {
    radius,
    fillColor: color,
    fillOpacity: 0.85,
    color: '#fff',
    weight: 1.5,
    opacity: 0.9,
  });

  const metricObj = METRIC_OPTIONS.find(m => m.value === metric);
  const displayVal = value != null ? `${value}${metricObj?.unit || ''}` : 'N/A';

  marker.bindTooltip(
    `<div style="font-family:Inter,sans-serif;font-size:12px;color:#e2eaf7;min-width:140px">
      <div style="font-weight:700;margin-bottom:4px">${station.name}</div>
      <div style="color:#94a3b8">${station.state} · ${Math.round(station.elevation_m || 0)}m</div>
      <div style="margin-top:6px;font-size:14px;font-weight:700;color:${color}">${displayVal}</div>
      <div style="color:#7dd3fc;font-size:11px;margin-top:2px">${obs?.temp_c != null ? obs.temp_c + '°C' : ''} ${obs?.condition_text || ''}</div>
    </div>`,
    { className: 'cryo-tooltip', sticky: false, direction: 'top', offset: [0, -8] }
  );

  marker.on('click', () => onClick(station, obs));
  return marker;
}

export default function MapView() {
  const { selectedStation, setSelectedStation, mapMetric, setMapMetric, toast } = useApp();
  const mapRef        = useRef(null);
  const mapObj        = useRef(null);
  const markersRef    = useRef(L.layerGroup());
  const heatRef       = useRef(null);

  const [stations, setStations]         = useState([]);
  const [liveObs, setLiveObs]           = useState({});
  const [popupStation, setPopupStation] = useState(null);
  const [popupObs, setPopupObs]         = useState(null);
  const [showHeatmap, setShowHeatmap]   = useState(true);
  const [timelineDate, setTimelineDate] = useState(null);
  const [isLoading, setIsLoading]       = useState(false);

  // Init map
  useEffect(() => {
    if (mapObj.current) return;

    const map = L.map(mapRef.current, {
      center: [42, -96],
      zoom: 4,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
    });

    // Dark cartographic tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Labels layer on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
      zIndex: 10,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersRef.current.addTo(map);

    // Click on map (not on marker) to get nearby data
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const nearest = [...STATIONS].sort((a, b) =>
        dist(lat, lng, a.lat, a.lon) - dist(lat, lng, b.lat, b.lon)
      )[0];
      handleStationClick(nearest, liveObs[nearest.station_id]);
    });

    mapObj.current = map;
  }, []);

  // Load stations + live obs
  useEffect(() => {
    setIsLoading(true);
    fetchStations().then(async (stns) => {
      setStations(stns);
      const obs = {};
      for (const s of stns) {
        const data = generateObservations(s.station_id, 0.04);
        obs[s.station_id] = data[data.length - 1];
      }
      setLiveObs(obs);
      setIsLoading(false);
    });
  }, []);

  // Redraw markers when metric or obs changes
  useEffect(() => {
    if (!mapObj.current || !stations.length) return;
    markersRef.current.clearLayers();

    // Heatmap points
    if (showHeatmap && window.L?.heatLayer) {
      if (heatRef.current) heatRef.current.remove();
      const points = stations
        .map(s => {
          const obs = liveObs[s.station_id];
          const val = obs?.[mapMetric];
          if (!val || val <= 0) return null;
          return [s.lat, s.lon, Math.min(val / 20, 1)];
        })
        .filter(Boolean);
      if (points.length) {
        heatRef.current = L.heatLayer(points, {
          radius: 55, blur: 35, maxZoom: 8,
          gradient: { 0.2: '#1e3a5f', 0.5: '#2563eb', 0.8: '#60a5fa', 1.0: '#e0f2fe' },
        }).addTo(mapObj.current);
      }
    } else if (heatRef.current) {
      heatRef.current.remove();
      heatRef.current = null;
    }

    // Station markers
    stations.forEach(s => {
      const obs = liveObs[s.station_id];
      const marker = createStationMarker(s, obs, mapMetric, handleStationClick);
      markersRef.current.addLayer(marker);
    });
  }, [stations, liveObs, mapMetric, showHeatmap]);

  const handleStationClick = useCallback((station, obs) => {
    setPopupStation(station);
    setPopupObs(obs);
    setSelectedStation(station);
    if (mapObj.current) {
      mapObj.current.flyTo([station.lat, station.lon], Math.max(mapObj.current.getZoom(), 5), {
        animate: true, duration: 0.8,
      });
    }
  }, [setSelectedStation]);

  const metricDef = METRIC_OPTIONS.find(m => m.value === mapMetric);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#060d1a' }}>
      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading */}
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,13,26,0.7)', zIndex: 500 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading weather data…</div>
          </div>
        </div>
      )}

      {/* Map Toolbar */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 500, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Metric selector */}
        <div style={{ background: 'rgba(13,24,41,0.92)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '6px 4px', backdropFilter: 'blur(12px)', display: 'flex', gap: 4 }}>
          {METRIC_OPTIONS.map(m => (
            <button
              key={m.value}
              onClick={() => setMapMetric(m.value)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter,sans-serif', fontWeight: 500, transition: '0.15s',
                background: mapMetric === m.value ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: mapMetric === m.value ? 'var(--ice)' : 'var(--text-muted)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Heatmap toggle */}
        <button
          onClick={() => setShowHeatmap(v => !v)}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-bright)', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter,sans-serif', fontWeight: 500,
            background: showHeatmap ? 'rgba(56,189,248,0.1)' : 'rgba(13,24,41,0.92)',
            color: showHeatmap ? 'var(--ice)' : 'var(--text-secondary)',
            backdropFilter: 'blur(12px)', transition: '0.15s',
          }}
        >
          🌡 Heatmap
        </button>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 100, left: 14, zIndex: 500, background: 'rgba(13,24,41,0.92)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(12px)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
          {metricDef?.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {metricDef?.colorScale.map((c, i) => (
            <div key={i} style={{ width: 22, height: 10, background: c, borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
          <span>Low</span><span>High</span>
        </div>
      </div>

      {/* Station count */}
      <div style={{ position: 'absolute', bottom: 100, right: 50, zIndex: 500, background: 'rgba(13,24,41,0.92)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text-secondary)', backdropFilter: 'blur(12px)' }}>
        <span style={{ color: 'var(--ice)', fontWeight: 700 }}>{stations.length}</span> stations active
      </div>

      {/* Timeline Slider */}
      <TimelineSlider onDateChange={setTimelineDate} />

      {/* Weather Popup */}
      {popupStation && (
        <WeatherPopup
          station={popupStation}
          obs={popupObs}
          onClose={() => setPopupStation(null)}
        />
      )}
    </div>
  );
}

function dist(lat1, lon1, lat2, lon2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}
