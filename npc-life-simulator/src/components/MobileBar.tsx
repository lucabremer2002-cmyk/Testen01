import { useUI, type LeftTab } from '../state/store';

const TABS: { id: LeftTab; label: string; icon: string }[] = [
  { id: 'people', label: 'Leute', icon: '👥' },
  { id: 'stats', label: 'Stadt', icon: '📊' },
  { id: 'economy', label: 'Geld', icon: '💶' },
  { id: 'stories', label: 'Storys', icon: '📖' },
];

/**
 * Phone navigation. The map is always the base layer; the panels slide over it,
 * so a small screen never has to show three columns at once.
 */
export function MobileBar() {
  const leftOpen = useUI((s) => s.leftOpen);
  const rightOpen = useUI((s) => s.rightOpen);
  const leftTab = useUI((s) => s.leftTab);
  const selectedId = useUI((s) => s.selectedId);

  const showMap = !leftOpen && !rightOpen;

  return (
    <nav className="mobile-bar">
      <button
        type="button"
        className={`mobile-tab${showMap ? ' active' : ''}`}
        onClick={() => useUI.setState({ leftOpen: false, rightOpen: false })}
      >
        <span className="mi">🗺️</span>
        Karte
      </button>

      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`mobile-tab${leftOpen && leftTab === t.id ? ' active' : ''}`}
          onClick={() =>
            useUI.setState({ leftOpen: true, rightOpen: false, leftTab: t.id })
          }
        >
          <span className="mi">{t.icon}</span>
          {t.label}
        </button>
      ))}

      <button
        type="button"
        className={`mobile-tab${rightOpen ? ' active' : ''}`}
        disabled={selectedId < 0}
        onClick={() => useUI.setState({ rightOpen: true, leftOpen: false })}
      >
        <span className="mi">👤</span>
        Person
      </button>
    </nav>
  );
}
