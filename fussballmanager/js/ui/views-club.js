/* Ansichten: Budgets (Vorstand) und Infrastruktur. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc;

  /* ================= Budget-Leiste ================= */
  UI.budgetPanel = function (opts) {
    opts = opts || {};
    var st = FM.state, club = st.clubs[st.user.club], b = FM.budget(st, club);
    var wages = FM.annualWages(st, club), room = b.wage - wages;
    var used = b.wage ? Math.min(100, wages / b.wage * 100) : 100;
    var left = b.transfer + b.spent > 0 ? b.transfer / (b.transfer + b.spent) * 100 : 0;
    var html = '<section class="budget">' +
      '<div class="budget-cell">' +
      '<div class="eyebrow">Transferbudget</div><div class="budget-num">' + FM.fmtMoney(b.transfer) + '</div>' +
      '<div class="meter thin"><i style="width:' + left.toFixed(0) + '%"></i></div>' +
      '<div class="small dim">' + (b.austerity ? '<span class="bad">Sparkurs – nur Verkäufe möglich</span>' : (b.spent ? 'ausgegeben ' + FM.fmtMoneyShort(b.spent) : 'noch nichts ausgegeben') + (b.earned ? ' · aus Verkäufen +' + FM.fmtMoneyShort(b.earned) : '')) + '</div></div>' +
      '<div class="budget-cell">' +
      '<div class="eyebrow">Gehaltsbudget / Jahr</div><div class="budget-num">' + FM.fmtMoney(b.wage) + '</div>' +
      '<div class="meter thin ' + (used >= 98 ? 'bad' : used >= 92 ? 'warn' : '') + '"><i style="width:' + used.toFixed(0) + '%"></i></div>' +
      '<div class="small dim">gebunden ' + FM.fmtMoneyShort(wages) + ' · <span class="' + (room > 0 ? '' : 'bad') + '">Spielraum ' + FM.fmtMoneyShort(Math.max(0, room)) + '</span></div></div>' +
      '<div class="budget-cell">' +
      '<div class="eyebrow">Liquiditätsreserve</div><div class="budget-num">' + FM.fmtMoney(b.reserve) + '</div>' +
      '<div class="small dim">Kontostand ' + FM.fmtMoneyShort(club.money) + ' – darf nicht unterschritten werden</div></div>';
    if (!opts.compact) {
      html += '<div class="budget-cell actions">' +
        '<button class="btn sm" data-action="shiftDlg">' + UI.icon('swap') + ' Umschichten</button>' +
        '<button class="btn sm" data-action="askBoard"' + (b.requested ? ' disabled title="In diesem Transferfenster schon angefragt"' : '') + '>' + UI.icon('board') + ' Mehr Budget anfragen</button></div>';
    }
    return html + '</section>';
  };

  UI.actions.askBoard = function () {
    var r = FM.requestBudget(FM.state);
    UI.toast(r.msg, r.ok ? 'good' : 'bad');
    FM.save(UI.slot || 1);
    UI.refresh();
  };

  UI.actions.shiftDlg = function () {
    var st = FM.state, club = st.clubs[st.user.club], b = FM.budget(st, club);
    var maxUp = Math.floor(b.transfer / 50000) * 50000;
    var maxDown = Math.floor(Math.max(0, FM.wageRoom(st, club)) / 50000) * 50000;
    if (!maxUp && !maxDown) { UI.toast('Es gibt nichts umzuschichten – beide Budgets sind ausgeschöpft.', 'bad'); return; }
    UI.modal(UI.modalHead('Budget umschichten', 'Ein Euro Transferbudget entspricht einem Euro Jahresgehalt') +
      '<div class="modal-b"><div class="stack">' +
      '<p class="dim small">Nach links gibst du Gehaltsspielraum an das Transferbudget ab, nach rechts machst du Ablösesummen zu Gehaltsspielraum – etwa um einen Leistungsträger zu halten oder einen ablösefreien Star zu bezahlen.</p>' +
      '<input type="range" id="sh-r" min="' + (-maxDown) + '" max="' + maxUp + '" step="50000" value="0">' +
      '<div class="shift-out"><div><div class="eyebrow">Transferbudget</div><div class="budget-num" id="sh-t"></div></div>' +
      '<div class="shift-arrow">' + UI.icon('swap') + '</div>' +
      '<div style="text-align:right"><div class="eyebrow">Gehaltsbudget</div><div class="budget-num" id="sh-w"></div></div></div>' +
      '</div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn primary" id="sh-ok">Übernehmen</button></div>',
      { size: 'narrow', mount: function (m) {
        var r = m.querySelector('#sh-r');
        function upd() {
          var v = +r.value;
          m.querySelector('#sh-t').textContent = FM.fmtMoney(b.transfer - v);
          m.querySelector('#sh-w').textContent = FM.fmtMoney(b.wage + v);
        }
        r.addEventListener('input', upd); upd();
        m.querySelector('#sh-ok').addEventListener('click', function () {
          var v = +r.value;
          if (v) { FM.shiftBudget(st, club, v); FM.save(UI.slot || 1); UI.toast('Budget umgeschichtet.', 'good'); }
          UI.closeModal(); UI.refresh();
        });
      } });
  };

  /* ================= Infrastruktur ================= */
  UI.views.infra = {
    title: 'Infrastruktur',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var reserve = FM.cashReserve(st, club);
      var free = club.money - reserve;
      var html = '<div class="page-h"><div><div class="eyebrow">' + esc(club.name) + '</div><h1>Infrastruktur</h1>' +
        '<div class="sub">Investitionen zahlt der Verein direkt vom Konto. Der Vorstand gibt nur frei, was über der Liquiditätsreserve von ' + FM.fmtMoney(reserve) + ' liegt – derzeit <b class="' + (free > 0 ? '' : 'bad') + '">' + FM.fmtMoney(Math.max(0, free)) + '</b>. Jede Stufe kostet zusätzlich laufenden Unterhalt.</div></div>' +
        '<div class="kpi-line"><div><div class="eyebrow">Unterhalt / Jahr</div><div class="budget-num">' + FM.fmtMoney(FM.facUpkeep(club)) + '</div></div></div></div>';
      html += '<div class="fac-grid">' + FM.FAC_KEYS.map(function (k) { return facCard(st, club, k, free); }).join('') + '</div>';
      html += '<p class="muted small" style="margin-top:14px">Auf Stufe 3 entspricht jede Abteilung dem Ligadurchschnitt. Darunter arbeitet sie schlechter, darüber besser. Bauen verkleinert den freien Spielraum und damit auch das Transferbudget.</p>';
      return html;
    }
  };

  function pips(level, max, building) {
    var s = '';
    for (var i = 1; i <= max; i++) s += '<i class="' + (i <= level ? 'on' : i === level + 1 && building ? 'build' : '') + '"></i>';
    return '<span class="pips" aria-label="Stufe ' + level + ' von ' + max + '">' + s + '</span>';
  }

  function effectLine(club, k) {
    var lv = FM.facLevel(club, k);
    var pct = function (f) { var d = Math.round((f - 1) * 100); return (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + ' %'; };
    if (k === 'training') return 'Entwicklung ' + pct(FM.facTrainingDev(club)) + ' · Trainingsverletzungen ' + pct(FM.facTrainingInj(club));
    if (k === 'youth') { var y = FM.facYouthBonus(club); return 'Talente ' + (y > 0 ? '+' : y < 0 ? '−' : '±') + Math.abs(y) + ' Stärke/Potenzial' + (lv >= 4 ? ' · 1 Talent mehr pro Jahr' : ''); }
    if (k === 'medical') return 'Ausfallzeiten ' + pct(FM.facInjuryDays(club)) + ' · Regeneration ' + pct(FM.facRegen(club));
    if (k === 'scouting') { var sp = FM.facScoutSpread(club); return sp ? 'Potenzial junger Spieler auf ±' + Math.ceil(sp / 2) + ' genau' : 'Potenzial wird exakt angezeigt'; }
    if (k === 'commercial') return 'Sponsoring ' + FM.fmtMoney(FM.annualPlan(club).sponsor) + ' pro Jahr';
    return '';
  }

  function facCard(st, club, k, free) {
    var f = FM.FACILITIES[k], build = FM.facBuilding(club, k), q = FM.facQuote(club, k);
    var stadium = k === 'stadium';
    var lv = stadium ? null : FM.facLevel(club, k);
    var head = '<div class="fac-h"><div class="fac-ico">' + UI.icon(f.icon) + '</div><div class="grow"><h3>' + f.name + '</h3>' +
      (stadium ? '<div class="small dim">' + esc(club.stadium) + '</div>' : pips(lv, FM.FAC_MAX, !!build)) + '</div>' +
      (stadium ? '<div class="fac-big">' + FM.fmtInt(club.cap) + '<span>Plätze</span></div>' : '<div class="fac-big">' + lv + '<span>/ ' + FM.FAC_MAX + '</span></div>') + '</div>';
    var body = '<p class="small dim">' + f.text + '</p>';
    if (stadium) {
      var fill = FM.expectedFill(club, club.cap);
      body += '<div class="small" style="margin-top:8px">Erwartete Auslastung <b>' + Math.round(fill * 100) + ' %</b>' + (fill < 0.9 ? ' – <span class="warn">ein Ausbau lohnt sich erst bei vollem Stadion</span>' : '') + '</div>';
    } else {
      body += '<div class="small" style="margin-top:8px"><b>Aktuell:</b> ' + effectLine(club, k) + '</div>';
    }
    var foot;
    if (build) {
      var pct = Math.round((1 - build.weeks / build.total) * 100);
      foot = '<div class="fac-build"><div class="row between small"><span class="strong">' + UI.icon('build') + (stadium ? ' +' + FM.fmtInt(build.seats) + ' Plätze im Bau' : ' Ausbau auf Stufe ' + build.toLevel) + '</span><span class="dim">noch ' + build.weeks + ' Wo.</span></div>' +
        '<div class="meter"><i style="width:' + pct + '%"></i></div></div>';
    } else if (!q) {
      foot = '<div class="fac-build"><span class="tag good">' + UI.icon('check') + ' Höchste Stufe</span></div>';
    } else {
      var can = q.cost <= free;
      var gain = q.gain ? '<div><dt>Mehreinnahmen</dt><dd class="good">+' + FM.fmtMoneyShort(q.gain) + '/J.</dd></div>' : '';
      foot = '<div class="fac-next">' + (stadium ? 'Nächster Ausbau: +' + FM.fmtInt(q.seats) + ' Plätze' : 'Nächste Stufe: ' + q.toLevel) + '</div>' +
        '<dl class="fac-quote"><div><dt>Kosten</dt><dd>' + FM.fmtMoneyShort(q.cost) + '</dd></div>' +
        '<div><dt>Bauzeit</dt><dd>' + q.weeks + ' Wo.</dd></div>' +
        (stadium ? '' : '<div><dt>Unterhalt</dt><dd>+' + FM.fmtMoneyShort(q.upkeep) + '/J.</dd></div>') + gain + '</dl>' +
        '<button class="btn ' + (can ? 'primary' : '') + ' full" data-action="buildFac" data-k="' + k + '"' + (can ? '' : ' disabled') + '>' + (can ? 'Ausbau beauftragen' : 'Vorstand gibt kein Geld frei') + '</button>';
    }
    return '<article class="card fac' + (build ? ' building' : '') + '">' + head + '<div class="fac-b">' + body + '</div><div class="fac-f">' + foot + '</div></article>';
  }

  UI.actions.buildFac = function (el) {
    var st = FM.state, club = st.clubs[st.user.club], k = el.getAttribute('data-k');
    var q = FM.facQuote(club, k);
    if (!q) return;
    var f = FM.FACILITIES[k];
    UI.confirm(f.name + ' ausbauen?', 'Kosten <b>' + FM.fmtMoney(q.cost) + '</b>, sofort fällig. Bauzeit ' + q.weeks + ' Wochen' +
      (q.upkeep ? ', danach ' + FM.fmtMoney(q.upkeep) + ' zusätzlicher Unterhalt pro Jahr' : '') + (k === 'stadium' ? '. Während des Baus fehlen rund 8 % der Plätze' : '') + '.', 'Beauftragen', function () {
      var r = FM.startBuild(st, k);
      UI.toast(r.msg, r.ok ? 'good' : 'bad');
      FM.save(UI.slot || 1);
      UI.refresh();
    });
  };
})();
