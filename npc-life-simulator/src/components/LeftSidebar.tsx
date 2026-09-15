import { useMemo } from 'react';
import { useEngine, useSimPulse } from '../state/EngineContext';
import { useUI, type LeftTab } from '../state/store';
import { formatMoney, formatMoneyShort } from '../core/math';
import { formatDate } from '../time/calendar';
import { mood } from '../npc/Emotions';
import { activityShort, fullName, initials, jobTitle, tintOf } from '../npc/describe';
import { storyPeriod } from '../events/Narrator';
import { PRICE_LABEL, PRICE_CATEGORIES } from '../economy/types';
import { INCOME_LABEL, SPEND_LABEL } from '../economy/Ledger';
import { Avatar, Empty, KV, Section, Sparkline, StatCard } from './ui';
import type { NPC } from '../npc/types';

const TABS: { id: LeftTab; label: string }[] = [
  { id: 'people', label: 'Einwohner' },
  { id: 'tracked', label: 'Verfolgt' },
  { id: 'stats', label: 'Statistik' },
  { id: 'economy', label: 'Wirtschaft' },
  { id: 'stories', label: 'Geschichten' },
];

export function LeftSidebar() {
  const tab = useUI((s) => s.leftTab);
  const setTab = useUI((s) => s.setLeftTab);
  const tracked = useUI((s) => s.trackedIds);

  return (
    <aside className="sidebar">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'tracked' && tracked.length > 0 ? ` (${tracked.length})` : ''}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'people' && <PeopleList />}
        {tab === 'tracked' && <TrackedList />}
        {tab === 'stats' && <StatsPanel />}
        {tab === 'economy' && <EconomyPanel />}
        {tab === 'stories' && <StoriesPanel />}
      </div>
    </aside>
  );
}

function PersonRow({ npc, right }: { npc: NPC; right?: string }) {
  const engine = useEngine();
  const selectedId = useUI((s) => s.selectedId);
  const select = useUI((s) => s.select);
  const toggleTrack = useUI((s) => s.toggleTrack);
  const tracked = useUI((s) => s.trackedIds.includes(npc.id));

  return (
    <button
      type="button"
      className={`person-row${selectedId === npc.id ? ' selected' : ''}`}
      onClick={() => select(npc.id)}
      onDoubleClick={() => toggleTrack(npc.id)}
    >
      <Avatar text={initials(npc)} color={tintOf(npc)} />
      <span style={{ minWidth: 0 }}>
        <div className="name">
          {tracked && <span className="star">★ </span>}
          {fullName(npc)}
        </div>
        <div className="sub">
          {npc.ageYears} J · {activityShort(npc)}
        </div>
      </span>
      <span className="right">{right ?? jobTitleShort(engine, npc)}</span>
    </button>
  );
}

function jobTitleShort(engine: ReturnType<typeof useEngine>, npc: NPC): string {
  const prof = engine.professionOf(npc);
  if (npc.retired) return 'Rente';
  if (npc.ageYears < 18) return npc.ageYears < 6 ? 'Kind' : 'Schule';
  return prof ? prof.label.replace(/\/in$|\/-frau$|\/Ärztin$/, '') : 'ohne Job';
}

function PeopleList() {
  const engine = useEngine();
  useSimPulse(8);
  const filter = useUI((s) => s.filter);
  const patch = useUI((s) => s.patchFilter);

  const list = useMemo(() => {
    const q = filter.query.trim().toLowerCase();
    const out: NPC[] = [];
    for (const id of engine.aliveIds) {
      const npc = engine.npcs[id];
      if (npc.ageYears < filter.minAge || npc.ageYears > filter.maxAge) continue;
      if (filter.onlyEmployed && npc.jobId < 0) continue;
      if (filter.onlyUnemployed && (npc.jobId >= 0 || npc.ageYears < 18 || npc.retired)) continue;
      if (filter.onlySingle && npc.family.partner >= 0) continue;
      if (q && !fullName(npc).toLowerCase().includes(q)) continue;
      out.push(npc);
    }
    const cmp: Record<string, (a: NPC, b: NPC) => number> = {
      name: (a, b) => fullName(a).localeCompare(fullName(b)),
      age: (a, b) => b.ageYears - a.ageYears,
      wealth: (a, b) => engine.netWorth(b) - engine.netWorth(a),
      mood: (a, b) => mood(b) - mood(a),
      friends: (a, b) => b.links.length - a.links.length,
    };
    out.sort(cmp[filter.sort]);
    return out.slice(0, 300);
  }, [engine, filter]);

  return (
    <>
      <div className="filters">
        <input
          placeholder="Name filtern …"
          value={filter.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
        <div className="filter-row">
          <button
            type="button"
            className={`chip${filter.onlyEmployed ? ' active' : ''}`}
            onClick={() => patch({ onlyEmployed: !filter.onlyEmployed, onlyUnemployed: false })}
          >
            berufstätig
          </button>
          <button
            type="button"
            className={`chip${filter.onlyUnemployed ? ' active' : ''}`}
            onClick={() => patch({ onlyUnemployed: !filter.onlyUnemployed, onlyEmployed: false })}
          >
            arbeitslos
          </button>
          <button
            type="button"
            className={`chip${filter.onlySingle ? ' active' : ''}`}
            onClick={() => patch({ onlySingle: !filter.onlySingle })}
          >
            solo
          </button>
        </div>
        <div className="filter-row">
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Sortierung</span>
          <select
            value={filter.sort}
            onChange={(e) => patch({ sort: e.target.value as typeof filter.sort })}
          >
            <option value="name">Name</option>
            <option value="age">Alter</option>
            <option value="wealth">Vermögen</option>
            <option value="mood">Stimmung</option>
            <option value="friends">Kontakte</option>
          </select>
        </div>
      </div>
      {list.length === 0 ? (
        <Empty>Niemand passt zu diesem Filter.</Empty>
      ) : (
        list.map((npc) => <PersonRow key={npc.id} npc={npc} />)
      )}
      {list.length === 300 && (
        <div className="empty">Nur die ersten 300 Treffer werden angezeigt.</div>
      )}
    </>
  );
}

function TrackedList() {
  const engine = useEngine();
  useSimPulse(8);
  const tracked = useUI((s) => s.trackedIds);
  const clear = useUI((s) => s.clearTracked);

  if (!tracked.length) {
    return (
      <Empty>
        Noch niemand markiert.
        <br />
        Doppelklicke jemanden auf der Karte oder in der Liste, um ihn zu verfolgen.
      </Empty>
    );
  }
  return (
    <>
      <div className="filters">
        <button type="button" className="btn wide" onClick={clear}>
          Alle Markierungen entfernen
        </button>
      </div>
      {tracked.map((id) => {
        const npc = engine.npcs[id];
        if (!npc) return null;
        return <PersonRow key={id} npc={npc} right={npc.alive ? activityShort(npc) : 'verstorben'} />;
      })}
    </>
  );
}

function StatsPanel() {
  const engine = useEngine();
  useSimPulse(1);
  const s = engine.stats;
  const select = useUI((st) => st.select);
  const history = s.history;

  const tops: { title: string; entries: typeof s.topRich; format: (v: number) => string }[] = [
    { title: 'Reichste Einwohner', entries: s.topRich, format: (v) => formatMoneyShort(v) },
    { title: 'Älteste Einwohner', entries: s.topOld, format: (v) => `${Math.round(v)} J` },
    { title: 'Meiste Kontakte', entries: s.topSocial, format: (v) => `${Math.round(v)}` },
    { title: 'Höchste Gehälter', entries: s.topSalary, format: (v) => `${formatMoneyShort(v)}/M` },
    { title: 'Beliebteste', entries: s.topPopular, format: (v) => `${Math.round(v)}/100` },
  ];

  return (
    <>
      <Section title="Bevölkerung">
        <div className="stat-grid">
          <StatCard label="Einwohner" value={s.population.toLocaleString('de-DE')} />
          <StatCard label="Ø Alter" value={s.averageAge.toFixed(1)} delta="Jahre" />
          <StatCard label="Kinder" value={s.children} delta={`${pct(s.children, s.population)} %`} />
          <StatCard label="Senioren" value={s.seniors} delta={`${pct(s.seniors, s.population)} %`} />
          <StatCard label="Geburten" value={s.birthsThisYear} delta="letzte 12 Monate" />
          <StatCard label="Todesfälle" value={s.deathsThisYear} delta="letzte 12 Monate" />
        </div>
        {history.length > 2 && (
          <>
            <h4 className="panel-title" style={{ marginTop: 12 }}>Bevölkerungsverlauf</h4>
            <Sparkline points={history.map((h) => h.population)} />
          </>
        )}
      </Section>

      <Section title="Arbeit & Wohlstand">
        <div className="stat-grid">
          <StatCard label="Arbeitslosigkeit" value={`${(s.unemploymentRate * 100).toFixed(1)} %`} />
          <StatCard label="Ø Bruttolohn" value={formatMoneyShort(s.averageIncome)} delta="pro Monat" />
          <StatCard label="Median-Vermögen" value={formatMoneyShort(s.medianWealth)} />
          <StatCard label="Obdachlos" value={s.homeless} />
        </div>
        {history.length > 2 && (
          <>
            <h4 className="panel-title" style={{ marginTop: 12 }}>Arbeitslosenquote</h4>
            <Sparkline points={history.map((h) => h.unemployment * 100)} color="var(--warn)" />
          </>
        )}
      </Section>

      <Section title="Soziales">
        <div className="stat-grid">
          <StatCard label="Paare" value={s.couples} />
          <StatCard label="Ehen" value={s.married} />
          <StatCard label="Beziehungen" value={s.relationships.toLocaleString('de-DE')} />
          <StatCard label="Ø Kontakte" value={s.avgFriends.toFixed(1)} />
        </div>
        <h4 className="panel-title" style={{ marginTop: 12 }}>Stimmung der Stadt</h4>
        <Sparkline points={history.map((h) => h.avgHappiness)} color="var(--good)" />
      </Section>

      {tops.map((t) => (
        <Section title={t.title} key={t.title}>
          {t.entries.map((entry, i) => {
            const npc = engine.npcs[entry.id];
            if (!npc) return null;
            return (
              <button
                type="button"
                key={entry.id}
                className="rel-row"
                onClick={() => select(entry.id)}
              >
                <span style={{ color: 'var(--text-faint)', width: 16 }}>{i + 1}.</span>
                <Avatar text={initials(npc)} color={tintOf(npc)} />
                <span style={{ minWidth: 0 }}>
                  <div className="name">{fullName(npc)}</div>
                  <div className="type">{jobTitle(engine, npc)}</div>
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600 }}>
                  {t.format(entry.value)}
                </span>
              </button>
            );
          })}
        </Section>
      ))}
    </>
  );
}

const pct = (a: number, b: number): string => (b ? ((a / b) * 100).toFixed(0) : '0');

function EconomyPanel() {
  const engine = useEngine();
  useSimPulse(1);
  const s = engine.stats;
  const m = engine.market;
  const ledger = engine.ledger;
  const income = ledger.lastMonthIncome;
  const spend = ledger.lastMonthSpend;
  const incomeTotal = Object.values(income).reduce((a, b) => a + b, 0);
  const spendTotal = Object.values(spend).reduce((a, b) => a + b, 0);

  const companies = [...engine.companies]
    .filter((c) => !c.bankrupt)
    .sort((a, b) => b.employees.length - a.employees.length)
    .slice(0, 12);

  return (
    <>
      <Section title="Lage der Wirtschaft">
        <div className="stat-grid">
          <StatCard label="Wirtschaftsindex" value={m.economyHealth.toFixed(0)} delta="von 100" />
          <StatCard label="Inflation" value={`${m.inflation.toFixed(1)} %`} delta="pro Jahr" />
          <StatCard label="Unternehmen" value={s.companiesActive} />
          <StatCard label="Insolvenzen" value={s.companiesBankrupt} delta="insgesamt" />
        </div>
        {s.history.length > 2 && (
          <>
            <h4 className="panel-title" style={{ marginTop: 12 }}>Wirtschaftsindex</h4>
            <Sparkline points={s.history.map((h) => h.economy)} color="var(--violet)" />
          </>
        )}
      </Section>

      <Section title="Preisniveau">
        {PRICE_CATEGORIES.map((c) => (
          <KV
            key={c}
            k={PRICE_LABEL[c]}
            v={`${m.price(c).toLocaleString('de-DE', { maximumFractionDigits: 2 })} € (${
              m.index[c] >= 1 ? '+' : ''
            }${((m.index[c] - 1) * 100).toFixed(0)} %)`}
          />
        ))}
      </Section>

      <Section title="Haushalte der Stadt · letzter Monat">
        <KV k="Einnahmen" v={formatMoney(incomeTotal)} />
        {Object.entries(income)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => (
            <KV key={k} k={`· ${INCOME_LABEL[k as keyof typeof INCOME_LABEL]}`} v={formatMoneyShort(v)} />
          ))}
        <div style={{ height: 8 }} />
        <KV k="Ausgaben" v={formatMoney(spendTotal)} />
        {Object.entries(spend)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <KV key={k} k={`· ${SPEND_LABEL[k as keyof typeof SPEND_LABEL]}`} v={formatMoneyShort(v)} />
          ))}
        <div style={{ height: 8 }} />
        <KV
          k="Saldo pro Kopf"
          v={formatMoney((incomeTotal - spendTotal) / Math.max(1, s.population))}
        />
      </Section>

      <Section title="Größte Arbeitgeber">
        {companies.map((c) => (
          <div key={c.id} style={{ padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 12 }}>{c.name}</strong>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {c.employees.length} MA
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Kontostand {formatMoneyShort(c.balance)} · Monatsgewinn{' '}
              <span style={{ color: c.lastProfit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {formatMoneyShort(c.lastProfit)}
              </span>{' '}
              · Ruf {c.reputation.toFixed(0)}
            </div>
          </div>
        ))}
      </Section>
    </>
  );
}

function StoriesPanel() {
  const engine = useEngine();
  useSimPulse(1);
  const select = useUI((s) => s.select);
  const stories = engine.stories.stories;

  if (!stories.length) {
    return (
      <Empty>
        Noch keine Geschichte entstanden.
        <br />
        Lass die Zeit laufen – Geschichten entstehen von selbst, wenn sich Ereignisse zu einer Kette
        verbinden.
      </Empty>
    );
  }

  return (
    <>
      {stories.map((story) => (
        <article className="story-card" key={story.id}>
          <h4>{story.title}</h4>
          <div className="period">
            {storyPeriod(story)} · {formatDate(story.startDay, true)} – {formatDate(story.endDay, true)}
          </div>
          <p>{story.summary}</p>
          <div className="cast">
            {story.cast.slice(0, 6).map((id) => {
              const npc = engine.npcs[id];
              if (!npc) return null;
              return (
                <button type="button" className="chip" key={id} onClick={() => select(id)}>
                  {fullName(npc)}
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </>
  );
}
