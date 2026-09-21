export type Gender = 'm' | 'w';
export type NPCId = number;

/** Big-Five-inspired core plus the traits the simulation reads most often. */
export interface Personality {
  openness: number;
  extraversion: number;
  agreeableness: number;
  conscientiousness: number;
  stability: number;
  ambition: number;
  impulsivity: number;
  loyalty: number;
  risk: number;
  empathy: number;
}

/** Capabilities and surface qualities, all 0..100. */
export interface Attributes {
  intelligence: number;
  confidence: number;
  discipline: number;
  aggression: number;
  social: number;
  humor: number;
  attractiveness: number;
  health: number;
}

/**
 * All values 0..100 where 100 means "fully satisfied" - except stress, where
 * 100 means "about to break". Kept as a flat object for monomorphic access.
 */
export interface Needs {
  hunger: number;
  energy: number;
  hygiene: number;
  social: number;
  fun: number;
  comfort: number;
  safety: number;
  stress: number;
}

export interface Emotions {
  happiness: number;
  sadness: number;
  anger: number;
  love: number;
  loneliness: number;
  anxiety: number;
  calm: number;
  jealousy: number;
  disappointment: number;
  motivation: number;
  pride: number;
}

export type SkillId =
  | 'craft'
  | 'tech'
  | 'social'
  | 'fitness'
  | 'art'
  | 'business'
  | 'medical'
  | 'teaching'
  | 'driving'
  | 'cooking';

export const SKILL_IDS: readonly SkillId[] = [
  'craft', 'tech', 'social', 'fitness', 'art', 'business', 'medical', 'teaching', 'driving', 'cooking',
];

export const SKILL_LABEL: Record<SkillId, string> = {
  craft: 'Handwerk',
  tech: 'Technik',
  social: 'Kommunikation',
  fitness: 'Fitness',
  art: 'Kreativität',
  business: 'Wirtschaft',
  medical: 'Medizin',
  teaching: 'Pädagogik',
  driving: 'Fahren',
  cooking: 'Kochen',
};

export type Skills = Record<SkillId, number>;

export type LifeStage = 'baby' | 'child' | 'teen' | 'young' | 'adult' | 'midlife' | 'senior';

export const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  baby: 'Kleinkind',
  child: 'Kind',
  teen: 'Jugendlicher',
  young: 'Junger Erwachsener',
  adult: 'Erwachsener',
  midlife: 'Mittleres Alter',
  senior: 'Senior',
};

export type EducationLevel = 0 | 1 | 2 | 3 | 4;
export const EDUCATION_LABEL = [
  'ohne Abschluss',
  'Schulabschluss',
  'Ausbildung',
  'Studium',
  'Promotion',
] as const;

export type GoalType =
  | 'career'
  | 'wealth'
  | 'marry'
  | 'children'
  | 'own_home'
  | 'found_company'
  | 'fame'
  | 'happiness'
  | 'leave_city'
  | 'education'
  | 'fitness'
  | 'friendship';

export interface Goal {
  type: GoalType;
  /** 0..100 - re-evaluated when life circumstances change. */
  priority: number;
  /** 0..100. */
  progress: number;
  createdDay: number;
  /** Optional target (NPC, building or company id depending on goal type). */
  target: number;
}

export type MemoryKind =
  | 'birth'
  | 'child_born'
  | 'wedding'
  | 'breakup'
  | 'death'
  | 'promotion'
  | 'fired'
  | 'hired'
  | 'fight'
  | 'first_meeting'
  | 'move'
  | 'betrayal'
  | 'gift'
  | 'help'
  | 'graduation'
  | 'crime'
  | 'illness'
  | 'company_founded'
  | 'bankruptcy'
  | 'divine';

export interface Memory {
  day: number;
  kind: MemoryKind;
  /** Other NPC involved, -1 for none. */
  other: NPCId;
  /** -100..100 - how good or bad it felt. */
  valence: number;
  /** 0..100 - decides what survives memory pruning. */
  importance: number;
  text: string;
}

export type SecretKind = 'affair' | 'debt' | 'crime' | 'illness' | 'jobloss' | 'crush' | 'lie';

export interface Secret {
  kind: SecretKind;
  about: NPCId;
  day: number;
  severity: number;
  text: string;
}

export type ActionType =
  | 'sleep'
  | 'eat_home'
  | 'eat_packed'
  | 'eat_out'
  | 'groceries'
  | 'work'
  | 'overtime'
  | 'job_hunt'
  | 'school'
  | 'study'
  | 'socialize'
  | 'date'
  | 'romance_hunt'
  | 'family_time'
  | 'gym'
  | 'park'
  | 'shop'
  | 'hygiene'
  | 'relax'
  | 'hospital'
  | 'bank'
  | 'idle'
  | 'childcare'
  | 'funeral';

/** One completed step of a person's day, kept for the tracking timeline. */
export interface ActivityRecord {
  /** Absolute simulated minute the activity started. */
  min: number;
  type: ActionType;
  /** Building it happened in, -1 if unknown. */
  locationId: number;
  partner: NPCId;
}

export interface CurrentAction {
  type: ActionType;
  locationId: number;
  /** Other NPC this action is with, -1 when solo. */
  partner: NPCId;
  startMin: number;
  endMin: number;
}

export interface TravelState {
  fromId: number;
  toId: number;
  startMin: number;
  arriveMin: number;
  /** 0 = walking, 1 = transit, 2 = car. */
  mode: 0 | 1 | 2;
}

export interface Appearance {
  hair: number;
  hairStyle: number;
  skin: number;
  build: number;
  height: number;
  /** Colour index used by the map renderer. */
  tint: number;
}

export interface Family {
  parents: NPCId[];
  children: NPCId[];
  siblings: NPCId[];
  partner: NPCId;
  exPartners: NPCId[];
  /** True while the NPC is married to `partner`. */
  married: boolean;
  marriedSinceDay: number;
}

export interface NPC {
  id: NPCId;
  firstName: string;
  lastName: string;
  gender: Gender;
  /** Absolute simulation day of birth (negative for anyone born before day 0). */
  birthDay: number;
  alive: boolean;
  deathDay: number;
  deathCause: string;

  appearance: Appearance;
  p: Personality;
  a: Attributes;
  needs: Needs;
  emo: Emotions;
  skills: Skills;
  education: EducationLevel;

  /** Cash on hand. */
  money: number;
  /** Bank account balance. */
  bank: number;
  debt: number;
  /** Rolling monthly figures, refreshed at month end. */
  monthIncome: number;
  monthSpend: number;
  /** Meals stocked at home - buying groceries is what refills this. */
  pantry: number;

  jobId: number;
  employerId: number;
  careerLevel: number;
  /** Current gross monthly pay (or pension once retired). */
  salary: number;
  /** 0..100 - drives promotions and firings. */
  performance: number;
  jobSinceDay: number;
  unemployedSinceDay: number;
  /** Pending applications: company ids. */
  applications: number[];
  applicationDay: number;
  retired: boolean;

  homeId: number;
  /** Guards against repeated evictions in quick succession. */
  lastEvictionDay: number;
  /** Owning a car changes how this NPC gets around the city. */
  ownsCar: boolean;
  /** Day the current illness started, or -1 when healthy. */
  illSinceDay: number;
  ownedBuildings: number[];
  locId: number;
  travel: TravelState | null;
  action: CurrentAction;

  family: Family;
  /** Ids of every NPC this one has a relationship entry with. */
  links: NPCId[];
  pregnantUntilDay: number;
  pregnantBy: NPCId;

  memories: Memory[];
  goals: Goal[];
  secrets: Secret[];
  /** Ids of rumours/information items this NPC has heard. */
  known: Set<number>;

  hobbies: string[];
  /** Character archetype id - shapes traits and reads as a personality. */
  archetype: string;
  /** 0..100 - how the city as a whole sees this NPC. */
  reputation: number;
  /** 0..100 - slow-moving average of emotional state. */
  lifeSatisfaction: number;
  /** Personal daily rhythm, derived from personality and life stage. */
  wakeHour: number;
  sleepHour: number;
  /** Absolute sim minute when this NPC next re-evaluates. */
  nextDecisionMin: number;
  /** Absolute sim minute of the last lazy needs/emotion update. */
  lastUpdateMin: number;
  /** Recent activities, newest last - the visible day of this person. */
  activityLog: ActivityRecord[];
  /** Detailed simulation flag (tracked/selected/on-screen NPCs). */
  detailed: boolean;
  /** Cached for cheap UI/stat access, refreshed daily. */
  ageYears: number;
  lifeStage: LifeStage;
}
