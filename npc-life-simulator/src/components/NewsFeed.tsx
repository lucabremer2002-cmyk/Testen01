import { useMemo, useRef } from 'react';
import { useEngine, useSimPulse } from '../state/EngineContext';
import { useUI } from '../state/store';
import { formatClock, formatDate } from '../time/calendar';
import { EVENT_CATEGORY, type GameEvent } from '../events/types';

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

/** Plural wording for the collapsed rows the feed builds at high speed. */
const GROUP_LABEL: Record<string, (n: number) => string> = {
  acquaintance: (n) => `${n} neue Bekanntschaften geschlossen`,
  outing: (n) => `${n} Verabredungen in der Stadt`,
  application: (n) => `${n} Bewerbungen verschickt`,
  birthday: (n) => `${n} Einwohner haben Geburtstag`,
  hired: (n) => `${n} Personen haben eine neue Stelle`,
  purchase: (n) => `${n} größere Anschaffungen`,
  friendship: (n) => `${n} neue Freundschaften`,
  move: (n) => `${n} Umzüge`,
  fight: (n) => `${n} Streitigkeiten`,
};

type Row =
  | { kind: 'single'; key: string; event: GameEvent }
  | { kind: 'group'; key: string; type: string; count: number; event: GameEvent };

/** Events of the same kind within this many simulated minutes collapse. */
const GROUP_WINDOW = 120;
const GROUP_THRESHOLD = 2;

function buildRows(events: GameEvent[], minImportance: number): Row[] {
  const rows: Row[] = [];
  let index = 0;
  while (index < events.length) {
    const e = events[index];
    if (e.importance < minImportance) {
      index++;
      continue;
    }
    // Important things are never folded away.
    if (e.importance >= 45 || !GROUP_LABEL[e.type]) {
      rows.push({ kind: 'single', key: `e${e.id}`, event: e });
      index++;
      continue;
    }
    let count = 0;
    let scan = index;
    while (
      scan < events.length &&
      events[scan].type === e.type &&
      e.minute - events[scan].minute < GROUP_WINDOW
    ) {
      if (events[scan].importance >= minImportance) count++;
      scan++;
    }
    if (count >= GROUP_THRESHOLD) {
      rows.push({ kind: 'group', key: `g${e.id}`, type: e.type, count, event: e });
      index = scan;
    } else {
      rows.push({ kind: 'single', key: `e${e.id}`, event: e });
      index++;
    }
  }
  return rows;
}

export function NewsFeed() {
  const engine = useEngine();
  useSimPulse(4);
  const select = useUI((s) => s.select);
  const open = useUI((s) => s.bottomOpen);
  const toggle = useUI((s) => s.toggle);
  const onlyImportant = useUI((s) => s.newsImportantOnly);
  const seen = useRef(new Set<string>());

  const rows = useMemo(() => {
    const raw = engine.events.recent(140, onlyImportant ? 45 : 10);
    return buildRows(raw, onlyImportant ? 45 : 10).slice(0, 60);
  }, [engine, engine.events.version, onlyImportant]);

  return (
    <div className="newsbar" style={{ maxHeight: open ? 232 : 30 }}>
      <div className="newsbar-head">
        <span>Nachrichten aus {engine.world.name}</span>
        <span className="news-date">{formatDate(engine.day)}</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className={`chip${onlyImportant ? ' active' : ''}`}
          onClick={() => toggle('newsImportantOnly')}
          title="Nur wichtige Ereignisse zeigen"
        >
          nur Wichtiges
        </button>
        <button type="button" className="icon-btn" onClick={() => toggle('bottomOpen')}>
          {open ? '▾' : '▴'}
        </button>
      </div>

      {open && (
        <div className="news-list">
          {rows.length === 0 && <div className="empty">Noch ist es ruhig in der Stadt.</div>}
          {rows.map((row) => {
            const e = row.event;
            const cat = EVENT_CATEGORY[e.type];
            const isNew = !seen.current.has(row.key);
            if (isNew) seen.current.add(row.key);
            if (seen.current.size > 900) seen.current = new Set([row.key]);
            const big = e.importance >= 60;

            return (
              <button
                type="button"
                className={`news-item${isNew ? ' is-new' : ''}${big ? ' is-big' : ''}`}
                key={row.key}
                onClick={() => {
                  if (row.kind === 'single' && e.subjects.length) select(e.subjects[0]);
                }}
                title={`${CATEGORY_LABEL[cat]} · ${formatDate(e.day)}`}
              >
                <span className="ts">{formatClock(e.minute)}</span>
                <span className="cat" style={{ background: CATEGORY_COLOR[cat] }} />
                <span className="news-text">
                  {row.kind === 'group' ? GROUP_LABEL[row.type](row.count) : e.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
