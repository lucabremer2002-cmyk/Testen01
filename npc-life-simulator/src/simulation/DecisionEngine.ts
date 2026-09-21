import { clamp, clamp01 } from '../core/math';
import { MINUTES_PER_DAY } from '../time/calendar';
import { stressUrgency, urgency } from '../npc/Needs';
import { goalPriority } from '../npc/Goals';
import { RETIREMENT_AGE } from '../npc/lifecycle';
import type { ActionType, NPC, Needs } from '../npc/types';
import { ACTIONS, PAID_VENUES } from './Actions';
import type { SimulationEngine } from './SimulationEngine';
import { PLACES } from '../world/placeSets';
import { pickMode, travelMinutes } from '../world/Travel';

export interface Candidate {
  type: ActionType;
  locationId: number;
  partner: number;
  duration: number;
  travel: number;
  score: number;
}

const NEED_WEIGHT: Record<keyof Needs, number> = {
  hunger: 1.35,
  energy: 1.4,
  hygiene: 0.72,
  social: 1.0,
  fun: 0.92,
  comfort: 0.6,
  safety: 0.7,
  stress: 1.15,
};

const MAX_CANDIDATES = 20;

/**
 * Utility-based action selection. Every candidate is scored against needs,
 * personality, goals, emotions, money, time of day and travel distance; the
 * final pick is a weighted draw among the best few so NPCs stay unpredictable
 * without becoming random.
 */
export class DecisionEngine {
  /** Reused buffers - decision making must not allocate per call. */
  private pool: Candidate[] = [];
  private used = 0;
  /** Debug hook: scores of the last decision, only filled for detailed NPCs. */
  lastCandidates: Candidate[] = [];
  lastNpcId = -1;
  /** Set while fast-forwarding: fewer candidates, much longer blocks. */
  private turbo = false;
  /** Financial pressure of the NPC being scored; computed once per decision. */
  private pressure = 0;
  /** Euros this NPC can spend freely per day; the yardstick for every price. */
  private dailyBudget = 20;
  /** Preallocated softmax weights - `decide` runs millions of times. */
  private weights = new Float64Array(MAX_CANDIDATES);

  constructor(private engine: SimulationEngine) {
    for (let i = 0; i < MAX_CANDIDATES; i++) {
      this.pool.push({ type: 'idle', locationId: -1, partner: -1, duration: 30, travel: 0, score: 0 });
    }
  }

  private add(type: ActionType, locationId: number, partner: number, duration: number): Candidate | null {
    if (this.used >= MAX_CANDIDATES || locationId < 0) return null;
    const c = this.pool[this.used++];
    c.type = type;
    c.locationId = locationId;
    c.partner = partner;
    c.duration = duration;
    c.travel = 0;
    c.score = 0;
    return c;
  }

  /**
   * Chooses the next action for an NPC. `turbo` collapses the day into a few
   * long blocks - used while fast-forwarding, where per-action fidelity for
   * unwatched people would cost far more than it is worth.
   */
  decide(npc: NPC, now: number, coarse: boolean, turbo = false): Candidate {
    const e = this.engine;
    const rng = e.rng;
    const hour = (now % MINUTES_PER_DAY) / 60;
    const day = Math.floor(now / MINUTES_PER_DAY);
    const weekend = e.isWeekend(day);
    if (turbo) return this.decideTurbo(npc, hour, weekend);
    this.used = 0;
    this.pressure = e.financialPressure(npc);
    this.dailyBudget = e.discretionaryDaily(npc);

    this.turbo = turbo;
    this.generate(npc, hour, weekend, coarse);

    if (this.used === 0) {
      const fallback = this.pool[0];
      fallback.type = 'relax';
      fallback.locationId = npc.homeId >= 0 ? npc.homeId : npc.locId;
      fallback.partner = -1;
      fallback.duration = 60;
      fallback.travel = 0;
      fallback.score = 1;
      return fallback;
    }

    // Score everything.
    for (let i = 0; i < this.used; i++) {
      const c = this.pool[i];
      c.score = this.score(npc, c, hour, weekend, coarse);
    }

    // Weighted draw among the strongest options; impulsive NPCs spread wider.
    let bestIdx = 0;
    for (let i = 1; i < this.used; i++) if (this.pool[i].score > this.pool[bestIdx].score) bestIdx = i;
    const best = this.pool[bestIdx].score;
    const temperature = 0.55 + npc.p.impulsivity / 110 + (coarse ? 0.1 : 0);
    const invTemp = 1 / temperature;
    const w = this.weights;
    for (let i = 0; i < this.used; i++) {
      const rel = this.pool[i].score / (best || 1);
      // Only options within reach of the best one compete at all.
      w[i] = rel > 0.55 ? Math.pow(rel, invTemp) : 0;
    }
    const idx = rng.weightedIndex(w as unknown as number[], this.used);
    const chosen = this.pool[idx < 0 ? bestIdx : idx];

    // An evening activity ends at bedtime rather than running into the night.
    this.clampToBedtime(npc, chosen, hour);

    if (npc.detailed) {
      this.lastNpcId = npc.id;
      this.lastCandidates = this.pool.slice(0, this.used).map((c) => ({ ...c }));
      this.lastCandidates.sort((a, b) => b.score - a.score);
    }
    return chosen;
  }

  /**
   * The aggregated path used while fast-forwarding. It picks the one activity
   * that plainly dominates for this hour and role, without generating or
   * scoring alternatives. A year of unwatched life does not need utility
   * theory; it needs people to sleep, work, eat and see each other.
   */
  private decideTurbo(npc: NPC, hour: number, weekend: boolean): Candidate {
    const e = this.engine;
    const rng = e.rng;
    const c = this.pool[0];
    c.partner = -1;
    c.travel = 0;
    c.score = 1;
    const home = npc.homeId >= 0 ? npc.homeId : npc.locId;
    const n = npc.needs;
    const age = npc.ageYears;

    const set = (type: ActionType, locationId: number, duration: number, partner = -1) => {
      c.type = type;
      c.locationId = locationId >= 0 ? locationId : npc.locId;
      c.duration = Math.max(45, Math.round(duration));
      c.partner = partner;
      return c;
    };

    // Night, or simply exhausted: sleep through to the personal wake time.
    if (this.inSleepWindow(npc, hour) || n.energy < 32) {
      let untilWake = ((npc.wakeHour - hour + 24) % 24) * 60;
      if (untilWake < 120 || untilWake > 700) untilWake = rng.float(380, 540);
      return set('sleep', home, untilWake);
    }

    // The working day, in one block per shift.
    if (npc.jobId >= 0 && npc.employerId >= 0) {
      const company = e.companies[npc.employerId];
      const prof = e.professionOf(npc);
      if (company && !company.bankrupt && prof && (prof.weekend || !weekend)) {
        const [startH, endH] = prof.hours;
        if (hour >= startH - 1 && hour < endH - 0.5) {
          return set('work', company.buildingId, (endH - Math.max(hour, startH)) * 60);
        }
      }
    } else if (age >= 18 && age < 67 && !npc.retired && !weekend && hour > 8 && hour < 16) {
      const spot = e.world.nearestOfTypes(npc.locId, PLACES.jobCentre);
      if (spot >= 0 && rng.chance(0.5)) return set('job_hunt', spot, 150);
    }

    if (age >= 6 && age <= 17 && !weekend && hour >= 7.5 && hour < 14) {
      const school = e.world.nearestOfTypes(npc.locId, PLACES.school);
      if (school >= 0) return set('school', school, (14.2 - hour) * 60);
    }

    // Meals keep hunger and the food economy moving.
    if (n.hunger < 62) {
      if (npc.pantry > 0) return set(npc.locId === home ? 'eat_home' : 'eat_packed', npc.locId, 60);
      const shop = e.world.nearestOfTypes(npc.locId, PLACES.supermarket);
      if (shop >= 0 && npc.pantry < 4) return set('groceries', shop, 60);
      const rest = e.world.nearestOfTypes(npc.locId, PLACES.restaurant);
      if (rest >= 0) return set('eat_out', rest, 75);
    }
    if (npc.pantry < 3 && age >= 14 && hour > 9 && hour < 20) {
      const shop = e.world.nearestOfTypes(npc.locId, PLACES.supermarket);
      if (shop >= 0) return set('groceries', shop, 60);
    }

    // One social outlet keeps the relationship graph alive across the jump.
    if (age >= 14 && (n.social < 58 || npc.emo.loneliness > 45) && npc.links.length) {
      const partnerId = npc.family.partner;
      const otherId =
        partnerId >= 0 && rng.chance(0.55)
          ? partnerId
          : npc.links[rng.int(0, npc.links.length - 1)];
      const other = e.npcs[otherId];
      if (other?.alive) {
        const spot =
          hour > 17 ? this.socialSpot(npc, otherId, hour) : otherId === partnerId ? home : npc.locId;
        return set(otherId === partnerId ? 'date' : 'socialize', spot, rng.float(120, 220), otherId);
      }
    }

    if (n.hygiene < 55) return set('hygiene', home, 45);
    return set('relax', home, rng.float(150, 280));
  }

  /**
   * Shortens a leisure activity so it cannot run past the NPC's own bedtime.
   * Without this, a long evening with the family silently swallows the night.
   */
  private clampToBedtime(npc: NPC, c: Candidate, hour: number): void {
    if (c.type === 'sleep' || c.type === 'work' || c.type === 'overtime' || c.type === 'hospital') return;
    const bed = npc.sleepHour % 24;
    // Minutes from now until bedtime, wrapping around midnight.
    let untilBed = (bed - hour) * 60;
    if (untilBed < 0) untilBed += 24 * 60;
    if (untilBed > 6 * 60) return; // bedtime is not close yet
    c.duration = Math.max(20, Math.min(c.duration, untilBed));
  }

  // ---------------------------------------------------------------- candidates

  private generate(npc: NPC, hour: number, weekend: boolean, coarse: boolean): void {
    const e = this.engine;
    const rng = e.rng;
    const home = npc.homeId;
    const age = npc.ageYears;
    const n = npc.needs;
    const durScale = this.turbo ? 3.4 : coarse ? 1.3 : 1;
    const dur = (type: ActionType, mul = 1) => {
      const [a, b] = ACTIONS[type].duration;
      return Math.round(rng.float(a, b) * mul * durScale);
    };

    // --- small children -----------------------------------------------------
    // Toddlers do not roam the city on their own; their world is the home.
    if (age < 6) {
      const base = home >= 0 ? home : npc.locId;
      if (base >= 0) {
        this.add('sleep', base, -1, this.sleepDuration(npc, hour, coarse));
        if (n.hunger < 85) this.add('eat_home', base, -1, dur('eat_home'));
        if (n.hygiene < 80) this.add('hygiene', base, -1, dur('hygiene'));
        this.add('relax', base, -1, dur('relax'));
        const carer = npc.family.parents.find((id) => {
          const p = e.npcs[id];
          return p?.alive && p.homeId === npc.homeId;
        });
        if (carer !== undefined) this.add('family_time', base, carer, dur('family_time'));
      }
      return;
    }

    // --- rest -------------------------------------------------------------
    if (home >= 0) {
      const sleepWindow = this.inSleepWindow(npc, hour);
      if (n.energy < 92 || sleepWindow) {
        this.add('sleep', home, -1, this.sleepDuration(npc, hour, coarse));
      }
      if (n.hygiene < 75) this.add('hygiene', home, -1, dur('hygiene'));
      if (n.comfort < 75 || n.fun < 60) this.add('relax', home, -1, dur('relax'));
    }

    // --- food -------------------------------------------------------------
    if (n.hunger < 78) {
      if (home >= 0 && npc.pantry > 0) this.add('eat_home', home, -1, dur('eat_home'));
      // Away from home with food in the cupboard: a packed lunch, no travel.
      if (npc.pantry > 0 && npc.locId !== home && npc.locId >= 0) {
        this.add('eat_packed', npc.locId, -1, dur('eat_packed'));
      }
      // Children do not go to a restaurant unaccompanied.
      if (age >= 14) {
        const rest = e.world.nearestOfTypes(npc.locId, PLACES.restaurant);
        if (rest >= 0) this.add('eat_out', rest, -1, dur('eat_out'));
      }
    }
    if (npc.pantry < 5 && age >= 14) {
      const sm = e.world.nearestOfTypes(npc.locId, PLACES.supermarket);
      if (sm >= 0) this.add('groceries', sm, -1, dur('groceries'));
    }

    // --- work, school, study ---------------------------------------------
    if (npc.jobId >= 0 && npc.employerId >= 0) {
      const company = e.companies[npc.employerId];
      const prof = e.professionOf(npc);
      if (company && !company.bankrupt && prof) {
        const worksToday = prof.weekend || !weekend;
        const [startH, endH] = prof.hours;
        const h = hour < startH - 2 && endH > 24 ? hour + 24 : hour;
        if (worksToday && h >= startH - 1.5 && h < endH - 0.4) {
          const remaining = Math.max(45, (endH - Math.max(h, startH)) * 60);
          this.add('work', company.buildingId, -1, Math.round(remaining));
        } else if (worksToday && h >= endH - 0.5 && h < endH + 2.5) {
          // Staying on after the shift, rather than competing with the shift itself.
          if (npc.p.ambition > 58 && n.energy > 35) {
            this.add('overtime', company.buildingId, -1, dur('overtime'));
          }
        }
      }
    } else if (age >= 18 && age < RETIREMENT_AGE && !npc.retired && !weekend && hour > 8 && hour < 17) {
      const spot = e.world.nearestOfTypes(npc.locId, PLACES.jobCentre);
      if (spot >= 0) this.add('job_hunt', spot, -1, dur('job_hunt'));
    }

    if (age >= 6 && age <= 17 && !weekend && hour >= 7 && hour < 14) {
      const school = e.world.nearestOfTypes(npc.locId, PLACES.school);
      if (school >= 0) this.add('school', school, -1, Math.round((14.5 - hour) * 60));
    }
    if (age >= 18 && age <= 30 && npc.education < 4 && goalPriority(npc, 'education') > 40 && !weekend) {
      if (hour >= 9 && hour < 18) {
        const uni = e.world.nearestOfTypes(npc.locId, PLACES.university);
        if (uni >= 0) this.add('study', uni, -1, dur('study'));
      }
    }

    // --- social ------------------------------------------------------------
    const wantsCompany = n.social < 72 || npc.emo.loneliness > 45 || npc.p.extraversion > 68;
    if (wantsCompany && age >= 8) {
      const friend = e.pickSocialTarget(npc);
      if (friend >= 0) {
        // Under-14s meet up at home or in the park, never in a bar.
        const spot = age >= 14 ? this.socialSpot(npc, friend, hour) : e.world.nearestOfTypes(npc.locId, PLACES.park);
        if (spot >= 0) this.add('socialize', spot, friend, dur('socialize'));
      }
    }

    const partnerId = npc.family.partner;
    if (partnerId >= 0) {
      const partner = e.npcs[partnerId];
      // Couples go out when they want company, not around the clock.
      const wantsTime = n.social < 64 || npc.emo.loneliness > 34 || (npc.emo.love > 55 && n.social < 80);
      if (partner?.alive && wantsTime && (hour > 15 || weekend)) {
        const spot = hour > 17 || weekend ? this.socialSpot(npc, partnerId, hour) : home;
        if (spot >= 0) this.add('date', spot, partnerId, dur('date'));
      }
    } else if (age >= 17 && age < 75 && (npc.emo.loneliness > 38 || goalPriority(npc, 'marry') > 45)) {
      if (hour > 14 || weekend) {
        const spot = e.world.nearestOfTypes(npc.locId, PLACES.nightOut);
        if (spot >= 0) this.add('romance_hunt', spot, -1, dur('romance_hunt'));
      }
    }

    // Family duty: young children need someone at home.
    if (home >= 0 && npc.family.children.length > 0) {
      let hasSmallChild = false;
      for (const cId of npc.family.children) {
        const child = e.npcs[cId];
        if (child?.alive && child.ageYears < 12) {
          hasSmallChild = true;
          break;
        }
      }
      if (hasSmallChild && (hour < 8.5 || hour > 15)) this.add('childcare', home, -1, dur('childcare'));
      if (weekend || hour > 17) this.add('family_time', home, -1, dur('family_time'));
    }

    // --- leisure -----------------------------------------------------------
    // Fast-forward keeps only the load-bearing options: rest, food, work,
    // school and one social outlet. The rest is noise at that resolution.
    if (this.turbo) return;

    if (!coarse && age >= 12 && (npc.skills.fitness < 85 || n.stress > 45)) {
      const gym = e.world.nearestOfTypes(npc.locId, PLACES.gym);
      if (gym >= 0) this.add('gym', gym, -1, dur('gym'));
    }
    if (hour > 7 && hour < 21 && (n.fun < 68 || n.stress > 42)) {
      const park = e.world.nearestOfTypes(npc.locId, PLACES.park);
      if (park >= 0) this.add('park', park, -1, dur('park'));
    }
    if (!coarse && age >= 14 && n.fun < 45 && hour > 9 && hour < 20 && e.affordable(npc, 'clothing', 0.45)) {
      const mall = e.world.nearestOfTypes(npc.locId, PLACES.shopping);
      if (mall >= 0) this.add('shop', mall, -1, dur('shop'));
    }

    // --- necessities -------------------------------------------------------
    if (npc.a.health < 45) {
      const hosp = e.world.nearestOfTypes(npc.locId, PLACES.hospital);
      if (hosp >= 0) this.add('hospital', hosp, -1, dur('hospital'));
    }
    if (!coarse && npc.money > 1800 && hour > 9 && hour < 17 && !weekend) {
      const bank = e.world.nearestOfTypes(npc.locId, PLACES.bank);
      if (bank >= 0) this.add('bank', bank, -1, dur('bank'));
    }
  }

  private socialSpot(npc: NPC, otherId: number, hour: number): number {
    const e = this.engine;
    const other = e.npcs[otherId];
    // Meet somewhere between the two, biased toward evening venues.
    const anchor = other?.alive && other.locId >= 0 ? other.locId : npc.locId;
    const places =
      hour >= 19 ? PLACES.socialEvening : hour >= 14 ? PLACES.socialAfternoon : PLACES.socialDay;
    const spot = e.world.nearestOfTypes(anchor, places);
    return spot >= 0 ? spot : e.world.nearestOfTypes(npc.locId, places);
  }

  private inSleepWindow(npc: NPC, hour: number): boolean {
    const s = npc.sleepHour % 24;
    const w = npc.wakeHour;
    return s < w ? hour >= s && hour < w : hour >= s || hour < w;
  }

  private sleepDuration(npc: NPC, hour: number, coarse: boolean): number {
    const need = clamp((100 - npc.needs.energy) / 100, 0.35, 1);
    let target = (7 + need * 2.2) * 60;
    // Sleep until the personal wake time when going to bed in the evening.
    const toWake = ((npc.wakeHour - hour + 24) % 24) * 60;
    if (toWake > 180 && toWake < 660) target = toWake;
    if (coarse) target = Math.max(target, 300);
    return Math.round(clamp(target, 120, 660));
  }

  // ------------------------------------------------------------------ scoring

  private score(npc: NPC, c: Candidate, hour: number, weekend: boolean, coarse: boolean): number {
    const e = this.engine;
    const a = ACTIONS[c.type];
    const hours = c.duration / 60;
    const n = npc.needs;
    let s = 0;

    // 1) Need satisfaction, capped by actual headroom.
    for (let i = 0; i < a.effectList.length; i++) {
      const k = a.effectList[i].k;
      const perHour = a.effectList[i].v;
      const cur = n[k];
      const w = NEED_WEIGHT[k];
      if (k === 'stress') {
        if (perHour < 0) {
          const rel = Math.min(-perHour * hours, cur);
          s += stressUrgency(cur) * (rel / 100) * w * 11;
        } else {
          s -= stressUrgency(clamp(cur + perHour * hours, 0, 100)) * (perHour * hours / 100) * w * 8;
        }
      } else if (perHour > 0) {
        const gain = Math.min(perHour * hours, 100 - cur);
        s += urgency(cur) * (gain / 100) * w * 11;
      } else {
        const loss = Math.min(-perHour * hours, cur);
        s -= urgency(clamp(cur + perHour * hours, 0, 100)) * (loss / 100) * w * 6;
      }
    }

    // 2) Personality, goals and emotion. Added before the time factor, so that
    //    a strong personal motive still cannot send someone to the gym at 3 a.m.
    s += this.contextBonus(npc, c, hour, weekend);

    // 3) Time of day fit, applied to the whole motive.
    s *= this.timeFactor(c.type, hour, npc, weekend);

    // 4) Travel cost - impulsive people discount distance.
    const distance = e.world.distance(npc.locId, c.locationId);
    const mode = pickMode(distance, npc.ownsCar, npc.ageYears);
    c.travel = distance < 1 ? 0 : travelMinutes(distance, mode);
    // Travel is already implicit in the density term below, so the explicit
    // penalty only captures the dislike of commuting itself.
    const patience = 0.03 + (1 - npc.p.impulsivity / 100) * 0.028;
    s -= c.travel * patience;

    // 5) Money. A price only means something relative to what this person can
    //    actually spend in a day - measuring it against total savings would let
    //    anyone with a bank balance eat out three times a day.
    const venue = e.world.buildings[c.locationId];
    if (a.costCategory && venue && PAID_VENUES.has(venue.type)) {
      const cost = e.market.price(a.costCategory) * a.costUnits;
      const liquid = npc.money + npc.bank;
      if (cost > liquid + 120) return 0.01; // simply not affordable
      s -= (cost / this.dailyBudget) * (8 + this.pressure * 30);
    }

    // 6) Weather makes outdoor options better or worse.
    if (a.outdoor) s *= e.world.weather.outdoorFactor();

    // 7) Staying put is slightly preferable; repeating the same thing is not.
    if (c.locationId === npc.locId) s += 0.8;
    if (c.type === npc.action.type && !coarse) s -= 1.6;

    // 8) Utility density, not total utility. Without this the longest, most
    //    need-bundling action always wins and NPCs never stop to eat. The
    //    duration term is capped: committing eight hours to sleep is not eight
    //    times the opportunity cost of committing one, because the hours given
    //    up are night-time hours nothing else competes for.
    const occupied = (Math.min(c.duration, 200) + c.travel) / 60;
    return Math.max(0.01, s / Math.pow(occupied + 0.35, 0.85));
  }

  private timeFactor(type: ActionType, hour: number, npc: NPC, weekend: boolean): number {
    return this.baseTimeFactor(type, hour, npc, weekend) * nightPenalty(type, hour);
  }

  private baseTimeFactor(type: ActionType, hour: number, npc: NPC, weekend: boolean): number {
    switch (type) {
      case 'sleep':
        return this.inSleepWindow(npc, hour) ? 1.75 : npc.needs.energy < 22 ? 0.9 : 0.18;
      case 'eat_home':
      case 'eat_packed':
      case 'eat_out': {
        const meal = Math.max(
          bell(hour, 7.5, 1.3),
          bell(hour, 12.5, 1.5),
          bell(hour, 19, 1.8),
        );
        return 0.5 + meal * 1.1;
      }
      case 'groceries':
        return hour > 8 && hour < 20 ? 1.1 : 0.15;
      case 'work':
      case 'overtime':
        return 1.5;
      case 'school':
      case 'study':
        return 1.35;
      case 'socialize':
      case 'romance_hunt':
        return hour > 16 || weekend ? 1.3 : hour > 11 ? 0.85 : 0.4;
      case 'date':
        return hour > 17 || weekend ? 1.35 : 0.7;
      case 'gym':
        return hour > 6 && hour < 22 ? 1.15 : 0.2;
      case 'park':
        return hour > 8 && hour < 20 ? 1.2 : 0.2;
      case 'shop':
        return hour > 9 && hour < 20 ? 1.1 : 0.1;
      case 'hygiene':
        return Math.abs(hour - npc.wakeHour) < 1.5 || hour > 20 ? 1.4 : 1;
      case 'relax':
        return hour > 17 || weekend ? 1.2 : 0.75;
      case 'childcare':
        // Nobody looks after the children at four in the morning.
        return hour < 6 || hour > 22 ? 0.05 : hour > 16 || weekend ? 1.25 : 0.7;
      case 'family_time':
        return hour > 16 || weekend ? 1.25 : 0.7;
      case 'job_hunt':
        return hour > 8 && hour < 17 ? 1.4 : 0.2;
      default:
        return 1;
    }
  }

  private contextBonus(npc: NPC, c: Candidate, hour: number, weekend: boolean): number {
    const e = this.engine;
    let b = 0;
    const p = npc.p;

    switch (c.type) {
      case 'work': {
        const pressure = this.pressure;
        b += 14 + pressure * 26 + (p.conscientiousness / 100) * 12 + (p.ambition / 100) * 8;
        b += (goalPriority(npc, 'career') / 100) * 7;
        // Nobody enjoys work when they are exhausted or furious.
        if (npc.needs.energy < 22) b -= 14;
        if (npc.emo.anger > 70) b -= 6;
        if (npc.needs.stress > 88) b -= 10;
        break;
      }
      case 'overtime':
        b += (p.ambition / 100) * 12 + this.pressure * 10 - (npc.family.partner >= 0 ? 4 : 0);
        break;
      case 'job_hunt':
        b += 10 + this.pressure * 30 + (p.conscientiousness / 100) * 8;
        b += npc.emo.motivation / 14;
        break;
      case 'school':
        b += 16 + (npc.a.discipline / 100) * 6;
        break;
      case 'study':
        b += 8 + (goalPriority(npc, 'education') / 100) * 12 + (npc.a.intelligence / 100) * 5;
        break;
      case 'socialize': {
        b += (p.extraversion / 100) * 8 + (npc.emo.loneliness / 100) * 9;
        const rel = e.rels.get(npc.id, c.partner);
        if (rel) b += (rel.closeness / 100) * 6 + (rel.sympathy / 100) * 4 - (rel.conflict / 100) * 7;
        if (npc.emo.sadness > 55) b += 5; // people reach out when they are down
        break;
      }
      case 'date': {
        const rel = e.rels.get(npc.id, c.partner);
        b += 2 + (npc.emo.love / 100) * 7;
        if (rel) b += (rel.closeness / 100) * 7 - (rel.conflict / 100) * 10;
        if (npc.family.married) b -= 2;
        break;
      }
      case 'romance_hunt':
        b += (goalPriority(npc, 'marry') / 100) * 9 + (npc.emo.loneliness / 100) * 7 + (npc.a.confidence / 100) * 4;
        break;
      case 'family_time':
      case 'childcare':
        b += (p.empathy / 100) * 8 + (p.loyalty / 100) * 5;
        break;
      case 'gym':
        b += (goalPriority(npc, 'fitness') / 100) * 9 + (npc.a.discipline / 100) * 5;
        if (npc.hobbies.includes('Joggen') || npc.hobbies.includes('Fußball')) b += 3;
        break;
      case 'park':
        b += (p.openness / 100) * 4 + (npc.needs.stress / 100) * 5;
        if (npc.hobbies.includes('Wandern') || npc.hobbies.includes('Radfahren')) b += 2.5;
        break;
      case 'shop':
        b += (p.impulsivity / 100) * 6 - this.pressure * 12;
        break;
      case 'groceries':
        // Running out of food is a real problem, so stocking up is worth it.
        b += (6 - Math.min(6, npc.pantry)) * 2.2 + (100 - npc.needs.hunger) / 14;
        b += (p.conscientiousness / 100) * 4;
        break;
      case 'eat_home':
        // Thrifty and home-loving people cook rather than go out.
        b += (p.conscientiousness / 100) * 3 + (100 - p.extraversion) / 90 + this.pressure * 6;
        break;
      case 'eat_packed':
        b += (p.conscientiousness / 100) * 4 + this.pressure * 7;
        break;
      case 'eat_out':
        b += (p.extraversion / 100) * 3 - this.pressure * 8;
        break;
      case 'relax':
        b += (100 - p.extraversion) / 100 * 3 + (npc.needs.stress / 100) * 4;
        break;
      case 'hospital':
        b += (100 - npc.a.health) / 4;
        break;
      case 'bank':
        b += (p.conscientiousness / 100) * 5 + (npc.money > 3000 ? 4 : 0);
        break;
      case 'sleep':
        if (weekend && hour < 10) b += 3;
        break;
      default:
        break;
    }

    // Depression makes everything but rest and company feel pointless.
    if (npc.emo.sadness > 65 && c.type !== 'sleep' && c.type !== 'socialize' && c.type !== 'relax') {
      b -= (npc.emo.sadness - 65) / 9;
    }
    return b;
  }
}

/**
 * Deep night suppresses everything except sleeping and night shifts. Without
 * this, NPCs visit friends at three in the morning because their social need
 * happens to be low and nothing forbids it.
 */
function nightPenalty(type: ActionType, hour: number): number {
  if (type === 'sleep' || type === 'work' || type === 'overtime' || type === 'hospital') return 1;
  const deepNight = hour >= 1 && hour < 6;
  if (!deepNight) return hour >= 23.5 || hour < 1 ? 0.55 : 1;
  // A night out can run into the small hours, everything else cannot.
  if (type === 'romance_hunt' || type === 'socialize' || type === 'date') return hour < 2.5 ? 0.3 : 0.05;
  if (type === 'hygiene' || type === 'eat_home' || type === 'relax') return 0.12;
  return 0.05;
}

/** Gaussian bump used for meal times and similar daily peaks. */
function bell(hour: number, center: number, width: number): number {
  const d = (hour - center) / width;
  return clamp01(Math.exp(-d * d));
}
