import { clamp, clamp100 } from '../../core/math';
import { applyEmotion } from '../../npc/Emotions';
import { remember } from '../../npc/Memory';
import { setGoalProgress, goalPriority } from '../../npc/Goals';
import { fullName } from '../../npc/NPCFactory';
import type { NPC } from '../../npc/types';
import { PROFESSIONS, professionsFor } from '../../economy/professions';
import type { Company } from '../../economy/types';
import { COMPANY_STEMS, COMPANY_SUFFIX_BY_KIND, LEGAL_FORMS } from '../../world/worldNames';
import type { BuildingType } from '../../world/types';
import { leaveJob } from './WorkSystem';
import type { SimulationEngine } from '../SimulationEngine';

/** Business types that can be founded by an entrepreneur. */
const FOUNDABLE: BuildingType[] = ['shop', 'cafe', 'restaurant', 'bar', 'workshop', 'office', 'gym'];

const STARTUP_COST: Partial<Record<BuildingType, number>> = {
  shop: 28000,
  cafe: 42000,
  restaurant: 68000,
  bar: 52000,
  workshop: 58000,
  office: 45000,
  gym: 74000,
};

export function companyName(engine: SimulationEngine, type: BuildingType, founder?: NPC): string {
  const rng = engine.rng;
  const suffixes = COMPANY_SUFFIX_BY_KIND[type] ?? ['Betrieb'];
  const stem = founder ? founder.lastName : rng.pick(COMPANY_STEMS);
  const base = `${stem} ${rng.pick(suffixes)}`;
  return rng.chance(0.35) ? `${base} ${rng.pick(LEGAL_FORMS)}` : base;
}

/** Creates the positions a business of this type and size offers. */
export function buildPositions(engine: SimulationEngine, type: BuildingType, scale: number) {
  const profs = professionsFor(type);
  const positions = profs.map((p) => ({
    prof: p.id,
    max: Math.max(1, Math.round(p.density * scale)),
    filled: 0,
  }));
  // Every business needs at least somebody.
  if (!positions.length) {
    const fallback = PROFESSIONS.find((p) => p.id === 'bueroangestellter')!;
    positions.push({ prof: fallback.id, max: Math.max(1, Math.round(scale * 3)), filled: 0 });
  }
  void engine;
  return positions;
}

/** Daily trade: businesses earn from the people who actually visit them. */
export function runEconomyDay(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;
  const market = engine.market;

  for (const c of engine.companies) {
    if (c.bankrupt) continue;
    const building = engine.world.buildings[c.buildingId];
    if (!building) continue;
    // Revenue follows the whole day's footfall, not a single snapshot.
    const footfall = building.visitsToday;
    building.visitsToday = 0;
    const perVisit = customerValue(c.industry, market);
    const quality = 0.6 + c.quality / 200 + c.reputation / 260;
    // Non-customer-facing businesses earn through their staff's output, which
    // applyWorkShift already books, so they only get a small baseline here.
    const direct = footfall * perVisit * quality * c.priceLevel * rng.float(0.85, 1.2);
    c.revenue += direct;
    c.costs += building.rent * 0.05 + c.employees.length * 6;
  }

  // Entrepreneurs occasionally take the leap.
  if (day % 3 === 0) {
    for (const id of engine.aliveIds) {
      const npc = engine.npcs[id];
      if (npc.ageYears < 22 || npc.ageYears > 62) continue;
      if (goalPriority(npc, 'found_company') < 45 || npc.ownedBuildings.length > 0) continue;
      if (rng.chance(0.004)) tryFoundCompany(engine, npc);
    }
  }
}

function customerValue(industry: BuildingType, market: SimulationEngine['market']): number {
  switch (industry) {
    case 'supermarket':
      return market.price('food') * 2.4;
    case 'restaurant':
      return market.price('dining') * 0.9;
    case 'cafe':
      return market.price('dining') * 0.45;
    case 'bar':
      return market.price('dining') * 0.7;
    case 'shop':
      return market.price('clothing') * 0.35;
    case 'mall':
      return market.price('clothing') * 0.5;
    case 'gym':
      return market.price('entertainment') * 0.8;
    case 'hospital':
      return market.price('health') * 1.1;
    case 'university':
    case 'school':
      return market.price('education') * 0.25;
    default:
      return 14;
  }
}

export function tryFoundCompany(engine: SimulationEngine, npc: NPC): void {
  const rng = engine.rng;
  const type = rng.pick(FOUNDABLE);
  const cost = (STARTUP_COST[type] ?? 40000) * (0.8 + engine.market.index.rent * 0.3);
  const liquid = npc.bank + npc.money;
  const own = Math.min(liquid, cost * 0.5);
  const loan = cost - own;
  if (own < cost * 0.2) return;
  if (loan > 0 && !engine.bank.canBorrow(npc, loan, Math.max(npc.salary, 1500))) return;

  // Find a building of the right kind without a business in it, or convert one.
  let site = -1;
  const pool = engine.world.ofType(type).filter((id) => engine.world.buildings[id].companyId < 0);
  if (pool.length) site = rng.pick(pool);
  if (site < 0) {
    const spare = engine.world.buildings.filter((b) => b.companyId < 0 && b.type === 'shop');
    if (!spare.length) return;
    site = rng.pick(spare).id;
  }

  engine.bank.pay(npc, own);
  engine.ledger.addSpend('investment', own);
  if (loan > 0) {
    engine.bank.borrow(npc, loan);
    npc.bank -= loan;
  }

  const building = engine.world.buildings[site];
  const company: Company = {
    id: engine.companies.length,
    name: companyName(engine, type, npc),
    buildingId: site,
    industry: type,
    founderId: npc.id,
    ownerId: npc.id,
    employees: [],
    positions: buildPositions(engine, type, 0.55),
    balance: Math.round(cost * 0.18),
    revenue: 0,
    costs: 0,
    lastProfit: 0,
    reputation: clamp100(40 + npc.reputation * 0.2),
    quality: clamp100(45 + npc.skills.business * 0.3 + npc.a.discipline * 0.15),
    priceLevel: rng.float(0.9, 1.15),
    foundedDay: engine.day,
    bankrupt: false,
    lossStreak: 0,
    growth: 0,
  };
  engine.companies.push(company);
  building.companyId = company.id;
  npc.ownedBuildings.push(site);

  // The founder now works for themselves.
  if (npc.jobId >= 0) leaveJob(engine, npc, 'quit');
  const managerProf = PROFESSIONS.find((p) => p.id === 'manager')!;
  npc.jobId = engine.professionIndex(managerProf.id);
  npc.employerId = company.id;
  npc.careerLevel = 4;
  npc.salary = Math.round(managerProf.baseSalary * 0.75);
  npc.jobSinceDay = engine.day;
  npc.unemployedSinceDay = -1;
  company.employees.push(npc.id);
  const mgrPos = company.positions.find((p) => p.prof === managerProf.id);
  if (mgrPos) mgrPos.filled++;
  else company.positions.push({ prof: managerProf.id, max: 1, filled: 1 });

  setGoalProgress(npc, 'found_company', 100);
  applyEmotion(npc, { happiness: 30, pride: 32, motivation: 30, anxiety: 20, stress: 18 });
  remember(npc, engine.day, 'company_founded', `${company.name} gegründet`, 80, -1);
  engine.emit({
    type: 'company_founded',
    subjects: [npc.id],
    companyId: company.id,
    buildingId: site,
    text: `${fullName(npc)} hat ${company.name} gegründet.`,
    narrative: `gründete ${fullName(npc)} das Unternehmen ${company.name}`,
    importance: 64,
  });
  engine.version++;
}

/** Monthly books: profit, growth, bankruptcy. */
export function runEconomyMonth(engine: SimulationEngine): void {
  const rng = engine.rng;
  let profitable = 0;
  let active = 0;

  // The city can only support so many jobs. Without this ceiling, profitable
  // companies would keep adding positions until unemployment hit zero.
  let slots = 0;
  for (const c of engine.companies) {
    if (c.bankrupt) continue;
    for (const p of c.positions) slots += p.max;
  }
  const canExpand = slots < engine.stats.workingAge * 0.95;

  for (const c of engine.companies) {
    if (c.bankrupt) continue;
    active++;
    const profit = c.revenue - c.costs;
    c.lastProfit = profit;
    c.balance += profit;
    c.revenue = 0;
    c.costs = 0;
    if (profit > 0) {
      profitable++;
      c.lossStreak = 0;
      c.growth = clamp(c.growth * 0.7 + (profit / Math.max(1000, Math.abs(c.balance) + 1000)) * 30, -50, 50);
      c.reputation = clamp100(c.reputation + 0.4);
      c.quality = clamp100(c.quality + 0.2);
      // Growing businesses create jobs.
      if (canExpand && c.balance > 60000 && rng.chance(0.1)) {
        const pos = c.positions[rng.int(0, c.positions.length - 1)];
        if (pos) {
          pos.max++;
          slots++;
        }
      }
      // Owners take a share of the profit.
      const owner = c.ownerId >= 0 ? engine.npcs[c.ownerId] : null;
      if (owner?.alive && profit > 2000) {
        const dividend = profit * 0.3;
        c.balance -= dividend;
        engine.bank.earn(owner, dividend);
        engine.ledger.addIncome('dividend', dividend);
      }
    } else {
      c.lossStreak++;
      c.growth = clamp(c.growth - 4, -60, 50);
      c.reputation = clamp100(c.reputation - 0.6);
      if (c.balance < -40000 || (c.lossStreak >= 6 && c.balance < 0)) {
        bankrupt(engine, c);
        continue;
      }
      // Shrink before dying.
      if (c.lossStreak >= 3 && rng.chance(0.35)) {
        const pos = c.positions.find((p) => p.max > 1);
        if (pos) pos.max--;
      }
    }
  }

  const employable = engine.stats.workingAge || 1;
  const employed = engine.stats.employed;
  engine.market.updateHealth(clamp(employed / employable, 0, 1), active ? profitable / active : 0.5);
}

export function bankrupt(engine: SimulationEngine, c: Company): void {
  c.bankrupt = true;
  const building = engine.world.buildings[c.buildingId];
  if (building) building.companyId = -1;
  const staff = [...c.employees];
  for (const id of staff) {
    const npc = engine.npcs[id];
    if (npc?.alive) leaveJob(engine, npc, 'bankrupt');
  }
  const owner = c.ownerId >= 0 ? engine.npcs[c.ownerId] : null;
  if (owner?.alive) {
    const i = owner.ownedBuildings.indexOf(c.buildingId);
    if (i >= 0) owner.ownedBuildings.splice(i, 1);
    owner.debt += Math.max(0, -c.balance) * 0.4;
    applyEmotion(owner, { sadness: 40, anxiety: 34, stress: 45, pride: -30, motivation: -20 });
    remember(owner, engine.day, 'bankruptcy', `${c.name} musste schließen`, -90, -1);
  }
  engine.emit({
    type: 'bankruptcy',
    subjects: owner?.alive ? [owner.id] : [],
    companyId: c.id,
    buildingId: c.buildingId,
    text: `${c.name} hat Insolvenz angemeldet. ${staff.length} Beschäftigte verlieren ihre Stelle.`,
    narrative: `musste ${c.name} Insolvenz anmelden`,
    importance: 68,
  });
  engine.version++;
}
