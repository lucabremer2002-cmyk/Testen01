import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import {
  type Building,
  type BuildingType,
  type District,
  type DistrictType,
  type RoadSegment,
  type WorldGeometry,
  BUILDING_LABEL,
  DISTRICT_LABEL,
} from './types';
import {
  COMPANY_STEMS,
  COMPANY_SUFFIX_BY_KIND,
  DISTRICT_NAME_PARTS,
  STANDALONE_DISTRICTS,
  STREETS,
} from './worldNames';

export interface CityGenOptions {
  /** Roughly how many people the city must be able to house. */
  targetPopulation: number;
  gridCols?: number;
  gridRows?: number;
}

interface TypeMix {
  type: BuildingType;
  weight: number;
}

/** Building mix per district type - the weights shape the city's character. */
const DISTRICT_MIX: Record<DistrictType, TypeMix[]> = {
  downtown: [
    { type: 'office', weight: 26 },
    { type: 'apartment', weight: 20 },
    { type: 'shop', weight: 12 },
    { type: 'restaurant', weight: 9 },
    { type: 'cafe', weight: 7 },
    { type: 'bar', weight: 6 },
    { type: 'bank', weight: 4 },
    { type: 'mall', weight: 3 },
    { type: 'gym', weight: 3 },
    { type: 'supermarket', weight: 3 },
    { type: 'library', weight: 2 },
    { type: 'townhall', weight: 1 },
  ],
  oldtown: [
    { type: 'apartment', weight: 24 },
    { type: 'cafe', weight: 12 },
    { type: 'restaurant', weight: 12 },
    { type: 'bar', weight: 10 },
    { type: 'shop', weight: 12 },
    { type: 'house', weight: 10 },
    { type: 'office', weight: 8 },
    { type: 'library', weight: 3 },
    { type: 'supermarket', weight: 3 },
    { type: 'park', weight: 3 },
  ],
  residential: [
    { type: 'apartment', weight: 42 },
    { type: 'house', weight: 26 },
    { type: 'supermarket', weight: 7 },
    { type: 'shop', weight: 6 },
    { type: 'cafe', weight: 4 },
    { type: 'school', weight: 4 },
    { type: 'park', weight: 4 },
    { type: 'gym', weight: 3 },
    { type: 'restaurant', weight: 3 },
    { type: 'bar', weight: 1 },
  ],
  suburb: [
    { type: 'house', weight: 58 },
    { type: 'apartment', weight: 12 },
    { type: 'supermarket', weight: 6 },
    { type: 'school', weight: 5 },
    { type: 'park', weight: 6 },
    { type: 'shop', weight: 4 },
    { type: 'sports', weight: 3 },
    { type: 'cafe', weight: 3 },
    { type: 'restaurant', weight: 3 },
  ],
  industrial: [
    { type: 'factory', weight: 40 },
    { type: 'workshop', weight: 24 },
    { type: 'office', weight: 12 },
    { type: 'shop', weight: 6 },
    { type: 'supermarket', weight: 4 },
    { type: 'cafe', weight: 5 },
    { type: 'fire', weight: 3 },
    { type: 'apartment', weight: 6 },
  ],
  commercial: [
    { type: 'shop', weight: 24 },
    { type: 'mall', weight: 8 },
    { type: 'office', weight: 18 },
    { type: 'supermarket', weight: 10 },
    { type: 'restaurant', weight: 10 },
    { type: 'gym', weight: 7 },
    { type: 'workshop', weight: 7 },
    { type: 'bank', weight: 5 },
    { type: 'cafe', weight: 6 },
    { type: 'apartment', weight: 5 },
  ],
  green: [
    { type: 'park', weight: 55 },
    { type: 'sports', weight: 18 },
    { type: 'cafe', weight: 10 },
    { type: 'house', weight: 8 },
    { type: 'cemetery', weight: 6 },
    { type: 'restaurant', weight: 3 },
  ],
  campus: [
    { type: 'university', weight: 18 },
    { type: 'school', weight: 12 },
    { type: 'library', weight: 10 },
    { type: 'apartment', weight: 22 },
    { type: 'cafe', weight: 10 },
    { type: 'sports', weight: 8 },
    { type: 'park', weight: 8 },
    { type: 'bar', weight: 6 },
    { type: 'supermarket', weight: 6 },
  ],
};

/** Footprint (w, h) and slot spacing per building type, in world units. */
const FOOTPRINT: Partial<Record<BuildingType, [number, number]>> = {
  house: [26, 22],
  apartment: [38, 32],
  office: [46, 40],
  factory: [64, 48],
  workshop: [40, 30],
  shop: [28, 24],
  supermarket: [46, 34],
  restaurant: [32, 26],
  bar: [28, 24],
  cafe: [24, 22],
  gym: [38, 30],
  park: [70, 58],
  school: [58, 42],
  university: [78, 56],
  hospital: [70, 52],
  police: [42, 32],
  fire: [42, 32],
  bank: [38, 32],
  mall: [72, 54],
  station: [76, 46],
  sports: [62, 46],
  library: [42, 34],
  townhall: [50, 40],
  cemetery: [64, 50],
};

const RESIDENT_CAPACITY: Partial<Record<BuildingType, [number, number]>> = {
  house: [2, 6],
  apartment: [8, 26],
};

const BASE_QUALITY: Partial<Record<DistrictType, [number, number]>> = {
  downtown: [55, 92],
  oldtown: [48, 88],
  residential: [40, 78],
  suburb: [50, 88],
  industrial: [20, 55],
  commercial: [38, 72],
  green: [55, 90],
  campus: [45, 80],
};

const PRESTIGE: Record<DistrictType, [number, number]> = {
  downtown: [65, 95],
  oldtown: [55, 85],
  residential: [35, 65],
  suburb: [50, 82],
  industrial: [10, 35],
  commercial: [35, 60],
  green: [60, 90],
  campus: [45, 75],
};

function districtLayout(cols: number, rows: number, rng: RNG): DistrictType[] {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const out: DistrictType[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.hypot((c - cx) / cx || 0, (r - cy) / cy || 0);
      let t: DistrictType;
      if (d < 0.35) t = rng.chance(0.5) ? 'downtown' : 'oldtown';
      else if (d < 0.68) t = rng.chance(0.45) ? 'commercial' : 'residential';
      else t = rng.pick(['suburb', 'suburb', 'residential', 'industrial', 'green', 'campus'] as DistrictType[]);
      out.push(t);
    }
  }
  // Guarantee one campus, one green and one industrial district exist.
  const ensure = (type: DistrictType) => {
    if (out.includes(type)) return;
    const outerIdx: number[] = [];
    for (let i = 0; i < out.length; i++) if (out[i] === 'suburb' || out[i] === 'residential') outerIdx.push(i);
    if (outerIdx.length) out[rng.pick(outerIdx)] = type;
  };
  ensure('campus');
  ensure('green');
  ensure('industrial');
  return out;
}

function districtName(type: DistrictType, rng: RNG, used: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = rng.chance(0.4)
      ? rng.pick(STANDALONE_DISTRICTS)
      : rng.pick(DISTRICT_NAME_PARTS.prefix) + rng.pick(DISTRICT_NAME_PARTS.stem);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${DISTRICT_LABEL[type]} ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function buildingName(type: BuildingType, rng: RNG, district: District): string {
  const suffixes = COMPANY_SUFFIX_BY_KIND[type] ?? [BUILDING_LABEL[type]];
  switch (type) {
    case 'house':
    case 'apartment':
      return `${rng.pick(STREETS)} ${rng.int(1, 120)}`;
    case 'park':
      return rng.chance(0.5) ? `${district.name}er Park` : `${rng.pick(COMPANY_STEMS)}park`;
    case 'station':
      return `Bahnhof ${district.name}`;
    case 'townhall':
      return 'Rathaus';
    case 'cemetery':
      return `Friedhof ${district.name}`;
    case 'police':
      return `Polizeiwache ${district.name}`;
    case 'fire':
      return `Feuerwache ${district.name}`;
    case 'hospital':
      return rng.chance(0.5) ? `Klinikum ${district.name}` : `${rng.pick(COMPANY_STEMS)}-Klinik`;
    case 'university':
      return `Universität ${district.name}`;
    case 'school':
      return `${rng.pick(COMPANY_STEMS)}-${rng.pick(suffixes)}`;
    default:
      return `${rng.pick(COMPANY_STEMS)} ${rng.pick(suffixes)}`;
  }
}

/**
 * Generates the full city geometry: districts on a coarse grid, buildings on a
 * per-district slot grid, plus a road network drawn along the grid lines.
 */
/**
 * A generated district holds roughly 60 residents once the building mix is
 * applied, so the grid is sized from the target population. Without this the
 * map would always be built for 1,200 people and a smaller city would end up
 * with far more businesses and homes than it could ever fill.
 */
function gridFor(targetPopulation: number): { cols: number; rows: number } {
  const districts = clamp(Math.ceil(targetPopulation / 60), 4, 42);
  const cols = Math.max(2, Math.ceil(Math.sqrt(districts * 1.25)));
  const rows = Math.max(2, Math.ceil(districts / cols));
  return { cols, rows };
}

export function generateCity(rng: RNG, opts: CityGenOptions): WorldGeometry {
  const auto = gridFor(opts.targetPopulation);
  const cols = opts.gridCols ?? auto.cols;
  const rows = opts.gridRows ?? auto.rows;
  const cellW = 560;
  const cellH = 460;
  const margin = 40;
  const width = cols * cellW + margin * 2;
  const height = rows * cellH + margin * 2;

  const types = districtLayout(cols, rows, rng);
  const districts: District[] = [];
  const usedNames = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = types[r * cols + c];
      const [pMin, pMax] = PRESTIGE[type];
      districts.push({
        id: districts.length,
        name: districtName(type, rng, usedNames),
        type,
        x: margin + c * cellW + 18,
        y: margin + r * cellH + 18,
        w: cellW - 36,
        h: cellH - 36,
        prestige: rng.int(pMin, pMax),
        buildings: [],
      });
    }
  }

  const buildings: Building[] = [];
  let residentialCapacity = 0;

  for (const district of districts) {
    const mix = DISTRICT_MIX[district.type];
    const totalWeight = mix.reduce((a, m) => a + m.weight, 0);
    const slot = district.type === 'suburb' || district.type === 'green' ? 92 : 76;
    const colsIn = Math.floor(district.w / slot);
    const rowsIn = Math.floor(district.h / slot);
    const [qMin, qMax] = BASE_QUALITY[district.type] ?? [40, 80];

    for (let ry = 0; ry < rowsIn; ry++) {
      for (let rx = 0; rx < colsIn; rx++) {
        // Leave gaps so the district reads as a place with streets and voids.
        if (rng.chance(district.type === 'green' ? 0.55 : 0.18)) continue;

        let roll = rng.next() * totalWeight;
        let type: BuildingType = mix[0].type;
        for (const m of mix) {
          if (roll < m.weight) {
            type = m.type;
            break;
          }
          roll -= m.weight;
        }

        const [fw, fh] = FOOTPRINT[type] ?? [30, 26];
        const w = Math.min(fw, slot - 10);
        const h = Math.min(fh, slot - 10);
        const jitterX = rng.float(0, Math.max(0, slot - w - 8));
        const jitterY = rng.float(0, Math.max(0, slot - h - 8));
        const x = district.x + rx * slot + 4 + jitterX;
        const y = district.y + ry * slot + 4 + jitterY;

        const quality = clamp(rng.int(qMin, qMax), 5, 100);
        const capRange = RESIDENT_CAPACITY[type];
        const capacity = capRange ? rng.int(capRange[0], capRange[1]) : rng.int(8, 40);

        const b: Building = {
          id: buildings.length,
          name: '',
          type,
          districtId: district.id,
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(w),
          h: Math.round(h),
          quality,
          capacity,
          residents: [],
          rent: 0,
          price: 0,
          ownerId: -1,
          companyId: -1,
          occupants: 0,
          present: [],
          visitsToday: 0,
        };
        b.name = buildingName(type, rng, district);

        if (capRange) {
          const sizeFactor = capacity * (type === 'house' ? 1.35 : 1);
          const base = 130 + district.prestige * 5.2 + quality * 3.1;
          b.rent = Math.round((base + sizeFactor * 14) * (type === 'house' ? 1.25 : 1));
          b.price = Math.round(b.rent * rng.float(150, 230));
          residentialCapacity += capacity;
        }

        buildings.push(b);
        district.buildings.push(b.id);
      }
    }
  }

  // Civic buildings every city needs exactly once or twice, placed in fitting districts.
  const ensureCivic = (type: BuildingType, count: number, preferred: DistrictType[]) => {
    let existing = buildings.filter((b) => b.type === type).length;
    while (existing < count) {
      const pool = districts.filter((d) => preferred.includes(d.type));
      const district = pool.length ? rng.pick(pool) : rng.pick(districts);
      const victims = district.buildings.filter((id) => {
        const t = buildings[id].type;
        return t === 'shop' || t === 'house' || t === 'cafe' || t === 'park';
      });
      if (!victims.length) {
        existing++;
        continue;
      }
      const b = buildings[rng.pick(victims)];
      if (b.type === 'house') residentialCapacity -= b.capacity;
      b.type = type;
      const [fw, fh] = FOOTPRINT[type] ?? [40, 34];
      b.w = fw;
      b.h = fh;
      b.residents = [];
      b.rent = 0;
      b.price = 0;
      b.capacity = rng.int(20, 60);
      b.name = buildingName(type, rng, district);
      existing++;
    }
  };

  ensureCivic('hospital', 2, ['downtown', 'residential', 'commercial']);
  ensureCivic('police', 2, ['downtown', 'commercial', 'residential']);
  ensureCivic('fire', 1, ['industrial', 'commercial']);
  ensureCivic('station', 1, ['downtown', 'commercial']);
  ensureCivic('university', 1, ['campus', 'downtown']);
  ensureCivic('townhall', 1, ['downtown', 'oldtown']);
  ensureCivic('cemetery', 1, ['green', 'suburb']);
  ensureCivic('school', 4, ['residential', 'suburb', 'campus']);
  ensureCivic('supermarket', 8, ['residential', 'suburb', 'commercial']);
  ensureCivic('bank', 3, ['downtown', 'commercial']);
  ensureCivic('gym', 5, ['downtown', 'residential', 'commercial']);

  // Top up housing if the generated mix cannot hold the target population.
  const needed = Math.ceil(opts.targetPopulation * 1.28);
  if (residentialCapacity < needed) {
    const candidates = buildings.filter(
      (b) => b.type === 'shop' || b.type === 'cafe' || b.type === 'office',
    );
    rng.shuffle(candidates);
    for (const b of candidates) {
      if (residentialCapacity >= needed) break;
      const district = districts[b.districtId];
      b.type = 'apartment';
      const [fw, fh] = FOOTPRINT.apartment!;
      b.w = fw;
      b.h = fh;
      b.capacity = rng.int(10, 26);
      b.name = buildingName('apartment', rng, district);
      b.rent = Math.round(130 + district.prestige * 5.2 + b.quality * 3.1 + b.capacity * 14);
      b.price = Math.round(b.rent * rng.float(150, 230));
      residentialCapacity += b.capacity;
    }
  }

  // Road grid along district borders plus one internal artery per district.
  const roads: RoadSegment[] = [];
  for (let c = 0; c <= cols; c++) {
    const x = margin + c * cellW;
    roads.push({ x1: x, y1: margin - 20, x2: x, y2: height - margin + 20, major: true });
  }
  for (let r = 0; r <= rows; r++) {
    const y = margin + r * cellH;
    roads.push({ x1: margin - 20, y1: y, x2: width - margin + 20, y2: y, major: true });
  }
  for (const d of districts) {
    roads.push({ x1: d.x, y1: d.y + d.h / 2, x2: d.x + d.w, y2: d.y + d.h / 2, major: false });
    roads.push({ x1: d.x + d.w / 2, y1: d.y, x2: d.x + d.w / 2, y2: d.y + d.h, major: false });
  }

  return { width, height, districts, buildings, roads };
}
