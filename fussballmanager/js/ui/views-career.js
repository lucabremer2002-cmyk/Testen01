/* Ansicht: Karriere – Ruf, Bilanz, Titel, Meilensteine, Trainermarkt, Ehrentafel. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var TITLE = { bl: 'Deutscher Meister', bl2: 'Meister 2. Bundesliga', l3: 'Meister 3. Liga', cup: 'DFB-Pokalsieger', cl: 'Champions-League-Sieger', el: 'Europa-League-Sieger', ecl: 'Conference-League-Sieger', up: 'Aufstieg' };
  function season(y) { return y + '/' + String(y + 1).slice(2); }
  function tile(label, value, meta) { return '<div class="card stat"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="meta">' + meta + '</div></div>'; }

  UI.views.career = {
    title: 'Karriere',
    render: function () {
      var st = FM.state, u = FM.careerUser(st), club = st.clubs[u.club];
      var s = UI.vs('career', { tab: 'me' });
      var rec = u.rec, quote = rec.p ? Math.round(rec.w / rec.p * 100) : 0;
      var done = FM.ACH.filter(function (a) { return u.ach[a[0]]; }).length;
      var html = '<div class="page-h"><div><div class="eyebrow">Trainerkarriere</div><h1>' + esc(u.name) + '</h1><div class="sub">' + esc(club.name) + ' · im Amt seit ' + u.joined + ' · Ruf: ' + FM.REP_LABEL(u.rep) + '</div></div>' +
        UI.seg('tab', [['me', 'Profil'], ['ach', 'Meilensteine'], ['market', 'Trainermarkt'], ['hall', 'Ehrentafel']], s.tab) + '</div>';
      html += '<div class="grid g4" style="margin-bottom:16px">' +
        tile('Ruf', UI.stars(u.rep / 20), u.rep + ' von 100 · ' + FM.REP_LABEL(u.rep)) +
        tile('Pflichtspiele', rec.p, rec.w + ' S · ' + rec.d + ' U · ' + rec.l + ' N · ' + quote + ' % Siege') +
        tile('Titel', u.titles.filter(function (t) { return t.k !== 'up'; }).length, u.titles.filter(function (t) { return t.k === 'up'; }).length + ' Aufstiege') +
        tile('Meilensteine', done + ' / ' + FM.ACH.length, 'längste Siegesserie: ' + u.run.bw) + '</div>';

      if (s.tab === 'me') {
        var car = u.seasons.slice().reverse();
        html += '<div class="grid g2"><div class="stack"><div class="card"><div class="card-h"><h3>Stationen</h3></div><div class="card-b flush">' +
          (car.length ? '<table class="tbl"><thead><tr><th>Saison</th><th>Verein</th><th class="hide-xs">Liga</th><th class="num">Platz</th><th class="num">Ziel</th></tr></thead><tbody>' + car.map(function (h) {
            return '<tr><td>' + season(h.y) + '</td><td>' + UI.clubLink(h.club) + '</td><td class="hide-xs small dim">' + esc(FM.COMP_NAME[h.league] || 'Regionalliga') + '</td><td class="num ' + (h.pos && h.pos <= h.target ? 'good' : 'bad') + '">' + (h.pos || '–') + '.</td><td class="num">' + h.target + '.</td></tr>';
          }).join('') + '</tbody></table>' : '<div class="empty">Deine erste Saison läuft.</div>') + (u.firedCount ? '<div class="card-b muted small">Entlassungen: ' + u.firedCount + '</div>' : '') + '</div></div>' +
          '<div class="card"><div class="card-h"><h3>So wächst dein Ruf</h3></div><div class="card-b"><p class="dim" style="margin:0">Jeder Platz über dem Saisonziel zählt, ebenso Aufstiege, Titel und lange Europapokalreisen. Abstiege und Entlassungen kosten Ansehen. Mit dem Ruf steigen die Chancen auf Angebote größerer Vereine: ' +
          'Für ' + esc(club.short) + ' erwartet man etwa ' + FM.jobNeed(club) + ' Punkte, für einen Spitzenklub der Bundesliga über 50.</p></div></div></div>';
        var recs = u.recs || {};
        html += '<div class="stack"><div class="card"><div class="card-h"><h3>Titel und Erfolge</h3></div><div class="list">' +
          (u.titles.length ? u.titles.slice().reverse().map(function (t) {
            var c = st.clubs[t.club];
            return '<div class="li">' + UI.badge(c, 28) + '<div class="grow"><div class="strong">' + TITLE[t.k] + '</div><div class="muted small">' + season(t.y) + ' · ' + esc(c ? c.name : '') + '</div></div><span class="tag accent">' + UI.icon('trophy').replace('<svg', '<svg width="13" height="13"') + '</span></div>';
          }).join('') : '<div class="empty">Noch kein Titel. Der erste schmeckt am besten.</div>') + '</div></div>' +
          '<div class="card"><div class="card-h"><h3>Rekorde deiner Laufbahn</h3></div><div class="card-b"><dl class="kv">' +
          '<dt>Höchster Sieg</dt><dd>' + (recs.win ? esc(recs.win.t) : '–') + '</dd><dt>Höchste Niederlage</dt><dd>' + (recs.loss ? esc(recs.loss.t) : '–') + '</dd>' +
          '<dt>Zuschauerrekord (Heim)</dt><dd>' + (recs.att ? esc(recs.att.t) : '–') + '</dd><dt>Längste Siegesserie</dt><dd>' + u.run.bw + ' Spiele</dd><dt>Längste Serie ohne Niederlage</dt><dd>' + u.run.bu + ' Spiele</dd>' +
          '<dt>Tore</dt><dd>' + rec.gf + ' : ' + rec.ga + '</dd></dl></div></div></div></div>';
        return html;
      }

      if (s.tab === 'ach') {
        return html + '<div class="ach-grid">' + FM.ACH.map(function (a) {
          var got = u.ach[a[0]];
          return '<div class="ach' + (got ? ' got' : '') + '"><div class="ach-ico">' + UI.icon(got ? 'trophy' : 'star') + '</div><div><div class="strong">' + esc(a[1]) + '</div><div class="muted small">' + esc(a[2]) + '</div>' + (got ? '<div class="tiny" style="margin-top:4px">erreicht am ' + D.fmt(got) + '</div>' : '') + '</div></div>';
        }).join('') + '</div>';
      }

      if (s.tab === 'market') {
        var jobs = (st.jobs || []).filter(function (j) { return j.until >= st.date; });
        var log = st.coachLog || [];
        html += '<div class="grid g2"><div class="stack"><div class="card"><div class="card-h"><h3>Angebote für dich</h3></div><div class="list">' +
          (jobs.length ? jobs.map(function (j) {
            var c = st.clubs[j.club];
            return '<div class="li">' + UI.badge(c, 32) + '<div class="grow"><div class="strong">' + esc(c.name) + '</div><div class="muted small">' + esc(FM.leagueName(st, c)) + ' · ' + esc(c.expect ? c.expect.label : '') + ' · gültig bis ' + D.fmt(j.until) + '</div></div>' +
              '<button class="btn sm" data-action="jobDecline" data-id="' + j.id + '">Absagen</button><button class="btn sm primary" data-action="jobAccept" data-id="' + j.id + '">Annehmen</button></div>';
          }).join('') : '<div class="empty">Derzeit liegt kein Angebot vor. Erfolge sprechen sich herum – vor allem, wenn anderswo ein Trainer gehen muss.</div>') + '</div></div>' +
          '<div class="card"><div class="card-h"><h3>Wer passt zu deinem Ruf?</h3><span class="muted small">dein Ruf: ' + u.rep + '</span></div><div class="card-b flush"><table class="tbl compact"><thead><tr><th>Verein</th><th class="num">erwartet</th><th>Trainer</th></tr></thead><tbody>' +
          Object.keys(st.clubs).map(function (k) { return st.clubs[k]; }).filter(function (c) { return !c.guest && !c.reserve && FM.ZONES[c.league] && c.id !== u.club; })
            .sort(function (a, b) { return b.rep - a.rep; }).filter(function (c) { return FM.jobNeed(c) <= u.rep + 12; }).slice(0, 12).map(function (c) {
              var need = FM.jobNeed(c);
              return '<tr><td>' + UI.clubLink(c.id) + '</td><td class="num ' + (need <= u.rep ? 'good' : '') + '">' + need + '</td><td class="small dim">' + (c.coach ? esc(c.coach.name) + ' <span class="muted">seit ' + c.coach.since.slice(0, 4) + '</span>' : '<span class="tag warn">vakant</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div></div></div>';
        html += '<div class="card"><div class="card-h"><h3>Trainerkarussell</h3><span class="muted small">letzte Wechsel</span></div><div class="list">' +
          (log.length ? log.slice(0, 18).map(function (l) {
            var c = st.clubs[l.club];
            return '<div class="li">' + UI.badge(c, 26) + '<div class="grow" style="min-width:0"><div class="ellipsis"><span class="strong">' + esc(c.short) + '</span>: ' + (l.inn ? esc(l.inn) + ' übernimmt' : 'Stelle vakant') + '</div><div class="muted small ellipsis">' + (l.out ? 'für ' + esc(l.out) + ' · ' : '') + esc(l.why) + '</div></div><span class="muted small nowrap">' + D.fmtShort(l.date) + '</span></div>';
          }).join('') : '<div class="empty">Noch hat kein Verein seinen Trainer gewechselt.</div>') + '</div></div></div>';
        return html;
      }

      // Ehrentafel
      var hist = (st.hist || []).slice().reverse();
      var cell = function (cid) { return cid && st.clubs[cid] ? UI.clubLink(cid) : '<span class="muted">–</span>'; };
      return html + '<div class="card"><div class="card-h"><h3>Ehrentafel</h3><span class="muted small">alle Sieger seit Spielbeginn</span></div><div class="tbl-wrap">' +
        (hist.length ? '<table class="tbl"><thead><tr><th>Saison</th><th>Meister</th><th>DFB-Pokal</th><th>Champions League</th><th class="hide-sm">Europa League</th><th class="hide-sm">Conference League</th><th class="hide-sm">2. Liga</th><th class="hide-sm">3. Liga</th><th class="hide-xs">Torjäger</th><th>Du</th></tr></thead><tbody>' +
          hist.map(function (h) {
            return '<tr><td class="nowrap">' + season(h.y) + '</td><td>' + cell(h.bl) + '</td><td>' + cell(h.cup) + '</td><td>' + cell(h.cl) + '</td><td class="hide-sm">' + cell(h.el) + '</td><td class="hide-sm">' + cell(h.ecl) + '</td><td class="hide-sm">' + cell(h.bl2) + '</td><td class="hide-sm">' + cell(h.l3) + '</td>' +
              '<td class="hide-xs small dim">' + esc(h.sc || '–') + '</td><td class="small nowrap">' + (h.u && st.clubs[h.u.club] ? esc(st.clubs[h.u.club].abbr) + ' · ' + (h.u.pos || '–') + '.' : '–') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<div class="empty">Die Ehrentafel füllt sich nach der ersten Saison.</div>') + '</div></div>';
    }
  };
})();
