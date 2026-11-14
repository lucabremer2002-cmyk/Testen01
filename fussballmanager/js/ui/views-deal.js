/* Verhandlungstisch: Angebot an den Verein, Vertragsgespraech mit dem Spieler – und die Vorstellung des Neuzugangs. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var READ_CLUB = ['Das wirkt wie eine Beleidigung.', 'Deutlich zu wenig.', 'Knapp – da geht noch was.', 'Das dürfte reichen.'];
  var READ_PLAYER = ['In dieser Rolle sieht er keine Perspektive.', 'Weit unter seiner Vorstellung.', 'Fast – ein wenig fehlt noch.', 'Das unterschreibt er.'];
  function last(name) { return name.split(' ').slice(-1)[0]; }
  function stepOf(max) { return max >= 2e7 ? 250000 : max >= 5e6 ? 100000 : max >= 1e6 ? 25000 : max >= 2e5 ? 5000 : 1000; }

  UI.actions.negotiate = function (el) { UI.negotiate(el.getAttribute('data-id'), el.getAttribute('data-k')); };
  UI.actions.negKind = function (el) { UI.negotiate(el.getAttribute('data-id'), el.getAttribute('data-k')); };

  UI.negotiate = function (pid, kind) {
    var st = FM.state, p = st.players[pid];
    if (!p) return;
    var kinds = FM.dealKinds(st, p);
    if (!kinds.length) { UI.toast('Mit diesem Spieler ist gerade kein Geschäft möglich.', 'bad'); return; }
    var t = FM.talkOf(st, pid);
    if (!kind || kinds.indexOf(kind) < 0) kind = t && kinds.indexOf(t.kind) >= 0 ? t.kind : kinds[0];
    t = FM.startTalk(st, pid, kind);
    if (t.error) { UI.toast(t.error, 'bad'); return; }
    render(pid);
  };

  /* ---------- Kopf: Spieler und Vergleich ---------- */
  function profile(st, p, seller) {
    var uc = st.user.club, own = p.club === uc;
    var pot = FM.potView(st, p), il = own ? null : FM.interestLabel(FM.interest(st, p, uc));
    return '<div class="deal-player"><div class="pcard-ovr big ' + UI.tier(p.ovr) + '">' + p.ovr + '<span>' + FM.POS_LABEL[p.pos[0]] + '</span></div>' +
      '<div class="grow"><div class="row wrap" style="gap:6px">' + p.pos.map(UI.posTag).join('') + '<span class="small dim">' + p.age + ' Jahre</span>' +
      (seller ? UI.badge(seller, 18) + '<span class="small dim">' + esc(seller.short) + '</span>' : own ? '<span class="tag accent">dein Spieler</span>' : '<span class="tag">vereinslos</span>') + '</div>' +
      '<dl class="deal-facts"><div><dt>Marktwert</dt><dd>' + FM.fmtMoney(FM.marketValue(p)) + '</dd></div>' +
      '<div><dt>' + (p.club ? 'Gehalt' : 'Gehaltswunsch') + '</dt><dd>' + FM.fmtMoneyShort(p.club ? p.contract.wage : FM.wageDemand(p, st.clubs[uc].league)) + ' €</dd></div>' +
      (p.club ? '<div><dt>Vertrag bis</dt><dd>' + p.contract.until + '</dd></div>' : '') +
      '<div><dt>Potenzial</dt><dd>' + (pot.lo === pot.hi ? pot.lo : pot.lo + '–' + pot.hi) + '</dd></div>' +
      (il ? '<div><dt>Wechselwille</dt><dd><span class="tag ' + il.c + '">' + il.t + '</span></dd></div>' : '<div><dt>Moral</dt><dd>' + UI.morale(p.mor) + '</dd></div>') + '</dl></div></div>';
  }

  function compare(st, p, up) {
    var own = p.club === st.user.club;
    if (own) return '<div class="deal-cmp"><div class="eyebrow">Aktueller Vertrag</div><dl class="kv"><dt>Rolle</dt><dd>' + FM.ROLE_LABEL[FM.roleOf(st, p)] + '</dd><dt>Läuft bis</dt><dd>Juni ' + p.contract.until + '</dd>' +
      '<dt>Jahresgehalt</dt><dd>' + FM.fmtMoney(p.contract.wage) + '</dd><dt>Einsätze</dt><dd>' + p.st.apps + ' Spiele · ' + p.st.goals + ' Tore</dd></dl></div>';
    if (!up) return '<div class="deal-cmp"><div class="eyebrow">Vergleich</div><p class="dim small" style="margin:6px 0 0">Für seine Positionen gibt es in deiner Formation keinen Platz.</p></div>';
    var s = up.starter, d = up.delta;
    var head = '<div class="cmp-head"><div><div class="muted tiny">Neu</div><b>' + esc(last(p.name)) + '</b> ' + UI.pill(p.ovr - FM.positionPenalty(p, up.pos)) + '</div>' +
      '<div class="cmp-delta ' + (d >= 1 ? 'good' : d <= -1 ? 'bad' : '') + '">' + (d > 0 ? '+' : '') + d + '</div>' +
      '<div style="text-align:right"><div class="muted tiny">Bisher</div>' + (s ? UI.pill(up.slot.eff) + ' <b>' + esc(last(s.name)) + '</b>' : '<b>unbesetzt</b>') + '</div></div>';
    var rows = '';
    if (s && FM.isGK(p) === FM.isGK(s)) {
      var lab = FM.statLabels(p);
      rows = p.s.map(function (v, i) {
        var w = s.s[i];
        return '<div class="cmp-row"><span class="v ' + (v > w ? 'good' : '') + '">' + v + '</span><div class="cmp-bars"><i class="a" style="width:' + v + '%"></i><i class="b" style="width:' + w + '%"></i></div><span class="k">' + lab[i] + '</span><span class="v r ' + (w > v ? 'good' : '') + '">' + w + '</span></div>';
      }).join('');
    }
    return '<div class="deal-cmp"><div class="eyebrow">Vergleich auf ' + FM.POS_NAME[up.pos] + '</div>' + head + rows + '</div>';
  }

  function kindSeg(st, p, t) {
    var kinds = FM.dealKinds(st, p).filter(function (k) { return k !== 'renew'; });
    if (kinds.length < 2 || (t.stage === 'player' && t.deal && t.kind !== 'clause')) return '';
    return '<div class="chips" style="margin-bottom:14px">' + kinds.map(function (k) {
      return '<button class="chip' + (t.kind === k ? ' on' : '') + '" data-action="negKind" data-id="' + p.id + '" data-k="' + k + '">' + FM.DEAL_LABEL[k] + '</button>';
    }).join('') + '</div>';
  }

  function seg(key, opts, cur) {
    return '<div class="seg" data-seg="' + key + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function tick(cls, v, max) { return '<i class="tick ' + cls + '" style="left:' + FM.clamp(v / max * 100, 0, 100) + '%"></i>'; }
  function setChip(target, v, label, cls) { return '<button type="button" class="chip sm ' + (cls || '') + '" data-for="' + target + '" data-set="' + Math.round(v) + '">' + label + '</button>'; }
  function pctChip(target, x) { return '<button type="button" class="chip sm" data-for="' + target + '" data-pct="' + x + '">' + (x > 0 ? '+' : '−') + Math.abs(x) + ' %</button>'; }
  function readBox() { return '<div class="read" id="n-read"><div class="read-bar"><i></i><i></i><i></i><i></i></div><div class="read-txt"></div></div>'; }

  /* ---------- Stufe 1: Verein ---------- */
  function buyForm(st, p, t) {
    var uc = st.user.club, u = t.ui, mv = FM.marketValue(p);
    var fee = u.fee != null ? u.fee : t.counter || t.ask;
    var max = FM.niceRound(Math.max(t.ask * 1.35, (t.counter || 0) * 1.15, mv * 1.6, fee * 1.1));
    u.inst = u.inst || 1; u.sellOn = u.sellOn || 0;
    var swaps = FM.clubPlayers(st, uc).filter(function (x) { return !x.loan && !x.pre; }).sort(function (a, b) { return FM.marketValue(b) - FM.marketValue(a); });
    var o = function (v, l, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + l + '</option>'; };
    return (t.star ? '<div class="note warn">Leistungsträger: ' + esc(st.clubs[p.club].short) + ' verkauft nur für deutlich mehr als den Marktwert.</div>' : '') +
      '<div class="offer-box"><div class="offer-head"><span class="eyebrow">Dein Angebot</span><div class="offer-num" id="n-big"></div></div>' +
      '<div class="track"><div class="track-rail">' + tick('mv', mv, max) + tick('ask', t.ask, max) + (t.counter ? tick('ctr', t.counter, max) : '') + '<i class="zone" id="n-zone"></i></div>' +
      '<input type="range" id="n-fee-r" min="0" max="' + max + '" step="' + stepOf(max) + '" value="' + Math.min(max, Math.round(fee)) + '" aria-label="Ablöse"></div>' +
      '<div class="chips quick">' + setChip('fee', mv, '<i class="lg mv"></i>Marktwert ' + FM.fmtMoneyShort(mv)) + setChip('fee', t.ask, '<i class="lg ask"></i>Forderung ' + FM.fmtMoneyShort(t.ask)) +
      (t.counter ? setChip('fee', t.counter, '<i class="lg ctr"></i>Gegenangebot ' + FM.fmtMoneyShort(t.counter)) : '') + pctChip('fee', -10) + pctChip('fee', -5) + pctChip('fee', 5) + pctChip('fee', 10) + '</div>' +
      '<div class="field exact"><label for="n-fee">Betrag genau (€)</label><input class="input" id="n-fee" type="number" step="' + stepOf(max) + '" min="0" value="' + Math.round(fee) + '"></div></div>' +
      readBox() +
      '<div class="grid g2"><div class="field"><label>Zahlung</label>' + seg('inst', [[1, 'Sofort'], [2, '2 Raten'], [3, '3 Raten']], u.inst) + '</div>' +
      '<div class="field"><label>Weiterverkaufsbeteiligung</label>' + seg('sellOn', [[0, 'keine'], [0.1, '10 %'], [0.2, '20 %']], u.sellOn) + '</div></div>' +
      '<div class="field"><label for="n-swap">Spieler im Tausch</label><select class="input" id="n-swap"><option value="">kein Tausch</option>' + swaps.map(function (x) {
        return o(x.id, esc(x.name) + ' (' + FM.POS_LABEL[x.pos[0]] + ', ' + x.ovr + ') · MW ' + FM.fmtMoneyShort(FM.marketValue(x)), u.swap || '');
      }).join('') + '</select></div>' +
      '<p class="muted small">Raten und eine Weiterverkaufsbeteiligung senken, was du jetzt zahlen musst – bei Talenten ist dem Verkäufer eine Beteiligung viel wert. Einen Tauschspieler rechnet er nach seinem Bedarf an.</p>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  function loanForm(st, p, t) {
    var uc = st.user.club, u = t.ui;
    var role = FM.expectedRole(st, p, uc);
    var share = u.share != null ? u.share : t.counterShare != null ? t.counterShare : 0.5;
    return '<div class="note">Leihe bis Saisonende. Bei dir wäre ' + esc(p.name) + ' <b>' + FM.ROLE_LABEL[role] + '</b>. Spieler ohne Einsatzchancen lehnen ab.</div>' +
      '<div class="offer-box"><div class="offer-head"><span class="eyebrow">Dein Anteil am Gehalt</span><div class="offer-num" id="n-big"></div></div>' +
      '<div class="track"><input type="range" id="n-share" min="0" max="100" step="10" value="' + Math.round(share * 100) + '" aria-label="Gehaltsanteil"></div></div>' +
      '<div class="field"><label for="n-opt">Kaufoption (€, 0 = keine)</label><input class="input" id="n-opt" type="number" step="50000" min="0" value="' + (u.option || 0) + '"><span class="muted small">Richtwert: ab etwa ' + FM.fmtMoney(FM.niceUp(FM.askingPrice(st, p) * 1.15)) + '</span></div>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  /* ---------- Stufe 2: Spieler ---------- */
  function playerForm(st, p, t) {
    var u = t.ui;
    u.role = u.role || t.expRole;
    var d = FM.playerDemand(st, t, u.role), mv = FM.marketValue(p);
    var wage = u.wage != null ? u.wage : d.wage, bonus = u.bonus != null ? u.bonus : d.bonus;
    u.years = Math.min(d.maxYears, u.years || (t.kind === 'renew' ? 2 : 3));
    var clauseOpts = [[0, 'keine']].concat([1.5, 2, 2.5, 3].map(function (f) { var v = FM.niceRound(mv * f); return [v, FM.fmtMoney(v) + ' (' + String(f).replace('.', ',') + '× Marktwert)']; }));
    if (d.clause && !clauseOpts.some(function (c) { return c[0] === d.clause; })) clauseOpts.splice(1, 0, [d.clause, FM.fmtMoney(d.clause) + ' (sein Wunsch)']);
    var clause = u.clause != null ? u.clause : 0;
    var o = function (v, l, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + l + '</option>'; };
    var note = '';
    if (t.kind === 'clause') note = '<div class="note">Ausstiegsklausel: ' + esc(st.clubs[p.club].short) + ' muss ' + FM.fmtMoney(t.deal.fee) + ' akzeptieren. Jetzt entscheidet nur noch der Spieler.</div>';
    if (t.kind === 'pre') note = '<div class="note">Vorvertrag: ' + esc(p.name) + ' wechselt zum 1. Juli ablösefrei. Das Handgeld wird sofort fällig.</div>';
    if (t.kind === 'renew' && p.wants) note = '<div class="note warn">Er hat einen Wechselwunsch – mit einer größeren Rolle lässt er sich eher halten.</div>';
    if (t.rival) note += '<div class="note warn">Auch ' + esc(st.clubs[t.rival].name) + ' wirbt um ' + esc(p.name) + ' – er verlangt mehr.</div>';
    var roles = FM.ROLES.filter(function (r) { return r !== 'prospect' || p.age <= 21; }).map(function (r) {
      var dr = FM.playerDemand(st, t, r);
      return '<button type="button" class="role' + (r === u.role ? ' on' : '') + '" data-role="' + r + '"><span class="strong">' + FM.ROLE_LABEL[r] + '</span>' +
        '<span class="muted tiny">' + (dr.interest < 30 ? 'lehnt er ab' : 'ab ' + FM.fmtMoneyShort(dr.wage) + ' €') + (r === t.expRole ? ' · erwartet' : '') + '</span></button>';
    }).join('');
    var lo = Math.round(d.wage * 0.5), hi = FM.niceRound(Math.max(d.wage * 1.7, wage * 1.1));
    return note +
      '<div class="field"><label>Rolle im Kader</label><div class="roles">' + roles + '</div></div>' +
      '<div class="offer-box"><div class="offer-head"><span class="eyebrow">Jahresgehalt</span><div class="offer-num" id="n-big"></div></div>' +
      '<div class="track"><div class="track-rail"><i class="tick ask" id="n-wtick"></i><i class="zone" id="n-zone"></i></div>' +
      '<input type="range" id="n-wage-r" min="' + lo + '" max="' + hi + '" step="' + stepOf(hi) + '" value="' + FM.clamp(wage, lo, hi) + '" aria-label="Jahresgehalt"></div>' +
      '<div class="chips quick"><button type="button" class="chip sm" id="n-wdem" data-for="wage" data-set="' + d.wage + '"><i class="lg ask"></i>Forderung <span id="n-wdem-l">' + FM.fmtMoneyShort(d.wage) + '</span></button>' +
      (t.kind === 'renew' ? setChip('wage', p.contract.wage, 'Aktuell ' + FM.fmtMoneyShort(p.contract.wage)) : '') + pctChip('wage', -10) + pctChip('wage', -5) + pctChip('wage', 5) + pctChip('wage', 10) + '</div>' +
      '<div class="field exact"><label for="n-wage">Betrag genau (€)</label><input class="input" id="n-wage" type="number" step="10000" min="0" value="' + wage + '"></div></div>' +
      readBox() +
      '<div class="grid g2"><div class="field"><label>Laufzeit</label>' + seg('years', [1, 2, 3, 4, 5].filter(function (y) { return y <= d.maxYears; }).map(function (y) { return [y, y + (y > 1 ? ' Jahre' : ' Jahr')]; }), u.years) + '</div>' +
      '<div class="field"><label for="n-bonus">Handgeld (€)</label><input class="input" id="n-bonus" type="number" step="10000" min="0" value="' + bonus + '"></div></div>' +
      '<div class="field"><label for="n-clause">Ausstiegsklausel</label><select class="input" id="n-clause">' + clauseOpts.map(function (c) { return o(c[0], c[1], clause); }).join('') + '</select></div>' +
      '<div class="small dim" id="n-demand"></div>' +
      '<p class="muted small">Eine größere Rolle senkt die Gehaltsforderung, muss aber mit Einsatzzeit eingelöst werden. Mehr Handgeld drückt das Gehalt. Eine Ausstiegsklausel macht ihn günstiger – erlaubt anderen Vereinen aber, ihn zu holen.</p>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  /* ---------- Dialog ---------- */
  function render(pid, msg) {
    var st = FM.state, p = st.players[pid], t = FM.talkOf(st, pid), uc = st.user.club;
    if (!t || !p) { UI.closeModal(); return; }
    t.ui = t.ui || {};
    var seller = p.club && p.club !== uc ? st.clubs[p.club] : null;
    var clubStage = t.stage === 'club';
    var up = p.club === uc ? null : FM.upgradeFor(st, p, FM.squadNeeds(st));
    var names = t.kind === 'buy' ? ['Verein', 'Spieler', 'Unterschrift'] : t.kind === 'loan' ? ['Verein', 'Unterschrift'] : ['Spieler', 'Unterschrift'];
    var cur = t.kind === 'buy' && !clubStage ? 1 : 0;
    var steps = '<div class="steps">' + names.map(function (n, i) { return '<span class="' + (i < cur ? 'done' : i === cur ? 'on' : '') + '">' + (i + 1) + ' · ' + n + '</span>'; }).join('') + '</div>';
    var head = '<div class="modal-h"><div class="grow"><div class="eyebrow" style="margin:0">' + (t.kind === 'renew' ? 'Vertragsverlängerung' : 'Verhandlungstisch · ' + FM.DEAL_LABEL[t.kind]) + '</div>' +
      '<h2 class="ellipsis">' + esc(p.name) + '</h2></div><button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
    var form = clubStage ? (t.kind === 'loan' ? loanForm(st, p, t) : buyForm(st, p, t)) : playerForm(st, p, t);
    var who = clubStage ? seller.short : last(p.name);
    var side = '<aside class="neg-side"><div class="row between"><span class="eyebrow" style="margin:0;color:var(--text-3)">Geduld ' + esc(who) + '</span>' + UI.patience(clubStage ? t.pat : t.ppat, clubStage ? t.max : t.pmax) + '</div>' +
      '<div class="neg-log">' + t.log.slice().reverse().map(function (l) { return '<div class="' + (l.me ? 'me' : 'them') + '"><b>' + (l.me ? 'Du' : '') + '</b>' + esc(l.text) + '</div>'; }).join('') + '</div></aside>';
    var btn = clubStage ? (t.kind === 'loan' ? 'Leihe anfragen' : 'Angebot abgeben') : t.kind === 'pre' ? 'Vorvertrag anbieten' : 'Vertrag anbieten';
    var snap = { kind: t.kind, up: up, str: FM.teamStrength(st, uc), seller: seller ? seller.id : null };
    UI.modal(head + '<div class="modal-b"><div class="deal-top">' + profile(st, p, seller) + compare(st, p, up) + '</div>' + steps + kindSeg(st, p, t) +
      '<div class="neg-grid"><div class="stack">' + form + '<div id="n-msg">' + (msg ? '<div class="note ' + msg.cls + '">' + esc(msg.text) + '</div>' : '') + '</div></div>' + side + '</div></div>' +
      '<div class="modal-f"><button class="btn ghost danger" data-action="negCancel" data-id="' + pid + '" style="margin-right:auto">Gespräche beenden</button><button class="btn" data-action="closeModal">Später</button><button class="btn primary" id="n-go">' + btn + '</button></div>',
      { size: 'wide deal', mount: function (m) { mount(m, pid, snap); } });
  }

  function mount(m, pid, snap) {
    var st = FM.state, p = st.players[pid], t = FM.talkOf(st, pid), uc = st.user.club, club = st.clubs[uc];
    var b = FM.budget(st, club), u = t.ui;
    var $ = function (id) { return m.querySelector('#' + id); };
    var buy = t.stage === 'club' && t.kind === 'buy', loan = t.stage === 'club' && t.kind === 'loan', player = t.stage === 'player';
    var range = buy ? $('n-fee-r') : player ? $('n-wage-r') : null, num = buy ? $('n-fee') : player ? $('n-wage') : null;

    function readUi() {
      if (buy) { u.fee = +num.value || 0; u.swap = $('n-swap').value || null; }
      else if (loan) { u.share = +$('n-share').value / 100; u.option = +$('n-opt').value || 0; }
      else { u.wage = +num.value || 0; u.bonus = +$('n-bonus').value || 0; u.clause = +$('n-clause').value || 0; }
    }
    function paintRead(band, text) {
      var r = $('n-read');
      if (!r) return;
      r.className = 'read b' + band;
      r.querySelector('.read-txt').innerHTML = '<b>' + text + '</b><span class="muted small">' + (buy ? 'Einschätzung deines Sportdirektors' : 'So steht er zu deinem Angebot') + '</span>';
    }
    function zone(fromValue) {
      var z = $('n-zone');
      if (!z || !range) return;
      var lo = +range.min, hi = +range.max, x = FM.clamp((fromValue - lo) / Math.max(1, hi - lo) * 100, 0, 100);
      z.style.left = x + '%';
      z.style.display = x >= 100 ? 'none' : '';
    }
    function update() {
      readUi();
      var c = $('n-cost'), html = '';
      if (buy) {
        $('n-big').textContent = FM.fmtMoney(u.fee);
        var now = FM.dealUpfront({ fee: u.fee, inst: u.inst }), agent = Math.round(u.fee * FM.AGENT_FEE);
        // was das Budget hergibt: Ablöse, deren Sofortanteil samt Beraterhonorar noch passt
        zone(b.transfer / (1 / u.inst + FM.AGENT_FEE));
        var rd = FM.offerRead(st, pid, { fee: u.fee, inst: u.inst, sellOn: u.sellOn, swap: u.swap });
        if (rd) paintRead(rd.band, READ_CLUB[rd.band]);
        html = '<dt>Jetzt fällig</dt><dd>' + FM.fmtMoney(now) + '</dd><dt>Beraterhonorar 10 %</dt><dd>' + FM.fmtMoney(agent) + '</dd>' +
          (u.inst > 1 ? '<dt>Spätere Raten</dt><dd>' + FM.fmtMoney(u.fee - now) + '</dd>' : '') +
          (u.swap && st.players[u.swap] ? '<dt>Tauschspieler (Marktwert)</dt><dd>' + FM.fmtMoney(FM.marketValue(st.players[u.swap])) + '</dd>' : '') +
          '<dt class="sum">Belastet dein Transferbudget</dt><dd class="sum ' + (now + agent > b.transfer ? 'bad' : '') + '">' + FM.fmtMoney(now + agent) + ' von ' + FM.fmtMoney(b.transfer) + '</dd>';
      } else if (loan) {
        $('n-big').textContent = Math.round(u.share * 100) + ' %';
        var w = p.contract.wage * u.share, room = FM.wageRoom(st, club);
        html = '<dt>Gehalt des Spielers</dt><dd>' + FM.fmtMoney(p.contract.wage) + '</dd><dt class="sum">Davon zahlst du</dt><dd class="sum ' + (w > room ? 'bad' : '') + '">' + FM.fmtMoney(w) + ' von ' + FM.fmtMoney(Math.max(0, room)) + ' Spielraum</dd>' +
          (u.option ? '<dt>Kaufoption</dt><dd>' + FM.fmtMoney(u.option) + ' (später, freiwillig)</dd>' : '');
      } else {
        $('n-big').textContent = FM.fmtMoney(u.wage);
        var cr = FM.contractRead(st, pid, u), d = cr.dem;
        var clauseOk = !d.clause || (u.clause && u.clause <= d.clause);
        var wish = Math.round(d.wage * (clauseOk ? 1 : 1.08));
        paintRead(cr.band, READ_PLAYER[cr.band]);
        var tk = $('n-wtick');
        if (tk) tk.style.left = FM.clamp((wish - +range.min) / Math.max(1, +range.max - +range.min) * 100, 0, 100) + '%';
        $('n-wdem').setAttribute('data-set', wish);
        $('n-wdem-l').textContent = FM.fmtMoneyShort(wish);
        $('n-demand').innerHTML = 'Als <b>' + FM.ROLE_LABEL[u.role] + '</b> erwartet er rund ' + FM.fmtMoney(wish) + ' pro Jahr und ' + FM.fmtMoney(d.bonus) + ' Handgeld' +
          (d.clause ? ', dazu eine Klausel von höchstens ' + FM.fmtMoney(d.clause) + (clauseOk ? ' ✓' : ' (sonst 8 % mehr Gehalt)') : '') + '.';
        var deal = t.deal || { fee: 0, inst: 1 };
        var upfront = FM.dealUpfront(deal) + Math.round((deal.fee || 0) * FM.AGENT_FEE) + u.bonus;
        var roomP = t.kind === 'pre' ? FM.wageRoom(st, club) + FM.expiringWages(st, club) : FM.wageRoom(st, club) + (t.kind === 'renew' ? p.contract.wage : 0);
        zone(Math.max(0, roomP));
        html = (deal.fee ? '<dt>Ablöse jetzt + Berater</dt><dd>' + FM.fmtMoney(FM.dealUpfront(deal) + Math.round(deal.fee * FM.AGENT_FEE)) + '</dd>' : '') +
          '<dt>Handgeld</dt><dd>' + FM.fmtMoney(u.bonus) + '</dd><dt class="sum">Belastet dein Transferbudget</dt><dd class="sum ' + (upfront > b.transfer ? 'bad' : '') + '">' + FM.fmtMoney(upfront) + ' von ' + FM.fmtMoney(b.transfer) + '</dd>' +
          '<dt>Gehalt' + (t.kind === 'pre' ? ' (ab Juli)' : '') + '</dt><dd class="' + (u.wage > roomP ? 'bad' : '') + '">' + FM.fmtMoney(u.wage) + ' von ' + FM.fmtMoney(Math.max(0, roomP)) + ' Spielraum</dd>';
      }
      c.innerHTML = html;
    }
    function setMain(v) {
      v = Math.max(0, Math.round(v));
      num.value = v;
      if (v > +range.max) range.max = FM.niceRound(v * 1.1);
      if (v < +range.min) range.min = 0;
      range.value = v;
      update();
    }

    if (range) {
      range.addEventListener('input', function () { num.value = range.value; update(); });
      num.addEventListener('input', function () { var v = +num.value || 0; if (v > +range.max) range.max = FM.niceRound(v * 1.1); if (v < +range.min) range.min = 0; range.value = v; update(); });
    }
    m.querySelectorAll('#n-share, #n-opt, #n-bonus, #n-clause, #n-swap').forEach(function (i) { i.addEventListener('input', update); i.addEventListener('change', update); });
    m.querySelectorAll('[data-seg] button').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var box = bt.parentNode;
        u[box.getAttribute('data-seg')] = +bt.getAttribute('data-v');
        box.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === bt); });
        update();
      });
    });
    m.querySelectorAll('[data-for]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        var base = +num.value || (buy ? t.ask : 0);
        if (bt.getAttribute('data-set') != null) setMain(+bt.getAttribute('data-set'));
        else setMain(FM.niceRound(base * (1 + +bt.getAttribute('data-pct') / 100)));
      });
    });
    m.querySelectorAll('[data-role]').forEach(function (bt) {
      bt.addEventListener('click', function () {
        u.role = bt.getAttribute('data-role');
        m.querySelectorAll('[data-role]').forEach(function (x) { x.classList.toggle('on', x === bt); });
        var d = FM.playerDemand(st, t, u.role);
        $('n-bonus').value = d.bonus;
        setMain(d.wage);
      });
    });
    update();

    $('n-go').addEventListener('click', function () {
      readUi();
      var r;
      if (t.stage === 'club') r = FM.clubOffer(st, pid, t.kind === 'loan' ? { wageShare: u.share, option: u.option } : { fee: u.fee, inst: u.inst, sellOn: u.sellOn, swap: u.swap });
      else r = FM.playerOffer(st, pid, { role: u.role, years: u.years, wage: u.wage, bonus: u.bonus, clause: u.clause });
      if (r.status === 'error') { $('n-msg').innerHTML = '<div class="note bad">' + esc(r.msg) + '</div>'; $('n-msg').scrollIntoView({ block: 'nearest' }); return; }
      FM.save(UI.slot || 1);
      if (r.status === 'done') { UI.refresh(); signed(pid, snap, r.msg); return; }
      if (r.status === 'broken') { UI.refresh(); broken(pid, r.msg); return; }
      if (r.status === 'counter') {
        if (r.wage) u.wage = r.wage;
        if (r.share != null) { t.counterShare = r.share; u.share = r.share; }
        if (r.option) u.option = r.option;
        render(pid, { cls: 'warn', text: r.msg });
        return;
      }
      t.ui = {};                                  // Verein einverstanden → Vertragsgespraech
      render(pid, { cls: 'good', text: r.msg });
    });
  }

  UI.actions.negCancel = function (el) {
    FM.cancelTalk(FM.state, el.getAttribute('data-id'));
    UI.closeModal();
    UI.toast('Gespräche beendet.');
    UI.refresh();
  };

  /* ---------- Gescheitert ---------- */
  function broken(pid, text) {
    var st = FM.state, p = st.players[pid], until = FM.talkBlocked(st, pid);
    UI.modal('<div class="modal-b"><div class="deal-end bad"><div class="deal-end-ico">' + UI.icon('x') + '</div><div class="eyebrow">Verhandlung gescheitert</div><h2>' + esc(p ? p.name : '') + '</h2>' +
      '<p class="dim">' + esc(text) + '</p>' + (until ? '<p class="muted small">Ein neuer Anlauf ist ab dem ' + D.fmt(until) + ' möglich.</p>' : '') + '</div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Schließen</button>' + (p ? '<button class="btn primary" data-action="tmNeed" data-pos="' + p.pos[0] + '">Alternativen auf ' + FM.POS_LABEL[p.pos[0]] + ' ansehen</button>' : '') + '</div>', { size: 'narrow' });
  }

  /* ---------- Unterschrift: Vorstellung des Neuzugangs ---------- */
  function signed(pid, snap, text) {
    var st = FM.state, p = st.players[pid], uc = st.user.club, club = st.clubs[uc];
    if (!p) { UI.closeModal(); return; }
    var kind = snap.kind, rec = st.transfers[0] && st.transfers[0].pid === pid ? st.transfers[0] : null;
    var joined = p.club === uc && kind !== 'renew';
    var title = kind === 'renew' ? 'Verlängert!' : kind === 'pre' ? 'Vorvertrag unterschrieben' : kind === 'loan' ? 'Leihe perfekt' : 'Transfer perfekt';
    var line = kind === 'renew' ? esc(p.name) + ' bleibt bis ' + p.contract.until + '.' : kind === 'pre' ? esc(p.name) + ' kommt zum 1. Juli ablösefrei.' :
      'Willkommen bei ' + esc(club.short) + ', ' + esc(last(p.name)) + '!';
    var notes = [];
    if (joined && snap.up && snap.up.delta >= 1) notes.push('<span class="tag good">+' + snap.up.delta + ' auf ' + FM.POS_LABEL[snap.up.pos] + (snap.up.starter ? ' gegenüber ' + esc(last(snap.up.starter.name)) : '') + '</span>');
    if (joined) {
      var after = FM.teamStrength(st, uc);
      if (after - snap.str >= 0.05) notes.push('<span class="tag accent">Beste Elf ' + snap.str.toFixed(1).replace('.', ',') + ' → ' + after.toFixed(1).replace('.', ',') + '</span>');
      // grosse Namen begeistern die Fans
      var big = (rec && rec.rec) || p.ovr >= snap.str + 3;
      if (big && FM.fanMood) { FM.fanMood(st, rec && rec.rec ? 5 : 3); notes.push('<span class="tag warn">Die Fans sind begeistert</span>'); }
    }
    if (rec && rec.rec) notes.unshift('<span class="tag accent">Rekordtransfer des Vereins</span>');
    var labels = FM.statLabels(p);
    var facts = '<dl class="kv">' +
      (kind === 'renew' || kind === 'pre' ? '' : '<dt>' + (kind === 'loan' ? 'Leihe von' : 'Ablöse') + '</dt><dd>' + (kind === 'loan' ? esc(st.clubs[p.loan ? p.loan.from : snap.seller].short) : rec && rec.fee ? FM.fmtMoney(rec.fee) : 'ablösefrei') + '</dd>') +
      (kind === 'pre' ? '<dt>Vertrag</dt><dd>' + p.pre.years + ' Jahre ab Juli</dd><dt>Jahresgehalt</dt><dd>' + FM.fmtMoney(p.pre.wage) + '</dd>' :
        kind === 'loan' ? '<dt>Bis</dt><dd>Saisonende</dd><dt>Dein Gehaltsanteil</dt><dd>' + (p.loan ? Math.round(p.loan.share * 100) + ' %' : '–') + '</dd>' :
          '<dt>Vertrag bis</dt><dd>Juni ' + p.contract.until + '</dd><dt>Jahresgehalt</dt><dd>' + FM.fmtMoney(p.contract.wage) + '</dd>') +
      (kind !== 'loan' && kind !== 'pre' && p.contract.role ? '<dt>Rolle</dt><dd>' + FM.ROLE_LABEL[p.contract.role] + '</dd>' : '') + '</dl>';
    var c1 = club.colors[0], c2 = club.colors[1] || '#ffffff';
    var show = '<div class="signed-stage" style="--c1:' + c1 + ';--c2:' + c2 + ';--ink:' + UI.ink(c1) + '"><div class="signed-rays"></div>' +
      '<div class="signed-card"><div class="sc-top"><div class="sc-ovr">' + p.ovr + '</div><div class="sc-pos">' + FM.POS_LABEL[p.pos[0]] + '</div>' + UI.badge(club, 46) + '</div>' +
      '<div class="sc-name">' + esc(last(p.name)) + '</div><div class="sc-first">' + esc(p.name.split(' ').slice(0, -1).join(' ')) + '&nbsp;</div>' +
      '<div class="sc-stats">' + p.s.map(function (v, i) { return '<span><b>' + v + '</b>' + labels[i] + '</span>'; }).join('') + '</div></div></div>';
    UI.modal('<div class="modal-b signed"><div class="signed-grid">' + show +
      '<div class="signed-info"><div class="eyebrow">' + title + '</div><h2>' + line + '</h2><p class="dim" style="margin:8px 0 14px">' + esc(text) + '</p>' + facts +
      (notes.length ? '<div class="row wrap signed-notes">' + notes.join('') + '</div>' : '') + '</div></div></div>' +
      '<div class="modal-f">' + (joined ? '<button class="btn" data-action="signedLineup">' + UI.icon('tactics') + ' Beste Elf aufstellen</button><button class="btn" data-action="go" data-view="squad">Zum Kader</button>' : '') +
      '<button class="btn primary" data-action="closeModal">' + (kind === 'renew' ? 'Weiter' : 'Weiter auf dem Markt') + '</button></div>', { size: 'wide deal' });
  }
  UI.dealSigned = signed;

  UI.actions.signedLineup = function () {
    var st = FM.state, club = st.clubs[st.user.club];
    club.lineup = FM.autoLineup(st, club.id, club.lineup ? club.lineup.formation : club.formation);
    UI.closeModal();
    UI.go('tactics');
    UI.toast('Die beste Elf steht – inklusive Neuzugang.', 'good');
  };
})();
