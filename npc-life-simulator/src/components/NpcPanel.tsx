import { useMemo } from 'react';
import { useEngine, useSimPulse } from '../state/EngineContext';
import { useUI, type DetailTab } from '../state/store';
import { formatMoney, formatMoneyShort } from '../core/math';
import { formatDate, formatDuration, DAYS_PER_YEAR } from '../time/calendar';
import { EMOTION_KEYS, EMOTION_LABEL, mood } from '../npc/Emotions';
import { NEED_KEYS, NEED_LABEL } from '../npc/Needs';
import { lifeEvents } from '../npc/Memory';
import { GOAL_LABEL } from '../npc/Goals';
import { SKILL_IDS, SKILL_LABEL, type NPC } from '../npc/types';
import { RELATION_LABEL, FAMILY_TIE_LABEL } from '../relationships/types';
import { levelTitle, MAX_CAREER_LEVEL } from '../economy/professions';
import {
  currentActivity,
  educationLabel,
  employerName,
  fullName,
  homeLabel,
  initials,
  jobTitle,
  moodLabel,
  relationshipStatus,
  routineLine,
  stageLabel,
  tintOf,
} from '../npc/describe';
import { Avatar, Badge, Bar, BarRow, Empty, KV, Section } from './ui';
import { GodPanel } from './GodPanel';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Überblick' },
  { id: 'needs', label: 'Zustand' },
  { id: 'social', label: 'Beziehungen' },
  { id: 'life', label: 'Leben' },
  { id: 'career', label: 'Beruf & Geld' },
  { id: 'goals', label: 'Ziele' },
];

export function NpcPanel() {
  const engine = useEngine();
  useSimPulse(8);
  const selectedId = useUI((s) => s.selectedId);
  const tab = useUI((s) => s.detailTab);
  const setTab = useUI((s) => s.setDetailTab);
  const tracked = useUI((s) => s.trackedIds.includes(selectedId));
  const toggleTrack = useUI((s) => s.toggleTrack);
  const follow = useUI((s) => s.followSelected);
  const toggle = useUI((s) => s.toggle);
  const godOpen = useUI((s) => s.godPanelOpen);

  const npc = selectedId >= 0 ? engine.npcs[selectedId] : undefined;

  if (!npc) {
    return (
      <aside className="sidebar right">
        <Empty>
          Niemand ausgewählt.
          <br />
          Klicke jemanden auf der Karte an oder wähle eine Person aus der Liste.
        </Empty>
      </aside>
    );
  }

  // The panel reads live values, so the NPC is brought up to date first.
  if (npc.alive) engine.advanceNpc(npc, engine.now);
  const m = moodLabel(npc);

  return (
    <aside className="sidebar right">
      <div className="detail-head">
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <Avatar text={initials(npc)} color={tintOf(npc)} large />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="detail-name">{fullName(npc)}</div>
            <div className="detail-sub">
              {npc.alive ? `${npc.ageYears} Jahre · ${stageLabel(npc)}` : `† ${formatDate(npc.deathDay)}`}
            </div>
          </div>
        </div>

        <div className="detail-sub" style={{ marginTop: 8 }}>
          {npc.alive ? currentActivity(engine, npc) : `verstorben (${npc.deathCause})`}
        </div>

        <div className="detail-actions">
          <Badge tone={m.tone}>{m.text}</Badge>
          <Badge>{jobTitle(engine, npc)}</Badge>
          {npc.family.married && <Badge tone="love">verheiratet</Badge>}
          {npc.pregnantUntilDay >= 0 && <Badge tone="love">schwanger</Badge>}
          {npc.homeId < 0 && <Badge tone="bad">ohne Wohnung</Badge>}
          {npc.debt > 1000 && <Badge tone="warn">verschuldet</Badge>}
        </div>

        <div className="detail-actions">
          <button
            type="button"
            className={tracked ? 'btn primary' : 'btn'}
            onClick={() => toggleTrack(npc.id)}
          >
            {tracked ? '★ verfolgt' : '☆ verfolgen'}
          </button>
          <button
            type="button"
            className={follow ? 'btn primary' : 'btn'}
            onClick={() => toggle('followSelected')}
            title="Kamera folgt dieser Person"
          >
            Kamera folgen
          </button>
          <button
            type="button"
            className={godOpen ? 'btn primary' : 'btn'}
            onClick={() => toggle('godPanelOpen')}
          >
            ✦ Eingreifen
          </button>
        </div>
      </div>

      {godOpen && npc.alive && <GodPanel npc={npc} />}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {tab === 'overview' && <Overview npc={npc} />}
        {tab === 'needs' && <NeedsTab npc={npc} />}
        {tab === 'social' && <SocialTab npc={npc} />}
        {tab === 'life' && <LifeTab npc={npc} />}
        {tab === 'career' && <CareerTab npc={npc} />}
        {tab === 'goals' && <GoalsTab npc={npc} />}
      </div>
    </aside>
  );
}

function Overview({ npc }: { npc: NPC }) {
  const engine = useEngine();
  const traits = [
    ['Offenheit', npc.p.openness],
    ['Extraversion', npc.p.extraversion],
    ['Verträglichkeit', npc.p.agreeableness],
    ['Gewissenhaftigkeit', npc.p.conscientiousness],
    ['Emot. Stabilität', npc.p.stability],
    ['Ehrgeiz', npc.p.ambition],
    ['Impulsivität', npc.p.impulsivity],
    ['Loyalität', npc.p.loyalty],
    ['Risikofreude', npc.p.risk],
    ['Empathie', npc.p.empathy],
  ] as const;

  return (
    <>
      <Section title="Person">
        <KV k="Geschlecht" v={npc.gender === 'm' ? 'männlich' : 'weiblich'} />
        <KV k="Geburtstag" v={formatDate(npc.birthDay)} />
        <KV k="Lebensphase" v={stageLabel(npc)} />
        <KV k="Bildung" v={educationLabel(npc)} />
        <KV k="Wohnort" v={homeLabel(engine, npc)} />
        <KV k="Beziehung" v={relationshipStatus(engine, npc)} />
        <KV k="Ruf in der Stadt" v={`${Math.round(npc.reputation)}/100`} />
        <KV k="Lebenszufriedenheit" v={`${Math.round(npc.lifeSatisfaction)}/100`} />
        <KV k="Tagesrhythmus" v={routineLine(npc)} />
      </Section>

      <Section title="Persönlichkeit">
        {traits.map(([label, value]) => (
          <BarRow key={label} label={label} value={value} color="var(--accent)" />
        ))}
      </Section>

      <Section title="Eigenschaften">
        <BarRow label="Intelligenz" value={npc.a.intelligence} color="var(--violet)" />
        <BarRow label="Selbstvertrauen" value={npc.a.confidence} color="var(--violet)" />
        <BarRow label="Disziplin" value={npc.a.discipline} color="var(--violet)" />
        <BarRow label="Aggressivität" value={npc.a.aggression} color="var(--bad)" />
        <BarRow label="Soziale Fähigk." value={npc.a.social} color="var(--violet)" />
        <BarRow label="Humor" value={npc.a.humor} color="var(--violet)" />
        <BarRow label="Ausstrahlung" value={npc.a.attractiveness} color="var(--love)" />
        <BarRow label="Gesundheit" value={npc.a.health} color="var(--good)" />
      </Section>

      <Section title="Hobbys & Interessen">
        <div className="tag-list">
          {npc.hobbies.map((h) => (
            <span className="badge" key={h}>
              {h}
            </span>
          ))}
        </div>
      </Section>

      {npc.secrets.length > 0 && (
        <Section title="Geheimnisse">
          {npc.secrets.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--warn)' }}>
              · {s.text} <span style={{ color: 'var(--text-faint)' }}>({formatDate(s.day, true)})</span>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function NeedsTab({ npc }: { npc: NPC }) {
  const engine = useEngine();
  return (
    <>
      <Section title="Bedürfnisse">
        {NEED_KEYS.map((k) => (
          <BarRow
            key={k}
            label={NEED_LABEL[k]}
            value={npc.needs[k]}
            invert={k === 'stress'}
          />
        ))}
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-faint)' }}>
          Vorräte zu Hause: {npc.pantry} Mahlzeiten
        </div>
      </Section>

      <Section title="Emotionen">
        {EMOTION_KEYS.map((k) => (
          <BarRow key={k} label={EMOTION_LABEL[k]} value={npc.emo[k]} color="var(--love)" />
        ))}
        <div className="kv" style={{ marginTop: 8 }}>
          <span className="k">Gesamtstimmung</span>
          <span className="v">{Math.round(mood(npc))}/100</span>
        </div>
        <Bar value={mood(npc)} />
      </Section>

      <Section title="Fähigkeiten">
        {SKILL_IDS.map((id) => (
          <BarRow key={id} label={SKILL_LABEL[id]} value={npc.skills[id]} color="var(--good)" />
        ))}
      </Section>

      <Section title="Aktueller Tagesablauf">
        <KV k="Tätigkeit" v={currentActivity(engine, npc)} />
        <KV
          k="noch"
          v={formatDuration(Math.max(0, npc.action.endMin - engine.now))}
        />
        <KV k="Ort" v={engine.world.buildings[npc.locId]?.name ?? '–'} />
        <KV
          k="Stadtteil"
          v={
            npc.locId >= 0
              ? engine.world.districts[engine.world.buildings[npc.locId].districtId].name
              : '–'
          }
        />
      </Section>
    </>
  );
}

function SocialTab({ npc }: { npc: NPC }) {
  const engine = useEngine();
  const select = useUI((s) => s.select);

  const groups = useMemo(() => {
    const circle = engine.graph.circle(npc);
    return [
      { title: 'Partnerschaft', ids: circle.romantic },
      { title: 'Familie', ids: circle.family },
      { title: 'Enge Freunde', ids: circle.closeFriends },
      { title: 'Freunde', ids: circle.friends.filter((id) => !circle.closeFriends.includes(id)) },
      { title: 'Arbeitskollegen', ids: circle.colleagues },
      { title: 'Bekannte', ids: circle.acquaintances.slice(0, 25) },
      { title: 'Rivalen & Feinde', ids: circle.rivals },
      { title: 'Ex-Partner', ids: circle.exes },
    ].filter((g) => g.ids.length > 0);
  }, [engine, npc, npc.links.length]);

  return (
    <>
      <Section title="Soziales Netz">
        <KV k="Kennt insgesamt" v={`${npc.links.length} Personen`} />
        <KV k="Freundschaften" v={engine.graph.friendCount(npc)} />
        <KV k="Beziehungsstatus" v={relationshipStatus(engine, npc)} />
      </Section>

      {groups.map((g) => (
        <Section title={`${g.title} (${g.ids.length})`} key={g.title}>
          {g.ids.map((id) => {
            const other = engine.npcs[id];
            const rel = engine.rels.get(npc.id, id);
            if (!other || !rel) return null;
            const tie = engine.rels.familyTieFrom(rel, npc.id);
            const strength = rel.closeness;
            return (
              <button type="button" className="rel-row" key={id} onClick={() => select(id)}>
                <Avatar text={initials(other)} color={tintOf(other)} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div className="name">
                    {fullName(other)}
                    {!other.alive && <span style={{ color: 'var(--text-faint)' }}> †</span>}
                  </div>
                  <div className="type">
                    {tie !== 'none' ? FAMILY_TIE_LABEL[tie] : RELATION_LABEL[rel.type]} ·{' '}
                    {other.alive ? `${other.ageYears} J` : 'verstorben'}
                  </div>
                </span>
                <span className="rel-strength" title={`Nähe ${Math.round(strength)}`}>
                  <Bar value={strength} />
                </span>
              </button>
            );
          })}
        </Section>
      ))}

      {npc.links.length > 0 && (
        <Section title="Was andere über diese Person denken">
          {npc.links.slice(0, 8).map((id) => {
            const rel = engine.rels.get(npc.id, id);
            const other = engine.npcs[id];
            if (!rel || !other) return null;
            const opinion = engine.rels.opinionFrom(rel, id);
            return (
              <KV
                key={id}
                k={fullName(other)}
                v={
                  <span
                    style={{
                      color:
                        opinion > 20 ? 'var(--good)' : opinion < -20 ? 'var(--bad)' : 'var(--text-dim)',
                    }}
                  >
                    {opinion > 20 ? 'schätzt sie/ihn' : opinion < -20 ? 'hat ein Problem' : 'neutral'}
                  </span>
                }
              />
            );
          })}
        </Section>
      )}
    </>
  );
}

function LifeTab({ npc }: { npc: NPC }) {
  const engine = useEngine();
  const select = useUI((s) => s.select);
  const memories = useMemo(() => lifeEvents(npc), [npc, npc.memories.length]);
  const events = useMemo(() => engine.events.forNpc(npc.id, 30), [engine, npc.id, engine.events.version]);
  const stories = useMemo(() => engine.stories.forNpc(npc.id), [engine, npc.id, engine.stories.version]);

  return (
    <>
      <Section title="Lebenslinie">
        {memories.length === 0 ? (
          <Empty>Noch keine prägenden Erinnerungen.</Empty>
        ) : (
          <div className="timeline">
            {memories.map((m, i) => (
              <div
                className={`timeline-item ${m.valence > 15 ? 'good' : m.valence < -15 ? 'bad' : ''}`}
                key={i}
              >
                <div className="when">
                  {formatDate(m.day)} · {Math.max(0, Math.floor((m.day - npc.birthDay) / DAYS_PER_YEAR))} Jahre
                </div>
                <div className="what">{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {stories.length > 0 && (
        <Section title="Geschichten">
          {stories.slice(0, 4).map((s) => (
            <article key={s.id} style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 12.5 }}>{s.title}</strong>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {s.summary}
              </p>
            </article>
          ))}
        </Section>
      )}

      <Section title="Letzte Ereignisse">
        {events.length === 0 ? (
          <Empty>Bisher nichts Berichtenswertes.</Empty>
        ) : (
          events.map((e) => (
            <button
              type="button"
              key={e.id}
              className="rel-row"
              onClick={() => {
                const other = e.subjects.find((id) => id !== npc.id);
                if (other !== undefined) select(other);
              }}
            >
              <span style={{ minWidth: 0 }}>
                <div className="type">{formatDate(e.day, true)}</div>
                <div style={{ fontSize: 12 }}>{e.text}</div>
              </span>
            </button>
          ))
        )}
      </Section>
    </>
  );
}

function CareerTab({ npc }: { npc: NPC }) {
  const engine = useEngine();
  const prof = engine.professionOf(npc);
  const company = npc.employerId >= 0 ? engine.companies[npc.employerId] : null;
  const home = npc.homeId >= 0 ? engine.world.buildings[npc.homeId] : null;
  const owns = home ? npc.ownedBuildings.includes(home.id) : false;

  return (
    <>
      <Section title="Beruf">
        <KV k="Tätigkeit" v={jobTitle(engine, npc)} />
        <KV k="Arbeitgeber" v={employerName(engine, npc)} />
        {prof && (
          <>
            <KV k="Karrierestufe" v={`${levelTitle(prof, npc.careerLevel)} (${npc.careerLevel + 1}/${MAX_CAREER_LEVEL + 1})`} />
            <KV k="Arbeitszeiten" v={`${prof.hours[0]}–${prof.hours[1] % 24} Uhr`} />
            <KV k="Im Job seit" v={npc.jobSinceDay >= 0 ? formatDate(npc.jobSinceDay) : '–'} />
          </>
        )}
        {npc.jobId < 0 && !npc.retired && npc.ageYears >= 18 && (
          <>
            <KV
              k="Arbeitslos seit"
              v={npc.unemployedSinceDay >= 0 ? formatDate(npc.unemployedSinceDay) : '–'}
            />
            <KV k="Offene Bewerbungen" v={npc.applications.length} />
          </>
        )}
        {prof && <BarRow label="Leistung" value={npc.performance} />}
        {company && (
          <>
            <div style={{ height: 8 }} />
            <KV k="Firmenkontostand" v={formatMoneyShort(company.balance)} />
            <KV k="Monatsgewinn" v={formatMoneyShort(company.lastProfit)} />
            <KV k="Beschäftigte" v={company.employees.length} />
          </>
        )}
      </Section>

      <Section title="Finanzen">
        <KV k="Bruttogehalt" v={npc.salary > 0 ? `${formatMoney(npc.salary)} / Monat` : '–'} />
        <KV k="Bargeld" v={formatMoney(npc.money)} />
        <KV k="Bankguthaben" v={formatMoney(npc.bank)} />
        <KV
          k="Schulden"
          v={<span style={{ color: npc.debt > 0 ? 'var(--bad)' : undefined }}>{formatMoney(npc.debt)}</span>}
        />
        <KV k="Nettovermögen" v={<strong>{formatMoney(engine.netWorth(npc))}</strong>} />
        <div style={{ height: 8 }} />
        <KV k="Einnahmen (Monat)" v={formatMoney(npc.monthIncome)} />
        <KV k="Ausgaben (Monat)" v={formatMoney(npc.monthSpend)} />
        <KV k="Fixkosten geschätzt" v={`${formatMoney(engine.monthlyCost(npc))} / Monat`} />
        <KV k="Frei verfügbar" v={`${formatMoney(engine.discretionaryDaily(npc))} / Tag`} />
      </Section>

      <Section title="Wohnen">
        <KV k="Adresse" v={homeLabel(engine, npc)} />
        {home && (
          <>
            <KV k="Status" v={owns ? 'Eigentum' : 'zur Miete'} />
            <KV k="Miete" v={`${formatMoney(home.rent)} / Monat`} />
            <KV k="Mitbewohner" v={Math.max(0, home.residents.length - 1)} />
            <BarRow label="Wohnqualität" value={home.quality} />
          </>
        )}
        {npc.ownedBuildings.length > 0 && (
          <KV k="Immobilien" v={`${npc.ownedBuildings.length} Objekt(e)`} />
        )}
      </Section>
    </>
  );
}

function GoalsTab({ npc }: { npc: NPC }) {
  return (
    <>
      <Section title="Lebensziele">
        {npc.goals.length === 0 ? (
          <Empty>Diese Person verfolgt gerade keine großen Ziele.</Empty>
        ) : (
          npc.goals.map((g) => (
            <div key={g.type} style={{ marginBottom: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <strong>{GOAL_LABEL[g.type]}</strong>
                <span style={{ color: 'var(--text-faint)' }}>Priorität {Math.round(g.priority)}</span>
              </div>
              <Bar value={g.progress} color="var(--accent)" />
              <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2 }}>
                {Math.round(g.progress)} % erreicht · verfolgt seit {formatDate(g.createdDay, true)}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Kurzfristig">
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          {shortTermGoals(npc).map((t, i) => (
            <div key={i}>· {t}</div>
          ))}
        </div>
      </Section>
    </>
  );
}

function shortTermGoals(npc: NPC): string[] {
  const out: string[] = [];
  const n = npc.needs;
  if (n.hunger < 45) out.push('etwas essen');
  if (n.energy < 40) out.push('schlafen');
  if (n.hygiene < 45) out.push('sich frisch machen');
  if (n.social < 50) out.push('Leute treffen');
  if (n.fun < 45) out.push('etwas Schönes erleben');
  if (n.stress > 65) out.push('zur Ruhe kommen');
  if (npc.pantry < 3) out.push('einkaufen gehen');
  if (npc.jobId < 0 && npc.ageYears >= 18 && !npc.retired) out.push('Arbeit finden');
  if (npc.homeId < 0) out.push('eine Wohnung finden');
  if (npc.debt > 5000) out.push('Schulden abbauen');
  if (!out.length) out.push('den Tag genießen');
  return out;
}
