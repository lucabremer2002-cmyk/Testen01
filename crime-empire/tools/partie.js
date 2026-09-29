/* ---------------------------------------------------------------------
   Eine ganze Partie, gespielt statt getestet.

     node tools/partie.js [wochen] [ordner]

   Der Unterschied zu tools/simulation.js: das hier laeuft im echten
   Browser und geht durch dieselben Klick-Behandlungen wie ein Mensch
   (window.CRIME.actions.*). Es entstehen echte Bildschirmfotos aus der
   laufenden Oberflaeche, keine Nachbauten.

   Der Spieler ist absichtlich *gut*, nicht zufaellig: er rechnet
   Erwartungswerte fuer Auftraege aus, haelt die Waschkapazitaet im
   Blick, kuemmert sich um Loyalitaet, verhandelt mit Rivalen und
   bewertet Ereignisoptionen, statt blind die erste zu nehmen. Nur so
   sagt die Fortschrittskurve etwas darueber aus, ob das Spiel traegt.

   An vier Meilensteinen wird angehalten und fotografiert:
     Early    erster Betrieb steht
     Mid      Organisationsfuehrer oder drei Bezirke
     Late     Crime Boss
     Endgame  Underworld Legend / Stadt erobert
   --------------------------------------------------------------------- */
'use strict';
const fs = require('fs');
const path = require('path');
const WEEKS = parseInt(process.argv[2] || '120', 10);
const DIR = process.argv[3] || '/tmp/ce-partie';
const URL = process.env.CE_URL || 'http://127.0.0.1:8231/index.html';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

/* ------------------------------------------------ Die Spielweise

   Laeuft im Browser. Alles hier drin sieht nur den Spielstand und ruft
   die Aktionen auf, die auch an den Knoepfen haengen.
   ------------------------------------------------------------------ */
function policySource() {
  const CE = window.CE, U = CE.util, D = CE.data, St = CE.state;
  const A = window.CRIME.actions;
  const log = [];

  /* Bestaetigungsfenster fuer grosse Ausgaben wegklicken - ein Mensch
     tut dasselbe, wenn er den Kauf wirklich will. */
  function confirmIfAsked() {
    const m = document.getElementById('modal');
    if (m.hidden) return false;
    const btn = m.querySelector('[data-act="__confirm"]');
    if (btn) { btn.click(); return true; }
    const close = m.querySelector('[data-close]');
    if (close) close.click();
    return false;
  }
  function act(name, params) {
    try { A[name](params || {}); } catch (e) { log.push('ACTION ' + name + ' warf: ' + e.message); return false; }
    confirmIfAsked();
    return true;
  }
  function closeAll() {
    for (const id of ['report', 'modal']) {
      const el = document.getElementById(id);
      if (el && !el.hidden) { const c = el.querySelector('[data-close]'); if (c) c.click(); }
    }
  }

  const s = () => window.CRIME.state();
  const der = () => St.derive(s());

  /* --- Auftraege ------------------------------------------------- */
  function doOps() {
    const st = s();
    let guard = 0;
    while (guard++ < 8) {
      const frei = CE.ops.available(st).filter(c => !c.post);
      if (!frei.length) break;
      /* Beste Koepfe zuerst - hohe Faehigkeit hebt die Aussicht. */
      frei.sort((a, b) => St.effectiveSkill(b) - St.effectiveSkill(a));
      let best = null;
      for (const o of CE.ops.allOffers(st)) {
        if (o.crewNeed > frei.length) continue;
        const team = frei.slice(0, o.crewNeed).map(c => c.id);
        const p = CE.ops.odds(st, o, team);
        if (p < 0.55) continue;
        const tage = CE.ops.duration(st, o, team);
        /* Ertrag je Kopf und Tag - so gewinnt der kurze, sichere Auftrag
           gegen den langen, der zwei Leute bindet. */
        const wert = (o.pay * p - o.pay * 0.2 * (1 - p)) / (tage * o.crewNeed);
        if (!best || wert > best.wert) best = { o, team, wert, p };
      }
      if (!best) break;
      CE.ui.sel.opCrew[best.o.id] = best.team;
      if (!act('startOp', { op: best.o.id })) break;
    }
  }

  /* --- Mannschaft ------------------------------------------------- */
  function doCrew() {
    const st = s(), d = der();
    const bezahlt = st.crew.filter(c => !c.player);

    /* Unzufriedene halten: erst Gehalt auf Marktwert, dann Bonus. */
    for (const c of bezahlt) {
      if (c.loyalty >= 45) continue;
      const fair = Math.round(CE.crew.fairSalary(c) / 10) * 10;
      if (c.salary < fair && st.cash > fair * 12) {
        act('raise', { id: c.id, to: fair });
        log.push('W' + U.weekOf(st.day) + ' Gehalt erhoeht: ' + c.name + ' auf ' + U.money(fair));
      } else if (c.loyalty < 32 && st.cash > c.salary * 12) {
        act('bonus', { id: c.id });
        log.push('W' + U.weekOf(st.day) + ' Bonus fuer ' + c.name);
      }
      closeAll();
    }

    /* Einstellen, solange Platz und Puffer da sind. */
    if (bezahlt.length < d.crewCap && st.recruits.length && st.cash > 18000) {
      const haben = new Set(bezahlt.map(c => c.role));
      const wunsch = ['manager', 'accountant', 'lawyer', 'enforcer', 'driver', 'informant', 'security', 'operator'];
      const bewertet = st.recruits.map(r => {
        let s2 = r.skill * 120 + r.potential * 40 + r.loyalty - r.ask * 0.5;
        if (!haben.has(r.role)) s2 += 260;                 /* Luecken zuerst */
        s2 += wunsch.indexOf(r.role) >= 0 ? (8 - wunsch.indexOf(r.role)) * 25 : 0;
        return { r, s2 };
      }).sort((a, b) => b.s2 - a.s2);
      const w = bewertet[0].r;
      if (st.cash > w.ask * 1.6 + 12000) {
        act('hire', { id: w.id });
        log.push('W' + U.weekOf(st.day) + ' eingestellt: ' + w.name + ' (' + w.role + ', Skill ' + w.skill + ') fuer ' + U.money(w.ask) + '/W');
      }
      closeAll();
    }

    /* Freie Koepfe auf offene Stellen. */
    for (const c of s().crew) {
      if (c.player || c.post || c.busyUntil > s().day) continue;
      if (D.byId(D.ROLES, c.role).slot !== 'business') continue;
      for (const b of s().businesses) if (CE.crew.assign(s(), c.id, b.id).ok) break;
    }
  }

  /* --- Bauen und kaufen -------------------------------------------- */
  function doBuild() {
    const st = s();
    let d = der();

    /* 1. Hitze zuerst - sie frisst alles andere auf. */
    if (st.heat > 58) {
      const acts = CE.empire.heatActions(st);
      const counsel = acts[0], grease = acts[1], low = acts[2];
      if (st.heat > 78 && st.cash > grease.cost * 2.5) { act('heatAction', { id: 'grease' }); log.push('W' + U.weekOf(st.day) + ' Schmiergeld gegen Hitze ' + Math.round(st.heat)); }
      else if (st.cash > counsel.cost * 3) { act('heatAction', { id: 'counsel' }); log.push('W' + U.weekOf(st.day) + ' Anwaelte gegen Hitze ' + Math.round(st.heat)); }
      else if (!(st.flags.layLowUntil > st.day)) { act('heatAction', { id: 'laylow' }); log.push('W' + U.weekOf(st.day) + ' Ruhephase bei Hitze ' + Math.round(st.heat)); }
      d = der();
    }

    /* 2. Organisation: nach Bedarf, nicht nach Liste. */
    const bezahlt = st.crew.filter(c => !c.player).length;
    const orgWunsch = [];
    if (bezahlt >= d.crewCap) orgWunsch.push('safehouse');
    if (d.dirtyGross > d.launderCap * 0.85) orgWunsch.push('laundry');
    if (d.heatGain > d.heatDecay) orgWunsch.push('lookouts', 'retainer');
    orgWunsch.push('fleet', 'recruiting', 'safehouse', 'laundry', 'retainer', 'lookouts');
    for (const id of orgWunsch) {
      const can = CE.empire.canUpgradeOrg(st, id);
      if (can.ok && st.cash > can.cost * 3.5) {
        act('upgradeOrg', { id });
        log.push('W' + U.weekOf(st.day) + ' Ausbau: ' + D.byId(D.ORG_UPGRADES, id).name + ' Stufe ' + can.level);
        d = der();
        break;
      }
    }

    /* 3. Neuer Bezirk, wenn er sich lohnt. */
    for (const dist of D.DISTRICTS) {
      const can = CE.empire.canOpenDistrict(st, dist.id);
      if (can.ok && st.cash > can.cost * 2.4) {
        act('openDistrict', { id: dist.id });
        log.push('W' + U.weekOf(st.day) + ' Bezirk eroeffnet: ' + dist.name + ' fuer ' + U.money(can.cost));
        d = der();
        break;
      }
    }

    /* 4. Betrieb kaufen. Die Waschkapazitaet entscheidet mit, ob legal
          oder Untergrund - reines Stapeln des Profitabelsten waere
          teuer bestraft. */
    const brauchtLegal = d.dirtyGross > d.launderCap * 0.8;
    let beste = null;
    for (const k in st.districts) {
      if (!st.districts[k].open) continue;
      for (const def of D.BUSINESSES) {
        const can = CE.empire.canBuy(st, k, def.id);
        if (!can.ok || st.cash < can.cost * 1.8) continue;
        const dist = D.byId(D.DISTRICTS, k);
        const netto = (def.income - def.upkeep) * dist.econ;
        let wert = netto / can.cost;
        if (brauchtLegal && def.legal) wert *= 1.9;
        if (!brauchtLegal && !def.legal) wert *= 1.25;
        if (!def.legal && st.heat > 55) wert *= 0.4;
        if (!beste || wert > beste.wert) beste = { k, id: def.id, wert, cost: can.cost, name: def.name };
      }
    }
    if (beste) {
      act('buyBiz', { district: beste.k, type: beste.id });
      log.push('W' + U.weekOf(st.day) + ' gekauft: ' + beste.name + ' in ' + D.byId(D.DISTRICTS, beste.k).name + ' fuer ' + U.money(beste.cost));
      d = der();
    }

    /* 5. Ausbauen, wenn Geld uebrig ist. Bester Ertrag je Dollar. */
    let up = null;
    for (const b of st.businesses) {
      const can = CE.empire.canUpgrade(st, b.id);
      if (!can.ok || st.cash < can.cost * 3) continue;
      const f = St.bizFinance(st, b);
      const wert = f.net / can.cost;
      if (!up || wert > up.wert) up = { b, wert, cost: can.cost };
    }
    if (up) {
      act('upgradeBiz', { id: up.b.id });
      log.push('W' + U.weekOf(s().day) + ' ausgebaut: ' + up.b.name + ' auf Stufe ' + up.b.level);
    }
  }

  /* --- Rivalen ------------------------------------------------------ */
  function doRivals() {
    const st = s(), d = der();
    for (const r of st.rivals) {
      const rd = D.byId(D.RIVALS, r.id);
      const canA = CE.rivals.canAlly(st, r.id);
      if (canA.ok) {
        act('ally', { id: r.id });
        log.push('W' + U.weekOf(st.day) + ' BUENDNIS mit ' + rd.name);
        continue;
      }
      if (r.allied) continue;
      /* Einen Rivalen gezielt hofieren, statt alle gleich zu behandeln:
         der Freundlichste ist der billigste Weg zu einem Buendnis. */
      const freundlichster = st.rivals.filter(x => !x.allied)
        .sort((a, b) => b.relation - a.relation)[0];
      const istZiel = freundlichster && freundlichster.id === r.id;
      const cost = CE.rivals.negotiateCost(st, r, d);
      const trib = CE.rivals.tributeCost(st, r, d);
      if (istZiel && r.truceUntil <= st.day && st.cash > cost * 2.2) {
        act('negotiate', { id: r.id });
        log.push('W' + U.weekOf(st.day) + ' verhandelt mit ' + rd.name + ' (' + U.money(cost) + ') -> ' + Math.round(r.relation));
      } else if (istZiel && st.cash > trib * 4) {
        act('tribute', { id: r.id });
      } else if (r.relation < -55 && st.cash > cost * 8 && r.truceUntil <= st.day) {
        act('negotiate', { id: r.id });   /* Feindschaft entschaerfen */
      }
    }
    /* Druck machen, wenn man stark genug ist und jemand im Weg sitzt. */
    if (d.strength > 60) {
      for (const r of st.rivals) {
        if (r.allied) continue;
        for (const k in st.districts) {
          if (!st.districts[k].open) continue;
          if (st.districts[k].mine < 45) continue;
          const can = CE.rivals.canPressure(st, r.id, k);
          if (can.ok && can.odds > 0.6 && st.cash > can.cost * 5) {
            act('pressure', { rival: r.id, district: k });
            log.push('W' + U.weekOf(st.day) + ' Druck auf ' + D.byId(D.RIVALS, r.id).name + ' in ' + D.byId(D.DISTRICTS, k).name);
            closeAll();
            return;
          }
        }
      }
    }
  }

  /* --- Entscheidungen ------------------------------------------------
     Jede Option wird bewertet, nicht die erste genommen. Bargeld wird
     dabei nach Lage gewichtet: wer knapp ist, kauft nichts.           */
  function answerEvent() {
    const st = s();
    if (!st.event) return null;
    const ev = st.event;
    const offen = ev.options.map((o, i) => ({ o, i })).filter(x => !x.o.disabled);
    if (!offen.length) return { stuck: ev.id };

    const knapp = st.cash < 20000;
    const text = o => (o.label + ' ' + (o.hint || '')).toLowerCase();
    let beste = offen[0], besterWert = -1e9;
    for (const x of offen) {
      const t = text(x.o);
      let w = 0;
      /* Kosten aus dem Hinweis lesen - das ist genau die Information,
         die auch ein Spieler vor dem Klick sieht. */
      const m = t.match(/-\$([\d.,]+)([km]?)/);
      if (m) {
        let v = parseFloat(m[1].replace(/,/g, ''));
        if (m[2] === 'k') v *= 1000; else if (m[2] === 'm') v *= 1e6;
        w -= (v / Math.max(4000, st.cash)) * (knapp ? 110 : 45);
      }
      if (/\+\$/.test(t)) w += 28;
      if (/loyalty up|reputation up|influence/.test(t)) w += 22;
      if (/heat down|heat -/.test(t)) w += st.heat > 50 ? 42 : 12;
      if (/permanent|for good/.test(t)) w += 34;
      if (/relations? (up|improve)/.test(t)) w += 14;
      if (/free\./.test(t)) w += knapp ? 26 : 4;
      if (/uncertain|gambl|might|risky/.test(t)) w -= 16;
      if (/sell it/.test(t)) w -= 22;
      if (/walk away|not now|decline|nothing/.test(t)) w += knapp ? 16 : -6;
      if (/refuse/.test(t)) w -= 12;
      if (w > besterWert) { besterWert = w; beste = x; }
    }
    const titel = ev.title, label = beste.o.label;
    act('choose', { i: String(beste.i) });
    return { title: titel, choice: label };
  }

  window.__BOT = {
    log,
    /* Ein Tag: erst handeln, dann Zeit vergehen lassen. Genau die
       Reihenfolge, in der ein Spieler arbeitet. */
    tag(planTag) {
      const vorher = s().cash;
      if (s().event) answerEvent();
      if (planTag) { doCrew(); doBuild(); doOps(); }
      closeAll();
      window.CRIME.tickDay();
      const ent = s().event ? answerEvent() : null;
      closeAll();
      return { ent, cashDelta: s().cash - vorher };
    },
    woche() { return CE.util.weekOf(s().day); },
    schnappschuss() {
      const st = s(), d = St.derive(st);
      const rivalInfl = {};
      let rivalSum = 0;
      st.rivals.forEach(r => { const t = CE.rivals.totalInfl(r); rivalInfl[r.id] = Math.round(t); rivalSum += t; });
      let kontrolliert = 0, offen = 0;
      for (const k in st.districts) { if (st.districts[k].open) offen++; if (st.districts[k].mine >= 60) kontrolliert++; }
      return {
        woche: CE.util.weekOf(st.day), tag: st.day, cash: Math.round(st.cash),
        worth: Math.round(d.netWorth), net: Math.round(d.net), brutto: Math.round(d.grossIncome),
        kosten: Math.round(d.expenses), biz: st.businesses.length, crew: st.crew.length - 1,
        crewCap: d.crewCap, heat: Math.round(st.heat), rep: Math.round(st.rep),
        infl: Math.round(d.totalInfluence), rang: d.rankName, rangIdx: d.rank,
        noto: d.noto || d.notoriety, bezirke: offen, kontrolliert,
        rivalInfl, rivalSum: Math.round(rivalSum),
        waesche: Math.round(d.launderCap), dreck: Math.round(d.dirtyGross),
        waescheVerlust: Math.round(d.launderLoss),
        erfolge: CE.progress.earned(st).length,
        ops: st.stats.opsRun, opsWon: st.stats.opsWon,
        razzien: st.stats.raids, strafen: st.stats.fines,
        buendnisse: st.rivals.filter(r => r.allied).length,
        gewonnen: !!st.flags.won,
        relationen: st.rivals.map(r => Math.round(r.relation))
      };
    },
    doCrew, doBuild, doOps, doRivals, answerEvent, closeAll
  };
  return true;
}

/* --------------------------------------------------------- Lauf */

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CRIME, null, { timeout: 20000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: DIR + '/00-hauptmenue.png' });

  /* Neues Spiel wie ein Mensch: ueber das Menue und das Formular. */
  await page.click('[data-menu="new"]');
  await page.waitForSelector('#modal:not([hidden])');
  await page.fill('#ngName', 'Sal Moretti');
  await page.click('#ngDiff [data-diff="normal"]');
  await page.click('[data-act="__startNew"]');
  await page.waitForSelector('#game:not([hidden])');
  await page.waitForTimeout(400);
  await page.screenshot({ path: DIR + '/01-start-tag0.png' });

  await page.evaluate(policySource);

  const verlauf = [];
  const entscheidungen = [];
  const meilensteine = {};
  const probleme = [];
  let letzterSchnapp = null;

  async function fotoserie(tag, schirme) {
    for (const [nr, schirm] of schirme) {
      await page.evaluate(s => { window.CRIME.go(s); window.CRIME.paint(); }, schirm);
      await page.waitForTimeout(340);
      await page.screenshot({ path: DIR + '/' + nr + '-' + tag + '-' + schirm + '.png' });
    }
  }

  const GESAMT = WEEKS * 7;
  for (let t = 0; t < GESAMT; t++) {
    const r = await page.evaluate((planTag) => window.__BOT.tag(planTag), t % 2 === 0);
    if (r.ent && r.ent.stuck) probleme.push('Tag ' + t + ': Ereignis "' + r.ent.stuck + '" hatte keine offene Antwort (Softlock)');
    else if (r.ent) entscheidungen.push(r.ent);

    /* Rivalenpolitik einmal pro Woche. */
    if (t % 7 === 3) await page.evaluate(() => window.__BOT.doRivals());

    if (t % 7 === 6) {
      const snap = await page.evaluate(() => window.__BOT.schnappschuss());
      verlauf.push(snap);
      letzterSchnapp = snap;

      /* Meilensteine abpassen. */
      if (!meilensteine.early && snap.biz >= 1) {
        meilensteine.early = snap;
        await fotoserie('early', [['10', 'overview'], ['11', 'city'], ['12', 'business'], ['13', 'crew']]);
      }
      if (!meilensteine.mid && (snap.rangIdx >= 3 || snap.bezirke >= 3)) {
        meilensteine.mid = snap;
        await fotoserie('mid', [['20', 'overview'], ['21', 'city'], ['22', 'business'], ['23', 'crew'], ['24', 'finance'], ['25', 'rivals']]);
      }
      if (!meilensteine.late && snap.rangIdx >= 4) {
        meilensteine.late = snap;
        await fotoserie('late', [['30', 'overview'], ['31', 'city'], ['32', 'business'], ['33', 'org'], ['34', 'finance'], ['35', 'rivals']]);
      }
      if (!meilensteine.endgame && (snap.rangIdx >= 5 && (snap.gewonnen || snap.kontrolliert >= 4))) {
        meilensteine.endgame = snap;
        await fotoserie('endgame', [['40', 'overview'], ['41', 'city'], ['42', 'business'], ['43', 'crew'], ['44', 'org'], ['45', 'rivals'], ['46', 'finance'], ['47', 'awards'], ['48', 'log']]);
      }

      /* Speichern und Laden mitten im Lauf pruefen. */
      if (snap.woche === 30 || snap.woche === 70) {
        const sp = await page.evaluate((slot) => {
          const vor = window.CRIME.state();
          const abbild = { cash: vor.cash, day: vor.day, biz: vor.businesses.length, crew: vor.crew.length, rng: vor.rngState, heat: Math.round(vor.heat) };
          window.CE.save.save(vor, slot, 'partie');
          const zurueck = window.CE.save.load(slot);
          if (!zurueck.ok) return { ok: false, why: zurueck.why };
          const n = zurueck.state;
          return {
            ok: true, gleich: n.cash === abbild.cash && n.day === abbild.day &&
              n.businesses.length === abbild.biz && n.crew.length === abbild.crew &&
              n.rngState === abbild.rng,
            ereignisMit: !!n.event, abbild
          };
        }, snap.woche === 30 ? '1' : '2');
        if (!sp.ok) probleme.push('Woche ' + snap.woche + ': Speichern fehlgeschlagen - ' + sp.why);
        else {
          if (!sp.gleich) probleme.push('Woche ' + snap.woche + ': Spielstand nach dem Laden nicht identisch');
          if (sp.ereignisMit) probleme.push('Woche ' + snap.woche + ': offenes Ereignis wurde mitgespeichert');
        }
      }

      /* Buchhaltung: stimmt die Wochenabrechnung? */
      const buch = await page.evaluate(() => {
        const st = window.CRIME.state();
        if (!st.ledger.length) return null;
        const L = st.ledger[0];
        const summe = L.book.reduce((a, b) => a + b.amount, 0);
        return { woche: L.week, drift: Math.abs((L.cashBefore + summe) - L.cashAfter), zeilen: L.book.length };
      });
      if (buch && buch.drift > 3) probleme.push('Woche ' + buch.woche + ': Buchung geht um ' + buch.drift.toFixed(2) + ' nicht auf');
      if (buch && buch.zeilen === 0) probleme.push('Woche ' + buch.woche + ': Wochenabrechnung ohne eine einzige Zeile');

      const zahlen = await page.evaluate(() => {
        const st = window.CRIME.state(), d = window.CE.state.derive(st);
        const schlecht = [];
        for (const k of ['net', 'grossIncome', 'expenses', 'netWorth', 'strength', 'notoriety'])
          if (!isFinite(d[k])) schlecht.push('derive.' + k + '=' + d[k]);
        if (!isFinite(st.cash)) schlecht.push('cash=' + st.cash);
        if (st.rep < 0 || st.rep > 100) schlecht.push('rep=' + st.rep);
        if (st.heat < 0 || st.heat > 100) schlecht.push('heat=' + st.heat);
        return schlecht;
      });
      zahlen.forEach(z => probleme.push('Woche ' + snap.woche + ': ' + z));
    }

    /* Abbruch, wenn die Stadt erobert und noch 12 Wochen gespielt ist. */
    if (meilensteine.endgame && letzterSchnapp && letzterSchnapp.woche > meilensteine.endgame.woche + 24) break;
  }

  /* Falls ein Meilenstein nie erreicht wurde, wenigstens den Endstand. */
  if (!meilensteine.endgame) await fotoserie('endstand', [['40', 'overview'], ['41', 'city'], ['46', 'finance'], ['47', 'awards']]);

  const botLog = await page.evaluate(() => window.__BOT.log);
  if (fehler.length) probleme.push(...fehler.slice(0, 6).map(f => 'Browser: ' + f));

  const bericht = { verlauf, meilensteine, entscheidungen, probleme, botLog, fehler };
  fs.writeFileSync(path.join(DIR, 'bericht.json'), JSON.stringify(bericht, null, 1));

  /* ------------------------------------------------ Ausgabe */
  console.log('CRIME EMPIRE - vollstaendige Partie\n');
  console.log('Woche  Bargeld     Vermoegen   Netto/W    Betr Crew Bez Kon  Hitze Ruf  Einfl Rivalen  Rang');
  for (const m of verlauf) {
    if (m.woche % 4 !== 0 && m.woche !== 1) continue;
    console.log(
      String(m.woche).padStart(5) + '  ' + fmt(m.cash).padStart(10) + '  ' + fmt(m.worth).padStart(10) + '  ' +
      fmt(m.net).padStart(9) + '  ' + String(m.biz).padStart(4) + ' ' + String(m.crew).padStart(4) + ' ' +
      String(m.bezirke).padStart(3) + ' ' + String(m.kontrolliert).padStart(3) + '  ' +
      String(m.heat).padStart(5) + ' ' + String(m.rep).padStart(3) + '  ' + String(m.infl).padStart(5) +
      ' ' + String(m.rivalSum).padStart(7) + '  ' + m.rang);
  }
  console.log('\nMeilensteine:');
  for (const k of ['early', 'mid', 'late', 'endgame']) {
    const m = meilensteine[k];
    console.log('  ' + k.padEnd(9) + (m ? 'Woche ' + String(m.woche).padStart(3) + '  ' + m.rang + ', ' + m.biz + ' Betriebe, ' + fmt(m.worth) : 'nicht erreicht'));
  }
  const letzte = verlauf[verlauf.length - 1];
  if (letzte) {
    console.log('\nEndstand Woche ' + letzte.woche + ': ' + letzte.rang + ', ' + fmt(letzte.worth) +
      ', ' + letzte.biz + ' Betriebe, ' + letzte.crew + ' Leute, ' + letzte.kontrolliert + '/6 Bezirke kontrolliert');
    console.log('Auftraege ' + letzte.opsWon + '/' + letzte.ops + '  Erfolge ' + letzte.erfolge + '/14  Razzien ' +
      letzte.razzien + '  Strafen ' + letzte.strafen + '  Buendnisse ' + letzte.buendnisse + '  Sieg: ' + (letzte.gewonnen ? 'ja' : 'nein'));
  }
  console.log('\nEntscheidungen getroffen: ' + entscheidungen.length);
  const arten = {};
  entscheidungen.forEach(e => { arten[e.title] = (arten[e.title] || 0) + 1; });
  Object.entries(arten).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('  ' + String(n).padStart(3) + 'x  ' + t));
  console.log('\nProbleme: ' + (probleme.length ? '' : 'keine'));
  probleme.slice(0, 25).forEach(p => console.log('  - ' + p));
  console.log('\nBilder in ' + DIR + ', Rohdaten in ' + path.join(DIR, 'bericht.json'));

  await browser.close();
  function fmt(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
})().catch(e => { console.error(e); process.exit(1); });
