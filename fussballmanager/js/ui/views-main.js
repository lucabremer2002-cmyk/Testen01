/* Ansichten: Start, Uebersicht, Posteingang, Verein, Einstellungen, Saisonbilanz. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  /* ================= Startbildschirm ================= */
  function dataStrength(cid) {
    var rows = (window.FM_DATA.players[cid] || []).slice().sort(function (a, b) { return b[2] - a[2]; });
    var gk = rows.filter(function (r) { return r[1].split('/')[0] === 'GK'; })[0];
    var field = rows.filter(function (r) { return r[1].split('/')[0] !== 'GK'; }).slice(0, 10);
    var arr = field.map(function (r) { return r[2]; });
    if (gk) arr.push(gk[2]);
    return arr.length ? FM.avg(arr) : 0;
  }

  UI.renderStart = function () {
    UI.clubTheme(null);
    var s = UI.vs('start', { league: 'bl', club: null, name: '' });
    var data = window.FM_DATA;
    var clubs = data.clubs.filter(function (c) { return c.league === s.league; });
    var strengths = {};
    clubs.forEach(function (c) { strengths[c.id] = dataStrength(c.id); });
    var vals = clubs.map(function (c) { return strengths[c.id]; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    clubs.sort(function (a, b) { return strengths[b.id] - strengths[a.id]; });
    var saves = [1, 2, 3].map(function (i) { return { slot: i, info: FM.saveInfo(i) }; });
    var anySave = saves.some(function (x) { return x.info; });
    var nPlayers = 0;
    data.clubs.forEach(function (c) { nPlayers += (data.players[c.id] || []).length; });

    var grid = clubs.map(function (c, idx) {
      var stars = 1 + 4 * (strengths[c.id] - mn) / Math.max(1, mx - mn);
      return '<button class="club-card ' + (s.club === c.id ? 'sel' : '') + '" data-action="pickClub" data-id="' + c.id + '" aria-pressed="' + (s.club === c.id) + '">' +
        UI.scarf(c, 'top') +
        '<span class="cc-rank">' + (idx + 1) + '</span>' + UI.badge(c, 40) +
        '<span class="cc-body"><span class="n">' + esc(c.name) + '</span>' +
        '<span class="s">' + UI.stars(Math.round(stars * 2) / 2) + ' <span class="tnum">Ø ' + strengths[c.id].toFixed(1) + '</span></span>' +
        '<span class="s">' + esc(c.stadium) + ' · ' + FM.fmtInt(c.cap) + '</span>' +
        '<span class="s">Kasse ' + FM.fmtMoney(c.money * 1e6) + '</span></span></button>';
    }).join('');

    var saveHtml = saves.map(function (x) {
      var i = x.info;
      if (!i) return '<div class="save-card empty"><span class="slot-no">' + x.slot + '</span><div class="grow"><div class="strong">Freier Speicherplatz</div><div class="muted small">Wird beim nächsten Start belegt</div></div></div>';
      if (i.incompatible) return '<div class="save-card"><span class="slot-no">' + x.slot + '</span><div class="grow"><div class="strong">Ältere Version</div><div class="muted small">Nicht mehr ladbar</div></div><button class="btn sm ghost icon" data-action="deleteSave" data-slot="' + x.slot + '" aria-label="Löschen">' + UI.icon('trash') + '</button></div>';
      var c = window.FM_DATA.clubs.filter(function (k) { return k.id === i.clubId; })[0] || { name: i.club, abbr: i.abbr, colors: i.colors, id: i.clubId };
      return '<div class="save-card">' + UI.scarf({ colors: i.colors }, 'side') + UI.badge({ name: i.club, abbr: i.abbr, colors: i.colors, id: 's' + x.slot, reserve: c.reserve }, 34) +
        '<div class="grow"><div class="strong ellipsis">' + esc(i.club) + '</div><div class="muted small">' + esc(i.manager) + ' · ' + D.fmt(i.date) + '</div></div>' +
        '<button class="btn sm club" data-action="loadSave" data-slot="' + x.slot + '">Laden</button>' +
        '<button class="btn sm ghost icon" data-action="deleteSave" data-slot="' + x.slot + '" aria-label="Spielstand ' + x.slot + ' löschen">' + UI.icon('trash') + '</button></div>';
    }).join('');

    var sel = s.club ? data.clubs.filter(function (c) { return c.id === s.club; })[0] : null;
    if (sel) UI.clubTheme(sel);
    document.getElementById('app').innerHTML =
      '<div class="start">' +
      '<header class="start-hero board"><div class="floodlights" aria-hidden="true"></div>' +
      '<div class="start-brand"><div class="eyebrow">Fußballmanager · Saison 2026/27</div><h1>Matchplan</h1>' +
      '<p>Bundesliga, 2. Bundesliga und 3. Liga mit den echten Kadern und den Spielerwerten aus EA SPORTS FC 27. Du führst den Verein: Aufstellung, Taktik, Transfers mit dem Budget des Vorstands, Stadion und Nachwuchs.</p></div>' +
      '<dl class="start-facts"><div><dt>Vereine</dt><dd>' + data.clubs.length + '</dd></div><div><dt>Spieler</dt><dd>' + FM.fmtInt(nPlayers) + '</dd></div><div><dt>Ligen</dt><dd>3</dd></div></dl>' +
      '</header>' +
      '<div class="start-body">' +
      (anySave ? '<section class="start-sec"><div class="sec-h"><h2>Spielstände</h2><label class="btn sm ghost">' + UI.icon('upload') + ' Datei importieren<input type="file" accept="application/json" id="import-file" hidden></label></div><div class="save-grid">' + saveHtml + '</div></section>' : '') +
      '<section class="start-sec"><div class="sec-h"><div><h2>Neue Karriere</h2><p class="muted small">Die Vereine sind nach Kaderstärke sortiert. Die Kasse bestimmt, wie viel Budget dir der Vorstand gibt.</p></div>' +
      (anySave ? '' : '<label class="btn sm ghost">' + UI.icon('upload') + ' Spielstand importieren<input type="file" accept="application/json" id="import-file" hidden></label>') + '</div>' +
      '<div class="filters"><div class="field" style="min-width:220px"><label for="mgr">Dein Name</label><input class="input" id="mgr" maxlength="40" placeholder="z. B. Alex Weber" value="' + esc(s.name) + '"></div>' +
      '<div class="field"><label>Liga</label>' + UI.seg('league', [['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga']], s.league, 'start') + '</div></div>' +
      '<div class="club-grid">' + grid + '</div>' +
      '<div class="start-go"><div class="small">' + (sel ? '<span class="muted">Dein Verein:</span> <b>' + esc(sel.name) + '</b>' : '<span class="muted">Wähle einen Verein aus.</span>') + '</div>' +
      '<button class="btn club lg" data-action="startGame"' + (sel ? '' : ' disabled') + '>Karriere starten ' + UI.icon('next') + '</button></div></section>' +
      '<p class="start-note muted small">Spielerwerte: EA SPORTS FC 27 (Launch-Ratings, Recherche über fcratings.com). Wo ein Spieler dort nicht auffindbar war, ist der Wert als geschätzt markiert (≈). Inoffizielles Fanprojekt ohne Vereinswappen, alle Marken gehören ihren Inhabern.</p>' +
      '</div></div>';
    var inp = document.getElementById('mgr');
    inp.addEventListener('input', function () { s.name = inp.value; });
    var f = document.getElementById('import-file');
    if (f) f.addEventListener('change', importFile);
  };

  function importFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        FM.importSave(r.result);
        UI.toast('Spielstand importiert.', 'good');
        UI.boot();
      } catch (err) { UI.toast(err.message || 'Import fehlgeschlagen.', 'bad'); }
    };
    r.readAsText(file);
  }
  UI.importFile = importFile;

  UI.actions.pickClub = function (el) {
    var s = UI.vs('start');
    s.club = el.getAttribute('data-id');
    UI.renderStart();
  };
  UI.actions.startGame = function () {
    var s = UI.vs('start');
    if (!s.club) return;
    var name = (s.name || '').trim() || 'Trainer';
    document.getElementById('app').innerHTML = '<div class="start"><header class="start-hero board"><div class="floodlights" aria-hidden="true"></div><div class="start-brand"><div class="eyebrow">Einen Moment</div><h1>Anpfiff wird vorbereitet</h1><p>Kader, Spielpläne, DFB-Pokal und Budgets werden angelegt.</p></div></header></div>';
    setTimeout(function () {
      FM.newGame({ club: s.club, manager: name });
      UI.slot = firstFreeSlot();
      FM.save(UI.slot);
      UI.go('dashboard');
      UI.toast('Willkommen, ' + name + '! Spielstand wird in Slot ' + UI.slot + ' gesichert.');
    }, 30);
  };
  function firstFreeSlot() {
    for (var i = 1; i <= 3; i++) { var info = FM.saveInfo(i); if (!info || info.incompatible) return i; }
    return 1;
  }
  UI.actions.loadSave = function (el) {
    var slot = +el.getAttribute('data-slot');
    if (FM.load(slot)) { UI.slot = slot; UI.go('dashboard'); UI.toast('Spielstand geladen.'); }
    else UI.toast('Laden fehlgeschlagen.', 'bad');
  };
  UI.actions.deleteSave = function (el) {
    var slot = +el.getAttribute('data-slot');
    UI.confirm('Spielstand löschen?', 'Slot ' + slot + ' wird unwiderruflich gelöscht.', 'Löschen', function () {
      FM.deleteSave(slot);
      if (FM.state) UI.closeModal(); else UI.renderStart();
    }, true);
  };

  /* ================= Weiter ================= */
  UI.actions['continue'] = function () {
    if (UI.busy) return;
    var st = FM.state;
    var fx = FM.userFixture(st);
    if (fx) { UI.go('match', { fid: fx.id }); return; }
    UI.busy = true;
    var btn = document.getElementById('btn-continue');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Simuliere …'; }
    setTimeout(function () {
      var r;
      try { r = FM.advance(st); } catch (err) { console.error(err); UI.busy = false; UI.toast('Fehler: ' + err.message, 'bad'); UI.refresh(); return; }
      UI.busy = false;
      FM.save(UI.slot || 1);
      if (r.stop === 'match') { UI.go('match', { fid: r.fixture.id }); return; }
      if (r.stop === 'seasonEnd') { UI.go('dashboard'); UI.seasonSummary(r.summary); return; }
      if (r.stop === 'fired') { UI.go('dashboard'); UI.firedModal(); return; }
      if (r.stop === 'news') { UI.go('inbox'); UI.toast('Neue wichtige Nachricht im Posteingang.'); return; }
      UI.go(UI.view === 'match' ? 'dashboard' : UI.view, UI.params, true);
    }, 20);
  };

  /* ================= Uebersicht ================= */
  UI.views.dashboard = {
    title: 'Übersicht',
    render: function () {
      var st = FM.state, uc = st.user.club, club = st.clubs[uc];
      var lid = club.league;
      var next = FM.nextUserFixture(st);
      var players = FM.clubPlayers(st, uc);
      var html = '<div class="dash-top">' + nextMatchBoard(next) + situationCard() + '</div>';
      html += '<div class="grid dash"><div class="stack">';
      html += newsCard();
      html += topPerformersCard(players);
      html += '</div><div class="stack">';
      html += miniTable(lid, uc);
      html += squadStatusCard(players);
      html += buildsCard(club);
      html += '</div></div>';
      return html;
    }
  };

  function tile(label, value, meta) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="meta">' + meta + '</div></div>';
  }
  UI.tile = tile;

  UI.compLabel = function (fx) {
    if (fx.comp === 'cup') return 'DFB-Pokal · ' + FM.CUP_ROUNDS[fx.round - 1];
    if (fx.comp === 'po1' || fx.comp === 'po2') return 'Relegation · ' + (fx.leg === 1 ? 'Hinspiel' : 'Rückspiel');
    return FM.COMP_NAME[fx.comp] + ' · ' + fx.round + '. Spieltag';
  };

  /* Naechstes Spiel als Anzeigetafel */
  function nextMatchBoard(fx) {
    var st = FM.state;
    if (!fx) return '<section class="board next"><div class="floodlights" aria-hidden="true"></div><div class="board-h"><span class="board-comp">Spielfrei</span></div><div class="board-empty">Kein Spiel angesetzt. Weiter zur nächsten Saison.</div></section>';
    var h = st.clubs[fx.home], a = st.clubs[fx.away], uc = st.user.club;
    var today = fx.date === st.date;
    function team(c, side) {
      var t = FM.ZONES[c.league] ? FM.table(st, c.league).filter(function (r) { return r.club === c.id; })[0] : null;
      var p = FM.playedRounds(st, c.league) ? FM.clubPosition(st, c.id) : null;
      return '<div class="bt ' + side + '">' + UI.badge(c, 60) + '<div class="bt-name">' + esc(c.short) + '</div>' +
        '<div class="bt-sub">' + (p ? p + '. ' + esc(st.leagues[c.league].short) : esc(st.leagues[c.league].name)) + ' · Stärke ' + FM.teamStrength(st, c.id).toFixed(1) + '</div>' + (t && t.form.length ? UI.formDots(t.form) : '') + '</div>';
    }
    var days = D.diff(st.date, fx.date);
    var when = days === 0 ? 'Heute' : days === 1 ? 'Morgen' : 'in ' + days + ' Tagen';
    return '<section class="board next" aria-label="Nächstes Spiel"><div class="floodlights" aria-hidden="true"></div>' +
      '<div class="board-h"><span class="board-comp">' + esc(UI.compLabel(fx)) + '</span><span class="board-when">' + D.fmtLong(fx.date) + ' · <b>' + when + '</b></span></div>' +
      '<div class="board-teams">' + team(h, 'home') + '<div class="bt-mid"><div class="bt-vs">' + (fx.res ? FM.scoreText(fx) : 'VS') + '</div><div class="bt-venue">' + esc(fx.neutral ? 'Olympiastadion Berlin' : h.stadium) + '</div></div>' + team(a, 'away') + '</div>' +
      '<div class="board-f"><div class="board-tags"><span>' + (fx.home === uc ? 'Heimspiel' : fx.neutral ? 'Neutraler Ort' : 'Auswärtsspiel') + '</span>' +
      (fx.agg ? '<span class="hot">Hinspiel ' + fx.agg[1] + ':' + fx.agg[0] + '</span>' : '') + '</div>' +
      '<div class="row"><button class="btn board-btn" data-action="go" data-view="tactics">' + UI.icon('tactics') + ' Aufstellung</button>' +
      (today ? '<button class="btn club" data-action="go" data-view="match" data-params=\'{"fid":"' + fx.id + '"}\'>' + UI.icon('whistle') + ' Zum Spiel</button>' : '<button class="btn club" data-action="continue">Bis zum Spieltag ' + UI.icon('next') + '</button>') +
      '</div></div></section>';
  }

  /* Lage des Vereins: Tabelle, Vorstand, Budgets, Kader */
  function situationCard() {
    var st = FM.state, uc = st.user.club, club = st.clubs[uc], lid = club.league;
    var pos = FM.playedRounds(st, lid) ? FM.clubPosition(st, uc) : null;
    var row = FM.ZONES[lid] ? FM.table(st, lid).filter(function (r) { return r.club === uc; })[0] : null;
    var conf = st.user.conf, b = FM.budget(st, club);
    var wages = FM.annualWages(st, club), room = b.wage - wages;
    var strength = FM.teamStrength(st, uc);
    var lr = (st.leagues[lid].clubs || []).map(function (c) { return FM.teamStrength(st, c); }).sort(function (x, y) { return y - x; });
    var e = club.expect || {};
    function line(k, v, sub, extra) { return '<div class="sit"><div class="sit-k">' + k + '</div><div class="sit-v">' + v + '</div><div class="sit-s">' + sub + '</div>' + (extra || '') + '</div>'; }
    return '<section class="card situation"><div class="card-h"><h3>Lage</h3><span class="muted small">' + esc(st.leagues[lid].name) + '</span></div><div class="sit-grid">' +
      line('Tabelle', pos ? pos + '.' : '–', row ? row.pts + ' Punkte · Ziel: Platz ' + (e.target || '–') : 'Ziel: ' + esc(e.label || '–')) +
      line('Vorstand', FM.confLabel(conf), 'Vertrauen ' + Math.round(conf) + ' von 100', UI.meter(conf, conf >= 45 ? '' : conf >= 25 ? 'warn' : 'bad')) +
      line('Transferbudget', b.austerity ? '<span class="bad">Sparkurs</span>' : FM.fmtMoney(b.transfer), 'von ' + FM.fmtMoney(b.start + b.earned + b.extra) + ' in dieser Saison', '<button class="link-btn" data-action="go" data-view="finances">Budget verwalten</button>') +
      line('Gehaltsbudget', FM.fmtMoney(room) + '<small> frei</small>', FM.fmtMoney(wages) + ' von ' + FM.fmtMoney(b.wage) + ' pro Jahr', UI.meter(Math.min(100, wages / Math.max(1, b.wage) * 100), room < 0 ? 'bad' : room < b.wage * 0.02 ? 'warn' : '', true)) +
      line('Kaderstärke', strength.toFixed(1), 'Rang ' + (lr.indexOf(strength) + 1) + ' in der Liga · ' + club.squad.length + ' Spieler') +
      line('Kontostand', FM.fmtMoney(club.money), 'Reserve ' + FM.fmtMoney(FM.cashReserve(st, club))) +
      '</div></section>';
  }

  UI.meter = function (v, cls, usage) {
    return '<div class="meter ' + (cls || '') + (usage ? ' usage' : '') + '" role="meter" aria-valuenow="' + Math.round(v) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + FM.clamp(Math.round(v), 0, 100) + '%"></i></div>';
  };

  function buildsCard(club) {
    var st = FM.state;
    var items = (club.builds || []).map(function (bd) {
      var f = FM.FACILITIES[bd.fac], done = Math.round((1 - bd.weeks / bd.total) * 100);
      return '<div class="li">' + UI.icon('crane', 'li-ico') + '<div class="grow"><div class="row between"><span class="strong">' + esc(f.name) + '</span><span class="muted small">noch ' + bd.weeks + ' Wo.</span></div>' +
        '<div class="muted small">' + (bd.fac === 'stadium' ? '+' + FM.fmtInt(bd.seats) + ' Plätze' : 'Ausbau auf Stufe ' + bd.toLevel) + '</div>' + UI.meter(done, 'build') + '</div></div>';
    }).join('');
    var lv = ['training', 'youth', 'medical', 'scouting', 'commercial'].map(function (k) {
      return '<span class="fac-mini" title="' + esc(FM.FACILITIES[k].name) + ' – Stufe ' + club.fac[k] + '">' + esc(FM.FACILITIES[k].short) + ' ' + UI.pips(club.fac[k]) + '</span>';
    }).join('');
    void st;
    return '<section class="card"><div class="card-h"><h3>Infrastruktur</h3><button class="btn sm ghost" data-action="go" data-view="infra">Ausbauen ' + UI.icon('next') + '</button></div>' +
      (items ? '<div class="list">' + items + '</div>' : '') +
      '<div class="card-b fac-minis">' + lv + '</div></section>';
  }

  UI.pips = function (lvl, max) {
    max = max || FM.FAC_MAX;
    var out = '';
    for (var i = 1; i <= max; i++) out += '<i class="' + (i <= lvl ? 'on' : '') + '"></i>';
    return '<span class="pips" aria-label="Stufe ' + lvl + ' von ' + max + '">' + out + '</span>';
  };

  var NEWS_ICON = { match: 'ball', transfer: 'transfer', offer: 'transfer', market: 'transfer', injury: 'medic', board: 'board', cup: 'trophy', league: 'trophy', training: 'training', youth: 'youth', info: 'info' };
  UI.newsIcon = function (n) { return '<div class="news-ico ' + n.type + '">' + UI.icon(NEWS_ICON[n.type] || 'info') + '</div>'; };

  function newsCard() {
    var st = FM.state;
    var items = st.news.slice(0, 6);
    return '<section class="card"><div class="card-h"><h3>Neuigkeiten</h3><button class="btn sm ghost" data-action="go" data-view="inbox">Alle ' + UI.icon('next') + '</button></div>' +
      '<div class="list">' + (items.length ? items.map(function (n) {
        return '<div class="li click" data-action="openNews" data-id="' + n.id + '">' + UI.newsIcon(n) +
          '<div class="grow"><div class="row between"><span class="strong ellipsis">' + esc(n.title) + '</span><span class="muted small nowrap">' + D.fmtShort(n.date) + '</span></div>' +
          '<div class="dim small ellipsis">' + esc(n.body) + '</div></div>' + (n.read ? '' : '<span class="unread-dot"></span>') + '</div>';
      }).join('') : '<div class="empty">Noch keine Nachrichten.</div>') + '</div></section>';
  }

  function miniTable(lid, uc) {
    var st = FM.state;
    if (!FM.ZONES[lid]) return '';
    var t = FM.table(st, lid);
    var i = t.findIndex(function (r) { return r.club === uc; });
    var from = Math.max(0, Math.min(i - 3, t.length - 7)), rows = t.slice(from, from + 7);
    return '<div class="card"><div class="card-h"><h3>' + esc(st.leagues[lid].name) + '</h3><button class="btn sm ghost" data-action="go" data-view="table">Tabelle ' + UI.icon('next') + '</button></div>' +
      '<div class="card-b flush"><table class="tbl compact"><thead><tr><th class="zone"></th><th class="num">#</th><th>Verein</th><th class="num">Sp</th><th class="num">Diff</th><th class="num">Pkt</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var p = t.indexOf(r) + 1;
        return '<tr class="' + (r.club === uc ? 'me' : '') + '"><td class="zone ' + FM.ZONES[lid](p) + '"></td><td class="num">' + p + '</td><td>' + UI.clubLink(r.club) + '</td><td class="num">' + r.p + '</td><td class="num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="num strong">' + r.pts + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function squadStatusCard(players) {
    var inj = players.filter(function (p) { return p.injury; });
    var sus = players.filter(function (p) { return p.susp > 0; });
    var fit = FM.avg(players, function (p) { return p.fit; });
    var exp = players.filter(function (p) { return p.contract.until <= FM.state.season.year + 1; });
    var items = inj.map(function (p) { return '<div class="li">' + UI.posTag(p.pos[0]) + '<div class="grow">' + UI.playerLink(p) + '<div class="muted small">' + esc(p.injury.type) + '</div></div><span class="tag bad">' + p.injury.days + ' Tage</span></div>'; })
      .concat(sus.map(function (p) { return '<div class="li">' + UI.posTag(p.pos[0]) + '<div class="grow">' + UI.playerLink(p) + '<div class="muted small">Gesperrt</div></div><span class="tag warn">' + p.susp + ' Sp.</span></div>'; }));
    return '<div class="card"><div class="card-h"><h3>Kaderstatus</h3><button class="btn sm ghost" data-action="go" data-view="squad">Kader ' + UI.icon('next') + '</button></div>' +
      '<div class="card-b"><div class="kpi-line"><div><div class="muted small">Ø Fitness</div><div class="strong">' + Math.round(fit) + ' %</div></div>' +
      '<div><div class="muted small">Verletzt</div><div class="strong">' + inj.length + '</div></div><div><div class="muted small">Gesperrt</div><div class="strong">' + sus.length + '</div></div>' +
      '<div><div class="muted small">Verträge enden</div><div class="strong">' + exp.length + '</div></div></div></div>' +
      (items.length ? '<div class="list" style="border-top:1px solid var(--line)">' + items.join('') + '</div>' : '') + '</div>';
  }

  function topPerformersCard(players) {
    var withApps = players.filter(function (p) { return p.st.apps > 0; });
    if (!withApps.length) return '';
    var top = withApps.slice().sort(function (a, b) { return (b.st.goals * 2 + b.st.assists) - (a.st.goals * 2 + a.st.assists) || (FM.avgGrade(a) || 9) - (FM.avgGrade(b) || 9); }).slice(0, 5);
    return '<div class="card"><div class="card-h"><h3>Topspieler der Saison</h3></div><div class="card-b flush"><table class="tbl compact"><thead><tr><th>Spieler</th><th class="num">Sp</th><th class="num">T</th><th class="num">V</th><th class="num">Ø</th></tr></thead><tbody>' +
      top.map(function (p) { return '<tr><td>' + UI.playerLink(p) + '</td><td class="num">' + p.st.apps + '</td><td class="num">' + p.st.goals + '</td><td class="num">' + p.st.assists + '</td><td class="num">' + UI.grade(FM.avgGrade(p) != null ? FM.round1(FM.avgGrade(p)) : null) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  /* ================= Posteingang ================= */
  UI.views.inbox = {
    title: 'Posteingang',
    render: function () {
      var st = FM.state, s = UI.vs('inbox', { f: 'all', sel: null });
      var groups = { all: null, match: ['match'], transfer: ['transfer', 'offer', 'market'], club: ['board', 'youth', 'training', 'info', 'league', 'cup'], injury: ['injury'] };
      var list = st.news.filter(function (n) { return !groups[s.f] || groups[s.f].indexOf(n.type) >= 0; });
      var sel = st.news.filter(function (n) { return n.id === s.sel; })[0] || list[0];
      if (sel && !sel.read) { sel.read = true; }
      var html = '<div class="page-h"><div><h1>Posteingang</h1><div class="sub">' + FM.unreadCount(st) + ' ungelesen</div></div><div class="row wrap">' +
        UI.seg('f', [['all', 'Alle'], ['match', 'Spiele'], ['transfer', 'Transfers'], ['club', 'Verein'], ['injury', 'Medizin']], s.f) +
        '<button class="btn sm" data-action="markAllRead">' + UI.icon('check') + ' Alle gelesen</button></div></div>';
      html += '<div class="grid dash"><div class="card"><div class="list">' + (list.length ? list.slice(0, 120).map(function (n) {
        return '<div class="li click' + (sel && n.id === sel.id ? ' sel' : '') + '" data-action="openNews" data-id="' + n.id + '" style="' + (sel && n.id === sel.id ? 'background:var(--surface-2)' : '') + '">' + UI.newsIcon(n) +
          '<div class="grow"><div class="row between"><span class="' + (n.read ? '' : 'strong ') + 'ellipsis">' + esc(n.title) + '</span><span class="muted small nowrap">' + D.fmtShort(n.date) + '</span></div>' +
          '<div class="muted small ellipsis">' + esc(n.body) + '</div></div>' + (n.read ? '' : '<span class="unread-dot"></span>') + '</div>';
      }).join('') : '<div class="empty">Keine Nachrichten in dieser Kategorie.</div>') + '</div></div>';
      html += '<div class="card" style="position:sticky;top:76px">' + (sel ? newsDetail(sel) : '<div class="empty">Wähle eine Nachricht.</div>') + '</div></div>';
      return html;
    }
  };

  function newsDetail(n) {
    var st = FM.state, act = '';
    if (n.action && n.action.kind === 'offer') {
      var o = st.offers.filter(function (x) { return x.id === n.action.id; })[0];
      if (o && o.status === 'open') {
        var p = st.players[o.pid];
        act = '<div class="modal-f"><button class="btn" data-action="offerRespond" data-id="' + o.id + '" data-ok="0">Ablehnen</button>' +
          (p ? '<button class="btn ghost" data-action="player" data-id="' + p.id + '">Spieler ansehen</button>' : '') +
          '<button class="btn primary" data-action="offerRespond" data-id="' + o.id + '" data-ok="1">Annehmen (' + FM.fmtMoney(o.fee) + ')</button></div>';
      } else if (o) {
        act = '<div class="card-b"><span class="tag">' + ({ accepted: 'Angenommen', declined: 'Abgelehnt', expired: 'Abgelaufen' }[o.status] || o.status) + '</span></div>';
      }
    }
    if (n.action && n.action.kind === 'budget') {
      act = '<div class="modal-f"><button class="btn club" data-action="go" data-view="finances">' + UI.icon('wallet') + ' Budget ansehen</button></div>';
    }
    if (n.ref && st.fixtures[n.ref] && st.fixtures[n.ref].res && st.fixtures[n.ref].res.pl) {
      act = '<div class="modal-f"><button class="btn" data-action="matchReport" data-id="' + n.ref + '">Spielbericht ansehen</button></div>';
    }
    return '<div class="card-h" style="align-items:flex-start">' + UI.newsIcon(n) + '<div class="grow" style="flex:1"><h3>' + esc(n.title) + '</h3><div class="muted small">' + D.fmtLong(n.date) + '</div></div></div>' +
      '<div class="card-b"><p class="dim" style="line-height:1.6">' + esc(n.body) + '</p></div>' + act;
  }

  UI.actions.openNews = function (el) {
    var id = el.getAttribute('data-id');
    var n = FM.state.news.filter(function (x) { return x.id === id; })[0];
    if (n) n.read = true;
    if (UI.view !== 'inbox') { UI.vs('inbox').sel = id; UI.go('inbox'); return; }
    UI.vs('inbox').sel = id;
    UI.refresh();
  };
  UI.actions.markAllRead = function () { FM.state.news.forEach(function (n) { n.read = true; }); UI.refresh(); };
  UI.actions.offerRespond = function (el) {
    var r = FM.respondOffer(FM.state, el.getAttribute('data-id'), el.getAttribute('data-ok') === '1');
    UI.toast(r.msg, r.ok ? 'good' : 'bad');
    FM.save(UI.slot || 1);
    UI.refresh();
  };

  /* ================= Verein & Vorstand ================= */
  UI.views.club = {
    title: 'Verein & Vorstand',
    render: function () {
      var st = FM.state, uc = st.user.club, c = st.clubs[uc];
      var e = c.expect || {};
      var conf = st.user.conf;
      var pos = FM.clubPosition(st, uc);
      var html = '<div class="page-h"><div class="row">' + UI.badge(c, 52) + '<div><h1>' + esc(c.name) + '</h1><div class="sub">' + esc(c.stadium) + ' · ' + FM.fmtInt(c.cap) + ' Plätze · ' + esc(st.leagues[c.league].name) + '</div></div></div></div>';
      html += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Vorstand</h3></div><div class="card-b">' +
        '<dl class="kv"><dt>Saisonziel</dt><dd>' + esc(e.label || '–') + '</dd><dt>Mindestens Platz</dt><dd>' + (e.target || '–') + '</dd><dt>Aktueller Platz</dt><dd>' + (pos || '–') + '</dd><dt>Stärke-Rang vor der Saison</dt><dd>' + (e.strengthRank || '–') + '</dd></dl>' +
        '<div style="margin-top:16px"><div class="row between small"><span class="muted">Vertrauen</span><b>' + FM.confLabel(conf) + ' (' + Math.round(conf) + ')</b></div>' +
        '<div class="meter ' + (conf >= 45 ? '' : conf >= 25 ? 'warn' : 'bad') + '" style="margin-top:6px"><i style="width:' + Math.round(conf) + '%"></i></div></div>' +
        '<p class="muted small" style="margin-top:12px">Das Vertrauen steigt mit Ergebnissen über den Erwartungen und sinkt bei Pleiten gegen schwächere Gegner. Fällt es zu tief, wirst du entlassen.</p></div></div>';
      html += '<div class="card"><div class="card-h"><h3>Verein</h3></div><div class="card-b"><dl class="kv">' +
        '<dt>Reputation</dt><dd>' + UI.stars(c.rep / 20) + ' ' + c.rep + '</dd><dt>Stadion</dt><dd>' + esc(c.stadium) + '</dd><dt>Kapazität</dt><dd>' + FM.fmtInt(c.cap) + '</dd>' +
        '<dt>Kontostand</dt><dd>' + FM.fmtMoney(c.money) + '</dd><dt>Transferbudget</dt><dd>' + FM.fmtMoney(FM.budget(st, c).transfer) + '</dd><dt>Gehaltsbudget</dt><dd>' + FM.fmtMoney(FM.budget(st, c).wage) + '</dd>' +
        '<dt>Kader</dt><dd>' + c.squad.length + ' Spieler</dd><dt>Trainer</dt><dd>' + esc(st.user.name) + ' (seit ' + st.user.joined + ')</dd></dl>' +
        '<div class="row wrap" style="margin-top:14px"><button class="btn sm" data-action="go" data-view="finances">' + UI.icon('wallet') + ' Budget</button><button class="btn sm" data-action="go" data-view="infra">' + UI.icon('stadium') + ' Infrastruktur</button></div></div></div></div>';
      var hist = c.hist.slice().reverse();
      html += '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Vereinshistorie (im Spiel)</h3></div><div class="card-b flush">' +
        (hist.length ? '<table class="tbl"><thead><tr><th>Saison</th><th>Liga</th><th class="num">Platz</th><th class="num">Punkte</th></tr></thead><tbody>' +
          hist.map(function (h) { return '<tr><td>' + h.y + '/' + String(h.y + 1).slice(2) + '</td><td>' + esc(FM.COMP_NAME[h.league]) + '</td><td class="num">' + h.pos + '.</td><td class="num">' + h.pts + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">Noch keine abgeschlossene Saison.</div>') + '</div></div>';
      var car = st.user.seasons.slice().reverse();
      html += '<div class="card"><div class="card-h"><h3>Deine Trainerkarriere</h3></div><div class="card-b flush">' +
        (car.length ? '<table class="tbl"><thead><tr><th>Saison</th><th>Verein</th><th class="num">Platz</th><th class="num">Ziel</th></tr></thead><tbody>' +
          car.map(function (h) { return '<tr><td>' + h.y + '/' + String(h.y + 1).slice(2) + '</td><td>' + UI.clubLink(h.club) + '</td><td class="num ' + (h.pos <= h.target ? 'good' : 'bad') + '">' + h.pos + '.</td><td class="num">' + h.target + '.</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">Deine erste Saison läuft.</div>') +
        (st.user.firedCount ? '<div class="card-b muted small">Entlassungen: ' + st.user.firedCount + '</div>' : '') + '</div></div></div>';
      return html;
    }
  };

  /* ================= Einstellungen ================= */
  UI.actions.settings = function () {
    var theme = 'auto';
    try { theme = localStorage.getItem('matchplan.theme') || 'auto'; } catch (e) { /* egal */ }
    var st = FM.state;
    var slots = [1, 2, 3].map(function (i) {
      var info = FM.saveInfo(i);
      return '<div class="li"><div class="grow"><div class="strong">Slot ' + i + (UI.slot === i ? ' <span class="tag accent">aktiv</span>' : '') + '</div><div class="muted small">' +
        (info && !info.incompatible ? esc(info.club) + ' · ' + D.fmt(info.date) : info ? 'Inkompatibel' : 'Leer') + '</div></div>' +
        '<button class="btn sm" data-action="saveSlot" data-slot="' + i + '">Hier speichern</button>' +
        (info && !info.incompatible && UI.slot !== i ? '<button class="btn sm ghost" data-action="loadSave" data-slot="' + i + '">Laden</button>' : '') + '</div>';
    }).join('');
    UI.modal(UI.modalHead('Einstellungen') +
      '<div class="modal-b"><div class="stack">' +
      '<div><h4 style="margin-bottom:8px">Darstellung</h4>' +
      '<div class="seg">' + [['auto', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(function (o) { return '<button data-action="setTheme" data-v="' + o[0] + '" class="' + (theme === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div><h4 style="margin-bottom:8px">Live-Spiel Geschwindigkeit</h4><div class="seg">' + [[0, 'Langsam'], [1, 'Normal'], [2, 'Schnell'], [3, 'Turbo']].map(function (o) { return '<button data-action="setSpeed" data-v="' + o[0] + '" class="' + (st.settings.speed === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div><h4 style="margin-bottom:8px">Spielstände</h4><div class="card"><div class="list">' + slots + '</div></div>' +
      '<div class="row wrap" style="margin-top:10px">' + (window.FM_ARTIFACT ? '' : '<button class="btn sm" data-action="exportSave">' + UI.icon('download') + ' Als Datei exportieren</button>') +
      '<label class="btn sm">' + UI.icon('upload') + ' Datei importieren<input type="file" accept="application/json" id="import-file2" hidden></label></div>' +
      '<p class="muted small" style="margin-top:8px">Der Spielstand wird nach jedem Spieltag automatisch im aktiven Slot gesichert (Browser-Speicher).</p></div>' +
      '<div><h4 style="margin-bottom:6px">Datenquellen</h4><p class="muted small" style="line-height:1.6">Kader und Ligen: Saison 2026/27. Spielerwerte: EA SPORTS FC 27 Launch-Ratings (recherchiert über fcratings.com, ergänzt um EA-/FUTBIN-Angaben). ' +
      'Markierungen: <b>≈</b> geschätzter Wert (Spieler im Kader 2026/27, aber nicht in der FC-27-Datenbank gefunden), <b>²⁶</b> letzter verfügbarer FC-26-Stand. Akademie-Spieler sind fiktiv.</p></div>' +
      '</div></div><div class="modal-f"><button class="btn danger" data-action="toMenu">Zum Hauptmenü</button><button class="btn primary" data-action="closeModal">Fertig</button></div>',
      { mount: function (m) { var f = m.querySelector('#import-file2'); if (f) f.addEventListener('change', UI.importFile); } });
  };
  UI.actions.setTheme = function (el) { UI.theme(el.getAttribute('data-v')); UI.actions.settings(); };
  UI.actions.setSpeed = function (el) { FM.state.settings.speed = +el.getAttribute('data-v'); UI.actions.settings(); };
  UI.actions.saveSlot = function (el) {
    var slot = +el.getAttribute('data-slot');
    UI.slot = slot;
    if (FM.save(slot)) UI.toast('In Slot ' + slot + ' gespeichert.', 'good');
    UI.actions.settings();
  };
  UI.actions.exportSave = function () {
    var blob = FM.exportSave();
    var a = document.createElement('a');
    var c = FM.state.clubs[FM.state.user.club];
    a.href = URL.createObjectURL(blob);
    a.download = 'matchplan-' + c.abbr.toLowerCase() + '-' + FM.state.date + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  UI.actions.toMenu = function () {
    UI.confirm('Zum Hauptmenü?', 'Der aktuelle Stand wird vorher in Slot ' + (UI.slot || 1) + ' gespeichert.', 'Speichern & verlassen', function () {
      FM.save(UI.slot || 1);
      FM.state = null;
      UI.renderStart();
    });
  };

  /* ================= Saisonbilanz & Entlassung ================= */
  UI.seasonSummary = function (sm) {
    var st = FM.state, u = sm.user;
    var club = st.clubs[u.club];
    var ok = u.pos && u.pos <= u.target;
    var banner = u.promoted ? '<div class="note good"><b>Aufstieg!</b> ' + esc(club.name) + ' spielt nächste Saison eine Liga höher.</div>' :
      u.relegated ? '<div class="note bad"><b>Abstieg.</b> ' + esc(club.name) + ' muss eine Liga tiefer antreten.</div>' : '';
    function champ(lid) {
      var t = sm.tables[lid]; if (!t) return '';
      var a = sm.awards[lid], sc = a ? { name: a.name || (st.players[a.scorer] && st.players[a.scorer].name) || '' } : null;
      return '<div class="li">' + UI.badge(st.clubs[t[0].club], 30) + '<div class="grow"><div class="strong">' + esc(st.clubs[t[0].club].name) + '</div><div class="muted small">Meister ' + esc(FM.COMP_NAME[lid]) + ' · ' + t[0].pts + ' Punkte</div></div>' +
        (sc ? '<div class="small" style="text-align:right"><div class="muted">Torschützenkönig</div><b>' + esc(sc.name) + '</b> (' + a.goals + ')</div>' : '') + '</div>';
    }
    var names = function (arr) { return arr.map(function (c) { return esc(st.clubs[c].short); }).join(', '); };
    UI.modal(UI.modalHead('Saison ' + sm.year + '/' + String(sm.year + 1).slice(2) + ' – Bilanz', esc(club.name)) +
      '<div class="modal-b"><div class="stack">' +
      '<div class="grid g3">' + tile('Abschlussplatz', (u.pos || '–') + '.', esc(FM.COMP_NAME[u.league] || '')) + tile('Saisonziel', 'Platz ' + u.target, esc(u.expect)) +
      tile('Bewertung', ok ? 'Ziel erreicht' : 'Ziel verfehlt', 'Vorstand: ' + FM.confLabel(u.conf)) + '</div>' + banner +
      (u.cupWinner ? '<div class="note good"><b>DFB-Pokalsieger!</b> Dein Team holt den Pott.</div>' : '') +
      '<div class="card"><div class="list">' + champ('bl') + champ('bl2') + champ('l3') +
      '<div class="li">' + UI.badge(st.clubs[sm.awards.cup], 30) + '<div class="grow"><div class="strong">' + esc(st.clubs[sm.awards.cup].name) + '</div><div class="muted small">DFB-Pokalsieger</div></div></div></div></div>' +
      (sm.groups ? '<div class="grid g2">' +
        '<div><h4>Neu in der Bundesliga</h4><p class="dim small" style="margin-top:4px">' + names(sm.groups.toBL) + '</p></div>' +
        '<div><h4>Neu in der 2. Bundesliga</h4><p class="dim small" style="margin-top:4px">' + names(sm.groups.toBL2) + '</p></div>' +
        '<div><h4>Neu in der 3. Liga</h4><p class="dim small" style="margin-top:4px">' + names(sm.groups.toL3) + '</p></div>' +
        '<div><h4>Abstieg in die Regionalliga</h4><p class="dim small" style="margin-top:4px">' + names(sm.groups.toRL) + '</p></div></div>' :
      '<div class="grid g2"><div><h4>Aufsteiger</h4><p class="dim small" style="margin-top:4px">' + names(sm.moves.up) + '</p></div><div><h4>Absteiger</h4><p class="dim small" style="margin-top:4px">' + names(sm.moves.down) + '</p></div></div>') +
      '<p class="muted small">Verträge sind ausgelaufen, Spieler sind ein Jahr älter geworden, die Akademie hat neue Talente geschickt. Das Transferfenster ist geöffnet.</p>' +
      '</div></div><div class="modal-f"><button class="btn primary" data-action="closeModal">Neue Saison ' + (sm.year + 1) + '/' + String(sm.year + 2).slice(2) + ' ' + UI.icon('next') + '</button></div>',
      { size: 'wide', onClose: function () { if (FM.state.user.fired) UI.firedModal(); else UI.refresh(); } });
  };

  UI.firedModal = function () {
    var st = FM.state;
    var offers = FM.jobOffers(st);
    var cards = offers.map(function (cid) {
      var c = st.clubs[cid];
      return '<button class="club-card" data-action="takeJob" data-id="' + cid + '">' + UI.badge(c, 38) + '<div><div class="n">' + esc(c.name) + '</div><div class="s">' + esc(st.leagues[c.league].name) + ' · ' + esc(c.expect ? c.expect.label : '') + '</div></div></button>';
    }).join('');
    UI.modal('<div class="modal-h"><div class="grow"><h2>Du wurdest entlassen</h2><div class="muted small">' + esc(st.clubs[st.user.club].name) + ' hat sich von dir getrennt.</div></div></div>' +
      '<div class="modal-b"><p class="dim" style="margin-bottom:14px">Andere Vereine sind auf dich aufmerksam geworden. Nimm ein Angebot an oder beginne eine neue Karriere.</p>' +
      (cards ? '<div class="club-grid">' + cards + '</div>' : '<div class="empty">Derzeit keine Angebote.</div>') + '</div>' +
      '<div class="modal-f"><button class="btn" data-action="toMenuNoSave">Neue Karriere</button></div>', { size: 'wide' });
  };
  UI.actions.takeJob = function (el) {
    FM.takeJob(FM.state, el.getAttribute('data-id'));
    FM.save(UI.slot || 1);
    UI.closeModal();
    UI.go('dashboard');
    UI.toast('Willkommen beim neuen Verein!', 'good');
  };
  UI.actions.toMenuNoSave = function () { UI.closeModal(); FM.state = null; UI.renderStart(); };
})();
