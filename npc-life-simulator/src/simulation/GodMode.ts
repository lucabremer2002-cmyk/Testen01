import { clamp100 } from '../core/math';
import { DAYS_PER_YEAR } from '../time/calendar';
import { applyEmotion } from '../npc/Emotions';
import { remember } from '../npc/Memory';
import { fullName, refreshAge } from '../npc/NPCFactory';
import type { Emotions, NPC, Needs } from '../npc/types';
import type { WeatherKind } from '../world/types';
import type { RumorKind } from '../relationships/Rumors';
import { collectOpenings, hire, leaveJob } from './systems/WorkSystem';
import { breakUp, marry } from './systems/SocialSystem';
import { findHome } from './systems/HousingSystem';
import { killNPC } from './systems/LifeSystem';
import { PROFESSION_BY_ID } from '../economy/professions';
import type { SimulationEngine } from './SimulationEngine';

/**
 * Player interventions. Every action leaves a trace in the world - an event,
 * a memory, a changed relationship - so its consequences ripple through the
 * simulation exactly like any other cause.
 */
export class GodMode {
  constructor(private engine: SimulationEngine) {}

  private divine(npc: NPC, text: string, importance = 45, extra: number[] = []): void {
    this.engine.emit({
      type: 'divine',
      subjects: [npc.id, ...extra],
      text,
      narrative: text.replace(/^.*? (wurde|erhielt|verlor)/, '$1'),
      importance,
    });
  }

  giveMoney(npc: NPC, amount: number): string {
    npc.bank += amount;
    this.engine.ledger.addIncome('divine', amount);
    applyEmotion(npc, {
      happiness: Math.min(45, amount / 900),
      anxiety: -Math.min(20, amount / 2500),
      stress: -Math.min(30, amount / 1800),
      pride: Math.min(15, amount / 4000),
    });
    remember(npc, this.engine.day, 'divine', `Unerwarteter Geldsegen: ${Math.round(amount)} €`, 70, -1);
    this.engine.emit({
      type: 'windfall',
      subjects: [npc.id],
      text: `${fullName(npc)} erhält unerwartet ${Math.round(amount).toLocaleString('de-DE')} €.`,
      narrative: `erhielt ${fullName(npc)} unerwartet ${Math.round(amount).toLocaleString('de-DE')} €`,
      importance: amount > 50000 ? 70 : 50,
    });
    const rumor = this.engine.rumors.create(
      npc.id, 'wealth', true, 40, this.engine.day, `${fullName(npc)} ist plötzlich zu Geld gekommen.`,
    );
    npc.known.add(rumor.id);
    return `${fullName(npc)} hat ${Math.round(amount).toLocaleString('de-DE')} € erhalten.`;
  }

  takeMoney(npc: NPC, amount: number): string {
    const before = npc.bank + npc.money;
    const taken = Math.min(before, amount);
    this.engine.bank.pay(npc, taken);
    if (amount > before) npc.debt += amount - before;
    applyEmotion(npc, { sadness: 20, anxiety: 25, anger: 15, stress: 28 });
    remember(npc, this.engine.day, 'divine', `Plötzlicher Geldverlust: ${Math.round(amount)} €`, -70, -1);
    this.divine(npc, `${fullName(npc)} verliert unerwartet ${Math.round(amount).toLocaleString('de-DE')} €.`, 55);
    return `${fullName(npc)} hat ${Math.round(taken).toLocaleString('de-DE')} € verloren.`;
  }

  /** Places the NPC in the best job currently open. */
  giveJob(npc: NPC): string {
    if (npc.jobId >= 0) return `${fullName(npc)} hat bereits eine Stelle.`;
    const openings = collectOpenings(this.engine);
    if (!openings.length) return 'In der Stadt ist derzeit keine Stelle frei.';
    let best = openings[0];
    let bestScore = -Infinity;
    for (const o of openings) {
      const prof = o.prof;
      const score =
        npc.skills[prof.mainSkill] * 0.6 +
        prof.baseSalary / 60 -
        this.engine.world.distance(
          npc.homeId >= 0 ? npc.homeId : npc.locId,
          this.engine.companies[o.companyId].buildingId,
        ) / 400;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    const company = this.engine.companies[best.companyId];
    hire(this.engine, npc, company, best.prof, Math.min(2, Math.floor(npc.ageYears / 18)));
    return `${fullName(npc)} arbeitet jetzt bei ${company.name}.`;
  }

  removeJob(npc: NPC): string {
    if (npc.jobId < 0) return `${fullName(npc)} hat keine Stelle.`;
    leaveJob(this.engine, npc, 'fired');
    return `${fullName(npc)} wurde die Stelle genommen.`;
  }

  /** Moves the NPC into a different home. */
  relocate(npc: NPC): string {
    if (findHome(this.engine, npc, true)) {
      const home = this.engine.world.buildings[npc.homeId];
      return `${fullName(npc)} wohnt jetzt in ${home.name}.`;
    }
    return 'Es ist keine passende Wohnung frei.';
  }

  teleport(npc: NPC, buildingId: number): string {
    const world = this.engine.world;
    const target = world.buildings[buildingId];
    if (!target) return 'Unbekanntes Ziel.';
    const old = world.buildings[npc.locId];
    if (old) {
      old.occupants = Math.max(0, old.occupants - 1);
      const i = old.present.indexOf(npc.id);
      if (i >= 0) old.present.splice(i, 1);
    }
    npc.travel = null;
    npc.locId = buildingId;
    target.occupants++;
    target.present.push(npc.id);
    npc.action = {
      type: 'idle',
      locationId: buildingId,
      partner: -1,
      startMin: this.engine.now,
      endMin: this.engine.now + 10,
    };
    npc.nextDecisionMin = this.engine.now + 5;
    this.engine.scheduler.schedule(npc.id, npc.nextDecisionMin);
    applyEmotion(npc, { anxiety: 12 });
    return `${fullName(npc)} wurde nach ${target.name} versetzt.`;
  }

  /** Pushes two NPCs together as a couple. */
  matchmake(a: NPC, b: NPC): string {
    if (a.id === b.id) return 'Das ergibt keinen Sinn.';
    if (a.family.partner === b.id) return `${fullName(a)} und ${fullName(b)} sind bereits ein Paar.`;
    if (a.family.partner >= 0) this.separate(a);
    if (b.family.partner >= 0) this.separate(b);
    const rel = this.engine.rels.ensure(a, b, this.engine.day);
    rel.type = 'dating';
    rel.romantic = true;
    rel.sinceDay = this.engine.day;
    rel.trust = Math.max(rel.trust, 62);
    rel.closeness = Math.max(rel.closeness, 68);
    rel.sympathy = Math.max(rel.sympathy, 70);
    rel.attractionAB = Math.max(rel.attractionAB, 72);
    rel.attractionBA = Math.max(rel.attractionBA, 72);
    rel.conflict = Math.min(rel.conflict, 10);
    a.family.partner = b.id;
    b.family.partner = a.id;
    applyEmotion(a, { love: 60, happiness: 28, loneliness: -45 });
    applyEmotion(b, { love: 60, happiness: 28, loneliness: -45 });
    remember(a, this.engine.day, 'divine', `Beziehung mit ${fullName(b)}`, 70, b.id);
    remember(b, this.engine.day, 'divine', `Beziehung mit ${fullName(a)}`, 70, a.id);
    this.engine.emit({
      type: 'relationship',
      subjects: [a.id, b.id],
      text: `${fullName(a)} und ${fullName(b)} sind ein Paar geworden.`,
      narrative: `wurden ${fullName(a)} und ${fullName(b)} ein Paar`,
      importance: 58,
    });
    return `${fullName(a)} und ${fullName(b)} sind jetzt zusammen.`;
  }

  weddingFor(a: NPC): string {
    const b = a.family.partner >= 0 ? this.engine.npcs[a.family.partner] : null;
    if (!b?.alive) return `${fullName(a)} hat keine Partnerin bzw. keinen Partner.`;
    if (a.family.married) return 'Die beiden sind bereits verheiratet.';
    const rel = this.engine.rels.get(a.id, b.id);
    if (!rel) return 'Zwischen den beiden besteht keine Beziehung.';
    marry(this.engine, a, b, rel, this.engine.day);
    return `${fullName(a)} und ${fullName(b)} haben geheiratet.`;
  }

  separate(npc: NPC): string {
    const partnerId = npc.family.partner;
    if (partnerId < 0) return `${fullName(npc)} ist bereits solo.`;
    const partner = this.engine.npcs[partnerId];
    const rel = this.engine.rels.get(npc.id, partnerId);
    if (!partner || !rel) return 'Beziehung nicht gefunden.';
    breakUp(this.engine, npc, partner, rel, this.engine.day, 'conflict');
    return `${fullName(npc)} und ${fullName(partner)} sind getrennt.`;
  }

  adjustRelationship(a: NPC, b: NPC, delta: number): string {
    const rel = this.engine.rels.ensure(a, b, this.engine.day);
    this.engine.rels.modify(rel, a.id, {
      closeness: delta,
      sympathy: delta,
      trust: delta * 0.8,
      respect: delta * 0.6,
      conflict: -delta * 0.8,
      opinion: delta,
    });
    this.engine.rels.refreshType(rel);
    applyEmotion(a, delta > 0 ? { happiness: 6 } : { anger: 8, sadness: 5 });
    applyEmotion(b, delta > 0 ? { happiness: 6 } : { anger: 8, sadness: 5 });
    return delta > 0
      ? `${fullName(a)} und ${fullName(b)} stehen sich näher.`
      : `${fullName(a)} und ${fullName(b)} haben sich entfremdet.`;
  }

  setEmotion(npc: NPC, key: keyof Emotions, value: number): string {
    npc.emo[key] = clamp100(value);
    return `${fullName(npc)}: Emotion angepasst.`;
  }

  makeHappy(npc: NPC): string {
    applyEmotion(npc, {
      happiness: 55, calm: 35, motivation: 25, pride: 20,
      sadness: -45, anger: -40, anxiety: -35, loneliness: -30, disappointment: -35, stress: -50,
    });
    remember(npc, this.engine.day, 'divine', 'Ein Moment unerklärlichen Glücks', 60, -1, 55);
    this.divine(npc, `${fullName(npc)} fühlt sich plötzlich zutiefst glücklich.`, 38);
    return `${fullName(npc)} ist überglücklich.`;
  }

  makeAngry(npc: NPC): string {
    applyEmotion(npc, { anger: 60, happiness: -30, calm: -40, stress: 40, jealousy: 20 });
    remember(npc, this.engine.day, 'divine', 'Ein Anfall unerklärlicher Wut', -55, -1, 55);
    this.divine(npc, `${fullName(npc)} kocht plötzlich vor Wut.`, 38);
    return `${fullName(npc)} ist wütend.`;
  }

  setNeed(npc: NPC, key: keyof Needs, value: number): string {
    npc.needs[key] = clamp100(value);
    return `${fullName(npc)}: Bedürfnis angepasst.`;
  }

  restoreNeeds(npc: NPC): string {
    npc.needs.hunger = 100;
    npc.needs.energy = 100;
    npc.needs.hygiene = 100;
    npc.needs.social = 90;
    npc.needs.fun = 90;
    npc.needs.comfort = 90;
    npc.needs.safety = 95;
    npc.needs.stress = 5;
    npc.a.health = clamp100(npc.a.health + 30);
    return `${fullName(npc)} ist bestens versorgt.`;
  }

  /** Shifts the NPC's age; negative values make them younger. */
  shiftAge(npc: NPC, years: number): string {
    npc.birthDay -= years * DAYS_PER_YEAR;
    refreshAge(npc, this.engine.day);
    if (years < 0) npc.a.health = clamp100(npc.a.health + Math.min(30, -years * 2));
    if (npc.ageYears < 18 && npc.jobId >= 0) leaveJob(this.engine, npc, 'quit');
    if (npc.ageYears < 67) npc.retired = false;
    this.divine(
      npc,
      years > 0
        ? `${fullName(npc)} altert plötzlich um ${years} Jahre.`
        : `${fullName(npc)} wird um ${-years} Jahre jünger.`,
      46,
    );
    return `${fullName(npc)} ist jetzt ${npc.ageYears} Jahre alt.`;
  }

  spreadRumor(npc: NPC, kind: RumorKind, text: string): string {
    const rumor = this.engine.rumors.create(npc.id, kind, false, 75, this.engine.day, text);
    // Seed it with a few well-connected people so it actually travels.
    let seeded = 0;
    for (const otherId of npc.links) {
      const other = this.engine.npcs[otherId];
      if (!other?.alive) continue;
      other.known.add(rumor.id);
      rumor.spread++;
      if (++seeded >= 5) break;
    }
    this.engine.emit({
      type: 'rumor',
      subjects: [npc.id],
      text: `Ein Gerücht über ${fullName(npc)} macht die Runde: ${text}`,
      narrative: `verbreitete sich ein Gerücht über ${fullName(npc)}`,
      importance: 48,
    });
    return 'Das Gerücht ist in der Welt.';
  }

  strikeDown(npc: NPC): string {
    killNPC(this.engine, npc, this.engine.day, 'unerklärliche Umstände');
    return `${fullName(npc)} ist nicht mehr unter uns.`;
  }

  setWeather(kind: WeatherKind, temperature?: number): string {
    this.engine.world.weather.force(kind, temperature);
    this.engine.emit({
      type: 'weather',
      subjects: [],
      text: `Das Wetter schlägt um: ${kind}.`,
      narrative: `schlug das Wetter um`,
      importance: 24,
    });
    return `Wetter auf „${kind}“ gesetzt.`;
  }

  releaseWeather(): string {
    this.engine.world.weather.release(this.engine.now);
    return 'Das Wetter folgt wieder seinem eigenen Lauf.';
  }

  /** Economy-wide shock, for players who like to watch things burn. */
  economicShock(strength: number): string {
    for (const c of this.engine.companies) {
      if (c.bankrupt) continue;
      c.balance -= Math.abs(c.balance) * strength * 0.5 + 12000 * strength;
      c.reputation = clamp100(c.reputation - strength * 20);
    }
    this.engine.market.economyHealth = clamp100(this.engine.market.economyHealth - strength * 45);
    this.engine.emit({
      type: 'milestone',
      subjects: [],
      text: `Eine Wirtschaftskrise erschüttert ${this.engine.world.name}.`,
      narrative: `erschütterte eine Wirtschaftskrise ${this.engine.world.name}`,
      importance: 72,
    });
    return 'Die Wirtschaft wankt.';
  }

  boom(strength: number): string {
    for (const c of this.engine.companies) {
      if (c.bankrupt) continue;
      c.balance += 18000 * strength;
      c.reputation = clamp100(c.reputation + strength * 12);
    }
    this.engine.market.economyHealth = clamp100(this.engine.market.economyHealth + strength * 30);
    this.engine.emit({
      type: 'milestone',
      subjects: [],
      text: `${this.engine.world.name} erlebt einen Wirtschaftsaufschwung.`,
      narrative: `erlebte ${this.engine.world.name} einen Aufschwung`,
      importance: 60,
    });
    return 'Die Wirtschaft brummt.';
  }

  professionLabel(npc: NPC): string {
    const prof = this.engine.professionOf(npc);
    if (!prof) return 'ohne Beschäftigung';
    return PROFESSION_BY_ID.get(prof.id)?.label ?? prof.label;
  }
}
