import { clamp, clamp100 } from '../../core/math';
import { DAYS_PER_YEAR } from '../../time/calendar';
import { applyEmotion } from '../../npc/Emotions';
import { remember } from '../../npc/Memory';
import { addGoal, setGoalProgress } from '../../npc/Goals';
import { RETIREMENT_AGE, isWorkingAge } from '../../npc/lifecycle';
import { fullName } from '../../npc/NPCFactory';
import type { NPC } from '../../npc/types';
import { MAX_CAREER_LEVEL, PROFESSION_BY_ID, levelTitle, salaryFor } from '../../economy/professions';
import type { Company, Profession } from '../../economy/types';
import type { SimulationEngine } from '../SimulationEngine';

/** Share of gross pay that actually reaches the account after tax and social contributions. */
const NET_FACTOR = 0.63;
const PENSION_NET_FACTOR = 0.82;

interface Opening {
  companyId: number;
  prof: Profession;
}

/** How well an NPC fits a job, 0..100. Education is a hard-ish gate. */
export function matchScore(npc: NPC, prof: Profession): number {
  if (npc.education < prof.minEducation - 1) return 0;
  const eduPenalty = npc.education < prof.minEducation ? 22 : 0;
  const skill = npc.skills[prof.mainSkill] * 0.6 + npc.skills[prof.secondSkill] * 0.25;
  const traits = npc.a.discipline * 0.1 + npc.a.social * 0.05;
  const experience = Math.min(18, Math.max(0, npc.ageYears - 18) * 0.5);
  return clamp(skill + traits + experience - eduPenalty, 0, 100);
}

/** All currently unfilled positions in the city. */
export function collectOpenings(engine: SimulationEngine): Opening[] {
  const out: Opening[] = [];
  for (const c of engine.companies) {
    if (c.bankrupt) continue;
    for (const pos of c.positions) {
      if (pos.filled >= pos.max) continue;
      const prof = PROFESSION_BY_ID.get(pos.prof);
      if (prof) out.push({ companyId: c.id, prof });
    }
  }
  return out;
}

export function hire(
  engine: SimulationEngine,
  npc: NPC,
  company: Company,
  prof: Profession,
  level: number,
  announce = true,
): void {
  const pos = company.positions.find((p) => p.prof === prof.id);
  if (!pos || pos.filled >= pos.max) return;
  pos.filled++;
  company.employees.push(npc.id);
  npc.jobId = engine.professionIndex(prof.id);
  npc.employerId = company.id;
  npc.careerLevel = level;
  npc.salary = salaryFor(prof, level, engine.market.wageFactor);
  npc.jobSinceDay = engine.day;
  npc.unemployedSinceDay = -1;
  npc.applications.length = 0;
  npc.applicationDay = -1;
  npc.retired = false;
  setGoalProgress(npc, 'career', Math.min(100, level * 18 + 10));

  if (!announce) return;
  applyEmotion(npc, { happiness: 16, pride: 10, motivation: 14, anxiety: -8, stress: -14 });
  remember(npc, engine.day, 'hired', `Neue Stelle als ${prof.label} bei ${company.name}`, 45, -1);
  engine.emit({
    type: 'hired',
    subjects: [npc.id],
    companyId: company.id,
    buildingId: company.buildingId,
    text: `${fullName(npc)} arbeitet jetzt als ${levelTitle(prof, level)} bei ${company.name}.`,
    importance: 42,
  });
  // New colleagues become part of the social graph.
  connectColleagues(engine, npc, company);
}

export function connectColleagues(engine: SimulationEngine, npc: NPC, company: Company): void {
  const rng = engine.rng;
  const sample = Math.min(company.employees.length, 6);
  for (let i = 0; i < sample; i++) {
    const otherId = company.employees[rng.int(0, company.employees.length - 1)];
    if (otherId === npc.id) continue;
    const other = engine.npcs[otherId];
    if (!other?.alive) continue;
    const rel = engine.rels.ensure(npc, other, engine.day);
    if (rel.type === 'stranger') rel.type = 'colleague';
    engine.rels.modify(rel, npc.id, { closeness: 6, sympathy: 4, trust: 3 });
  }
}

export function leaveJob(engine: SimulationEngine, npc: NPC, reason: 'fired' | 'quit' | 'retire' | 'bankrupt'): void {
  const company = engine.companies[npc.employerId];
  const prof = engine.professionOf(npc);
  if (company) {
    const i = company.employees.indexOf(npc.id);
    if (i >= 0) company.employees.splice(i, 1);
    if (prof) {
      const pos = company.positions.find((p) => p.prof === prof.id);
      if (pos) pos.filled = Math.max(0, pos.filled - 1);
    }
  }
  const wasSalary = npc.salary;
  npc.jobId = -1;
  npc.employerId = -1;
  npc.careerLevel = 0;
  npc.salary = 0;
  npc.jobSinceDay = -1;
  npc.unemployedSinceDay = engine.day;

  if (reason === 'retire') {
    npc.retired = true;
    // A modest state pension keeps seniors in the economy.
    npc.salary = Math.round(clamp(wasSalary * 0.52, 900, 3200));
    applyEmotion(npc, { happiness: 6, calm: 12, pride: 6, motivation: -10 });
    remember(npc, engine.day, 'graduation', 'In den Ruhestand gegangen', 40, -1, 68);
    engine.emit({
      type: 'retirement',
      subjects: [npc.id],
      text: `${fullName(npc)} geht nach ${prof ? prof.label : 'langer Berufstätigkeit'} in den Ruhestand.`,
      narrative: `ging ${fullName(npc)} in den Ruhestand`,
      importance: 52,
    });
    return;
  }

  if (reason === 'fired' || reason === 'bankrupt') {
    applyEmotion(npc, {
      sadness: 24,
      anger: reason === 'fired' ? 22 : 10,
      anxiety: 20,
      motivation: -18,
      pride: -16,
      stress: 30,
    });
    remember(
      npc,
      engine.day,
      'fired',
      reason === 'bankrupt'
        ? `Arbeitsplatz verloren: ${company?.name ?? 'Arbeitgeber'} ist pleite`
        : `Bei ${company?.name ?? 'der Firma'} gekündigt worden`,
      -70,
      -1,
    );
    addGoal(npc, 'career', 78, engine.day);
    engine.emit({
      type: 'fired',
      subjects: [npc.id],
      companyId: company?.id ?? -1,
      text:
        reason === 'bankrupt'
          ? `${fullName(npc)} verliert die Stelle durch die Insolvenz von ${company?.name ?? 'der Firma'}.`
          : `${fullName(npc)} wurde bei ${company?.name ?? 'der Firma'} entlassen.`,
      narrative:
        reason === 'bankrupt'
          ? `verlor ${fullName(npc)} die Stelle durch die Insolvenz von ${company?.name ?? 'der Firma'}`
          : `verlor ${fullName(npc)} die Stelle bei ${company?.name ?? 'der Firma'}`,
      importance: 62,
    });
    const rumor = engine.rumors.create(
      npc.id,
      'jobloss',
      true,
      45,
      engine.day,
      `${fullName(npc)} hat den Job verloren.`,
    );
    npc.known.add(rumor.id);
  } else {
    applyEmotion(npc, { anxiety: 10, motivation: 6, stress: 8 });
    remember(npc, engine.day, 'fired', `Bei ${company?.name ?? 'der Firma'} selbst gekündigt`, -25, -1, 58);
    engine.emit({
      type: 'quit',
      subjects: [npc.id],
      companyId: company?.id ?? -1,
      text: `${fullName(npc)} hat bei ${company?.name ?? 'der Firma'} gekündigt.`,
      narrative: `kündigte ${fullName(npc)} bei ${company?.name ?? 'der Firma'}`,
      importance: 44,
    });
  }
}

/** Continuous effects while an NPC is on shift. */
export function applyWorkShift(engine: SimulationEngine, npc: NPC, hours: number): void {
  const prof = engine.professionOf(npc);
  if (!prof) return;
  const company = engine.companies[npc.employerId];
  if (!company) return;

  // Skills grow where the job uses them.
  const learn = 0.028 * hours * (0.5 + npc.a.discipline / 140 + npc.a.intelligence / 220);
  npc.skills[prof.mainSkill] = clamp100(npc.skills[prof.mainSkill] + learn);
  npc.skills[prof.secondSkill] = clamp100(npc.skills[prof.secondSkill] + learn * 0.45);

  // Performance follows condition, not just talent.
  const target =
    32 +
    npc.a.discipline * 0.32 +
    npc.skills[prof.mainSkill] * 0.26 +
    npc.emo.motivation * 0.14 -
    npc.needs.stress * 0.18 -
    Math.max(0, 45 - npc.needs.energy) * 0.3;
  npc.performance = clamp100(npc.performance + (clamp(target, 0, 100) - npc.performance) * 0.04 * hours);

  // The company earns from the work being done.
  // Labour costs land near 60-70% of the value produced, as in real firms.
  const value = (npc.salary / 165) * (0.95 + npc.performance / 110) * hours;
  company.revenue += value;
}

/** Sends out job applications. Results arrive days later, not instantly. */
export function tryApplications(engine: SimulationEngine, npc: NPC): void {
  if (npc.jobId >= 0 || npc.retired) return;
  if (npc.applications.length > 0 && engine.day - npc.applicationDay < 9) return;
  const openings = engine.openingsCache ?? collectOpenings(engine);
  if (!openings.length) return;

  const rng = engine.rng;
  npc.applications.length = 0;
  npc.applicationDay = engine.day;
  // Look at a handful of openings, pick the ones that actually fit.
  const looks = Math.min(openings.length, 14);
  const scored: { o: Opening; s: number }[] = [];
  for (let i = 0; i < looks; i++) {
    const o = openings[rng.int(0, openings.length - 1)];
    const fit = matchScore(npc, o.prof);
    if (fit < 18) continue;
    const distance = engine.world.distance(
      npc.homeId >= 0 ? npc.homeId : npc.locId,
      engine.companies[o.companyId].buildingId,
    );
    // Ambitious people chase pay, comfortable people chase proximity.
    const s =
      fit * 0.6 +
      (o.prof.baseSalary / 90) * (npc.p.ambition / 100) -
      (distance / 1000) * (4 + (100 - npc.p.ambition) / 20) +
      rng.float(0, 18);
    scored.push({ o, s });
  }
  scored.sort((a, b) => b.s - a.s);
  for (const e of scored.slice(0, 3)) npc.applications.push(e.o.companyId * 1000 + engine.professionIndex(e.o.prof.id));
  applyEmotion(npc, { anxiety: 4, motivation: 5 });
}

/** Resolves pending applications after a realistic waiting period. */
function resolveApplications(engine: SimulationEngine, npc: NPC): void {
  if (!npc.applications.length || npc.applicationDay < 0) return;
  const waited = engine.day - npc.applicationDay;
  if (waited < 3) return;
  const rng = engine.rng;

  for (const encoded of npc.applications) {
    const companyId = Math.floor(encoded / 1000);
    const profIdx = encoded % 1000;
    const company = engine.companies[companyId];
    const prof = PROFESSION_BY_ID.get(engine.professionIds[profIdx]);
    if (!company || company.bankrupt || !prof) continue;
    const pos = company.positions.find((p) => p.prof === prof.id);
    if (!pos || pos.filled >= pos.max) continue;

    const fit = matchScore(npc, prof);
    // Reputation, charm and sheer luck all matter.
    const chance = clamp(
      (fit / 100) * 0.62 + (npc.reputation / 100) * 0.12 + (npc.a.confidence / 100) * 0.1 - waited * 0.004,
      0.03,
      0.85,
    );
    if (rng.chance(chance)) {
      const level = npc.ageYears > 30 && fit > 65 ? Math.min(2, Math.floor(fit / 35)) : 0;
      hire(engine, npc, company, prof, level);
      return;
    }
  }

  if (waited > 12) {
    npc.applications.length = 0;
    applyEmotion(npc, { disappointment: 12, motivation: -8, sadness: 6, stress: 6 });
  }
}

/** Daily work-related routine for the whole city. */
export function runWorkDay(engine: SimulationEngine, day: number): void {
  engine.openingsCache = collectOpenings(engine);
  const rng = engine.rng;

  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    const age = npc.ageYears;

    if (npc.jobId < 0 && !npc.retired && isWorkingAge(age)) {
      resolveApplications(engine, npc);
      // Long-term unemployment wears people down.
      if (npc.unemployedSinceDay >= 0 && day - npc.unemployedSinceDay > 60 && rng.chance(0.04)) {
        applyEmotion(npc, { sadness: 6, anxiety: 6, motivation: -5, stress: 5 });
      }
      continue;
    }

    if (engine.shouldRetire(npc) && npc.jobId >= 0) {
      leaveJob(engine, npc, 'retire');
      continue;
    }
    if (npc.retired && age >= RETIREMENT_AGE) continue;

    if (npc.jobId >= 0) {
      // Promotions are evaluated daily rather than at month end, so that the
      // whole city is not promoted on the first of every month.
      const prof0 = engine.professionOf(npc);
      const company0 = engine.companies[npc.employerId];
      if (prof0 && company0 && !company0.bankrupt && npc.careerLevel < MAX_CAREER_LEVEL) {
        const tenureYears = (day - npc.jobSinceDay) / DAYS_PER_YEAR;
        const monthly =
          (npc.performance - 64) / 1600 +
          Math.min(tenureYears, 12) * 0.0022 +
          (npc.p.ambition / 100) * 0.004 +
          (company0.lastProfit > 0 ? 0.003 : -0.004);
        if (monthly > 0 && rng.chance(monthly / 30)) promote(engine, npc, prof0, company0);
      }

      // Quitting: unhappy, well-off or badly matched people move on.
      const prof = engine.professionOf(npc);
      if (prof && rng.chance(0.0016)) {
        const misery = npc.needs.stress / 100 + (1 - npc.performance / 100) * 0.5;
        const boredom = (day - npc.jobSinceDay) / DAYS_PER_YEAR / 18;
        const drive = npc.p.ambition / 100 + npc.p.risk / 140;
        if (misery + boredom + drive > 1.75 && engine.netWorth(npc) > engine.monthlyCost(npc) * 2) {
          leaveJob(engine, npc, 'quit');
        }
      }
    }
  }
}

/** Monthly payroll, promotions and layoffs. */
export function runWorkMonth(engine: SimulationEngine): void {
  const rng = engine.rng;
  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.retired && npc.salary > 0) {
      engine.bank.earn(npc, npc.salary * PENSION_NET_FACTOR);
      engine.ledger.addIncome('pension', npc.salary * PENSION_NET_FACTOR);
      continue;
    }
    if (npc.jobId < 0) {
      // Basic unemployment support keeps the city from collapsing instantly.
      if (isWorkingAge(npc.ageYears)) {
        engine.bank.earn(npc, 780);
        engine.ledger.addIncome('benefits', 780);
      }
      continue;
    }
    const prof = engine.professionOf(npc);
    const company = engine.companies[npc.employerId];
    if (!prof || !company || company.bankrupt) continue;

    npc.salary = salaryFor(prof, npc.careerLevel, engine.market.wageFactor);
    engine.bank.earn(npc, npc.salary * NET_FACTOR);
    engine.ledger.addIncome('salary', npc.salary * NET_FACTOR);
    // The employer carries the gross cost plus contributions.
    company.costs += npc.salary * 1.21;

    // Firing: sustained poor performance, or cuts when the company bleeds.
    const struggling = company.lossStreak >= 3;
    const badFit = npc.performance < 26;
    if ((badFit && rng.chance(0.22)) || (struggling && rng.chance(0.035 + (100 - npc.performance) / 2200))) {
      leaveJob(engine, npc, 'fired');
    }
  }
}

function promote(engine: SimulationEngine, npc: NPC, prof: Profession, company: Company): void {
  npc.careerLevel++;
  npc.salary = salaryFor(prof, npc.careerLevel, engine.market.wageFactor);
  npc.performance = clamp100(npc.performance - 6); // new level, new expectations
  applyEmotion(npc, { happiness: 22, pride: 24, motivation: 18, stress: 5, anxiety: -6 });
  npc.reputation = clamp100(npc.reputation + 3);
  setGoalProgress(npc, 'career', Math.min(100, npc.careerLevel * 18 + 10));
  remember(npc, engine.day, 'promotion', `Beförderung: ${levelTitle(prof, npc.careerLevel)}`, 60, -1);
  engine.emit({
    type: 'promotion',
    subjects: [npc.id],
    companyId: company.id,
    text: `${fullName(npc)} wurde bei ${company.name} befördert – neue Position: ${levelTitle(prof, npc.careerLevel)}.`,
    narrative: `wurde ${fullName(npc)} bei ${company.name} befördert (${levelTitle(prof, npc.careerLevel)})`,
    importance: 55,
  });
  const r = engine.rumors.create(npc.id, 'promotion', true, 30, engine.day, `${fullName(npc)} wurde befördert.`);
  npc.known.add(r.id);
}
