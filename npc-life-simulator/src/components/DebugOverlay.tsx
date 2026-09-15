import { useEngine, useEngineContext, useSimPulse } from '../state/EngineContext';
import { useUI } from '../state/store';
import { MINUTES_PER_DAY } from '../time/calendar';
import { fullName } from '../npc/describe';
import { ACTIONS } from '../simulation/Actions';

/** Developer view: engine internals, decision scores and time-skip tools. */
export function DebugOverlay() {
  const engine = useEngine();
  const { loop } = useEngineContext();
  useSimPulse(4);
  const selectedId = useUI((s) => s.selectedId);
  const toast = useUI((s) => s.toast);
  const npc = selectedId >= 0 ? engine.npcs[selectedId] : undefined;

  const skip = (minutes: number, label: string) => {
    const speedBefore = engine.clock.speed;
    engine.setSpeed(500);
    const target = engine.now + minutes;
    const started = performance.now();
    // Run the engine directly, bounded so the tab can never freeze.
    while (engine.now < target && performance.now() - started < 8000) engine.tick();
    engine.setSpeed(speedBefore);
    toast(`${label} übersprungen.`, 'info');
  };

  const candidates = engine.decision.lastCandidates.slice(0, 8);

  return (
    <div className="debug">
      <h5>Simulation</h5>
      <div className="row"><span>Tick (ms)</span><span className="v">{engine.perf.lastTickMs.toFixed(1)} / Ø {engine.perf.avgTickMs.toFixed(1)}</span></div>
      <div className="row"><span>FPS</span><span className="v">{loop.fps.toFixed(0)}</span></div>
      <div className="row"><span>Entsch./Tick</span><span className="v">{engine.perf.decisionsPerTick}</span></div>
      <div className="row"><span>Entsch. gesamt</span><span className="v">{engine.perf.decisionsTotal.toLocaleString('de-DE')}</span></div>
      <div className="row"><span>Warteschlange</span><span className="v">{engine.perf.deferred}</span></div>
      <div className="row"><span>Sub-Schritte</span><span className="v">{engine.perf.substeps}</span></div>
      <div className="row"><span>Sim-Minute</span><span className="v">{Math.floor(engine.now)}</span></div>
      <div className="row"><span>Tag</span><span className="v">{engine.day}</span></div>
      <div className="row"><span>Lebende NPCs</span><span className="v">{engine.aliveIds.length}</span></div>
      <div className="row"><span>NPC-Objekte</span><span className="v">{engine.npcs.length}</span></div>
      <div className="row"><span>Beziehungen</span><span className="v">{engine.rels.size}</span></div>
      <div className="row"><span>Ereignisse</span><span className="v">{engine.events.count}</span></div>
      <div className="row"><span>Seed</span><span className="v">{engine.seed}</span></div>

      <h5>Zeit überspringen</h5>
      <div className="debug-buttons">
        <button type="button" className="btn" onClick={() => skip(60, 'Eine Stunde')}>+1 Std</button>
        <button type="button" className="btn" onClick={() => skip(MINUTES_PER_DAY, 'Ein Tag')}>+1 Tag</button>
        <button type="button" className="btn" onClick={() => skip(MINUTES_PER_DAY * 7, 'Eine Woche')}>+1 Woche</button>
        <button type="button" className="btn" onClick={() => skip(MINUTES_PER_DAY * 30, 'Ein Monat')}>+1 Monat</button>
        <button type="button" className="btn" onClick={() => skip(MINUTES_PER_DAY * 365, 'Ein Jahr')}>+1 Jahr</button>
      </div>

      {npc && (
        <>
          <h5>{fullName(npc)} (#{npc.id})</h5>
          <div className="row"><span>Position</span><span className="v">
            {(() => { const p = engine.positionOf(npc); return `${p.x.toFixed(0)}, ${p.y.toFixed(0)}`; })()}
          </span></div>
          <div className="row"><span>Ort</span><span className="v">{engine.world.buildings[npc.locId]?.name ?? '–'}</span></div>
          <div className="row"><span>Aktion</span><span className="v">{npc.action.type}</span></div>
          <div className="row"><span>Endet bei</span><span className="v">{Math.floor(npc.action.endMin)}</span></div>
          <div className="row"><span>Nächste Entsch.</span><span className="v">{Math.floor(npc.nextDecisionMin)}</span></div>
          <div className="row"><span>Unterwegs</span><span className="v">{npc.travel ? `→ ${npc.travel.toId}` : 'nein'}</span></div>
          <div className="row"><span>Detailliert</span><span className="v">{npc.detailed ? 'ja' : 'nein'}</span></div>
          <div className="row"><span>Geldnot</span><span className="v">{(engine.financialPressure(npc) * 100).toFixed(0)} %</span></div>
          <div className="row"><span>Tagesbudget</span><span className="v">{engine.discretionaryDaily(npc).toFixed(0)} €</span></div>

          {engine.decision.lastNpcId === npc.id && candidates.length > 0 && (
            <>
              <h5>Letzte Bewertung</h5>
              {candidates.map((c, i) => (
                <div className="row" key={i}>
                  <span>{ACTIONS[c.type].label}</span>
                  <span className="v">
                    {c.score.toFixed(2)} · {Math.round(c.duration)}m · {Math.round(c.travel)}m Weg
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
