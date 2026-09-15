export type EventType =
  | 'birth'
  | 'death'
  | 'hired'
  | 'fired'
  | 'quit'
  | 'promotion'
  | 'demotion'
  | 'wedding'
  | 'engagement'
  | 'relationship'
  | 'breakup'
  | 'divorce'
  | 'affair'
  | 'friendship'
  | 'fight'
  | 'reconcile'
  | 'move'
  | 'homeless'
  | 'bought_home'
  | 'company_founded'
  | 'bankruptcy'
  | 'crime'
  | 'illness'
  | 'accident'
  | 'recovery'
  | 'graduation'
  | 'retirement'
  | 'debt_trouble'
  | 'windfall'
  | 'rumor'
  | 'weather'
  | 'divine'
  | 'newcomer'
  | 'milestone';

export interface GameEvent {
  id: number;
  /** Absolute simulated minute. */
  minute: number;
  day: number;
  type: EventType;
  /** NPCs involved; the first entry is the protagonist. */
  subjects: number[];
  companyId: number;
  buildingId: number;
  /** 0..100 - decides news visibility and story inclusion. */
  importance: number;
  /** Headline shown in the news feed (present tense). */
  text: string;
  /** Past-tense clause starting with the verb, used to build story prose. */
  narrative: string;
  /** Id of the event that caused this one, or -1. */
  cause: number;
}

export interface StoryBeat {
  eventId: number;
  day: number;
  text: string;
}

export interface Story {
  id: number;
  title: string;
  protagonist: number;
  cast: number[];
  startDay: number;
  endDay: number;
  beats: StoryBeat[];
  summary: string;
  /** 0..100 - how dramatic the chain is. */
  weight: number;
}

/** Categories used to colour the news feed. */
export const EVENT_CATEGORY: Record<EventType, 'life' | 'work' | 'love' | 'social' | 'money' | 'city'> = {
  birth: 'life',
  death: 'life',
  hired: 'work',
  fired: 'work',
  quit: 'work',
  promotion: 'work',
  demotion: 'work',
  wedding: 'love',
  engagement: 'love',
  relationship: 'love',
  breakup: 'love',
  divorce: 'love',
  affair: 'love',
  friendship: 'social',
  fight: 'social',
  reconcile: 'social',
  move: 'life',
  homeless: 'money',
  bought_home: 'money',
  company_founded: 'money',
  bankruptcy: 'money',
  crime: 'city',
  illness: 'life',
  accident: 'life',
  recovery: 'life',
  graduation: 'life',
  retirement: 'work',
  debt_trouble: 'money',
  windfall: 'money',
  rumor: 'social',
  weather: 'city',
  divine: 'city',
  newcomer: 'city',
  milestone: 'city',
};
