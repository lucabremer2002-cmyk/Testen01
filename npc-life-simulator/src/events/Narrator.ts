import { formatDate, dayToDate } from '../time/calendar';
import type { GameEvent, Story } from './types';

/** Connectors are picked by how much time actually passed between two beats. */
const NEAR_CONNECTORS = [
  'Kurz darauf',
  'Wenige Wochen später',
  'Daraufhin',
  'Nur kurze Zeit später',
  'Im Anschluss',
];

const MID_CONNECTORS = [
  'Einige Monate später',
  'Im Laufe des Jahres',
  'Monate später',
  'Später im selben Jahr',
  'Schließlich',
];

const SLOW_CONNECTORS = [
  'Ein Jahr später',
  'Nach längerer Zeit',
  'Deutlich später',
  'Erst viel später',
];

const TITLE_RULES: { needs: string[]; title: string }[] = [
  { needs: ['fired', 'breakup'], title: 'Als alles auseinanderfiel' },
  { needs: ['fired', 'debt_trouble'], title: 'Der lange Absturz' },
  { needs: ['breakup', 'relationship'], title: 'Ein zweiter Anlauf' },
  { needs: ['breakup', 'wedding'], title: 'Vom Ende zum Neuanfang' },
  { needs: ['bankruptcy', 'company_founded'], title: 'Aufstieg und Fall' },
  { needs: ['promotion', 'wedding'], title: 'Ein außergewöhnliches Jahr' },
  { needs: ['death', 'move'], title: 'Was danach blieb' },
  { needs: ['affair', 'divorce'], title: 'Der Vertrauensbruch' },
  { needs: ['fight', 'reconcile'], title: 'Streit und Versöhnung' },
  { needs: ['company_founded', 'promotion'], title: 'Der Weg nach oben' },
  { needs: ['homeless', 'move'], title: 'Ohne festen Boden' },
  { needs: ['illness', 'recovery'], title: 'Die Rückkehr' },
];

const SINGLE_TITLES: Record<string, string> = {
  death: 'Ein Abschied',
  wedding: 'Eine Hochzeit',
  birth: 'Ein neues Leben',
  fired: 'Der Bruch im Berufsleben',
  breakup: 'Eine unerwartete Trennung',
  divorce: 'Das Ende einer Ehe',
  promotion: 'Der Aufstieg',
  company_founded: 'Der Sprung ins Risiko',
  bankruptcy: 'Das Ende eines Unternehmens',
  affair: 'Ein gut gehütetes Geheimnis',
  crime: 'Eine dunkle Episode',
  windfall: 'Unverhofftes Glück',
  divine: 'Ein Eingriff von oben',
  move: 'Ein neuer Anfang',
  relationship: 'Eine neue Liebe',
};

function pickTitle(events: GameEvent[], name: string, seed: number): string {
  const types = events.map((e) => e.type as string);
  for (const rule of TITLE_RULES) {
    if (rule.needs.every((n) => types.includes(n))) return rule.title;
  }
  // Otherwise name the chain after its heaviest single event.
  let heaviest = events[0];
  for (const e of events) if (e.importance > heaviest.importance) heaviest = e;
  const base = SINGLE_TITLES[heaviest.type] ?? 'Ein bewegtes Kapitel';
  return seed % 3 === 0 ? `${base} – ${name}` : base;
}

/** Turns a causal chain of events into readable German prose. */
export function narrate(events: GameEvent[], protagonistName: string, seed: number): { title: string; summary: string } {
  const sorted = [...events].sort((a, b) => a.day - b.day);
  const parts: string[] = [];
  let prevDay = sorted[0].day;

  sorted.forEach((e, i) => {
    const gap = e.day - prevDay;
    // German main clauses put the verb second, so a story beat is built as
    // "<time phrase> <verb clause>." - the event supplies the verb clause.
    const clause = (e.narrative || fallbackClause(e.text)).trim().replace(/\s+/g, ' ');
    if (i === 0) {
      parts.push(`Am ${formatDate(e.day)} ${clause}.`);
    } else {
      const pool = gap > 300 ? SLOW_CONNECTORS : gap > 70 ? MID_CONNECTORS : NEAR_CONNECTORS;
      const connector = pool[(seed + i * 7) % pool.length];
      const date = gap > 40 ? `, im ${MONTH_NAMES_SHORT[dayToDate(e.day).month]} ${dayToDate(e.day).year},` : '';
      parts.push(`${connector}${date} ${clause}.`);
    }
    prevDay = e.day;
  });

  const span = sorted[sorted.length - 1].day - sorted[0].day;
  const closing =
    span > 700
      ? ` Über ${Math.round(span / 365)} Jahre hinweg veränderte das ${protagonistName}s Leben grundlegend.`
      : span > 120
        ? ` Innerhalb von ${Math.round(span / 30)} Monaten veränderte sich damit vieles.`
        : '';

  return {
    title: pickTitle(sorted, protagonistName, seed),
    summary: parts.join(' ') + closing,
  };
}

const MONTH_NAMES_SHORT = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * Older events carry no narrative clause. Rather than producing broken German,
 * the headline is quoted as a standalone statement.
 */
function fallbackClause(text: string): string {
  return `geschah Folgendes: ${text.replace(/\.$/, '')}`;
}

export function storyPeriod(story: Story): string {
  const a = dayToDate(story.startDay);
  const b = dayToDate(story.endDay);
  if (a.year === b.year) return `${a.year}`;
  return `${a.year}–${b.year}`;
}
