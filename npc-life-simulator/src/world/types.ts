export type BuildingType =
  | 'house'
  | 'apartment'
  | 'office'
  | 'factory'
  | 'workshop'
  | 'shop'
  | 'supermarket'
  | 'restaurant'
  | 'bar'
  | 'cafe'
  | 'gym'
  | 'park'
  | 'school'
  | 'university'
  | 'hospital'
  | 'police'
  | 'fire'
  | 'bank'
  | 'mall'
  | 'station'
  | 'sports'
  | 'library'
  | 'townhall'
  | 'cemetery';

export type DistrictType =
  | 'downtown'
  | 'residential'
  | 'industrial'
  | 'suburb'
  | 'oldtown'
  | 'commercial'
  | 'green'
  | 'campus';

export interface District {
  id: number;
  name: string;
  type: DistrictType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..100 - drives rent, appeal and who moves here. */
  prestige: number;
  buildings: number[];
}

export interface Building {
  id: number;
  name: string;
  type: BuildingType;
  districtId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..100 - condition/comfort of the place. */
  quality: number;
  /** Residential: number of people that fit. Others: visitor capacity. */
  capacity: number;
  /** Residential only. */
  residents: number[];
  /** Monthly rent for residential buildings. */
  rent: number;
  /** Purchase price for residential buildings. */
  price: number;
  /** Owner NPC id, or -1 when owned by the (abstract) market. */
  ownerId: number;
  /** Company operating from this building, if any. */
  companyId: number;
  /** Current visitor count - used for "busy" rendering and social encounters. */
  occupants: number;
  /** Ids of NPCs currently inside; rebuilt on load, not persisted. */
  present: number[];
  /** Arrivals since the last daily reset - the basis for business revenue. */
  visitsToday: number;
}

export interface RoadSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
}

export interface WorldGeometry {
  width: number;
  height: number;
  districts: District[];
  buildings: Building[];
  roads: RoadSegment[];
}

export type WeatherKind = 'klar' | 'bewölkt' | 'regen' | 'sturm' | 'schnee' | 'hitze' | 'nebel';

export interface Weather {
  kind: WeatherKind;
  /** Celsius. */
  temperature: number;
  /** 0..1 - how strongly weather nudges mood and outdoor activities. */
  intensity: number;
  /** Absolute sim minute at which the current weather expires. */
  until: number;
}

/** Buildings that count as a place to live. */
export const RESIDENTIAL_TYPES: readonly BuildingType[] = ['house', 'apartment'];

/** Outdoor locations - weather matters there. */
export const OUTDOOR_TYPES: readonly BuildingType[] = ['park', 'sports', 'cemetery'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  house: 'Haus',
  apartment: 'Wohnhaus',
  office: 'Bürogebäude',
  factory: 'Fabrik',
  workshop: 'Werkstatt',
  shop: 'Geschäft',
  supermarket: 'Supermarkt',
  restaurant: 'Restaurant',
  bar: 'Bar',
  cafe: 'Café',
  gym: 'Fitnessstudio',
  park: 'Park',
  school: 'Schule',
  university: 'Universität',
  hospital: 'Krankenhaus',
  police: 'Polizeiwache',
  fire: 'Feuerwache',
  bank: 'Bank',
  mall: 'Einkaufszentrum',
  station: 'Bahnhof',
  sports: 'Sportzentrum',
  library: 'Bibliothek',
  townhall: 'Rathaus',
  cemetery: 'Friedhof',
};

export const DISTRICT_LABEL: Record<DistrictType, string> = {
  downtown: 'Innenstadt',
  residential: 'Wohngebiet',
  industrial: 'Industriegebiet',
  suburb: 'Vorstadt',
  oldtown: 'Altstadt',
  commercial: 'Gewerbegebiet',
  green: 'Grünanlage',
  campus: 'Campus',
};
