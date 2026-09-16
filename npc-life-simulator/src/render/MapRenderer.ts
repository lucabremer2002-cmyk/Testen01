import type { SimulationEngine } from '../simulation/SimulationEngine';
import { clamp } from '../core/math';
import { DISTRICT_LABEL, RESIDENTIAL_TYPES } from '../world/types';
import type { MapOverlay } from '../state/store';
import {
  ACTION_COLORS,
  BUILDING_COLORS,
  COLORS,
  DISTRICT_COLORS,
  RAMP_AGE,
  RAMP_MOOD,
  RAMP_WEALTH,
  ramp,
} from './palette';
import { mood } from '../npc/Emotions';

export interface RenderOptions {
  selectedId: number;
  hoverId: number;
  trackedIds: number[];
  overlay: MapOverlay;
  showNames: boolean;
  showRoutes: boolean;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 4.5;

/**
 * Canvas renderer for the city. Reads engine state directly and never touches
 * React, so the map can run at display refresh rate while the panels update on
 * a slow timer.
 */
export class MapRenderer {
  camera: Camera = { x: 0, y: 0, zoom: 0.5 };
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  width = 0;
  height = 0;
  /** Grouped NPC positions per colour, reused between frames. */
  private buckets = new Map<string, number[]>();
  /** Last frame's NPC screen positions, for hit testing. */
  private hitIds: number[] = [];
  private hitX: number[] = [];
  private hitY: number[] = [];
  /** Set once the player pans or zooms, so resizes stop re-framing the city. */
  userAdjusted = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private engine: SimulationEngine,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas-2D-Kontext nicht verfügbar.');
    this.ctx = ctx;
    this.resize();
    this.fitToWorld();
  }

  setEngine(engine: SimulationEngine): void {
    this.engine = engine;
    this.fitToWorld();
  }

  resize(): void {
    const previousWidth = this.width;
    const previousHeight = this.height;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // The canvas often mounts before the layout has settled. Until the player
    // takes control, keep the whole city framed whenever the size changes.
    if (!this.userAdjusted && (previousWidth !== this.width || previousHeight !== this.height)) {
      this.fitToWorld();
    }
  }

  fitToWorld(): void {
    this.userAdjusted = false;
    const w = this.engine.world;
    this.camera.x = w.width / 2;
    this.camera.y = w.height / 2;
    const byWidth = this.width / w.width;
    const byHeight = this.height / w.height;
    // On a portrait screen, fitting both axes wastes most of the display.
    const portrait = this.height > this.width * 1.15;
    this.camera.zoom = clamp((portrait ? byHeight : Math.min(byWidth, byHeight)) * 0.95, MIN_ZOOM, MAX_ZOOM);
  }

  centerOn(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    this.userAdjusted = true;
    const before = this.screenToWorld(screenX, screenY);
    this.camera.zoom = clamp(this.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const after = this.screenToWorld(screenX, screenY);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
  }

  pan(dxScreen: number, dyScreen: number): void {
    this.userAdjusted = true;
    this.camera.x -= dxScreen / this.camera.zoom;
    this.camera.y -= dyScreen / this.camera.zoom;
    const w = this.engine.world;
    const margin = 400;
    this.camera.x = clamp(this.camera.x, -margin, w.width + margin);
    this.camera.y = clamp(this.camera.y, -margin, w.height + margin);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.width / 2) / this.camera.zoom + this.camera.x,
      y: (y - this.height / 2) / this.camera.zoom + this.camera.y,
    };
  }

  /** Nearest NPC to a screen point, or -1. */
  pickNpc(sx: number, sy: number, radius = 14): number {
    let best = -1;
    let bestD = radius * radius;
    for (let i = 0; i < this.hitIds.length; i++) {
      const dx = this.hitX[i] - sx;
      const dy = this.hitY[i] - sy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = this.hitIds[i];
      }
    }
    return best;
  }

  pickBuilding(sx: number, sy: number): number {
    const p = this.screenToWorld(sx, sy);
    const w = this.engine.world;
    for (let i = w.buildings.length - 1; i >= 0; i--) {
      const b = w.buildings[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b.id;
    }
    return -1;
  }

  render(opts: RenderOptions): void {
    const ctx = this.ctx;
    const e = this.engine;
    const w = e.world;
    const z = this.camera.zoom;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    const view = {
      x0: this.camera.x - this.width / 2 / z,
      y0: this.camera.y - this.height / 2 / z,
      x1: this.camera.x + this.width / 2 / z,
      y1: this.camera.y + this.height / 2 / z,
    };

    // --- districts -------------------------------------------------------
    for (const d of w.districts) {
      if (d.x > view.x1 || d.x + d.w < view.x0 || d.y > view.y1 || d.y + d.h < view.y0) continue;
      const s = this.worldToScreen(d.x, d.y);
      ctx.fillStyle = this.districtColor(d.id, opts.overlay);
      ctx.fillRect(s.x, s.y, d.w * z, d.h * z);
      ctx.strokeStyle = COLORS.borderSoft;
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, d.w * z, d.h * z);
    }

    // --- roads -----------------------------------------------------------
    ctx.lineCap = 'round';
    for (const r of w.roads) {
      const a = this.worldToScreen(r.x1, r.y1);
      const b = this.worldToScreen(r.x2, r.y2);
      if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > this.width) continue;
      if (Math.max(a.y, b.y) < 0 || Math.min(a.y, b.y) > this.height) continue;
      ctx.strokeStyle = r.major ? COLORS.roadMajor : COLORS.road;
      ctx.lineWidth = Math.max(1, (r.major ? 9 : 5) * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // --- buildings -------------------------------------------------------
    const showDetail = z > 0.42;
    for (const b of w.buildings) {
      if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
      const s = this.worldToScreen(b.x, b.y);
      const bw = Math.max(1.5, b.w * z);
      const bh = Math.max(1.5, b.h * z);
      ctx.fillStyle = this.buildingColor(b.id, opts.overlay);
      ctx.fillRect(s.x, s.y, bw, bh);
      if (showDetail && b.occupants > 0) {
        // A lit window hints that someone is inside.
        ctx.fillStyle = 'rgba(255, 228, 160, 0.4)';
        const lit = Math.min(4, Math.ceil(b.occupants / 4));
        for (let i = 0; i < lit; i++) {
          ctx.fillRect(s.x + 2 + i * 4 * z, s.y + bh - 4 * z, Math.max(1, 2 * z), Math.max(1, 2 * z));
        }
      }
    }

    // --- travel lines for watched people ---------------------------------
    if (opts.showRoutes) {
      const watched = new Set(opts.trackedIds);
      if (opts.selectedId >= 0) watched.add(opts.selectedId);
      ctx.lineWidth = 1.5;
      for (const id of watched) {
        const npc = e.npcs[id];
        if (!npc?.alive || !npc.travel) continue;
        const from = w.buildings[npc.travel.fromId];
        const to = w.buildings[npc.travel.toId];
        if (!from || !to) continue;
        const a = this.worldToScreen(w.centerX(from), w.centerY(from));
        const b2 = this.worldToScreen(w.centerX(to), w.centerY(to));
        ctx.strokeStyle = 'rgba(77, 163, 255, 0.35)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b2.x, b2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // --- people ----------------------------------------------------------
    for (const list of this.buckets.values()) list.length = 0;
    this.hitIds.length = 0;
    this.hitX.length = 0;
    this.hitY.length = 0;

    // People must stay clearly visible even when the city is fully zoomed out.
    const dotSize = clamp(3.1 * z + 2.3, 2.6, 9);
    for (const id of e.aliveIds) {
      const npc = e.npcs[id];
      const p = e.positionOf(npc);
      if (p.x < view.x0 - 20 || p.x > view.x1 + 20 || p.y < view.y0 - 20 || p.y > view.y1 + 20) continue;
      const s = this.worldToScreen(p.x, p.y);
      const color = this.npcColor(id, opts.overlay);
      let bucket = this.buckets.get(color);
      if (!bucket) {
        bucket = [];
        this.buckets.set(color, bucket);
      }
      bucket.push(s.x, s.y);
      this.hitIds.push(id);
      this.hitX.push(s.x);
      this.hitY.push(s.y);
    }

    // Grouping by colour keeps the number of state changes tiny.
    // A dark halo behind every dot keeps people legible on any background.
    ctx.fillStyle = 'rgba(6, 9, 14, 0.5)';
    const halo = dotSize + 1.2;
    for (const list of this.buckets.values()) {
      for (let i = 0; i < list.length; i += 2) {
        ctx.fillRect(list[i] - halo / 2, list[i + 1] - halo / 2, halo, halo);
      }
    }

    // --- highlights ------------------------------------------------------
    for (const id of opts.trackedIds) {
      const npc = e.npcs[id];
      if (!npc?.alive) continue;
      const p = e.positionOf(npc);
      const s = this.worldToScreen(p.x, p.y);
      this.ring(s.x, s.y, dotSize + 5, COLORS.warn, 1.6);
    }
    if (opts.hoverId >= 0 && e.npcs[opts.hoverId]?.alive) {
      const p = e.positionOf(e.npcs[opts.hoverId]);
      const s = this.worldToScreen(p.x, p.y);
      this.ring(s.x, s.y, dotSize + 4, '#ffffff', 1.2);
    }
    if (opts.selectedId >= 0 && e.npcs[opts.selectedId]?.alive) {
      const npc = e.npcs[opts.selectedId];
      const p = e.positionOf(npc);
      const s = this.worldToScreen(p.x, p.y);
      this.ring(s.x, s.y, dotSize + 8, COLORS.accent, 2.2);
      this.ring(s.x, s.y, dotSize + 13, 'rgba(77,163,255,0.35)', 1.2);
      ctx.fillStyle = COLORS.text;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${npc.firstName} ${npc.lastName}`, s.x, s.y - dotSize - 16);
    }

    // --- labels ----------------------------------------------------------
    if (z < 0.55 || opts.showNames) {
      ctx.font = `600 ${clamp(13 * Math.sqrt(z / 0.5), 10, 16)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (const d of w.districts) {
        const s = this.worldToScreen(d.x + d.w / 2, d.y + d.h / 2);
        if (s.x < -100 || s.x > this.width + 100) continue;
        ctx.fillStyle = 'rgba(219,227,240,0.5)';
        ctx.fillText(d.name, s.x, s.y);
        ctx.fillStyle = 'rgba(139,151,172,0.42)';
        ctx.font = '500 10px system-ui, sans-serif';
        ctx.fillText(DISTRICT_LABEL[d.type], s.x, s.y + 14);
        ctx.font = `600 ${clamp(13 * Math.sqrt(z / 0.5), 10, 16)}px system-ui, sans-serif`;
      }
    }
    ctx.textAlign = 'left';
  }

  private ring(x: number, y: number, r: number, color: string, width: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private districtColor(id: number, overlay: MapOverlay): string {
    const d = this.engine.world.districts[id];
    if (overlay === 'districts' || overlay === 'none') return DISTRICT_COLORS[d.type];
    return '#141a25';
  }

  private buildingColor(id: number, overlay: MapOverlay): string {
    const b = this.engine.world.buildings[id];
    switch (overlay) {
      case 'wealth': {
        if (!RESIDENTIAL_TYPES.includes(b.type)) return '#232b39';
        return ramp(clamp(b.rent / 2200, 0, 1), RAMP_WEALTH[0], RAMP_WEALTH[1]);
      }
      case 'busy':
        return ramp(clamp(b.occupants / 18, 0, 1), [40, 48, 62], [240, 190, 90]);
      case 'none':
        return '#243040';
      default:
        return BUILDING_COLORS[b.type];
    }
  }

  private npcColor(id: number, overlay: MapOverlay): string {
    const npc = this.engine.npcs[id];
    switch (overlay) {
      case 'mood':
        return ramp(clamp((mood(npc) + 20) / 90, 0, 1), RAMP_MOOD[0], RAMP_MOOD[1]);
      case 'age':
        return ramp(clamp(npc.ageYears / 90, 0, 1), RAMP_AGE[0], RAMP_AGE[1]);
      case 'wealth':
        return ramp(clamp(this.engine.netWorth(npc) / 200000, 0, 1), RAMP_WEALTH[0], RAMP_WEALTH[1]);
      default:
        return npc.travel ? '#c9d4e6' : ACTION_COLORS[npc.action.type];
    }
  }
}
