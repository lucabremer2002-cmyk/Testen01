import { useEffect, useState } from 'react';
import { useEngine } from '../state/EngineContext';
import { useUI } from '../state/store';
import { formatClock } from '../time/calendar';
import { EVENT_CATEGORY, type GameEvent } from '../events/types';

interface Popup {
  key: number;
  text: string;
  time: string;
  category: string;
  subject: number;
}

const CATEGORY_COLOR: Record<string, string> = {
  life: 'var(--good)',
  work: 'var(--accent)',
  love: 'var(--love)',
  social: 'var(--violet)',
  money: 'var(--warn)',
  city: 'var(--text-faint)',
};

/**
 * Surfaces events about watched people. Everything else stays in the feed -
 * a pop-up for every happening in a city of a thousand would be unreadable.
 */
export function EventPopups() {
  const engine = useEngine();
  const select = useUI((s) => s.select);
  const [items, setItems] = useState<Popup[]>([]);

  useEffect(() => {
    let counter = 0;
    const watched = () => {
      const ui = useUI.getState();
      const ids = new Set(ui.trackedIds);
      if (ui.selectedId >= 0) ids.add(ui.selectedId);
      return ids;
    };
    const onEvent = (e: GameEvent) => {
      if (e.importance < 30 || !e.subjects.length) return;
      const ids = watched();
      if (!ids.size) return;
      const subject = e.subjects.find((id) => ids.has(id));
      if (subject === undefined) return;
      const item: Popup = {
        key: ++counter,
        text: e.text,
        time: formatClock(e.minute),
        category: EVENT_CATEGORY[e.type],
        subject,
      };
      setItems((prev) => [...prev, item].slice(-3));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.key !== item.key));
      }, 6000);
    };
    return engine.onEvent(onEvent);
  }, [engine]);

  if (!items.length) return null;
  return (
    <div className="popups">
      {items.map((item) => (
        <button type="button" className="popup" key={item.key} onClick={() => select(item.subject)}>
          <span className="popup-bar" style={{ background: CATEGORY_COLOR[item.category] }} />
          <span>
            <span className="popup-time">{item.time}</span>
            <span className="popup-text">{item.text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
