import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationEngine } from './simulation/SimulationEngine';
import { EngineProvider, useEngineContext } from './state/EngineContext';
import { useUI } from './state/store';
import { SPEEDS, type Speed } from './time/SimulationClock';
import { StartScreen, type NewGameOptions } from './components/StartScreen';
import { TopBar } from './components/TopBar';
import { MapView } from './components/MapView';
import { LeftSidebar } from './components/LeftSidebar';
import { NpcPanel } from './components/NpcPanel';
import { NewsFeed } from './components/NewsFeed';
import { DebugOverlay } from './components/DebugOverlay';
import { Toasts } from './components/Toasts';
import { HelpOverlay } from './components/HelpOverlay';
import { MobileBar } from './components/MobileBar';
import { PHONE_QUERY, useMediaQuery } from './core/useMediaQuery';
import { deserializeEngine, serializeEngine, type SaveData } from './storage/serialize';
import { QUICK_SLOT, saveGame } from './storage/SaveGame';

export function App() {
  const [engine, setEngine] = useState<SimulationEngine | null>(null);
  const [error, setError] = useState<string | undefined>();
  const screen = useUI((s) => s.screen);
  const setScreen = useUI((s) => s.setScreen);

  const startNew = useCallback(
    (o: NewGameOptions) => {
      setError(undefined);
      setScreen('loading', 'Die Stadt entsteht …');
      // Generation is synchronous and heavy; defer it so the loader paints.
      setTimeout(() => {
        try {
          const next = SimulationEngine.create({
            seed: o.seed,
            population: o.population,
            cityName: o.cityName,
          });
          setEngine(next);
          useUI.setState({ selectedId: -1, trackedIds: [], speed: 1 });
          setScreen('game');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setScreen('menu');
        }
      }, 40);
    },
    [setScreen],
  );

  const loadFrom = useCallback(
    (data: SaveData) => {
      setError(undefined);
      setScreen('loading', 'Spielstand wird geladen …');
      setTimeout(() => {
        try {
          const next = deserializeEngine(data);
          setEngine(next);
          useUI.setState({ selectedId: -1, trackedIds: [], speed: next.clock.speed as Speed });
          setScreen('game');
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setScreen('menu');
        }
      }, 40);
    },
    [setScreen],
  );

  if (screen === 'loading') {
    const message = useUI.getState().loadingMessage;
    return (
      <div className="loading">
        <div>
          <div className="spinner" />
          {message}
        </div>
      </div>
    );
  }

  if (screen === 'menu' || !engine) {
    return <StartScreen onStart={startNew} onLoad={loadFrom} error={error} />;
  }

  return (
    <EngineProvider engine={engine}>
      <Game onBackToMenu={() => setScreen('menu')} />
    </EngineProvider>
  );
}

function Game({ onBackToMenu }: { onBackToMenu: () => void }) {
  const { engine } = useEngineContext();
  const ui = useUI();
  const toast = useUI((s) => s.toast);
  const lastSpeed = useRef<Speed>(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const phone = useMediaQuery(PHONE_QUERY);

  // On a phone the panels are overlays, so both start closed and the map shows.
  useEffect(() => {
    if (phone) useUI.setState({ leftOpen: false, rightOpen: false });
    else useUI.setState({ leftOpen: true, rightOpen: true });
  }, [phone]);

  const save = useCallback(async () => {
    try {
      await saveGame(QUICK_SLOT, 'Schnellspeicherung', serializeEngine(engine));
      toast('Welt gespeichert.', 'success');
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${err instanceof Error ? err.message : err}`, 'warn');
    }
  }, [engine, toast]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      const set = (s: Speed) => {
        engine.setSpeed(s);
        useUI.getState().setSpeed(s);
      };
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (engine.clock.speed === 0) set(lastSpeed.current || 1);
          else {
            lastSpeed.current = engine.clock.speed;
            set(0);
          }
          break;
        case '1': case '2': case '3': case '4': case '5': case '6': case '7': {
          const idx = Number(e.key);
          set(SPEEDS[idx] as Speed);
          break;
        }
        case 'd': case 'D':
          useUI.getState().toggle('showDebug');
          break;
        case 's': case 'S':
          if (!e.ctrlKey && !e.metaKey) void save();
          break;
        case 'f': case 'F':
          useUI.getState().toggle('followSelected');
          break;
        case 'Escape':
          useUI.setState({ selectedId: -1, godPanelOpen: false });
          break;
        case 'h': case 'H': case '?':
          setHelpOpen(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, save]);

  const cls = [
    'workspace',
    ui.leftOpen ? '' : 'no-left',
    ui.rightOpen ? '' : 'no-right',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <TopBar onSave={save} onMenu={onBackToMenu} onHelp={() => setHelpOpen(true)} />
      <div className={cls}>
        {ui.leftOpen && <LeftSidebar />}
        <div className="stage">
          <MapView />
          <NewsFeed />
          {ui.showDebug && <DebugOverlay />}
          <Toasts />
          <HelpOverlay force={helpOpen} onClose={() => setHelpOpen(false)} />
        </div>
        {ui.rightOpen && <NpcPanel />}
        {phone && <MobileBar />}
      </div>
    </div>
  );
}
