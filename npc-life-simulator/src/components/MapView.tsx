import { useEffect, useRef, useState } from 'react';
import { MapRenderer } from '../render/MapRenderer';
import { useEngine, useEngineContext } from '../state/EngineContext';
import { useUI, type MapOverlay } from '../state/store';
import { ACTION_COLORS } from '../render/palette';
import { activityShort, fullName, jobTitle } from '../npc/describe';
import { ACTIONS } from '../simulation/Actions';

const OVERLAYS: { id: MapOverlay; label: string }[] = [
  { id: 'districts', label: 'Stadtteile' },
  { id: 'busy', label: 'Betrieb' },
  { id: 'wealth', label: 'Wohlstand' },
  { id: 'mood', label: 'Stimmung' },
  { id: 'age', label: 'Alter' },
];

const LEGEND: { type: keyof typeof ACTION_COLORS; label: string }[] = [
  { type: 'work', label: 'Arbeit' },
  { type: 'sleep', label: 'Schlaf' },
  { type: 'eat_home', label: 'Essen' },
  { type: 'socialize', label: 'Freunde' },
  { type: 'date', label: 'Date' },
  { type: 'school', label: 'Schule' },
  { type: 'gym', label: 'Sport' },
  { type: 'park', label: 'Freizeit' },
  { type: 'hospital', label: 'Klinik' },
];

export function MapView() {
  const engine = useEngine();
  const { loop } = useEngineContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // The UI store is read through refs so the render loop never re-subscribes.
  const uiRef = useRef(useUI.getState());
  useEffect(() => useUI.subscribe((s) => { uiRef.current = s; }), []);
  const overlay = useUI((s) => s.overlay);
  const setOverlay = useUI((s) => s.setOverlay);
  const showNames = useUI((s) => s.showNames);
  const toggle = useUI((s) => s.toggle);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new MapRenderer(canvas, engine);
    rendererRef.current = renderer;

    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas.parentElement ?? canvas);

    // Rendering runs on the game loop's frame callback, not on React renders.
    const prevOnFrame = loop.onFrame;
    loop.onFrame = () => {
      const ui = uiRef.current;
      if (ui.followSelected && ui.selectedId >= 0) {
        const npc = engine.npcs[ui.selectedId];
        if (npc?.alive) {
          const p = engine.positionOf(npc);
          renderer.centerOn(p.x, p.y);
        }
      }
      renderer.render({
        selectedId: ui.selectedId,
        hoverId: ui.hoverId,
        trackedIds: ui.trackedIds,
        overlay: ui.overlay,
        showNames: ui.showNames,
        showRoutes: ui.showRoutes,
      });
    };
    return () => {
      observer.disconnect();
      loop.onFrame = prevOnFrame;
    };
  }, [engine, loop]);

  // Keep the detailed-simulation set in sync with what the player is watching.
  useEffect(() => {
    const update = () => {
      const ui = useUI.getState();
      const ids = new Set(ui.trackedIds);
      if (ui.selectedId >= 0) ids.add(ui.selectedId);
      engine.setDetailed(ids);
    };
    update();
    return useUI.subscribe(update);
  }, [engine]);

  const localPoint = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const dragState = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  return (
    <div className="map-wrap">
      <canvas
        ref={canvasRef}
        className={dragging ? 'map-canvas dragging' : 'map-canvas'}
        onMouseDown={(e) => {
          const p = localPoint(e);
          dragState.current = { x: p.x, y: p.y, moved: false };
          setDragging(true);
        }}
        onMouseMove={(e) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          const p = localPoint(e);
          if (dragState.current) {
            const dx = p.x - dragState.current.x;
            const dy = p.y - dragState.current.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              dragState.current.moved = true;
              renderer.pan(dx, dy);
              dragState.current.x = p.x;
              dragState.current.y = p.y;
            }
            return;
          }
          const id = renderer.pickNpc(p.x, p.y);
          useUI.getState().setHover(id);
          setTooltip(id >= 0 ? { x: p.x, y: p.y, id } : null);
        }}
        onMouseUp={(e) => {
          const renderer = rendererRef.current;
          setDragging(false);
          const wasDrag = dragState.current?.moved;
          dragState.current = null;
          if (!renderer || wasDrag) return;
          const p = localPoint(e);
          const id = renderer.pickNpc(p.x, p.y);
          if (id >= 0) useUI.getState().select(id);
        }}
        onMouseLeave={() => {
          dragState.current = null;
          setDragging(false);
          setTooltip(null);
          useUI.getState().setHover(-1);
        }}
        onWheel={(e) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          const p = localPoint(e);
          renderer.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.14 : 1 / 1.14);
        }}
        onDoubleClick={(e) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          const p = localPoint(e);
          const id = renderer.pickNpc(p.x, p.y);
          if (id >= 0) {
            useUI.getState().select(id);
            useUI.getState().toggleTrack(id);
          }
        }}
      />

      {tooltip && <MapTooltip x={tooltip.x} y={tooltip.y} id={tooltip.id} />}

      <div className="map-controls">
        <div className="overlay-picker">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`tab${overlay === o.id ? ' active' : ''}`}
              onClick={() => setOverlay(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={`icon-btn${showNames ? ' active' : ''}`}
            title="Stadtteilnamen einblenden"
            onClick={() => toggle('showNames')}
          >
            A
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Ganze Stadt zeigen"
            onClick={() => rendererRef.current?.fitToWorld()}
          >
            ⤢
          </button>
        </div>
      </div>

      <div className="map-legend">
        <strong style={{ fontSize: 10, letterSpacing: 1, color: 'var(--text-faint)' }}>
          {overlay === 'districts' ? 'AKTIVITÄT DER EINWOHNER' : 'KARTENANSICHT'}
        </strong>
        <div className="legend-items">
          {overlay === 'districts' || overlay === 'busy' ? (
            LEGEND.map((l) => (
              <span className="legend-item" key={l.type}>
                <span className="dot" style={{ background: ACTION_COLORS[l.type] }} />
                {l.label}
              </span>
            ))
          ) : (
            <span className="legend-item">
              {overlay === 'wealth' && 'rot = wenig Vermögen · grün = viel Vermögen'}
              {overlay === 'mood' && 'rot = unglücklich · grün = glücklich'}
              {overlay === 'age' && 'blau = jung · violett = alt'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MapTooltip({ x, y, id }: { x: number; y: number; id: number }) {
  const engine = useEngine();
  const npc = engine.npcs[id];
  if (!npc) return null;
  const place = npc.travel
    ? engine.world.buildings[npc.travel.toId]
    : engine.world.buildings[npc.action.locationId];
  return (
    <div className="map-tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="tt-name">{fullName(npc)}</div>
      <div className="tt-line">
        {npc.ageYears} Jahre · {jobTitle(engine, npc)}
      </div>
      <div className="tt-line">
        {activityShort(npc)}
        {place ? ` · ${place.name}` : ''}
      </div>
      <div className="tt-line" style={{ color: 'var(--text-faint)', marginTop: 3 }}>
        {ACTIONS[npc.action.type].label} · Klick für Details, Doppelklick zum Verfolgen
      </div>
    </div>
  );
}
