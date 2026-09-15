import { clamp100 } from '../../core/math';
import { applyEmotion } from '../../npc/Emotions';
import { remember } from '../../npc/Memory';
import { setGoalProgress, goalPriority } from '../../npc/Goals';
import { fullName } from '../../npc/NPCFactory';
import type { NPC } from '../../npc/types';
import { RESIDENTIAL_TYPES, type Building } from '../../world/types';
import type { SimulationEngine } from '../SimulationEngine';

/** How much rent an NPC can reasonably carry per month. */
function rentBudget(npc: NPC): number {
  const income = npc.salary > 0 ? npc.salary : 900;
  return income * 0.42 + Math.max(0, npc.bank) * 0.004;
}

export function homeScore(engine: SimulationEngine, npc: NPC, b: Building, budget: number): number {
  const district = engine.world.districts[b.districtId];
  let s = b.quality * 0.5 + district.prestige * 0.35;
  // Comfort-seekers pay up, thrifty people do not.
  const ratio = b.rent / Math.max(200, budget);
  s -= Math.max(0, ratio - 1) * 90;
  if (b.rent > budget * 1.35) s -= 60;
  // Proximity to work matters a lot in daily life.
  if (npc.employerId >= 0) {
    const work = engine.companies[npc.employerId];
    if (work) s -= (engine.world.distance(b.id, work.buildingId) / 1000) * 9;
  }
  // Family stays close to family.
  for (const pId of npc.family.parents) {
    const p = engine.npcs[pId];
    if (p?.alive && p.homeId >= 0) s -= (engine.world.distance(b.id, p.homeId) / 1000) * 2.5;
  }
  if (b.type === 'house' && npc.family.children.length > 0) s += 12;
  return s;
}

/** Finds and assigns the best available home this NPC can afford. */
export function findHome(engine: SimulationEngine, npc: NPC, announce = true): boolean {
  const budget = rentBudget(npc);
  const rng = engine.rng;
  let best: Building | null = null;
  let bestScore = -Infinity;

  // Sample the market rather than scanning every building.
  const candidates = engine.vacantHomes;
  if (!candidates.length) return false;
  const looks = Math.min(candidates.length, 26);
  for (let i = 0; i < looks; i++) {
    const b = engine.world.buildings[candidates[rng.int(0, candidates.length - 1)]];
    if (!b || b.residents.length >= b.capacity) continue;
    const s = homeScore(engine, npc, b, budget) + rng.float(0, 12);
    if (s > bestScore) {
      bestScore = s;
      best = b;
    }
  }
  if (!best) return false;
  moveTo(engine, npc, best.id, announce);
  return true;
}

export function moveTo(engine: SimulationEngine, npc: NPC, buildingId: number, announce = true): void {
  const old = npc.homeId;
  if (old === buildingId) return;
  if (old >= 0) {
    const prev = engine.world.buildings[old];
    const i = prev.residents.indexOf(npc.id);
    if (i >= 0) prev.residents.splice(i, 1);
  }
  const home = engine.world.buildings[buildingId];
  home.residents.push(npc.id);
  npc.homeId = buildingId;
  if (npc.locId < 0) npc.locId = buildingId;

  applyEmotion(npc, { happiness: 8, calm: 6, stress: -6 });
  npc.needs.comfort = clamp100(npc.needs.comfort + 18);
  npc.needs.safety = clamp100(npc.needs.safety + 22);

  if (announce) {
    const district = engine.world.districts[home.districtId];
    remember(npc, engine.day, 'move', `Umzug nach ${district.name}`, 25, -1);
    engine.emit({
      type: 'move',
      subjects: [npc.id],
      buildingId,
      text: `${fullName(npc)} ist nach ${district.name} gezogen.`,
      narrative: `zog ${fullName(npc)} nach ${district.name}`,
      importance: 34,
    });
    // New neighbours are new acquaintances.
    connectNeighbours(engine, npc, home);
  }
}

export function connectNeighbours(engine: SimulationEngine, npc: NPC, home: Building): void {
  const rng = engine.rng;
  const sample = Math.min(home.residents.length, 4);
  for (let i = 0; i < sample; i++) {
    const otherId = home.residents[rng.int(0, home.residents.length - 1)];
    if (otherId === npc.id) continue;
    const other = engine.npcs[otherId];
    if (!other?.alive) continue;
    const rel = engine.rels.ensure(npc, other, engine.day);
    engine.rels.modify(rel, npc.id, { closeness: 5, sympathy: 4 });
    engine.rels.refreshType(rel);
  }
}

export function leaveHome(engine: SimulationEngine, npc: NPC): void {
  if (npc.homeId < 0) return;
  const home = engine.world.buildings[npc.homeId];
  const i = home.residents.indexOf(npc.id);
  if (i >= 0) home.residents.splice(i, 1);
  npc.homeId = -1;
}

/** Buys a property when the NPC can genuinely afford it. */
function tryBuyHome(engine: SimulationEngine, npc: NPC): void {
  if (npc.homeId < 0 || npc.ownedBuildings.length > 0) return;
  const home = engine.world.buildings[npc.homeId];
  const price = home.price;
  if (price <= 0) return;
  const liquid = npc.bank + npc.money;
  const downPayment = price * 0.25;
  if (liquid < downPayment) return;
  const loan = price - downPayment;
  if (!engine.bank.canBorrow(npc, loan, npc.salary)) return;

  engine.bank.pay(npc, downPayment);
  engine.ledger.addSpend('investment', downPayment);
  engine.bank.borrow(npc, loan);
  npc.bank -= loan; // the loan goes straight to the seller
  npc.ownedBuildings.push(home.id);
  home.ownerId = npc.id;
  setGoalProgress(npc, 'own_home', 100);
  applyEmotion(npc, { happiness: 30, pride: 28, calm: 10, anxiety: 6 });
  remember(npc, engine.day, 'move', `Eigenheim gekauft: ${home.name}`, 70, -1);
  engine.emit({
    type: 'bought_home',
    subjects: [npc.id],
    buildingId: home.id,
    text: `${fullName(npc)} hat ${home.name} gekauft.`,
    narrative: `kaufte ${fullName(npc)} eine eigene Immobilie in ${engine.world.districts[home.districtId].name}`,
    importance: 54,
  });
}

export function runHousingDay(engine: SimulationEngine): void {
  engine.refreshVacancies();
  const rng = engine.rng;

  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 17) continue;

    if (npc.homeId < 0) {
      // Homeless people look every single day - this is urgent for them.
      if (!findHome(engine, npc, true) && rng.chance(0.1)) {
        applyEmotion(npc, { sadness: 6, anxiety: 8, stress: 8 });
      }
      continue;
    }

    // Young adults move out of their parents' place.
    if (npc.ageYears >= 19 && npc.ageYears <= 30 && npc.salary > 1200 && rng.chance(0.004)) {
      const home = engine.world.buildings[npc.homeId];
      const livesWithParents = npc.family.parents.some((p) => engine.npcs[p]?.homeId === npc.homeId);
      if (livesWithParents && home.residents.length > 1) findHome(engine, npc, true);
      continue;
    }

    // Everyone else occasionally reconsiders where they live.
    if (rng.chance(0.0016)) {
      const home = engine.world.buildings[npc.homeId];
      const budget = rentBudget(npc);
      const current = homeScore(engine, npc, home, budget);
      const wantsBetter = current < 35 || home.rent > budget * 1.3 || npc.needs.comfort < 30;
      if (wantsBetter) findHome(engine, npc, true);
    }

    if (goalPriority(npc, 'own_home') > 40 && rng.chance(0.006)) tryBuyHome(engine, npc);
  }
}

export function runHousingMonth(engine: SimulationEngine): void {
  const priceLevel = engine.market.index.rent;
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 18) continue;

    // Utilities, insurance, phone - the costs nobody thinks about.
    let fixed = 265 * priceLevel;
    for (const cId of npc.family.children) {
      const child = engine.npcs[cId];
      if (!child?.alive || child.ageYears >= 18 || child.homeId !== npc.homeId) continue;
      // Split the cost between the parents who actually live with the child.
      let carers = 0;
      for (const pId of child.family.parents) {
        const parent = engine.npcs[pId];
        if (parent?.alive && parent.homeId === child.homeId) carers++;
      }
      fixed += (175 * priceLevel) / Math.max(1, carers);
    }
    engine.bank.pay(npc, fixed);
    engine.ledger.addSpend('utilities', fixed);

    // Everything the simulation does not model item by item - insurance,
    // furniture, holidays, subscriptions. Without this the population would
    // accumulate savings at a rate no real household ever reaches.
    const netIncome = npc.salary > 0 ? npc.salary * (npc.retired ? 0.82 : 0.63) : 780;
    const thrift = npc.p.conscientiousness / 100;
    const lifestyle = Math.max(0, netIncome * (0.38 - thrift * 0.2));
    engine.bank.pay(npc, lifestyle);
    engine.ledger.addSpend('lifestyle', lifestyle);

    if (npc.homeId < 0) continue;
    const home = engine.world.buildings[npc.homeId];
    const owns = npc.ownedBuildings.includes(home.id);

    if (owns) {
      // Mortgage instalment plus upkeep.
      const upkeep = home.rent * 0.35;
      engine.bank.pay(npc, upkeep);
      engine.ledger.addSpend('mortgage', upkeep);
      if (npc.debt > 0) {
        const instalment = Math.min(npc.debt, home.price * 0.006);
        if (npc.bank >= instalment) {
          npc.bank -= instalment;
          npc.debt -= instalment;
        }
      }
      continue;
    }

    // Rent is split between the adults living there.
    let adults = 0;
    for (const rId of home.residents) {
      const r = engine.npcs[rId];
      if (r?.alive && r.ageYears >= 18) adults++;
    }
    const share = home.rent / Math.max(1, adults);
    const paid = engine.bank.pay(npc, share);
    engine.ledger.addSpend('rent', share);
    // Eviction only after months of arrears, and never twice in quick succession.
    const recentlyEvicted = engine.day - npc.lastEvictionDay < 540;
    if (!paid && npc.debt > share * 9 && !recentlyEvicted) evict(engine, npc, home.id);
  }
}

function evict(engine: SimulationEngine, npc: NPC, buildingId: number): void {
  if (engine.rng.chance(0.6)) return; // landlords are not instantly ruthless
  npc.lastEvictionDay = engine.day;
  leaveHome(engine, npc);
  applyEmotion(npc, { sadness: 26, anxiety: 30, stress: 35, pride: -20 });
  remember(npc, engine.day, 'move', 'Wohnung verloren', -75, -1);
  engine.emit({
    type: 'homeless',
    subjects: [npc.id],
    buildingId,
    text: `${fullName(npc)} hat die Wohnung verloren und sucht eine Bleibe.`,
    narrative: `verlor ${fullName(npc)} die Wohnung`,
    importance: 64,
  });
  const rumor = engine.rumors.create(npc.id, 'debt', true, 55, engine.day, `${fullName(npc)} steckt in Geldnot.`);
  npc.known.add(rumor.id);
  // Family often takes people in.
  for (const pId of [...npc.family.parents, ...npc.family.children]) {
    const p = engine.npcs[pId];
    if (!p?.alive || p.homeId < 0) continue;
    const home = engine.world.buildings[p.homeId];
    if (home.residents.length < home.capacity) {
      moveTo(engine, npc, p.homeId, false);
      engine.emit({
        type: 'move',
        subjects: [npc.id, p.id],
        text: `${fullName(npc)} kommt vorübergehend bei ${fullName(p)} unter.`,
        narrative: `kam ${fullName(npc)} vorübergehend bei ${fullName(p)} unter`,
        importance: 40,
      });
      return;
    }
  }
}

export const isResidential = (b: Building): boolean => RESIDENTIAL_TYPES.includes(b.type);
