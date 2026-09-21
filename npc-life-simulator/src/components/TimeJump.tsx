import { useState } from 'react';
import { useEngine } from '../state/EngineContext';
import { useUI } from '../state/store';
import { MINUTES_PER_DAY, DAYS_PER_YEAR, formatDate } from '../time/calendar';

const JUMPS: { label: string; minutes: number; hint: string }[] = [
  { label: '+1 Stunde', minutes: 60, hint: 'ein Nachmittag weiter' },
  { label: '+1 Tag', minutes: MINUTES_PER_DAY, hint: 'ein voller Tagesablauf' },
  { label: '+1 Woche', minutes: MINUTES_PER_DAY * 7, hint: 'Jobs, Dates, Streit' },
  { label: '+1 Monat', minutes: MINUTES_PER_DAY * 30, hint: 'Gehälter, Umzüge, Firmen' },
  { label: '+1 Jahr', minutes: MINUTES_PER_DAY * DAYS_PER_YEAR, hint: 'Geburten, Karrieren, Tode' },
];

/**
 * Real simulated time jumps. The world is not fast-forwarded on paper: every
 * day in between is actually simulated, just with the aggregated turbo path
 * for everyone the player is not watching.
 */
export function TimeJump() {
  const engine = useEngine();
  const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [label, setLabel] = useState('');

  const jump = async (minutes: number, name: string) => {
    if (progress !== null) return;
    setOpen(false);
    setLabel(name);
    setProgress(0);
    const before = {
      day: engine.day,
      population: engine.stats.population,
      events: engine.events.count,
      companies: engine.stats.companiesActive,
    };
    await engine.fastForward(minutes, (p) => setProgress(p));
    engine.stats.recompute(engine);
    const after = engine.stats;
    setProgress(null);
    const born = engine.events.countSince(before.day, 'birth');
    const died = engine.events.countSince(before.day, 'death');
    toast(
      `${name}: ${engine.events.count - before.events} Ereignisse · ` +
        `${born} Geburten · ${died} Todesfälle · ` +
        `Bevölkerung ${before.population} → ${after.population}`,
      'success',
    );
  };

  return (
    <div className="jump-wrap">
      <button
        type="button"
        className={`icon-btn${open ? ' active' : ''}`}
        title="Zeit überspringen"
        onClick={() => setOpen((v) => !v)}
      >
        ⏩
      </button>

      {open && (
        <div className="jump-menu">
          <div className="jump-head">Zeit wirklich weitersimulieren</div>
          {JUMPS.map((j) => (
            <button key={j.label} type="button" className="jump-row" onClick={() => jump(j.minutes, j.label)}>
              <span className="jump-label">{j.label}</span>
              <span className="jump-hint">{j.hint}</span>
            </button>
          ))}
        </div>
      )}

      {progress !== null && (
        <div className="jump-overlay">
          <div className="jump-card">
            <div className="jump-title">{label}</div>
            <div className="jump-date">{formatDate(engine.day)}</div>
            <div className="jump-bar">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="jump-sub">
              Die Stadt lebt weiter – jeder Tag wird tatsächlich simuliert.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
