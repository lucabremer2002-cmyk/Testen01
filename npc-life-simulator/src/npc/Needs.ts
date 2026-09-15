import { clamp100 } from '../core/math';
import type { LifeStage, NPC, Needs } from './types';

export const NEED_KEYS: readonly (keyof Needs)[] = [
  'hunger', 'energy', 'hygiene', 'social', 'fun', 'comfort', 'safety', 'stress',
];

export const NEED_LABEL: Record<keyof Needs, string> = {
  hunger: 'Hunger',
  energy: 'Energie',
  hygiene: 'Hygiene',
  social: 'Soziales',
  fun: 'Spaß',
  comfort: 'Komfort',
  safety: 'Sicherheit',
  stress: 'Stress',
};

/** Baseline change per simulated hour while awake and idle. */
const BASE_DECAY: Record<keyof Needs, number> = {
  hunger: -4.4,
  energy: -3.1,
  hygiene: -2.4,
  social: -1.9,
  fun: -2.1,
  comfort: -1.4,
  safety: -0.32,
  stress: 0.5,
};

export function createNeeds(rand: (min: number, max: number) => number): Needs {
  return {
    hunger: rand(45, 95),
    energy: rand(45, 95),
    hygiene: rand(50, 95),
    social: rand(35, 90),
    fun: rand(35, 90),
    comfort: rand(40, 90),
    safety: rand(50, 95),
    stress: rand(5, 40),
  };
}

/**
 * Applies baseline decay for `hours` simulated hours. Action-specific
 * restoration is applied separately by the action system.
 */
export function decayNeeds(npc: NPC, hours: number, stage: LifeStage): void {
  const n = npc.needs;
  // Children burn energy faster, seniors need less social contact.
  const ageMul = stage === 'child' || stage === 'teen' ? 1.15 : stage === 'senior' ? 0.85 : 1;
  n.hunger = clamp100(n.hunger + BASE_DECAY.hunger * hours * ageMul);
  n.hygiene = clamp100(n.hygiene + BASE_DECAY.hygiene * hours);
  n.social = clamp100(n.social + BASE_DECAY.social * hours * (0.6 + npc.p.extraversion / 100));
  n.fun = clamp100(n.fun + BASE_DECAY.fun * hours * ageMul);
  n.comfort = clamp100(n.comfort + BASE_DECAY.comfort * hours);
  n.safety = clamp100(n.safety + BASE_DECAY.safety * hours);
  // Emotionally stable people shed stress faster on their own.
  const stressDrift = BASE_DECAY.stress - (npc.p.stability / 100) * 0.55;
  n.stress = clamp100(n.stress + stressDrift * hours);
}

/**
 * Urgency of a need, 0..1, rising steeply as the need empties. The quadratic
 * response is what makes NPCs drop everything when they are truly starving.
 */
export function urgency(value: number): number {
  const lack = (100 - value) / 100;
  return lack * lack;
}

/** Stress works the other way round - high value is the problem. */
export function stressUrgency(value: number): number {
  const v = value / 100;
  return v * v;
}

/** Composite "is this NPC in trouble" score used for story detection. */
export function distress(npc: NPC): number {
  const n = npc.needs;
  return (
    urgency(n.hunger) * 0.22 +
    urgency(n.energy) * 0.22 +
    urgency(n.social) * 0.14 +
    urgency(n.comfort) * 0.1 +
    urgency(n.safety) * 0.12 +
    stressUrgency(n.stress) * 0.2
  );
}
