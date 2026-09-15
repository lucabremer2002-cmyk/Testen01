import { SimulationEngine, type EngineConfig } from '../simulation/SimulationEngine';
import { World } from '../world/World';
import type { NPC } from '../npc/types';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  savedAt: number;
  config: EngineConfig;
  rngState: number;
  clock: ReturnType<import('../time/SimulationClock').SimulationClock['serialize']>;
  world: ReturnType<World['serialize']>;
  npcs: unknown[];
  relationships: unknown[];
  companies: unknown[];
  professionIds: string[];
  market: unknown;
  events: unknown;
  stories: unknown;
  rumors: unknown;
  detailedIds: number[];
  actionCounts: Record<string, number>;
}

/** NPCs contain a Set, which JSON cannot represent. */
function packNpc(npc: NPC): unknown {
  return { ...npc, known: Array.from(npc.known) };
}

function unpackNpc(raw: Record<string, unknown>): NPC {
  const npc = raw as unknown as NPC;
  npc.known = new Set((raw.known as number[] | undefined) ?? []);
  return npc;
}

export function serializeEngine(engine: SimulationEngine): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    config: engine.config,
    rngState: engine.rng.getState(),
    clock: engine.clock.serialize(),
    world: engine.world.serialize(),
    npcs: engine.npcs.map(packNpc),
    relationships: engine.rels.serialize(),
    companies: engine.companies,
    professionIds: engine.professionIds,
    market: engine.market.serialize(),
    events: engine.events.serialize(),
    stories: engine.stories.serialize(),
    rumors: engine.rumors.serialize(),
    detailedIds: Array.from(engine.detailedIds),
    actionCounts: engine.actionCounts,
  };
}

export function deserializeEngine(data: SaveData): SimulationEngine {
  if (data.version !== SAVE_VERSION) {
    throw new Error(
      `Spielstand-Version ${data.version} passt nicht zur aktuellen Version ${SAVE_VERSION}.`,
    );
  }
  const engine = new SimulationEngine(data.config);
  engine.rng.setState(data.rngState);
  engine.clock.restore(data.clock);
  engine.world = World.restore(data.world as never);
  engine.npcs = (data.npcs as Record<string, unknown>[]).map(unpackNpc);
  engine.rels.restore(data.relationships as never);
  engine.companies = data.companies as never;
  engine.professionIds = data.professionIds;
  engine.market.restore(data.market as never);
  engine.events.restore(data.events as never);
  engine.stories.restore(data.stories as never);
  engine.rumors.restore(data.rumors as never);
  engine.actionCounts = data.actionCounts ?? {};

  // Transient state is rebuilt rather than stored.
  for (const b of engine.world.buildings) {
    b.present = [];
    b.occupants = 0;
    b.visitsToday = 0;
  }
  const now = engine.clock.totalMinutes;
  const entries: { id: number; at: number }[] = [];
  for (const npc of engine.npcs) {
    if (!npc.alive) continue;
    if (npc.locId >= 0 && engine.world.buildings[npc.locId] && !npc.travel) {
      engine.world.buildings[npc.locId].present.push(npc.id);
      engine.world.buildings[npc.locId].occupants++;
    }
    npc.lastUpdateMin = Math.min(npc.lastUpdateMin, now);
    entries.push({ id: npc.id, at: Math.max(now, npc.nextDecisionMin) });
  }
  engine.scheduler.rebuild(entries, now);
  engine.setDetailed(data.detailedIds ?? []);
  engine.afterBuild();
  engine.refreshVacancies();
  return engine;
}
