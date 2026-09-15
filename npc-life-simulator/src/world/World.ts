import { RNG } from '../core/rng';
import { generateCity, type CityGenOptions } from './CityGenerator';
import { type Building, type BuildingType, type District, type RoadSegment, type WorldGeometry } from './types';
import { Weather } from './Weather';

const CELL = 128;

/**
 * The physical city: geometry plus the spatial/type indices the simulation
 * queries every tick. Kept free of NPC logic on purpose.
 */
export class World {
  readonly width: number;
  readonly height: number;
  readonly districts: District[];
  readonly buildings: Building[];
  readonly roads: RoadSegment[];
  readonly name: string;
  readonly weather: Weather;

  private byType = new Map<BuildingType, number[]>();
  private grid: number[][] = [];
  private gridCols = 0;
  private gridRows = 0;
  /**
   * Buildings never move, so "nearest X from here" is a constant. Answers are
   * memoised per (origin, type-set) pair, which turns the hottest query in the
   * decision loop into a single array read.
   */
  private nearestCache: Int32Array = new Int32Array(0);
  private typeSetIds = new Map<readonly BuildingType[], number>();
  private typeSetCount = 0;
  private static MAX_TYPE_SETS = 48;

  constructor(name: string, geo: WorldGeometry, weather: Weather) {
    this.name = name;
    this.width = geo.width;
    this.height = geo.height;
    this.districts = geo.districts;
    this.buildings = geo.buildings;
    this.roads = geo.roads;
    this.weather = weather;
    this.reindex();
  }

  static generate(rng: RNG, name: string, opts: CityGenOptions): World {
    const geo = generateCity(rng, opts);
    return new World(name, geo, new Weather());
  }

  reindex(): void {
    this.byType.clear();
    for (const b of this.buildings) {
      let list = this.byType.get(b.type);
      if (!list) {
        list = [];
        this.byType.set(b.type, list);
      }
      list.push(b.id);
    }
    this.gridCols = Math.ceil(this.width / CELL);
    this.gridRows = Math.ceil(this.height / CELL);
    this.grid = new Array(this.gridCols * this.gridRows);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
    for (const b of this.buildings) {
      const cx = Math.min(this.gridCols - 1, Math.floor(this.centerX(b) / CELL));
      const cy = Math.min(this.gridRows - 1, Math.floor(this.centerY(b) / CELL));
      this.grid[cy * this.gridCols + cx].push(b.id);
    }
    this.typeSetIds.clear();
    this.typeSetCount = 0;
    this.nearestCache = new Int32Array(0);
  }

  /**
   * Cache slot for a type set, or -1 when the set is not cacheable. Only the
   * shared constants in placeSets get a slot; a freshly built array on every
   * call would otherwise grow the cache without bound.
   */
  private typeSetId(types: readonly BuildingType[]): number {
    const known = this.typeSetIds.get(types);
    if (known !== undefined) return known;
    if (this.typeSetCount >= World.MAX_TYPE_SETS) return -1;
    const id = this.typeSetCount++;
    this.typeSetIds.set(types, id);
    // The layout is type-set-major, so existing entries survive the growth.
    const next = new Int32Array(this.buildings.length * this.typeSetCount).fill(-2);
    next.set(this.nearestCache);
    this.nearestCache = next;
    return id;
  }

  centerX(b: Building): number {
    return b.x + b.w / 2;
  }

  centerY(b: Building): number {
    return b.y + b.h / 2;
  }

  get(id: number): Building {
    return this.buildings[id];
  }

  ofType(type: BuildingType): number[] {
    return this.byType.get(type) ?? [];
  }

  district(id: number): District {
    return this.districts[id];
  }

  districtOf(buildingId: number): District {
    return this.districts[this.buildings[buildingId].districtId];
  }

  /** Straight-line distance between two buildings in world units. */
  distance(aId: number, bId: number): number {
    const a = this.buildings[aId];
    const b = this.buildings[bId];
    return Math.hypot(this.centerX(a) - this.centerX(b), this.centerY(a) - this.centerY(b));
  }

  /**
   * Nearest building of any of the given types, scanning outward through the
   * spatial grid so the common case touches only a handful of cells.
   */
  nearestOfTypes(
    fromId: number,
    types: readonly BuildingType[],
    filter?: (b: Building) => boolean,
  ): number {
    if (fromId < 0 || fromId >= this.buildings.length) return -1;
    let cacheIndex = -1;
    if (!filter) {
      const setId = this.typeSetId(types);
      if (setId >= 0) {
        cacheIndex = setId * this.buildings.length + fromId;
        const cached = this.nearestCache[cacheIndex];
        if (cached !== -2) return cached;
      }
    }
    const from = this.buildings[fromId];
    const fx = this.centerX(from);
    const fy = this.centerY(from);
    const cx = Math.min(this.gridCols - 1, Math.max(0, Math.floor(fx / CELL)));
    const cy = Math.min(this.gridRows - 1, Math.max(0, Math.floor(fy / CELL)));
    const maxRing = Math.max(this.gridCols, this.gridRows);
    let best = -1;
    let bestD = Infinity;

    for (let ring = 0; ring <= maxRing; ring++) {
      const x0 = cx - ring;
      const x1 = cx + ring;
      const y0 = cy - ring;
      const y1 = cy + ring;
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= this.gridRows) continue;
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= this.gridCols) continue;
          // Only the ring border, cells further in were handled already.
          if (ring > 0 && x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
          for (const id of this.grid[y * this.gridCols + x]) {
            const b = this.buildings[id];
            if (!types.includes(b.type)) continue;
            if (filter && !filter(b)) continue;
            const d = Math.hypot(this.centerX(b) - fx, this.centerY(b) - fy);
            if (d < bestD) {
              bestD = d;
              best = id;
            }
          }
        }
      }
      // One extra ring guards against a closer building just outside the ring.
      if (best >= 0 && bestD < ring * CELL) break;
    }
    if (cacheIndex >= 0) this.nearestCache[cacheIndex] = best;
    return best;
  }

  /** All buildings whose centre lies within `radius` of the given building. */
  withinRadius(fromId: number, radius: number, out: number[] = []): number[] {
    out.length = 0;
    const from = this.buildings[fromId];
    const fx = this.centerX(from);
    const fy = this.centerY(from);
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(fx / CELL);
    const cy = Math.floor(fy / CELL);
    for (let y = cy - r; y <= cy + r; y++) {
      if (y < 0 || y >= this.gridRows) continue;
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || x >= this.gridCols) continue;
        for (const id of this.grid[y * this.gridCols + x]) {
          const b = this.buildings[id];
          if (Math.hypot(this.centerX(b) - fx, this.centerY(b) - fy) <= radius) out.push(id);
        }
      }
    }
    return out;
  }

  serialize() {
    return {
      name: this.name,
      width: this.width,
      height: this.height,
      districts: this.districts,
      buildings: this.buildings,
      roads: this.roads,
      weather: this.weather.serialize(),
    };
  }

  static restore(data: ReturnType<World['serialize']>): World {
    const weather = new Weather();
    weather.restore(data.weather);
    return new World(
      data.name,
      {
        width: data.width,
        height: data.height,
        districts: data.districts,
        buildings: data.buildings,
        roads: data.roads,
      },
      weather,
    );
  }
}
