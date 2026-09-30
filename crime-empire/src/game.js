/* ---------------------------------------------------------------------
   Die Steuerung: Zeit, Klicks, Fenster, Spielstaende.

   Alle Klicks laufen ueber eine einzige Weiche (data-act). Das hat einen
   handfesten Grund: so laesst sich pruefen, dass kein Knopf ins Leere
   zeigt - tools/klicktest.js klickt jeden data-act im Spiel durch und
   faellt bei einem unbekannten Namen.

   Zeit ist immer anhaltbar. Der Takt liegt bei 2,0 s je Tag, ein
   Ereignisfenster haelt ihn an.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE;
  var U = CE.util, D = CE.data, St = CE.state, UI = CE.ui, A = CE.art;

  var SPEEDS = [0, 2000, 900, 380];      /* Millisekunden je Tag */

  var G = {
    state: null,
    derived: null,
    screen: 'overview',
    settings: CE.save.settings(),
    skyline: null,
    acc: 0,
    last: 0,
    raf: 0,
    dirty: true,
    lastAuto: 0
  };

  function $(id) { return document.getElementById(id); }
  function el(sel2, r) { return (r || document).querySelector(sel2); }

  /* ------------------------------------------------------- Meldungen */

  /* ------------------------------------------------------ Meldungen

     Drei Wege, je nach Gewicht:

       toast()   Beilaeufiges. Klein, rechts unten, verschwindet schnell,
                 und gleichartige Meldungen derselben Sekunde werden zu
                 einer zusammengezogen ("3x Auftrag abgeschlossen").
       banner()  Was den Spieler wirklich angeht - Rangaufstieg, Razzia,
                 eine neue Phase der Ermittlung. Mittig oben, gross.
       Protokoll Alles landet ohnehin unter "Events".

     Vorher war alles ein Toast, vier Stueck gleichzeitig, rechts ueber
     dem Inhalt. Auf jedem Bildschirmfoto verdeckten sie die halbe
     Uebersicht - und Wichtiges sah aus wie Beilaeufiges.
  */
  var toastVerlauf = [];

  function toast(text, kind, big) {
    if (big) { banner(text, kind); return; }
    var box = $('toasts');
    kind = kind || 'good';

    /* Zusammenfassen: dieselbe Art innerhalb von 1,5 Sekunden wird
       gezaehlt statt gestapelt. */
    var jetzt = Date.now();
    for (var i = toastVerlauf.length - 1; i >= 0; i--) {
      var v = toastVerlauf[i];
      if (jetzt - v.zeit > 1500 || !v.el.parentNode) { toastVerlauf.splice(i, 1); continue; }
      if (v.kind === kind && v.text === text) {
        v.n++;
        v.zeit = jetzt;
        v.el.querySelector('.toast__body').innerHTML = UI.helpers.e(text);
        var z = v.el.querySelector('.toast__n');
        if (!z) {
          z = document.createElement('span');
          z.className = 'toast__n';
          v.el.insertBefore(z, v.el.firstChild);
        }
        z.textContent = v.n + '\u00d7';
        return;
      }
    }

    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var t = document.createElement('div');
    t.className = 'toast toast--' + kind;
    t.innerHTML = '<span class="toast__body">' + UI.helpers.e(text) + '</span>';
    box.appendChild(t);
    toastVerlauf.push({ el: t, kind: kind, text: text, n: 1, zeit: jetzt });

    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, 2800);
    if (kind === 'bad') sfx('bad');
  }

  /* Banner: hoechstens zwei, damit sie sich nicht selbst im Weg stehen. */
  function banner(text, kind, titel, ico) {
    var box = $('banners');
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    var cls = kind === 'bad' ? ' banner--bad' : (kind === 'warn' ? ' banner--warn' : '');
    var b = document.createElement('div');
    b.className = 'banner' + cls;
    b.innerHTML = '<span class="banner__ico">' +
      A.icon(ico || (kind === 'bad' ? 'warn' : kind === 'warn' ? 'bell' : 'rank')) + '</span>' +
      '<span><span class="banner__t">' + UI.helpers.e(titel || standardTitel(kind)) + '</span>' +
      '<span class="banner__s">' + UI.helpers.e(text) + '</span></span>';
    box.appendChild(b);
    setTimeout(function () {
      b.classList.add('out');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300);
    }, 4200);
    sfx(kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'rank');
  }

  function standardTitel(kind) {
    return kind === 'bad' ? 'Bad news' : kind === 'warn' ? 'Take notice' : 'Milestone';
  }

  function sfx(name) { if (G.settings.sound) CE.audio.play(name); }

  /* --------------------------------------------------------- Fenster */

  function modal(title, body, foot) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    $('modalFoot').innerHTML = foot || '<button type="button" class="btn" data-close="1">Close</button>';
    $('modal').hidden = false;
    sfx('open');
  }
  function closeModal() {
    $('modal').hidden = true;
    $('report').hidden = true;
    sfx('close');
  }

  /* ------------------------------------------------------ Zeitsteuerung */

  function setSpeed(n) {
    if (!G.state) return;
    G.state.speed = n;
    var btns = document.querySelectorAll('.sbtn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-on', +btns[i].getAttribute('data-speed') === n);
    }
    $('ticker').classList.toggle('is-paused', n === 0);
    G.acc = 0;
  }

  function loop(now) {
    G.raf = requestAnimationFrame(loop);
    var dt = G.last ? Math.min(250, now - G.last) : 16;
    G.last = now;
    if (!G.state) return;

    G.state.played += dt;

    if (G.state.speed > 0 && !G.state.event) {
      G.acc += dt;
      var step = SPEEDS[G.state.speed];
      while (G.acc >= step) {
        G.acc -= step;
        tickDay();
        if (G.state.event || G.state.speed === 0) { G.acc = 0; break; }
      }
    }
    if (G.dirty) { G.dirty = false; paint(); }
  }

  function tickDay() {
    var s = G.state;
    var res = CE.sim.advanceDay(s);
    if (res.blocked) return;

    for (var i = 0; i < res.report.length; i++) {
      var r = res.report[i];
      /* Was das Spiel veraendert, bekommt ein Banner. Was nur passiert,
         bekommt eine Meldung. Der Unterschied war vorher keiner. */
      if (r.t === 'rank') banner(r.text, 'good', 'Promotion', 'rank');
      else if (r.ach) banner(r.text.replace(/^Achievement unlocked: /, ''), 'good', 'Achievement', 'trophy');
      else if (r.banner) banner(r.text, r.t === 'bad' ? 'bad' : 'warn', r.banner, r.ico);
      else if (r.t === 'bad') toast(r.text, 'bad');
      else if (r.t === 'warn') toast(r.text, 'warn');
      else if (r.t === 'good') toast(r.text, 'good');
    }
    if (res.progress && res.progress.victory) victory();
    if (s._banner) { banner(s._banner.text, s._banner.kind, s._banner.title, s._banner.ico); s._banner = null; }

    if (res.weekly) {
      sfx('week');
      /* Bei hoher Geschwindigkeit kein Fenster: alle 2,7 Sekunden eine
         Abrechnung aufzuschlagen, waehrend die Zeit dahinter weiterlaeuft,
         macht das Vorspulen unbrauchbar. Dann genuegt eine Meldung - die
         vollstaendige Abrechnung steht unter Finanzen. */
      if (s.speed >= 2) {
        var L = res.weekly;
        toast('Week ' + L.week + ': ' + U.moneySigned(L.net) + ', cash ' + U.money(L.cashAfter),
          L.net >= 0 ? 'good' : 'bad');
      } else {
        showWeekly(res.weekly);
      }
      if (G.settings.autosave) {
        CE.save.save(s, 'auto', 'Autosave');
        G.lastAuto = s.day;
      }
    }
    if (s.event) { showEvent(); sfx('event'); }
    G.dirty = true;
  }

  /* ------------------------------------------------------ Darstellung */

  function paint() {
    var s = G.state;
    if (!s) return;
    G.derived = St.derive(s);
    var d = G.derived;

    /* Kopfleiste */
    $('dateLabel').textContent = U.dateLabel(s.day);
    $('weekLabel').textContent = 'Week ' + U.weekOf(s.day) + ' · Day ' + s.day;
    $('resStrip').innerHTML = resStrip(s, d);

    /* Navigation */
    $('nav').innerHTML = navHtml(s, d);

    /* Bildschirm. Die Scrollposition wird gerettet: jeder Klick baut die
       Ansicht neu auf, und ohne das springt man beim Auswaehlen einer
       Mannschaft weit unten auf der Stadtseite wieder nach ganz oben. */
    var view = $('view');
    var keepScroll = G.resetScroll ? 0 : view.scrollTop;
    G.resetScroll = false;
    view.innerHTML = UI.render(G.screen, s, d);
    view.scrollTop = keepScroll;
    UI.paintCharts(view, s, d);

    /* Laufband */
    var last = s.log[0];
    $('ticker').innerHTML = '<span class="ticker__dot"></span>' +
      (s.speed === 0 ? '<b>PAUSED</b> &middot; ' : '') +
      (last ? UI.helpers.e(last.text) : 'Blackhaven is quiet.') +
      (s.ops.length ? ' <span class="muted">&middot; ' + s.ops.length + ' operation' +
        (s.ops.length === 1 ? '' : 's') + ' running</span>' : '') +
      '<span class="ticker__more">full log &rarr;</span>';
  }

  function resStrip(s, d) {
    function chip(cls, ico, value, label, delta) {
      return '<div class="chip ' + cls + '">' + A.icon(ico, 'chip__ico') +
        '<div class="chip__txt"><span class="chip__v">' + value + '</span>' +
        '<span class="chip__l">' + label + (delta ? ' <span class="chip__delta ' +
          (delta.indexOf('-') === 0 ? 'down' : 'up') + '">' + delta + '</span>' : '') + '</span></div></div>';
    }
    var band = St.heatBand(s.heat);
    return chip('chip--cash', 'cash', U.money(s.cash), 'Cash', U.moneySigned(Math.round(d.net))) +
      chip('', 'rep', Math.floor(s.rep), 'Reputation') +
      chip('chip--heat' + (s.heat >= 55 ? ' is-hot' : ''), 'heat', Math.round(s.heat), band.name) +
      chip('', 'influence', Math.round(d.totalInfluence), 'Influence') +
      chip('chip--fear' + (d.fear >= 40 ? ' is-hot' : ''), 'enforcer',
        Math.round(d.fear), d.fearLevel ? d.fearLevel.name : 'Fear') +
      chip('chip--strength', 'strength', d.strength, 'Strength') +
      chip('chip--rank', 'rank', d.rankName, 'Rank');
  }

  function navHtml(s, d) {
    var h = [];
    UI.SCREENS.forEach(function (sc) {
      var badge = '';
      if (sc.id === 'log' && s.event) badge = '<span class="pill">!</span>';
      if (sc.id === 'city') {
        var n = CE.ops.allOffers(s).length;
        if (n) badge = '<span class="pill pill--q">' + n + '</span>';
      }
      if (sc.id === 'crew') {
        var risk = s.crew.filter(function (c) { return !c.player && c.loyalty < 30; }).length;
        if (risk) badge = '<span class="pill">' + risk + '</span>';
      }
      if (sc.id === 'awards') {
        var got = CE.progress.earned(s).length;
        badge = '<span class="pill pill--q">' + got + '</span>';
      }
      h.push('<button type="button" class="navbtn' + (G.screen === sc.id ? ' is-on' : '') +
        '" data-act="go" data-screen="' + sc.id + '">' + A.icon(sc.icon) +
        '<span>' + sc.name + '</span>' + badge + '</button>');
    });
    h.push('<div class="nav__gap"></div>');
    h.push('<button type="button" class="navbtn" data-act="saveDialog">' + A.icon('check') + '<span>Save game</span></button>');
    h.push('<button type="button" class="navbtn" data-act="settings">' + A.icon('org') + '<span>Settings</span></button>');
    h.push('<div class="nav__note">Autosave ' + (G.settings.autosave ? 'on' : 'off') +
      '. <br>Space pauses, N advances a day.</div>');
    return h.join('');
  }

  function go(screen) {
    var changed = G.screen !== screen;
    G.screen = screen;
    G.dirty = true;
    sfx('tap');
    /* Nur beim echten Wechsel nach oben - sonst wuerde jeder Klick auf
       den schon offenen Bildschirm die Ansicht zuruecksetzen. */
    if (changed) { $('view').scrollTop = 0; G.resetScroll = true; }
  }

  /* --------------------------------------------------- Ereignisfenster */

  function showEvent() {
    var ev = G.state.event;
    if (!ev) return;
    $('evTone').className = 'event__tone ' + (ev.tone || '');
    $('evKicker').textContent = ev.tone === 'heat' ? 'POLICE' : ev.tone === 'rival' ? 'RIVALS'
      : ev.tone === 'crew' ? 'YOUR PEOPLE' : 'OPPORTUNITY';
    $('evTitle').textContent = ev.title;
    $('evText').textContent = ev.text;
    var h = [];
    ev.options.forEach(function (o, i) {
      h.push('<button type="button" class="opt" data-act="choose" data-i="' + i + '"' +
        (o.disabled ? ' disabled' : '') + (o.disabled && o.why ? ' title="' + UI.helpers.e(o.why) + '"' : '') + '>' +
        '<span class="opt__k">' + (i + 1) + '</span>' +
        '<span class="opt__l">' + UI.helpers.e(o.label) + '</span>' +
        '<span class="opt__h">' + UI.helpers.e(o.disabled ? (o.why || 'Not possible') : (o.hint || '')) + '</span></button>');
    });
    $('evOpts').innerHTML = h.join('');
    $('event').hidden = false;
  }

  function choose(i) {
    var res = CE.sim.choose(G.state, i);
    $('event').hidden = true;
    if (res) {
      toast(res.text, 'good');
      sfx('tap');
      if (res.progress) {
        for (var k = 0; k < res.progress.achievements.length; k++) {
          banner(res.progress.achievements[k].name, 'good', 'Achievement', 'trophy');
        }
        if (res.progress.victory) victory();
      }
    }
    G.dirty = true;
  }

  /* -------------------------------------------------- Wochenbericht */

  function showWeekly(L) {
    var s = G.state, d = St.derive(s);
    var h = [];
    h.push('<div class="grid grid--4" style="margin-bottom:16px">' +
      '<div class="card card--flat">' + UI.helpers.statBox('Income', U.money(L.income), '', 'green') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Expenses', U.money(L.expense), '', 'red') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Net', U.moneySigned(L.net), '', L.net >= 0 ? 'green' : 'red') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Cash', U.money(L.cashAfter), '', 'gold') + '</div></div>');

    h.push('<table class="ledger"><thead><tr><th>Item</th><th class="r">Amount</th></tr></thead><tbody>');
    L.book.forEach(function (line) {
      h.push('<tr><td>' + UI.helpers.e(line.label) +
        (line.note ? '<div class="note">' + UI.helpers.e(line.note) + '</div>' : '') + '</td>' +
        '<td class="r ' + (line.amount > 0 ? 'green' : (line.kind === 'bad' ? 'red' : 'muted')) + '">' +
        (line.amount === 0 ? '&mdash;' : U.moneySigned(line.amount)) + '</td></tr>');
    });
    h.push('<tr class="sum"><td>Net for the week</td><td class="r ' + (L.net >= 0 ? 'green' : 'red') + '">' +
      U.moneySigned(L.net) + '</td></tr></tbody></table>');

    var bits = [];
    bits.push('Heat ' + (L.heatDelta >= 0 ? '+' : '') + L.heatDelta.toFixed(1) + ' &rarr; <b>' + L.heat + '</b>');
    bits.push('Reputation <b>' + L.rep + '</b>');
    if (L.influence.length) {
      bits.push('Influence: ' + L.influence.map(function (x) {
        return D.byId(D.DISTRICTS, x.id).name + ' ' + (x.delta >= 0 ? '+' : '') + x.delta.toFixed(1);
      }).join(', '));
    }
    h.push('<div class="why" style="margin-top:14px;font-size:.8rem">' + bits.join(' &nbsp;&middot;&nbsp; ') + '</div>');

    $('repTitle').textContent = 'Week ' + L.week + ' statement';
    $('repBody').innerHTML = h.join('');
    $('report').hidden = false;
  }

  function victory() {
    setSpeed(0);
    sfx('rank');
    modal('Blackhaven Is Yours',
      '<div class="win"><div class="win__crown">&#9819;</div>' +
      '<h3>Citywide Empire</h3>' +
      '<p style="color:var(--ink2);line-height:1.6;max-width:44ch;margin:0 auto">' +
      'Six districts, majority control in every one of them, and a name nobody says out loud ' +
      'in the wrong room. You came here with ' + U.money(3500) + ' and a rented mattress.</p>' +
      '<div class="money-grid" style="margin-top:20px">' +
      UI.helpers.statBox('Weeks taken', U.weekOf(G.state.day)) +
      UI.helpers.statBox('Net worth', U.money(St.derive(G.state).netWorth), '', 'gold') +
      UI.helpers.statBox('Businesses', G.state.businesses.length) + '</div></div>',
      '<button type="button" class="btn btn--primary" data-close="1">Keep playing</button>');
  }

  /* ============================================== Aktionen (data-act)

     Eine Tabelle, ein Eintrag je Knopf. Wer hier nichts findet, hat
     einen toten Knopf gebaut - und der Klicktest sagt es.
  */
  var ACTIONS = {

    go: function (p) { go(p.screen); if (p.district) UI.sel.district = p.district; },

    filter: function (p) { UI.sel[p.group] = p.value; G.dirty = true; sfx('click'); },

    district: function (p) { UI.sel.district = p.id; G.dirty = true; sfx('click'); },

    /* --- Stadt ---------------------------------------------------- */
    openDistrict: function (p) {
      var pre = CE.empire.canOpenDistrict(G.state, p.id);
      if (!pre.ok) return toast(pre.why, 'bad');
      bigSpend(pre.cost, 'a foothold in ' + D.byId(D.DISTRICTS, p.id).name, function () {
      var r = CE.empire.openDistrict(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var rng = CE.sim.rngOf(G.state);
      CE.ops.refreshOffers(G.state, rng, p.id);
      CE.sim.keepRng(G.state, rng);
      toast('You are established in ' + D.byId(D.DISTRICTS, p.id).name + ' for ' + U.money(r.cost) + '.', 'gold', true);
      sfx('cash');
      G.dirty = true;
      });
    },

    /* --- Auftraege ------------------------------------------------- */
    pickCrew: function (p) {
      var list = UI.sel.opCrew[p.op] || (UI.sel.opCrew[p.op] = []);
      var i = list.indexOf(p.id);
      if (i >= 0) list.splice(i, 1); else list.push(p.id);
      sfx('click');
      G.dirty = true;
    },
    startOp: function (p) {
      var picked = UI.sel.opCrew[p.op] || [];
      var r = CE.ops.start(G.state, p.op, picked);
      if (!r.ok) return toast(r.why, 'bad');
      delete UI.sel.opCrew[p.op];
      toast(r.run.offer.name + ' is under way. ' + (r.run.ends - r.run.started) + ' days.', 'good');
      sfx('tap');
      G.dirty = true;
    },

    /* --- Betriebe --------------------------------------------------- */
    buyBiz: function (p) {
      var can = CE.empire.canBuy(G.state, p.district, p.type);
      if (!can.ok) return toast(can.why, 'bad');
      bigSpend(can.cost, D.byId(D.BUSINESSES, p.type).name, function () {
        var r = CE.empire.buy(G.state, p.district, p.type);
        if (!r.ok) return toast(r.why, 'bad');
        toast('Bought ' + r.biz.name + ' for ' + U.money(r.cost) + '.', 'gold');
        sfx('cash');
        G.dirty = true;
      });
    },
    upgradeBiz: function (p) {
      var r = CE.empire.upgrade(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var b = U.byId(G.state.businesses, p.id);
      toast(b.name + ' is now level ' + r.level + '.', 'gold');
      sfx('cash');
      G.dirty = true;
    },
    sellBiz: function (p) {
      var b = U.byId(G.state.businesses, p.id);
      if (!b) return;
      var price = Math.round(St.bizValue(G.state, b) * 0.68);
      confirmBox('Sell ' + b.name + '?',
        'You will get ' + U.money(price) + ' &mdash; 68% of its value. Anyone posted there will be freed up.',
        function () {
          var r = CE.empire.sell(G.state, p.id);
          closeModal();
          toast('Sold for ' + U.money(r.price) + '.', 'good');
          sfx('cash');
          G.dirty = true;
        });
    },
    bizDetail: function (p) { bizDetail(p.id); },

    /* --- Mannschaft -------------------------------------------------- */
    recruitDialog: function () { recruitDialog(); },
    searchRecruits: function () {
      var cost = 1200;
      if (G.state.cash < cost) return toast('Putting the word out costs ' + U.money(cost) + '.', 'bad');
      G.state.cash -= cost;
      var rng = CE.sim.rngOf(G.state);
      CE.crew.refreshRecruits(G.state, rng);
      CE.sim.keepRng(G.state, rng);
      sfx('tap');
      recruitDialog();
      G.dirty = true;
    },
    hire: function (p) {
      var r = CE.crew.hire(G.state, p.id, p.salary ? +p.salary : undefined);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.crew.name + ' is on the payroll. Signing fee ' + U.money(r.signing) + '.', 'gold');
      sfx('cash');
      recruitDialog();
      G.dirty = true;
    },
    crewDialog: function (p) { crewDialog(p.id); },
    assignDialog: function (p) { assignDialog(p.id); },
    assign: function (p) {
      var r = CE.crew.assign(G.state, p.id, p.biz === 'none' ? null : p.biz);
      if (!r.ok) return toast(r.why, 'bad');
      closeModal();
      sfx('tap');
      G.dirty = true;
    },
    raise: function (p) {
      var c = U.byId(G.state.crew, p.id);
      var r = CE.crew.setSalary(G.state, p.id, +p.to);
      if (!r.ok) return toast(r.why, 'bad');
      toast(c.name + ': ' + U.money(r.from) + ' &rarr; ' + U.money(r.to) + ' a week.', 'good');
      sfx('tap');
      crewDialog(p.id);
      G.dirty = true;
    },
    bonus: function (p) {
      var c = U.byId(G.state.crew, p.id);
      var r = CE.crew.bonus(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(c.name + ' got ' + U.money(r.amount) + '. Loyalty up.', 'good');
      sfx('cash');
      crewDialog(p.id);
      G.dirty = true;
    },
    promote: function (p) {
      var c = U.byId(G.state.crew, p.id);
      var r = CE.crew.promote(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(c.name + ' is now skill ' + r.skill + '.', 'gold');
      sfx('good');
      crewDialog(p.id);
      G.dirty = true;
    },
    fire: function (p) {
      var c = U.byId(G.state.crew, p.id);
      if (!c) return;
      confirmBox('Dismiss ' + c.name + '?',
        'Severance is ' + U.money(c.salary * 2) + '. Everyone else loses a little loyalty watching it happen.',
        function () {
          var r = CE.crew.fire(G.state, p.id);
          closeModal();
          if (!r.ok) return toast(r.why, 'bad');
          toast(c.name + ' is gone. ' + U.money(r.severance) + ' in severance.', 'warn');
          G.dirty = true;
        });
    },

    /* --- Organisation ------------------------------------------------ */
    upgradeOrg: function (p) {
      var r = CE.empire.upgradeOrg(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var up = D.byId(D.ORG_UPGRADES, p.id);
      toast(up.name + ' is at level ' + r.level + '.', 'gold');
      sfx('cash');
      G.dirty = true;
    },
    caseTargeted: function (p) {
      var rng = CE.sim.rngOf(G.state);
      var r = CE.commission.doTargeted(G.state, rng, p.id);
      CE.sim.keepRng(G.state, rng);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'good');
      sfx('tap');
      G.dirty = true;
    },
    caseAction: function (p) {
      var r = CE.commission.doAction(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'good');
      sfx('cash');
      G.dirty = true;
    },
    heatAction: function (p) {
      var r = CE.empire.doHeatAction(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.act.name + ': heat ' + r.act.heat + '.', 'good');
      sfx('tap');
      G.dirty = true;
    },

    /* --- Rivalen ------------------------------------------------------ */
    tribute: function (p) {
      var r = CE.rivals.tribute(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'good');
      sfx('cash');
      G.dirty = true;
    },
    demandTribute: function (p) {
      var rng = CE.sim.rngOf(G.state);
      var r = CE.rivals.demandTribute(G.state, rng, p.id);
      CE.sim.keepRng(G.state, rng);
      if (!r.ok) return toast(r.why, 'bad');
      if (r.win) banner(r.text, 'good', 'Tribute Agreed', 'cash');
      else banner(r.text, 'bad', 'They Refused', 'warn');
      G.dirty = true;
    },
    stopTribute: function (p) {
      var r = CE.rivals.stopTribute(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'good');
      G.dirty = true;
    },
    seizeDialog: function (p) { seizeDialog(p.rival); },
    seize: function (p) {
      var rng = CE.sim.rngOf(G.state);
      var r = CE.rivals.seize(G.state, rng, p.rival, p.district);
      CE.sim.keepRng(G.state, rng);
      if (!r.ok) return toast(r.why, 'bad');
      closeModal();
      banner(r.text, r.win ? 'good' : 'bad', r.win ? 'Taken' : 'It Went Wrong', r.win ? 'building' : 'warn');
      G.dirty = true;
    },
    muscleIn: function (p) {
      var pre = CE.empire.canMuscleIn(G.state, p.id);
      if (!pre.ok) return toast(pre.why, 'bad');
      confirmBox('Force your way into ' + D.byId(D.DISTRICTS, p.id).name + '?',
        'No entry payment. ' + Math.round(pre.odds * 100) + '% chance it holds. Either way: ' +
        '+12 heat, -4 reputation, +15 fear, and every organisation with people there ' +
        'becomes an enemy. The district starts contested.',
        function () {
          var rng = CE.sim.rngOf(G.state);
          var r = CE.empire.muscleIn(G.state, rng, p.id);
          CE.sim.keepRng(G.state, rng);
          closeModal();
          if (!r.ok) return toast(r.why, 'bad');
          banner(r.text, r.win ? 'good' : 'bad', r.win ? 'Forced In' : 'Thrown Back', r.win ? 'map' : 'warn');
          G.dirty = true;
        }, 'Go in');
    },
    negotiate: function (p) {
      var r = CE.rivals.negotiate(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'good');
      sfx('cash');
      G.dirty = true;
    },
    ally: function (p) {
      var r = CE.rivals.ally(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(r.text, 'gold', true);
      sfx('good');
      G.dirty = true;
    },
    breakAlly: function (p) {
      var rd = D.byId(D.RIVALS, p.id);
      confirmBox('Break with ' + rd.name + '?',
        'They will take it personally, and they will remember it for a long time.',
        function () {
          var r = CE.rivals.breakAlly(G.state, p.id);
          closeModal();
          toast(r.text, 'warn');
          G.dirty = true;
        });
    },
    pressureDialog: function (p) { pressureDialog(p.rival, p.district); },
    pressure: function (p) {
      var rng = CE.sim.rngOf(G.state);
      var r = CE.rivals.pressureRival(G.state, rng, p.rival, p.district);
      CE.sim.keepRng(G.state, rng);
      if (!r.ok) return toast(r.why, 'bad');
      closeModal();
      toast(r.text, r.win ? 'good' : 'bad', true);
      G.dirty = true;
    },

    /* --- System -------------------------------------------------------- */
    choose: function (p) { choose(+p.i); },
    showEvent: function () { showEvent(); },
    saveDialog: function () { saveDialog(); },
    settings: function () { settingsDialog(); },
    saveTo: function (p) {
      var r = CE.save.save(G.state, p.slot, 'Week ' + U.weekOf(G.state.day));
      toast(r.ok ? 'Saved to slot ' + p.slot + '.' : r.why, r.ok ? 'good' : 'bad');
      if (!CE.save.available) toast('This browser blocks local storage - the save will not survive a reload.', 'warn');
      saveDialog();
    },
    loadFrom: function (p) {
      var r = CE.save.load(p.slot);
      if (!r.ok) return toast(r.why, 'bad');
      startGame(r.state, true);
      closeModal();
      toast('Loaded: week ' + U.weekOf(r.state.day) + '.', 'good');
    },
    eraseSlot: function (p) {
      confirmBox('Erase slot ' + p.slot + '?', 'This cannot be undone.', function () {
        CE.save.erase(p.slot);
        closeModal();
        saveDialog();
      });
    },
    toggleSetting: function (p) {
      G.settings[p.key] = !G.settings[p.key];
      CE.save.saveSettings(G.settings);
      applySettings();
      settingsDialog();
      G.dirty = true;
    },
    mainMenu: function () {
      confirmBox('Return to the main menu?',
        'Your progress is saved automatically at the end of each week' +
        (G.settings.autosave ? '' : ', but autosave is currently off') + '. Save now to be safe.',
        function () {
          CE.save.save(G.state, 'auto', 'Autosave');
          closeModal();
          toMenu();
        }, 'Save and leave');
    },
    nextDay: function () { if (!G.state.event) { tickDay(); } },
    speed: function (p) { setSpeed(+p.n); G.dirty = true; }
  };

  /* -------------------------------------------------------- Dialoge */

  /* Grosse Ausgaben nachfragen. Die Einstellung dazu gab es von Anfang
     an - sie hing nur an nichts. Ein Kauf, der mehr als ein Viertel des
     Bargelds frisst, kann eine Woche spaeter in die Schulden fuehren;
     einmal nachfragen ist billiger als eine Zwangsversteigerung. */
  function bigSpend(cost, what, onYes) {
    var s = G.state;
    if (!G.settings.confirmBig || cost < s.cash * 0.25 || cost < 5000) { onYes(); return; }
    var after = s.cash - cost;
    var weeks = G.derived && G.derived.net < 0
      ? ' At your current rate you are losing money every week.'
      : '';
    confirmBox('Spend ' + U.money(cost) + '?',
      'That is ' + U.pct(cost / Math.max(1, s.cash)) + ' of your cash on ' + UI.helpers.e(what) +
      '. You would be left with <b>' + U.money(after) + '</b>.' + weeks +
      '<br><br><span class="why">You can turn these prompts off in Settings.</span>',
      function () { closeModal(); onYes(); }, 'Spend it');
  }

  function confirmBox(title, text, onYes, yesLabel) {
    modal(title, '<p style="color:var(--ink2);line-height:1.6;margin:0">' + text + '</p>',
      '<button type="button" class="btn" data-close="1">Cancel</button>' +
      '<button type="button" class="btn btn--primary" data-act="__confirm">' + (yesLabel || 'Confirm') + '</button>');
    ACTIONS.__confirm = function () { onYes(); };
  }

  function bizDetail(id) {
    var s = G.state, b = U.byId(s.businesses, id);
    if (!b) return;
    var def = D.byId(D.BUSINESSES, b.type);
    var f = St.bizFinance(s, b);
    var up = CE.empire.canUpgrade(s, b.id);
    var dist = D.byId(D.DISTRICTS, b.district);

    var rows = [
      ['Base gross', U.money(def.income * D.UPGRADE.income[b.level - 1] * dist.econ), 'level ' + b.level + ' in a ' + Math.round(dist.econ * 100) + '% economy'],
      ['Staff effect', (f.staffBonus >= 0 ? '+' : '') + U.pct(f.staffBonus, 1), f.filled + ' of ' + f.slots + ' positions filled'],
      ['District influence', '+' + U.pct(f.inflBonus, 1), Math.round(s.districts[b.district].mine) + ' influence here'],
      f.boost ? ['Improvements', '+' + U.pct(f.boost), 'from a past decision'] : null,
      f.perkBonus ? ['Synergy', '+' + U.pct(f.perkBonus), 'another business here supports this one'] : null,
      f.understaffed ? ['Empty positions', '-' + U.pct(f.staffPenalty), f.understaffed + ' unfilled'] : null,
      b.damage ? ['Damage', '-' + U.pct(b.damage), 'recovering by 22 points a week'] : null,
      ['Gross this week', U.money(f.gross), ''],
      ['Upkeep', '-' + U.money(f.upkeep), ''],
      ['Net', U.moneySigned(f.net), ''],
      def.heat ? ['Heat generated', '+' + f.heat.toFixed(2) + '/wk', 'police presence here is ' + Math.round(dist.lawEye * 100) + '%'] : null,
      ['Influence generated', '+' + f.infl.toFixed(2) + '/wk', ''],
      def.legal ? ['Laundering capacity', U.money(f.gross * def.launder) + '/wk', 'lets underground money through clean'] : null
    ].filter(Boolean);

    var body = '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      '<div class="biz__ico">' + A.icon(def.icon) + '</div><div><b style="font-size:1.05rem">' +
      UI.helpers.e(b.name) + '</b><div class="row__s">' + UI.helpers.e(dist.name) + ' &middot; level ' + b.level + ' of 5</div></div></div>' +
      '<p class="op__desc" style="margin-bottom:14px">' + UI.helpers.e(def.blurb) + '</p>' +
      '<table class="ledger"><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + r[0] + (r[2] ? '<div class="note">' + r[2] + '</div>' : '') +
          '</td><td class="r">' + r[1] + '</td></tr>';
      }).join('') + '</tbody></table>';

    if (up.ok) {
      var next = b.level;
      body += '<div class="card card--flat" style="margin-top:14px">' +
        '<div class="card__title"><b>Level ' + (b.level + 1) + '</b><span>' + U.money(up.cost) + '</span></div>' +
        '<div class="row__s">Income &times;' + D.UPGRADE.income[next].toFixed(2) + ' (now &times;' +
        D.UPGRADE.income[next - 1].toFixed(2) + '), upkeep &times;' + D.UPGRADE.upkeep[next].toFixed(2) +
        ', ' + (D.UPGRADE.staff[next] > D.UPGRADE.staff[next - 1] ? '+1 position' : 'same positions') + '.</div></div>';
    }

    modal(b.name, body,
      (up.ok ? '<button type="button" class="btn btn--primary" data-act="upgradeBiz" data-id="' + b.id +
        '">Upgrade for ' + U.money(up.cost) + '</button>' : '') +
      '<button type="button" class="btn btn--danger" data-act="sellBiz" data-id="' + b.id + '">Sell</button>' +
      '<button type="button" class="btn" data-close="1">Close</button>');
  }

  function recruitDialog() {
    var s = G.state, d = St.derive(s);
    var paid = s.crew.filter(function (c) { return !c.player; }).length;
    var body = ['<div class="row__s" style="margin-bottom:12px">' + paid + ' of ' + d.crewCap +
      ' positions filled. A new hire costs 1.6 weeks of salary up front.</div>'];

    if (!s.recruits.length) {
      body.push('<div class="empty"><p>Nobody is looking for work right now. New people turn up every week.</p></div>');
    }
    s.recruits.forEach(function (r) {
      var role = D.byId(D.ROLES, r.role);
      var signing = Math.round(r.ask * 1.6);
      var afford = s.cash >= signing && paid < d.crewCap;
      var low = Math.round(r.ask * 0.78 / 10) * 10;
      body.push('<div class="card card--flat" style="margin-bottom:10px">' +
        '<div class="crew__top"><div class="crew__av">' + A.portrait(r.face, 46) + '</div>' +
        '<div class="crew__id"><div class="crew__name">' + UI.helpers.e(r.name) + '</div>' +
        '<div class="crew__role">' + UI.helpers.e(role.name) + '</div>' +
        '<div class="row__s">' + UI.helpers.e(role.desc) + '</div></div>' +
        '<div style="text-align:right"><div class="crew__pay">' + U.money(r.ask) + '/wk</div>' +
        '<div class="row__s">' + U.money(signing) + ' to sign</div></div></div>' +
        '<div class="crew__meters" style="margin-top:10px">' +
        '<div class="meter"><span>Skill</span>' + UI.helpers.bar('bar--c', r.skill / 12) + '<b>' + r.skill + '</b></div>' +
        '<div class="meter"><span>Loyalty</span>' + UI.helpers.bar('bar--g', r.loyalty / 100) + '<b>' + r.loyalty + '</b></div>' +
        '<div class="meter"><span>Ceiling</span>' + UI.helpers.bar('bar--v', r.potential / 12) + '<b>' + r.potential + '</b></div></div>' +
        (r.traits.length ? '<div class="crew__traits" style="margin-top:8px">' + r.traits.map(function (t) {
          var td = D.byId(D.TRAITS, t);
          return '<span class="tag ' + (td.good === true ? 'tag--green' : td.good === false ? 'tag--red' : 'tag--violet') +
            '" title="' + UI.helpers.e(td.desc) + '">' + UI.helpers.e(td.name) + '</span>';
        }).join('') + '</div>' : '') +
        '<div class="crew__acts" style="margin-top:10px">' +
        '<button type="button" class="btn btn--primary btn--sm" data-act="hire" data-id="' + r.id + '"' +
        (afford ? '' : ' disabled title="' + (paid >= d.crewCap ? 'No room in your crew.' : 'Not enough cash.') + '"') +
        '>Hire at ' + U.money(r.ask) + '</button>' +
        '<button type="button" class="btn btn--sm" data-act="hire" data-id="' + r.id + '" data-salary="' + low + '"' +
        (afford ? '' : ' disabled') + ' title="Lower pay costs loyalty, and below 70% of their asking price they walk.">' +
        'Lowball ' + U.money(low) + '</button></div></div>');
    });

    modal('Recruiting', body.join(''),
      '<button type="button" class="btn" data-act="searchRecruits"' +
      (s.cash < 1200 ? ' disabled title="Needs $1,200."' : '') + '>Put the word out &middot; $1,200</button>' +
      '<button type="button" class="btn btn--primary" data-close="1">Done</button>');
  }

  function crewDialog(id) {
    var s = G.state, c = U.byId(s.crew, id);
    if (!c) return;
    var role = D.byId(D.ROLES, c.role);
    var fair = CE.crew.fairSalary(c);
    var eff = St.effectiveSkill(c);
    var toFair = Math.max(c.salary, Math.round(fair / 10) * 10);
    var bonusAmt = c.salary * 4;
    var promoCost = Math.round(fair * 3);

    var body = '<div class="crew__top" style="margin-bottom:14px">' +
      '<div class="crew__av" style="width:64px;height:64px">' + A.portrait(c.face, 64) + '</div>' +
      '<div class="crew__id"><div class="crew__name" style="font-size:1.05rem">' + UI.helpers.e(c.name) + '</div>' +
      '<div class="crew__role">' + UI.helpers.e(role.name) + '</div>' +
      '<div class="row__s">' + UI.helpers.e(role.desc) + '</div>' +
      '<div class="row__s">Joined on day ' + c.hired + (c.raises ? ' &middot; ' + c.raises + ' raise' + (c.raises === 1 ? '' : 's') : '') + '</div>' +
      '</div></div>' +
      '<div class="crew__meters" style="margin-bottom:14px">' +
      '<div class="meter"><span>Skill</span>' + UI.helpers.bar('bar--c', eff / 12) + '<b>' + eff + '/' + c.potential + '</b></div>' +
      '<div class="meter"><span>Loyalty</span>' + UI.helpers.bar(c.loyalty < 30 ? 'bar--r' : 'bar--g', c.loyalty / 100) +
      '<b class="mood-' + (c.mood || 'steady') + '">' + Math.round(c.loyalty) + '</b></div>' +
      '<div class="meter"><span>Experience</span>' + UI.helpers.bar('bar--v', (c.xp % 100) / 100) + '<b>' + c.xp + '</b></div></div>' +
      '<table class="ledger"><tbody>' +
      '<tr><td>Current salary</td><td class="r">' + U.money(c.salary) + '/wk</td></tr>' +
      '<tr><td>Worth at this skill<div class="note">' +
      (c.salary < fair * 0.85 ? 'Underpaid. Loyalty is falling every week.'
        : c.salary > fair * 1.2 ? 'Paid above the rate. Loyalty is climbing.' : 'Fairly paid.') +
      '</div></td><td class="r">' + U.money(fair) + '/wk</td></tr>' +
      '</tbody></table>' +
      (c.traits.length ? '<div class="crew__traits" style="margin-top:12px">' + c.traits.map(function (t) {
        var td = D.byId(D.TRAITS, t);
        return '<span class="tag ' + (td.good === true ? 'tag--green' : td.good === false ? 'tag--red' : 'tag--violet') +
          '">' + UI.helpers.e(td.name) + ' &mdash; ' + UI.helpers.e(td.desc) + '</span>';
      }).join(' ') + '</div>' : '');

    modal(c.name, body,
      '<button type="button" class="btn" data-act="raise" data-id="' + c.id + '" data-to="' + toFair + '"' +
      (toFair <= c.salary ? ' disabled title="Already at or above the rate."' : '') + '>Raise to ' + U.money(toFair) + '</button>' +
      '<button type="button" class="btn" data-act="bonus" data-id="' + c.id + '"' +
      (s.cash < bonusAmt ? ' disabled title="Needs ' + U.money(bonusAmt) + '."' : '') + '>Bonus ' + U.money(bonusAmt) + '</button>' +
      '<button type="button" class="btn btn--primary" data-act="promote" data-id="' + c.id + '"' +
      (s.cash < promoCost || eff >= c.potential ? ' disabled title="' +
        (eff >= c.potential ? 'Nothing left to learn.' : 'Needs ' + U.money(promoCost) + '.') + '"' : '') +
      '>Promote ' + U.money(promoCost) + '</button>' +
      '<button type="button" class="btn btn--danger" data-act="fire" data-id="' + c.id + '">Dismiss</button>');
  }

  function assignDialog(id) {
    var s = G.state, c = U.byId(s.crew, id);
    if (!c) return;
    var body = ['<div class="row__s" style="margin-bottom:12px">Where should ' +
      UI.helpers.e(c.name) + ' work? Posted staff raise that site&rsquo;s income.</div><div class="slots">'];
    body.push('<div class="slotrow' + (!c.post ? '' : '') + '">' +
      '<div class="slotrow__n">&mdash;</div><div class="slotrow__i">' +
      '<div class="slotrow__t">Unassigned</div><div class="slotrow__s">No income, still drawing salary.</div></div>' +
      '<button type="button" class="btn btn--sm" data-act="assign" data-id="' + c.id + '" data-biz="none"' +
      (!c.post ? ' disabled' : '') + '>' + (!c.post ? 'Current' : 'Pull out') + '</button></div>');

    s.businesses.forEach(function (b) {
      var f = St.bizFinance(s, b);
      var full = f.filled >= f.slots && c.post !== b.id;
      var def = D.byId(D.BUSINESSES, b.type);
      body.push('<div class="slotrow">' +
        '<div class="slotrow__n">' + A.icon(def.icon) + '</div><div class="slotrow__i">' +
        '<div class="slotrow__t">' + UI.helpers.e(b.name) + '</div>' +
        '<div class="slotrow__s">' + UI.helpers.e(D.byId(D.DISTRICTS, b.district).name) + ' &middot; ' +
        f.filled + '/' + f.slots + ' staffed &middot; ' + U.money(f.gross) + '/wk</div></div>' +
        '<button type="button" class="btn btn--sm' + (c.post === b.id ? '' : ' btn--primary') +
        '" data-act="assign" data-id="' + c.id + '" data-biz="' + b.id + '"' +
        (full || c.post === b.id ? ' disabled title="' + (c.post === b.id ? 'Already posted here.' : 'No open position.') + '"' : '') +
        '>' + (c.post === b.id ? 'Current' : 'Post here') + '</button></div>');
    });
    if (!s.businesses.length) body.push('<div class="empty"><p>You own no businesses to staff yet.</p></div>');
    body.push('</div>');
    modal('Assign ' + c.name, body.join(''));
  }

  /* Wo man einem Rivalen einen Betrieb abnehmen kann. */
  function seizeDialog(rivalId) {
    var s = G.state;
    var rd = D.byId(D.RIVALS, rivalId);
    var body = ['<div class="row__s" style="margin-bottom:12px">Taking a site outright costs nothing ' +
      'in cash. It arrives damaged, it makes a permanent enemy, and the whole city hears about it.</div><div class="slots">'];
    var any = false;
    D.DISTRICTS.forEach(function (dist) {
      var can = CE.rivals.canSeize(s, rivalId, dist.id);
      var r = U.byId(s.rivals, rivalId);
      if (!can.ok && (r.infl[dist.id] || 0) < 10) return;
      any = true;
      body.push('<div class="slotrow">' +
        '<div class="slotrow__n" style="color:' + rd.color + '">' + A.icon('building') + '</div>' +
        '<div class="slotrow__i"><div class="slotrow__t">' + UI.helpers.e(dist.name) + '</div>' +
        '<div class="slotrow__s">They hold ' + Math.round(r.infl[dist.id] || 0) + ' influence here' +
        (can.ok ? ' &middot; ' + Math.round(can.odds * 100) + '% chance' : '') + '</div></div>' +
        '<button type="button" class="btn btn--sm btn--danger" data-act="seize" data-rival="' + rivalId +
        '" data-district="' + dist.id + '"' + (can.ok ? '' : ' disabled title="' + UI.helpers.e(can.why) + '"') +
        '>Take it</button></div>');
    });
    if (!any) body.push('<div class="empty"><p>They have nothing you can reach.</p></div>');
    body.push('</div>');
    modal('Take from ' + rd.name, body.join(''));
  }

  function pressureDialog(rivalId, districtId) {
    var s = G.state, d = St.derive(s);
    var body = ['<div class="row__s" style="margin-bottom:12px">Pushing a rival out costs money, ' +
      'raises heat and destroys relations. It is the only way to take ground they will not sell.</div><div class="slots">'];
    var any = false;
    s.rivals.forEach(function (r) {
      if (rivalId && r.id !== rivalId) return;
      var rd = D.byId(D.RIVALS, r.id);
      D.DISTRICTS.forEach(function (dist) {
        if (districtId && dist.id !== districtId) return;
        var can = CE.rivals.canPressure(s, r.id, dist.id);
        if (!can.ok && (r.infl[dist.id] || 0) < 3) return;
        any = true;
        body.push('<div class="slotrow">' +
          '<div class="slotrow__n" style="color:' + rd.color + '">' + A.icon('swords') + '</div>' +
          '<div class="slotrow__i"><div class="slotrow__t">' + UI.helpers.e(rd.name) + ' in ' + UI.helpers.e(dist.name) + '</div>' +
          '<div class="slotrow__s">They hold ' + Math.round(r.infl[dist.id] || 0) + ' influence here' +
          (can.ok ? ' &middot; ' + Math.round(can.odds * 100) + '% chance &middot; ' + U.money(can.cost) : '') + '</div></div>' +
          '<button type="button" class="btn btn--sm btn--danger" data-act="pressure" data-rival="' + r.id +
          '" data-district="' + dist.id + '"' + (can.ok ? '' : ' disabled title="' + UI.helpers.e(can.why) + '"') +
          '>Push</button></div>');
      });
    });
    if (!any) body.push('<div class="empty"><p>There is nobody to push here. You need a district of your own where a rival is also established.</p></div>');
    body.push('</div>');
    modal('Pressure', body.join(''));
  }

  function saveDialog() {
    var list = CE.save.list();
    var body = ['<div class="slots">'];
    list.forEach(function (sl) {
      var isAuto = sl.slot === 'auto';
      body.push('<div class="slotrow' + (sl.empty ? ' slotrow--empty' : '') + '">' +
        '<div class="slotrow__n">' + (isAuto ? 'A' : sl.slot) + '</div><div class="slotrow__i">' +
        '<div class="slotrow__t">' + (sl.empty ? (isAuto ? 'No autosave yet' : 'Empty slot')
          : sl.broken ? 'Damaged save'
          : UI.helpers.e(sl.name) + ' &middot; ' + UI.helpers.e(sl.rank)) + '</div>' +
        '<div class="slotrow__s">' + (sl.empty || sl.broken ? (isAuto ? 'Written at the end of each week' : 'Save here to keep a checkpoint')
          : 'Week ' + sl.week + ' &middot; ' + U.money(sl.worth) + ' &middot; ' + sl.businesses + ' businesses &middot; ' +
            new Date(sl.saved).toLocaleString()) + '</div></div>' +
        (isAuto ? '' : '<button type="button" class="btn btn--sm" data-act="saveTo" data-slot="' + sl.slot + '">Save</button>') +
        '<button type="button" class="btn btn--sm btn--primary" data-act="loadFrom" data-slot="' + sl.slot + '"' +
        (sl.empty || sl.broken ? ' disabled' : '') + '>Load</button>' +
        (sl.empty ? '' : '<button type="button" class="btn btn--sm btn--ghost" data-act="eraseSlot" data-slot="' + sl.slot + '" title="Erase">&times;</button>') +
        '</div>');
    });
    body.push('</div>');
    if (!CE.save.available) {
      body.push('<div class="why why--bad" style="margin-top:12px">This browser is blocking local storage. ' +
        'Saves will work for this session only and are lost when the tab closes.</div>');
    }
    modal('Save and load', body.join(''),
      '<button type="button" class="btn btn--danger" data-act="mainMenu">Main menu</button>' +
      '<button type="button" class="btn btn--primary" data-close="1">Close</button>');
  }

  function settingsDialog() {
    function sw(key, title, desc) {
      return '<div class="switch"><div><div class="switch__t">' + title + '</div>' +
        '<div class="switch__d">' + desc + '</div></div>' +
        '<button type="button" class="toggle' + (G.settings[key] ? ' is-on' : '') +
        '" data-act="toggleSetting" data-key="' + key + '" role="switch" aria-checked="' +
        (G.settings[key] ? 'true' : 'false') + '" aria-label="' + title + '"><i></i></button></div>';
    }
    modal('Settings',
      sw('sound', 'Sound effects', 'Short procedural cues. No music, no files.') +
      sw('autosave', 'Autosave', 'Writes to the auto slot at the end of every week.') +
      sw('reduceMotion', 'Reduce motion', 'Stops the animated skyline and shortens transitions.') +
      sw('confirmBig', 'Confirm large spends', 'Asks before anything costing more than a quarter of your cash.') +
      '<div class="why" style="margin-top:14px">Keyboard: <b>Space</b> pause &middot; <b>1 2 3</b> speed &middot; ' +
      '<b>N</b> next day &middot; <b>1-4</b> answer a decision &middot; <b>Esc</b> close.</div>');
  }

  function applySettings() {
    document.body.classList.toggle('calm', !!G.settings.reduceMotion);
    CE.audio.setEnabled(!!G.settings.sound);
    if (G.skyline) {
      G.skyline.still = !!G.settings.reduceMotion;
      if (!G.settings.reduceMotion && !$('menu').hidden) G.skyline.start(false);
    }
  }

  /* ------------------------------------------------- Menue und Start */

  function toMenu() {
    if (G.state) { CE.save.save(G.state, 'auto', 'Autosave'); }
    setSpeed(0);
    $('game').hidden = true;
    $('menu').hidden = false;
    refreshMenu();
    if (G.skyline) G.skyline.start(G.settings.reduceMotion);
  }

  function refreshMenu() {
    var last = CE.save.lastSlot();
    var has = CE.save.hasAny();
    var contBtn = el('[data-menu="continue"]');
    contBtn.disabled = !has;
    if (has) {
      var info = CE.save.load(last || 'auto');
      $('contSub').textContent = info.ok
        ? info.state.name + ' · week ' + U.weekOf(info.state.day) + ' · ' + U.money(info.state.cash)
        : 'Saved game';
    } else {
      $('contSub').textContent = 'No save found';
    }
  }

  function newGameDialog() {
    var body =
      '<div class="field"><label for="ngName">What do they call you?</label>' +
      '<input type="text" id="ngName" maxlength="22" value="" placeholder="Your name" autocomplete="off"></div>' +
      '<div class="field"><label>Difficulty</label><div class="choices" id="ngDiff">' +
      '<button type="button" class="choice" data-diff="easy"><b>Careful</b>' +
      '<small>$6,000 to start, gentler rivals, less heat.</small></button>' +
      '<button type="button" class="choice is-on" data-diff="normal"><b>Standard</b>' +
      '<small>$3,500 to start. The intended experience.</small></button>' +
      '<button type="button" class="choice" data-diff="hard"><b>Ruthless</b>' +
      '<small>$2,500, aggressive rivals, heat builds fast.</small></button>' +
      '</div></div>' +
      '<div class="why">You begin in Old Town with no crew, no businesses and no reputation. ' +
      'Run operations to raise your first few thousand, then buy something that earns while you sleep.</div>';
    modal('New Game', body,
      '<button type="button" class="btn" data-close="1">Cancel</button>' +
      '<button type="button" class="btn btn--primary" data-act="__startNew">Begin</button>');

    var diffs = document.querySelectorAll('#ngDiff .choice');
    for (var i = 0; i < diffs.length; i++) {
      diffs[i].addEventListener('click', function () {
        for (var j = 0; j < diffs.length; j++) diffs[j].classList.remove('is-on');
        this.classList.add('is-on');
      });
    }
    ACTIONS.__startNew = function () {
      var name = ($('ngName').value || '').trim().slice(0, 22) || 'Unknown';
      var picked = el('#ngDiff .choice.is-on');
      var diff = picked ? picked.getAttribute('data-diff') : 'normal';
      var s = St.newGame({ name: name, difficulty: diff });
      CE.sim.bootstrap(s);
      closeModal();
      startGame(s, false);
    };
  }

  function startGame(s, loaded) {
    G.state = s;
    G.screen = 'overview';
    UI.sel.district = 'oldtown';
    UI.sel.opCrew = {};
    $('menu').hidden = true;
    $('game').hidden = false;
    if (G.skyline) G.skyline.stop();
    setSpeed(loaded ? 0 : 0);
    G.dirty = true;
    paint();
    if (s.event) showEvent();
    if (!loaded) {
      setTimeout(function () {
        banner('Old Town is open to you. Press Play when you are ready.', 'good',
      'Blackhaven, ' + U.dateLabel(0), 'map');
      }, 400);
    }
    CE.save.save(s, 'auto', 'Autosave');
  }

  function loadDialog() {
    saveDialog();
  }

  function creditsDialog() {
    modal('Credits',
      '<p style="color:var(--ink2);line-height:1.7;margin:0 0 14px">' +
      '<b>Crime Empire</b> is a management game about building something out of nothing in a city ' +
      'that does not want you to. Blackhaven, its districts, its four families and everyone in them ' +
      'are fictional.</p>' +
      '<table class="ledger"><tbody>' +
      '<tr><td>Design, code, art</td><td class="r">Written for this repository</td></tr>' +
      '<tr><td>Engine</td><td class="r">None &mdash; plain HTML, CSS, JavaScript</td></tr>' +
      '<tr><td>Dependencies</td><td class="r">Zero</td></tr>' +
      '<tr><td>Graphics</td><td class="r">Procedural SVG and Canvas</td></tr>' +
      '<tr><td>Sound</td><td class="r">Procedural Web Audio</td></tr>' +
      '<tr><td>Saves</td><td class="r">localStorage, four slots</td></tr>' +
      '</tbody></table>' +
      '<div class="why" style="margin-top:14px">The underground operations in this game are abstract ' +
      'management systems. Nothing here describes how anything is actually done.</div>');
  }

  /* ---------------------------------------------------------- Klicks */

  function onClick(ev) {
    var closer = ev.target.closest('[data-close]');
    if (closer) { closeModal(); return; }

    var node = ev.target.closest('[data-act]');
    if (node) {
      if (node.disabled) return;
      var act = node.getAttribute('data-act');
      var p = {};
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        if (a.name.indexOf('data-') === 0 && a.name !== 'data-act') p[a.name.slice(5)] = a.value;
      }
      var fn = ACTIONS[act];
      if (!fn) { console.warn('CRIME EMPIRE: no handler for action "' + act + '"'); return; }
      fn(p);
      return;
    }

    var sp = ev.target.closest('.sbtn');
    if (sp) { setSpeed(+sp.getAttribute('data-speed')); G.dirty = true; sfx('click'); return; }

    var mn = ev.target.closest('[data-menu]');
    if (mn) {
      CE.audio.resume();
      sfx('tap');
      var which = mn.getAttribute('data-menu');
      if (which === 'new') newGameDialog();
      else if (which === 'continue') {
        var slot = CE.save.lastSlot() || 'auto';
        var r = CE.save.load(slot);
        if (!r.ok) r = CE.save.load('auto');
        if (r.ok) startGame(r.state, true); else toast('No save to continue.', 'bad');
      } else if (which === 'load') loadDialog();
      else if (which === 'settings') settingsDialog();
      else if (which === 'credits') creditsDialog();
      return;
    }

    if (ev.target.closest('#ticker')) { go('log'); return; }
    if (ev.target.closest('#toMenu')) { ACTIONS.mainMenu({}); return; }
    if (ev.target.closest('#nextDay')) { ACTIONS.nextDay({}); return; }
  }

  function onKey(ev) {
    if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;

    if (!$('event').hidden) {
      var n = parseInt(ev.key, 10);
      if (n >= 1 && n <= 9) {
        var opts = document.querySelectorAll('#evOpts .opt');
        if (opts[n - 1] && !opts[n - 1].disabled) { choose(n - 1); ev.preventDefault(); }
      }
      return;
    }
    if (ev.key === 'Escape') {
      if (!$('modal').hidden || !$('report').hidden) { closeModal(); ev.preventDefault(); }
      return;
    }
    if (!G.state || $('game').hidden) return;

    if (ev.code === 'Space') { setSpeed(G.state.speed === 0 ? 1 : 0); G.dirty = true; ev.preventDefault(); return; }
    if (ev.key === '1') { setSpeed(1); G.dirty = true; return; }
    if (ev.key === '2') { setSpeed(2); G.dirty = true; return; }
    if (ev.key === '3') { setSpeed(3); G.dirty = true; return; }
    if (ev.key === 'n' || ev.key === 'N') { ACTIONS.nextDay({}); return; }
  }

  /* ------------------------------------------------------------ Start */

  function boot() {
    UI.init(G);
    G.settings = CE.save.settings();

    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) G.settings.reduceMotion = true;

    try { G.skyline = new CE.Skyline($('skyline')); G.skyline.start(G.settings.reduceMotion); }
    catch (e) { /* Ohne Canvas bleibt das Menue trotzdem bedienbar. */ }

    applySettings();
    refreshMenu();

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    root.addEventListener('beforeunload', function () {
      if (G.state && G.settings.autosave) CE.save.save(G.state, 'auto', 'Autosave');
    });

    document.body.classList.remove('booting');
    G.raf = requestAnimationFrame(loop);

    /* Schnittstelle fuer die Testwerkzeuge. Kein Spielmechanismus haengt
       daran - sie lesen und stossen nur an, was ein Klick auch tut. */
    root.CRIME = {
      G: G, actions: ACTIONS, startGame: startGame, tickDay: tickDay,
      newGame: function (opts) {
        var s = St.newGame(opts || {});
        CE.sim.bootstrap(s);
        startGame(s, false);
        return s;
      },
      go: go, paint: paint, setSpeed: setSpeed, toMenu: toMenu,
      state: function () { return G.state; }, derived: function () { return St.derive(G.state); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
