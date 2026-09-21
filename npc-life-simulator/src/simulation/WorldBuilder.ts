import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import { DAYS_PER_YEAR, MINUTES_PER_DAY, isWeekend } from '../time/calendar';
import { DEFAULT_SPEED } from '../time/SimulationClock';
import { World } from '../world/World';
import { CITY_NAMES } from '../world/worldNames';
import { RESIDENTIAL_TYPES, type Building, type BuildingType } from '../world/types';
import { createNPC, fullName } from '../npc/NPCFactory';
import { remember } from '../npc/Memory';
import type { NPC } from '../npc/types';
import { PROFESSION_BY_ID, salaryFor } from '../economy/professions';
import type { Company } from '../economy/types';
import { buildPositions, companyName } from './systems/EconomySystem';
import { matchScore } from './systems/WorkSystem';
import { compatibility } from './systems/SocialSystem';
import type { SimulationEngine } from './SimulationEngine';

export interface WorldConfig {
  population: number;
  /** Shifts the starting year; 0 means the world begins in 2025. */
  startYearOffset: number;
  /** Simulated days to run before handing the city to the player. */
  warmUpDays?: number;
}

/** Buildings that host a business. */
const BUSINESS_TYPES: BuildingType[] = [
  'office', 'factory', 'workshop', 'shop', 'supermarket', 'restaurant', 'bar', 'cafe',
  'gym', 'school', 'university', 'hospital', 'police', 'fire', 'bank', 'mall',
  'station', 'sports', 'library', 'townhall',
];

type Household =
  | 'family'
  | 'couple'
  | 'single'
  | 'single_parent'
  | 'senior_couple'
  | 'senior_single'
  | 'shared'
  | 'young_single';

const HOUSEHOLD_WEIGHTS: [Household, number][] = [
  ['family', 26],
  ['couple', 15],
  ['single', 16],
  ['young_single', 12],
  ['single_parent', 7],
  ['senior_couple', 9],
  ['senior_single', 8],
  ['shared', 7],
];

export function buildWorld(engine: SimulationEngine, config: WorldConfig): void {
  const rng = engine.rng;
  const cityName = engine.config.cityName || rng.pick(CITY_NAMES);
  engine.config.cityName = cityName;

  engine.world = World.generate(rng, cityName, { targetPopulation: config.population });
  engine.clock.totalMinutes = config.startYearOffset * DAYS_PER_YEAR * MINUTES_PER_DAY + 7 * 60;
  engine.world.weather.update(engine.clock.totalMinutes, engine.clock.day, rng);

  const day = engine.clock.day;
  // Population first: the job market is then sized against the actual workforce.
  createPopulation(engine, config.population, day);
  createCompanies(engine);
  calibrateJobMarket(engine);
  assignJobs(engine, day);
  seedRelationships(engine, day);
  seedHistory(engine, day);
  scheduleEveryone(engine);
  warmUp(engine, config.warmUpDays ?? 3);
}

/**
 * Runs the first days of the city before the player ever sees it. Without this
 * everybody starts idle at home at the same minute, and the opening screen
 * looks like a standing start rather than a Tuesday morning.
 */
function warmUp(engine: SimulationEngine, days: number): void {
  if (days <= 0) return;
  engine.clock.setSpeed(2000);

  // Bulk of the warm-up runs aggregated - it only has to build up history.
  const coarseTarget = engine.clock.totalMinutes + days * MINUTES_PER_DAY;
  engine.turbo = true;
  while (engine.clock.totalMinutes < coarseTarget) engine.tick();

  // Hand the city over on a working morning: on a Saturday most people are at
  // home and the first impression would be a sleepy town, not a living one.
  const handoverHour = 10.5;
  let handoverDay = engine.clock.day;
  const atOrAfterHandover = (engine.clock.totalMinutes % MINUTES_PER_DAY) / 60 >= handoverHour;
  if (atOrAfterHandover) handoverDay++;
  while (isWeekend(handoverDay)) handoverDay++;
  const handover = handoverDay * MINUTES_PER_DAY + handoverHour * 60;

  // Everything but the final ninety minutes stays aggregated.
  while (engine.clock.totalMinutes < handover - 90) engine.tick();
  engine.turbo = false;

  // The last stretch runs at full fidelity, so every person is in a properly
  // chosen activity rather than mid-way through an aggregated block.
  engine.clock.setSpeed(100);
  while (engine.clock.totalMinutes < handover) engine.tick();

  engine.clock.setSpeed(DEFAULT_SPEED);
  engine.rebuildAlive();
  engine.stats.recompute(engine);
}

/**
 * Gives the city a past: broken-off relationships, old grudges and shared
 * memories, so day one already has history behind it.
 */
function seedHistory(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;
  const living = engine.aliveIds;

  // Former couples who have since moved on. Sorting by age before pairing
  // keeps the matches plausible instead of discarding most of them.
  const singles = living
    .map((id) => engine.npcs[id])
    .filter((n) => n.ageYears >= 22 && n.ageYears <= 72 && n.family.partner < 0)
    .sort((a, b) => a.ageYears - b.ageYears);
  const exCount = Math.floor(singles.length * 0.62);
  for (let i = 0; i + 1 < exCount; i += 2) {
    const a = singles[i];
    const b = singles[i + 1];
    if (Math.abs(a.ageYears - b.ageYears) > 14) continue;
    if (a.gender === b.gender && !rng.chance(0.08)) continue;
    const rel = engine.rels.ensure(a, b, day);
    const endedDaysAgo = rng.int(400, 4000);
    rel.type = 'ex';
    rel.romantic = false;
    rel.sinceDay = day - endedDaysAgo;
    rel.closeness = rng.int(5, 30);
    rel.sympathy = rng.int(10, 55);
    rel.trust = rng.int(10, 45);
    rel.conflict = rng.int(5, 60);
    rel.lastInteractionDay = day - rng.int(30, 600);
    a.family.exPartners.push(b.id);
    b.family.exPartners.push(a.id);
    remember(a, rel.sinceDay, 'breakup', `Trennung von ${fullName(b)}`, -70, b.id);
    remember(b, rel.sinceDay, 'breakup', `Trennung von ${fullName(a)}`, -70, a.id);
  }

  // Old grudges between people who already know each other.
  for (const id of living) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 16 || !npc.links.length) continue;
    if (!rng.chance(0.12)) continue;
    const otherId = npc.links[rng.int(0, npc.links.length - 1)];
    const rel = engine.rels.get(npc.id, otherId);
    const other = engine.npcs[otherId];
    if (!rel || !other || rel.familyTie !== 'none' || rel.romantic) continue;
    rel.conflict = rng.int(45, 88);
    rel.sympathy = Math.min(rel.sympathy, rng.int(5, 35));
    rel.trust = Math.min(rel.trust, rng.int(5, 30));
    engine.rels.refreshType(rel);
    if (rng.chance(0.5)) {
      const when = day - rng.int(20, 1500);
      remember(npc, when, 'fight', `Streit mit ${fullName(other)}`, -50, otherId);
      remember(other, when, 'fight', `Streit mit ${fullName(npc)}`, -50, npc.id);
    }
  }

  // Shared history for the closest friendships.
  for (const rel of engine.rels.all()) {
    if (rel.closeness < 60 || rel.familyTie !== 'none') continue;
    if (!rng.chance(0.35)) continue;
    const a = engine.npcs[rel.a];
    const b = engine.npcs[rel.b];
    if (!a?.alive || !b?.alive) continue;
    const when = day - rng.int(200, 5000);
    remember(a, when, 'first_meeting', `${fullName(b)} kennengelernt`, 30, b.id, 48);
    remember(b, when, 'first_meeting', `${fullName(a)} kennengelernt`, 30, a.id, 48);
  }
}

// ------------------------------------------------------------------ companies

function createCompanies(engine: SimulationEngine): void {
  const rng = engine.rng;
  for (const b of engine.world.buildings) {
    if (!BUSINESS_TYPES.includes(b.type)) continue;
    const scale = scaleFor(b, rng);
    const c: Company = {
      id: engine.companies.length,
      name: b.type === 'school' || b.type === 'university' || b.type === 'hospital' ||
        b.type === 'police' || b.type === 'fire' || b.type === 'townhall' || b.type === 'station'
        ? b.name
        : companyName(engine, b.type),
      buildingId: b.id,
      industry: b.type,
      founderId: -1,
      ownerId: -1,
      employees: [],
      positions: buildPositions(engine, b.type, scale),
      balance: Math.round(rng.float(8000, 160000) * scale),
      revenue: 0,
      costs: 0,
      lastProfit: 0,
      reputation: rng.int(30, 80),
      quality: clamp(b.quality + rng.int(-12, 12), 5, 100),
      priceLevel: rng.float(0.85, 1.2),
      foundedDay: -rng.int(200, 9000),
      bankrupt: false,
      lossStreak: 0,
      growth: rng.float(-5, 12),
    };
    engine.companies.push(c);
    b.companyId = c.id;
    // Keep the building's displayed name in sync with the business in it.
    if (c.name !== b.name && b.type !== 'park') b.name = c.name;
  }
}

/**
 * Scales every company's headcount so the city offers slightly more jobs than
 * it has workers. Without this the number of positions would follow the map
 * size rather than the population, and unemployment would collapse to zero.
 */
function calibrateJobMarket(engine: SimulationEngine): void {
  let workers = 0;
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears >= 18 && npc.ageYears < 67) workers++;
  }
  let slots = 0;
  for (const c of engine.companies) for (const p of c.positions) slots += p.max;
  if (slots === 0) return;
  // Slightly fewer positions than workers, so unemployment stays real.
  const factor = (workers * 0.94) / slots;
  for (const c of engine.companies) {
    for (const p of c.positions) p.max = Math.round(p.max * factor);
    // Keep businesses that would round to zero alive with a single position.
    c.positions = c.positions.filter((p) => p.max > 0);
    if (!c.positions.length) {
      const profs = c.industry;
      void profs;
      c.positions = [{ prof: 'verkaeufer', max: 1, filled: 0 }];
    }
  }
}

function scaleFor(b: Building, rng: RNG): number {
  switch (b.type) {
    case 'factory':
      return rng.float(0.8, 1.8);
    case 'office':
    case 'mall':
    case 'hospital':
    case 'university':
      return rng.float(0.6, 1.4);
    case 'school':
    case 'supermarket':
      return rng.float(0.5, 1.0);
    default:
      return rng.float(0.3, 0.8);
  }
}

// ----------------------------------------------------------------- population

function createPopulation(engine: SimulationEngine, target: number, day: number): void {
  const rng = engine.rng;
  const homes = engine.world.buildings.filter((b) => RESIDENTIAL_TYPES.includes(b.type));
  rng.shuffle(homes);
  let homeIdx = 0;

  const nextHome = (needed: number): Building | null => {
    for (let i = 0; i < homes.length; i++) {
      const b = homes[(homeIdx + i) % homes.length];
      if (b.capacity - b.residents.length >= needed) {
        homeIdx = (homeIdx + i + 1) % homes.length;
        return b;
      }
    }
    return null;
  };

  const totalWeight = HOUSEHOLD_WEIGHTS.reduce((a, h) => a + h[1], 0);
  const pickHousehold = (): Household => {
    let r = rng.next() * totalWeight;
    for (const [h, w] of HOUSEHOLD_WEIGHTS) {
      if (r < w) return h;
      r -= w;
    }
    return 'single';
  };

  while (engine.npcs.length < target) {
    const kind = pickHousehold();
    const members: NPC[] = [];
    const lastName = undefined;

    const spawn = (age: number, gender?: 'm' | 'w', ln?: string, parents?: number[], inherit?: NPC[]) => {
      const npc = createNPC(rng, {
        id: engine.npcs.length,
        day,
        age,
        gender,
        lastName: ln,
        parents,
        inheritFrom: inherit ? (inherit.map((p) => p.p) as never) : undefined,
      });
      engine.npcs.push(npc);
      members.push(npc);
      return npc;
    };

    switch (kind) {
      case 'family': {
        const parentAge = rng.int(27, 52);
        const a = spawn(parentAge, rng.chance(0.5) ? 'm' : 'w', lastName);
        const b = spawn(clamp(parentAge + rng.int(-5, 5), 20, 60), a.gender === 'm' ? 'w' : 'm', a.lastName);
        pairUp(engine, a, b, day, true);
        const kids = rng.int(1, 3);
        for (let i = 0; i < kids; i++) {
          const maxKidAge = Math.max(0, Math.min(parentAge - 20, 22));
          const child = spawn(rng.int(0, maxKidAge), undefined, a.lastName, [a.id, b.id], [a, b]);
          a.family.children.push(child.id);
          b.family.children.push(child.id);
        }
        break;
      }
      case 'couple': {
        const age = rng.int(22, 58);
        const a = spawn(age, rng.chance(0.5) ? 'm' : 'w');
        const b = spawn(clamp(age + rng.int(-6, 6), 19, 65), a.gender === 'm' ? 'w' : 'm', a.lastName);
        pairUp(engine, a, b, day, rng.chance(0.55));
        break;
      }
      case 'single_parent': {
        const parentAge = rng.int(26, 50);
        const p = spawn(parentAge, rng.chance(0.72) ? 'w' : 'm');
        const kids = rng.int(1, 2);
        for (let i = 0; i < kids; i++) {
          const child = spawn(rng.int(0, Math.max(1, Math.min(parentAge - 20, 20))), undefined, p.lastName, [p.id], [p]);
          p.family.children.push(child.id);
        }
        break;
      }
      case 'senior_couple': {
        const age = rng.int(64, 88);
        const a = spawn(age, rng.chance(0.5) ? 'm' : 'w');
        const b = spawn(clamp(age + rng.int(-6, 6), 60, 95), a.gender === 'm' ? 'w' : 'm', a.lastName);
        pairUp(engine, a, b, day, true);
        break;
      }
      case 'senior_single':
        spawn(rng.int(65, 94));
        break;
      case 'young_single':
        spawn(rng.int(18, 29));
        break;
      case 'shared': {
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i++) spawn(rng.int(19, 32));
        break;
      }
      default:
        spawn(rng.int(24, 62));
    }

    const home = nextHome(members.length) ?? nextHome(1);
    for (const m of members) {
      if (home) {
        m.homeId = home.id;
        m.locId = home.id;
        home.residents.push(m.id);
      } else {
        m.locId = engine.world.buildings[0].id;
      }
      m.lastUpdateMin = engine.clock.totalMinutes;
      remember(m, m.birthDay, 'birth', 'Geboren', 100, -1);
    }
  }

  // Family relationship edges.
  for (const npc of engine.npcs) {
    for (const childId of npc.family.children) {
      const child = engine.npcs[childId];
      if (child) engine.linkFamily(npc, child, 'parent', day);
    }
    for (let i = 0; i < npc.family.children.length; i++) {
      for (let j = i + 1; j < npc.family.children.length; j++) {
        const a = engine.npcs[npc.family.children[i]];
        const b = engine.npcs[npc.family.children[j]];
        if (!a || !b) continue;
        if (!a.family.siblings.includes(b.id)) a.family.siblings.push(b.id);
        if (!b.family.siblings.includes(a.id)) b.family.siblings.push(a.id);
        engine.linkFamily(a, b, 'sibling', day);
      }
    }
  }
  engine.rebuildAlive();
}

function pairUp(engine: SimulationEngine, a: NPC, b: NPC, day: number, married: boolean): void {
  a.family.partner = b.id;
  b.family.partner = a.id;
  const rel = engine.rels.ensure(a, b, day);
  rel.romantic = true;
  rel.type = married ? 'married' : 'dating';
  rel.trust = engine.rng.int(55, 92);
  rel.sympathy = engine.rng.int(55, 95);
  rel.closeness = engine.rng.int(58, 95);
  rel.loyalty = engine.rng.int(50, 95);
  rel.respect = engine.rng.int(50, 92);
  rel.attractionAB = engine.rng.int(45, 90);
  rel.attractionBA = engine.rng.int(45, 90);
  rel.opinionAB = engine.rng.int(30, 80);
  rel.opinionBA = engine.rng.int(30, 80);
  const years = Math.min(a.ageYears, b.ageYears) - 20;
  rel.sinceDay = day - Math.max(60, engine.rng.int(200, Math.max(400, years * DAYS_PER_YEAR)));
  if (married) {
    a.family.married = true;
    b.family.married = true;
    a.family.marriedSinceDay = rel.sinceDay;
    b.family.marriedSinceDay = rel.sinceDay;
    remember(a, rel.sinceDay, 'wedding', `Hochzeit mit ${fullName(b)}`, 95, b.id);
    remember(b, rel.sinceDay, 'wedding', `Hochzeit mit ${fullName(a)}`, 95, a.id);
  }
  a.emo.love = engine.rng.int(35, 75);
  b.emo.love = engine.rng.int(35, 75);
}

// ----------------------------------------------------------------------- jobs

function assignJobs(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;
  const workers = engine.aliveIds
    .map((id) => engine.npcs[id])
    .filter((n) => n.ageYears >= 18 && n.ageYears < 67);
  rng.shuffle(workers);

  // Flat list of slots so the matching pass is a simple scan.
  interface Slot {
    companyId: number;
    prof: string;
  }
  const slots: Slot[] = [];
  for (const c of engine.companies) {
    for (const pos of c.positions) {
      for (let i = 0; i < pos.max; i++) slots.push({ companyId: c.id, prof: pos.prof });
    }
  }
  rng.shuffle(slots);

  let slotIdx = 0;
  for (const npc of workers) {
    // A realistic share of the population starts out without work.
    if (rng.chance(0.06)) {
      npc.unemployedSinceDay = day - rng.int(10, 400);
      continue;
    }
    let bestSlot = -1;
    let bestScore = 12;
    const looks = Math.min(18, slots.length);
    for (let i = 0; i < looks; i++) {
      const idx = (slotIdx + i) % slots.length;
      const slot = slots[idx];
      if (!slot) continue;
      const prof = PROFESSION_BY_ID.get(slot.prof);
      if (!prof) continue;
      const c = engine.companies[slot.companyId];
      const distance = engine.world.distance(npc.homeId >= 0 ? npc.homeId : 0, c.buildingId);
      const s = matchScore(npc, prof) - (distance / 1000) * 6 + rng.float(0, 20);
      if (s > bestScore) {
        bestScore = s;
        bestSlot = idx;
      }
    }
    if (bestSlot < 0) {
      npc.unemployedSinceDay = day - rng.int(5, 200);
      slotIdx = (slotIdx + 7) % Math.max(1, slots.length);
      continue;
    }
    const slot = slots[bestSlot];
    slots.splice(bestSlot, 1);
    const prof = PROFESSION_BY_ID.get(slot.prof)!;
    const company = engine.companies[slot.companyId];
    const pos = company.positions.find((p) => p.prof === prof.id)!;
    pos.filled++;
    company.employees.push(npc.id);

    // Career level reflects age and ability, so the city starts with history.
    const experience = npc.ageYears - 18;
    const level = clamp(
      Math.floor(experience / 7 + (npc.a.discipline - 50) / 45 + rng.float(-0.6, 0.9)),
      0,
      5,
    );
    npc.jobId = engine.professionIndex(prof.id);
    npc.employerId = company.id;
    npc.careerLevel = level;
    npc.salary = salaryFor(prof, level, engine.market.wageFactor);
    npc.jobSinceDay = day - rng.int(30, Math.max(60, experience * 200));
    npc.unemployedSinceDay = -1;
    remember(npc, npc.jobSinceDay, 'hired', `Stelle als ${prof.label} bei ${company.name}`, 40, -1, 45);
  }

  // Car ownership, seeded from means and age so the streets are not empty.
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 18 || npc.ageYears > 84) continue;
    const wealth = npc.bank + npc.money;
    const likelihood =
      0.12 + Math.min(0.5, wealth / 60000) + Math.min(0.2, npc.salary / 20000) +
      (npc.family.children.length ? 0.12 : 0);
    if (rng.chance(likelihood)) npc.ownsCar = true;
  }

  // Retirees.
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears >= 67) {
      npc.retired = true;
      npc.salary = Math.round(clamp(1100 + npc.a.discipline * 14 + rng.float(0, 700), 900, 3200));
    }
  }
}

// -------------------------------------------------------------- social fabric

function seedRelationships(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;

  // Colleagues.
  for (const c of engine.companies) {
    const staff = c.employees;
    for (let i = 0; i < staff.length; i++) {
      const links = Math.min(staff.length - 1, rng.int(1, 3));
      for (let k = 0; k < links; k++) {
        const j = rng.int(0, staff.length - 1);
        if (i === j) continue;
        const a = engine.npcs[staff[i]];
        const b = engine.npcs[staff[j]];
        if (!a || !b || engine.rels.has(a.id, b.id)) continue;
        const rel = engine.rels.ensure(a, b, day);
        const compat = compatibility(a, b);
        rel.type = 'colleague';
        rel.closeness = rng.int(10, 35) + compat * 20;
        rel.sympathy = rng.int(25, 55) + compat * 25;
        rel.trust = rng.int(20, 55);
        rel.respect = rng.int(25, 65);
        rel.interactions = rng.int(3, 40);
        rel.lastInteractionDay = day - rng.int(0, 12);
        engine.rels.refreshType(rel);
      }
    }
  }

  // Neighbours.
  for (const b of engine.world.buildings) {
    if (b.residents.length < 2) continue;
    for (let i = 0; i < b.residents.length; i++) {
      for (let j = i + 1; j < b.residents.length; j++) {
        if (!rng.chance(0.35)) continue;
        const a = engine.npcs[b.residents[i]];
        const c = engine.npcs[b.residents[j]];
        if (!a || !c || engine.rels.has(a.id, c.id)) continue;
        const rel = engine.rels.ensure(a, c, day);
        rel.closeness = rng.int(8, 30);
        rel.sympathy = rng.int(25, 60);
        rel.interactions = rng.int(1, 15);
        engine.rels.refreshType(rel);
      }
    }
  }

  // Friendships across the city, biased by district and compatibility.
  const living = engine.aliveIds;
  for (const id of living) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 8) continue;
    const wanted = clamp(Math.round(1 + npc.p.extraversion / 34 + rng.float(-0.5, 1.5)), 0, 6);
    let made = 0;
    for (let attempt = 0; attempt < wanted * 4 && made < wanted; attempt++) {
      const otherId = living[rng.int(0, living.length - 1)];
      if (otherId === id) continue;
      const other = engine.npcs[otherId];
      if (!other || Math.abs(other.ageYears - npc.ageYears) > 14) continue;
      if (engine.rels.has(id, otherId)) continue;
      const compat = compatibility(npc, other);
      if (compat < 0.45 && !rng.chance(0.2)) continue;
      const rel = engine.rels.ensure(npc, other, day);
      rel.closeness = clamp(rng.int(25, 60) + compat * 30, 0, 100);
      rel.sympathy = clamp(rng.int(35, 70) + compat * 25, 0, 100);
      rel.trust = rng.int(30, 75);
      rel.respect = rng.int(30, 75);
      rel.interactions = rng.int(5, 60);
      rel.lastInteractionDay = day - rng.int(0, 20);
      rel.sinceDay = day - rng.int(100, 4000);
      engine.rels.refreshType(rel);
      made++;
    }
  }
}

function scheduleEveryone(engine: SimulationEngine): void {
  const rng = engine.rng;
  const now = engine.clock.totalMinutes;
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    npc.lastUpdateMin = now;
    npc.action = { type: 'idle', locationId: npc.locId, partner: -1, startMin: now, endMin: now };
    const at = now + rng.int(0, 45);
    npc.nextDecisionMin = at;
    engine.scheduler.schedule(id, at);
    const b = engine.world.buildings[npc.locId];
    if (b) {
      b.present.push(id);
      b.occupants++;
    }
  }
}
