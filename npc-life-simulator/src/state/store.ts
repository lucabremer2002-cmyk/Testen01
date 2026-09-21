import { create } from 'zustand';
import { DEFAULT_SPEED, type Speed } from '../time/SimulationClock';
import { PHONE_QUERY } from '../core/useMediaQuery';

/** On a phone the panels are overlays, so only one may be open at a time. */
const isPhone = (): boolean => {
  try {
    return window.matchMedia(PHONE_QUERY).matches;
  } catch {
    return false;
  }
};

export type LeftTab = 'people' | 'tracked' | 'stats' | 'economy' | 'stories';
export type DetailTab = 'overview' | 'needs' | 'social' | 'life' | 'career' | 'goals';
export type MapOverlay = 'none' | 'districts' | 'wealth' | 'mood' | 'age' | 'busy';
export type Screen = 'menu' | 'loading' | 'game';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn' | 'divine';
}

export interface PeopleFilter {
  query: string;
  onlyEmployed: boolean;
  onlyUnemployed: boolean;
  onlySingle: boolean;
  minAge: number;
  maxAge: number;
  sort: 'name' | 'age' | 'wealth' | 'mood' | 'friends';
}

interface UIState {
  screen: Screen;
  loadingMessage: string;
  selectedId: number;
  hoverId: number;
  trackedIds: number[];
  leftTab: LeftTab;
  detailTab: DetailTab;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  showDebug: boolean;
  newsImportantOnly: boolean;
  showNames: boolean;
  showRoutes: boolean;
  overlay: MapOverlay;
  speed: Speed;
  filter: PeopleFilter;
  toasts: Toast[];
  followSelected: boolean;
  godPanelOpen: boolean;

  setScreen: (s: Screen, message?: string) => void;
  select: (id: number) => void;
  setHover: (id: number) => void;
  toggleTrack: (id: number) => void;
  clearTracked: () => void;
  setLeftTab: (t: LeftTab) => void;
  setDetailTab: (t: DetailTab) => void;
  setSpeed: (s: Speed) => void;
  setOverlay: (o: MapOverlay) => void;
  patchFilter: (p: Partial<PeopleFilter>) => void;
  toggle: (
    key:
      | 'leftOpen'
      | 'rightOpen'
      | 'bottomOpen'
      | 'showDebug'
      | 'showNames'
      | 'showRoutes'
      | 'followSelected'
      | 'godPanelOpen'
      | 'newsImportantOnly',
  ) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 1;

export const useUI = create<UIState>((set, get) => ({
  screen: 'menu',
  loadingMessage: '',
  selectedId: -1,
  hoverId: -1,
  trackedIds: [],
  leftTab: 'people',
  detailTab: 'overview',
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  showDebug: false,
  newsImportantOnly: false,
  showNames: false,
  showRoutes: true,
  overlay: 'districts',
  speed: DEFAULT_SPEED,
  followSelected: false,
  godPanelOpen: false,
  filter: {
    query: '',
    onlyEmployed: false,
    onlyUnemployed: false,
    onlySingle: false,
    minAge: 0,
    maxAge: 120,
    sort: 'name',
  },
  toasts: [],

  setScreen: (screen, loadingMessage = '') => set({ screen, loadingMessage }),
  select: (selectedId) =>
    set(isPhone() ? { selectedId, rightOpen: true, leftOpen: false } : { selectedId, rightOpen: true }),
  setHover: (hoverId) => set({ hoverId }),
  toggleTrack: (id) =>
    set((s) => ({
      trackedIds: s.trackedIds.includes(id)
        ? s.trackedIds.filter((x) => x !== id)
        : [...s.trackedIds, id].slice(-12),
    })),
  clearTracked: () => set({ trackedIds: [] }),
  setLeftTab: (leftTab) =>
    set(isPhone() ? { leftTab, leftOpen: true, rightOpen: false } : { leftTab, leftOpen: true }),
  setDetailTab: (detailTab) => set({ detailTab }),
  setSpeed: (speed) => set({ speed }),
  setOverlay: (overlay) => set({ overlay }),
  patchFilter: (p) => set((s) => ({ filter: { ...s.filter, ...p } })),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as never),
  toast: (text, kind = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
