/* ---------------------------------------------------------------------
   Drei Spielweisen, derselbe Seed, derselbe Code.

     node tools/szenarien.js [wochen] [seed]

   Ein Spiel ist erst dann ausgewogen, wenn verschiedene Strategien
   verschieden ausgehen - und keine davon alles trivial macht. Deshalb
   laufen hier drei Spieler nebeneinander:

     VORSICHTIG  haelt die Hitze unten, kauft ueberwiegend legal,
                 verteidigt sich frueh, waechst langsam
     AGGRESSIV   kauft Untergrund, nimmt jeden Auftrag, ignoriert die
                 Hitze, bis es weh tut
     SCHLAMPIG   gibt aus, was da ist, ohne Ruecklage, vernachlaessigt
                 Loyalitaet und den Fall

   Verglichen wird nicht nur, wer reicher wird, sondern ob jede Weise
   eigene Probleme bekommt. Wenn alle drei dasselbe Ergebnis liefern,
   entscheidet die Spielweise nichts.
   --------------------------------------------------------------------- */
'use strict';
const path = require('path');
const base = path.join(__dirname, '..', 'src');
['util', 'data', 'state', 'crew', 'ops', 'empire', 'economy', 'rivals', 'fear', 'city',
 'commission', 'people', 'events', 'progress', 'save', 'sim']
  .forEach(m => require(path.join(base, m + '.js')));
const CE = globalThis.CE;
const { util: U, state: St, data: D, sim: Sim, ops: Ops, crew: Crew, empire: Emp, commission: K } = CE;

const WOCHEN = parseInt(process.argv[2] || '110', 10);
const SEED = parseInt(process.argv[3] || '8080', 10);

/* ------------------------------------------------------- Spielweisen */

const WEISEN = {
  vorsichtig: {
    name: 'Vorsichtig',
    puffer: 1.8,             /* Faktor Bargeld-Ruecklage vor einem Kauf */
    hitzeGrenze: 38,         /* ab hier wird gegengesteuert */
    legalNeigung: 2.2,       /* Vorliebe fuer legale Betriebe */
    fallGrenze: 30,          /* ab welchem Fallstand verteidigt wird */
    minOdds: 0.72,           /* nimmt nur sichere Auftraege */
    loyalitaet: true,        /* kuemmert sich um die Mannschaft */
    anwaelte: 3
  },
  aggressiv: {
    name: 'Aggressiv',
    puffer: 1.25,
    hitzeGrenze: 72,
    legalNeigung: 0.55,
    fallGrenze: 70,
    minOdds: 0.5,
    loyalitaet: true,
    anwaelte: 1,
    /* Nutzt die Wege, die Furcht aufschliesst. */
    gewalt: true
  },
  ausgewogen: {
    name: 'Ausgewogen',
    puffer: 1.5,
    hitzeGrenze: 52,
    legalNeigung: 1.25,
    fallGrenze: 50,
    minOdds: 0.62,
    loyalitaet: true,
    anwaelte: 2,
    /* Greift zu, wenn es sich lohnt, sucht die Gelegenheit aber nicht. */
    gewalt: 'gelegentlich'
  }
};

/* ------------------------------------------------------------- Lauf */

function spiele(weise, seed) {
  const w = WEISEN[weise];
  const s = St.newGame({ seed, name: w.name });
  Sim.bootstrap(s);

  const verlauf = [];
  const ereignisse = [];
  const protokoll = [];
  let tageImMinus = 0, maxSchulden = 0, maxHitze = 0, hitzeSumme = 0, n = 0;
  let lockdownWochen = 0, maxLockdown = 0, gewonnenWoche = 0;

  for (let tag = 0; tag < WOCHEN * 7; tag++) {
    if (s.event) entscheide(s, w, ereignisse);
    if (tag % 2 === 0) handeln(s, w, protokoll);
    auftraege(s, w);
    Sim.advanceDay(s);
    if (s.event) entscheide(s, w, ereignisse);

    if (s.cash < 0) { tageImMinus++; maxSchulden = Math.max(maxSchulden, -s.cash); }
    maxHitze = Math.max(maxHitze, s.heat);
    hitzeSumme += s.heat; n++;

    if (s.day % 7 === 0) {
      const d = St.derive(s);
      const lock = Object.keys(s.districts).filter(k => s.districts[k].state === 'lockdown').length;
      if (lock) lockdownWochen++;
      maxLockdown = Math.max(maxLockdown, lock);
      if (s.flags.won && !gewonnenWoche) gewonnenWoche = U.weekOf(s.day);
      verlauf.push({
        woche: U.weekOf(s.day),
        haeltKontrolle: CE.progress.victory(s), cash: Math.round(s.cash), worth: Math.round(d.netWorth),
        net: Math.round(d.net), biz: s.businesses.length, crew: s.crew.length - 1,
        heat: Math.round(s.heat), rep: Math.round(s.rep), infl: Math.round(d.totalInfluence),
        rang: d.rankName, rangIdx: d.rank,
        fall: s.commission && s.commission.open ? Math.round(s.commission.strength) : -1,
        fallPhase: s.commission && s.commission.open ? K.phase(s).name : '-',
        anklagen: s.commission ? s.commission.raids : 0,
        assets: s.commission && s.commission.assets ? s.commission.assets.length : 0,
        budget: s.commission ? Math.round(s.commission.budget || 0) : 0,
        lock: lock,
        kontrolliert: Object.keys(s.districts).filter(k => s.districts[k].mine >= 60).length,
        dreck: s.businesses.filter(b => !D.byId(D.BUSINESSES, b.type).legal).length,
        fear: Math.round(s.fear || 0),
        legit: CE.fear.legitimacy(s),
        tribute: (s.tributes || []).length,
        zustaende: Object.keys(s.districts).filter(k => s.districts[k].open)
          .map(k => s.districts[k].state || 'stable'),
        unruhe: Math.round(Object.keys(s.districts).reduce((a, k) => a + (s.districts[k].unrest || 0), 0))
      });
    }
  }

  const d = St.derive(s);
  const figuren = CE.people.known(s);
  return {
    weise: w.name, verlauf, ereignisse, protokoll,
    ende: {
      woche: U.weekOf(s.day), cash: Math.round(s.cash), worth: Math.round(d.netWorth),
      biz: s.businesses.length, dreck: s.businesses.filter(b => !D.byId(D.BUSINESSES, b.type).legal).length,
      crew: s.crew.length - 1, rang: d.rankName, rep: Math.round(s.rep),
      kontrolliert: Object.keys(s.districts).filter(k => s.districts[k].mine >= 60).length,
      erfolge: CE.progress.earned(s).length, gewonnen: !!s.flags.won,
      gewonnenWoche: gewonnenWoche,
      haeltKontrolle: CE.progress.victory(s),
      wochenInKontrolle: verlauf.filter(function (m) { return m.haeltKontrolle; }).length,
      anklagen: s.commission ? s.commission.raids : 0,
      fallAusgaben: s.commission ? Math.round(s.commission.spent || 0) : 0,
      fall: s.commission && s.commission.open ? Math.round(s.commission.strength) : -1,
      assets: s.commission && s.commission.assets ? s.commission.assets.length : 0,
      ops: s.stats.opsWon + '/' + s.stats.opsRun, razzien: s.stats.raids, strafen: s.stats.fines,
      fear: Math.round(s.fear || 0), legit: CE.fear.legitimacy(s),
      tribute: (s.tributes || []).length,
      erzwungen: s.stats.muscled || 0, uebernommen: s.stats.seized || 0,
      zustaende: Object.keys(s.districts).filter(k => s.districts[k].open).map(k => s.districts[k].state || 'stable'),
      figuren: figuren.map(x => x.def.id + ':' + Math.round(x.state.trust)),
      figurenWarm: figuren.filter(x => x.state.trust > 25).length
    },
    kennzahlen: {
      tageImMinus, maxSchulden: Math.round(maxSchulden), maxHitze: Math.round(maxHitze),
      schnittHitze: Math.round(hitzeSumme / n), lockdownWochen, maxLockdown
    }
  };
}

/* --------------------------------------------------------- Handeln */

function handeln(s, w, protokoll) {
  protokoll = protokoll || [];
  let d = St.derive(s);

  /* Hitze. Nicht jede Ueberschreitung rechtfertigt eine Zahlung -
     wer bei jedem Ausschlag Anwaelte holt, zahlt sich arm. */
  if (s.heat > w.hitzeGrenze) {
    const acts = Emp.heatActions(s);
    const lohntSich = acts[0].cost < Math.max(1500, d.grossIncome * 0.5);
    if (lohntSich && s.cash > acts[0].cost * w.puffer) Emp.doHeatAction(s, 'counsel');
    else if (s.heat > w.hitzeGrenze + 18 && !(s.flags.layLowUntil > s.day)) Emp.doHeatAction(s, 'laylow');
    d = St.derive(s);
  }

  /* Bundesermittlung */
  const c = s.commission;
  if (c && c.open) {
    /* Gezielte Gegenwehr zuerst, wenn es sie gibt. */
    if (K.targeted) {
      for (const a of K.targeted(s, d)) {
        const can = K.canDo(s, a.id);
        if (can.ok && (!a.cost || s.cash > a.cost * w.puffer)) { K.doAction(s, a.id); break; }
      }
    }
    if (c.strength > w.fallGrenze) {
      for (const id of ['counsel', 'witness', 'records', 'divest']) {
        const can = K.canDo(s, id);
        if (!can.ok) continue;
        if (can.act.cost && s.cash < can.act.cost * w.puffer) continue;
        K.doAction(s, id);
        break;
      }
    }
    d = St.derive(s);
  }

  /* Mannschaft */
  const bezahlt = s.crew.filter(c2 => !c2.player);
  if (w.loyalitaet) {
    for (const c2 of bezahlt) {
      if (c2.loyalty >= 45) continue;
      const fair = Math.round(Crew.fairSalary(c2) / 10) * 10;
      if (c2.salary < fair && s.cash > fair * 12) Crew.setSalary(s, c2.id, fair);
      else if (c2.loyalty < 30 && s.cash > c2.salary * 12) Crew.bonus(s, c2.id);
    }
  }
  if (bezahlt.length < d.crewCap && s.recruits.length && s.cash > 16000 * w.puffer) {
    const anwaelte = bezahlt.filter(c2 => c2.role === 'lawyer').length;
    const best = s.recruits.map(r => {
      let v = r.skill * 120 + r.potential * 40 + r.loyalty - r.ask * 0.5;
      if (r.role === 'lawyer' && anwaelte < w.anwaelte) v += 600;
      if (!bezahlt.some(c2 => c2.role === r.role)) v += 240;
      return { r, v };
    }).sort((a, b) => b.v - a.v)[0];
    if (best && s.cash > best.r.ask * 1.6 * w.puffer) Crew.hire(s, best.r.id);
  }
  for (const c2 of s.crew) {
    if (c2.player || c2.post || c2.busyUntil > s.day) continue;
    if (D.byId(D.ROLES, c2.role).slot !== 'business') continue;
    for (const b of s.businesses) if (Crew.assign(s, c2.id, b.id).ok) break;
  }

  /* Organisation */
  const orgWunsch = [];
  if (bezahlt.length >= d.crewCap) orgWunsch.push('safehouse');
  if (d.dirtyGross > d.launderCap * 0.85) orgWunsch.push('laundry');
  if (d.heatGain > d.heatDecay) orgWunsch.push('lookouts', 'retainer');
  if (s.commission && s.commission.open) orgWunsch.push('retainer');
  orgWunsch.push('fleet', 'recruiting', 'safehouse', 'laundry', 'retainer', 'lookouts');
  for (const id of orgWunsch) {
    const can = Emp.canUpgradeOrg(s, id);
    if (can.ok && s.cash > can.cost * (w.puffer + 0.8)) { Emp.upgradeOrg(s, id); d = St.derive(s); break; }
  }

  /* Bezirke: kaufen oder nehmen. Der aggressive Spieler nimmt, wenn er
     kann - das spart Geld und bringt Furcht, kostet aber Ruf, Hitze und
     Ruhe im Bezirk. */
  for (const dist of D.DISTRICTS) {
    const kaufen = Emp.canOpenDistrict(s, dist.id);
    const zwingen = Emp.canMuscleIn(s, dist.id);
    const nimmt = w.gewalt && zwingen.ok && zwingen.odds > (w.gewalt === 'gelegentlich' ? 0.62 : 0.45);
    /* Zwingen lohnt vor allem, wenn Kaufen unbezahlbar ist. */
    const kannKaufen = kaufen.ok && s.cash > kaufen.cost * (w.puffer + 0.3);
    if (nimmt && (!kannKaufen || w.gewalt === true)) {
      const r = Emp.muscleIn(s, Sim.rngOf(s), dist.id);
      if (r.ok) { protokoll.push('W' + U.weekOf(s.day) + ' ' + (r.win ? 'BEZIRK ERZWUNGEN' : 'Einmarsch gescheitert') + ': ' + dist.name); d = St.derive(s); break; }
    }
    if (kannKaufen) { Emp.openDistrict(s, dist.id); d = St.derive(s); break; }
  }

  /* Furcht gezielt aufbauen: Druck auf Rivalen ist die verlaessliche
     Quelle, sobald die Organisation dafuer reicht. */
  if (w.gewalt && (s.fear || 0) < (w.gewalt === 'gelegentlich' ? 34 : 75)) {
    for (const r of s.rivals) {
      if (r.allied) continue;
      for (const k in s.districts) {
        if (!s.districts[k].open) continue;
        const can = CE.rivals.canPressure(s, r.id, k);
        if (can.ok && can.odds > (w.gewalt === 'gelegentlich' ? 0.6 : 0.42) &&
            s.cash > can.cost * w.puffer) {
          CE.rivals.pressureRival(s, Sim.rngOf(s), r.id, k);
          d = St.derive(s);
          break;
        }
      }
      if ((s.fear || 0) >= (w.gewalt === 'gelegentlich' ? 34 : 75)) break;
    }
  }

  /* Schutzgeld und Uebernahmen. Nur wer gefuerchtet wird, kommt hier
     ueberhaupt hin. */
  if (w.gewalt) {
    for (const r of s.rivals) {
      if (r.allied) continue;
      const zahlt = (s.tributes || []).some(x => x.rival === r.id);
      if (!zahlt) {
        const canT = CE.rivals.canDemandTribute(s, r.id);
        if (canT.ok && canT.odds > (w.gewalt === 'gelegentlich' ? 0.6 : 0.42)) {
          const res = CE.rivals.demandTribute(s, Sim.rngOf(s), r.id);
          if (res.ok) protokoll.push('W' + U.weekOf(s.day) + ' Schutzgeld von ' +
            D.byId(D.RIVALS, r.id).name + ': ' + (res.win ? 'ANGENOMMEN' : 'abgelehnt'));
          break;
        }
      }
      /* Der ausgewogene Spieler nimmt einen Betrieb nur, wenn Kaufen
         gerade nicht geht - Gewalt ist fuer ihn ein Mittel zum Zweck,
         keine Gewohnheit. Der aggressive nimmt, wann immer er kann. */
      const kannKaufenStatt = D.BUSINESSES.some(def => {
        for (const k2 in s.districts) {
          if (!s.districts[k2].open) continue;
          const c2 = Emp.canBuy(s, k2, def.id, d.rank);
          if (c2.ok && s.cash > c2.cost * w.puffer) return true;
        }
        return false;
      });
      if (w.gewalt === true || !kannKaufenStatt) {
        for (const k in s.districts) {
          if (!s.districts[k].open) continue;
          const canS = CE.rivals.canSeize(s, r.id, k);
          if (canS.ok && canS.odds > (w.gewalt === 'gelegentlich' ? 0.6 : 0.45)) {
            const res = CE.rivals.seize(s, Sim.rngOf(s), r.id, k);
            if (res.ok) protokoll.push('W' + U.weekOf(s.day) + ' Uebernahme in ' +
              D.byId(D.DISTRICTS, k).name + ': ' + (res.win ? 'GELUNGEN' : 'gescheitert'));
            break;
          }
        }
      }
    }
  }

  /* Betriebe */
  let best = null;
  for (const k in s.districts) {
    if (!s.districts[k].open) continue;
    for (const def of D.BUSINESSES) {
      const can = Emp.canBuy(s, k, def.id, d.rank);
      if (!can.ok || s.cash < can.cost * w.puffer) continue;
      const dist = D.byId(D.DISTRICTS, k);
      const netto = (def.income - def.upkeep) * dist.econ;
      let v = netto / can.cost;
      if (def.legal) v *= w.legalNeigung;
      if (!def.legal && s.heat > 60) v *= 0.5;
      if (!best || v > best.v) best = { k, id: def.id, v };
    }
  }
  if (best) Emp.buy(s, best.k, best.id);

  /* Ausbauen */
  let up = null;
  for (const b of s.businesses) {
    const can = Emp.canUpgrade(s, b.id);
    if (!can.ok || s.cash < can.cost * (w.puffer + 0.5)) continue;
    const f = St.bizFinance(s, b);
    const v = f.net / can.cost;
    if (!up || v > up.v) up = { b, v };
  }
  if (up) Emp.upgrade(s, up.b.id);

  /* Diplomatie: nur der Vorsichtige pflegt sie ernsthaft. */
  if (w.puffer > 2) {
    const freundlichster = s.rivals.filter(r => !r.allied).sort((a, b) => b.relation - a.relation)[0];
    if (freundlichster) {
      const canA = CE.rivals.canAlly(s, freundlichster.id);
      if (canA.ok) CE.rivals.ally(s, freundlichster.id);
      else {
        const kosten = CE.rivals.negotiateCost(s, freundlichster, d);
        const trib = CE.rivals.tributeCost(s, freundlichster, d);
        if (freundlichster.truceUntil <= s.day && s.cash > kosten * 3) CE.rivals.negotiate(s, freundlichster.id);
        else if (s.cash > trib * 6) CE.rivals.tribute(s, freundlichster.id);
      }
    }
  }
}

function auftraege(s, w) {
  let guard = 0;
  while (guard++ < 8) {
    const frei = Ops.available(s).filter(c => !c.post);
    if (!frei.length) break;
    frei.sort((a, b) => St.effectiveSkill(b) - St.effectiveSkill(a));
    let best = null;
    for (const o of Ops.allOffers(s)) {
      if (o.crewNeed > frei.length) continue;
      const team = frei.slice(0, o.crewNeed).map(c => c.id);
      const p = Ops.odds(s, o, team);
      if (p < w.minOdds) continue;
      const tage = Ops.duration(s, o, team);
      let v = (o.pay * p - o.pay * 0.2 * (1 - p)) / (tage * o.crewNeed);
      /* Wer aggressiv spielt, nimmt bewusst die Auftraege, die gegen
         jemanden laufen - sie bauen Furcht auf. */
      if (w.gewalt === true && o.type === 'raid') v *= 2.2;
      if (!best || v > best.v) best = { o, team, v };
    }
    if (!best) break;
    if (!Ops.start(s, best.o.id, best.team).ok) break;
  }
}

/* Entscheidungen: derselbe Bewerter wie im Durchspiel-Werkzeug, mit der
   Risikoneigung der jeweiligen Spielweise. */
function entscheide(s, w, log) {
  const ev = s.event;
  if (!ev) return;
  const offen = ev.options.map((o, i) => ({ o, i })).filter(x => !x.o.disabled);
  if (!offen.length) { s.event = null; return; }
  const knapp = s.cash < 20000 * w.puffer;
  /* Was die teuerste offene Antwort kostet - daran misst sich, ob
     Ablehnen ueberhaupt etwas spart. */
  let teuerste = 0;
  for (const x of offen) {
    const mm = (x.o.label + ' ' + (x.o.hint || '')).toLowerCase().match(/-\$([\d.,]+)([km]?)/);
    if (mm) { let c = parseFloat(mm[1].replace(/,/g, '')); if (mm[2] === 'k') c *= 1000; else if (mm[2] === 'm') c *= 1e6; teuerste = Math.max(teuerste, c); }
  }
  let beste = offen[0], bw = -1e9;
  for (const x of offen) {
    const t = (x.o.label + ' ' + (x.o.hint || '')).toLowerCase();
    let v = 0;
    const m = t.match(/-\$([\d.,]+)([km]?)/);
    if (m) {
      let c = parseFloat(m[1].replace(/,/g, ''));
      if (m[2] === 'k') c *= 1000; else if (m[2] === 'm') c *= 1e6;
      v -= (c / Math.max(4000, s.cash)) * (knapp ? 110 : 45) * w.puffer / 2;
    }
    if (/\+\$/.test(t)) v += 28;
    if (/loyalty up|reputation up|influence/.test(t)) v += 22;
    if (/heat down|heat -|case/.test(t)) v += s.heat > 50 ? 42 : 14;
    if (/permanent|for good/.test(t)) v += 34;
    if (/relations? (up|improve)|trust/.test(t)) v += 14;
    if (/uncertain|gambl|might|risky/.test(t)) v -= 16 * w.puffer / 2;
    /* Ablehnen ist nur dann klug, wenn eine andere Antwort wirklich
       Geld kosten wuerde. Vorher belohnte der Bewerter jedes "walk
       away" bei knapper Kasse - und verpasste damit jede kostenlose
       Gelegenheit, eine Beziehung aufzubauen. */
    if (/walk away|not now|decline|nothing now|free\./.test(t)) {
      v += (knapp && teuerste > 0) ? 16 : -8;
    }
    if (v > bw) { bw = v; beste = x; }
  }
  log.push({ titel: ev.title, wahl: beste.o.label });
  Sim.choose(s, beste.i);
}

/* ------------------------------------------------------------ Bericht */

const ergebnisse = ['vorsichtig', 'aggressiv', 'ausgewogen'].map(k => spiele(k, SEED));

console.log('CRIME EMPIRE - drei Spielweisen, Seed ' + SEED + ', ' + WOCHEN + ' Wochen\n');
const sp = (t, f) => console.log('  ' + t.padEnd(26) + ergebnisse.map(r => String(f(r)).padStart(14)).join(''));
console.log('  ' + ''.padEnd(26) + ergebnisse.map(r => r.weise.padStart(14)).join(''));
console.log('  ' + '-'.repeat(26 + 14 * 3));
sp('Vermoegen', r => fmt(r.ende.worth));
sp('Betriebe (davon Untergrund)', r => r.ende.biz + ' (' + r.ende.dreck + ')');
sp('Mannschaft', r => r.ende.crew);
sp('Rang', r => r.ende.rang.split(' ')[0]);
sp('Bezirke kontrolliert', r => r.ende.kontrolliert + '/6');
sp('Sieg erreicht in Woche', r => r.ende.gewonnenWoche || 'nie');
sp('haelt Kontrolle am Ende', r => r.ende.haeltKontrolle ? 'ja' : 'NEIN');
sp('Wochen in Kontrolle', r => r.ende.wochenInKontrolle);
sp('Erfolge', r => r.ende.erfolge + '/' + D.ACHIEVEMENTS.length);
console.log('');
sp('Hitze Schnitt / max', r => r.kennzahlen.schnittHitze + ' / ' + r.kennzahlen.maxHitze);
sp('Wochen mit Lockdown', r => r.kennzahlen.lockdownWochen + ' (max ' + r.kennzahlen.maxLockdown + ')');
sp('Tage im Minus', r => r.kennzahlen.tageImMinus);
sp('hoechste Schulden', r => fmt(r.kennzahlen.maxSchulden));
console.log('');
sp('Fallstand am Ende', r => r.ende.fall < 0 ? 'kein Fall' : r.ende.fall);
sp('Anklagen', r => r.ende.anklagen);
sp('Mittel der Kommission', r => r.ende.assets);
sp('fuer Abwehr ausgegeben', r => fmt(r.ende.fallAusgaben));
sp('Polizeirazzien', r => r.ende.razzien);
sp('Strafen', r => r.ende.strafen);
console.log('');
sp('Auftraege', r => r.ende.ops);
sp('Figuren warm (>25)', r => r.ende.figurenWarm + '/4');
console.log('');
sp('Furcht am Ende', r => r.ende.fear);
sp('Seriositaet', r => CE.fear.legitimacyLabel(r.ende.legit));
sp('Bezirke erzwungen', r => r.ende.erzwungen);
sp('Betriebe uebernommen', r => r.ende.uebernommen);
sp('zahlen Schutzgeld', r => r.ende.tribute);
sp('Unruhe gesamt', r => r.verlauf.length ? r.verlauf[r.verlauf.length - 1].unruhe : 0);
sp('Bezirkszustaende', r => [...new Set(r.ende.zustaende)].join(','));

/* Trivialitaetspruefung: wenn alle drei gleich ausgehen, entscheidet
   die Spielweise nichts. */
const werte = ergebnisse.map(r => r.ende.worth);
const spanne = Math.max(...werte) / Math.max(1, Math.min(...werte));
console.log('\nSpreizung im Vermoegen: Faktor ' + spanne.toFixed(2) +
  (spanne < 1.25 ? '  <- zu eng: die Spielweise entscheidet kaum etwas' : ''));
/* Nicht "wer gewinnt", sondern "wie schnell und wie sicher". Ein Sieg,
   den man einmal beruehrt und danach wieder verliert, ist etwas anderes
   als eine Stadt, die man haelt. */
const wochen = ergebnisse.map(r => r.ende.gewonnenWoche || 999);
const halten = ergebnisse.map(r => r.ende.wochenInKontrolle);
console.log('Zeit bis zum Sieg: ' + wochen.join(' / ') + ' Wochen');
console.log('Wochen mit tatsaechlicher Kontrolle: ' + halten.join(' / '));
/* Gleiche Siegzeit ist kein Problem - gleiche *Wege* waeren eins. Die
   Pruefung misst deshalb, wie unterschiedlich gespielt wurde, nicht wie
   unterschiedlich es ausging. */
const wege = ergebnisse.map(r => [
  r.ende.erzwungen + r.ende.uebernommen + r.ende.tribute,   /* gewaltsame Wege */
  r.ende.legit,                                             /* seriose Wege */
  Math.round(r.ende.fear / 25)
].join('|'));
console.log('Wegprofil (Gewalt | Seriositaet | Furchtstufe): ' + wege.join('   '));
if (new Set(wege).size < ergebnisse.length) {
  console.log('WARNUNG: mindestens zwei Spielweisen nehmen denselben Weg.');
}
const spanneVermoegen = Math.max(...werte) / Math.max(1, Math.min(...werte));
const spanneTempo = Math.max(...wochen) - Math.min(...wochen);
if (spanneVermoegen < 1.3 && spanneTempo < 6) {
  console.log('WARNUNG: die Spielweisen unterscheiden sich weder im Ergebnis noch im Tempo.');
}

require('fs').writeFileSync('/tmp/ce-szenarien.json', JSON.stringify(ergebnisse, null, 1));
console.log('\nRohdaten in /tmp/ce-szenarien.json');

function fmt(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
