import { DAYS_PER_YEAR } from '../time/calendar';
import type { SimulationEngine } from './SimulationEngine';

export interface TopEntry {
  id: number;
  value: number;
}

/**
 * Fixed-capacity descending top-N list. Used instead of building and sorting a
 * full array per statistic, which would allocate once per simulated day.
 */
class TopList {
  readonly ids: number[];
  readonly values: number[];
  private size = 0;

  constructor(private capacity: number) {
    this.ids = new Array(capacity).fill(-1);
    this.values = new Array(capacity).fill(-Infinity);
  }

  reset(): void {
    this.size = 0;
  }

  offer(id: number, value: number): void {
    if (this.size === this.capacity && value <= this.values[this.size - 1]) return;
    let i = Math.min(this.size, this.capacity - 1);
    while (i > 0 && this.values[i - 1] < value) {
      this.values[i] = this.values[i - 1];
      this.ids[i] = this.ids[i - 1];
      i--;
    }
    this.values[i] = value;
    this.ids[i] = id;
    if (this.size < this.capacity) this.size++;
  }

  toArray(): TopEntry[] {
    const out: TopEntry[] = [];
    for (let i = 0; i < this.size; i++) out.push({ id: this.ids[i], value: this.values[i] });
    return out;
  }
}

/** Aggregated city figures, recomputed once per simulated day. */
export class CityStats {
  population = 0;
  workingAge = 0;
  employed = 0;
  unemployed = 0;
  retiredCount = 0;
  children = 0;
  seniors = 0;
  averageAge = 0;
  averageIncome = 0;
  medianWealth = 0;
  totalWealth = 0;
  totalDebt = 0;
  unemploymentRate = 0;
  homeless = 0;
  couples = 0;
  married = 0;
  relationships = 0;
  avgFriends = 0;
  avgHappiness = 0;
  avgStress = 0;
  births = 0;
  deaths = 0;
  companiesActive = 0;
  companiesBankrupt = 0;
  economyHealth = 0;
  inflation = 0;
  /** Rolling yearly counters. */
  birthsThisYear = 0;
  deathsThisYear = 0;
  /** History for the charts: one sample per simulated week. */
  history: {
    day: number;
    population: number;
    unemployment: number;
    avgHappiness: number;
    economy: number;
    avgWealth: number;
  }[] = [];

  topRich: TopEntry[] = [];
  topOld: TopEntry[] = [];
  topSocial: TopEntry[] = [];
  topSalary: TopEntry[] = [];
  topPopular: TopEntry[] = [];
  topCompanies: TopEntry[] = [];

  private lastHistoryDay = -999;
  private lists = {
    rich: new TopList(10),
    old: new TopList(10),
    social: new TopList(10),
    salary: new TopList(10),
    popular: new TopList(10),
    companies: new TopList(10),
  };
  /** Reused buffer for the median calculation. */
  private wealthBuffer = new Float64Array(0);

  recompute(engine: SimulationEngine): void {
    const npcs = engine.npcs;
    let ageSum = 0;
    let incomeSum = 0;
    let incomeCount = 0;
    let happinessSum = 0;
    let stressSum = 0;
    let friendsSum = 0;
    let wealthSum = 0;
    let debtSum = 0;
    let married = 0;
    let couples = 0;
    let homeless = 0;
    let working = 0;
    let employed = 0;
    let retired = 0;
    let children = 0;
    let seniors = 0;

    for (const l of Object.values(this.lists)) l.reset();
    if (this.wealthBuffer.length < engine.aliveIds.length) {
      this.wealthBuffer = new Float64Array(engine.aliveIds.length + 256);
    }
    const wealth = this.wealthBuffer;
    let wealthCount = 0;

    for (const id of engine.aliveIds) {
      const npc = npcs[id];
      if (!npc.alive) continue;
      ageSum += npc.ageYears;
      happinessSum += npc.emo.happiness;
      stressSum += npc.needs.stress;
      friendsSum += npc.links.length;
      const worth = engine.netWorth(npc);
      wealthSum += worth;
      debtSum += npc.debt;
      wealth[wealthCount++] = worth;
      if (npc.homeId < 0) homeless++;
      if (npc.family.partner >= 0) {
        couples++;
        if (npc.family.married) married++;
      }
      if (npc.ageYears < 18) children++;
      if (npc.ageYears >= 65) seniors++;
      if (npc.retired) retired++;
      else if (npc.ageYears >= 18 && npc.ageYears < 67) {
        working++;
        if (npc.jobId >= 0) {
          employed++;
          incomeSum += npc.salary;
          incomeCount++;
        }
      }
      this.lists.rich.offer(id, worth);
      this.lists.old.offer(id, npc.ageYears);
      this.lists.social.offer(id, npc.links.length);
      this.lists.salary.offer(id, npc.salary);
      this.lists.popular.offer(id, npc.reputation);
    }

    const pop = engine.aliveIds.length;
    this.population = pop;
    this.workingAge = working;
    this.employed = employed;
    this.unemployed = Math.max(0, working - employed);
    this.retiredCount = retired;
    this.children = children;
    this.seniors = seniors;
    this.averageAge = pop ? ageSum / pop : 0;
    this.averageIncome = incomeCount ? incomeSum / incomeCount : 0;
    this.totalWealth = wealthSum;
    this.totalDebt = debtSum;
    this.unemploymentRate = working ? this.unemployed / working : 0;
    this.homeless = homeless;
    this.couples = Math.floor(couples / 2);
    this.married = Math.floor(married / 2);
    this.relationships = engine.rels.size;
    this.avgFriends = pop ? friendsSum / pop : 0;
    this.avgHappiness = pop ? happinessSum / pop : 0;
    this.avgStress = pop ? stressSum / pop : 0;
    this.economyHealth = engine.market.economyHealth;
    this.inflation = engine.market.inflation;

    const slice = wealth.subarray(0, wealthCount);
    slice.sort();
    this.medianWealth = wealthCount ? slice[Math.floor(wealthCount / 2)] : 0;

    this.topRich = this.lists.rich.toArray();
    this.topOld = this.lists.old.toArray();
    this.topSocial = this.lists.social.toArray();
    this.topSalary = this.lists.salary.toArray();
    this.topPopular = this.lists.popular.toArray();

    let active = 0;
    let dead = 0;
    for (const c of engine.companies) {
      if (c.bankrupt) dead++;
      else {
        active++;
        this.lists.companies.offer(c.id, c.employees.length * 1000 + c.balance / 1000);
      }
    }
    this.companiesActive = active;
    this.companiesBankrupt = dead;
    this.topCompanies = this.lists.companies.toArray();

    const day = engine.day;
    this.births = engine.events.countSince(day - 30, 'birth');
    this.deaths = engine.events.countSince(day - 30, 'death');
    this.birthsThisYear = engine.events.countSince(day - DAYS_PER_YEAR, 'birth');
    this.deathsThisYear = engine.events.countSince(day - DAYS_PER_YEAR, 'death');

    if (day - this.lastHistoryDay >= 7) {
      this.lastHistoryDay = day;
      this.history.push({
        day,
        population: pop,
        unemployment: this.unemploymentRate,
        avgHappiness: this.avgHappiness,
        economy: this.economyHealth,
        avgWealth: pop ? wealthSum / pop : 0,
      });
      if (this.history.length > 520) this.history.shift();
    }
  }
}
