import React, { useState, useEffect, useRef } from 'react';
import { format, subDays } from 'date-fns';

export default function TimelineSlider({ onDateChange }) {
  const [days, setDays]         = useState(0);
  const [playing, setPlaying]   = useState(false);
  const intervalRef             = useRef(null);
  const MAX_DAYS = 30;

  const currentDate = subDays(new Date(), days);
  const label = days === 0 ? 'Live' : format(currentDate, 'MMM d, yyyy');

  useEffect(() => {
    onDateChange?.(days === 0 ? null : format(currentDate, 'yyyy-MM-dd'));
  }, [days]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setDays(d => {
          if (d >= MAX_DAYS) { setPlaying(false); return 0; }
          return d + 1;
        });
      }, 600);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const pct = (days / MAX_DAYS) * 100;

  return (
    <div style={{
      position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 500, background: 'rgba(13,24,41,0.94)',
      border: '1px solid var(--border-bright)', borderRadius: 12, padding: '10px 18px',
      backdropFilter: 'blur(16px)', minWidth: 380,
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button
          onClick={() => setPlaying(p => !p)}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: playing ? 'var(--ice-dim)' : 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)', cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
            transition: '0.15s',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="range" min={0} max={MAX_DAYS} value={days}
            onChange={e => { setPlaying(false); setDays(parseInt(e.target.value)); }}
            style={{
              width: '100%', height: 4, appearance: 'none',
              background: `linear-gradient(to right, var(--ice-dim) ${pct}%, var(--border-bright) ${pct}%)`,
              outline: 'none', cursor: 'pointer', borderRadius: 2,
            }}
          />
        </div>

        <div style={{ textAlign: 'right', minWidth: 90 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: days === 0 ? 'var(--success)' : 'var(--ice)' }}>
            {days === 0 && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', marginRight: 4, animation: 'blink 2s infinite' }} />}
            {label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {days === 0 ? 'Real-time' : `${days} day${days !== 1 ? 's' : ''} ago`}
          </div>
        </div>
      </div>

      {/* Tick marks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 40, paddingRight: 94 }}>
        {['30d', '25d', '20d', '15d', '10d', '5d', 'Now'].map((t, i) => (
          <div key={t} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>{t}</div>
        ))}
      </div>
    </div>
  );
}
