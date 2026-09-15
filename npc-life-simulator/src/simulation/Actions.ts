import type { ActionType, Needs } from '../npc/types';
import type { BuildingType } from '../world/types';
import type { PriceCategory } from '../economy/types';

export interface ActionDef {
  type: ActionType;
  /** Third-person description shown in the UI ("arbeitet", "schläft"). */
  label: string;
  /** Need change per simulated hour, applied on top of baseline decay. */
  effects: Partial<Record<keyof Needs, number>>;
  /** Multiplier on baseline decay while performing (sleep slows hunger). */
  decayScale: number;
  /** Typical duration range in minutes. */
  duration: [number, number];
  /** Where it can happen; empty means the location is chosen contextually. */
  places: readonly BuildingType[];
  costCategory: PriceCategory | null;
  /** How many price units the action consumes. */
  costUnits: number;
  /** True when another NPC is involved. */
  social: boolean;
  outdoor: boolean;
  /**
   * `effects` flattened into an array. The scoring loop runs millions of times
   * per second and a `for...in` over an object is far slower than this.
   */
  effectList: { k: keyof Needs; v: number }[];
}

const def = (
  type: ActionType,
  label: string,
  effects: Partial<Record<keyof Needs, number>>,
  duration: [number, number],
  extra: Partial<ActionDef> = {},
): ActionDef => ({
  type,
  label,
  effects,
  decayScale: 1,
  duration,
  places: [],
  costCategory: null,
  costUnits: 0,
  social: false,
  outdoor: false,
  effectList: [],
  ...extra,
});

export const ACTIONS: Record<ActionType, ActionDef> = {
  sleep: def('sleep', 'schläft', { energy: 14, comfort: 7, stress: -3.2, safety: 2.6 }, [330, 540], {
    decayScale: 0.42,
  }),
  // No cost: the food was already paid for when the groceries were bought.
  eat_home: def('eat_home', 'isst zu Hause', { hunger: 84, comfort: 9, stress: -3, safety: 1.5 }, [30, 55]),
  // Lunch brought from home - the cheap option while out and about.
  eat_packed: def('eat_packed', 'isst mitgebrachtes Essen', { hunger: 72, comfort: 2, stress: -1 }, [15, 30]),
  eat_out: def(
    'eat_out',
    'isst auswärts',
    { hunger: 86, fun: 9, social: 5, comfort: 5, stress: -3 },
    [55, 110],
    { places: ['restaurant', 'cafe'], costCategory: 'dining', costUnits: 1 },
  ),
  groceries: def('groceries', 'kauft ein', { comfort: 6, fun: -3, stress: 1.5 }, [30, 60], {
    places: ['supermarket', 'mall'],
    costCategory: 'food',
    // One trip stocks twelve meals (see the pantry refill in the engine).
    costUnits: 12,
  }),
  work: def('work', 'arbeitet', { energy: -2.6, fun: -4.5, social: 4, stress: 4.2, hygiene: -1.5 }, [
    240, 540,
  ]),
  overtime: def('overtime', 'macht Überstunden', { energy: -4.6, fun: -7, stress: 8.5 }, [60, 180]),
  job_hunt: def('job_hunt', 'sucht Arbeit', { fun: -4, stress: 5, comfort: -2 }, [80, 160], {
    places: ['office', 'townhall', 'library'],
  }),
  school: def('school', 'ist in der Schule', { fun: -2.5, social: 9, energy: -2.2, stress: 2.4 }, [
    300, 390,
  ], { places: ['school'] }),
  study: def('study', 'studiert', { fun: -3, social: 5, energy: -2.4, stress: 3.4 }, [180, 400], {
    places: ['university', 'library'],
  }),
  socialize: def(
    'socialize',
    'trifft Freunde',
    { social: 27, fun: 16, stress: -7, hunger: 6 },
    [70, 190],
    { places: ['cafe', 'bar', 'restaurant', 'park'], costCategory: 'dining', costUnits: 0.42, social: true },
  ),
  date: def('date', 'hat ein Date', { social: 25, fun: 22, stress: -9, hunger: 10 }, [90, 210], {
    places: ['restaurant', 'bar', 'park', 'cafe'],
    costCategory: 'dining',
    costUnits: 0.75,
    social: true,
  }),
  romance_hunt: def(
    'romance_hunt',
    'geht aus',
    { social: 15, fun: 13, stress: -4 },
    [90, 200],
    { places: ['bar', 'cafe', 'park', 'sports', 'gym'], costCategory: 'dining', costUnits: 0.7 },
  ),
  family_time: def('family_time', 'ist bei der Familie', { social: 20, fun: 9, comfort: 7, stress: -5, safety: 2 }, [
    60, 180,
  ], { social: true }),
  gym: def('gym', 'trainiert', { fun: 9, stress: -11, energy: -5.5, hygiene: -16, hunger: -6 }, [
    50, 110,
  ], { places: ['gym', 'sports'], costCategory: 'entertainment', costUnits: 0.35 }),
  park: def('park', 'ist im Park', { fun: 12, stress: -8, social: 4, energy: -1.5 }, [45, 120], {
    places: ['park'],
    outdoor: true,
  }),
  shop: def('shop', 'geht shoppen', { fun: 19, comfort: 9, stress: -4 }, [50, 130], {
    places: ['mall', 'shop'],
    costCategory: 'clothing',
    costUnits: 0.45,
  }),
  hygiene: def('hygiene', 'macht sich frisch', { hygiene: 95, comfort: 9, stress: -2, safety: 1 }, [20, 40]),
  relax: def('relax', 'entspannt sich', { fun: 12, comfort: 14, stress: -8, energy: 2.5, safety: 3 }, [45, 150]),
  hospital: def('hospital', 'ist im Krankenhaus', { safety: 22, stress: 5, comfort: -6 }, [90, 300], {
    places: ['hospital'],
    costCategory: 'health',
    costUnits: 1.4,
  }),
  bank: def('bank', 'erledigt Bankgeschäfte', { safety: 12, stress: -2 }, [25, 50], {
    places: ['bank'],
  }),
  idle: def('idle', 'wartet', {}, [20, 60]),
  childcare: def('childcare', 'kümmert sich um die Kinder', { social: 12, comfort: 4, fun: -1, stress: 3.5 }, [
    60, 180,
  ], { social: true }),
  funeral: def('funeral', 'nimmt an einer Beerdigung teil', { stress: 9, fun: -12, social: 8 }, [90, 150], {
    places: ['cemetery'],
    outdoor: true,
  }),
};

// Flatten the effect maps once at module load.
for (const def of Object.values(ACTIONS)) {
  def.effectList = (Object.keys(def.effects) as (keyof Needs)[]).map((k) => ({
    k,
    v: def.effects[k]!,
  }));
}

/** Present-tense label used in the NPC list and tooltips. */
export const actionLabel = (type: ActionType): string => ACTIONS[type].label;

/**
 * Venues where money actually changes hands. Meeting a friend in a park or at
 * home costs nothing, which is why the venue - not the action - decides.
 */
export const PAID_VENUES: ReadonlySet<string> = new Set([
  'restaurant', 'cafe', 'bar', 'mall', 'shop', 'gym', 'sports', 'supermarket', 'hospital',
]);

/** Actions that should never be interrupted by the "better option" check. */
export const UNINTERRUPTIBLE: ReadonlySet<ActionType> = new Set<ActionType>([
  'sleep',
  'work',
  'school',
  'hospital',
]);
