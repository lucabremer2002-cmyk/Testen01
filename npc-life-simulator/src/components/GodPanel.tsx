import { useMemo, useState } from 'react';
import { useEngine } from '../state/EngineContext';
import { useUI } from '../state/store';
import { GodMode } from '../simulation/GodMode';
import { fullName } from '../npc/describe';
import type { NPC } from '../npc/types';
import type { WeatherKind } from '../world/types';
import type { RumorKind } from '../relationships/Rumors';

const WEATHERS: WeatherKind[] = ['klar', 'bewölkt', 'regen', 'sturm', 'schnee', 'hitze', 'nebel'];

const RUMORS: { kind: RumorKind; label: string; text: (n: string) => string }[] = [
  { kind: 'affair', label: 'Affäre', text: (n) => `${n} soll fremdgehen.` },
  { kind: 'crime', label: 'Straftat', text: (n) => `${n} soll in eine Straftat verwickelt sein.` },
  { kind: 'debt', label: 'Geldnot', text: (n) => `${n} soll hoch verschuldet sein.` },
  { kind: 'wealth', label: 'Reichtum', text: (n) => `${n} soll heimlich reich sein.` },
];

/**
 * Player interventions for the selected NPC. Everything here goes through
 * GodMode, which leaves proper traces in the simulation rather than silently
 * rewriting state.
 */
export function GodPanel({ npc }: { npc: NPC }) {
  const engine = useEngine();
  const toast = useUI((s) => s.toast);
  const god = useMemo(() => new GodMode(engine), [engine]);
  const [amount, setAmount] = useState(10000);
  const [partnerQuery, setPartnerQuery] = useState('');

  const run = (fn: () => string) => {
    const message = fn();
    toast(message, 'divine');
  };

  const partnerMatches = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: NPC[] = [];
    for (const id of engine.aliveIds) {
      if (id === npc.id) continue;
      const other = engine.npcs[id];
      if (fullName(other).toLowerCase().includes(q)) out.push(other);
      if (out.length >= 5) break;
    }
    return out;
  }, [partnerQuery, engine, npc.id]);

  return (
    <div className="panel-section" style={{ background: 'var(--panel-2)' }}>
      <h4 className="panel-title">✦ Gott-Modus · {npc.firstName}</h4>

      <div className="god-section">
        <div className="inline-input" style={{ marginBottom: 6 }}>
          <input
            type="number"
            value={amount}
            step={1000}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            aria-label="Betrag in Euro"
          />
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>€</span>
        </div>
        <div className="god-grid">
          <button type="button" className="btn" onClick={() => run(() => god.giveMoney(npc, amount))}>
            Geld schenken
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.takeMoney(npc, amount))}>
            Geld nehmen
          </button>
        </div>
      </div>

      <div className="god-section">
        <h4 className="panel-title">Beruf</h4>
        <div className="god-grid">
          <button type="button" className="btn" onClick={() => run(() => god.giveJob(npc))}>
            Job verschaffen
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.removeJob(npc))}>
            Job entziehen
          </button>
        </div>
      </div>

      <div className="god-section">
        <h4 className="panel-title">Zuhause & Ort</h4>
        <div className="god-grid">
          <button type="button" className="btn" onClick={() => run(() => god.relocate(npc))}>
            Umziehen lassen
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              run(() => {
                const ids = engine.world.buildings;
                const target = ids[engine.rng.int(0, ids.length - 1)];
                return god.teleport(npc, target.id);
              })
            }
          >
            Teleportieren
          </button>
        </div>
      </div>

      <div className="god-section">
        <h4 className="panel-title">Gefühl & Zustand</h4>
        <div className="god-grid">
          <button type="button" className="btn" onClick={() => run(() => god.makeHappy(npc))}>
            Glücklich machen
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.makeAngry(npc))}>
            Wütend machen
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.restoreNeeds(npc))}>
            Rundum versorgen
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.shiftAge(npc, -10))}>
            10 Jahre jünger
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.shiftAge(npc, 10))}>
            10 Jahre älter
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm(`${fullName(npc)} wirklich aus der Welt nehmen?`)) {
                run(() => god.strikeDown(npc));
              }
            }}
          >
            Sterben lassen
          </button>
        </div>
      </div>

      <div className="god-section">
        <h4 className="panel-title">Beziehungen</h4>
        <div className="god-grid">
          <button
            type="button"
            className="btn"
            disabled={npc.family.partner < 0}
            onClick={() => run(() => god.weddingFor(npc))}
          >
            Heiraten lassen
          </button>
          <button
            type="button"
            className="btn"
            disabled={npc.family.partner < 0}
            onClick={() => run(() => god.separate(npc))}
          >
            Trennen
          </button>
        </div>
        <div style={{ marginTop: 7 }}>
          <input
            placeholder="Mit wem verkuppeln? Name eingeben …"
            value={partnerQuery}
            onChange={(e) => setPartnerQuery(e.target.value)}
            style={{ width: '100%' }}
          />
          {partnerMatches.map((other) => (
            <button
              key={other.id}
              type="button"
              className="btn wide"
              style={{ marginTop: 4 }}
              onClick={() => {
                run(() => god.matchmake(npc, other));
                setPartnerQuery('');
              }}
            >
              ♥ {fullName(other)} ({other.ageYears} J)
            </button>
          ))}
        </div>
        {npc.links.length > 0 && (
          <div className="god-grid" style={{ marginTop: 7 }}>
            <button
              type="button"
              className="btn"
              onClick={() =>
                run(() => {
                  const otherId = npc.links[engine.rng.int(0, npc.links.length - 1)];
                  return god.adjustRelationship(npc, engine.npcs[otherId], 25);
                })
              }
            >
              Bindung stärken
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                run(() => {
                  const otherId = npc.links[engine.rng.int(0, npc.links.length - 1)];
                  return god.adjustRelationship(npc, engine.npcs[otherId], -25);
                })
              }
            >
              Zerwürfnis stiften
            </button>
          </div>
        )}
      </div>

      <div className="god-section">
        <h4 className="panel-title">Gerüchte streuen</h4>
        <div className="god-grid">
          {RUMORS.map((r) => (
            <button
              key={r.kind}
              type="button"
              className="btn"
              onClick={() => run(() => god.spreadRumor(npc, r.kind, r.text(fullName(npc))))}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="god-section">
        <h4 className="panel-title">Die ganze Stadt</h4>
        <div className="filter-row" style={{ marginBottom: 6 }}>
          {WEATHERS.map((w) => (
            <button key={w} type="button" className="chip" onClick={() => run(() => god.setWeather(w))}>
              {w}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => run(() => god.releaseWeather())}>
            freigeben
          </button>
        </div>
        <div className="god-grid">
          <button type="button" className="btn" onClick={() => run(() => god.economicShock(0.6))}>
            Wirtschaftskrise
          </button>
          <button type="button" className="btn" onClick={() => run(() => god.boom(0.6))}>
            Aufschwung
          </button>
        </div>
      </div>
    </div>
  );
}
