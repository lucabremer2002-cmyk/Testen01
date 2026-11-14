/* Transfermarkt: Zentrale (Kaderplaner, Empfehlungen, laufende Geschaefte), Markt (Spielerkarten),
   Merkliste & Scouting, Abgeben (Verkauf, Leihen, Angebote), Bilanz & Ticker.
   Der Verhandlungstisch steht in views-deal.js. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var TABS = [['hub', 'Zentrale'], ['market', 'Markt'], ['watch', 'Merkliste & Scouting'], ['sell', 'Abgeben'], ['log', 'Bilanz & Ticker']];
  var PRESETS = [['all', 'Alle'], ['up', 'Verstärkungen'], ['afford', 'Im Budget'], ['bargain', 'Schnäppchen'], ['free', 'Ablösefrei'], ['loan', 'Leihbar'], ['talent', 'Talente'], ['expiring', 'Vertrag läuft aus'], ['clause', 'Mit Klausel']];
  var SORTS = [['best', 'Stärkste zuerst'], ['up', 'Größte Verstärkung'], ['cheap', 'Günstigste zuerst'], ['deal', 'Preis-Leistung'], ['young', 'Jüngste zuerst'], ['pot', 'Größtes Potenzial']];
  var LEAGUES = [['de', 'Deutschland'], ['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rl', 'Regionalliga'], ['eu', 'Ausland']];
  var DEF = { tab: 'hub', q: '', preset: 'all', pos: 'all', league: 'de', minOvr: 0, maxAge: 40, maxPrice: 0, sort: 'best', mode: 'cards', page: 0, log: 'all' };
  var PAGE = 24;
  var ROLE_ORDER = { squad: 0, prospect: 1, rot: 2, start: 3, key: 4 };

  function last(name) { return name.split(' ').slice(-1)[0]; }
  function state() { var s = UI.vs('transfers', DEF); if (!TABS.some(function (t) { return t[0] === s.tab; })) s.tab = 'hub'; return s; }

  /* Rahmen einer Darstellung: Bedarf, Budget, Spielraum – einmal berechnet */
  function ctx() {
    var st = FM.state, club = st.clubs[st.user.club];
    return { st: st, uc: club.id, club: club, y: st.season.year, needs: FM.squadNeeds(st), b: FM.budget(st, club), room: FM.wageRoom(st, club), open: FM.isWindowOpen(st) };
  }
  /* Alles, was eine Karte ueber einen Spieler wissen muss */
  function info(c, p) {
    var interest = FM.interest(c.st, p, c.uc);
    var a = FM.affordOf(c.st, p, interest);
    return { p: p, price: a.price, wage: a.wage, afford: a, interest: interest, up: FM.upgradeFor(c.st, p, c.needs), kinds: FM.dealKinds(c.st, p), pot: FM.potView(c.st, p) };
  }
  UI.tmInfo = function (p) { return info(ctx(), p); };

  UI.starBtn = function (p) {
    var on = FM.onShortlist(FM.state, p.id);
    return '<button class="star-btn' + (on ? ' on' : '') + '" data-action="watch" data-id="' + p.id + '" title="' + (on ? 'Von der Merkliste nehmen' : 'Auf die Merkliste') + '" aria-label="Merken">★</button>';
  };

  function patience(cur, max) {
    var s = '';
    for (var i = 0; i < max; i++) s += '<i class="' + (i < cur ? 'on' : '') + '"></i>';
    return '<span class="patience" title="Geduld ' + cur + ' von ' + max + '">' + s + '</span>';
  }
  UI.patience = patience;

  /* ---------- Bausteine ---------- */
  function priceText(x) {
    var p = x.p;
    if (p.loan) return 'verliehen';
    if (p.pre) return 'Vorvertrag';
    if (!p.club) return 'ablösefrei';
    return FM.fmtMoney(x.price);
  }

  /* Kurze Gruende, warum der Spieler interessant ist */
  function tags(c, x) {
    var p = x.p, out = [];
    if (x.up && x.up.delta >= 1) out.push('<span class="tag good" title="Stärker als ' + (x.up.starter ? esc(x.up.starter.name) : 'die aktuelle Besetzung') + '">+' + x.up.delta + ' auf ' + FM.POS_LABEL[x.up.pos] + '</span>');
    else if (x.up && x.up.delta >= -2) out.push('<span class="tag" title="Etwa auf dem Niveau deiner Besetzung">Alternative ' + FM.POS_LABEL[x.up.pos] + '</span>');
    if (p.age <= 21 && x.pot.lo - p.ovr >= 5) out.push('<span class="tag info" title="Entwicklungspotenzial">Talent bis ' + (x.pot.lo === x.pot.hi ? x.pot.lo : x.pot.lo + '–' + x.pot.hi) + '</span>');
    if (p.wants) out.push('<span class="tag warn">will weg</span>');
    else if (p.listed) out.push('<span class="tag info">Transferliste</span>');
    if (p.club && !p.loan && !p.pre && p.contract.until <= c.y + 1) out.push('<span class="tag" title="Vorvertrag ab Januar möglich">Vertrag endet</span>');
    if (p.club && p.contract.clause) out.push('<span class="tag info" title="Ausstiegsklausel">Klausel ' + FM.fmtMoneyShort(p.contract.clause) + '</span>');
    if (FM.loanable(c.st, p)) out.push('<span class="tag">leihbar</span>');
    if (p.injury) out.push('<span class="tag bad">verletzt</span>');
    return out.join('');
  }

  function dealBtn(c, x, small) {
    var p = x.p, t = FM.talkOf(c.st, p.id), blocked = FM.talkBlocked(c.st, p.id);
    var cls = 'btn ' + (small === false ? '' : 'sm ');
    if (t) return '<button class="' + cls + 'primary" data-action="negotiate" data-id="' + p.id + '">Fortsetzen</button>';
    if (blocked) return '<span class="muted tiny">Gespräche ruhen bis ' + D.fmtShort(blocked) + '</span>';
    if (!x.kinds.length) return '<span class="muted tiny">' + (p.loan ? 'verliehen' : p.pre ? 'Vorvertrag' : 'Fenster geschlossen') + '</span>';
    var label = x.kinds[0] === 'free' ? 'Verpflichten' : x.kinds[0] === 'pre' ? 'Vorvertrag' : 'Verhandeln';
    return '<button class="' + cls + 'primary" data-action="negotiate" data-id="' + p.id + '">' + label + '</button>';
  }

  var AFF = { ok: ['good', 'im Budget'], near: ['warn', 'knapp'], no: ['', 'zu teuer'] };

  /* Spielerkarte */
  function card(c, x, extra) {
    var p = x.p, st = c.st, club = p.club ? st.clubs[p.club] : null;
    var labels = FM.statLabels(p);
    var top = p.s.map(function (v, i) { return [labels[i], v]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3)
      .map(function (a) { return '<span><b>' + a[1] + '</b>' + a[0] + '</span>'; }).join('');
    var il = FM.interestLabel(x.interest), af = AFF[x.afford.level];
    return '<article class="pcard ' + x.afford.level + '" data-action="player" data-id="' + p.id + '">' +
      '<div class="pcard-top"><div class="pcard-ovr ' + UI.tier(p.ovr) + '">' + p.ovr + '<span>' + FM.POS_LABEL[p.pos[0]] + '</span></div>' +
      '<div class="pcard-id"><div class="pcard-name">' + esc(p.name) + '</div>' +
      '<div class="pcard-club">' + (club ? UI.badge(club, 16) + '<span class="ellipsis">' + esc(club.short) + '</span>' : '<span>vereinslos</span>') + '<span class="sep">·</span><span>' + p.age + ' J.</span></div></div>' +
      (extra || '') + UI.starBtn(p) + '</div>' +
      '<div class="pcard-stats">' + top + '</div>' +
      '<div class="pcard-tags">' + (tags(c, x) || '<span class="muted tiny">' + esc(il.t) + '</span>') + '</div>' +
      '<div class="pcard-foot"><div><div class="pcard-price">' + priceText(x) + '</div>' +
      '<div class="pcard-sub"><span class="dot ' + af[0] + '"></span>' + af[1] + ' · <span title="Wechselbereitschaft">' + esc(il.t) + '</span></div></div>' + dealBtn(c, x) + '</div></article>';
  }

  function cards(c, list, extraFn) {
    return '<div class="pgrid">' + list.map(function (x) { return card(c, x, extraFn ? extraFn(x) : ''); }).join('') + '</div>';
  }

  /* Kompakte Liste fuer alle, die lieber Zeilen lesen */
  function table(c, list) {
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="star-col"></th><th>Pos</th><th>Spieler</th><th class="hide-sm">Verein</th><th class="num">Alter</th><th class="num">Stärke</th><th class="num hide-xs">Pot.</th>' +
      '<th class="num hide-xs" title="Unterschied zu deiner Besetzung">Δ</th><th class="num">Ablöse</th><th class="hide-sm">Budget</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (x) {
        var p = x.p, af = AFF[x.afford.level];
        return '<tr class="click" data-action="player" data-id="' + p.id + '"><td class="star-col">' + UI.starBtn(p) + '</td><td>' + UI.posTag(p.pos[0]) + '</td>' +
          '<td><span class="pname">' + esc(p.name) + '</span>' + UI.srcMark(p) + (p.wants ? ' <span class="tag warn">will weg</span>' : p.listed ? ' <span class="tag info">gelistet</span>' : '') + (p.injury ? ' <span class="tag bad">verletzt</span>' : '') +
          '<div class="muted tiny show-sm">' + (p.club ? esc(c.st.clubs[p.club].short) : 'vereinslos') + '</div></td>' +
          '<td class="hide-sm">' + (p.club ? UI.clubLink(p.club) : '<span class="tag">vereinslos</span>') + '</td><td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td>' +
          '<td class="num hide-xs">' + (x.pot.lo === x.pot.hi ? x.pot.lo : x.pot.lo + '–' + x.pot.hi) + '</td>' +
          '<td class="num hide-xs ' + (x.up && x.up.delta >= 1 ? 'good strong' : 'muted') + '">' + (x.up ? (x.up.delta > 0 ? '+' : '') + x.up.delta : '–') + '</td>' +
          '<td class="num strong">' + priceText(x) + '</td><td class="hide-sm"><span class="tag ' + af[0] + '">' + af[1] + '</span></td><td class="num">' + dealBtn(c, x) + '</td></tr>';
      }).join('') : '<tr><td colspan="11"><div class="empty">Keine Spieler gefunden.</div></td></tr>') + '</tbody></table></div>';
  }

  function chip(k, v, label, cur, title) {
    return '<button class="chip' + (String(cur) === String(v) ? ' on' : '') + '" data-action="setUi" data-k="' + k + '" data-v="' + v + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + label + '</button>';
  }
  function sel(label, key, opts, cur) {
    return '<div class="field"><label>' + label + '</label><select class="input" data-filter="' + key + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></div>';
  }

  /* ================= Rahmen ================= */
  UI.views.transfers = {
    title: 'Transfermarkt',
    render: function () {
      var s = state(), c = ctx(), st = c.st;
      var left = FM.windowDaysLeft(st);
      var chipW = left == null ? '<span class="tag">Fenster geschlossen</span>' : left <= 1 ? '<span class="tag deadline">Deadline Day</span>' : '<span class="tag good">Fenster offen · noch ' + left + ' Tage</span>';
      var nTalks = Object.keys(st.talks || {}).filter(function (k) { return FM.talkOf(st, k); }).length;
      var nOffers = st.offers.filter(function (o) { return o.status === 'open'; }).length;
      var count = { hub: nTalks, watch: (st.shortlist || []).length, sell: nOffers };
      var html = '<div class="page-h"><div><div class="eyebrow">' + esc(FM.windowLabel(st)) + '</div><h1>Transfermarkt</h1>' +
        '<div class="sub">' + chipW + ' · Kader ' + c.club.squad.length + '/34' + (c.open ? '' : ' · Vereinslose kannst du jederzeit holen, Vorverträge ab Januar') + '</div></div></div>' +
        UI.budgetPanel() +
        '<div class="tabs">' + TABS.map(function (t) {
          return '<button data-action="setUi" data-k="tab" data-v="' + t[0] + '" class="' + (s.tab === t[0] ? 'on' : '') + '">' + t[1] + (count[t[0]] ? ' <b>' + count[t[0]] + '</b>' : '') + '</button>';
        }).join('') + '</div>';
      return html + ({ hub: hubView, market: marketView, watch: watchView, sell: sellView, log: logView }[s.tab])(c, s);
    },
    mount: function (el) {
      var s = state();
      var q = el.querySelector('#t-q');
      if (q) {
        var timer;
        q.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { s.q = q.value; s.page = 0; UI.refresh(); var nq = document.getElementById('t-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 250);
        });
      }
      el.querySelectorAll('[data-filter]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var k = inp.getAttribute('data-filter');
          s[k] = { minOvr: 1, maxAge: 1, maxPrice: 1 }[k] ? +inp.value : inp.value;
          s.page = 0;
          UI.refresh();
        });
      });
    }
  };

  /* ================= Zentrale ================= */
  function hubView(c) {
    var st = c.st, n = c.needs, c1 = c.club.colors[0], ink = UI.ink(c1);
    var slots = n.slots.map(function (x) {
      var p = x.starter;
      var tip = FM.POS_NAME[x.pos] + ': ' + (p ? p.name + ' (' + x.eff + ')' : 'unbesetzt') + (x.backup ? ', Ersatz ' + x.backup.name + ' (' + x.beff + ')' : ', kein Ersatz') + (x.flags.length ? ' – ' + x.flags.join(', ') : '');
      return '<div class="slot ' + x.level + '" style="left:' + x.x + '%;bottom:' + x.y + '%" data-action="tmNeed" data-pos="' + x.pos + '" title="' + esc(tip) + '">' +
        '<div class="shirt" style="background:' + c1 + ';color:' + ink + '">' + (p ? x.eff : '–') + '</div><div class="nm">' + (p ? esc(last(p.name)) : 'offen') + '</div><div class="lbl">' + FM.POS_LABEL[x.pos] + '</div></div>';
    }).join('');
    var worst = n.slots.filter(function (x) { return x.level !== 'ok'; }).sort(function (a, b) { return b.need - a.need; }).slice(0, 4);
    var sites = worst.length ? worst.map(function (x) {
      var p = x.starter, gap = p ? Math.round((n.ref - x.eff) * 10) / 10 : null;
      return '<div class="li click" data-action="tmNeed" data-pos="' + x.pos + '">' + UI.posTag(x.pos) + '<div class="grow"><div class="strong">' + (p ? esc(p.name) + ' <span class="muted">(' + x.eff + ')</span>' : 'Position unbesetzt') + '</div>' +
        '<div class="muted small">' + [gap != null && gap >= 0.5 ? gap.toFixed(1).replace('.', ',') + ' unter dem Liga-Schnitt' : ''].concat(x.flags).filter(Boolean).map(esc).join(' · ') + '</div></div>' +
        '<span class="tag ' + (x.level === 'bad' ? 'bad' : 'warn') + '">' + (x.level === 'bad' ? 'Baustelle' : 'Im Auge behalten') + '</span>' + UI.icon('next').replace('<svg', '<svg width="16" height="16" class="muted"') + '</div>';
    }).join('') : '<div class="empty">Auf jeder Position solide besetzt. Schau dich trotzdem um – ein Talent für morgen schadet nie.</div>';
    var planner = '<div class="card"><div class="card-h"><h3>Kaderplaner</h3><span class="muted small">' + esc(n.formation) + ' · Liga-Schnitt ' + n.ref.toFixed(1).replace('.', ',') + '</span></div>' +
      '<div class="planner"><div class="pitch tm-pitch">' + UI.pitchLines() + slots + '</div>' +
      '<div class="planner-side"><div class="list">' + sites + '</div>' +
      '<div class="planner-legend"><span><i class="ok"></i>gut besetzt</span><span><i class="warn"></i>im Auge behalten</span><span><i class="bad"></i>Baustelle</span></div>' +
      '<p class="muted small" style="margin:0 16px 14px">Tipp auf eine Position – der Markt zeigt dir sofort alle Spieler, die dort stärker sind als deine Besetzung.</p></div></div></div>';

    var picks = FM.marketPicks(st, 6).map(function (x) { return info(c, x.p); });
    var picksHtml = '<div class="card"><div class="card-h"><h3>Für dich ausgesucht</h3><button class="btn sm" data-action="tmGo" data-preset="up">Alle Verstärkungen ' + UI.icon('next') + '</button></div>' +
      (picks.length ? '<div class="card-b">' + cards(c, picks) + '</div>' : '<div class="empty">Gerade ist niemand zu haben, der dich weiterbringt und ins Budget passt. Verkäufe schaffen Spielraum – oder der Scout findet jemanden.</div>') + '</div>';

    var shortcuts = '<div class="tm-short">' + [['bargain', 'Schnäppchen', 'Gelistete, Wechselwillige und Spieler unter Marktwert'], ['free', 'Ablösefrei', 'Vereinslose kosten nur Gehalt und Handgeld'], ['loan', 'Leihgaben', 'Spieler, die ihr Verein verleihen würde'], ['talent', 'Talente', 'Bis 21 Jahre mit Luft nach oben']].map(function (x) {
      return '<button class="tm-shortcut" data-action="tmGo" data-preset="' + x[0] + '"><span class="strong">' + x[1] + '</span><span class="muted small">' + x[2] + '</span></button>';
    }).join('') + '<button class="tm-shortcut" data-action="tmGo" data-league="eu"><span class="strong">Ausland</span><span class="muted small">Empfehlungen und Stars der Auslandsvereine</span></button></div>';

    var talks = Object.keys(st.talks || {}).map(function (k) { return FM.talkOf(st, k); }).filter(Boolean);
    var talksHtml = '<div class="card"><div class="card-h"><h3>Laufende Verhandlungen</h3></div><div class="list">' + (talks.length ? talks.map(function (t) {
      var p = st.players[t.pid];
      if (!p) return '';
      var cl = t.stage === 'club';
      return '<div class="li click" data-action="negotiate" data-id="' + p.id + '">' + UI.pill(p.ovr) + '<div class="grow"><div class="strong ellipsis">' + esc(p.name) + ' <span class="tag">' + FM.DEAL_LABEL[t.kind] + '</span></div>' +
        '<div class="muted small ellipsis">' + (cl ? 'mit ' + esc(st.clubs[p.club].short) : 'mit dem Spieler') + ' · bis ' + D.fmtShort(t.expires) + '</div></div>' + patience(cl ? t.pat : t.ppat, cl ? t.max : t.pmax) + '</div>';
    }).join('') : '<div class="empty">Kein Gespräch offen.</div>') + '</div></div>';

    var open = st.offers.filter(function (o) { return o.status === 'open'; });
    var offersHtml = '<div class="card"><div class="card-h"><h3>Angebote für deine Spieler</h3>' + (open.length ? '' : '<button class="btn sm" data-action="setUi" data-k="tab" data-v="sell">Spieler anbieten</button>') + '</div><div class="list">' +
      (open.length ? open.map(function (o) { return offerRow(st, o, true); }).join('') : '<div class="empty">Keine offenen Angebote.</div>') + '</div></div>';

    var news = st.transfers.filter(function (t) { return !t.loan && (t.fee >= 1e6 || t.to === c.uc || t.from === c.uc); }).slice(0, 6);
    var ticker = '<div class="card"><div class="card-h"><h3>Zuletzt gewechselt</h3><button class="btn sm" data-action="setUi" data-k="tab" data-v="log">Ticker</button></div><div class="list">' +
      (news.length ? news.map(function (t) { return tickerRow(st, t); }).join('') : '<div class="empty">Noch keine Transfers in diesem Fenster.</div>') + '</div></div>';

    return planner + shortcuts + '<div class="grid dash" style="margin-top:16px"><div class="stack">' + picksHtml + '</div><div class="stack">' + talksHtml + offersHtml + ticker + '</div></div>';
  }

  function tickerRow(st, t) {
    var to = st.clubs[t.to], from = t.from ? st.clubs[t.from] : null;
    return '<div class="li"' + (t.to === st.user.club || t.from === st.user.club ? ' style="background:var(--accent-soft)"' : '') + '>' + UI.badge(to, 26) + '<div class="grow"><div class="ellipsis"><span class="strong">' + esc(t.name) + '</span> <span class="muted small">' + FM.POS_LABEL[t.pos] + ' · ' + t.ovr + '</span></div>' +
      '<div class="muted small ellipsis">' + (from ? esc(from.short) : 'vereinslos') + ' → ' + esc(to ? to.short : '?') + ' · ' + D.fmtShort(t.date) + '</div></div>' +
      '<span class="strong nowrap">' + (t.loan ? 'Leihe' : t.pre ? 'Vorvertrag' : t.fee ? FM.fmtMoneyShort(t.fee) + ' €' : 'frei') + '</span>' + (t.rec ? '<span class="tag accent" title="Rekordtransfer des Vereins">Rekord</span>' : '') + '</div>';
  }

  UI.actions.tmNeed = function (el) {
    var s = state();
    Object.assign(s, { tab: 'market', pos: el.getAttribute('data-pos'), preset: 'up', sort: 'up', page: 0, q: '', league: 'de' });
    UI.refresh();
    window.scrollTo(0, 0);
  };
  UI.actions.tmGo = function (el) {
    var s = state();
    Object.assign(s, { tab: 'market', pos: 'all', preset: el.getAttribute('data-preset') || 'all', league: el.getAttribute('data-league') || 'de', sort: el.getAttribute('data-preset') === 'up' ? 'up' : 'best', page: 0, q: '' });
    UI.refresh();
    window.scrollTo(0, 0);
  };
  UI.actions.tmReset = function () {
    var s = state();
    Object.assign(s, { q: '', preset: 'all', pos: 'all', league: 'de', minOvr: 0, maxAge: 40, maxPrice: 0, sort: 'best', page: 0 });
    UI.refresh();
  };

  /* ================= Markt ================= */
  function marketView(c, s) {
    var st = c.st, y = c.y;
    var q = (s.q || '').toLowerCase().trim();
    var list = [];
    Object.keys(st.players).forEach(function (pid) {
      var p = st.players[pid];
      if (!FM.onMarket(st, p, s.league === 'eu')) return;
      var cl = p.club ? st.clubs[p.club] : null;
      if (s.league === 'eu') { if (!cl || !cl.eu) return; }
      else if (s.league === 'de') { if (cl && cl.eu) return; }
      else if (!cl || cl.league !== s.league) return;
      if (s.pos !== 'all' && p.pos.indexOf(s.pos) < 0) return;
      if (p.ovr < s.minOvr || p.age > s.maxAge) return;
      if (s.preset === 'free' && p.club) return;
      if (s.preset === 'loan' && !FM.loanable(st, p)) return;
      if (s.preset === 'expiring' && !(p.club && !p.loan && !p.pre && p.contract.until <= y + 1)) return;
      if (s.preset === 'clause' && !(p.club && p.contract.clause)) return;
      if (q && p.name.toLowerCase().indexOf(q) < 0 && !(cl && cl.name.toLowerCase().indexOf(q) >= 0)) return;
      list.push(p);
    });
    var rows = list.map(function (p) { return info(c, p); });
    if (s.preset === 'up') rows = rows.filter(function (x) { return x.up && x.up.delta >= 1 && !x.p.loan && !x.p.pre; });
    if (s.preset === 'afford') rows = rows.filter(function (x) { return x.afford.level === 'ok' && !x.p.loan && !x.p.pre; });
    if (s.preset === 'bargain') rows = rows.filter(function (x) { return !x.p.loan && !x.p.pre && (x.p.listed || x.p.wants || !x.p.club || x.price <= FM.marketValue(x.p) * 1.02); });
    if (s.preset === 'talent') rows = rows.filter(function (x) { return x.p.age <= 21 && x.pot.lo - x.p.ovr >= 5; });
    if (s.maxPrice) rows = rows.filter(function (x) { return x.price <= s.maxPrice; });
    var key = {
      best: function (x) { return -x.p.ovr * 100 + x.p.age; },
      up: function (x) { return -(x.up ? x.up.delta : -99) * 100 - x.p.ovr; },
      cheap: function (x) { return x.price - x.p.ovr; },
      deal: function (x) { return -(x.p.ovr - 5.5 * Math.log(Math.max(x.price, 60000)) / Math.LN10); },
      young: function (x) { return x.p.age * 100 - x.p.ovr; },
      pot: function (x) { return -x.pot.lo * 100 - x.p.ovr; }
    }[s.sort] || function (x) { return -x.p.ovr; };
    rows.sort(function (a, b) { return key(a) - key(b); });
    var total = rows.length, shown = rows.slice(0, PAGE * ((s.page || 0) + 1));

    var posChips = chip('pos', 'all', 'Alle', s.pos) + FM.POS_ORDER.map(function (p) { return chip('pos', p, FM.POS_LABEL[p], s.pos, FM.POS_NAME[p]); }).join('');
    var active = s.preset !== 'all' || s.pos !== 'all' || s.league !== 'de' || s.minOvr || s.maxAge < 40 || s.maxPrice || q;
    var filters = '<div class="card tm-filter"><div class="card-b">' +
      '<div class="tm-search"><div class="field grow"><label for="t-q">Suche</label><input class="input" id="t-q" placeholder="Spieler oder Verein" value="' + esc(s.q) + '"></div>' +
      sel('Sortierung', 'sort', SORTS, s.sort) +
      '<div class="field"><label>Ansicht</label>' + UI.seg('mode', [['cards', 'Karten'], ['list', 'Liste']], s.mode) + '</div></div>' +
      '<div class="tm-chiprow"><span class="tm-chiplabel">Schnellfilter</span><div class="chips">' + PRESETS.map(function (p) { return chip('preset', p[0], p[1], s.preset); }).join('') + '</div></div>' +
      '<div class="tm-chiprow"><span class="tm-chiplabel">Position</span><div class="chips">' + posChips + '</div></div>' +
      '<div class="filters" style="margin:12px 0 0">' + sel('Liga', 'league', LEAGUES, s.league) +
      sel('Stärke ab', 'minOvr', [[0, 'beliebig'], [60, '60+'], [65, '65+'], [70, '70+'], [75, '75+'], [80, '80+'], [85, '85+']], s.minOvr) +
      sel('Alter bis', 'maxAge', [[40, 'beliebig'], [19, '19'], [21, '21'], [23, '23'], [25, '25'], [28, '28'], [31, '31']], s.maxAge) +
      sel('Ablöse bis', 'maxPrice', [[0, 'beliebig'], [250000, '250 Tsd.'], [1000000, '1 Mio.'], [3000000, '3 Mio.'], [10000000, '10 Mio.'], [25000000, '25 Mio.'], [60000000, '60 Mio.']], s.maxPrice) +
      (active ? '<div class="field"><label>&nbsp;</label><button class="btn ghost" data-action="tmReset">' + UI.icon('x') + ' Filter zurücksetzen</button></div>' : '') + '</div></div></div>';

    var head = '<div class="tm-result"><span><b>' + FM.fmtInt(total) + '</b> Spieler' + (s.pos !== 'all' ? ' · ' + esc(FM.POS_NAME[s.pos]) : '') + (s.preset !== 'all' ? ' · ' + PRESETS.filter(function (p) { return p[0] === s.preset; })[0][1] : '') + '</span>' +
      '<span class="muted small">Karte antippen für das Profil, ★ merkt den Spieler vor</span></div>';
    var body = !total ? '<div class="card"><div class="empty">Kein Spieler passt zu dieser Auswahl. ' + (active ? 'Lockere die Filter oder ' : '') + 'schicke einen Scout los.</div></div>' :
      s.mode === 'list' ? '<div class="card">' + table(c, shown) + '</div>' : cards(c, shown);
    var more = shown.length < total ? '<div class="tm-more"><button class="btn" data-action="setUi" data-k="page" data-v="' + ((s.page || 0) + 1) + '">Weitere ' + Math.min(PAGE, total - shown.length) + ' anzeigen</button><span class="muted small">' + shown.length + ' von ' + FM.fmtInt(total) + '</span></div>' : '';
    return filters + head + body + more;
  }

  /* ================= Merkliste & Scouting ================= */
  function watchView(c) {
    var st = c.st, club = c.club;
    var list = (st.shortlist || []).map(function (id) { return st.players[id]; }).filter(function (p) { return p && p.club !== c.uc; }).map(function (p) { return info(c, p); });
    var html = '<div class="card"><div class="card-h"><h3>Merkliste</h3><span class="muted small">' + list.length + ' Spieler · mit ★ in jeder Liste vormerken</span></div>' +
      (list.length ? '<div class="card-b">' + cards(c, list) + '</div>' : '<div class="empty">Noch niemand vorgemerkt. Der Stern auf jeder Spielerkarte setzt einen Spieler hierher – so hast du Preis, Vertrag und Wechselbereitschaft im Blick.</div>') + '</div>';

    var f = UI.vs('scoutForm', { grp: 'all', maxAge: 40, league: 'all', maxPrice: 0, style: 'best' });
    var busy = (st.scouts || []).filter(function (x) { return !x.res; }).length, slots = FM.scoutSlots(club);
    var posOpts = [['all', 'Alle Positionen'], ['GK', 'Torhüter'], ['DEF', 'Abwehr'], ['MID', 'Mittelfeld'], ['ATT', 'Angriff']].concat(FM.POS_ORDER.map(function (p) { return ['p:' + p, FM.POS_NAME[p]]; }));
    var opt = function (id, opts, cur) { return '<select class="input" id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
    html += '<div class="card"><div class="card-h"><h3>Scout losschicken</h3><span class="muted small">' + (slots - busy) + ' von ' + slots + ' Scouts frei · Bericht nach ' + FM.scoutDays(club) + ' Tagen</span></div>' +
      '<div class="card-b"><div class="filters" style="margin-bottom:0">' +
      '<div class="field"><label>Position</label>' + opt('sc-pos', posOpts, f.grp) + '</div>' +
      '<div class="field"><label>Alter bis</label>' + opt('sc-age', [[40, 'beliebig'], [19, '19'], [21, '21'], [23, '23'], [26, '26'], [29, '29']], f.maxAge) + '</div>' +
      '<div class="field"><label>Liga</label>' + opt('sc-league', [['all', 'Alle Ligen'], ['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rl', 'Regionalliga'], ['eu', 'Ausland']], f.league) + '</div>' +
      '<div class="field"><label>Ablöse bis</label>' + opt('sc-price', [[0, 'beliebig'], [500000, '500 Tsd.'], [2000000, '2 Mio.'], [5000000, '5 Mio.'], [10000000, '10 Mio.'], [25000000, '25 Mio.']], f.maxPrice) + '</div>' +
      '<div class="field"><label>Schwerpunkt</label>' + opt('sc-style', [['best', 'Beste Verstärkung'], ['young', 'Talente'], ['cheap', 'Schnäppchen']], f.style) + '</div>' +
      '<div class="field"><label>&nbsp;</label><button class="btn primary" data-action="scoutGo"' + (busy >= slots ? ' disabled' : '') + '>' + UI.icon('search') + ' Losschicken</button></div>' +
      '</div><p class="muted small" style="margin-top:10px">Ein Scout empfiehlt bis zu acht Spieler, die zu Vorgaben, Budget und Kader passen – ihr Potenzial kennst du danach genau. Mehr Scouts und schnellere Berichte bringt eine bessere <a href="#" data-action="go" data-view="infra">Scoutingabteilung</a>.</p></div></div>';
    html += (st.scouts || []).map(function (x) {
      var head = '<div class="card-h"><h3>Scoutbericht: ' + esc(FM.scoutLabel(x.f)) + '</h3><div class="row">' +
        (x.res ? '<span class="muted small">vom ' + D.fmt(x.ready) + '</span><button class="btn sm ghost icon" data-action="scoutDel" data-id="' + x.id + '" aria-label="Bericht löschen">' + UI.icon('trash') + '</button>' :
          '<span class="tag info">unterwegs · Bericht am ' + D.fmt(x.ready) + '</span>') + '</div></div>';
      if (!x.res) return '<div class="card">' + head + '</div>';
      var found = x.res.map(function (id) { return st.players[id]; }).filter(function (p) { return p && p.club !== c.uc; }).map(function (p) { return info(c, p); });
      return '<div class="card">' + head + (found.length ? '<div class="card-b">' + cards(c, found, function (r) {
        var rep = FM.scoutReport(st, r.p);
        return '<span class="grade-badge ' + rep.grade + '" title="' + esc(rep.tag) + '">' + rep.grade + '</span>';
      }) + '</div>' : '<div class="empty">Kein passender Spieler gefunden.</div>') + '</div>';
    }).join('');
    return html;
  }

  UI.actions.scoutGo = function () {
    var st = FM.state, f = UI.vs('scoutForm');
    var pos = document.getElementById('sc-pos').value;
    f.grp = pos;
    f.maxAge = +document.getElementById('sc-age').value;
    f.league = document.getElementById('sc-league').value;
    f.maxPrice = +document.getElementById('sc-price').value;
    f.style = document.getElementById('sc-style').value;
    var filter = { grp: pos.indexOf('p:') === 0 ? 'all' : pos, pos: pos.indexOf('p:') === 0 ? pos.slice(2) : 'all', maxAge: f.maxAge, league: f.league, maxPrice: f.maxPrice, style: f.style };
    var r = FM.startScout(st, filter);
    UI.toast(r.msg, r.ok ? 'good' : 'bad');
    FM.save(UI.slot || 1);
    UI.refresh();
  };
  UI.actions.scoutDel = function (el) {
    var st = FM.state, id = el.getAttribute('data-id');
    st.scouts = (st.scouts || []).filter(function (x) { return x.id !== id; });
    UI.refresh();
  };
  UI.actions.watch = function (el, e) {
    if (e) e.stopPropagation();
    var pid = el.getAttribute('data-id');
    var on = FM.toggleShortlist(FM.state, pid);
    UI.toast(on ? 'Auf der Merkliste.' : 'Von der Merkliste genommen.');
    var keep = UI.modalOpen && !document.querySelector('.modal.deal');
    UI.refresh();
    if (keep) UI.playerModal(pid);
  };

  /* ================= Abgeben: Angebote, eigener Kader, Leihen ================= */
  function offerRow(st, o, act) {
    var p = st.players[o.pid], cl = st.clubs[o.from];
    var mv = p ? FM.marketValue(p) : 0;
    var what = o.type === 'loan' ? 'Leihe · ' + Math.round(o.share * 100) + ' % Gehalt' + (o.option ? ' · Kaufoption ' + FM.fmtMoneyShort(o.option) + ' €' : '') : FM.fmtMoney(o.fee);
    var cmp = o.type !== 'loan' && mv ? Math.round((o.fee / mv - 1) * 100) : null;
    return '<div class="li offer">' + UI.badge(cl, 30) + '<div class="grow"><div class="strong">' + esc(cl.short) + ' → ' + (p ? UI.playerLink(p) : 'ehemaliger Spieler') + '</div>' +
      '<div class="muted small">' + what + (cmp != null ? ' · <span class="' + (cmp >= 0 ? 'good' : 'bad') + '">' + (cmp >= 0 ? '+' : '') + cmp + ' % zum Marktwert</span>' : '') + ' · ' +
      (act ? 'bis ' + D.fmtShort(o.expires) : ({ accepted: 'angenommen', declined: 'abgelehnt', expired: 'abgelaufen' }[o.status] || o.status)) + '</div></div>' +
      (act ? '<div class="row wrap offer-act"><button class="btn sm" data-action="offerRespond" data-id="' + o.id + '" data-ok="0">Ablehnen</button>' +
        (o.type !== 'loan' ? '<button class="btn sm" data-action="offerCounter" data-id="' + o.id + '">Mehr verlangen</button>' : '') +
        '<button class="btn sm primary" data-action="offerRespond" data-id="' + o.id + '" data-ok="1">Annehmen</button></div>' : '') + '</div>';
  }

  function sellView(c) {
    var st = c.st, uc = c.uc, club = c.club;
    var open = st.offers.filter(function (o) { return o.status === 'open'; });
    var past = st.offers.filter(function (o) { return o.status !== 'open'; }).slice(-10).reverse();
    var html = '<div class="card"><div class="card-h"><h3>Angebote für deine Spieler</h3><span class="muted small">' + (c.open ? 'Angebote kommen vor allem für gelistete Spieler' : 'Angebote gibt es nur im Transferfenster') + '</span></div><div class="list">' +
      (open.length ? open.map(function (o) { return offerRow(st, o, true); }).join('') : '<div class="empty">Keine offenen Angebote. Setze unten Spieler auf die Transfer- oder Leihliste, um Interessenten anzulocken.</div>') + '</div></div>';

    var mine = FM.clubPlayers(st, uc).filter(function (p) { return !p.loan; });
    var rank = function (p) { return (p.listed || p.wants || p.loanList ? -10 : 0) + (ROLE_ORDER[FM.roleOf(st, p)] || 0); };
    mine.sort(function (a, b) { return rank(a) - rank(b) || FM.marketValue(b) - FM.marketValue(a); });
    html += '<div class="card"><div class="card-h"><h3>Dein Kader auf dem Markt</h3><span class="muted small">Listen ein- und ausschalten – Ergänzungsspieler stehen oben</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pos</th><th>Spieler</th><th class="num">Alter</th><th class="num">Stärke</th><th class="hide-sm">Rolle</th><th class="num">Marktwert</th><th class="num hide-xs">Gehalt</th><th class="num hide-sm">Vertrag</th><th>Markt</th></tr></thead><tbody>' +
      mine.map(function (p) {
        var ends = p.contract.until <= c.y + 1, loanOk = p.age <= 23 || FM.squadRank(st, p) > 14;
        return '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td><span class="pname">' + esc(p.name) + '</span>' + (p.wants ? ' <span class="tag warn">will weg</span>' : '') + (p.pre ? ' <span class="tag warn">Vorvertrag</span>' : '') + '</td>' +
          '<td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="hide-sm small dim">' + FM.ROLE_LABEL[FM.roleOf(st, p)] + '</td><td class="num">' + FM.fmtMoney(FM.marketValue(p)) + '</td>' +
          '<td class="num hide-xs">' + FM.fmtMoneyShort(p.contract.wage) + '</td><td class="num hide-sm ' + (ends ? 'warn strong' : '') + '">' + p.contract.until + '</td>' +
          '<td class="nowrap">' + (p.pre ? '<span class="muted tiny">geht im Sommer</span>' : '<button class="chip sm' + (p.listed ? ' on' : '') + '" data-action="tmList" data-id="' + p.id + '" data-k="sell" title="Transferliste">Verkauf</button>' +
            (loanOk ? '<button class="chip sm' + (p.loanList ? ' on' : '') + '" data-action="tmList" data-id="' + p.id + '" data-k="loan" title="Leihliste">Leihe</button>' : '')) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    var inn = FM.clubPlayers(st, uc).filter(function (p) { return p.loan; });
    var out = (club.loanedOut || []).map(function (id) { return st.players[id]; }).filter(function (p) { return p && p.loan; });
    if (inn.length) html += '<div class="card"><div class="card-h"><h3>Bei dir ausgeliehen</h3><span class="muted small">Leihe endet zum Saisonende</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Von</th><th class="num">Dein Gehaltsanteil</th><th class="num hide-xs">Einsätze</th><th class="num">Kaufoption</th><th></th></tr></thead><tbody>' +
      inn.map(function (p) {
        return '<tr><td>' + UI.posTag(p.pos[0]) + ' ' + UI.playerLink(p) + ' ' + UI.pill(p.ovr) + '</td><td>' + UI.clubLink(p.loan.from) + '</td><td class="num">' + Math.round(p.loan.share * 100) + ' % · ' + FM.fmtMoneyShort(p.contract.wage * p.loan.share) + '</td>' +
          '<td class="num hide-xs">' + p.st.apps + '</td><td class="num">' + (p.loan.option ? FM.fmtMoney(p.loan.option) : '<span class="muted">keine</span>') + '</td>' +
          '<td class="num">' + (p.loan.option ? '<button class="btn sm primary" data-action="exerciseOpt" data-id="' + p.id + '">Ziehen</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    if (out.length) html += '<div class="card"><div class="card-h"><h3>Verliehen</h3><span class="muted small">Spielpraxis bei anderen Vereinen</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Bei</th><th class="num">Sp</th><th class="num hide-xs">Min</th><th class="num">Tore</th><th class="num">Stärke</th></tr></thead><tbody>' +
      out.map(function (p) {
        var d = p.ovr0 != null ? p.ovr - p.ovr0 : 0;
        return '<tr><td>' + UI.posTag(p.pos[0]) + ' ' + UI.playerLink(p) + '</td><td>' + UI.clubLink(p.club) + '</td><td class="num">' + p.st.apps + '</td><td class="num hide-xs">' + p.st.mins + '</td><td class="num">' + p.st.goals + '</td>' +
          '<td class="num">' + UI.pill(p.ovr) + (d ? ' <span class="tiny ' + (d > 0 ? 'good' : 'bad') + '">' + (d > 0 ? '+' : '') + d + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    if (past.length) html += '<div class="card"><div class="card-h"><h3>Frühere Angebote</h3></div><div class="list">' + past.map(function (o) { return offerRow(st, o, false); }).join('') + '</div></div>';
    return html;
  }

  UI.actions.tmList = function (el, e) {
    if (e) e.stopPropagation();
    var p = FM.state.players[el.getAttribute('data-id')];
    if (!p) return;
    if (el.getAttribute('data-k') === 'sell') { p.listed = !p.listed; if (p.listed) p.loanList = false; UI.toast(p.listed ? p.name + ' steht auf der Transferliste.' : p.name + ' ist nicht mehr gelistet.'); }
    else { p.loanList = !p.loanList; if (p.loanList) p.listed = false; UI.toast(p.loanList ? p.name + ' steht auf der Leihliste.' : p.name + ' ist nicht mehr auf der Leihliste.'); }
    UI.refresh();
  };

  UI.actions.offerCounter = function (el) {
    var st = FM.state, o = st.offers.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (!o) return;
    var p = st.players[o.pid], cl = st.clubs[o.from];
    UI.modal(UI.modalHead('Mehr verlangen', esc(cl.name) + ' bietet ' + FM.fmtMoney(o.fee) + ' für ' + esc(p.name)) +
      '<div class="modal-b"><div class="stack"><p class="dim small">Nenne deinen Preis. Liegt er im Rahmen, nimmt ' + esc(cl.short) + ' an und der Transfer ist sofort perfekt. Ist er zu hoch, bessert der Verein nach – oder zieht sein Angebot zurück.</p>' +
      '<div class="field"><label>Deine Forderung (€)</label><input class="input" id="oc-fee" type="number" step="50000" value="' + FM.niceRound(o.fee * 1.2) + '"></div>' +
      '<div class="row wrap" style="gap:6px">' + [10, 20, 35].map(function (x) { return '<button class="chip" type="button" data-v="' + FM.niceRound(o.fee * (1 + x / 100)) + '">+' + x + ' %</button>'; }).join('') + '<span class="muted small">Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + '</span></div><div id="oc-msg"></div></div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn primary" id="oc-ok">Forderung stellen</button></div>',
      { size: 'narrow', mount: function (m) {
        m.querySelectorAll('[data-v]').forEach(function (b) { b.addEventListener('click', function () { m.querySelector('#oc-fee').value = b.getAttribute('data-v'); }); });
        m.querySelector('#oc-ok').addEventListener('click', function () {
          var r = FM.counterOffer(st, o.id, +m.querySelector('#oc-fee').value);
          FM.save(UI.slot || 1);
          if (r.improved) { m.querySelector('#oc-msg').innerHTML = '<div class="note warn">' + esc(r.msg) + '</div>'; UI.refresh(); return; }
          UI.closeModal(); UI.toast(r.msg, r.ok ? 'good' : 'bad'); UI.refresh();
        });
      } });
  };

  UI.actions.exerciseOpt = function (el) {
    var st = FM.state, p = st.players[el.getAttribute('data-id')];
    if (!p || !p.loan) return;
    UI.confirm('Kaufoption ziehen?', p.name + ' wird für <b>' + FM.fmtMoney(p.loan.option) + '</b> (plus 10 % Beraterhonorar) fest verpflichtet. Sein Gehalt von ' + FM.fmtMoney(p.contract.wage) + ' zahlst du dann komplett.', 'Kaufoption ziehen', function () {
      var r = FM.exerciseOption(st, p);
      UI.toast(r.msg, r.ok ? 'good' : 'bad');
      FM.save(UI.slot || 1);
      UI.refresh();
    });
  };

  /* ================= Bilanz & Ticker ================= */
  function logView(c, s) {
    var st = c.st, uc = c.uc, since = D.iso(c.y, 7, 1);
    var mine = st.transfers.filter(function (t) { return t.date >= since && (t.to === uc || t.from === uc); });
    var ins = mine.filter(function (t) { return t.to === uc; }), outs = mine.filter(function (t) { return t.from === uc; });
    var spend = FM.sum(ins, function (t) { return t.fee; }), earn = FM.sum(outs, function (t) { return t.fee; });
    var label = function (t) { return t.loan ? '<span class="tag info">Leihe</span>' : t.pre ? '<span class="tag">Vorvertrag</span>' : t.option ? '<span class="tag">Kaufoption</span>' : t.fee ? FM.fmtMoney(t.fee) : '<span class="muted">ablösefrei</span>'; };
    var tbl = function (list, other) {
      return list.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + list.map(function (t) {
        var p = st.players[t.pid];
        return '<tr><td class="small nowrap">' + D.fmtShort(t.date) + '</td><td>' + (p ? UI.playerLink(p) : esc(t.name)) + ' <span class="muted small">' + FM.POS_LABEL[t.pos] + ' · ' + t.ovr + '</span></td><td class="hide-sm">' + (t[other] ? UI.clubLink(t[other]) : '<span class="muted">vereinslos</span>') + '</td><td class="num">' + label(t) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Keine.</div>';
    };
    var pays = (st.payments || []).filter(function (x) { return x.from === uc || x.to === uc; });
    var rin = c.club.recIn, rout = c.club.recOut;
    var html = '<div class="grid g4" style="margin-bottom:16px">' +
      '<div class="card stat"><div class="label">Ablösen bezahlt</div><div class="value">' + FM.fmtMoneyShort(spend) + ' €</div><div class="meta">' + ins.length + ' Zugänge</div></div>' +
      '<div class="card stat"><div class="label">Ablösen erhalten</div><div class="value">' + FM.fmtMoneyShort(earn) + ' €</div><div class="meta">' + outs.length + ' Abgänge</div></div>' +
      '<div class="card stat"><div class="label">Transfersaldo</div><div class="value ' + (earn - spend >= 0 ? 'good' : 'bad') + '">' + FM.fmtMoney(earn - spend, { sign: true }) + '</div><div class="meta">Saison ' + c.y + '/' + String(c.y + 1).slice(2) + '</div></div>' +
      '<div class="card stat"><div class="label">Rekordtransfers</div><div class="value" style="font-size:20px">' + (rin ? FM.fmtMoneyShort(rin.fee) + ' €' : '–') + '</div><div class="meta">' + (rin ? 'Zugang: ' + esc(rin.name) : 'noch kein Rekordzugang') + (rout ? ' · Abgang: ' + esc(rout.name) + ' (' + FM.fmtMoneyShort(rout.fee) + ')' : '') + '</div></div></div>' +
      '<div class="grid g2"><div class="card"><div class="card-h"><h3>Zugänge</h3></div>' + tbl(ins, 'from') + '</div><div class="card"><div class="card-h"><h3>Abgänge</h3></div>' + tbl(outs, 'to') + '</div></div>';
    if (pays.length) html += '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Offene Raten</h3><span class="muted small">Fällige Raten erhöhen die Liquiditätsreserve</span></div><div class="list">' + pays.map(function (x) {
      return '<div class="li"><div class="grow"><div class="strong">' + esc(x.name) + '</div><div class="muted small">fällig am ' + D.fmt(x.due) + ' · ' + (x.from === uc ? 'an ' + esc(st.clubs[x.to].short) : 'von ' + esc(st.clubs[x.from].short)) + '</div></div><span class="strong ' + (x.from === uc ? 'bad' : 'good') + '">' + (x.from === uc ? '−' : '+') + FM.fmtMoney(x.amount) + '</span></div>';
    }).join('') + '</div></div>';

    var ul = c.club.league;
    var all = st.transfers.filter(function (t) {
      if (s.log === 'mine') return t.to === uc || t.from === uc;
      if (s.log === 'top') return t.fee >= 5e6;
      if (s.log === 'league') return (st.clubs[t.to] && st.clubs[t.to].league === ul) || (t.from && st.clubs[t.from] && st.clubs[t.from].league === ul);
      if (s.log === 'abroad') return (st.clubs[t.to] && st.clubs[t.to].eu) || (t.from && st.clubs[t.from] && st.clubs[t.from].eu);
      return true;
    }).slice(0, 60);
    html += '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Transferticker</h3>' + UI.seg('log', [['all', 'Alle'], ['league', 'Meine Liga'], ['top', 'Ab 5 Mio.'], ['abroad', 'Ausland'], ['mine', 'Mein Verein']], s.log) + '</div><div class="list">' +
      (all.length ? all.map(function (t) { return tickerRow(st, t); }).join('') : '<div class="empty">Keine Transfers in dieser Auswahl.</div>') + '</div></div>';
    return html;
  }
})();
