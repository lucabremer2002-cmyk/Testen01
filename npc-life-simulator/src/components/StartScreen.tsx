import { useEffect, useState } from 'react';
import { hashSeed } from '../core/rng';
import { CITY_NAMES } from '../world/worldNames';
import { deleteSave, listSaves, loadGame, type SaveSlotInfo } from '../storage/SaveGame';
import { PHONE_QUERY, useMediaQuery } from '../core/useMediaQuery';
import { formatDate } from '../time/calendar';
import type { SaveData } from '../storage/serialize';

export interface NewGameOptions {
  seed: number;
  population: number;
  cityName: string;
}

export function StartScreen({
  onStart,
  onLoad,
  error,
}: {
  onStart: (o: NewGameOptions) => void;
  onLoad: (data: SaveData) => void;
  error?: string;
}) {
  const phone = useMediaQuery(PHONE_QUERY);
  const [seedText, setSeedText] = useState('847291');
  const [population, setPopulation] = useState(phone ? 500 : 1200);
  const [cityName, setCityName] = useState('');
  const [saves, setSaves] = useState<SaveSlotInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listSaves().then(setSaves);
  }, []);

  const resolvedSeed = (): number => {
    const n = Number(seedText);
    if (Number.isFinite(n) && seedText.trim() !== '') return Math.abs(Math.floor(n)) >>> 0;
    return hashSeed(seedText);
  };

  const start = () => {
    setBusy(true);
    // Let the browser paint the loading state before the world is generated.
    setTimeout(
      () => onStart({ seed: resolvedSeed(), population, cityName: cityName.trim() }),
      30,
    );
  };

  const randomSeed = () => setSeedText(String(Math.floor(Math.random() * 9_000_000) + 100_000));

  return (
    <div className="menu-screen">
      <div className="menu-card">
        <h1>
          NPC-Life Simulator <span style={{ color: 'var(--accent)' }}>Living World</span>
        </h1>
        <p className="tagline">
          Eine Stadt, die ohne dich weiterlebt. Beobachte sie, beschleunige die Zeit – oder greife ein.
        </p>

        {error && (
          <div
            className="badge bad"
            style={{ display: 'block', padding: '8px 12px', marginBottom: 14 }}
          >
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="seed">Seed</label>
          <div className="inline-input">
            <input
              id="seed"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder="z. B. 847291"
            />
            <button className="btn" onClick={randomSeed} type="button">
              Zufällig
            </button>
          </div>
          <div className="hint">
            Derselbe Seed erzeugt exakt dieselbe Welt – Stadt, Menschen, Persönlichkeiten.
          </div>
        </div>

        <div className="field">
          <label htmlFor="pop">Einwohner: {population.toLocaleString('de-DE')}</label>
          <input
            id="pop"
            type="range"
            min={200}
            max={3000}
            step={100}
            value={population}
            onChange={(e) => setPopulation(Number(e.target.value))}
          />
          <div className="hint">
            {phone
              ? 'Die Stadt wächst mit der Bevölkerung. Auf dem Handy laufen 300 bis 800 Einwohner flüssig.'
              : 'Die Stadt wächst mit der Bevölkerung. Ab etwa 2.000 Einwohnern läuft die höchste Geschwindigkeitsstufe auf schwächeren Geräten spürbar langsamer.'}
          </div>
        </div>

        <div className="field">
          <label htmlFor="city">Stadtname (optional)</label>
          <input
            id="city"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder={`zufällig, z. B. ${CITY_NAMES[0]}`}
          />
        </div>

        <div className="menu-actions">
          <button className="btn primary" onClick={start} disabled={busy} type="button">
            {busy ? 'Welt wird erschaffen …' : 'Neue Welt erschaffen'}
          </button>
        </div>

        {saves.length > 0 && (
          <div className="save-list">
            <h4 className="panel-title">Gespeicherte Welten</h4>
            {saves.map((s) => (
              <div className="save-row" key={s.id}>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>
                    {s.name} · {s.cityName}
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                    {formatDate(s.day)} · {s.population} Einwohner · Seed {s.seed} ·{' '}
                    {new Date(s.savedAt).toLocaleString('de-DE')}
                  </div>
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    const data = await loadGame(s.id);
                    if (data) onLoad(data);
                    else setBusy(false);
                  }}
                >
                  Laden
                </button>
                <button
                  className="btn danger"
                  type="button"
                  onClick={async () => {
                    await deleteSave(s.id);
                    setSaves(await listSaves());
                  }}
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
