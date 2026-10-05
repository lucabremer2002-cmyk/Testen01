/* Ansicht: Infrastruktur (Stadion, Trainingszentrum, NLZ, Medizin, Scouting, Marketing). */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc;

  function pct(v) { var d = Math.round((v - 1) * 100); return (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + ' %'; }

  /* Wirkung einer Abteilung auf einer bestimmten Stufe */
  function effects(club, key, lvl) {
    var c = { fac: {}, facBase: club.facBase, commercial: club.commercial };
    Object.keys(club.fac).forEach(function (k) { c.fac[k] = club.fac[k]; });
    c.fac[key] = lvl;
    switch (key) {
      case 'training': return ['Spielerentwicklung ' + pct(FM.facDev(c)), 'Trainingsverletzungen ' + pct(FM.facTrainingInj(c))];
      case 'youth': return ['Talente: Stärke ' + (FM.facYouthOvr(c) >= 0 ? '+' : '') + FM.facYouthOvr(c) + ', Potenzial ' + (FM.facYouthPot(c) >= 0 ? '+' : '') + FM.facYouthPot(c), FM.facYouthExtra(c) ? 'Ein zusätzliches Talent pro Jahrgang' : 'Ab Stufe 4: ein Talent mehr pro Jahrgang'];
      case 'medical': return ['Ausfallzeiten ' + pct(FM.facInjuryDays(c)), 'Regeneration ' + pct(FM.facRegen(c))];
      case 'scouting': {
        var sp = FM.facScoutSpread(c);
        return ['Beraterhonorar ' + Math.round(FM.agentRate(c) * 100) + ' % der Ablöse', sp ? 'Potenzial fremder Talente auf ±' + Math.round(4 * sp) + ' geschätzt' : 'Potenzial fremder Spieler exakt bekannt'];
      }
      case 'commercial': {
        var f = FM.facCommercial(c);
        return ['Sponsoring & Merchandising ' + pct(f), (f > 1 ? '+' + FM.fmtMoney((club.commercial || 0) * (f - 1)) + ' pro Saison' : 'Ausgangsniveau des Vereins')];
      }
    }
    return [];
  }

  UI.views.infra = {
    title: 'Infrastruktur',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var b = FM.budget(st, club), reserve = FM.cashReserve(st, club);
      var investable = Math.max(0, club.money - reserve);
      var unplanned = Math.max(0, investable - (b.transfer - (b.pot || 0)));
      var html = '<div class="page-h"><div><div class="eyebrow">Investitionen</div><h1>Infrastruktur</h1></div>' +
        '<p class="muted small" style="max-width:52ch">Ausbauten werden sofort bezahlt und wirken nach der Bauzeit. Stufe 3 entspricht dem Ligadurchschnitt. Jede Stufe über dem Ausgangsniveau kostet jährlichen Unterhalt.</p></div>';
      html += '<div class="budget-strip">' +
        fig('Kontostand', FM.fmtMoney(club.money), 'Reserve ' + FM.fmtMoney(reserve)) +
        fig('Investierbar', FM.fmtMoney(investable), 'Kontostand minus Reserve') +
        fig('Ohne Budgetkürzung', FM.fmtMoney(unplanned), 'nicht als Transferbudget verplant') +
        fig('Unterhalt Ausbau', FM.fmtMoney(FM.facUpkeep(club)), 'pro Jahr') + '</div>';
      html += stadiumCard(club, investable, unplanned);
      html += '<div class="fac-grid">' + ['training', 'youth', 'medical', 'scouting', 'commercial'].map(function (k) { return facCard(club, k, investable, unplanned); }).join('') + '</div>';
      return html;
    }
  };

  function fig(k, v, s) { return '<div class="bs-fig"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }

  function buildButton(club, key, q, investable, unplanned) {
    var bd = FM.facBuilding(club, key);
    if (bd) {
      var done = Math.round((1 - bd.weeks / bd.total) * 100);
      return '<div class="building"><div class="row between small"><span class="strong">' + UI.icon('crane', 'inl') + ' Im Bau</span><span class="muted">noch ' + bd.weeks + ' Wochen</span></div>' + UI.meter(done, 'build') + '</div>';
    }
    if (!q) return '<div class="muted small">Höchste Ausbaustufe erreicht.</div>';
    var b = FM.budget(FM.state, club);
    var blocked = b.austerity ? 'Während des Sparkurses gesperrt' : q.cost > investable ? 'Fehlen ' + FM.fmtMoney(q.cost - investable) + ' über der Reserve' : '';
    var cut = !blocked && q.cost > unplanned ? '<div class="muted small">Kürzt das Transferbudget um ' + FM.fmtMoney(Math.min(b.transfer - (b.pot || 0), q.cost - unplanned)) + '.</div>' : '';
    return cut + '<button class="btn club sm" data-action="build" data-k="' + key + '"' + (blocked ? ' disabled' : '') + '>' + UI.icon('crane') + ' Ausbauen für ' + FM.fmtMoney(q.cost) + '</button>' +
      (blocked ? '<div class="small bad">' + blocked + '</div>' : '');
  }

  function stadiumCard(club, investable, unplanned) {
    var st = FM.state;
    var q = FM.facQuote(club, 'stadium');
    var demand = Math.round(FM.fanDemand(club, 60));
    var a = club.attS && club.attS.n ? club.attS : club.attPrev && club.attPrev.n ? club.attPrev : null;
    var avg = a ? Math.round(a.sum / a.n) : FM.expectedAttendance(club);
    var util = avg / club.cap;
    var gain = q ? FM.stadiumGain(club, q.seats) : 0;
    var payback = gain > 0 ? q.cost / gain : null;
    var max = Math.max(club.cap + (q ? q.seats : 0), demand) * 1.05;
    var verdict = !q ? 'Die Kapazitätsgrenze ist erreicht.' :
      gain <= 0 ? 'Die Nachfrage liegt unter der Kapazität. Ein Ausbau bringt derzeit keine Mehreinnahmen.' :
      payback <= 6 ? 'Lohnt sich: Die Nachfrage übersteigt die Kapazität deutlich.' :
      payback <= 12 ? 'Langfristige Investition: Ein Teil der neuen Plätze würde verkauft.' : 'Kaum rentabel: Nur wenige zusätzliche Plätze würden verkauft.';
    return '<section class="card stadium-card"><div class="stadium-art" aria-hidden="true">' + stadiumSvg(club) + '</div>' +
      '<div class="stadium-body"><div class="card-h"><div><h3>' + esc(club.stadium) + '</h3><div class="muted small">' + esc(st.leagues[club.league].name) + ' · Ticketpreis Ø ' + (FM.ticketPrice[club.league] || 0) + ' €</div></div>' + UI.icon('stadium', 'card-ico') + '</div>' +
      '<div class="card-b"><div class="sit-grid three">' +
      '<div class="sit"><div class="sit-k">Kapazität</div><div class="sit-v">' + FM.fmtInt(club.cap) + '</div><div class="sit-s">Plätze</div></div>' +
      '<div class="sit"><div class="sit-k">' + (a ? 'Zuschauerschnitt' : 'Erwarteter Schnitt') + '</div><div class="sit-v">' + FM.fmtInt(avg) + '</div><div class="sit-s">' + Math.round(util * 100) + ' % Auslastung' + (a ? ' · ' + a.full + ' von ' + a.n + ' ausverkauft' : '') + '</div></div>' +
      '<div class="sit"><div class="sit-k">Nachfrage</div><div class="sit-v">' + FM.fmtInt(demand) + '</div><div class="sit-s">Fans pro Ligaspiel (Schätzung)</div></div></div>' +
      '<div class="capbar" role="img" aria-label="Kapazität ' + club.cap + ', Nachfrage ' + demand + '">' +
      '<i class="cap" style="width:' + (club.cap / max * 100) + '%"></i>' + (q ? '<i class="add" style="left:' + (club.cap / max * 100) + '%;width:' + (q.seats / max * 100) + '%"></i>' : '') +
      '<b class="dem" style="left:' + Math.min(100, demand / max * 100) + '%"></b></div>' +
      '<div class="capbar-legend small"><span><i class="cap"></i>Kapazität</span>' + (q ? '<span><i class="add"></i>Ausbau +' + FM.fmtInt(q.seats) + '</span>' : '') + '<span><i class="dem"></i>Nachfrage</span></div>' +
      (q ? '<dl class="kv" style="margin-top:12px"><dt>Nächster Ausbau</dt><dd>+' + FM.fmtInt(q.seats) + ' Plätze in ' + q.weeks + ' Wochen</dd><dt>Kosten</dt><dd>' + FM.fmtMoney(q.cost) + '</dd>' +
        '<dt>Mehreinnahmen pro Saison</dt><dd>' + (gain > 0 ? FM.fmtMoney(gain) : '–') + '</dd><dt>Amortisation</dt><dd>' + (payback ? FM.fmtDec(payback, 1) + ' Jahre' : '–') + '</dd></dl>' : '') +
      '<p class="small ' + (gain > 0 && payback <= 6 ? 'good' : 'muted') + '" style="margin:10px 0">' + verdict + ' Während der Bauzeit fehlen 6 % der Plätze.</p>' +
      buildButton(club, 'stadium', q, investable, unplanned) + '</div></div></section>';
  }

  /* Draufsicht auf das Stadion: Ränge wachsen mit der Kapazität */
  function stadiumSvg(club) {
    var tiers = club.cap >= 60000 ? 3 : club.cap >= 25000 ? 2 : 1;
    var out = '<svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">';
    for (var t = tiers; t >= 1; t--) {
      var pad = 8 + (tiers - t) * 14;
      out += '<rect x="' + pad + '" y="' + pad + '" width="' + (200 - pad * 2) + '" height="' + (140 - pad * 2) + '" rx="' + (26 - (tiers - t) * 4) + '" fill="var(--stand-' + t + ')"/>';
    }
    var ip = 8 + tiers * 14;
    out += '<rect x="' + ip + '" y="' + ip + '" width="' + (200 - ip * 2) + '" height="' + (140 - ip * 2) + '" rx="3" fill="var(--pitch)"/>';
    var w = 200 - ip * 2, h = 140 - ip * 2;
    for (var i = 1; i < 8; i += 2) out += '<rect x="' + (ip + w * i / 8) + '" y="' + ip + '" width="' + (w / 8) + '" height="' + h + '" fill="var(--pitch-2)"/>';
    out += '<g fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"><rect x="' + (ip + 3) + '" y="' + (ip + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '"/><line x1="100" y1="' + (ip + 3) + '" x2="100" y2="' + (140 - ip - 3) + '"/><circle cx="100" cy="70" r="' + Math.min(10, h / 5) + '"/></g>';
    if (FM.facBuilding(club, 'stadium')) out += '<rect x="2" y="2" width="196" height="136" rx="30" fill="none" stroke="var(--warn)" stroke-width="3" stroke-dasharray="8 6"/>';
    return out + '</svg>';
  }

  function facCard(club, key, investable, unplanned) {
    var f = FM.FACILITIES[key], lvl = club.fac[key], q = FM.facQuote(club, key);
    var base = club.facBase ? club.facBase[key] : lvl;
    var now = effects(club, key, lvl), next = q ? effects(club, key, lvl + 1) : null;
    return '<section class="card fac-card"><div class="card-h"><div class="row">' + UI.icon(f.icon, 'card-ico') + '<div><h3>' + esc(f.name) + '</h3><div class="muted small">Stufe ' + lvl + ' von ' + FM.FAC_MAX + (lvl > base ? ' · Ausgangsniveau ' + base : '') + '</div></div></div>' + UI.pips(lvl) + '</div>' +
      '<div class="card-b"><div class="fx"><div class="fx-h">Jetzt</div><ul>' + now.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      (next ? '<div class="fx next"><div class="fx-h">Stufe ' + (lvl + 1) + '</div><ul>' + next.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
        '<dl class="kv small"><dt>Bauzeit</dt><dd>' + q.weeks + ' Wochen</dd><dt>Unterhalt danach</dt><dd>+' + FM.fmtMoney(q.upkeep) + ' pro Jahr</dd></dl>' : '') +
      '<div class="fac-act">' + buildButton(club, key, q, investable, unplanned) + '</div></div></section>';
  }

  UI.actions.build = function (el) {
    var key = el.getAttribute('data-k'), st = FM.state, club = st.clubs[st.user.club];
    var q = FM.facQuote(club, key);
    if (!q) return;
    var b = FM.budget(st, club), reserve = FM.cashReserve(st, club);
    var unplanned = Math.max(0, club.money - reserve - (b.transfer - (b.pot || 0)));
    var cut = Math.max(0, Math.min(b.transfer - (b.pot || 0), q.cost - unplanned));
    UI.confirm(FM.FACILITIES[key].name + ' ausbauen?',
      (key === 'stadium' ? '+' + FM.fmtInt(q.seats) + ' Plätze' : 'Ausbau auf Stufe ' + q.toLevel) + ' für ' + FM.fmtMoney(q.cost) + ', fertig in ' + q.weeks + ' Wochen.' +
      (q.upkeep ? ' Danach ' + FM.fmtMoney(q.upkeep) + ' Unterhalt pro Jahr.' : '') + (cut ? ' Das Transferbudget sinkt um ' + FM.fmtMoney(cut) + '.' : ''),
      'Bau beauftragen', function () {
        var r = FM.startBuild(st, key);
        UI.toast(r.msg, r.ok ? 'good' : 'bad');
        FM.save(UI.slot || 1);
        UI.refresh();
      });
  };
})();
