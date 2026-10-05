/* Spieltag: Vorbericht, Live-Spiel mit Konferenz, Wechsel/Taktik, Nachbericht. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var SPEED_MS = [700, 320, 130, 35];
  var L = null; // laufendes Spiel

  function pickT(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  UI.views.match = {
    title: function () { return L && L.phase === 'live' ? 'Live' : L && L.phase === 'post' ? 'Spielbericht' : 'Spieltag'; },
    render: function (params) {
      var st = FM.state;
      var fx = st.fixtures[params.fid];
      if (!fx) return '<div class="empty">Spiel nicht gefunden.</div>';
      if (L && L.fid === fx.id) {
        if (L.phase === 'live') return liveHtml();
        if (L.phase === 'post') return postHtml();
      }
      if (fx.res) { L = { fid: fx.id, fx: fx, phase: 'post', m: null, others: [], userSide: fx.home === st.user.club ? 0 : 1 }; return postHtml(); }
      return preHtml(fx);
    },
    mount: function () {
      if (L && L.phase === 'live') { bindLive(); if (!L.paused) startTimer(); }
      var btn = document.getElementById('btn-continue');
      if (btn && L && L.phase === 'live') btn.style.display = 'none';
    }
  };

  /* ---------- Vorbericht ---------- */
  function teamHead(c, align) {
    var st = FM.state, pos = FM.playedRounds(st, c.league) ? FM.clubPosition(st, c.id) : null;
    var t = FM.ZONES[c.league] ? FM.table(st, c.league).filter(function (r) { return r.club === c.id; })[0] : null;
    return '<div class="team" style="' + (align === 'r' ? 'flex-direction:row-reverse;text-align:right' : '') + '">' + UI.badge(c, 48) +
      '<div style="min-width:0"><div class="n ellipsis">' + esc(c.name) + '</div><div class="muted small">' + (pos ? pos + '. Platz · ' : '') + 'Stärke ' + FM.teamStrength(st, c.id).toFixed(1) + '</div>' + (t ? '<div style="margin-top:4px">' + UI.formDots(t.form) + '</div>' : '') + '</div></div>';
  }

  function preHtml(fx) {
    var st = FM.state, uc = st.user.club;
    var h = st.clubs[fx.home], a = st.clubs[fx.away];
    FM.matchComp = fx.comp === 'cup' ? 'cup' : 'league';
    var my = FM.userLineup(st);
    var oppId = fx.home === uc ? fx.away : fx.home;
    var opp = FM.aiLineup(st, oppId);
    FM.matchComp = null;
    var club = st.clubs[uc], t = club.tactics || FM.defaultTactics();
    var stored = UI.ensureLineup();
    var missing = stored.slots.filter(function (s) {
      var p = s.pid && st.players[s.pid];
      return !p || !FM.isAvailable(p, fx.comp === 'cup' ? 'cup' : 'league');
    }).length;
    function xi(lu, mine) {
      return '<table class="tbl compact"><tbody>' + lu.slots.map(function (s) {
        var p = st.players[s.pid];
        return '<tr' + (mine ? '' : ' class="click" data-action="player" data-id="' + p.id + '"') + '><td>' + UI.posTag(s.pos) + '</td><td><span class="pname">' + esc(p.name) + '</span>' + (mine && FM.positionPenalty(p, s.pos) >= 4 ? ' <span class="tag warn" title="Nicht auf Stammposition">Pos.</span>' : '') + '</td><td>' + UI.fit(p.fit) + '</td><td class="num">' + UI.pill(Math.round(FM.effectiveRating(p, s.pos))) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    var stadium = fx.neutral ? 'Olympiastadion Berlin' : h.stadium;
    var html = '<div class="card"><div class="scoreboard">' + teamHead(h) + '<div class="score"><div class="muted small">' + esc(UI.compLabel(fx)) + '</div><div class="s" style="font-size:28px;margin:4px 0">vs</div><div class="muted small">' + D.fmtLong(fx.date) + '</div></div>' + teamHead(a, 'r') + '</div>' +
      '<div class="match-meta"><span class="tag">' + esc(stadium) + '</span>' + (fx.agg ? '<span class="tag warn">Hinspiel ' + fx.agg[1] + ':' + fx.agg[0] + ' (' + esc(a.short) + ' – ' + esc(h.short) + ')</span>' : '') +
      (fx.comp === 'cup' || fx.leg === 2 ? '<span class="tag">K.-o.-Spiel: Verlängerung & Elfmeterschießen möglich</span>' : '') + '</div></div>';
    if (missing) html += '<div class="note warn" style="margin-top:16px">' + missing + ' Spieler deiner gespeicherten Aufstellung fehlen (verletzt/gesperrt) und werden automatisch ersetzt. Prüfe die Aufstellung.</div>';
    html += '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Deine Startelf · ' + esc(my.formation) + '</h3><button class="btn sm" data-action="go" data-view="tactics">' + UI.icon('tactics') + ' Ändern</button></div><div class="card-b flush">' + xi(my, true) + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Voraussichtlich: ' + esc(st.clubs[oppId].short) + ' · ' + esc(opp.formation) + '</h3></div><div class="card-b flush">' + xi(opp, false) + '</div></div></div>';
    html += '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Matchplan</h3></div><div class="card-b row wrap" style="gap:18px">' +
      tac('Mentalität', 'mentality', FM.MENTALITY, t.mentality) + tac('Pressing', 'pressing', FM.PRESSING, t.pressing) + tac('Tempo', 'tempo', FM.TEMPO, t.tempo) + '</div>' +
      '<div class="modal-f"><button class="btn" data-action="matchInstant" data-id="' + fx.id + '">' + UI.icon('skip') + ' Sofortergebnis</button><button class="btn primary lg" data-action="matchStart" data-id="' + fx.id + '">' + UI.icon('play') + ' Anpfiff</button></div></div>';
    return html;
  }
  function tac(label, key, opts, cur) {
    return '<div><div class="small strong" style="margin-bottom:6px">' + label + '</div><div class="seg">' + opts.map(function (o) {
      return '<button data-action="setTactic" data-k="' + key + '" data-v="' + o.id + '" class="' + (o.id === cur ? 'on' : '') + '">' + o.label + '</button>';
    }).join('') + '</div></div>';
  }

  /* ---------- Start ---------- */
  function setup(fid) {
    var st = FM.state, fx = st.fixtures[fid];
    var m = FM.createMatch(st, fx);
    var others = FM.fixturesOn(st, fx.date).filter(function (f) { return !f.res && f.id !== fx.id && f.comp === fx.comp; })
      .map(function (f) { return { fx: f, m: FM.createMatch(st, f), flash: 0 }; });
    L = { fid: fid, fx: fx, m: m, others: others, phase: 'live', paused: false, userSide: fx.home === st.user.club ? 0 : 1, shown: 0, timer: null, htPaused: false, etPaused: false };
    L.m._ev({ t: 'kickoff' });
  }

  UI.actions.matchStart = function (el) {
    setup(el.getAttribute('data-id'));
    UI.render();
  };

  UI.actions.matchInstant = function (el) {
    setup(el.getAttribute('data-id'));
    L.m.runToEnd();
    L.others.forEach(function (o) { o.m.runToEnd(); });
    finish();
  };

  function finish() {
    stopTimer();
    var st = FM.state;
    L.others.forEach(function (o) { if (!o.m.finished) o.m.runToEnd(); });
    FM.applyResult(st, L.fx, L.m.result(false));
    L.others.forEach(function (o) { if (!o.fx.res) FM.applyResult(st, o.fx, o.m.result(true)); });
    FM.finishDay(st);
    FM.save(UI.slot || 1);
    L.phase = 'post';
    UI.render();
  }

  /* ---------- Live ---------- */
  function startTimer() {
    stopTimer();
    var speed = FM.state.settings.speed != null ? FM.state.settings.speed : 1;
    L.timer = setInterval(tick, SPEED_MS[speed] || 320);
  }
  function stopTimer() { if (L && L.timer) { clearInterval(L.timer); L.timer = null; } }

  function tick() {
    if (!L || L.phase !== 'live') { stopTimer(); return; }
    if (UI.view !== 'match') { L.paused = true; stopTimer(); return; }
    var m = L.m;
    var before = m.period;
    m.step();
    L.others.forEach(function (o) {
      if (o.m.finished || o.m.period > m.period) return;
      var g0 = o.m.goals[0] + o.m.goals[1];
      o.m.step();
      if (o.m.goals[0] + o.m.goals[1] > g0) o.flash = 1;
    });
    if (m.finished) { finish(); return; }
    updateLive();
    if (before === 1 && m.period === 2 && !L.htPaused) { L.htPaused = true; pause('Halbzeit'); }
    if (before === 2 && m.period === 3 && !L.etPaused) { L.etPaused = true; pause('Verlängerung'); }
  }

  function pause(reason) {
    L.paused = true;
    stopTimer();
    UI.render(true);
    if (reason) UI.toast(reason + ' – passe Taktik und Wechsel an, dann geht es weiter.');
  }

  function minuteLabel(m) {
    if (m.finished) return 'Abpfiff';
    if (m.period === 5) return 'Elfmeterschießen';
    var limit = m.period === 1 ? 45 : m.period === 2 ? 90 : m.period === 3 ? 105 : 120;
    if (m.minute > limit) return limit + '+' + (m.minute - limit) + '\'';
    return m.minute + '\'';
  }

  function liveHtml() {
    var st = FM.state, fx = L.fx, m = L.m;
    var h = st.clubs[fx.home], a = st.clubs[fx.away];
    var speed = st.settings.speed != null ? st.settings.speed : 1;
    var prog = Math.min(100, m.minute / (m.period >= 3 ? 120 : 90) * 100);
    var html = '<div class="card"><div class="scoreboard">' +
      '<div class="team">' + UI.badge(h, 46) + '<div class="n ellipsis">' + esc(h.name) + '</div></div>' +
      '<div class="score"><div class="s" id="lv-score">' + scoreStr() + '</div><div class="m" id="lv-min">' + (L.paused ? '' : '<span class="live-dot"></span>') + minuteLabel(m) + '</div></div>' +
      '<div class="team away">' + UI.badge(a, 46) + '<div class="n ellipsis">' + esc(a.name) + '</div></div></div>' +
      '<div class="progress"><i id="lv-prog" style="width:' + prog + '%"></i></div>' +
      '<div class="modal-f" style="border-top:0;justify-content:space-between;align-items:center">' +
      '<div class="seg">' + [[0, 'Langsam'], [1, 'Normal'], [2, 'Schnell'], [3, 'Turbo']].map(function (o) { return '<button data-action="liveSpeed" data-v="' + o[0] + '" class="' + (speed === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button class="btn" data-action="liveSubs">' + UI.icon('swap') + ' Wechsel & Taktik</button>' +
      '<button class="btn" data-action="livePause">' + (L.paused ? UI.icon('play') + ' Weiter' : UI.icon('pause') + ' Pause') + '</button>' +
      '<button class="btn ghost" data-action="liveEnd">' + UI.icon('skip') + ' Zum Ende</button></div></div></div>';
    html += '<div class="match-grid" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Liveticker</h3><span class="muted small" id="lv-subs">' + subsInfo() + '</span></div><div class="ticker" id="lv-ticker">' + tickerHtml(true) + '</div></div>' +
      '<div class="stack"><div class="card"><div class="card-h"><h3>Statistik</h3></div><div id="lv-stats">' + UI.statsBlock(m.result(true).stats) + '</div></div>' +
      (L.others.length ? '<div class="card"><div class="card-h"><h3>Konferenz</h3><span class="muted small">' + esc(FM.COMP_NAME[fx.comp]) + '</span></div><div class="list konf" id="lv-konf">' + konfHtml() + '</div></div>' : '') +
      '<div class="card"><div class="card-h"><h3>Deine Elf</h3></div><div class="card-b flush" id="lv-team">' + teamLiveHtml() + '</div></div></div></div>';
    L.shown = m.events.length;
    return html;
  }

  function scoreStr() {
    var m = L.m;
    var s = m.goals[0] + ' : ' + m.goals[1];
    if (m.pens) s += ' <span class="muted" style="font-size:16px">(' + m.pens.score[0] + ':' + m.pens.score[1] + ' i.E.)</span>';
    return s;
  }
  function subsInfo() { var s = L.m.sides[L.userSide]; return s.subsLeft + ' Wechsel übrig'; }

  function evLine(e) {
    var st = FM.state, P = st.players, fx = L.fx, m = L.m;
    var side = e.s != null ? m.sides[e.s] : null;
    var team = side ? st.clubs[side.club].short : '';
    var p = e.p && P[e.p] ? P[e.p].name : '';
    var gk = e.gk && P[e.gk] ? P[e.gk].name : 'der Keeper';
    var txt, cls = '';
    switch (e.t) {
      case 'kickoff': txt = 'Anpfiff' + (fx.neutral ? ' im Olympiastadion' : ' – ' + esc(st.clubs[fx.home].stadium)) + '. Los geht\'s!'; cls = 'phase'; break;
      case 'half': txt = 'Halbzeit. Es steht ' + m.goals[0] + ':' + m.goals[1] + '.'; cls = 'phase'; break;
      case 'ft90': txt = 'Ende der regulären Spielzeit – es geht in die Verlängerung!'; cls = 'phase'; break;
      case 'etHalf': txt = 'Seitenwechsel in der Verlängerung.'; cls = 'phase'; break;
      case 'pensStart': txt = 'Elfmeterschießen! Jetzt zählen die Nerven.'; cls = 'phase'; break;
      case 'end': txt = 'Abpfiff!'; cls = 'phase'; break;
      case 'penAwarded': txt = '<b>Elfmeter für ' + esc(team) + '!</b> ' + esc(p) + ' legt sich den Ball zurecht.'; break;
      case 'save': txt = e.big ? pickT(['Glanzparade! ' + esc(gk) + ' rettet gegen ' + esc(p) + '.', esc(gk) + ' ist im Eins-gegen-eins gegen ' + esc(p) + ' zur Stelle!']) : pickT([esc(p) + ' prüft ' + esc(gk) + ' – sicher gehalten.', 'Abschluss ' + esc(p) + ', aber ' + esc(gk) + ' packt zu.']); break;
      case 'miss': txt = e.big ? pickT(['Riesenchance für ' + esc(p) + ' – vorbei!', esc(p) + ' vergibt freistehend!', 'Was für eine Gelegenheit! ' + esc(p) + ' setzt den Ball neben das Tor.']) : pickT(['Schuss von ' + esc(p) + ' – drüber.', esc(p) + ' versucht es, knapp vorbei.']); break;
      default: txt = UI.eventText(e, P); if (e.t === 'goal') cls = 'goal';
    }
    if (!txt) return '';
    var minute = e.t === 'kickoff' ? '0\'' : e.per === 5 || e.t === 'pen' ? '' : e.m + '\'';
    return '<div class="tk ' + cls + '"><span class="min">' + minute + '</span><span class="ic">' + (UI.eventIcon(e) || (cls === 'phase' ? '<span class="muted">' + UI.icon('whistle').replace('<svg', '<svg width="15" height="15"') + '</span>' : '')) + '</span><span class="txt">' + txt + (team && e.t !== 'penAwarded' ? ' <span class="muted small">· ' + esc(team) + '</span>' : '') + '</span></div>';
  }

  function tickerHtml() {
    return L.m.events.slice().reverse().map(evLine).join('');
  }

  function konfHtml() {
    var st = FM.state;
    return L.others.map(function (o) {
      var f = o.fx, mm = o.m;
      return '<div class="li ' + (o.flash ? 'flash' : '') + '"><div class="grow row" style="justify-content:flex-end;text-align:right">' + UI.clubMini(f.home) + '</div><span class="sc">' + mm.goals[0] + ':' + mm.goals[1] + '</span><div class="grow row">' + UI.clubMini(f.away, true) + '</div><span class="muted tiny" style="width:34px;text-align:right">' + (mm.finished ? 'Ende' : mm.minute + '\'') + '</span></div>';
    }).join('');
  }

  function teamLiveHtml() {
    var st = FM.state, side = L.m.sides[L.userSide];
    return '<table class="tbl compact"><tbody>' + side.onPitch.map(function (s) {
      var p = st.players[s.pid], pr = side.pr[s.pid];
      return '<tr' + (pr.rc ? ' style="opacity:.45"' : '') + '><td>' + UI.posTag(s.pos) + '</td><td class="pname">' + esc(UI.shortName(p.name)) + (pr.goals ? ' ' + '⚽'.repeat(Math.min(3, pr.goals)) : '') + (pr.yc ? ' <span class="card-y"></span>' : '') + (pr.rc ? ' <span class="card-r"></span>' : '') + (pr.inj ? ' <span class="tag bad">verletzt</span>' : '') + '</td><td>' + UI.fit(pr.fit) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function updateLive() {
    var m = L.m;
    var sc = document.getElementById('lv-score');
    if (!sc) return;
    sc.innerHTML = scoreStr();
    document.getElementById('lv-min').innerHTML = (L.paused ? '' : '<span class="live-dot"></span>') + minuteLabel(m);
    document.getElementById('lv-prog').style.width = Math.min(100, m.minute / (m.period >= 3 ? 120 : 90) * 100) + '%';
    if (m.events.length > L.shown) {
      var add = m.events.slice(L.shown).reverse().map(evLine).join('');
      var tk = document.getElementById('lv-ticker');
      tk.insertAdjacentHTML('afterbegin', add);
      L.shown = m.events.length;
      var teamEl = document.getElementById('lv-team');
      if (teamEl) teamEl.innerHTML = teamLiveHtml();
      document.getElementById('lv-subs').textContent = subsInfo();
    } else if (m.minute % 5 === 0) {
      var t2 = document.getElementById('lv-team');
      if (t2) t2.innerHTML = teamLiveHtml();
    }
    if (m.minute % 3 === 0 || m.events.length) {
      document.getElementById('lv-stats').innerHTML = UI.statsBlock(m.result(true).stats);
    }
    var k = document.getElementById('lv-konf');
    if (k) { k.innerHTML = konfHtml(); L.others.forEach(function (o) { o.flash = 0; }); }
  }

  function bindLive() { /* Steuerung laeuft ueber delegierte Aktionen */ }

  UI.actions.livePause = function () {
    if (!L) return;
    if (L.paused) { L.paused = false; UI.render(true); startTimer(); }
    else pause();
  };
  UI.actions.liveSpeed = function (el) {
    FM.state.settings.speed = +el.getAttribute('data-v');
    if (!L.paused) startTimer();
    UI.render(true);
  };
  UI.actions.liveEnd = function () {
    if (!L) return;
    stopTimer();
    L.m.runToEnd();
    finish();
  };

  /* ---------- Wechsel & Taktik waehrend des Spiels ---------- */
  UI.actions.liveSubs = function () {
    if (!L) return;
    var wasPaused = L.paused;
    L.paused = true; stopTimer();
    var st = FM.state, side = L.m.sides[L.userSide];
    var sel = { out: null, inn: null };
    function render(m) {
      var t = side.tactics;
      var on = side.onPitch.map(function (s) {
        var p = st.players[s.pid], pr = side.pr[s.pid];
        if (pr.rc) return '';
        return '<div class="li click' + (sel.out === s.pid ? ' sel' : '') + '" data-out="' + s.pid + '" style="' + (sel.out === s.pid ? 'background:var(--accent-soft)' : '') + '">' + UI.posTag(s.pos) + '<div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="muted tiny">' + (pr.yc ? 'Gelb · ' : '') + (pr.inj ? 'verletzt · ' : '') + 'Fitness ' + Math.round(pr.fit) + ' %</div></div>' + UI.fit(pr.fit) + UI.pill(p.ovr) + '</div>';
      }).join('');
      var bench = side.bench.map(function (pid) {
        var p = st.players[pid];
        return '<div class="li click' + (sel.inn === pid ? ' sel' : '') + '" data-in="' + pid + '" style="' + (sel.inn === pid ? 'background:var(--accent-soft)' : '') + '">' + UI.posTag(p.pos[0]) + '<div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="muted tiny">' + p.pos.map(function (x) { return FM.POS_LABEL[x]; }).join(' · ') + '</div></div>' + UI.pill(p.ovr) + '</div>';
      }).join('');
      var outSlot = sel.out ? side.onPitch.filter(function (s) { return s.pid === sel.out; })[0] : null;
      var hint = sel.out && sel.inn ? 'Einwechslung auf Position ' + FM.POS_LABEL[outSlot.pos] + ' – Eignung: ' + Math.round(FM.effectiveRating(st.players[sel.inn], outSlot.pos)) : 'Wähle einen Spieler auf dem Feld und einen Ersatzspieler.';
      m.querySelector('.modal-b').innerHTML =
        '<div class="row wrap" style="gap:18px;margin-bottom:16px">' + tac('Mentalität', 'mentality', FM.MENTALITY, t.mentality) + tac('Pressing', 'pressing', FM.PRESSING, t.pressing) + tac('Tempo', 'tempo', FM.TEMPO, t.tempo) + '</div>' +
        '<div class="grid g2"><div class="card"><div class="card-h"><h3>Auf dem Feld</h3></div><div class="list">' + on + '</div></div>' +
        '<div class="card"><div class="card-h"><h3>Bank</h3><span class="muted small">' + side.subsLeft + ' Wechsel übrig</span></div><div class="list">' + (bench || '<div class="empty">Keine Ersatzspieler mehr.</div>') + '</div></div></div>' +
        '<p class="muted small" style="margin-top:10px">' + esc(hint) + '</p>';
      m.querySelector('#sub-ok').disabled = !(sel.out && sel.inn && side.subsLeft > 0);
    }
    UI.modal(UI.modalHead('Wechsel & Taktik', minuteLabel(L.m) + ' · ' + scoreStr().replace(/<[^>]+>/g, '')) + '<div class="modal-b"></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Fertig</button><button class="btn primary" id="sub-ok" disabled>' + UI.icon('swap') + ' Wechsel durchführen</button></div>',
      {
        size: 'wide',
        mount: function (m) {
          render(m);
          m.addEventListener('click', function (e) {
            var o = e.target.closest('[data-out]'), i = e.target.closest('[data-in]'), tb = e.target.closest('[data-action="setTactic"]');
            if (tb) {
              e.stopPropagation();
              var k = tb.getAttribute('data-k'), v = +tb.getAttribute('data-v'), obj = {};
              obj[k] = v; L.m.setTactics(L.userSide, obj);
              var club = st.clubs[st.user.club]; club.tactics = Object.assign({}, club.tactics || {}, obj);
              render(m); return;
            }
            if (o) { sel.out = o.getAttribute('data-out'); render(m); }
            if (i) { sel.inn = i.getAttribute('data-in'); render(m); }
          }, true);
          m.querySelector('#sub-ok').addEventListener('click', function () {
            var slot = side.onPitch.filter(function (s) { return s.pid === sel.out; })[0];
            if (slot && L.m.substitute(L.userSide, sel.out, sel.inn, slot.pos)) {
              UI.toast(st.players[sel.inn].name + ' kommt für ' + st.players[sel.out].name + '.');
              sel = { out: null, inn: null };
              render(m);
            }
          });
        },
        onClose: function () {
          L.paused = wasPaused;
          if (UI.view === 'match') { UI.render(true); if (!L.paused) startTimer(); }
        }
      });
  };

  /* ---------- Nachbericht ---------- */
  function postHtml() {
    var st = FM.state, fx = st.fixtures[L.fid], r = fx.res, uc = st.user.club;
    var h = st.clubs[fx.home], a = st.clubs[fx.away];
    var win = FM.fixtureWinner(fx);
    var gf = fx.home === uc ? r.hg : r.ag, ga = fx.home === uc ? r.ag : r.hg;
    var outcome = win ? (win === uc ? 'Sieg' : 'Niederlage') : gf > ga ? 'Sieg' : gf < ga ? 'Niederlage' : 'Unentschieden';
    var cls = outcome === 'Sieg' ? 'good' : outcome === 'Niederlage' ? 'bad' : '';
    var scorers = function (si) {
      return r.ev.filter(function (e) { return e.t === 'goal' && e.s === si; }).map(function (e) {
        var p = st.players[e.p]; return esc(p ? UI.shortName(p.name) : '?') + ' ' + e.m + '\'' + (e.og ? ' (ET)' : e.pen ? ' (FE)' : '');
      }).join('<br>');
    };
    var html = '<div class="card"><div class="scoreboard">' +
      '<div class="team">' + UI.badge(h, 46) + '<div style="min-width:0"><div class="n ellipsis">' + esc(h.name) + '</div><div class="muted small">' + scorers(0) + '</div></div></div>' +
      '<div class="score"><div class="s">' + r.hg + ' : ' + r.ag + '</div><div class="m">' + (r.pen ? 'i.E. ' + r.pen[0] + ':' + r.pen[1] : r.aet ? 'n.V.' : 'Endstand') + '</div><div style="margin-top:6px"><span class="tag ' + cls + '">' + outcome + '</span></div></div>' +
      '<div class="team away">' + UI.badge(a, 46) + '<div style="min-width:0"><div class="n ellipsis">' + esc(a.name) + '</div><div class="muted small">' + scorers(1) + '</div></div></div></div>' +
      '<div class="match-meta"><span class="tag">' + esc(UI.compLabel(fx)) + '</span><span class="tag">' + FM.fmtInt(r.att || 0) + ' Zuschauer</span>' +
      (r.motm && st.players[r.motm] ? '<span class="tag accent">★ Spieler des Spiels: ' + esc(st.players[r.motm].name) + '</span>' : '') + '</div>' +
      '<div class="modal-f"><button class="btn" data-action="matchReport" data-id="' + fx.id + '">Kompletter Spielbericht</button><button class="btn primary" data-action="postDone">Weiter ' + UI.icon('next') + '</button></div></div>';
    html += '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Statistik</h3></div>' + UI.statsBlock(r.stats) + '</div>';
    var today = FM.fixturesOn(st, fx.date).filter(function (f) { return f.comp === fx.comp && f.id !== fx.id; });
    html += '<div class="card"><div class="card-h"><h3>' + (fx.comp === 'cup' ? 'Weitere Pokalspiele' : 'Weitere Ergebnisse') + '</h3></div><div class="list konf">' + (today.length ? today.map(function (f) {
      return '<div class="li"><div class="grow row" style="justify-content:flex-end;text-align:right">' + UI.clubMini(f.home) + '</div><span class="sc">' + (f.res ? esc(FM.scoreText(f)).replace(' i.E.', '').replace(' n.V.', '') : '–') + '</span><div class="grow row">' + UI.clubMini(f.away, true) + '</div></div>';
    }).join('') : '<div class="empty">Keine weiteren Spiele.</div>') + '</div></div></div>';
    if (r.pl) {
      var mine = Object.keys(r.pl).filter(function (pid) { return r.pl[pid].s === L.userSide && r.pl[pid].mi > 0; }).map(function (pid) { return { p: st.players[pid], r: r.pl[pid], pid: pid }; })
        .sort(function (x, y) { return (y.r.st - x.r.st) || FM.POS_ORDER.indexOf(x.r.pos) - FM.POS_ORDER.indexOf(y.r.pos); });
      html += '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Noten deiner Spieler</h3><span class="muted small">Kicker-Skala: 1,0 = Weltklasse · 6,0 = unbrauchbar</span></div><div class="card-b flush"><table class="tbl"><thead><tr><th>Pos</th><th>Spieler</th><th class="num">Min</th><th class="num hide-xs">Fitness</th><th class="num">Note</th></tr></thead><tbody>' +
        mine.map(function (x) {
          return '<tr class="click" data-action="player" data-id="' + x.pid + '"><td>' + UI.posTag(x.r.pos) + '</td><td><span class="pname">' + esc(x.p ? x.p.name : '?') + '</span>' + (r.motm === x.pid ? ' <span class="tag accent">★</span>' : '') +
            (x.r.gl ? ' ' + '⚽'.repeat(Math.min(4, x.r.gl)) : '') + (x.r.as ? ' <span class="muted small">' + x.r.as + ' Vorl.</span>' : '') + (x.r.yc ? ' <span class="card-y"></span>' : '') + (x.r.rc ? ' <span class="card-r"></span>' : '') + (x.r.inj ? ' <span class="tag bad">verletzt</span>' : '') + '</td>' +
            '<td class="num">' + Math.min(x.r.mi, r.aet ? 120 : 90) + '</td><td class="num hide-xs">' + UI.fit(x.r.fit) + '</td><td class="num">' + UI.grade(x.r.g) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  }

  UI.actions.postDone = function () {
    L = null;
    var st = FM.state;
    if (st.user.fired) { UI.go('dashboard'); UI.firedModal(); return; }
    UI.go('dashboard');
  };

  UI.liveActive = function () { return L && L.phase === 'live'; };
})();
