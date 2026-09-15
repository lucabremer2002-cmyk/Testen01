import { RNG } from '../core/rng';
import { clamp100 } from '../core/math';
import type { Goal, GoalType, NPC } from './types';
import { isWorkingAge, RETIREMENT_AGE } from './lifecycle';

export const GOAL_LABEL: Record<GoalType, string> = {
  career: 'Karriere aufbauen',
  wealth: 'Vermögen aufbauen',
  marry: 'Heiraten',
  children: 'Kinder bekommen',
  own_home: 'Eigenes Zuhause',
  found_company: 'Firma gründen',
  fame: 'Berühmt werden',
  happiness: 'Glücklich werden',
  leave_city: 'Die Stadt verlassen',
  education: 'Ausbildung abschließen',
  fitness: 'Fit werden',
  friendship: 'Freundeskreis aufbauen',
};

/**
 * Rolls a life-goal set that fits the NPC's personality and age. Goals are
 * re-prioritised over time; they are the slow layer above daily needs.
 */
export function generateGoals(npc: NPC, age: number, day: number, rng: RNG): Goal[] {
  const goals: Goal[] = [];
  const add = (type: GoalType, priority: number, target = -1) => {
    if (goals.some((g) => g.type === type)) return;
    goals.push({ type, priority: clamp100(priority), progress: 0, createdDay: day, target });
  };

  if (age < 18) {
    add('education', 60 + npc.a.intelligence * 0.25);
    add('friendship', 55 + npc.p.extraversion * 0.3);
    if (npc.p.ambition > 60) add('career', 40 + npc.p.ambition * 0.2);
    return goals;
  }

  add('career', 25 + npc.p.ambition * 0.55 + npc.a.discipline * 0.15);
  add('wealth', 15 + npc.p.ambition * 0.35 + npc.p.risk * 0.2);
  add('happiness', 30 + (100 - npc.p.ambition) * 0.3);

  if (npc.p.loyalty > 45 && age < 55) add('marry', 20 + npc.p.loyalty * 0.4 + npc.p.agreeableness * 0.2);
  if (age >= 22 && age <= 42 && npc.p.empathy > 40) add('children', 15 + npc.p.empathy * 0.4);
  if (age >= 24) add('own_home', 20 + npc.p.conscientiousness * 0.35);
  if (npc.p.risk > 65 && npc.p.ambition > 60) add('found_company', 20 + npc.p.risk * 0.35);
  if (npc.p.extraversion > 65 && npc.p.openness > 55) add('fame', 10 + npc.p.extraversion * 0.25);
  if (npc.p.extraversion > 40) add('friendship', 20 + npc.p.extraversion * 0.35);
  if (npc.a.discipline > 55 || rng.chance(0.2)) add('fitness', 10 + npc.a.discipline * 0.25);
  if (npc.p.openness > 70 && npc.p.risk > 55 && rng.chance(0.25)) add('leave_city', 12 + npc.p.openness * 0.2);
  if (npc.education < 3 && npc.a.intelligence > 62 && age < 35) add('education', 30 + npc.a.intelligence * 0.3);

  goals.sort((a, b) => b.priority - a.priority);
  return goals.slice(0, 5);
}

export const hasGoal = (npc: NPC, type: GoalType): boolean => npc.goals.some((g) => g.type === type);

export const goalPriority = (npc: NPC, type: GoalType): number =>
  npc.goals.find((g) => g.type === type)?.priority ?? 0;

export function setGoalProgress(npc: NPC, type: GoalType, progress: number): void {
  const g = npc.goals.find((x) => x.type === type);
  if (g) g.progress = clamp100(progress);
}

export function addGoal(npc: NPC, type: GoalType, priority: number, day: number, target = -1): void {
  if (npc.goals.some((g) => g.type === type)) return;
  npc.goals.push({ type, priority: clamp100(priority), progress: 0, createdDay: day, target });
  npc.goals.sort((a, b) => b.priority - a.priority);
  if (npc.goals.length > 6) npc.goals.length = 6;
}

export function dropGoal(npc: NPC, type: GoalType): void {
  npc.goals = npc.goals.filter((g) => g.type !== type);
}

/**
 * Re-scores goals against the NPC's actual situation. Called on birthdays and
 * after major life events, which is what makes people change direction.
 */
export function reevaluateGoals(npc: NPC, age: number, day: number, netWorth: number, rng: RNG): void {
  for (const g of npc.goals) {
    switch (g.type) {
      case 'marry':
        if (npc.family.married) g.progress = 100;
        else if (npc.family.partner >= 0) g.progress = 60;
        else g.progress = Math.max(0, g.progress - 3);
        break;
      case 'children':
        g.progress = Math.min(100, npc.family.children.length * 45);
        break;
      case 'own_home':
        g.progress = npc.ownedBuildings.length > 0 ? 100 : Math.min(95, (netWorth / 90000) * 100);
        break;
      case 'wealth':
        g.progress = Math.min(100, (netWorth / 250000) * 100);
        break;
      case 'career':
        g.progress = npc.jobId >= 0 ? Math.min(100, npc.careerLevel * 18 + 10) : 0;
        break;
      case 'education':
        g.progress = npc.education * 25;
        break;
      case 'fitness':
        g.progress = npc.skills.fitness;
        break;
      case 'friendship':
        g.progress = Math.min(100, npc.links.length * 6);
        break;
      case 'found_company':
        g.progress = npc.ownedBuildings.length > 0 ? 100 : Math.min(90, (netWorth / 60000) * 100);
        break;
      case 'fame':
        g.progress = npc.reputation;
        break;
      default:
        break;
    }
  }

  // Completed goals make room for new ambitions.
  const finished = npc.goals.filter((g) => g.progress >= 100);
  if (finished.length) {
    npc.goals = npc.goals.filter((g) => g.progress < 100);
    for (const f of finished) {
      if (f.type === 'marry' && !hasGoal(npc, 'children') && age < 44 && npc.p.empathy > 45) {
        addGoal(npc, 'children', 55 + npc.p.empathy * 0.3, day);
      }
      if (f.type === 'career' && npc.p.risk > 60 && !hasGoal(npc, 'found_company')) {
        addGoal(npc, 'found_company', 60, day);
      }
      if (f.type === 'own_home' && !hasGoal(npc, 'wealth')) addGoal(npc, 'wealth', 50, day);
    }
    if (!npc.goals.length) addGoal(npc, 'happiness', 60, day);
  }

  // Age closes some doors and opens others.
  if (age > 46) dropGoal(npc, 'children');
  if (age >= RETIREMENT_AGE) {
    dropGoal(npc, 'career');
    if (!hasGoal(npc, 'happiness')) addGoal(npc, 'happiness', 70, day);
  }
  if (!isWorkingAge(age) && age >= 18) dropGoal(npc, 'found_company');

  // Occasional drift keeps long lives from feeling scripted.
  if (rng.chance(0.08) && npc.goals.length) {
    const g = rng.pick(npc.goals);
    g.priority = clamp100(g.priority + rng.gauss(0, 7));
  }
  npc.goals.sort((a, b) => b.priority - a.priority);
}
