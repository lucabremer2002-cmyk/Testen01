import type { Profession } from './types';

const OFFICE_LADDER = ['Praktikant', 'Junior', 'Mitarbeiter', 'Senior', 'Teamleiter', 'Manager'] as const;
const TRADE_LADDER = ['Azubi', 'Geselle', 'Facharbeiter', 'Vorarbeiter', 'Meister', 'Betriebsleiter'] as const;
const SERVICE_LADDER = ['Aushilfe', 'Mitarbeiter', 'Erfahrener Mitarbeiter', 'Schichtleiter', 'Filialleiter', 'Regionalleiter'] as const;
const MED_LADDER = ['Assistenz', 'Fachkraft', 'Erfahrene Fachkraft', 'Stationsleitung', 'Oberarzt/Oberärztin', 'Chefarzt/Chefärztin'] as const;
const EDU_LADDER = ['Referendar', 'Lehrkraft', 'Erfahrene Lehrkraft', 'Fachleitung', 'Konrektor', 'Rektor'] as const;

/** The city's job catalogue. Density drives how many slots a business offers. */
export const PROFESSIONS: readonly Profession[] = [
  {
    id: 'verkaeufer', label: 'Verkäufer/in', buildings: ['shop', 'supermarket', 'mall'],
    baseSalary: 2150, stepFactor: 0.16, ladder: SERVICE_LADDER, mainSkill: 'social', secondSkill: 'business',
    minEducation: 1, hours: [9, 18], prestige: 30, density: 6, weekend: true,
  },
  {
    id: 'kassierer', label: 'Kassierer/in', buildings: ['supermarket', 'mall'],
    baseSalary: 1950, stepFactor: 0.13, ladder: SERVICE_LADDER, mainSkill: 'social', secondSkill: 'business',
    minEducation: 0, hours: [8, 17], prestige: 24, density: 4, weekend: true,
  },
  {
    id: 'handwerker', label: 'Handwerker/in', buildings: ['workshop', 'factory'],
    baseSalary: 2650, stepFactor: 0.17, ladder: TRADE_LADDER, mainSkill: 'craft', secondSkill: 'fitness',
    minEducation: 2, hours: [7, 16], prestige: 42, density: 5, weekend: false,
  },
  {
    id: 'mechaniker', label: 'Mechaniker/in', buildings: ['workshop', 'factory', 'station'],
    baseSalary: 2750, stepFactor: 0.17, ladder: TRADE_LADDER, mainSkill: 'craft', secondSkill: 'driving',
    minEducation: 2, hours: [8, 17], prestige: 44, density: 4, weekend: false,
  },
  {
    id: 'fabrikarbeiter', label: 'Produktionsmitarbeiter/in', buildings: ['factory'],
    baseSalary: 2400, stepFactor: 0.14, ladder: TRADE_LADDER, mainSkill: 'craft', secondSkill: 'fitness',
    minEducation: 1, hours: [6, 15], prestige: 32, density: 10, weekend: false,
  },
  {
    id: 'ingenieur', label: 'Ingenieur/in', buildings: ['factory', 'office'],
    baseSalary: 4300, stepFactor: 0.2, ladder: OFFICE_LADDER, mainSkill: 'tech', secondSkill: 'craft',
    minEducation: 3, hours: [8, 17], prestige: 72, density: 3, weekend: false,
  },
  {
    id: 'programmierer', label: 'Softwareentwickler/in', buildings: ['office'],
    baseSalary: 4600, stepFactor: 0.21, ladder: OFFICE_LADDER, mainSkill: 'tech', secondSkill: 'business',
    minEducation: 2, hours: [9, 18], prestige: 70, density: 5, weekend: false,
  },
  {
    id: 'lehrer', label: 'Lehrer/in', buildings: ['school'],
    baseSalary: 3850, stepFactor: 0.15, ladder: EDU_LADDER, mainSkill: 'teaching', secondSkill: 'social',
    minEducation: 3, hours: [7, 15], prestige: 66, density: 12, weekend: false,
  },
  {
    id: 'dozent', label: 'Dozent/in', buildings: ['university'],
    baseSalary: 5200, stepFactor: 0.18, ladder: ['Tutor', 'Lehrbeauftragter', 'Dozent', 'Oberdozent', 'Professor', 'Institutsleitung'],
    mainSkill: 'teaching', secondSkill: 'art', minEducation: 4, hours: [9, 17], prestige: 82, density: 14, weekend: false,
  },
  {
    id: 'arzt', label: 'Arzt/Ärztin', buildings: ['hospital'],
    baseSalary: 6600, stepFactor: 0.19, ladder: MED_LADDER, mainSkill: 'medical', secondSkill: 'social',
    minEducation: 4, hours: [8, 18], prestige: 92, density: 8, weekend: true,
  },
  {
    id: 'pflegekraft', label: 'Pflegekraft', buildings: ['hospital'],
    baseSalary: 2900, stepFactor: 0.14, ladder: MED_LADDER, mainSkill: 'medical', secondSkill: 'social',
    minEducation: 2, hours: [6, 15], prestige: 58, density: 18, weekend: true,
  },
  {
    id: 'polizist', label: 'Polizist/in', buildings: ['police'],
    baseSalary: 3250, stepFactor: 0.15, ladder: ['Anwärter', 'Beamter', 'Obermeister', 'Hauptmeister', 'Kommissar', 'Hauptkommissar'],
    mainSkill: 'fitness', secondSkill: 'social', minEducation: 2, hours: [7, 17], prestige: 64, density: 14, weekend: true,
  },
  {
    id: 'feuerwehrmann', label: 'Feuerwehrkraft', buildings: ['fire'],
    baseSalary: 3150, stepFactor: 0.15, ladder: ['Anwärter', 'Feuerwehrmann', 'Oberfeuerwehrmann', 'Hauptfeuerwehrmann', 'Brandmeister', 'Wachleiter'],
    mainSkill: 'fitness', secondSkill: 'craft', minEducation: 2, hours: [8, 20], prestige: 66, density: 12, weekend: true,
  },
  {
    id: 'fahrer', label: 'Fahrer/in', buildings: ['station', 'factory', 'supermarket', 'mall'],
    baseSalary: 2400, stepFactor: 0.12, ladder: SERVICE_LADDER, mainSkill: 'driving', secondSkill: 'craft',
    minEducation: 1, hours: [6, 15], prestige: 30, density: 5, weekend: true,
  },
  {
    id: 'koch', label: 'Koch/Köchin', buildings: ['restaurant', 'cafe'],
    baseSalary: 2750, stepFactor: 0.16, ladder: ['Küchenhilfe', 'Jungkoch', 'Koch', 'Souschef', 'Küchenchef', 'Gastronomieleitung'],
    mainSkill: 'cooking', secondSkill: 'craft', minEducation: 2, hours: [11, 22], prestige: 46, density: 4, weekend: true,
  },
  {
    id: 'kellner', label: 'Servicekraft', buildings: ['restaurant', 'cafe', 'bar'],
    baseSalary: 2000, stepFactor: 0.12, ladder: SERVICE_LADDER, mainSkill: 'social', secondSkill: 'cooking',
    minEducation: 0, hours: [12, 23], prestige: 26, density: 6, weekend: true,
  },
  {
    id: 'barkeeper', label: 'Barkeeper/in', buildings: ['bar'],
    baseSalary: 2250, stepFactor: 0.13, ladder: SERVICE_LADDER, mainSkill: 'social', secondSkill: 'cooking',
    minEducation: 0, hours: [17, 26], prestige: 32, density: 4, weekend: true,
  },
  {
    id: 'bueroangestellter', label: 'Büroangestellte/r', buildings: ['office', 'bank', 'townhall'],
    baseSalary: 3050, stepFactor: 0.15, ladder: OFFICE_LADDER, mainSkill: 'business', secondSkill: 'tech',
    minEducation: 2, hours: [8, 17], prestige: 48, density: 8, weekend: false,
  },
  {
    id: 'manager', label: 'Manager/in', buildings: ['office', 'factory', 'mall', 'bank'],
    baseSalary: 5900, stepFactor: 0.22, ladder: ['Teamleiter', 'Abteilungsleiter', 'Bereichsleiter', 'Direktor', 'Geschäftsführer', 'Vorstand'],
    mainSkill: 'business', secondSkill: 'social', minEducation: 3, hours: [8, 19], prestige: 84, density: 2, weekend: false,
  },
  {
    id: 'banker', label: 'Bankkaufmann/-frau', buildings: ['bank'],
    baseSalary: 4400, stepFactor: 0.19, ladder: OFFICE_LADDER, mainSkill: 'business', secondSkill: 'social',
    minEducation: 3, hours: [9, 17], prestige: 74, density: 8, weekend: false,
  },
  {
    id: 'journalist', label: 'Journalist/in', buildings: ['office', 'library'],
    baseSalary: 3300, stepFactor: 0.16, ladder: ['Volontär', 'Redakteur', 'Fachredakteur', 'Ressortleiter', 'Chefredakteur', 'Herausgeber'],
    mainSkill: 'art', secondSkill: 'social', minEducation: 3, hours: [9, 19], prestige: 62, density: 3, weekend: false,
  },
  {
    id: 'kuenstler', label: 'Künstler/in', buildings: ['library', 'cafe', 'office'],
    baseSalary: 2100, stepFactor: 0.25, ladder: ['Hobbykünstler', 'Nachwuchskünstler', 'Künstler', 'Etablierter Künstler', 'Gefragter Künstler', 'Star'],
    mainSkill: 'art', secondSkill: 'social', minEducation: 1, hours: [11, 19], prestige: 54, density: 2, weekend: true,
  },
  {
    id: 'sportler', label: 'Profisportler/in', buildings: ['sports'],
    baseSalary: 3600, stepFactor: 0.3, ladder: ['Amateur', 'Halbprofi', 'Profi', 'Leistungsträger', 'Star', 'Legende'],
    mainSkill: 'fitness', secondSkill: 'social', minEducation: 1, hours: [9, 17], prestige: 76, density: 8, weekend: true,
  },
  {
    id: 'trainer', label: 'Trainer/in', buildings: ['gym', 'sports'],
    baseSalary: 2600, stepFactor: 0.15, ladder: SERVICE_LADDER, mainSkill: 'fitness', secondSkill: 'teaching',
    minEducation: 2, hours: [8, 20], prestige: 44, density: 5, weekend: true,
  },
  {
    id: 'bibliothekar', label: 'Bibliothekar/in', buildings: ['library'],
    baseSalary: 2800, stepFactor: 0.13, ladder: SERVICE_LADDER, mainSkill: 'teaching', secondSkill: 'art',
    minEducation: 3, hours: [9, 18], prestige: 52, density: 4, weekend: false,
  },
  {
    id: 'reinigungskraft', label: 'Reinigungskraft', buildings: ['office', 'hospital', 'school', 'mall', 'station', 'university'],
    baseSalary: 1900, stepFactor: 0.1, ladder: SERVICE_LADDER, mainSkill: 'craft', secondSkill: 'fitness',
    minEducation: 0, hours: [5, 13], prestige: 18, density: 3, weekend: false,
  },
  {
    id: 'sicherheit', label: 'Sicherheitskraft', buildings: ['mall', 'station', 'bank', 'sports'],
    baseSalary: 2300, stepFactor: 0.12, ladder: SERVICE_LADDER, mainSkill: 'fitness', secondSkill: 'social',
    minEducation: 1, hours: [14, 24], prestige: 28, density: 4, weekend: true,
  },
  {
    id: 'beamter', label: 'Verwaltungsbeamter/in', buildings: ['townhall'],
    baseSalary: 3400, stepFactor: 0.14, ladder: OFFICE_LADDER, mainSkill: 'business', secondSkill: 'teaching',
    minEducation: 2, hours: [8, 16], prestige: 56, density: 16, weekend: false,
  },
];

export const PROFESSION_BY_ID = new Map<string, Profession>(PROFESSIONS.map((p) => [p.id, p]));

/** Professions performable in a given building type. */
const BY_BUILDING = new Map<string, Profession[]>();
for (const p of PROFESSIONS) {
  for (const b of p.buildings) {
    let list = BY_BUILDING.get(b);
    if (!list) {
      list = [];
      BY_BUILDING.set(b, list);
    }
    list.push(p);
  }
}

export const professionsFor = (buildingType: string): Profession[] => BY_BUILDING.get(buildingType) ?? [];

export function salaryFor(prof: Profession, level: number, marketFactor = 1): number {
  return Math.round(prof.baseSalary * (1 + prof.stepFactor * level) * marketFactor);
}

export function levelTitle(prof: Profession, level: number): string {
  const i = Math.min(level, prof.ladder.length - 1);
  return prof.ladder[i];
}

export const MAX_CAREER_LEVEL = 5;
