import type { Memory, MemoryKind, NPC } from './types';
import { DAYS_PER_YEAR } from '../time/calendar';

const MAX_MEMORIES = 48;

/** Baseline importance per memory kind - life events stay, small talk does not. */
export const MEMORY_WEIGHT: Record<MemoryKind, number> = {
  birth: 100,
  child_born: 98,
  wedding: 96,
  death: 95,
  breakup: 88,
  betrayal: 92,
  fired: 80,
  promotion: 74,
  company_founded: 82,
  bankruptcy: 84,
  graduation: 70,
  move: 62,
  fight: 58,
  hired: 60,
  first_meeting: 40,
  gift: 44,
  help: 42,
  crime: 78,
  illness: 66,
  divine: 90,
};

export function remember(
  npc: NPC,
  day: number,
  kind: MemoryKind,
  text: string,
  valence: number,
  other = -1,
  importanceOverride?: number,
): Memory {
  const m: Memory = {
    day,
    kind,
    other,
    valence,
    importance: importanceOverride ?? MEMORY_WEIGHT[kind],
    text,
  };
  npc.memories.push(m);
  if (npc.memories.length > MAX_MEMORIES) pruneMemories(npc, day);
  return m;
}

/**
 * Drops the least relevant memories. Relevance combines raw importance with
 * recency, so an old promotion eventually fades but a wedding never does.
 */
export function pruneMemories(npc: NPC, currentDay: number): void {
  if (npc.memories.length <= MAX_MEMORIES) return;
  const scored = npc.memories.map((m) => {
    const years = (currentDay - m.day) / DAYS_PER_YEAR;
    const recency = 1 / (1 + years * 0.35);
    // Anything above 90 is a core life memory and never decays away.
    const score = m.importance >= 90 ? 1000 + m.importance : m.importance * (0.45 + recency * 0.55);
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  npc.memories = scored.slice(0, MAX_MEMORIES).map((s) => s.m).sort((a, b) => a.day - b.day);
}

/** Emotional residue of everything this NPC remembers about `otherId`. */
export function memoryBiasToward(npc: NPC, otherId: number, currentDay: number): number {
  let sum = 0;
  for (const m of npc.memories) {
    if (m.other !== otherId) continue;
    const years = (currentDay - m.day) / DAYS_PER_YEAR;
    sum += m.valence * (m.importance / 100) * (1 / (1 + years * 0.5));
  }
  return Math.max(-60, Math.min(60, sum * 0.35));
}

/** The memories the UI shows on a life timeline. */
export function lifeEvents(npc: NPC): Memory[] {
  return npc.memories.filter((m) => m.importance >= 55).sort((a, b) => a.day - b.day);
}
