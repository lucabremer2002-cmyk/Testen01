import { clamp, clamp100 } from '../../core/math';
import { DAYS_PER_YEAR } from '../../time/calendar';
import { applyEmotion, mood } from '../../npc/Emotions';
import { remember } from '../../npc/Memory';
import { reevaluateGoals } from '../../npc/Goals';
import { createNPC, fullName, refreshAge } from '../../npc/NPCFactory';
import { distress } from '../../npc/Needs';
import {
  RETIREMENT_AGE,
  fertility,
  healthDrift,
  mortalityPerYear,
} from '../../npc/lifecycle';
import type { NPC } from '../../npc/types';
import { leaveJob } from './WorkSystem';
import { checkSecretsExposed } from './SocialSystem';
import type { SimulationEngine } from '../SimulationEngine';

const DEATH_CAUSES_OLD = ['Altersschwäche', 'Herzversagen', 'Krankheit', 'Schlaganfall'];
const DEATH_CAUSES_YOUNG = ['Unfall', 'Krankheit', 'Herzversagen'];

export function runDailyLife(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;

  for (let i = engine.aliveIds.length - 1; i >= 0; i--) {
    const npc = engine.npcs[engine.aliveIds[i]];
    if (!npc.alive) continue;
    refreshAge(npc, day);
    const age = npc.ageYears;

    // --- physical condition ------------------------------------------------
    let health = npc.a.health + healthDrift(age);
    const n = npc.needs;
    if (n.hunger < 12) health -= 0.9;
    if (n.energy < 12) health -= 0.5;
    if (n.hygiene < 15) health -= 0.25;
    if (n.stress > 85) health -= 0.4;
    if (npc.skills.fitness > 60) health += 0.08;
    if (npc.homeId < 0) health -= 0.35;
    npc.a.health = clamp100(health);

    // Living conditions feed back into needs.
    if (npc.homeId < 0) {
      n.comfort = clamp100(n.comfort - 6);
      n.safety = clamp100(n.safety - 5);
      n.stress = clamp100(n.stress + 4);
    }
    if (npc.debt > 12000) n.stress = clamp100(n.stress + 1.2);

    // --- illness and accidents --------------------------------------------
    const illnessRisk = 0.00015 + Math.max(0, 60 - npc.a.health) * 0.00008 + Math.max(0, age - 55) * 0.00005;
    if (rng.chance(illnessRisk)) {
      npc.a.health = clamp100(npc.a.health - rng.float(8, 26));
      applyEmotion(npc, { sadness: 10, anxiety: 14, stress: 14, motivation: -10 });
      npc.illSinceDay = day;
      remember(npc, day, 'illness', 'Ernsthaft erkrankt', -50, -1);
      engine.emit({
        type: 'illness',
        subjects: [npc.id],
        text: `${fullName(npc)} ist ernsthaft erkrankt.`,
        narrative: `erkrankte ${fullName(npc)} ernsthaft`,
        importance: 43,
      });
      const rumor = engine.rumors.create(npc.id, 'illness', true, 40, day, `${fullName(npc)} ist krank.`);
      npc.known.add(rumor.id);
    }
    if (rng.chance(0.00006 * (1 + npc.p.risk / 90))) {
      npc.a.health = clamp100(npc.a.health - rng.float(10, 40));
      applyEmotion(npc, { anxiety: 22, stress: 20, sadness: 8 });
      engine.emit({
        type: 'accident',
        subjects: [npc.id],
        text: `${fullName(npc)} hatte einen Unfall.`,
        narrative: `hatte ${fullName(npc)} einen schweren Unfall`,
        importance: 52,
      });
    }

    // --- mortality ---------------------------------------------------------
    const annual = mortalityPerYear(age, npc.a.health);
    if (rng.chance(1 - Math.pow(1 - annual, 1 / DAYS_PER_YEAR))) {
      killNPC(engine, npc, day, age > 62 ? rng.pick(DEATH_CAUSES_OLD) : rng.pick(DEATH_CAUSES_YOUNG));
      continue;
    }

    // --- pregnancy and birth ----------------------------------------------
    if (npc.pregnantUntilDay >= 0 && day >= npc.pregnantUntilDay) giveBirth(engine, npc, day);

    // Getting better is news too - a story that only ever worsens reads false.
    if (npc.illSinceDay >= 0 && npc.a.health > 62) {
      const weeks = Math.max(1, Math.round((day - npc.illSinceDay) / 7));
      npc.illSinceDay = -1;
      applyEmotion(npc, { happiness: 14, calm: 12, anxiety: -14, motivation: 10 });
      engine.emit({
        type: 'recovery',
        subjects: [npc.id],
        text: `${fullName(npc)} ist nach ${weeks} Woche${weeks === 1 ? '' : 'n'} wieder gesund.`,
        narrative: `erholte sich ${fullName(npc)} wieder`,
        importance: 28,
      });
    }

    // --- secrets and satisfaction -----------------------------------------
    checkSecretsExposed(engine, npc, day);
    const m = mood(npc);
    npc.lifeSatisfaction = clamp100(npc.lifeSatisfaction * 0.985 + m * 0.015);
    // Reputation slowly returns to what the person actually is.
    npc.reputation = clamp100(npc.reputation * 0.999 + (40 + npc.a.social * 0.2 + npc.skills.social * 0.1) * 0.001);

    // --- birthday ----------------------------------------------------------
    if ((day - npc.birthDay) % DAYS_PER_YEAR === 0 && day > npc.birthDay) {
      onBirthday(engine, npc, day, age);
    }

    // Severe neglect is visible to the player as a crisis, not silent decay.
    if (distress(npc) > 0.78 && rng.chance(0.05)) {
      applyEmotion(npc, { sadness: 8, anxiety: 8, stress: 6 });
    }
  }
}

function onBirthday(engine: SimulationEngine, npc: NPC, day: number, age: number): void {
  const rng = engine.rng;
  reevaluateGoals(npc, age, day, engine.netWorth(npc), rng);

  // Education milestones.
  if (age === 18 && npc.education < 1) npc.education = 1;
  if (age === 19 && npc.a.intelligence > 60 && rng.chance(0.45)) {
    npc.education = 2;
    remember(npc, day, 'graduation', 'Ausbildung begonnen', 35, -1, 58);
  }
  if (age === 24 && npc.education >= 2 && npc.a.intelligence > 68 && rng.chance(0.4)) {
    npc.education = 3;
    engine.emit({
      type: 'graduation',
      subjects: [npc.id],
      text: `${fullName(npc)} hat das Studium abgeschlossen.`,
      narrative: `schloss ${fullName(npc)} das Studium ab`,
      importance: 50,
    });
    remember(npc, day, 'graduation', 'Studium abgeschlossen', 60, -1);
  }

  const round = age === 18 || age === 30 || age === 50 || age === RETIREMENT_AGE || age === 80;
  engine.emit({
    type: round ? 'milestone' : 'birthday',
    subjects: [npc.id],
    text: round
      ? `${fullName(npc)} feiert heute den ${age}. Geburtstag.`
      : `${fullName(npc)} wird heute ${age}.`,
    narrative: `wurde ${fullName(npc)} ${age} Jahre alt`,
    importance: round ? (age >= 50 ? 34 : 26) : 12,
  });
  applyEmotion(npc, { happiness: 6, pride: 3 });
}

export function giveBirth(engine: SimulationEngine, mother: NPC, day: number): void {
  const father = engine.npcs[mother.pregnantBy];
  mother.pregnantUntilDay = -1;
  const fatherId = father?.alive ? father.id : -1;
  mother.pregnantBy = -1;

  const id = engine.npcs.length;
  const parents = fatherId >= 0 ? [mother.id, fatherId] : [mother.id];
  const inherit = fatherId >= 0 ? [mother.p, father!.p] : [mother.p];
  const baby = createNPC(engine.rng, {
    id,
    day,
    age: 0,
    lastName: father?.alive ? father.lastName : mother.lastName,
    parents,
    inheritFrom: inherit as never,
  });
  baby.birthDay = day;
  baby.homeId = mother.homeId;
  baby.locId = mother.homeId >= 0 ? mother.homeId : mother.locId;
  baby.lastUpdateMin = engine.now;
  baby.bank = 0;
  baby.money = 0;
  baby.debt = 0;
  engine.npcs.push(baby);
  engine.aliveIds.push(baby.id);

  if (baby.homeId >= 0) {
    const home = engine.world.buildings[baby.homeId];
    home.residents.push(baby.id);
    home.present.push(baby.id);
    home.occupants++;
  }

  // Family links.
  mother.family.children.push(baby.id);
  engine.linkFamily(mother, baby, 'parent', day);
  if (father?.alive) {
    father.family.children.push(baby.id);
    engine.linkFamily(father, baby, 'parent', day);
    for (const sibId of father.family.children) {
      if (sibId === baby.id) continue;
      const sib = engine.npcs[sibId];
      if (sib?.alive) {
        engine.linkFamily(sib, baby, 'sibling', day);
        sib.family.siblings.push(baby.id);
        baby.family.siblings.push(sibId);
      }
    }
  }
  for (const sibId of mother.family.children) {
    if (sibId === baby.id || baby.family.siblings.includes(sibId)) continue;
    const sib = engine.npcs[sibId];
    if (sib?.alive) {
      engine.linkFamily(sib, baby, 'sibling', day);
      sib.family.siblings.push(baby.id);
      baby.family.siblings.push(sibId);
    }
  }

  applyEmotion(mother, { happiness: 38, love: 20, pride: 30, stress: 18, motivation: 10 });
  remember(mother, day, 'child_born', `${baby.firstName} geboren`, 95, baby.id);
  if (father?.alive) {
    applyEmotion(father, { happiness: 34, pride: 28, stress: 14 });
    remember(father, day, 'child_born', `${baby.firstName} geboren`, 95, baby.id);
  }
  remember(baby, day, 'birth', 'Geboren', 100, -1);

  engine.emit({
    type: 'birth',
    subjects: [mother.id, baby.id, ...(fatherId >= 0 ? [fatherId] : [])],
    buildingId: mother.homeId,
    text: `${fullName(mother)} hat ein Kind bekommen: ${baby.firstName}.`,
    narrative: `bekam ${fullName(mother)} ein Kind: ${baby.firstName}`,
    importance: 74,
  });
  const rumor = engine.rumors.create(mother.id, 'pregnancy', true, 25, day, `${fullName(mother)} hat ein Kind bekommen.`);
  mother.known.add(rumor.id);
  engine.scheduler.schedule(baby.id, engine.now + engine.rng.int(5, 90));
  baby.nextDecisionMin = engine.now + 30;
  engine.version++;
}

export function killNPC(engine: SimulationEngine, npc: NPC, day: number, cause: string): void {
  npc.alive = false;
  npc.deathDay = day;
  npc.deathCause = cause;
  npc.travel = null;
  npc.action = { type: 'idle', locationId: -1, partner: -1, startMin: 0, endMin: 0 };

  if (npc.jobId >= 0) leaveJob(engine, npc, 'quit');
  npc.salary = 0;

  // Vacate the home.
  if (npc.homeId >= 0) {
    const home = engine.world.buildings[npc.homeId];
    const i = home.residents.indexOf(npc.id);
    if (i >= 0) home.residents.splice(i, 1);
  }
  if (npc.locId >= 0) {
    const b = engine.world.buildings[npc.locId];
    if (b) {
      const j = b.present.indexOf(npc.id);
      if (j >= 0) b.present.splice(j, 1);
      b.occupants = Math.max(0, b.occupants - 1);
    }
  }

  // Inheritance: partner first, then children, then the city.
  const estate = Math.max(0, npc.money + npc.bank - npc.debt);
  const heirs: NPC[] = [];
  const partner = npc.family.partner >= 0 ? engine.npcs[npc.family.partner] : null;
  if (partner?.alive) heirs.push(partner);
  for (const cId of npc.family.children) {
    const c = engine.npcs[cId];
    if (c?.alive) heirs.push(c);
  }
  if (heirs.length && estate > 0) {
    const share = estate / heirs.length;
    for (const h of heirs) {
      h.bank += share;
      engine.ledger.addIncome('inheritance', share);
      if (share > 5000) {
        engine.emit({
          type: 'windfall',
          subjects: [h.id],
          text: `${fullName(h)} erbt ${Math.round(share).toLocaleString('de-DE')} € von ${fullName(npc)}.`,
          importance: 44,
        });
      }
    }
  }
  // Property passes to the heirs as well.
  if (npc.ownedBuildings.length && heirs.length) {
    for (const bId of npc.ownedBuildings) {
      const heir = heirs[0];
      heir.ownedBuildings.push(bId);
      engine.world.buildings[bId].ownerId = heir.id;
    }
  }
  npc.ownedBuildings = [];
  npc.money = 0;
  npc.bank = 0;
  npc.debt = 0;

  // Grief ripples through the social graph.
  if (partner?.alive) {
    partner.family.partner = -1;
    partner.family.married = false;
    applyEmotion(partner, { sadness: 70, loneliness: 55, love: -40, stress: 40, happiness: -35 });
    remember(partner, day, 'death', `${fullName(npc)} ist gestorben`, -100, npc.id);
  }
  for (const otherId of npc.links) {
    const other = engine.npcs[otherId];
    if (!other?.alive) continue;
    const rel = engine.rels.get(npc.id, otherId);
    if (!rel) continue;
    const bond = rel.closeness * 0.6 + (rel.familyTie !== 'none' ? 40 : 0);
    if (bond < 25) continue;
    applyEmotion(other, {
      sadness: bond * 0.55,
      stress: bond * 0.3,
      happiness: -bond * 0.25,
      loneliness: bond * 0.2,
    });
    if (bond > 45) remember(other, day, 'death', `${fullName(npc)} ist gestorben`, -85, npc.id);
  }

  engine.emit({
    type: 'death',
    subjects: [npc.id],
    text: `${fullName(npc)} ist im Alter von ${npc.ageYears} Jahren verstorben (${cause}).`,
    importance: 80,
  });
  engine.version++;
}

/** Chance that this couple conceives, per attempt. */
export function coupleFertility(mother: NPC, father: NPC): number {
  const m = fertility(mother.ageYears, 'w');
  const f = fertility(father.ageYears, 'm');
  const health = (mother.a.health / 100) * 0.5 + 0.5;
  return clamp(m * f * health, 0, 1);
}
