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
    return kind === 'bad' ? 'Schlechte Nachricht' : kind === 'warn' ? 'Aufgepasst' : 'Meilenstein';
  }

  function sfx(name) { if (G.settings.sound) CE.audio.play(name); }

  /* --------------------------------------------------------- Fenster */

  function modal(title, body, foot) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    $('modalFoot').innerHTML = foot || '<button type="button" class="btn" data-close="1">Schließen</button>';
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
      if (r.t === 'rank') banner(r.text, 'good', 'Aufstieg', 'rank');
      else if (r.ach) banner(r.text.replace(/^Erfolg freigeschaltet: /, ''), 'good', 'Erfolg', 'trophy');
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
        toast('Woche ' + L.week + ': ' + U.moneySigned(L.net) + ', Bargeld ' + U.money(L.cashAfter),
          L.net >= 0 ? 'good' : 'bad');
      } else {
        showWeekly(res.weekly);
      }
      if (G.settings.autosave) {
        CE.save.save(s, 'auto', 'Autospeicherung');
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
    $('weekLabel').textContent = 'Woche ' + U.weekOf(s.day) + ' · Tag ' + s.day;
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
      (s.speed === 0 ? '<b>PAUSE</b> &middot; ' : '') +
      (last ? UI.helpers.e(last.text) : 'In Blackhaven ist es ruhig.') +
      (s.ops.length ? ' <span class="muted">&middot; ' + s.ops.length + ' Operation' +
        (s.ops.length === 1 ? ' läuft' : 'en laufen') + '</span>' : '') +
      '<span class="ticker__more">volles Protokoll &rarr;</span>';
  }

  function resStrip(s, d) {
    function chip(cls, ico, value, label, delta) {
      return '<div class="chip ' + cls + '">' + A.icon(ico, 'chip__ico') +
        '<div class="chip__txt"><span class="chip__v">' + value + '</span>' +
        '<span class="chip__l">' + label + (delta ? ' <span class="chip__delta ' +
          (delta.indexOf('-') === 0 ? 'down' : 'up') + '">' + delta + '</span>' : '') + '</span></div></div>';
    }
    var band = St.heatBand(s.heat);
    return chip('chip--cash', 'cash', U.money(s.cash), 'Bargeld', U.moneySigned(Math.round(d.net))) +
      chip('', 'rep', Math.floor(s.rep), 'Ansehen') +
      chip('chip--heat' + (s.heat >= 55 ? ' is-hot' : ''), 'heat', Math.round(s.heat), band.name) +
      chip('', 'influence', Math.round(d.totalInfluence), 'Einfluss') +
      chip('chip--fear' + (d.fear >= 40 ? ' is-hot' : ''), 'enforcer',
        Math.round(d.fear), d.fearLevel ? d.fearLevel.name : 'Furcht') +
      chip('chip--strength', 'strength', d.strength, 'Stärke') +
      chip('chip--rank', 'rank', d.rankName, 'Rang');
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
    h.push('<button type="button" class="navbtn" data-act="saveDialog">' + A.icon('check') + '<span>Spiel speichern</span></button>');
    h.push('<button type="button" class="navbtn" data-act="settings">' + A.icon('org') + '<span>Einstellungen</span></button>');
    h.push('<div class="nav__note">Autospeicherung ' + (G.settings.autosave ? 'an' : 'aus') +
      '. <br>Leertaste pausiert, N geht einen Tag weiter.</div>');
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
    $('evKicker').textContent = ev.tone === 'heat' ? 'POLIZEI' : ev.tone === 'rival' ? 'RIVALEN'
      : ev.tone === 'crew' ? 'DEINE LEUTE' : 'GELEGENHEIT';
    $('evTitle').textContent = ev.title;
    $('evText').textContent = ev.text;
    var h = [];
    ev.options.forEach(function (o, i) {
      h.push('<button type="button" class="opt" data-act="choose" data-i="' + i + '"' +
        (o.disabled ? ' disabled' : '') + (o.disabled && o.why ? ' title="' + UI.helpers.e(o.why) + '"' : '') + '>' +
        '<span class="opt__k">' + (i + 1) + '</span>' +
        '<span class="opt__l">' + UI.helpers.e(o.label) + '</span>' +
        '<span class="opt__h">' + UI.helpers.e(o.disabled ? (o.why || 'Nicht möglich') : (o.hint || '')) + '</span></button>');
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
          banner(res.progress.achievements[k].name, 'good', 'Erfolg', 'trophy');
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
      '<div class="card card--flat">' + UI.helpers.statBox('Einnahmen', U.money(L.income), '', 'green') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Ausgaben', U.money(L.expense), '', 'red') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Netto', U.moneySigned(L.net), '', L.net >= 0 ? 'green' : 'red') + '</div>' +
      '<div class="card card--flat">' + UI.helpers.statBox('Bargeld', U.money(L.cashAfter), '', 'gold') + '</div></div>');

    h.push('<table class="ledger"><thead><tr><th>Posten</th><th class="r">Betrag</th></tr></thead><tbody>');
    L.book.forEach(function (line) {
      h.push('<tr><td>' + UI.helpers.e(line.label) +
        (line.note ? '<div class="note">' + UI.helpers.e(line.note) + '</div>' : '') + '</td>' +
        '<td class="r ' + (line.amount > 0 ? 'green' : (line.kind === 'bad' ? 'red' : 'muted')) + '">' +
        (line.amount === 0 ? '&mdash;' : U.moneySigned(line.amount)) + '</td></tr>');
    });
    h.push('<tr class="sum"><td>Netto für die Woche</td><td class="r ' + (L.net >= 0 ? 'green' : 'red') + '">' +
      U.moneySigned(L.net) + '</td></tr></tbody></table>');

    var bits = [];
    bits.push('Hitze ' + (L.heatDelta >= 0 ? '+' : '') + L.heatDelta.toFixed(1) + ' &rarr; <b>' + L.heat + '</b>');
    bits.push('Ansehen <b>' + L.rep + '</b>');
    if (L.influence.length) {
      bits.push('Einfluss: ' + L.influence.map(function (x) {
        return D.byId(D.DISTRICTS, x.id).name + ' ' + (x.delta >= 0 ? '+' : '') + x.delta.toFixed(1);
      }).join(', '));
    }
    h.push('<div class="why" style="margin-top:14px;font-size:.8rem">' + bits.join(' &nbsp;&middot;&nbsp; ') + '</div>');

    $('repTitle').textContent = 'Abrechnung Woche ' + L.week + '';
    $('repBody').innerHTML = h.join('');
    $('report').hidden = false;
  }

  function victory() {
    setSpeed(0);
    sfx('rank');
    modal('Blackhaven gehört dir',
      '<div class="win"><div class="win__crown">&#9819;</div>' +
      '<h3>Stadtweites Imperium</h3>' +
      '<p style="color:var(--ink2);line-height:1.6;max-width:44ch;margin:0 auto">' +
      'Sechs Bezirke, in jedem davon die Mehrheit, und ein Name, den im falschen Raum ' +
      'niemand laut ausspricht. Hierher gekommen bist du mit ' + U.money(3500) + ' und einer gemieteten Matratze.</p>' +
      '<div class="money-grid" style="margin-top:20px">' +
      UI.helpers.statBox('Gebrauchte Wochen', U.weekOf(G.state.day)) +
      UI.helpers.statBox('Vermögen', U.money(St.derive(G.state).netWorth), '', 'gold') +
      UI.helpers.statBox('Betriebe', G.state.businesses.length) + '</div></div>',
      '<button type="button" class="btn btn--primary" data-close="1">Weiterspielen</button>');
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
      bigSpend(pre.cost, 'einen Einstieg ' + D.byId(D.DISTRICTS, p.id).wohin, function () {
      var r = CE.empire.openDistrict(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var rng = CE.sim.rngOf(G.state);
      CE.ops.refreshOffers(G.state, rng, p.id);
      CE.sim.keepRng(G.state, rng);
      toast('Du bist ' + D.byId(D.DISTRICTS, p.id).wo + ', für ' + U.money(r.cost) + '.', 'gold', true);
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
      toast(r.run.offer.name + ' läuft. ' + (r.run.ends - r.run.started) + ' Tage.', 'good');
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
        toast('Gekauft: ' + r.biz.name + ' für ' + U.money(r.cost) + '.', 'gold');
        sfx('cash');
        G.dirty = true;
      });
    },
    upgradeBiz: function (p) {
      var r = CE.empire.upgrade(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var b = U.byId(G.state.businesses, p.id);
      toast(b.name + ' ist jetzt Stufe ' + r.level + '.', 'gold');
      sfx('cash');
      G.dirty = true;
    },
    sellBiz: function (p) {
      var b = U.byId(G.state.businesses, p.id);
      if (!b) return;
      var price = Math.round(St.bizValue(G.state, b) * 0.68);
      confirmBox('Verkaufen: ' + b.name + '?',
        'Du bekommst ' + U.money(price) + ' &mdash; 68% des Werts. Wer dort eingesetzt ist, wird frei.',
        function () {
          var r = CE.empire.sell(G.state, p.id);
          closeModal();
          toast('Verkauft für ' + U.money(r.price) + '.', 'good');
          sfx('cash');
          G.dirty = true;
        });
    },
    bizDetail: function (p) { bizDetail(p.id); },

    /* --- Mannschaft -------------------------------------------------- */
    recruitDialog: function () { recruitDialog(); },
    searchRecruits: function () {
      var cost = 1200;
      if (G.state.cash < cost) return toast('Es herumzusagen kostet ' + U.money(cost) + '.', 'bad');
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
      toast(r.crew.name + ' steht auf der Lohnliste. Antrittszahlung ' + U.money(r.signing) + '.', 'gold');
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
      toast(c.name + ': ' + U.money(r.from) + ' &rarr; ' + U.money(r.to) + ' pro Woche.', 'good');
      sfx('tap');
      crewDialog(p.id);
      G.dirty = true;
    },
    bonus: function (p) {
      var c = U.byId(G.state.crew, p.id);
      var r = CE.crew.bonus(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(c.name + ' got ' + U.money(r.amount) + '. Loyalität steigt.', 'good');
      sfx('cash');
      crewDialog(p.id);
      G.dirty = true;
    },
    promote: function (p) {
      var c = U.byId(G.state.crew, p.id);
      var r = CE.crew.promote(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      toast(c.name + ' hat jetzt Können ' + r.skill + '.', 'gold');
      sfx('good');
      crewDialog(p.id);
      G.dirty = true;
    },
    fire: function (p) {
      var c = U.byId(G.state.crew, p.id);
      if (!c) return;
      confirmBox('Entlassen: ' + c.name + '?',
        'Die Abfindung beträgt ' + U.money(c.salary * 2) + '. Alle anderen verlieren beim Zusehen etwas Loyalität.',
        function () {
          var r = CE.crew.fire(G.state, p.id);
          closeModal();
          if (!r.ok) return toast(r.why, 'bad');
          toast(c.name + ' ist weg. ' + U.money(r.severance) + ' an Abfindung.', 'warn');
          G.dirty = true;
        });
    },

    /* --- Organisation ------------------------------------------------ */
    upgradeOrg: function (p) {
      var r = CE.empire.upgradeOrg(G.state, p.id);
      if (!r.ok) return toast(r.why, 'bad');
      var up = D.byId(D.ORG_UPGRADES, p.id);
      toast(up.name + ' ist auf Stufe ' + r.level + '.', 'gold');
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
      toast(r.act.name + ': Hitze ' + r.act.heat + '.', 'good');
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
      if (r.win) banner(r.text, 'good', 'Schutzgeld vereinbart', 'cash');
      else banner(r.text, 'bad', 'Sie haben abgelehnt', 'warn');
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
      banner(r.text, r.win ? 'good' : 'bad', r.win ? 'Übernommen' : 'Es ging schief', r.win ? 'building' : 'warn');
      G.dirty = true;
    },
    muscleIn: function (p) {
      var pre = CE.empire.canMuscleIn(G.state, p.id);
      if (!pre.ok) return toast(pre.why, 'bad');
      confirmBox('Mit Gewalt eindringen ' + D.byId(D.DISTRICTS, p.id).wohin + '?',
        'Kein Eintrittsgeld. ' + Math.round(pre.odds * 100) + '% Aussicht, dass es hält. So oder so: ' +
        '+12 Hitze, -4 Ansehen, +15 Furcht, und jede Organisation mit Leuten dort ' +
        'wird zum Feind. Der Bezirk startet umkämpft.',
        function () {
          var rng = CE.sim.rngOf(G.state);
          var r = CE.empire.muscleIn(G.state, rng, p.id);
          CE.sim.keepRng(G.state, rng);
          closeModal();
          if (!r.ok) return toast(r.why, 'bad');
          banner(r.text, r.win ? 'good' : 'bad', r.win ? 'Hineingezwungen' : 'Zurückgeschlagen', r.win ? 'map' : 'warn');
          G.dirty = true;
        }, 'Reingehen');
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
      confirmBox('Bruch mit ' + rd.name + '?',
        'Man wird es persönlich nehmen und sich lange daran erinnern.',
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
      var r = CE.save.save(G.state, p.slot, 'Woche ' + U.weekOf(G.state.day));
      toast(r.ok ? 'Gespeichert auf Platz ' + p.slot + '.' : r.why, r.ok ? 'good' : 'bad');
      if (!CE.save.available) toast('Dieser Browser blockiert den lokalen Speicher - der Spielstand überlebt kein Neuladen.', 'warn');
      saveDialog();
    },
    loadFrom: function (p) {
      var r = CE.save.load(p.slot);
      if (!r.ok) return toast(r.why, 'bad');
      startGame(r.state, true);
      closeModal();
      toast('Geladen: Woche ' + U.weekOf(r.state.day) + '.', 'good');
    },
    eraseSlot: function (p) {
      confirmBox('Platz löschen: ' + p.slot + '?', 'Das lässt sich nicht rückgängig machen.', function () {
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
      confirmBox('Zurück ins Hauptmenü?',
        'Dein Fortschritt wird am Ende jeder Woche automatisch gespeichert' +
        (G.settings.autosave ? '' : ', aber die Autospeicherung ist gerade aus') + '. Speichere sicherheitshalber jetzt.',
        function () {
          CE.save.save(G.state, 'auto', 'Autospeicherung');
          closeModal();
          toMenu();
        }, 'Speichern und gehen');
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
      ? ' Bei deinem jetzigen Stand verlierst du jede Woche Geld.'
      : '';
    confirmBox('Ausgeben: ' + U.money(cost) + '?',
      'Das sind ' + U.pct(cost / Math.max(1, s.cash)) + ' deines Bargelds für ' + UI.helpers.e(what) +
      '. Dir blieben <b>' + U.money(after) + '</b>.' + weeks +
      '<br><br><span class="why">Diese Nachfragen lassen sich in den Einstellungen abschalten.</span>',
      function () { closeModal(); onYes(); }, 'Ausgeben');
  }

  function confirmBox(title, text, onYes, yesLabel) {
    modal(title, '<p style="color:var(--ink2);line-height:1.6;margin:0">' + text + '</p>',
      '<button type="button" class="btn" data-close="1">Abbrechen</button>' +
      '<button type="button" class="btn btn--primary" data-act="__confirm">' + (yesLabel || 'Bestätigen') + '</button>');
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
      ['Grundertrag', U.money(def.income * D.UPGRADE.income[b.level - 1] * dist.econ), 'Stufe ' + b.level + ' in einer ' + Math.round(dist.econ * 100) + '%-Wirtschaft'],
      ['Wirkung des Personals', (f.staffBonus >= 0 ? '+' : '') + U.pct(f.staffBonus, 1), f.filled + ' von ' + f.slots + ' Stellen besetzt'],
      ['Einfluss im Bezirk', '+' + U.pct(f.inflBonus, 1), Math.round(s.districts[b.district].mine) + ' Einfluss hier'],
      f.boost ? ['Verbesserungen', '+' + U.pct(f.boost), 'aus einer früheren Entscheidung'] : null,
      f.perkBonus ? ['Zusammenspiel', '+' + U.pct(f.perkBonus), 'ein anderer Betrieb hier stützt diesen'] : null,
      f.understaffed ? ['Leere Stellen', '-' + U.pct(f.staffPenalty), f.understaffed + ' unbesetzt'] : null,
      b.damage ? ['Schaden', '-' + U.pct(b.damage), 'erholt sich um 22 Punkte je Woche'] : null,
      ['Ertrag diese Woche', U.money(f.gross), ''],
      ['Laufende Kosten', '-' + U.money(f.upkeep), ''],
      ['Netto', U.moneySigned(f.net), ''],
      def.heat ? ['Erzeugte Hitze', '+' + f.heat.toFixed(2) + '/wk', 'die Polizeipräsenz liegt hier bei ' + Math.round(dist.lawEye * 100) + '%'] : null,
      ['Erzeugter Einfluss', '+' + f.infl.toFixed(2) + '/wk', ''],
      def.legal ? ['Waschkapazität', U.money(f.gross * def.launder) + '/wk', 'lässt Untergrundgeld sauber durch'] : null
    ].filter(Boolean);

    var body = '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      '<div class="biz__ico">' + A.icon(def.icon) + '</div><div><b style="font-size:1.05rem">' +
      UI.helpers.e(b.name) + '</b><div class="row__s">' + UI.helpers.e(dist.name) + ' &middot; Stufe ' + b.level + ' von 5</div></div></div>' +
      '<p class="op__desc" style="margin-bottom:14px">' + UI.helpers.e(def.blurb) + '</p>' +
      '<table class="ledger"><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + r[0] + (r[2] ? '<div class="note">' + r[2] + '</div>' : '') +
          '</td><td class="r">' + r[1] + '</td></tr>';
      }).join('') + '</tbody></table>';

    if (up.ok) {
      var next = b.level;
      body += '<div class="card card--flat" style="margin-top:14px">' +
        '<div class="card__title"><b>Stufe ' + (b.level + 1) + '</b><span>' + U.money(up.cost) + '</span></div>' +
        '<div class="row__s">Ertrag &times;' + D.UPGRADE.income[next].toFixed(2) + ' (jetzt &times;' +
        D.UPGRADE.income[next - 1].toFixed(2) + '), laufende Kosten &times;' + D.UPGRADE.upkeep[next].toFixed(2) +
        ', ' + (D.UPGRADE.staff[next] > D.UPGRADE.staff[next - 1] ? '+1 Stelle' : 'gleiche Stellen') + '.</div></div>';
    }

    modal(b.name, body,
      (up.ok ? '<button type="button" class="btn btn--primary" data-act="upgradeBiz" data-id="' + b.id +
        '">Ausbauen für ' + U.money(up.cost) + '</button>' : '') +
      '<button type="button" class="btn btn--danger" data-act="sellBiz" data-id="' + b.id + '">Verkaufen</button>' +
      '<button type="button" class="btn" data-close="1">Schließen</button>');
  }

  function recruitDialog() {
    var s = G.state, d = St.derive(s);
    var paid = s.crew.filter(function (c) { return !c.player; }).length;
    var body = ['<div class="row__s" style="margin-bottom:12px">' + paid + ' von ' + d.crewCap +
      ' Stellen besetzt. Eine Einstellung kostet 1,6 Wochengehälter im Voraus.</div>'];

    if (!s.recruits.length) {
      body.push('<div class="empty"><p>Gerade sucht niemand Arbeit. Jede Woche tauchen neue Leute auf.</p></div>');
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
        '<div style="text-align:right"><div class="crew__pay">' + U.money(r.ask) + '/Woche</div>' +
        '<div class="row__s">' + U.money(signing) + ' für die Unterschrift</div></div></div>' +
        '<div class="crew__meters" style="margin-top:10px">' +
        '<div class="meter"><span>Können</span>' + UI.helpers.bar('bar--c', r.skill / 12) + '<b>' + r.skill + '</b></div>' +
        '<div class="meter"><span>Loyalität</span>' + UI.helpers.bar('bar--g', r.loyalty / 100) + '<b>' + r.loyalty + '</b></div>' +
        '<div class="meter"><span>Höchstmaß</span>' + UI.helpers.bar('bar--v', r.potential / 12) + '<b>' + r.potential + '</b></div></div>' +
        (r.traits.length ? '<div class="crew__traits" style="margin-top:8px">' + r.traits.map(function (t) {
          var td = D.byId(D.TRAITS, t);
          return '<span class="tag ' + (td.good === true ? 'tag--green' : td.good === false ? 'tag--red' : 'tag--violet') +
            '" title="' + UI.helpers.e(td.desc) + '">' + UI.helpers.e(td.name) + '</span>';
        }).join('') + '</div>' : '') +
        '<div class="crew__acts" style="margin-top:10px">' +
        '<button type="button" class="btn btn--primary btn--sm" data-act="hire" data-id="' + r.id + '"' +
        (afford ? '' : ' disabled title="' + (paid >= d.crewCap ? 'Kein Platz in deiner Crew.' : 'Nicht genug Bargeld.') + '"') +
        '>Einstellen für ' + U.money(r.ask) + '</button>' +
        '<button type="button" class="btn btn--sm" data-act="hire" data-id="' + r.id + '" data-salary="' + low + '"' +
        (afford ? '' : ' disabled') + ' title="Weniger Lohn kostet Loyalität, und unter 70% der Forderung gehen sie.">' +
        'Drücken auf ' + U.money(low) + '</button></div></div>');
    });

    modal('Anwerben', body.join(''),
      '<button type="button" class="btn" data-act="searchRecruits"' +
      (s.cash < 1200 ? ' disabled title="Benötigt $1.200."' : '') + '>Herumsagen &middot; $1.200</button>' +
      '<button type="button" class="btn btn--primary" data-close="1">Fertig</button>');
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
      '<div class="row__s">Dabei seit Tag ' + c.hired + (c.raises ? ' &middot; ' + c.raises + (c.raises === 1 ? ' Erhöhung' : ' Erhöhungen') : '') + '</div>' +
      '</div></div>' +
      '<div class="crew__meters" style="margin-bottom:14px">' +
      '<div class="meter"><span>Können</span>' + UI.helpers.bar('bar--c', eff / 12) + '<b>' + eff + '/' + c.potential + '</b></div>' +
      '<div class="meter"><span>Loyalität</span>' + UI.helpers.bar(c.loyalty < 30 ? 'bar--r' : 'bar--g', c.loyalty / 100) +
      '<b class="mood-' + (c.mood || 'steady') + '">' + Math.round(c.loyalty) + '</b></div>' +
      '<div class="meter"><span>Erfahrung</span>' + UI.helpers.bar('bar--v', (c.xp % 100) / 100) + '<b>' + c.xp + '</b></div></div>' +
      '<table class="ledger"><tbody>' +
      '<tr><td>Aktuelles Gehalt</td><td class="r">' + U.money(c.salary) + '/Woche</td></tr>' +
      '<tr><td>Wert bei diesem Können<div class="note">' +
      (c.salary < fair * 0.85 ? 'Unterbezahlt. Die Loyalität sinkt jede Woche.'
        : c.salary > fair * 1.2 ? 'Über dem Satz bezahlt. Die Loyalität steigt.' : 'Fair bezahlt.') +
      '</div></td><td class="r">' + U.money(fair) + '/Woche</td></tr>' +
      '</tbody></table>' +
      (c.traits.length ? '<div class="crew__traits" style="margin-top:12px">' + c.traits.map(function (t) {
        var td = D.byId(D.TRAITS, t);
        return '<span class="tag ' + (td.good === true ? 'tag--green' : td.good === false ? 'tag--red' : 'tag--violet') +
          '">' + UI.helpers.e(td.name) + ' &mdash; ' + UI.helpers.e(td.desc) + '</span>';
      }).join(' ') + '</div>' : '');

    modal(c.name, body,
      '<button type="button" class="btn" data-act="raise" data-id="' + c.id + '" data-to="' + toFair + '"' +
      (toFair <= c.salary ? ' disabled title="Schon auf oder über dem Satz."' : '') + '>Erhöhen auf ' + U.money(toFair) + '</button>' +
      '<button type="button" class="btn" data-act="bonus" data-id="' + c.id + '"' +
      (s.cash < bonusAmt ? ' disabled title="Benötigt ' + U.money(bonusAmt) + '."' : '') + '>Bonus ' + U.money(bonusAmt) + '</button>' +
      '<button type="button" class="btn btn--primary" data-act="promote" data-id="' + c.id + '"' +
      (s.cash < promoCost || eff >= c.potential ? ' disabled title="' +
        (eff >= c.potential ? 'Nichts mehr dazuzulernen.' : 'Benötigt ' + U.money(promoCost) + '.') + '"' : '') +
      '>Befördern ' + U.money(promoCost) + '</button>' +
      '<button type="button" class="btn btn--danger" data-act="fire" data-id="' + c.id + '">Entlassen</button>');
  }

  function assignDialog(id) {
    var s = G.state, c = U.byId(s.crew, id);
    if (!c) return;
    var body = ['<div class="row__s" style="margin-bottom:12px">Wo soll ' +
      UI.helpers.e(c.name) + ' arbeiten? Eingesetztes Personal erhöht den Ertrag des Betriebs.</div><div class="slots">'];
    body.push('<div class="slotrow' + (!c.post ? '' : '') + '">' +
      '<div class="slotrow__n">&mdash;</div><div class="slotrow__i">' +
      '<div class="slotrow__t">Nicht eingesetzt</div><div class="slotrow__s">Kein Ertrag, das Gehalt läuft weiter.</div></div>' +
      '<button type="button" class="btn btn--sm" data-act="assign" data-id="' + c.id + '" data-biz="none"' +
      (!c.post ? ' disabled' : '') + '>' + (!c.post ? 'Aktuell' : 'Abziehen') + '</button></div>');

    s.businesses.forEach(function (b) {
      var f = St.bizFinance(s, b);
      var full = f.filled >= f.slots && c.post !== b.id;
      var def = D.byId(D.BUSINESSES, b.type);
      body.push('<div class="slotrow">' +
        '<div class="slotrow__n">' + A.icon(def.icon) + '</div><div class="slotrow__i">' +
        '<div class="slotrow__t">' + UI.helpers.e(b.name) + '</div>' +
        '<div class="slotrow__s">' + UI.helpers.e(D.byId(D.DISTRICTS, b.district).name) + ' &middot; ' +
        f.filled + '/' + f.slots + ' besetzt &middot; ' + U.money(f.gross) + '/Woche</div></div>' +
        '<button type="button" class="btn btn--sm' + (c.post === b.id ? '' : ' btn--primary') +
        '" data-act="assign" data-id="' + c.id + '" data-biz="' + b.id + '"' +
        (full || c.post === b.id ? ' disabled title="' + (c.post === b.id ? 'Hier bereits eingesetzt.' : 'Keine freie Stelle.') + '"' : '') +
        '>' + (c.post === b.id ? 'Aktuell' : 'Hier einsetzen') + '</button></div>');
    });
    if (!s.businesses.length) body.push('<div class="empty"><p>Du besitzt noch keine Betriebe, die du besetzen könntest.</p></div>');
    body.push('</div>');
    modal('Einsetzen: ' + c.name, body.join(''));
  }

  /* Wo man einem Rivalen einen Betrieb abnehmen kann. */
  function seizeDialog(rivalId) {
    var s = G.state;
    var rd = D.byId(D.RIVALS, rivalId);
    var body = ['<div class="row__s" style="margin-bottom:12px">Einen Betrieb einfach zu nehmen kostet kein ' +
      'Bargeld. Er kommt beschädigt an, er macht einen dauerhaften Feind, und die ganze Stadt erfährt davon.</div><div class="slots">'];
    var any = false;
    D.DISTRICTS.forEach(function (dist) {
      var can = CE.rivals.canSeize(s, rivalId, dist.id);
      var r = U.byId(s.rivals, rivalId);
      if (!can.ok && (r.infl[dist.id] || 0) < 10) return;
      any = true;
      body.push('<div class="slotrow">' +
        '<div class="slotrow__n" style="color:' + rd.color + '">' + A.icon('building') + '</div>' +
        '<div class="slotrow__i"><div class="slotrow__t">' + UI.helpers.e(dist.name) + '</div>' +
        '<div class="slotrow__s">Sie halten hier ' + Math.round(r.infl[dist.id] || 0) + ' Einfluss' +
        (can.ok ? ' &middot; ' + Math.round(can.odds * 100) + '% Aussicht' : '') + '</div></div>' +
        '<button type="button" class="btn btn--sm btn--danger" data-act="seize" data-rival="' + rivalId +
        '" data-district="' + dist.id + '"' + (can.ok ? '' : ' disabled title="' + UI.helpers.e(can.why) + '"') +
        '>Nehmen</button></div>');
    });
    if (!any) body.push('<div class="empty"><p>Sie haben nichts, woran du herankommst.</p></div>');
    body.push('</div>');
    modal('Nehmen von ' + rd.name, body.join(''));
  }

  function pressureDialog(rivalId, districtId) {
    var s = G.state, d = St.derive(s);
    var body = ['<div class="row__s" style="margin-bottom:12px">Einen Rivalen zu verdrängen kostet Geld, ' +
      'treibt die Hitze hoch und zerstört das Verhältnis. Es ist der einzige Weg, Boden zu nehmen, den sie nicht verkaufen.</div><div class="slots">'];
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
          '<div class="slotrow__s">Sie halten hier ' + Math.round(r.infl[dist.id] || 0) + ' Einfluss' +
          (can.ok ? ' &middot; ' + Math.round(can.odds * 100) + '% Aussicht &middot; ' + U.money(can.cost) : '') + '</div></div>' +
          '<button type="button" class="btn btn--sm btn--danger" data-act="pressure" data-rival="' + r.id +
          '" data-district="' + dist.id + '"' + (can.ok ? '' : ' disabled title="' + UI.helpers.e(can.why) + '"') +
          '>Verdrängen</button></div>');
      });
    });
    if (!any) body.push('<div class="empty"><p>Hier gibt es niemanden zu verdrängen. Du brauchst einen eigenen Bezirk, in dem auch ein Rivale sitzt.</p></div>');
    body.push('</div>');
    modal('Druck machen', body.join(''));
  }

  function saveDialog() {
    var list = CE.save.list();
    var body = ['<div class="slots">'];
    list.forEach(function (sl) {
      var isAuto = sl.slot === 'auto';
      body.push('<div class="slotrow' + (sl.empty ? ' slotrow--empty' : '') + '">' +
        '<div class="slotrow__n">' + (isAuto ? 'A' : sl.slot) + '</div><div class="slotrow__i">' +
        '<div class="slotrow__t">' + (sl.empty ? (isAuto ? 'Noch keine Autospeicherung' : 'Leerer Platz')
          : sl.broken ? 'Beschädigter Spielstand'
          : UI.helpers.e(sl.name) + ' &middot; ' + UI.helpers.e(sl.rank)) + '</div>' +
        '<div class="slotrow__s">' + (sl.empty || sl.broken ? (isAuto ? 'Wird am Ende jeder Woche geschrieben' : 'Hier speichern, um einen Stand zu sichern')
          : 'Woche ' + sl.week + ' &middot; ' + U.money(sl.worth) + ' &middot; ' + sl.businesses + ' Betriebe &middot; ' +
            new Date(sl.saved).toLocaleString()) + '</div></div>' +
        (isAuto ? '' : '<button type="button" class="btn btn--sm" data-act="saveTo" data-slot="' + sl.slot + '">Speichern</button>') +
        '<button type="button" class="btn btn--sm btn--primary" data-act="loadFrom" data-slot="' + sl.slot + '"' +
        (sl.empty || sl.broken ? ' disabled' : '') + '>Laden</button>' +
        (sl.empty ? '' : '<button type="button" class="btn btn--sm btn--ghost" data-act="eraseSlot" data-slot="' + sl.slot + '" title="Löschen">&times;</button>') +
        '</div>');
    });
    body.push('</div>');
    if (!CE.save.available) {
      body.push('<div class="why why--bad" style="margin-top:12px">Dieser Browser blockiert den lokalen Speicher. ' +
        'Spielstände halten nur für diese Sitzung und sind weg, sobald der Tab schließt.</div>');
    }
    modal('Speichern und laden', body.join(''),
      '<button type="button" class="btn btn--danger" data-act="mainMenu">Hauptmenü</button>' +
      '<button type="button" class="btn btn--primary" data-close="1">Schließen</button>');
  }

  function settingsDialog() {
    function sw(key, title, desc) {
      return '<div class="switch"><div><div class="switch__t">' + title + '</div>' +
        '<div class="switch__d">' + desc + '</div></div>' +
        '<button type="button" class="toggle' + (G.settings[key] ? ' is-on' : '') +
        '" data-act="toggleSetting" data-key="' + key + '" role="switch" aria-checked="' +
        (G.settings[key] ? 'true' : 'false') + '" aria-label="' + title + '"><i></i></button></div>';
    }
    modal('Einstellungen',
      sw('sound', 'Toneffekte', 'Kurze erzeugte Signale. Keine Musik, keine Dateien.') +
      sw('autosave', 'Autospeicherung', 'Schreibt am Ende jeder Woche auf den Auto-Platz.') +
      sw('reduceMotion', 'Bewegung reduzieren', 'Hält die animierte Skyline an und kürzt Übergänge.') +
      sw('confirmBig', 'Große Ausgaben bestätigen', 'Fragt nach, bevor etwas mehr als ein Viertel deines Bargelds kostet.') +
      '<div class="why" style="margin-top:14px">Tastatur: <b>Leertaste</b> Pause &middot; <b>1 2 3</b> Tempo &middot; ' +
      '<b>N</b> nächster Tag &middot; <b>1-4</b> Entscheidung beantworten &middot; <b>Esc</b> schließen.</div>');
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
    if (G.state) { CE.save.save(G.state, 'auto', 'Autospeicherung'); }
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
        ? info.state.name + ' · Woche ' + U.weekOf(info.state.day) + ' · ' + U.money(info.state.cash)
        : 'Gespeichertes Spiel';
    } else {
      $('contSub').textContent = 'Kein Spielstand gefunden';
    }
  }

  function newGameDialog() {
    var body =
      '<div class="field"><label for="ngName">Wie nennt man dich?</label>' +
      '<input type="text" id="ngName" maxlength="22" value="" placeholder="Dein Name" autocomplete="off"></div>' +
      '<div class="field"><label>Schwierigkeit</label><div class="choices" id="ngDiff">' +
      '<button type="button" class="choice" data-diff="easy"><b>Vorsichtig</b>' +
      '<small>$6.000 zum Start, mildere Rivalen, weniger Hitze.</small></button>' +
      '<button type="button" class="choice is-on" data-diff="normal"><b>Standard</b>' +
      '<small>$3.500 zum Start. So ist es gedacht.</small></button>' +
      '<button type="button" class="choice" data-diff="hard"><b>Skrupellos</b>' +
      '<small>$2.500, aggressive Rivalen, die Hitze steigt schnell.</small></button>' +
      '</div></div>' +
      '<div class="why">Du fängst in der Altstadt an, ohne Crew, ohne Betriebe und ohne Ansehen. ' +
      'Mach Operationen, um die ersten paar tausend zusammenzubekommen, und kauf dann etwas, das verdient, während du schläfst.</div>';
    modal('Neues Spiel', body,
      '<button type="button" class="btn" data-close="1">Abbrechen</button>' +
      '<button type="button" class="btn btn--primary" data-act="__startNew">Anfangen</button>');

    var diffs = document.querySelectorAll('#ngDiff .choice');
    for (var i = 0; i < diffs.length; i++) {
      diffs[i].addEventListener('click', function () {
        for (var j = 0; j < diffs.length; j++) diffs[j].classList.remove('is-on');
        this.classList.add('is-on');
      });
    }
    ACTIONS.__startNew = function () {
      var name = ($('ngName').value || '').trim().slice(0, 22) || 'Unbekannt';
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
        banner('Die Altstadt steht dir offen. Drück auf Play, wenn du bereit bist.', 'good',
      'Blackhaven, ' + U.dateLabel(0), 'map');
      }, 400);
    }
    CE.save.save(s, 'auto', 'Autospeicherung');
  }

  function loadDialog() {
    saveDialog();
  }

  function creditsDialog() {
    modal('Mitwirkende',
      '<p style="color:var(--ink2);line-height:1.7;margin:0 0 14px">' +
      '<b>Crime Empire</b> ist ein Aufbauspiel darüber, aus dem Nichts etwas zu errichten, in einer Stadt, ' +
      'die das nicht will. Blackhaven, seine Bezirke, seine vier Familien und alle darin ' +
      'sind frei erfunden.</p>' +
      '<table class="ledger"><tbody>' +
      '<tr><td>Entwurf, Code, Grafik</td><td class="r">Für dieses Repository geschrieben</td></tr>' +
      '<tr><td>Engine</td><td class="r">Keine &mdash; schlichtes HTML, CSS, JavaScript</td></tr>' +
      '<tr><td>Abhängigkeiten</td><td class="r">Keine</td></tr>' +
      '<tr><td>Grafik</td><td class="r">Erzeugtes SVG und Canvas</td></tr>' +
      '<tr><td>Ton</td><td class="r">Erzeugtes Web Audio</td></tr>' +
      '<tr><td>Spielstände</td><td class="r">localStorage, vier Plätze</td></tr>' +
      '</tbody></table>' +
      '<div class="why" style="margin-top:14px">Die Untergrundbetriebe in diesem Spiel sind abstrakte ' +
      'Verwaltungssysteme. Nichts hier beschreibt, wie so etwas tatsächlich abläuft.</div>');
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
        if (r.ok) startGame(r.state, true); else toast('Kein Spielstand zum Fortsetzen.', 'bad');
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
      if (G.state && G.settings.autosave) CE.save.save(G.state, 'auto', 'Autospeicherung');
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
