import { RNG } from '../core/rng';
import { clamp, clamp100 } from '../core/math';
import { DAYS_PER_YEAR } from '../time/calendar';
import { FEMALE_NAMES, HOBBIES, LAST_NAMES, MALE_NAMES } from './names';
import { createNeeds } from './Needs';
import { createEmotions } from './Emotions';
import { generateGoals } from './Goals';
import { ageOf, stageForAge } from './lifecycle';
import {
  SKILL_IDS,
  type Attributes,
  type EducationLevel,
  type Gender,
  type NPC,
  type Personality,
  type Skills,
} from './types';

export interface SpawnOptions {
  id: number;
  day: number;
  age?: number;
  gender?: Gender;
  lastName?: string;
  firstName?: string;
  parents?: number[];
  /** Inherit trait tendencies from these parents' personalities. */
  inheritFrom?: [Personality, Personality] | [Personality];
}

function rollPersonality(rng: RNG, inherit?: Personality[]): Personality {
  const roll = (key: keyof Personality): number => {
    if (!inherit || inherit.length === 0) return rng.trait(50, 19);
    // 45% heredity, 55% individual variation - siblings differ but resemble.
    const avg = inherit.reduce((a, p) => a + p[key], 0) / inherit.length;
    return clamp(Math.round(avg * 0.45 + rng.trait(50, 19) * 0.55), 1, 99);
  };
  return {
    openness: roll('openness'),
    extraversion: roll('extraversion'),
    agreeableness: roll('agreeableness'),
    conscientiousness: roll('conscientiousness'),
    stability: roll('stability'),
    ambition: roll('ambition'),
    impulsivity: roll('impulsivity'),
    loyalty: roll('loyalty'),
    risk: roll('risk'),
    empathy: roll('empathy'),
  };
}

function rollAttributes(rng: RNG, p: Personality): Attributes {
  // Attributes correlate with personality so characters read as coherent.
  return {
    intelligence: rng.trait(50, 17),
    confidence: clamp100(Math.round(rng.trait(50, 16) * 0.6 + p.extraversion * 0.25 + p.stability * 0.15)),
    discipline: clamp100(Math.round(rng.trait(50, 15) * 0.45 + p.conscientiousness * 0.55)),
    aggression: clamp100(Math.round(rng.trait(45, 18) * 0.6 + (100 - p.agreeableness) * 0.4)),
    social: clamp100(Math.round(rng.trait(50, 15) * 0.5 + p.extraversion * 0.35 + p.empathy * 0.15)),
    humor: rng.trait(50, 18),
    attractiveness: rng.trait(50, 16),
    health: rng.trait(72, 12),
  };
}

function rollSkills(rng: RNG, p: Personality, a: Attributes, age: number, education: number): Skills {
  const skills = {} as Skills;
  // Skill ceiling grows with age and education; talent spreads it around.
  const ceiling = clamp(12 + age * 1.35 + education * 7, 10, 92);
  for (const id of SKILL_IDS) {
    let v = rng.float(0, ceiling * rng.float(0.25, 1));
    if (id === 'fitness') v = v * 0.6 + a.health * 0.35;
    if (id === 'social') v = v * 0.6 + a.social * 0.35;
    if (id === 'tech') v = v * 0.7 + a.intelligence * 0.25;
    if (id === 'business') v = v * 0.7 + p.ambition * 0.2;
    skills[id] = clamp100(Math.round(v));
  }
  return skills;
}

function rollEducation(rng: RNG, intelligence: number, discipline: number, age: number): EducationLevel {
  if (age < 6) return 0;
  if (age < 16) return 0;
  if (age < 19) return 1;
  const score = intelligence * 0.55 + discipline * 0.3 + rng.float(0, 45);
  if (age < 22) return score > 70 ? 2 : 1;
  if (score > 118) return 4;
  if (score > 92) return 3;
  if (score > 62) return 2;
  if (score > 34) return 1;
  return 0;
}

/** Daily rhythm: night owls exist, and so do early risers. */
function rollRhythm(rng: RNG, p: Personality, age: number): { wake: number; sleep: number } {
  const owl = (p.openness + p.extraversion + p.impulsivity) / 3;
  let wake = 7 - (p.conscientiousness - 50) / 42 + (owl - 50) / 30;
  if (age < 14) wake -= 0.4;
  if (age > 64) wake -= 0.8;
  wake = clamp(wake + rng.gauss(0, 0.55), 4.5, 11);
  let sleep = 22.5 + (owl - 50) / 22 - (p.conscientiousness - 50) / 45;
  if (age > 64) sleep -= 1;
  sleep = clamp(sleep + rng.gauss(0, 0.6), 20, 27);
  if (sleep - wake < 12) sleep = wake + 12;
  return { wake, sleep };
}

export function createNPC(rng: RNG, o: SpawnOptions): NPC {
  const age = o.age ?? rng.int(0, 88);
  const gender: Gender = o.gender ?? (rng.chance(0.5) ? 'm' : 'w');
  const p = rollPersonality(rng, o.inheritFrom as Personality[] | undefined);
  const a = rollAttributes(rng, p);
  const education = rollEducation(rng, a.intelligence, a.discipline, age);
  const skills = rollSkills(rng, p, a, age, education);
  const rhythm = rollRhythm(rng, p, age);
  const rand = (min: number, max: number) => rng.float(min, max);

  // Birthday spread across the year so ageing events do not all fire at once.
  const birthDay = o.day - age * DAYS_PER_YEAR - rng.int(0, DAYS_PER_YEAR - 1);

  const hobbyCount = clamp(1 + Math.round(p.openness / 35 + rng.float(0, 1.6)), 1, 4);
  const hobbies: string[] = [];
  for (let i = 0; i < hobbyCount; i++) {
    const h = rng.pick(HOBBIES);
    if (!hobbies.includes(h)) hobbies.push(h);
  }

  const npc: NPC = {
    id: o.id,
    firstName: o.firstName ?? (gender === 'm' ? rng.pick(MALE_NAMES) : rng.pick(FEMALE_NAMES)),
    lastName: o.lastName ?? rng.pick(LAST_NAMES),
    gender,
    birthDay,
    alive: true,
    deathDay: -1,
    deathCause: '',
    appearance: {
      hair: rng.int(0, 7),
      hairStyle: rng.int(0, 5),
      skin: rng.int(0, 5),
      build: rng.int(0, 4),
      height: Math.round(rng.gauss(gender === 'm' ? 178 : 166, 7)),
      tint: rng.int(0, 11),
    },
    p,
    a,
    needs: createNeeds(rand),
    emo: createEmotions(rand),
    skills,
    education,
    money: 0,
    bank: 0,
    debt: 0,
    monthIncome: 0,
    monthSpend: 0,
    pantry: rng.int(2, 14),
    jobId: -1,
    employerId: -1,
    careerLevel: 0,
    salary: 0,
    performance: clamp100(Math.round(45 + a.discipline * 0.35 + rng.gauss(0, 9))),
    jobSinceDay: -1,
    unemployedSinceDay: o.day,
    applications: [],
    applicationDay: -1,
    retired: false,
    homeId: -1,
    lastEvictionDay: -9999,
    ownedBuildings: [],
    locId: -1,
    travel: null,
    action: { type: 'idle', locationId: -1, partner: -1, startMin: 0, endMin: 0 },
    family: {
      parents: o.parents ? [...o.parents] : [],
      children: [],
      siblings: [],
      partner: -1,
      exPartners: [],
      married: false,
      marriedSinceDay: -1,
    },
    links: [],
    pregnantUntilDay: -1,
    pregnantBy: -1,
    memories: [],
    goals: [],
    secrets: [],
    known: new Set<number>(),
    hobbies,
    reputation: clamp100(Math.round(45 + a.social * 0.15 + rng.gauss(0, 10))),
    lifeSatisfaction: clamp100(Math.round(rng.gauss(58, 14))),
    wakeHour: rhythm.wake,
    sleepHour: rhythm.sleep,
    nextDecisionMin: 0,
    lastUpdateMin: 0,
    detailed: false,
    ageYears: age,
    lifeStage: stageForAge(age),
  };

  // Starting wealth scales with age, education and ambition.
  const wealthBase = age < 18 ? rng.float(0, 220) : rng.float(300, 2600) * (1 + education * 0.55);
  const experience = clamp(age - 20, 0, 45);
  npc.bank = Math.round(wealthBase + experience * rng.float(180, 1400) * (0.5 + p.conscientiousness / 120));
  npc.money = Math.round(rng.float(20, 260));
  if (age >= 22 && rng.chance(0.22)) npc.debt = Math.round(rng.float(500, 28000));

  npc.goals = generateGoals(npc, age, o.day, rng);
  return npc;
}

export const fullName = (npc: NPC): string => `${npc.firstName} ${npc.lastName}`;

export function refreshAge(npc: NPC, day: number): void {
  npc.ageYears = ageOf(npc, day);
  npc.lifeStage = stageForAge(npc.ageYears);
}
