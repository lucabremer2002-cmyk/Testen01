import type { SimulationEngine } from '../simulation/SimulationEngine';
import { TICKS_PER_SECOND } from '../time/SimulationClock';

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Never run more than this many engine ticks in one animation frame. */
const MAX_CATCHUP = 3;

/**
 * Drives the simulation from requestAnimationFrame with a fixed-step
 * accumulator, so simulated time advances at the same rate regardless of the
 * display refresh rate. Rendering is a separate callback on every frame.
 */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private accumulator = 0;
  private running = false;
  /** Measured frames per second, for the debug overlay. */
  fps = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  /** Replaced by the map view so rendering happens on the same frame. */
  onFrame: (dtMs: number) => void;

  constructor(
    private engine: SimulationEngine,
    onFrame: (dtMs: number) => void = () => {},
  ) {
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    const step = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(250, now - this.last);
      this.last = now;

      this.fpsAccum += dt;
      this.fpsFrames++;
      if (this.fpsAccum >= 500) {
        this.fps = (this.fpsFrames * 1000) / this.fpsAccum;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
      }

      if (!this.engine.clock.paused) {
        this.accumulator += dt;
        let ticks = 0;
        while (this.accumulator >= TICK_MS && ticks < MAX_CATCHUP) {
          this.engine.tick();
          this.accumulator -= TICK_MS;
          ticks++;
        }
        // Drop the backlog rather than spiralling when a tick is expensive.
        if (this.accumulator > TICK_MS * MAX_CATCHUP) this.accumulator = 0;
      } else {
        this.accumulator = 0;
      }

      this.onFrame(dt);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setEngine(engine: SimulationEngine): void {
    this.engine = engine;
    this.accumulator = 0;
  }
}
