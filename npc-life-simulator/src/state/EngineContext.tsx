import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SimulationEngine } from '../simulation/SimulationEngine';
import { GameLoop } from '../game/GameLoop';

interface EngineContextValue {
  engine: SimulationEngine;
  loop: GameLoop;
  /** Replaces the running world (new game / load). */
  swap: (engine: SimulationEngine) => void;
}

const Ctx = createContext<EngineContextValue | null>(null);

export function EngineProvider({
  engine: initial,
  children,
}: {
  engine: SimulationEngine;
  children: ReactNode;
}) {
  const [engine, setEngine] = useState(initial);
  const loopRef = useRef<GameLoop | null>(null);
  if (!loopRef.current) loopRef.current = new GameLoop(engine, () => {});

  useEffect(() => {
    const loop = loopRef.current!;
    loop.setEngine(engine);
    // Debug handle for the browser console and the end-to-end test.
    if (import.meta.env.DEV) {
      (window as unknown as { __engine?: SimulationEngine }).__engine = engine;
    }
    loop.start();
    return () => loop.stop();
  }, [engine]);

  const value: EngineContextValue = {
    engine,
    loop: loopRef.current,
    swap: (next) => setEngine(next),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngine(): SimulationEngine {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEngine muss innerhalb des EngineProvider verwendet werden.');
  return ctx.engine;
}

export function useEngineContext(): EngineContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEngineContext muss innerhalb des EngineProvider verwendet werden.');
  return ctx;
}

/**
 * One shared ticker drives every panel. A single timer matters for more than
 * efficiency: with separate timers the clock and the resident list render at
 * different instants, and at 100x speed several simulated hours pass between
 * them - the clock would read midday while the list still showed the night.
 */
const PULSE_HZ = 8;
const pulseSubscribers = new Set<() => void>();
let pulseCounter = 0;
let pulseTimer = 0;

function subscribePulse(fn: () => void): () => void {
  pulseSubscribers.add(fn);
  if (!pulseTimer) {
    pulseTimer = window.setInterval(() => {
      pulseCounter++;
      for (const sub of pulseSubscribers) sub();
    }, 1000 / PULSE_HZ);
  }
  return () => {
    pulseSubscribers.delete(fn);
    if (pulseSubscribers.size === 0) {
      window.clearInterval(pulseTimer);
      pulseTimer = 0;
    }
  };
}

/**
 * Re-renders the calling component on the shared pulse. `hz` thins it out to
 * every n-th tick; because every subscriber counts the same ticks, components
 * that share a rate always render from the same instant of simulated time.
 */
export function useSimPulse(hz = PULSE_HZ): number {
  const [, force] = useState(0);
  const every = Math.max(1, Math.round(PULSE_HZ / Math.min(hz, PULSE_HZ)));
  useEffect(
    () =>
      subscribePulse(() => {
        if (pulseCounter % every === 0) force(pulseCounter);
      }),
    [every],
  );
  return pulseCounter;
}
