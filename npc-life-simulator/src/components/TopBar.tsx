import { useMemo, useState } from 'react';
import { SPEEDS, type Speed } from '../time/SimulationClock';
import { formatClock, WEEKDAY_SHORT, formatDate } from '../time/calendar';
import { realSecondsPerSimDay } from '../time/SimulationClock';
import { useEngine, useSimPulse } from '../state/EngineContext';
import { useUI } from '../state/store';
import { fullName, jobTitle, tintOf } from '../npc/describe';
import { formatMoneyShort } from '../core/math';
import { Avatar } from './ui';
import { TimeJump } from './TimeJump';

const WEATHER_ICON: Record<string, string> = {
  klar: '☀️',
  bewölkt: '☁️',
  regen: '🌧️',
  sturm: '🌪️',
  schnee: '❄️',
  hitze: '🔥',
  nebel: '🌫️',
};

const SPEED_LABEL: Record<number, string> = {
  0: '❚❚',
  1: '1×',
  2: '2×',
  5: '5×',
  10: '10×',
  50: '50×',
  100: '100×',
  500: '500×',
  2000: '2000×',
};

/** How long a simulated day takes in the real world, in plain words. */
function dayLength(speed: number): string {
  if (speed <= 0) return 'angehalten';
  const seconds = realSecondsPerSimDay(speed);
  if (seconds >= 90) return `1 Tag ≈ ${Math.round(seconds / 60)} Min.`;
  return `1 Tag ≈ ${Math.round(seconds)} Sek.`;
}

export function TopBar({
  onSave,
  onMenu,
  onHelp,
}: {
  onSave: () => void;
  onMenu: () => void;
  onHelp: () => void;
}) {
  const engine = useEngine();
  useSimPulse(8);
  const ui = useUI();

  const date = engine.clock.date;
  const weather = engine.world.weather;

  return (
    <header className="topbar">
      <div className="brand">
        <span>
          <span className="city">{engine.world.name}</span>
        </span>
        <span className="sub hidden-mobile">Living World</span>
      </div>

      <div className="clock">
        <span className={`time${engine.clock.paused ? '' : ' ticking'}`}>
          {formatClock(engine.clock.totalMinutes)}
        </span>
        <span className="date">
          {WEEKDAY_SHORT[date.weekday]}, {formatDate(engine.day, true)}
          <span className="pace">{dayLength(engine.clock.speed)}</span>
        </span>
      </div>

      <div className="speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`speed-btn${s === 0 ? ' pause' : ''}${engine.clock.speed === s ? ' active' : ''}`}
            onClick={() => {
              engine.setSpeed(s as Speed);
              ui.setSpeed(s as Speed);
            }}
            title={
              s === 0
                ? 'Pause (Leertaste)'
                : `${s} Simulationsminuten pro Sekunde · ${dayLength(s)}`
            }
          >
            {SPEED_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="weather-chip hidden-mobile" title="Aktuelles Wetter">
        <span>{WEATHER_ICON[weather.kind] ?? '·'}</span>
        <span>{weather.kind}</span>
        <span style={{ color: 'var(--text-faint)' }}>{weather.temperature}°C</span>
      </div>

      <div className="weather-chip hidden-mobile" title="Einwohnerzahl">
        👥 {engine.stats.population.toLocaleString('de-DE')}
      </div>

      <div className="spacer" />

      <GlobalSearch />

      <TimeJump />
      <button
        type="button"
        className={`icon-btn${ui.showDebug ? ' active' : ''}`}
        onClick={() => ui.toggle('showDebug')}
        title="Debug-Modus (D)"
      >
        ⚙
      </button>
      <button type="button" className="icon-btn" onClick={onSave} title="Welt speichern (S)">
        💾
      </button>
      <button type="button" className="icon-btn" onClick={onHelp} title="Kurzeinführung (H)">
        ?
      </button>
      <button type="button" className="icon-btn" onClick={onMenu} title="Hauptmenü">
        ☰
      </button>
    </header>
  );
}

function GlobalSearch() {
  const engine = useEngine();
  const ui = useUI();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { people: [], companies: [], places: [] };
    const people: number[] = [];
    for (const id of engine.aliveIds) {
      const npc = engine.npcs[id];
      if (fullName(npc).toLowerCase().includes(q)) people.push(id);
      if (people.length >= 8) break;
    }
    const companies = engine.companies
      .filter((c) => !c.bankrupt && c.name.toLowerCase().includes(q))
      .slice(0, 5);
    const places = engine.world.buildings.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 5);
    // Profession search: "Arzt" should find the people doing that job.
    if (people.length < 8) {
      for (const id of engine.aliveIds) {
        if (people.length >= 8) break;
        const npc = engine.npcs[id];
        if (people.includes(id)) continue;
        if (jobTitle(engine, npc).toLowerCase().includes(q)) people.push(id);
      }
    }
    return { people, companies, places };
  }, [query, engine]);

  const total = results.people.length + results.companies.length + results.places.length;

  return (
    <div className="search-wrap" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <span className="search-icon">🔍</span>
      <input
        className="search-input"
        value={query}
        placeholder="Personen, Firmen, Orte …"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <div className="search-results">
          {total === 0 && <div className="empty">Nichts gefunden.</div>}

          {results.people.length > 0 && <div className="search-group">Personen</div>}
          {results.people.map((id) => {
            const npc = engine.npcs[id];
            return (
              <button
                key={id}
                type="button"
                className="search-row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  ui.select(id);
                  setOpen(false);
                }}
              >
                <Avatar text={`${npc.firstName[0]}${npc.lastName[0]}`} color={tintOf(npc)} />
                <span>
                  <div style={{ fontWeight: 600 }}>{fullName(npc)}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                    {npc.ageYears} J · {jobTitle(engine, npc)}
                  </div>
                </span>
                <span className="meta">{formatMoneyShort(engine.netWorth(npc))}</span>
              </button>
            );
          })}

          {results.companies.length > 0 && <div className="search-group">Unternehmen</div>}
          {results.companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className="search-row"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const first = c.employees.find((id) => engine.npcs[id]?.alive);
                if (first !== undefined) ui.select(first);
                setOpen(false);
              }}
            >
              <span style={{ width: 28, textAlign: 'center' }}>🏢</span>
              <span>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                  {c.employees.length} Beschäftigte
                </div>
              </span>
              <span className="meta">{formatMoneyShort(c.balance)}</span>
            </button>
          ))}

          {results.places.length > 0 && <div className="search-group">Orte</div>}
          {results.places.map((b) => (
            <button
              key={b.id}
              type="button"
              className="search-row"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const person = b.present.find((id) => engine.npcs[id]?.alive);
                if (person !== undefined) ui.select(person);
                setOpen(false);
              }}
            >
              <span style={{ width: 28, textAlign: 'center' }}>📍</span>
              <span>
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                  {engine.world.districts[b.districtId].name}
                </div>
              </span>
              <span className="meta">{b.occupants} anwesend</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
