import { RNG, hashSeed } from '../core/rng';
import { clamp, clamp01, clamp100 } from '../core/math';
import { isWeekend } from '../time/calendar';
import { SimulationClock, type Speed } from '../time/SimulationClock';
import { World } from '../world/World';
import { pickMode, travelCost, travelMinutes } from '../world/Travel';
import { RESIDENTIAL_TYPES } from '../world/types';
import { decayNeeds } from '../npc/Needs';
import { applyEmotion, decayEmotions } from '../npc/Emotions';
import { fullName } from '../npc/NPCFactory';
import { RETIREMENT_AGE } from '../npc/lifecycle';
import type { NPC } from '../npc/types';
import type { FamilyTie } from '../relationships/types';
import { RelationshipManager } from '../relationships/RelationshipManager';
import { SocialGraph } from '../relationships/SocialGraph';
import { RumorSystem } from '../relationships/Rumors';
import { Market } from '../economy/Market';
import { Bank } from '../economy/Bank';
import { Ledger, PRICE_TO_SPEND } from '../economy/Ledger';
import { PROFESSION_BY_ID } from '../economy/professions';
import type { Company, Profession } from '../economy/types';
import { EventLog, type EventInput } from '../events/EventLog';
import { StoryTracker } from '../events/StoryTracker';
import type { GameEvent } from '../events/types';
import { ACTIONS, PAID_VENUES } from './Actions';
import { DecisionEngine, type Candidate } from './DecisionEngine';
import { SimulationScheduler } from './SimulationScheduler';
import { buildWorld, type WorldConfig } from './WorldBuilder';
import { coupleFertility, runDailyLife } from './systems/LifeSystem';
import { PUBLIC_ACTIONS, finishSocialAction, meetSomeoneNew, runSocialDay } from './systems/SocialSystem';
import { applyWorkShift, runWorkDay, runWorkMonth, tryApplications } from './systems/WorkSystem';
import { findHome, leaveHome, moveTo, runHousingDay, runHousingMonth } from './systems/HousingSystem';
import { runEconomyDay, runEconomyMonth } from './systems/EconomySystem';
import { CityStats } from './CityStats';

export interface EngineConfig extends WorldConfig {
  seed: number;
  cityName: string;
}

/** How many NPCs may re-decide within a single engine tick. */
const DECISION_BUDGET = 900;
/**
 * Hard wall-clock ceiling for one tick. Anything still due is carried over by
 * the scheduler, which keeps the frame rate stable at extreme time factors.
 */
const TICK_TIME_BUDGET_MS = 22;
/** Ceiling for a whole tick including all its sub-steps. */
const FRAME_BUDGET_MS = 45;

export class SimulationEngine {
  seed: number;
  rng: RNG;
  clock = new SimulationClock();
  world!: World;
  npcs: NPC[] = [];
  /** Dense list of living NPC ids, rebuilt daily. */
  aliveIds: number[] = [];
  rels = new RelationshipManager();
  graph: SocialGraph;
  rumors = new RumorSystem();
  companies: Company[] = [];
  market = new Market();
  bank = new Bank();
  ledger = new Ledger();
  events = new EventLog();
  stories = new StoryTracker();
  decision: DecisionEngine;
  scheduler = new SimulationScheduler();
  stats: CityStats;
  config: EngineConfig;

  /** NPCs the player watches - these get full-detail simulation. */
  detailedIds = new Set<number>();

  /** Performance counters shown in the debug overlay. */
  perf = {
    decisionsPerTick: 0,
    decisionsTotal: 0,
    lastTickMs: 0,
    avgTickMs: 0,
    substeps: 0,
    deferred: 0,
  };

  /** Bumped whenever something structural changed (NPC list, stories, ...). */
  version = 0;

  /** How often each action has been started - diagnostics and the debug panel. */
  actionCounts: Record<string, number> = {};

  /** Rebuilt once per simulated day so job hunting stays cheap. */
  openingsCache: { companyId: number; prof: Profession }[] | null = null;

  private dueBuffer: number[] = [];
  private lastDayProcessed = -1;

  constructor(config: EngineConfig) {
    this.config = config;
    this.seed = config.seed;
    this.rng = new RNG(config.seed);
    this.graph = new SocialGraph(this.rels);
    this.graph.setLinksProvider((id) => this.npcs[id]?.links);
    this.decision = new DecisionEngine(this);
    this.stats = new CityStats();
  }

  static create(config: Partial<EngineConfig> = {}): SimulationEngine {
    const seed = config.seed ?? (Math.random() * 0xffffffff) >>> 0;
    const full: EngineConfig = {
      seed,
      cityName: config.cityName ?? '',
      population: config.population ?? 1200,
      startYearOffset: config.startYearOffset ?? 0,
    };
    const engine = new SimulationEngine(full);
    buildWorld(engine, full);
    engine.afterBuild();
    return engine;
  }

  /** Common initialisation for both new and loaded worlds. */
  afterBuild(): void {
    this.rebuildAlive();
    this.stats.recompute(this);
    this.version++;
  }

  // ------------------------------------------------------------------ helpers

  get now(): number {
    return this.clock.totalMinutes;
  }

  get day(): number {
    return this.clock.day;
  }

  nameOf(id: number): string {
    const npc = this.npcs[id];
    return npc ? fullName(npc) : 'Unbekannt';
  }

  isWeekend(day: number): boolean {
    return isWeekend(day);
  }

  professionOf(npc: NPC): Profession | undefined {
    return npc.jobId >= 0 ? PROFESSION_BY_ID.get(this.professionIds[npc.jobId]) : undefined;
  }

  /** Stable index -> profession id mapping, so NPCs store a small number. */
  professionIds: string[] = [];

  professionIndex(id: string): number {
    let i = this.professionIds.indexOf(id);
    if (i < 0) {
      i = this.professionIds.length;
      this.professionIds.push(id);
    }
    return i;
  }

  netWorth(npc: NPC): number {
    let property = 0;
    for (const b of npc.ownedBuildings) property += this.world.buildings[b]?.price ?? 0;
    return npc.money + npc.bank - npc.debt + property;
  }

  /** Estimated monthly living cost - the denominator for money pressure. */
  monthlyCost(npc: NPC): number {
    const home = npc.homeId >= 0 ? this.world.buildings[npc.homeId] : null;
    const rent = home && !npc.ownedBuildings.includes(home.id) ? home.rent : 0;
    const food = this.market.price('food') * 46;
    const transport = this.market.price('transport') * 30;
    const fixed = 265 * this.market.index.rent;
    let childCost = 0;
    for (const cId of npc.family.children) {
      const child = this.npcs[cId];
      if (!child?.alive || child.ageYears >= 18 || child.homeId !== npc.homeId) continue;
      let carers = 0;
      for (const pId of child.family.parents) {
        const parent = this.npcs[pId];
        if (parent?.alive && parent.homeId === child.homeId) carers++;
      }
      childCost += 175 / Math.max(1, carers);
    }
    const netIncome = npc.salary > 0 ? npc.salary * (npc.retired ? 0.82 : 0.63) : 780;
    const lifestyle = netIncome * (0.38 - (npc.p.conscientiousness / 100) * 0.2);
    return rent + food + transport + fixed + childCost + lifestyle;
  }

  /** 0..1 - how squeezed this NPC feels financially. */
  financialPressure(npc: NPC): number {
    const cost = this.monthlyCost(npc);
    const liquid = npc.money + npc.bank;
    const debtLoad = clamp01(npc.debt / Math.max(6000, cost * 12)) * 0.45;
    return clamp01(1 - liquid / (cost * 2.2)) * 0.8 + debtLoad;
  }

  /**
   * Euros this NPC can spend on optional things per day, after the fixed cost
   * of living. This is the yardstick the decision engine prices actions against.
   */
  discretionaryDaily(npc: NPC): number {
    const netIncome = npc.salary > 0 ? npc.salary * (npc.retired ? 0.82 : 0.63) : 780;
    const free = netIncome - this.monthlyCost(npc);
    // Savings soften a tight month, but never turn into unlimited spending.
    const cushion = Math.max(0, npc.bank) * 0.002;
    return Math.max(6, free / 30 + cushion);
  }

  affordable(npc: NPC, category: Parameters<Market['price']>[0], units: number): boolean {
    return npc.money + npc.bank >= this.market.price(category) * units;
  }

  /** Picks whom an NPC would like to spend time with right now. */
  pickSocialTarget(npc: NPC): number {
    const rng = this.rng;
    // Usually someone they already know...
    if (npc.links.length && rng.chance(0.82)) {
      let best = -1;
      let bestScore = 0;
      // Sample rather than scan - large social circles must stay cheap.
      const tries = Math.min(npc.links.length, 8);
      for (let i = 0; i < tries; i++) {
        const otherId = npc.links[rng.int(0, npc.links.length - 1)];
        const other = this.npcs[otherId];
        if (!other?.alive || other.id === npc.family.partner) continue;
        const rel = this.rels.get(npc.id, otherId);
        if (!rel) continue;
        const score =
          rel.closeness * 0.5 + rel.sympathy * 0.35 - rel.conflict * 0.9 + rng.float(0, 25);
        if (score > bestScore) {
          bestScore = score;
          best = otherId;
        }
      }
      if (best >= 0) return best;
    }
    // ...otherwise a chance to meet somebody new nearby.
    return -1;
  }

  emit(input: EventInput): GameEvent {
    const e = this.events.push(this.now, input);
    this.stories.onEvent(e, (id) => this.nameOf(id), (id) => this.events.byId(id));
    return e;
  }

  rebuildAlive(): void {
    this.aliveIds.length = 0;
    for (const npc of this.npcs) if (npc.alive) this.aliveIds.push(npc.id);
  }

  setDetailed(ids: Iterable<number>): void {
    for (const id of this.detailedIds) {
      const npc = this.npcs[id];
      if (npc) npc.detailed = false;
    }
    this.detailedIds.clear();
    for (const id of ids) {
      const npc = this.npcs[id];
      if (npc?.alive) {
        npc.detailed = true;
        this.detailedIds.add(id);
      }
    }
  }

  // --------------------------------------------------------------- simulation

  setSpeed(s: Speed): void {
    this.clock.setSpeed(s);
  }

  /** One engine tick. Returns the number of simulated minutes advanced. */
  tick(): number {
    if (this.clock.paused) return 0;
    const t0 = performance.now();
    const minutes = this.clock.minutesForTick();
    this.perf.decisionsPerTick = 0;

    // Large speed multipliers are split into bounded sub-steps so that no NPC
    // can sleep through an entire day's worth of decisions.
    const maxStep = this.clock.speed >= 100 ? 120 : this.clock.speed >= 20 ? 60 : 30;
    let remaining = minutes;
    let substeps = 0;
    const hardDeadline = t0 + FRAME_BUDGET_MS;
    while (remaining > 0) {
      const step = Math.min(remaining, maxStep);
      this.clock.advance(step);
      this.step();
      remaining -= step;
      substeps++;
      // Never let one tick blow the frame budget; simulated time simply
      // advances a little more slowly than the chosen multiplier.
      if (substeps > 24 || performance.now() > hardDeadline) break;
    }
    this.perf.substeps = substeps;

    const dt = performance.now() - t0;
    this.perf.lastTickMs = dt;
    this.perf.avgTickMs = this.perf.avgTickMs * 0.9 + dt * 0.1;
    return minutes;
  }

  /** Advances everything that depends on the clock having moved. */
  private step(): void {
    const now = this.now;

    // Periodic systems first so NPCs decide with fresh context.
    const b = this.clock.consumeBoundaries();
    if (b.days > 0) this.onDays(b.days);
    if (b.months > 0) this.onMonth();
    if (b.hours > 0) this.onHours(b.hours);

    // Then the agents whose current activity has finished.
    this.scheduler.collectDue(now, DECISION_BUDGET, this.dueBuffer);
    const deadline = performance.now() + TICK_TIME_BUDGET_MS;
    let processed = 0;
    for (const id of this.dueBuffer) {
      const npc = this.npcs[id];
      if (!npc || !npc.alive) continue;
      this.processNpc(npc, now);
      // Check the clock every so often rather than on every NPC.
      if ((++processed & 63) === 0 && performance.now() > deadline) {
        for (let i = this.dueBuffer.indexOf(id) + 1; i < this.dueBuffer.length; i++) {
          this.scheduler.schedule(this.dueBuffer[i], now);
        }
        break;
      }
    }
    this.perf.deferred = this.scheduler.pending;
  }

  /** Handles one NPC reaching a boundary: arrival or end of action. */
  private processNpc(npc: NPC, now: number): void {
    if (npc.travel) {
      this.arrive(npc, now);
      // The action itself starts now and ends later.
      npc.nextDecisionMin = Math.max(now + 5, npc.action.endMin);
      this.scheduler.schedule(npc.id, npc.nextDecisionMin);
      return;
    }
    this.advanceNpc(npc, now);
    this.finishAction(npc, now);
    const coarse = !npc.detailed && this.clock.speed >= 100;
    const choice = this.decision.decide(npc, now, coarse);
    this.startAction(npc, choice, now);
    this.perf.decisionsPerTick++;
    this.perf.decisionsTotal++;
  }

  /**
   * Lazily applies needs, emotions and action effects for the time that passed
   * since this NPC was last touched. Called at every boundary and by the UI.
   */
  advanceNpc(npc: NPC, now: number): void {
    const elapsed = now - npc.lastUpdateMin;
    if (elapsed <= 0) return;
    npc.lastUpdateMin = now;
    const hours = elapsed / 60;

    const traveling = npc.travel !== null;
    const def = traveling ? null : ACTIONS[npc.action.type];
    const scale = def ? def.decayScale : 1;

    // Baseline decay.
    const before = npc.needs.energy;
    decayNeeds(npc, hours * scale, npc.lifeStage);
    void before;

    if (traveling) {
      const n = npc.needs;
      const mode = npc.travel!.mode;
      n.energy = clamp100(n.energy - (mode === 0 ? 3.2 : 1.4) * hours);
      n.fun = clamp100(n.fun - 1.2 * hours);
      n.hygiene = clamp100(n.hygiene - (mode === 0 ? 2 : 0.8) * hours);
      n.stress = clamp100(n.stress + (mode === 2 ? 1.6 : 1.0) * hours);
    } else if (def) {
      const n = npc.needs;
      for (let i = 0; i < def.effectList.length; i++) {
        const k = def.effectList[i].k;
        n[k] = clamp100(n[k] + def.effectList[i].v * hours);
      }
      if (npc.action.type === 'work' || npc.action.type === 'overtime') {
        applyWorkShift(this, npc, hours);
      }
    }

    decayEmotions(npc, hours);
    // Weather gently colours the mood of everyone in the city.
    const wm = this.world.weather.moodDelta() * hours;
    if (wm !== 0) npc.emo.happiness = clamp100(npc.emo.happiness + wm);
  }

  private arrive(npc: NPC, now: number): void {
    const t = npc.travel!;
    const oldLoc = npc.locId;
    this.advanceNpc(npc, now);
    npc.travel = null;
    npc.locId = t.toId;
    const prev = oldLoc >= 0 ? this.world.buildings[oldLoc] : null;
    if (prev) {
      prev.occupants = Math.max(0, prev.occupants - 1);
      const i = prev.present.indexOf(npc.id);
      if (i >= 0) prev.present.splice(i, 1);
    }
    const dest = this.world.buildings[t.toId];
    if (dest) {
      dest.occupants++;
      dest.visitsToday++;
      dest.present.push(npc.id);
    }
    npc.action.startMin = now;
    if (npc.action.endMin <= now) npc.action.endMin = now + 30;
  }

  private startAction(npc: NPC, c: Candidate, now: number): void {
    const duration = Math.max(10, Math.round(c.duration));
    if (c.locationId !== npc.locId && c.locationId >= 0) {
      const distance = this.world.distance(npc.locId, c.locationId);
      const mode = pickMode(distance, this.netWorth(npc), npc.ageYears);
      const minutes = Math.max(1, Math.round(travelMinutes(distance, mode)));
      npc.travel = {
        fromId: npc.locId,
        toId: c.locationId,
        startMin: now,
        arriveMin: now + minutes,
        mode,
      };
      const cost = travelCost(distance, mode, this.market.price('transport'));
      if (cost > 0) {
        this.bank.pay(npc, cost);
        this.ledger.addSpend('transport', cost);
      }
      npc.action = {
        type: c.type,
        locationId: c.locationId,
        partner: c.partner,
        startMin: now + minutes,
        endMin: now + minutes + duration,
      };
      npc.nextDecisionMin = now + minutes;
    } else {
      npc.action = {
        type: c.type,
        locationId: c.locationId >= 0 ? c.locationId : npc.locId,
        partner: c.partner,
        startMin: now,
        endMin: now + duration,
      };
      npc.nextDecisionMin = now + duration;
    }
    this.scheduler.schedule(npc.id, npc.nextDecisionMin);
    this.actionCounts[c.type] = (this.actionCounts[c.type] ?? 0) + 1;
  }

  /** End-of-action effects: payments, skill gains, social outcomes. */
  private finishAction(npc: NPC, now: number): void {
    const a = npc.action;
    if (a.type === 'idle') return;
    const def = ACTIONS[a.type];
    const hours = Math.max(0, (Math.min(now, a.endMin) - a.startMin)) / 60;
    if (hours <= 0) return;

    if (def.costCategory) {
      // Only commercial venues charge - a walk in the park is free.
      const venue = this.world.buildings[a.locationId];
      if (venue && PAID_VENUES.has(venue.type)) {
        const cost = this.market.price(def.costCategory) * def.costUnits;
        this.bank.pay(npc, cost);
        this.ledger.addSpend(PRICE_TO_SPEND[def.costCategory] ?? 'leisure', cost);
      }
    }

    switch (a.type) {
      case 'eat_home':
      case 'eat_packed':
        npc.pantry = Math.max(0, npc.pantry - 1);
        break;
      case 'groceries':
        npc.pantry = Math.min(30, npc.pantry + 12);
        break;
      case 'gym':
        npc.skills.fitness = clamp100(npc.skills.fitness + 0.22 * hours);
        npc.a.health = clamp100(npc.a.health + 0.12 * hours);
        applyEmotion(npc, { happiness: 1.5 * hours, pride: 1 * hours });
        break;
      case 'study':
        npc.skills.teaching = clamp100(npc.skills.teaching + 0.08 * hours);
        npc.a.intelligence = clamp100(npc.a.intelligence + 0.02 * hours);
        break;
      case 'school':
        npc.a.intelligence = clamp100(npc.a.intelligence + 0.012 * hours);
        break;
      case 'job_hunt':
        tryApplications(this, npc);
        break;
      case 'bank':
        this.bank.deposit(npc, Math.max(0, npc.money - 400));
        break;
      case 'hospital':
        npc.a.health = clamp100(npc.a.health + 4 + hours * 1.6);
        break;
      case 'socialize':
      case 'date':
      case 'romance_hunt':
      case 'family_time':
      case 'childcare':
        finishSocialAction(this, npc, a.type, a.partner, hours);
        break;
      case 'shop':
        applyEmotion(npc, { happiness: 2.5, pride: 1 });
        break;
      default:
        break;
    }

    if (PUBLIC_ACTIONS.has(a.type) && a.partner < 0) meetSomeoneNew(this, npc, false);

    // Hobbies quietly train their related skill during leisure time.
    if (a.type === 'relax' || a.type === 'park') {
      for (const h of npc.hobbies) {
        const skill = HOBBY_TO_SKILL[h];
        if (skill) npc.skills[skill] = clamp100(npc.skills[skill] + 0.05 * hours);
      }
    }
  }

  // ------------------------------------------------------------- periodic runs

  private onHours(hours: number): void {
    const h = Math.min(hours, 24);
    if (this.world.weather.update(this.now, this.day, this.rng)) {
      if (this.world.weather.kind === 'sturm' || this.world.weather.kind === 'hitze') {
        this.emit({
          type: 'weather',
          subjects: [],
          text: `In ${this.world.name} zieht ${this.world.weather.kind === 'sturm' ? 'ein Sturm' : 'eine Hitzewelle'} auf.`,
          importance: 25,
        });
      }
    }
    void h;
  }

  private onDays(days: number): void {
    const d = Math.min(days, 6);
    for (let i = 0; i < d; i++) {
      const day = this.day - (d - 1 - i);
      if (day <= this.lastDayProcessed) continue;
      this.lastDayProcessed = day;
      this.runDay(day);
    }
  }

  private runDay(day: number): void {
    const now = this.now;
    // Everyone gets a consistent update before the daily systems read them.
    for (const id of this.aliveIds) {
      const npc = this.npcs[id];
      if (npc.alive) this.advanceNpc(npc, now);
    }

    this.market.tickDay(this.rng);
    runDailyLife(this, day);
    runSocialDay(this, day);
    runWorkDay(this, day);
    runHousingDay(this);
    runEconomyDay(this, day);

    this.rebuildAlive();
    this.rumors.sweep(day);
    this.stories.sweep(day, (id) => this.nameOf(id), (id) => this.events.byId(id));
    this.stats.recompute(this);
    this.version++;
  }

  private onMonth(): void {
    runWorkMonth(this);
    runHousingMonth(this);
    runEconomyMonth(this);
    for (const id of this.aliveIds) {
      const npc = this.npcs[id];
      const debtBefore = npc.debt;
      this.bank.monthlyInterest(npc);
      if (npc.debt > debtBefore) this.ledger.addSpend('interest', npc.debt - debtBefore);
      this.bank.rebalance(npc, this.monthlyCost(npc) * 0.35);
      npc.monthIncome = 0;
      npc.monthSpend = 0;
    }
    this.ledger.rollMonth();
    this.version++;
  }

  // ------------------------------------------------------------------ queries

  /** Current world position of an NPC, interpolating while travelling. */
  positionOf(npc: NPC): { x: number; y: number } {
    const w = this.world;
    if (npc.travel) {
      const t = npc.travel;
      const from = w.buildings[t.fromId];
      const to = w.buildings[t.toId];
      if (!from || !to) return { x: 0, y: 0 };
      const p = clamp01((this.now - t.startMin) / Math.max(1, t.arriveMin - t.startMin));
      return {
        x: w.centerX(from) + (w.centerX(to) - w.centerX(from)) * p,
        y: w.centerY(from) + (w.centerY(to) - w.centerY(from)) * p,
      };
    }
    const b = w.buildings[npc.locId];
    if (!b) return { x: 0, y: 0 };
    // Deterministic offset inside the building so people do not overlap.
    const o1 = ((npc.id * 2654435761) >>> 0) / 4294967296;
    const o2 = ((npc.id * 40503 + 12345) >>> 0) / 4294967296;
    return { x: b.x + 3 + o1 * Math.max(1, b.w - 6), y: b.y + 3 + o2 * Math.max(1, b.h - 6) };
  }

  freeHomes(minCapacityLeft = 1): number[] {
    const out: number[] = [];
    for (const b of this.world.buildings) {
      if (!RESIDENTIAL_TYPES.includes(b.type)) continue;
      if (b.capacity - b.residents.length >= minCapacityLeft) out.push(b.id);
    }
    return out;
  }

  /** Retirement check used by several systems. */
  shouldRetire(npc: NPC): boolean {
    return npc.ageYears >= RETIREMENT_AGE && !npc.retired;
  }

  // ------------------------------------------------------------ family & home

  /** Creates (or upgrades) a family relationship between two NPCs. */
  linkFamily(from: NPC, to: NPC, tie: FamilyTie, day: number): void {
    const rel = this.rels.ensure(from, to, day);
    this.rels.setFamilyTie(rel, from.id, tie);
    const strong = tie === 'parent' || tie === 'child';
    rel.trust = Math.max(rel.trust, strong ? 72 : 58);
    rel.sympathy = Math.max(rel.sympathy, strong ? 70 : 56);
    rel.closeness = Math.max(rel.closeness, strong ? 74 : 58);
    rel.loyalty = Math.max(rel.loyalty, strong ? 78 : 62);
    rel.respect = Math.max(rel.respect, 55);
    rel.lastInteractionDay = day;
  }

  fertilityOf(mother: NPC, father: NPC): number {
    return coupleFertility(mother, father);
  }

  /** After a wedding the couple shares one home. */
  moveInTogether(a: NPC, b: NPC): void {
    if (a.homeId === b.homeId && a.homeId >= 0) return;
    const homeA = a.homeId >= 0 ? this.world.buildings[a.homeId] : null;
    const homeB = b.homeId >= 0 ? this.world.buildings[b.homeId] : null;
    const roomA = homeA ? homeA.capacity - homeA.residents.length : -1;
    const roomB = homeB ? homeB.capacity - homeB.residents.length : -1;
    if (homeA && roomA >= 1 && (!homeB || homeA.quality >= homeB.quality)) {
      moveTo(this, b, homeA.id, false);
    } else if (homeB && roomB >= 1) {
      moveTo(this, a, homeB.id, false);
    } else {
      findHome(this, a, false);
      if (a.homeId >= 0) moveTo(this, b, a.homeId, false);
    }
    // Children follow their parents.
    for (const cId of [...a.family.children, ...b.family.children]) {
      const child = this.npcs[cId];
      if (child?.alive && child.ageYears < 18 && a.homeId >= 0) moveTo(this, child, a.homeId, false);
    }
  }

  /** After a break-up one of the two has to find a new place. */
  separateHouseholds(a: NPC, b: NPC): void {
    if (a.homeId < 0 || a.homeId !== b.homeId) return;
    // Whoever owns the flat keeps it.
    const owner = a.ownedBuildings.includes(a.homeId) ? a : b.ownedBuildings.includes(b.homeId) ? b : null;
    const leaver = owner === a ? b : owner === b ? a : this.rng.chance(0.5) ? a : b;
    const oldHome = leaver.homeId;
    leaveHome(this, leaver);
    if (!findHome(this, leaver, false)) {
      this.emit({
        type: 'homeless',
        subjects: [leaver.id],
        buildingId: oldHome,
        text: `${fullName(leaver)} hat nach der Trennung keine Wohnung gefunden.`,
        importance: 55,
      });
    } else {
      this.emit({
        type: 'move',
        subjects: [leaver.id],
        buildingId: leaver.homeId,
        text: `${fullName(leaver)} ist nach der Trennung ausgezogen.`,
        narrative: `zog ${fullName(leaver)} nach der Trennung aus`,
        importance: 42,
      });
    }
    // Small children stay with the primary carer.
    for (const cId of leaver.family.children) {
      const child = this.npcs[cId];
      if (child?.alive && child.ageYears < 18 && this.rng.chance(0.35) && leaver.homeId >= 0) {
        moveTo(this, child, leaver.homeId, false);
      }
    }
  }

  /** Cached list of residential buildings with free capacity. */
  vacantHomes: number[] = [];

  refreshVacancies(): void {
    this.vacantHomes.length = 0;
    for (const b of this.world.buildings) {
      if (!RESIDENTIAL_TYPES.includes(b.type)) continue;
      if (b.residents.length < b.capacity) this.vacantHomes.push(b.id);
    }
  }

  clampNeeds(npc: NPC): void {
    const n = npc.needs;
    n.hunger = clamp(n.hunger, 0, 100);
    n.energy = clamp(n.energy, 0, 100);
  }
}

const HOBBY_TO_SKILL: Record<string, keyof NPC['skills']> = {
  'Fußball': 'fitness',
  'Joggen': 'fitness',
  'Klettern': 'fitness',
  'Schwimmen': 'fitness',
  'Yoga': 'fitness',
  'Radfahren': 'fitness',
  'Wandern': 'fitness',
  'Kochen': 'cooking',
  'Backen': 'cooking',
  'Gaming': 'tech',
  'Programmieren': 'tech',
  'Fotografie': 'art',
  'Musik': 'art',
  'Malen': 'art',
  'Filme': 'art',
  'Lesen': 'teaching',
  'Schach': 'business',
  'Brettspiele': 'social',
  'Tanzen': 'social',
  'Reisen': 'social',
  'Gartenarbeit': 'craft',
  'Basteln': 'craft',
  'Angeln': 'craft',
  'Motorrad': 'driving',
};

export { hashSeed };
