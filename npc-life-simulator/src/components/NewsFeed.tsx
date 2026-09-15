import { useMemo } from 'react';
import { useEngine, useSimPulse } from '../state/EngineContext';
import { useUI } from '../state/store';
import { formatClock, formatDate } from '../time/calendar';
import { EVENT_CATEGORY } from '../events/types';

const CATEGORY_COLOR: Record<string, string> = {
  life: 'var(--good)',
  work: 'var(--accent)',
  love: 'var(--love)',
  social: 'var(--violet)',
  money: 'var(--warn)',
  city: 'var(--text-faint)',
};

const CATEGORY_LABEL: Record<string, string> = {
  life: 'Leben',
  work: 'Arbeit',
  love: 'Liebe',
  social: 'Soziales',
  money: 'Geld',
  city: 'Stadt',
};

export function NewsFeed() {
  const engine = useEngine();
  useSimPulse(3);
  const select = useUI((s) => s.select);
  const open = useUI((s) => s.bottomOpen);
  const toggle = useUI((s) => s.toggle);

  const events = useMemo(
    () => engine.events.recent(60, 22),
    [engine, engine.events.version],
  );

  return (
    <div className="newsbar" style={{ maxHeight: open ? 210 : 30 }}>
      <div className="newsbar-head">
        <span>Nachrichten aus {engine.world.name}</span>
        <span style={{ color: 'var(--text-faint)', fontWeight: 500, textTransform: 'none' }}>
          {formatDate(engine.day)}
        </span>
        <div className="spacer" style={{ flex: 1 }} />
        <button type="button" className="icon-btn" onClick={() => toggle('bottomOpen')}>
          {open ? '▾' : '▴'}
        </button>
      </div>
      {open && (
        <div className="news-list">
          {events.length === 0 && (
            <div className="empty">Noch ist es ruhig in der Stadt.</div>
          )}
          {events.map((e) => {
            const cat = EVENT_CATEGORY[e.type];
            return (
              <button
                type="button"
                className="news-item"
                key={e.id}
                onClick={() => {
                  if (e.subjects.length) select(e.subjects[0]);
                }}
                title={`${CATEGORY_LABEL[cat]} · ${formatDate(e.day)}`}
              >
                <span className="ts">
                  {formatDate(e.day, true).replace(/\s\d{4}$/, '')} {formatClock(e.minute)}
                </span>
                <span className="cat" style={{ background: CATEGORY_COLOR[cat] }} />
                <span>{e.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
