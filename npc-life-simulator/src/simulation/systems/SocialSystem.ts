import { clamp, clamp100 } from '../../core/math';
import { applyEmotion } from '../../npc/Emotions';
import { remember } from '../../npc/Memory';
import { addGoal, setGoalProgress } from '../../npc/Goals';
import { fullName } from '../../npc/NPCFactory';
import type { ActionType, NPC } from '../../npc/types';
import type { Relationship } from '../../relationships/types';
import type { SimulationEngine } from '../SimulationEngine';

/** Actions during which strangers can bump into each other. */
export const PUBLIC_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  'park', 'gym', 'romance_hunt', 'eat_out', 'socialize', 'study', 'school', 'work', 'shop', 'groceries',
]);

/** 0..1 - how well two people get along by disposition alone. */
export function compatibility(a: NPC, b: NPC): number {
  const p = a.p;
  const q = b.p;
  // Similar values attract; complementary energy levels help a little.
  const similarity =
    1 -
    (Math.abs(p.openness - q.openness) +
      Math.abs(p.agreeableness - q.agreeableness) +
      Math.abs(p.conscientiousness - q.conscientiousness) +
      Math.abs(p.loyalty - q.loyalty)) /
      400;
  let shared = 0;
  for (const h of a.hobbies) if (b.hobbies.includes(h)) shared++;
  const humour = 1 - Math.abs(a.a.humor - b.a.humor) / 100;
  return clamp(similarity * 0.6 + humour * 0.2 + Math.min(shared, 3) * 0.07, 0, 1);
}

/** 0..100 - romantic pull from a towards b. */
export function attractionOf(a: NPC, b: NPC): number {
  if (a.id === b.id) return 0;
  const ageGap = Math.abs(a.ageYears - b.ageYears);
  const ageOk = a.ageYears >= 17 && b.ageYears >= 17 && ageGap <= 6 + Math.min(a.ageYears, b.ageYears) * 0.25;
  if (!ageOk) return 0;
  // Orientation is simplified: attraction runs towards the other gender, with
  // a minority of NPCs drawn to the same one.
  const sameGender = a.gender === b.gender;
  const orientation = ((a.id * 2654435761) >>> 0) % 100 < 8 ? sameGender : !sameGender;
  if (!orientation) return 0;
  const looks = b.a.attractiveness * 0.4;
  const chemistry = compatibility(a, b) * 40;
  const status = (b.reputation * 0.08 + Math.min(20, b.salary / 260)) * (a.p.ambition / 120);
  const gap = Math.max(0, 18 - ageGap) * 0.4;
  return clamp100(looks + chemistry + status + gap - (a.family.partner >= 0 ? 25 : 0));
}

/** Applies the outcome of a completed social action. */
export function finishSocialAction(
  engine: SimulationEngine,
  npc: NPC,
  type: ActionType,
  partnerId: number,
  hours: number,
): void {
  if (partnerId < 0) {
    if (type === 'romance_hunt') meetSomeoneNew(engine, npc, true);
    return;
  }
  const other = engine.npcs[partnerId];
  if (!other?.alive) return;
  const rng = engine.rng;
  const rel = engine.rels.ensure(npc, other, engine.day);
  rel.interactions++;
  rel.lastInteractionDay = engine.day;

  const compat = compatibility(npc, other);
  const quality = clamp(
    compat * 0.6 + (npc.emo.happiness / 100) * 0.2 + (other.emo.happiness / 100) * 0.1 + rng.float(-0.18, 0.22),
    0,
    1.2,
  );
  const intensity = Math.min(3, hours) * (type === 'date' || type === 'family_time' ? 1.25 : 1);

  if (quality > 0.45) {
    engine.rels.modify(rel, npc.id, {
      closeness: 3.2 * intensity * quality,
      sympathy: 2.4 * intensity * quality,
      trust: 1.6 * intensity * quality,
      respect: 1.1 * intensity * quality,
      opinion: 3 * intensity * quality,
      conflict: -1.4 * intensity,
    });
    applyEmotion(npc, { happiness: 5 * quality, loneliness: -12 * quality, calm: 3, stress: -4 * quality });
    applyEmotion(other, { happiness: 3.5 * quality, loneliness: -9 * quality, stress: -3 * quality });
  } else {
    // A bad evening leaves a mark too.
    engine.rels.modify(rel, npc.id, {
      conflict: 4 * intensity * (1 - quality),
      sympathy: -2.2 * intensity,
      opinion: -4 * intensity,
      closeness: 0.4,
    });
    applyEmotion(npc, { disappointment: 7, happiness: -3 });
    if (rng.chance(0.055 + npc.a.aggression / 900)) startConflict(engine, npc, other, rel);
  }

  // The other person's social need is filled too - interaction is mutual.
  other.needs.social = clamp100(other.needs.social + 16 * Math.min(1.4, hours));
  other.needs.fun = clamp100(other.needs.fun + 8 * Math.min(1.4, hours));

  // Romance grows on dates and on unusually good meetings.
  if (type === 'date' || (type === 'socialize' && quality > 0.85)) {
    const pull = attractionOf(npc, other) / 100;
    const pullBack = attractionOf(other, npc) / 100;
    engine.rels.modify(rel, npc.id, { attraction: 7 * pull * intensity });
    engine.rels.modify(rel, other.id, { attraction: 5 * pullBack * intensity });
    if (npc.family.partner === other.id) {
      applyEmotion(npc, { love: 6 * intensity, happiness: 4 });
      applyEmotion(other, { love: 5 * intensity, happiness: 3 });
    }
  }

  // Shared evenings are the background hum of the news feed. Reported
  // sparingly, so they colour the city without burying the big events.
  if (quality > 0.72 && rng.chance(type === 'date' ? 0.06 : 0.035)) {
    const where = engine.world.buildings[npc.action.locationId];
    engine.emit({
      type: 'outing',
      subjects: [npc.id, other.id],
      buildingId: npc.action.locationId,
      text:
        type === 'date'
          ? `${fullName(npc)} und ${fullName(other)} waren zusammen aus${where ? ` – ${where.name}` : ''}.`
          : `${fullName(npc)} hat sich mit ${fullName(other)}${where ? ` im ${where.name}` : ''} getroffen.`,
      narrative: `verbrachten ${fullName(npc)} und ${fullName(other)} Zeit miteinander`,
      importance: 14,
    });
  }

  // Gossip travels during every real conversation.
  engine.rumors.gossip(npc, other, rel, engine.rels, engine.day, rng, (id) => engine.npcs[id]);
  engine.rumors.gossip(other, npc, rel, engine.rels, engine.day, rng, (id) => engine.npcs[id]);

  engine.rels.refreshType(rel);
  maybeBecomeFriends(engine, npc, other, rel);
}

function maybeBecomeFriends(engine: SimulationEngine, a: NPC, b: NPC, rel: Relationship): void {
  if (rel.type !== 'friend') return;
  // Only announce the first time a friendship forms.
  if (rel.interactions > 6) return;
  engine.emit({
    type: 'friendship',
    subjects: [a.id, b.id],
    text: `${fullName(a)} und ${fullName(b)} sind Freunde geworden.`,
    narrative: `wurden ${fullName(a)} und ${fullName(b)} Freunde`,
    importance: 30,
  });
  remember(a, engine.day, 'first_meeting', `Freundschaft mit ${fullName(b)}`, 25, b.id, 42);
  remember(b, engine.day, 'first_meeting', `Freundschaft mit ${fullName(a)}`, 25, a.id, 42);
}

/** An argument with lasting consequences. */
export function startConflict(engine: SimulationEngine, a: NPC, b: NPC, rel: Relationship): void {
  const severity = 6 + a.a.aggression / 8 + (100 - a.p.agreeableness) / 12;
  engine.rels.modify(rel, a.id, {
    conflict: severity,
    trust: -severity * 0.6,
    sympathy: -severity * 0.7,
    closeness: -severity * 0.3,
    opinion: -severity,
  });
  applyEmotion(a, { anger: severity * 1.2, stress: severity * 0.8, happiness: -severity * 0.4 });
  applyEmotion(b, { anger: severity, sadness: severity * 0.5, stress: severity * 0.7 });
  engine.rels.refreshType(rel);
  // Only a genuinely serious row is worth reporting to the whole city.
  if (severity > 21) {
    remember(a, engine.day, 'fight', `Heftiger Streit mit ${fullName(b)}`, -45, b.id);
    remember(b, engine.day, 'fight', `Heftiger Streit mit ${fullName(a)}`, -45, a.id);
    engine.emit({
      type: 'fight',
      subjects: [a.id, b.id],
      text: `${fullName(a)} und ${fullName(b)} hatten einen heftigen Streit.`,
      narrative: `stritten sich ${fullName(a)} und ${fullName(b)} heftig`,
      importance: 46,
    });
  }
}

/** Chance encounter at the NPC's current location. */
export function meetSomeoneNew(engine: SimulationEngine, npc: NPC, romantic: boolean): void {
  const building = engine.world.buildings[npc.locId];
  if (!building || building.present.length < 2) return;
  const rng = engine.rng;
  // Meeting people saturates. Somebody who already knows half the district
  // rarely adds another name; a newcomer meets people constantly. Without this
  // curve everyone accumulates new acquaintances every other day, for life.
  const saturation = 1 / (1 + (npc.links.length / 12) ** 2);
  const sociability = 0.004 + npc.p.extraversion / 4000 + npc.a.confidence / 5000;
  // Going out looking for someone helps, but it is not a guarantee.
  const chance = romantic ? 0.08 + 0.3 * saturation : sociability * saturation;
  if (!rng.chance(chance)) return;

  for (let attempt = 0; attempt < 4; attempt++) {
    const otherId = building.present[rng.int(0, building.present.length - 1)];
    if (otherId === npc.id) continue;
    const other = engine.npcs[otherId];
    if (!other?.alive) continue;
    if (engine.rels.has(npc.id, otherId)) continue;
    if (Math.abs(npc.ageYears - other.ageYears) > 25 && !romantic) continue;

    const rel = engine.rels.ensure(npc, other, engine.day);
    const compat = compatibility(npc, other);
    rel.interactions = 1;
    engine.rels.modify(rel, npc.id, {
      closeness: 6 + compat * 10,
      sympathy: 4 + compat * 14,
      opinion: compat * 20 - 6,
    });
    if (romantic) {
      engine.rels.modify(rel, npc.id, { attraction: attractionOf(npc, other) * 0.35 });
      engine.rels.modify(rel, other.id, { attraction: attractionOf(other, npc) * 0.3 });
    }
    engine.rels.refreshType(rel);
    remember(npc, engine.day, 'first_meeting', `${fullName(other)} kennengelernt`, 10, otherId, 30);
    applyEmotion(npc, { loneliness: -6, happiness: 2 });
    // Only encounters that actually clicked are worth reporting.
    const spark = romantic ? engine.rels.attractionFrom(rel, npc.id) : 0;
    if (spark > 58 || compat > 0.74) {
      const where = engine.world.buildings[npc.locId];
      engine.emit({
        type: 'acquaintance',
        subjects: [npc.id, otherId],
        buildingId: npc.locId,
        text: `${fullName(npc)} hat ${fullName(other)}${where ? ` im ${where.name}` : ''} kennengelernt.`,
        narrative: `lernte ${fullName(npc)} ${fullName(other)} kennen`,
        importance: romantic ? 22 : 18,
      });
    }
    return;
  }
}

// -------------------------------------------------------------- daily routine

export function runSocialDay(engine: SimulationEngine, day: number): void {
  const rng = engine.rng;

  // Relationships fade when nobody maintains them. Sweeping every edge is the
  // single most expensive daily pass, so a time jump does it less often and
  // decays proportionally more each time.
  const decayEvery = engine.turbo ? 15 : 5;
  if (day % decayEvery === 0) {
    for (const rel of engine.rels.all()) {
      const days = day - rel.lastInteractionDay;
      if (days > 10) engine.rels.decay(rel, decayEvery);
      if (days > 12) engine.rels.refreshType(rel);
    }
  }
  // People cannot maintain unlimited contacts - faded ones are forgotten.
  if (day % (engine.turbo ? 23 : 11) === 0) {
    for (const id of engine.aliveIds) pruneContacts(engine, engine.npcs[id], day);
  }

  for (const id of engine.aliveIds) {
    const npc = engine.npcs[id];
    if (npc.ageYears < 14) continue;
    const partnerId = npc.family.partner;

    if (rng.chance(0.02)) maybeReconcile(engine, npc, day);

    if (partnerId < 0) {
      if (rng.chance(0.035)) tryStartRelationship(engine, npc, day);
    } else {
      const partner = engine.npcs[partnerId];
      if (!partner?.alive) continue;
      if (npc.id < partnerId) progressRomance(engine, npc, partner, day);
      if (rng.chance(0.02)) maybeAffair(engine, npc, day);
    }
  }
}

/** Dunbar-style ceiling: weak, stale contacts drop out of the social circle. */
const MAX_CONTACTS = 52;

function pruneContacts(engine: SimulationEngine, npc: NPC, day: number): void {
  if (!npc || npc.links.length <= MAX_CONTACTS) return;
  const keep: number[] = [];
  const drop: { id: number; strength: number }[] = [];
  for (const otherId of npc.links) {
    const rel = engine.rels.get(npc.id, otherId);
    const other = engine.npcs[otherId];
    if (!rel || !other?.alive) continue;
    // Family, partners and colleagues are never forgotten.
    if (rel.familyTie !== 'none' || rel.romantic || rel.type === 'ex' || rel.type === 'enemy') {
      keep.push(otherId);
      continue;
    }
    const stale = Math.min(1, (day - rel.lastInteractionDay) / 240);
    drop.push({ id: otherId, strength: rel.closeness * 0.6 + rel.sympathy * 0.3 - stale * 45 });
  }
  drop.sort((a, b) => b.strength - a.strength);
  const room = Math.max(0, MAX_CONTACTS - keep.length);
  for (let i = 0; i < drop.length; i++) {
    if (i < room || drop[i].strength > 22) {
      keep.push(drop[i].id);
      continue;
    }
    // Forget the contact on both sides.
    const otherId = drop[i].id;
    const other = engine.npcs[otherId];
    const j = other.links.indexOf(npc.id);
    if (j >= 0) other.links.splice(j, 1);
    engine.rels.drop(npc.id, otherId);
  }
  npc.links = keep;
}

/** A quarrel that cools off again is as much a story beat as the quarrel. */
function maybeReconcile(engine: SimulationEngine, npc: NPC, day: number): void {
  if (!npc.links.length) return;
  const rng = engine.rng;
  const otherId = npc.links[rng.int(0, npc.links.length - 1)];
  const rel = engine.rels.get(npc.id, otherId);
  const other = engine.npcs[otherId];
  if (!rel || !other?.alive || rel.conflict < 35) return;
  // Agreeable people extend the olive branch sooner.
  const willingness = (npc.p.agreeableness + other.p.agreeableness) / 200 + rel.closeness / 300;
  if (!rng.chance(willingness * 0.25)) return;

  engine.rels.modify(rel, npc.id, {
    conflict: -rel.conflict * 0.7,
    trust: 8,
    sympathy: 10,
    closeness: 5,
    opinion: 14,
  });
  engine.rels.refreshType(rel);
  applyEmotion(npc, { anger: -22, happiness: 10, calm: 12, stress: -10 });
  applyEmotion(other, { anger: -22, happiness: 10, calm: 12, stress: -10 });
  remember(npc, day, 'help', `Versöhnung mit ${fullName(other)}`, 35, otherId, 40);
  engine.emit({
    type: 'reconcile',
    subjects: [npc.id, otherId],
    text: `${fullName(npc)} und ${fullName(other)} haben sich versöhnt.`,
    narrative: `versöhnten sich ${fullName(npc)} und ${fullName(other)}`,
    importance: 36,
  });
}

function tryStartRelationship(engine: SimulationEngine, npc: NPC, day: number): void {
  if (npc.ageYears < 17 || npc.ageYears > 80) return;
  const rng = engine.rng;
  let bestId = -1;
  let bestScore = 0;
  const tries = Math.min(npc.links.length, 10);
  for (let i = 0; i < tries; i++) {
    const otherId = npc.links[rng.int(0, npc.links.length - 1)];
    const other = engine.npcs[otherId];
    if (!other?.alive || other.family.partner >= 0) continue;
    const rel = engine.rels.get(npc.id, otherId);
    if (!rel || rel.familyTie !== 'none') continue;
    // Getting back together takes time and a cooled-down conflict.
    if (rel.type === 'ex' && (day - rel.sinceDay < 500 || rel.conflict > 25)) continue;
    const mine = engine.rels.attractionFrom(rel, npc.id);
    const theirs = engine.rels.attractionFrom(rel, otherId);
    const score = Math.min(mine, theirs) * 0.7 + rel.closeness * 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestId = otherId;
    }
  }
  if (bestId < 0 || bestScore < 42) return;

  const other = engine.npcs[bestId];
  const rel = engine.rels.get(npc.id, bestId)!;
  rel.type = 'dating';
  rel.romantic = true;
  rel.sinceDay = day;
  npc.family.partner = bestId;
  other.family.partner = npc.id;
  engine.rels.modify(rel, npc.id, { trust: 12, closeness: 14, loyalty: 12 });
  applyEmotion(npc, { love: 55, happiness: 26, loneliness: -40, motivation: 10 });
  applyEmotion(other, { love: 50, happiness: 24, loneliness: -38 });
  remember(npc, day, 'first_meeting', `Beziehung mit ${fullName(other)} begonnen`, 65, bestId, 74);
  remember(other, day, 'first_meeting', `Beziehung mit ${fullName(npc)} begonnen`, 65, npc.id, 74);
  engine.emit({
    type: 'relationship',
    subjects: [npc.id, bestId],
    text: `${fullName(npc)} und ${fullName(other)} sind ein Paar.`,
    narrative: `wurden ${fullName(npc)} und ${fullName(other)} ein Paar`,
    importance: 58,
  });
}

function progressRomance(engine: SimulationEngine, a: NPC, b: NPC, day: number): void {
  const rel = engine.rels.get(a.id, b.id);
  if (!rel) return;
  const rng = engine.rng;
  const together = day - rel.sinceDay;

  // Strain: conflict, money trouble and stress erode a relationship.
  const strain =
    rel.conflict * 0.6 +
    engine.financialPressure(a) * 26 +
    engine.financialPressure(b) * 26 +
    Math.max(0, a.needs.stress - 60) * 0.35 +
    Math.max(0, b.needs.stress - 60) * 0.35 -
    rel.closeness * 0.45 -
    (rel.loyalty + a.p.loyalty + b.p.loyalty) * 0.08;

  if (strain > 22 && rng.chance(0.035 + strain / 900)) {
    breakUp(engine, a, b, rel, day, strain > 45 ? 'conflict' : 'drift');
    return;
  }
  if (strain > 8 && rng.chance(0.05)) {
    engine.rels.modify(rel, a.id, { conflict: 3.5, closeness: -1.4 });
    applyEmotion(a, { anger: 4, stress: 3 });
    applyEmotion(b, { sadness: 3, stress: 3 });
  }

  // Engagement and marriage need time and a solid bond.
  if (rel.type === 'dating' && together > 260 && rel.closeness > 66 && rel.trust > 60) {
    const wish = (a.p.loyalty + b.p.loyalty) / 200 + 0.1;
    if (rng.chance(0.012 * wish * 3)) {
      rel.type = 'engaged';
      applyEmotion(a, { happiness: 28, love: 18, pride: 12 });
      applyEmotion(b, { happiness: 28, love: 18, pride: 12 });
      engine.emit({
        type: 'engagement',
        subjects: [a.id, b.id],
        text: `${fullName(a)} und ${fullName(b)} haben sich verlobt.`,
        narrative: `verlobten sich ${fullName(a)} und ${fullName(b)}`,
        importance: 62,
      });
    }
  } else if (rel.type === 'engaged' && day - rel.sinceDay > 330 && rng.chance(0.02)) {
    marry(engine, a, b, rel, day);
  }

  // Children: married or long-term couples in a good place.
  const mother = a.gender === 'w' ? a : b.gender === 'w' ? b : null;
  const father = mother === a ? b : a;
  if (mother && mother.pregnantUntilDay < 0 && rel.closeness > 55) {
    // How many children this couple actually wants, from their dispositions.
    const desired = Math.round(((mother.p.empathy + father.p.empathy) / 2 - 18) / 20);
    const living = mother.family.children.reduce(
      (n, id) => n + (engine.npcs[id]?.alive ? 1 : 0),
      0,
    );
    if (living < desired) {
      const fert = engine.fertilityOf(mother, father);
      const stability = 1 - engine.financialPressure(mother) * 0.6;
      const rate = (rel.type === 'married' ? 0.0032 : 0.001) * stability;
      if (fert > 0 && rng.chance(fert * rate)) {
        mother.pregnantUntilDay = day + 273;
        mother.pregnantBy = father.id;
        applyEmotion(mother, { happiness: 16, anxiety: 8 });
      }
    }
  }
}

export function marry(engine: SimulationEngine, a: NPC, b: NPC, rel: Relationship, day: number): void {
  // Captured before the rename below, so the announcement reads the way the
  // city knew them on the day.
  const nameA = fullName(a);
  const nameB = fullName(b);
  rel.type = 'married';
  rel.romantic = true;
  a.family.married = true;
  b.family.married = true;
  a.family.marriedSinceDay = day;
  b.family.marriedSinceDay = day;
  engine.rels.modify(rel, a.id, { trust: 14, loyalty: 18, closeness: 12 });
  applyEmotion(a, { happiness: 40, love: 30, pride: 20, calm: 14 });
  applyEmotion(b, { happiness: 40, love: 30, pride: 20, calm: 14 });
  remember(a, day, 'wedding', `Hochzeit mit ${nameB}`, 95, b.id);
  remember(b, day, 'wedding', `Hochzeit mit ${nameA}`, 95, a.id);
  setGoalProgress(a, 'marry', 100);
  setGoalProgress(b, 'marry', 100);
  a.reputation = clamp100(a.reputation + 2);
  b.reputation = clamp100(b.reputation + 2);
  // One partner commonly takes the other's family name.
  if (engine.rng.chance(0.55)) {
    if (engine.rng.chance(0.5)) b.lastName = a.lastName;
    else a.lastName = b.lastName;
  }
  engine.emit({
    type: 'wedding',
    subjects: [a.id, b.id],
    text: `${nameA} und ${nameB} haben geheiratet.`,
    narrative: `heirateten ${nameA} und ${nameB}`,
    importance: 78,
  });
  engine.moveInTogether(a, b);
}

export function breakUp(
  engine: SimulationEngine,
  a: NPC,
  b: NPC,
  rel: Relationship,
  day: number,
  reason: 'conflict' | 'drift' | 'affair',
): void {
  const wasMarried = rel.type === 'married';
  rel.type = 'ex';
  rel.romantic = false;
  rel.sinceDay = day;
  engine.rels.modify(rel, a.id, { closeness: -35, trust: -30, loyalty: -25, conflict: 18 });
  a.family.partner = -1;
  b.family.partner = -1;
  a.family.married = false;
  b.family.married = false;
  if (!a.family.exPartners.includes(b.id)) a.family.exPartners.push(b.id);
  if (!b.family.exPartners.includes(a.id)) b.family.exPartners.push(a.id);

  const hurt = reason === 'affair' ? 1.5 : wasMarried ? 1.3 : 1;
  applyEmotion(a, {
    sadness: 34 * hurt,
    anger: 18 * hurt,
    love: -60,
    loneliness: 30,
    disappointment: 26,
    stress: 24,
  });
  applyEmotion(b, {
    sadness: 34 * hurt,
    anger: 20 * hurt,
    love: -60,
    loneliness: 30,
    disappointment: 26,
    stress: 24,
  });
  remember(a, day, wasMarried ? 'breakup' : 'breakup', `Trennung von ${fullName(b)}`, -80, b.id);
  remember(b, day, 'breakup', `Trennung von ${fullName(a)}`, -80, a.id);
  addGoal(a, 'happiness', 70, day);
  addGoal(b, 'happiness', 70, day);

  engine.emit({
    type: wasMarried ? 'divorce' : 'breakup',
    subjects: [a.id, b.id],
    text: wasMarried
      ? `${fullName(a)} und ${fullName(b)} haben sich scheiden lassen.`
      : `${fullName(a)} und ${fullName(b)} haben sich getrennt.`,
    narrative: wasMarried
      ? `ließen sich ${fullName(a)} und ${fullName(b)} scheiden`
      : `trennten sich ${fullName(a)} und ${fullName(b)}`,
    importance: wasMarried ? 72 : 60,
  });
  const rumor = engine.rumors.create(
    a.id,
    'breakup',
    true,
    35,
    day,
    `${fullName(a)} und ${fullName(b)} sind kein Paar mehr.`,
    b.id,
  );
  a.known.add(rumor.id);
  b.known.add(rumor.id);
  engine.separateHouseholds(a, b);
}

function maybeAffair(engine: SimulationEngine, npc: NPC, day: number): void {
  const partnerId = npc.family.partner;
  if (partnerId < 0) return;
  const rel = engine.rels.get(npc.id, partnerId);
  if (!rel) return;
  const rng = engine.rng;
  // Temptation rises with dissatisfaction and falls with loyalty.
  const temptation =
    (100 - npc.p.loyalty) / 100 * 0.5 +
    npc.p.impulsivity / 100 * 0.25 +
    Math.max(0, 55 - rel.closeness) / 100 * 0.5 +
    rel.conflict / 100 * 0.3 -
    npc.emo.love / 260;
  if (temptation < 0.45 || !rng.chance(temptation * 0.09)) return;

  // Find someone the NPC is drawn to.
  let targetId = -1;
  let best = 45;
  const tries = Math.min(npc.links.length, 8);
  for (let i = 0; i < tries; i++) {
    const otherId = npc.links[rng.int(0, npc.links.length - 1)];
    if (otherId === partnerId) continue;
    const other = engine.npcs[otherId];
    if (!other?.alive) continue;
    const r = engine.rels.get(npc.id, otherId);
    if (!r || r.familyTie !== 'none') continue;
    const pull = engine.rels.attractionFrom(r, npc.id);
    if (pull > best) {
      best = pull;
      targetId = otherId;
    }
  }
  if (targetId < 0) return;

  const other = engine.npcs[targetId];
  npc.secrets.push({
    kind: 'affair',
    about: targetId,
    day,
    severity: 80,
    text: `Affäre mit ${fullName(other)}`,
  });
  applyEmotion(npc, { anxiety: 18, happiness: 6, stress: 12 });
  const rumor = engine.rumors.create(
    npc.id,
    'affair',
    true,
    85,
    day,
    `${fullName(npc)} soll eine Affäre mit ${fullName(other)} haben.`,
    targetId,
  );
  npc.known.add(rumor.id);
  other.known.add(rumor.id);
  engine.emit({
    type: 'affair',
    subjects: [npc.id, targetId, partnerId],
    text: `${fullName(npc)} beginnt eine heimliche Affäre mit ${fullName(other)}.`,
    narrative: `begann ${fullName(npc)} eine heimliche Affäre mit ${fullName(other)}`,
    importance: 66,
  });
}

/** Called daily: does the betrayed partner find out? */
export function checkSecretsExposed(engine: SimulationEngine, npc: NPC, day: number): void {
  if (!npc.secrets.length) return;
  const partnerId = npc.family.partner;
  if (partnerId < 0) return;
  const partner = engine.npcs[partnerId];
  if (!partner?.alive) return;
  const rng = engine.rng;

  for (let i = npc.secrets.length - 1; i >= 0; i--) {
    const secret = npc.secrets[i];
    if (secret.kind !== 'affair') continue;
    // The more the rumour spread, the likelier the partner hears it.
    let spread = 0;
    for (const r of engine.rumors.all()) {
      if (r.subject === npc.id && r.kind === 'affair') spread = Math.max(spread, r.spread);
    }
    const chance = 0.004 + spread * 0.0045 + (day - secret.day) * 0.0004;
    if (!rng.chance(chance)) continue;

    npc.secrets.splice(i, 1);
    const rel = engine.rels.get(npc.id, partnerId);
    if (!rel) continue;
    applyEmotion(partner, { anger: 55, sadness: 40, jealousy: 55, disappointment: 45, stress: 35, love: -35 });
    engine.rels.modify(rel, partnerId, { trust: -55, conflict: 45, loyalty: -35, opinion: -60 });
    remember(partner, day, 'betrayal', `Betrug durch ${fullName(npc)} aufgeflogen`, -95, npc.id);
    engine.emit({
      type: 'affair',
      subjects: [partnerId, npc.id],
      text: `${fullName(partner)} hat von der Affäre von ${fullName(npc)} erfahren.`,
      narrative: `erfuhr ${fullName(partner)} von der Affäre von ${fullName(npc)}`,
      importance: 76,
    });
    if (rng.chance(0.62 + (100 - partner.p.agreeableness) / 400)) {
      breakUp(engine, partner, npc, rel, day, 'affair');
    }
    return;
  }
}
