import { clamp100 } from '../core/math';
import type { Emotions, NPC } from './types';

export const EMOTION_KEYS: readonly (keyof Emotions)[] = [
  'happiness', 'sadness', 'anger', 'love', 'loneliness', 'anxiety',
  'calm', 'jealousy', 'disappointment', 'motivation', 'pride',
];

export const EMOTION_LABEL: Record<keyof Emotions, string> = {
  happiness: 'Freude',
  sadness: 'Traurigkeit',
  anger: 'Wut',
  love: 'Verliebtheit',
  loneliness: 'Einsamkeit',
  anxiety: 'Nervosität',
  calm: 'Gelassenheit',
  jealousy: 'Eifersucht',
  disappointment: 'Enttäuschung',
  motivation: 'Motivation',
  pride: 'Stolz',
};

/** Per-hour pull back towards each emotion's resting value. */
const RESTING: Record<keyof Emotions, number> = {
  happiness: 50,
  sadness: 12,
  anger: 8,
  love: 0,
  loneliness: 15,
  anxiety: 14,
  calm: 55,
  jealousy: 6,
  disappointment: 10,
  motivation: 45,
  pride: 30,
};

export function createEmotions(rand: (min: number, max: number) => number): Emotions {
  return {
    happiness: rand(35, 75),
    sadness: rand(2, 25),
    anger: rand(0, 18),
    love: 0,
    loneliness: rand(5, 35),
    anxiety: rand(3, 28),
    calm: rand(35, 75),
    jealousy: rand(0, 12),
    disappointment: rand(0, 18),
    motivation: rand(30, 75),
    pride: rand(15, 55),
  };
}

/**
 * Emotions drift back to their resting point. Emotionally stable NPCs return
 * faster - that single line produces very different personalities over time.
 */
export function decayEmotions(npc: NPC, hours: number): void {
  const e = npc.emo;
  const rate = (0.035 + (npc.p.stability / 100) * 0.05) * hours;
  for (const k of EMOTION_KEYS) {
    const target = k === 'love' ? loveTarget(npc) : RESTING[k];
    e[k] = clamp100(e[k] + (target - e[k]) * Math.min(0.6, rate));
  }
  // Loneliness is driven by the social need rather than drifting on its own.
  e.loneliness = clamp100(e.loneliness * 0.97 + (100 - npc.needs.social) * 0.03);
}

function loveTarget(npc: NPC): number {
  if (npc.family.partner < 0) return 0;
  return npc.family.married ? 45 : 55;
}

export interface EmotionDelta {
  happiness?: number;
  sadness?: number;
  anger?: number;
  love?: number;
  loneliness?: number;
  anxiety?: number;
  calm?: number;
  jealousy?: number;
  disappointment?: number;
  motivation?: number;
  pride?: number;
  stress?: number;
}

/** Applies an emotional impact, scaled by emotional stability. */
export function applyEmotion(npc: NPC, delta: EmotionDelta): void {
  // Unstable NPCs swing harder; stable ones absorb the hit.
  const amp = 1.35 - (npc.p.stability / 100) * 0.7;
  for (const k of EMOTION_KEYS) {
    const d = delta[k];
    if (d === undefined) continue;
    npc.emo[k] = clamp100(npc.emo[k] + d * amp);
  }
  if (delta.stress !== undefined) {
    npc.needs.stress = clamp100(npc.needs.stress + delta.stress * amp);
  }
}

/** -100..100 overall mood, used everywhere in the UI and decision scoring. */
export function mood(npc: NPC): number {
  const e = npc.emo;
  return clamp100(
    e.happiness * 0.9 +
      e.calm * 0.25 +
      e.pride * 0.2 +
      e.love * 0.25 +
      e.motivation * 0.15 -
      e.sadness * 0.85 -
      e.anger * 0.6 -
      e.anxiety * 0.45 -
      e.loneliness * 0.4 -
      e.disappointment * 0.35 -
      e.jealousy * 0.3 -
      npc.needs.stress * 0.35,
  );
}

/** The single emotion label the UI shows as "current feeling". */
export function dominantEmotion(npc: NPC): keyof Emotions | 'neutral' {
  const e = npc.emo;
  let best: keyof Emotions | 'neutral' = 'neutral';
  let bestScore = 22;
  const weights: Partial<Record<keyof Emotions, number>> = {
    sadness: 1.15,
    anger: 1.2,
    love: 1.1,
    loneliness: 1.0,
    anxiety: 1.0,
    jealousy: 1.2,
    disappointment: 1.05,
    pride: 0.85,
    motivation: 0.7,
    happiness: 0.72,
    calm: 0.55,
  };
  for (const k of EMOTION_KEYS) {
    const s = e[k] * (weights[k] ?? 1);
    if (s > bestScore) {
      bestScore = s;
      best = k;
    }
  }
  if (npc.needs.stress > 72 && npc.needs.stress > bestScore) return 'anxiety';
  return best;
}
