/* ---------------------------------------------------------------------
   Die Oberflaeche: neun Bildschirme.

   Regel eins: hier wird nichts gerechnet. Jede Zahl kommt aus
   state.derive() oder einer Funktion der Logikmodule. Wo die Anzeige
   selbst rechnet, laeuft sie frueher oder spaeter auseinander mit dem,
   was die Wochenabrechnung tatsaechlich abbucht.

   Regel zwei: kein Knopf ohne Wirkung. Was nicht geht, ist ausgegraut
   und nennt den Grund - nicht erst nach dem Klick.

   Alle Klicks laufen ueber data-act und eine einzige Weiche in game.js.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D, U, St, A;

  var G = null;                    /* Spielsteuerung, von game.js gesetzt */
  var sel = { district: 'oldtown', opCrew: {}, bizFilter: 'all', crewFilter: 'all' };

  var SCREENS = [
    { id: 'overview', name: 'Overview',     icon: 'grid' },
    { id: 'city',     name: 'City',         icon: 'map' },
    { id: 'business', name: 'Businesses',   icon: 'building' },
    { id: 'crew',     name: 'Crew',         icon: 'people' },
    { id: 'org',      name: 'Organization', icon: 'org' },
    { id: 'rivals',   name: 'Rivals',       icon: 'swords' },
    { id: 'finance',  name: 'Finances',     icon: 'chart' },
    { id: 'log',      name: 'Events',       icon: 'bell' },
    { id: 'awards',   name: 'Achievements', icon: 'trophy' }
  ];

  function init(game) {
    G = game;
    D = CE.data; U = CE.util; St = CE.state; A = CE.art;
  }

  /* ------------------------------------------------------- Bausteine */

  function e(s) { return U.esc(s); }
  function money(n) { return U.money(n); }

  function bar(cls, pct) {
    return '<div class="bar ' + cls + '"><i style="width:' + U.clamp(pct * 100, 0, 100).toFixed(1) + '%"></i></div>';
  }
  function statBox(label, value, note, cls) {
    return '<div class="stat"><div class="stat__l">' + e(label) + '</div>' +
      '<div class="stat__v ' + (cls || '') + '">' + value + '</div>' +
      (note ? '<div class="stat__n">' + note + '</div>' : '') + '</div>';
  }
  function btn(label, act, opts) {
    opts = opts || {};
    var attrs = ' data-act="' + act + '"';
    for (var k in opts.data || {}) attrs += ' data-' + k + '="' + e(String(opts.data[k])) + '"';
    if (opts.disabled) attrs += ' disabled';
    if (opts.title) attrs += ' title="' + e(opts.title) + '"';
    return '<button type="button" class="btn ' + (opts.cls || '') + '"' + attrs + '>' + label + '</button>';
  }
  function money0(n) { return n >= 0 ? '<span class="green">' + U.moneySigned(n) + '</span>'
                                     : '<span class="red">' + U.moneySigned(n) + '</span>'; }

  /* ================================================== 1 UEBERSICHT */

  function overview(s, d) {
    var h = [];
    var band = St.heatBand(s.heat);
    var city = CE.progress.cityProgress(s);

    h.push('<div class="page-head"><div><h2>Overview</h2>' +
      '<p>' + e(D.RANKS[d.rank].blurb) + '</p></div>' +
      '<div class="tag tag--gold">' + city.held + '/' + city.total + ' districts controlled</div></div>');

    /* Rang + Geld */
    h.push('<div class="hero">');
    h.push('<div class="card rankcard">' +
      '<div class="card__title"><b>Standing</b><span>' + d.notoriety + ' notoriety</span></div>' +
      '<div class="rankcard__rank">' + e(d.rankName) + '</div>' +
      '<div class="rankcard__blurb">' + e(D.RANKS[d.rank].blurb) + '</div>' +
      (d.nextRank
        ? '<div class="rankcard__next"><span>Next: ' + e(d.nextRank.name) + '</span>' +
          '<span>' + d.notoriety + ' / ' + d.nextRank.at + '</span></div>' +
          bar('bar--g', d.rankProgress)
        : '<div class="rankcard__next"><span class="gold">Highest rank reached</span></div>' + bar('bar--g', 1)) +
      '<div class="money-grid" style="margin-top:18px">' +
        statBox('Cash', money(s.cash), '', 'gold') +
        statBox('Net worth', money(d.netWorth), money(d.bizValue) + ' in assets') +
        statBox('Net / week', U.moneySigned(d.net), '', d.net >= 0 ? 'green' : 'red') +
      '</div></div>');

    /* Wochenbilanz */
    var maxFlow = Math.max(d.grossIncome, d.expenses, 1);
    h.push('<div class="card"><div class="card__title"><b>This week</b>' +
      '<span>' + (s.flags.layLowUntil > s.day ? '<span class="amber">Lying low</span>' : 'projected') + '</span></div>' +
      '<div class="pnl">' +
      pnlRow('Legal revenue', d.cleanGross, maxFlow, '#4ad98a') +
      pnlRow('Underground revenue', d.dirtyGross, maxFlow, '#e04141') +
      (d.launderLoss > 0 ? pnlRow('Laundering losses', -d.launderLoss, maxFlow, '#8e1f1f') : '') +
      (d.heatLoss > 0 ? pnlRow('Police pressure', -d.heatLoss, maxFlow, '#8e1f1f') : '') +
      pnlRow('Upkeep', -d.upkeep, maxFlow, '#6d7280') +
      pnlRow('Salaries', -d.salaries, maxFlow, '#6d7280') +
      pnlRow('Organisation', -d.orgUpkeep, maxFlow, '#6d7280') +
      pnlRow('Districts', -d.districtCost, maxFlow, '#6d7280') +
      '</div>' +
      '<div class="pnl__row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">' +
      '<span style="font-weight:600">Net</span><b class="' + (d.net >= 0 ? 'green' : 'red') + '">' +
      U.moneySigned(d.net) + '</b></div>' +
      (d.launderLoss > 0
        ? '<div class="why">Underground revenue above ' + money(d.launderCap) + ' loses 42%. ' +
          'Buy legal businesses or a Laundering Chain to widen capacity.</div>' : '') +
      '</div>');
    h.push('</div>');

    /* Vier Messwerte */
    h.push('<div class="grid grid--4" style="margin-bottom:14px">');
    h.push('<div class="card">' + statBox('Reputation', Math.floor(s.rep) + '<small class="muted"> / 100</small>', '', 'cyan') +
      '<div style="margin-top:10px">' + bar('bar--c', s.rep / 100) + '</div>' +
      '<div class="why">Unlocks businesses and better recruits.</div></div>');
    h.push('<div class="card">' + statBox('Heat', Math.round(s.heat) + '<small class="muted"> / 100</small>',
      '<span class="' + (s.heat >= 60 ? 'red' : (s.heat >= 40 ? 'amber' : 'muted')) + '">' + e(band.name) + '</span>',
      s.heat >= 60 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', s.heat / 100) + '</div>' +
      '<div class="why">' + e(band.desc) + '</div></div>');
    h.push('<div class="card">' + statBox('Influence', Math.round(d.totalInfluence), 'across ' + d.districtsOpen + ' districts') +
      '<div style="margin-top:10px">' + bar('bar--g', d.totalInfluence / 600) + '</div>' +
      '<div class="why">Influence makes room for more businesses.</div></div>');
    h.push('<div class="card">' + statBox('Strength', d.strength, s.crew.length - 1 + ' on payroll') +
      '<div style="margin-top:10px">' + bar('bar--v', U.clamp(d.strength / 260, 0, 1)) + '</div>' +
      '<div class="why">Decides how rivals treat you.</div></div>');
    h.push('</div>');

    /* Was jetzt zu tun ist */
    h.push('<div class="grid grid--2">');
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>What to do next</b></div>' +
      '<div class="rowlist">' + advice(s, d) + '</div></div>');

    /* Laufende Auftraege */
    var runs = s.ops;
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>Operations under way</b>' +
      '<span>' + runs.length + ' running</span></div>');
    if (!runs.length) {
      h.push('<div class="empty"><b>Nobody is working</b><p>Take a job from the City Map. ' +
        'Operations are how you earn before your businesses can carry you.</p>' +
        '<div style="margin-top:12px">' + btn('Open the city', 'go', { data: { screen: 'city' }, cls: 'btn--primary btn--sm' }) + '</div></div>');
    } else {
      h.push('<div class="rowlist">');
      runs.forEach(function (r) {
        var total = r.ends - r.started, left = r.ends - s.day;
        var names = r.crew.map(function (id) { var c = U.byId(s.crew, id); return c ? c.name : '?'; });
        h.push('<div class="running"><div class="row__main">' +
          '<div class="row__t">' + e(r.offer.name) + '</div>' +
          '<div class="row__s">' + e(D.byId(D.DISTRICTS, r.offer.district).name) + ' &middot; ' + e(names.join(', ')) + '</div></div>' +
          '<div class="running__bar" style="flex:1">' + bar('bar--c', 1 - left / Math.max(1, total)) +
          '<div class="row__s" style="margin-top:3px">' + (left <= 0 ? 'resolving' : left + ' day' + (left === 1 ? '' : 's') + ' left') +
          ' &middot; ' + Math.round(r.odds * 100) + '% odds</div></div>' +
          '<div class="num gold">' + money(r.offer.pay) + '</div></div>');
      });
      h.push('</div>');
    }
    h.push('</div>');
    h.push('</div>');

    /* Letzte Meldungen */
    h.push('<div class="card card--pad0" style="margin-top:14px">' +
      '<div class="card__title" style="padding:16px 16px 0"><b>Recent activity</b>' +
      btn('Full log', 'go', { data: { screen: 'log' }, cls: 'btn--sm btn--ghost' }) + '</div>');
    h.push('<div class="rowlist">' + logLines(s, 7) + '</div></div>');

    return h.join('');
  }

  function pnlRow(label, v, max, color) {
    if (Math.abs(v) < 1) return '';
    return '<div class="pnl__row"><span class="muted">' + e(label) + '</span>' +
      '<div class="pnl__bar"><i style="width:' + Math.min(100, Math.abs(v) / max * 100).toFixed(0) +
      '%;background:' + color + '"></i></div>' +
      '<b class="' + (v >= 0 ? 'green' : 'red') + '">' + U.moneySigned(v) + '</b></div>';
  }

  /* Der Ratgeber. Er schlaegt nur vor, was gerade wirklich moeglich ist -
     ein Hinweis auf einen Betrieb, den man nicht bezahlen kann, hilft
     niemandem. */
  function advice(s, d) {
    var tips = [];
    var free = CE.ops.available(s).filter(function (c) { return !c.post; });

    if (s.event) tips.push(tip('A decision is waiting', 'Nothing moves until you answer it.', 'Open', 'showEvent', {}, 'gold'));
    if (free.length && CE.ops.allOffers(s).length) {
      tips.push(tip(free.length + ' ' + (free.length === 1 ? 'person is' : 'people are') + ' idle',
        'Idle crew still draw salary. Send them on a job.', 'City map', 'go', { screen: 'city' }, 'cyan'));
    }
    if (s.heat >= 55) {
      tips.push(tip('Heat is at ' + Math.round(s.heat), 'Police pressure is eating ' +
        U.pct(St.heatPenalty(s.heat)) + ' of your revenue.', 'Handle it', 'go', { screen: 'org' }, 'red'));
    }
    if (d.launderLoss > 500) {
      tips.push(tip('You are burning ' + money(d.launderLoss) + ' a week',
        'Dirty money above your laundering capacity loses 42%.', 'Fix it', 'go', { screen: 'org' }, 'amber'));
    }
    var under = s.businesses.filter(function (b) { return b._f && b._f.understaffed > 0; });
    if (under.length) {
      tips.push(tip(under.length + ' business' + (under.length === 1 ? '' : 'es') + ' short of staff',
        'Empty positions cost 7% of income each.', 'Assign', 'go', { screen: 'crew' }, 'amber'));
    }
    var unhappy = s.crew.filter(function (c) { return !c.player && c.loyalty < 35; });
    if (unhappy.length) {
      tips.push(tip(unhappy.length + ' ' + (unhappy.length === 1 ? 'person is' : 'people are') + ' close to walking',
        'Below 14 loyalty they leave, and some of them talk.', 'Crew', 'go', { screen: 'crew' }, 'red'));
    }
    /* Kaufbares */
    var best = null;
    for (var k in s.districts) {
      if (!s.districts[k].open) continue;
      for (var i = 0; i < D.BUSINESSES.length; i++) {
        var can = CE.empire.canBuy(s, k, D.BUSINESSES[i].id);
        if (!can.ok) continue;
        var score = D.BUSINESSES[i].income / can.cost;
        if (!best || score > best.score) best = { k: k, def: D.BUSINESSES[i], cost: can.cost, score: score };
      }
    }
    if (best && tips.length < 4) {
      tips.push(tip('You can afford a ' + best.def.name,
        money(best.cost) + ' in ' + D.byId(D.DISTRICTS, best.k).name + '.', 'Buy', 'go', { screen: 'business' }, 'gold'));
    }
    for (k in s.districts) {
      if (s.districts[k].open) continue;
      var co = CE.empire.canOpenDistrict(s, k);
      if (co.ok && tips.length < 5) {
        tips.push(tip('You can move into ' + D.byId(D.DISTRICTS, k).name,
          money(co.cost) + ' to establish a foothold.', 'City map', 'go', { screen: 'city' }, 'cyan'));
        break;
      }
    }
    if (!tips.length) {
      tips.push(tip('Everything is running', 'No fires. Build influence, or let the week finish.', 'Finances', 'go', { screen: 'finance' }, ''));
    }
    return tips.slice(0, 5).join('');
  }

  function tip(title, text, label, act, data, tone) {
    var attrs = '';
    for (var k in data) attrs += ' data-' + k + '="' + e(data[k]) + '"';
    return '<div class="row"><div class="logline__dot" style="background:var(--' +
      (tone === 'gold' ? 'gold' : tone === 'red' ? 'red' : tone === 'amber' ? 'amber' : tone === 'cyan' ? 'cyan' : 'ink3') +
      ')"></div><div class="row__main"><div class="row__t">' + e(title) + '</div>' +
      '<div class="row__s">' + e(text) + '</div></div>' +
      '<button type="button" class="btn btn--sm" data-act="' + act + '"' + attrs + '>' + e(label) + '</button></div>';
  }

  /* ================================================== 2 STADTKARTE */

  function city(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Blackhaven</h2>' +
      '<p>Six districts. Influence decides how much of each one answers to you &mdash; ' +
      'and how many businesses it will carry.</p></div></div>');

    h.push('<div class="mapwrap"><div><div class="mapbox">' + mapSvg(s, d) +
      '<div class="mapbox__legend">' +
      '<span><i style="background:#d4af5a"></i>You</span>' +
      D.RIVALS.map(function (r) { return '<span><i style="background:' + r.color + '"></i>' + e(r.name) + '</span>'; }).join('') +
      '<span><i style="background:#2a2f3d"></i>Unclaimed</span></div></div>');

    /* Einflussuebersicht */
    h.push('<div class="card" style="margin-top:14px"><div class="card__title"><b>Influence by district</b>' +
      '<span>' + Math.round(d.totalInfluence) + ' / 600 total</span></div><div class="infl-rows">');
    D.DISTRICTS.forEach(function (dist) {
      var dd = s.districts[dist.id];
      var rivalSum = 0;
      s.rivals.forEach(function (r) { rivalSum += r.infl[dist.id] || 0; });
      h.push('<div class="infl-row"><span class="' + (dd.open ? '' : 'muted') + '">' + e(dist.name) + '</span>' +
        '<div class="bar" style="position:relative">' +
        '<i style="width:' + U.clamp(dd.mine, 0, 100) + '%;background:linear-gradient(90deg,#9a7a2c,#f0cd7d)"></i>' +
        '<i style="position:absolute;top:0;right:0;height:100%;width:' + U.clamp(rivalSum, 0, 100) +
        '%;background:rgba(224,65,65,.4)"></i></div>' +
        '<b class="' + (dd.mine > rivalSum ? 'gold' : 'muted') + '">' + Math.round(dd.mine) + '</b></div>');
    });
    h.push('</div><div class="why">Gold is you, red is every rival combined. ' +
      'Over 100 together means the district is fully contested.</div></div>');
    h.push('</div>');

    /* Bezirkstafel */
    h.push('<div>' + districtPanel(s, d, sel.district) + '</div>');
    h.push('</div>');
    return h.join('');
  }

  function mapSvg(s, d) {
    var o = ['<svg viewBox="0 0 100 100" role="img" aria-label="Map of Blackhaven">'];
    /* Wasser am Hafen */
    o.push('<defs><linearGradient id="water" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#0d1b26"/><stop offset="1" stop-color="#0a1219"/></linearGradient>' +
      '<filter id="soft"><feGaussianBlur stdDeviation=".6"/></filter></defs>');
    o.push('<rect width="100" height="100" fill="#080a0e"/>');
    o.push('<path d="M88,90 L94,70 L100,72 L100,100 L60,100 L60,92 Z" fill="url(#water)"/>');
    /* Strassenraster als Andeutung */
    o.push('<g stroke="#12151d" stroke-width=".35">');
    for (var i = 1; i < 10; i++) {
      o.push('<line x1="' + i * 10 + '" y1="0" x2="' + i * 10 + '" y2="100"/>');
      o.push('<line x1="0" y1="' + i * 10 + '" x2="100" y2="' + i * 10 + '"/>');
    }
    o.push('</g>');

    D.DISTRICTS.forEach(function (dist) {
      var dd = s.districts[dist.id];
      var cls = 'dpoly' + (dd.open ? ' is-open' : ' is-locked') + (sel.district === dist.id ? ' is-sel' : '');
      o.push('<polygon class="' + cls + '" points="' + dist.poly + '" data-act="district" data-id="' + dist.id + '">' +
        '<title>' + e(dist.name) + '</title></polygon>');
    });

    /* Beschriftung und Einflussbalken */
    D.DISTRICTS.forEach(function (dist) {
      var dd = s.districts[dist.id];
      var lx = dist.label[0], ly = dist.label[1];
      o.push('<g class="dlabel">');
      /* Kurzform: "RED LIGHT DISTRICT" ist breiter als sein eigener
         Umriss und laeuft in den Nachbarbezirk. */
      o.push('<text class="big" x="' + lx + '" y="' + (ly - 1) + '">' +
        e((dist.short || dist.name).toUpperCase()) + '</text>');
      if (!dd.open) {
        o.push('<text class="lock" x="' + lx + '" y="' + (ly + 3.4) + '">' +
          (CE.empire.canOpenDistrict(s, dist.id).ok ? 'available &middot; ' + money(CE.empire.entryCost(s, dist.id))
            : 'locked &middot; ' + e(D.RANKS[dist.rank].name)) + '</text>');
      } else {
        /* Balken: Spieler in Gold, Rivalen in ihren Farben */
        var bx = lx - 9, by = ly + 2.6, tot = 18;
        o.push('<line class="dbar" x1="' + bx + '" y1="' + by + '" x2="' + (bx + tot) + '" y2="' + by +
          '" stroke="#242833" stroke-width="1.6"/>');
        var run = 0;
        var mine = U.clamp(dd.mine, 0, 100) / 100 * tot;
        o.push('<line class="dbar" x1="' + bx + '" y1="' + by + '" x2="' + (bx + mine) + '" y2="' + by +
          '" stroke="#d4af5a" stroke-width="1.6"/>');
        run = mine;
        s.rivals.forEach(function (r) {
          var w = U.clamp(r.infl[dist.id] || 0, 0, 100) / 100 * tot;
          if (w < 0.25 || run >= tot) return;
          w = Math.min(w, tot - run);
          o.push('<line class="dbar" x1="' + (bx + run) + '" y1="' + by + '" x2="' + (bx + run + w) + '" y2="' + by +
            '" stroke="' + D.byId(D.RIVALS, r.id).color + '" stroke-width="1.6"/>');
          run += w;
        });
        var count = s.businesses.filter(function (b) { return b.district === dist.id; }).length;
        if (count) {
          o.push('<text x="' + lx + '" y="' + (ly + 6.2) + '">' + count + ' owned</text>');
        }
      }
      o.push('</g>');
    });

    /* Offene Auftraege blinken */
    D.DISTRICTS.forEach(function (dist) {
      var offers = (s.offers[dist.id] || []).length;
      if (!offers || !s.districts[dist.id].open) return;
      var lx = dist.label[0] + 12, ly = dist.label[1] - 5;
      o.push('<g pointer-events="none"><circle cx="' + lx + '" cy="' + ly + '" r="2.4" fill="#4bd6e8" opacity=".22">' +
        '<animate attributeName="r" values="2.2;3.6;2.2" dur="2.4s" repeatCount="indefinite"/></circle>' +
        '<circle cx="' + lx + '" cy="' + ly + '" r="1.5" fill="#4bd6e8"/>' +
        '<text x="' + lx + '" y="' + (ly + 0.9) + '" style="font:700 1.9px sans-serif;fill:#04202a;text-anchor:middle">' +
        offers + '</text></g>');
    });

    o.push('</svg>');
    return o.join('');
  }

  function districtPanel(s, d, id) {
    var dist = D.byId(D.DISTRICTS, id);
    var dd = s.districts[id];
    var h = [];
    var rivalSum = 0;
    s.rivals.forEach(function (r) { rivalSum += r.infl[id] || 0; });
    var owned = s.businesses.filter(function (b) { return b.district === id; });
    var bd = d.byDistrict[id];

    h.push('<div class="card"><div class="card__title"><b>' + e(dist.name) + '</b>' +
      '<span class="tag ' + (dd.open ? 'tag--gold' : '') + '">' + (dd.open ? 'Established' : 'Not yours') + '</span></div>');
    h.push('<p style="margin:0 0 6px;font-size:.84rem;color:var(--ink2);line-height:1.55">' + e(dist.desc) + '</p>');
    h.push('<p style="margin:0 0 14px;font-size:.76rem;color:var(--gold)">' + e(dist.tag) + '</p>');

    h.push('<div class="money-grid" style="margin-bottom:14px">' +
      statBox('Population', U.group(dist.pop)) +
      statBox('Economy', Math.round(dist.econ * 100) + '%', 'income multiplier') +
      statBox('Police', Math.round(dist.lawEye * 100) + '%', 'heat multiplier') +
      '</div>');

    h.push('<div class="infl-rows" style="margin-bottom:14px">');
    h.push('<div class="infl-row"><span>Your influence</span>' + bar('bar--g', dd.mine / 100) +
      '<b class="gold">' + Math.round(dd.mine) + '</b></div>');
    s.rivals.forEach(function (r) {
      var v = r.infl[id] || 0;
      if (v < 0.5) return;
      var rd = D.byId(D.RIVALS, r.id);
      h.push('<div class="infl-row"><span class="muted">' + e(rd.name) + '</span>' +
        '<div class="bar"><i style="width:' + U.clamp(v, 0, 100) + '%;background:' + rd.color + '"></i></div>' +
        '<b class="muted">' + Math.round(v) + '</b></div>');
    });
    h.push('</div>');

    if (!dd.open) {
      var can = CE.empire.canOpenDistrict(s, id);
      h.push('<div class="why">Establishing a foothold costs ' + money(CE.empire.entryCost(s, id)) +
        (rivalSum > 0 ? ' &mdash; raised by the ' + Math.round(rivalSum) + ' influence rivals already hold here.' : '.') + '</div>');
      h.push('<div style="margin-top:10px">' + btn('Move into ' + e(dist.name), 'openDistrict',
        { data: { id: id }, cls: 'btn--primary btn--block', disabled: !can.ok, title: can.why || '' }) + '</div>');
      if (!can.ok) h.push('<div class="why why--bad">' + e(can.why) + '</div>');
      h.push('</div>');
      return h.join('');
    }

    /* Wirtschaft im Bezirk */
    var room = CE.empire.maxBusinesses(s, id);
    h.push('<div class="money-grid" style="margin-bottom:12px">' +
      statBox('Businesses', owned.length + ' / ' + room, room > owned.length ? 'room to grow' : 'at capacity') +
      statBox('Weekly gross', bd ? money(bd.gross) : '$0') +
      statBox('Weekly heat', bd ? '+' + bd.heat.toFixed(1) : '0') + '</div>');
    if (owned.length >= room) {
      h.push('<div class="why">Capacity rises with influence: every 22 points makes room for one more site.</div>');
    }
    h.push('<div style="display:flex;gap:6px;margin-bottom:6px">' +
      btn('Buy a business here', 'go', { data: { screen: 'business', district: id }, cls: 'btn--sm' }) +
      btn('Pressure a rival', 'pressureDialog', { data: { district: id }, cls: 'btn--sm' }) + '</div>');
    h.push('</div>');

    /* Auftraege */
    var offers = s.offers[id] || [];
    h.push('<div class="card card--pad0" style="margin-top:14px">' +
      '<div class="card__title" style="padding:16px 16px 0"><b>Available operations</b>' +
      '<span>' + offers.length + ' this week</span></div>');
    if (!offers.length) {
      h.push('<div class="empty"><p>Nothing on offer here right now. New work appears every week.</p></div>');
    } else {
      h.push('<div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:12px">');
      offers.forEach(function (o) { h.push(opCard(s, d, o)); });
      h.push('</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  function opCard(s, d, o) {
    var picked = sel.opCrew[o.id] || [];
    var free = CE.ops.available(s).filter(function (c) { return !c.post || picked.indexOf(c.id) >= 0; });
    var odds = picked.length ? CE.ops.odds(s, o, picked) : 0;
    var days = picked.length ? CE.ops.duration(s, o, picked) : o.days;
    var enough = picked.length >= o.crewNeed;
    var against = o.against ? D.byId(D.RIVALS, o.against) : null;

    var h = ['<div class="card card--flat op">'];
    h.push('<div class="op__head"><div><div class="op__name">' + e(o.name) + '</div>' +
      '<div class="op__desc">' + e(o.desc) + '</div></div>' +
      '<div class="tag tag--gold">' + money(o.pay) + '</div></div>');
    h.push('<div class="op__stats">' +
      '<span>Time <b>' + days + 'd</b></span>' +
      '<span>Crew <b>' + o.crewNeed + '</b></span>' +
      '<span>Heat <b class="' + (o.heat > 0 ? 'amber' : 'green') + '">' + (o.heat > 0 ? '+' : '') + o.heat.toFixed(1) + '</b></span>' +
      '<span>Influence <b class="cyan">+' + o.infl.toFixed(1) + '</b></span>' +
      (o.rep ? '<span>Rep <b class="cyan">+' + o.rep + '</b></span>' : '') +
      (against ? '<span class="tag tag--red">vs ' + e(against.name) + '</span>' : '') + '</div>');

    h.push('<div class="op__crew">');
    if (!free.length) {
      h.push('<span class="why">Everyone is busy or posted to a business.</span>');
    } else {
      free.forEach(function (c) {
        var on = picked.indexOf(c.id) >= 0;
        h.push('<button type="button" class="pick' + (on ? ' is-on' : '') + '" data-act="pickCrew" ' +
          'data-op="' + o.id + '" data-id="' + c.id + '">' +
          '<span class="av">' + A.portrait(c.face, 20) + '</span>' +
          e(c.name.split(' ')[0]) + ' <b class="num">' + St.effectiveSkill(c) + '</b></button>');
      });
    }
    h.push('</div>');

    h.push('<div class="odds">' +
      (picked.length
        ? '<b class="' + (odds > 0.7 ? 'green' : odds > 0.45 ? 'amber' : 'red') + '">' + Math.round(odds * 100) + '%</b>' +
          '<span class="why" style="margin:0">chance of success</span>'
        : '<span class="why" style="margin:0">Pick who goes.</span>') +
      '<div style="margin-left:auto">' +
      btn('Send them', 'startOp', { data: { op: o.id }, cls: 'btn--primary btn--sm', disabled: !enough,
        title: enough ? '' : 'This job needs ' + o.crewNeed + ' people.' }) + '</div></div>');
    if (picked.length && !enough) h.push('<div class="why why--bad">Needs ' + o.crewNeed + ' people &mdash; going short cuts your odds badly.</div>');
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 3 BETRIEBE */

  function business(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Businesses</h2>' +
      '<p>Legal sites launder money and build reputation. Underground sites pay far better and ' +
      'attract exactly the attention you would expect.</p></div>' +
      '<div style="display:flex;gap:6px">' +
      filterBtn('bizFilter', 'all', 'All') + filterBtn('bizFilter', 'legal', 'Legal') +
      filterBtn('bizFilter', 'dirty', 'Underground') + '</div></div>');

    /* Besitz */
    var owned = s.businesses.filter(function (b) {
      var def = D.byId(D.BUSINESSES, b.type);
      return sel.bizFilter === 'all' || (sel.bizFilter === 'legal') === def.legal;
    });

    h.push('<div class="card" style="margin-bottom:14px"><div class="money-grid">' +
      statBox('Owned', s.businesses.length, d.districtsOpen + ' districts') +
      statBox('Weekly gross', money(d.cleanGross + d.dirtyGross)) +
      statBox('Laundering', money(d.dirtyGross) + ' / ' + money(d.launderCap),
        d.launderLoss > 0 ? '<span class="red">losing ' + money(d.launderLoss) + '</span>' : '<span class="green">within capacity</span>') +
      '</div>' +
      '<div style="margin-top:12px">' + bar(d.dirtyGross > d.launderCap ? 'bar--r' : 'bar--g',
        d.launderCap ? d.dirtyGross / d.launderCap : 0) + '</div></div>');

    if (!s.businesses.length) {
      h.push('<div class="card"><div class="empty"><b>You own nothing yet</b>' +
        '<p>A Corner Restaurant in Old Town is the cheapest way in. Until then, operations pay the bills.</p></div></div>');
    } else {
      h.push('<div class="grid grid--3" style="margin-bottom:22px">');
      owned.forEach(function (b) { h.push(bizCard(s, d, b)); });
      h.push('</div>');
    }

    /* Markt */
    h.push('<h3 style="font-family:var(--disp);letter-spacing:.06em;text-transform:uppercase;' +
      'font-size:1.1rem;margin:4px 0 12px">For sale</h3>');
    var districts = D.DISTRICTS.filter(function (x) { return s.districts[x.id].open; });
    if (!districts.length) {
      h.push('<div class="card"><div class="empty"><p>You have no district to build in.</p></div></div>');
    }
    districts.forEach(function (dist) {
      var room = CE.empire.maxBusinesses(s, dist.id);
      var have = s.businesses.filter(function (b) { return b.district === dist.id; }).length;
      h.push('<div class="card__title" style="margin-top:14px"><b>' + e(dist.name) + '</b>' +
        '<span>' + have + ' / ' + room + ' sites used</span></div>');
      h.push('<div class="grid grid--4">');
      D.BUSINESSES.forEach(function (def) {
        if (sel.bizFilter !== 'all' && (sel.bizFilter === 'legal') !== def.legal) return;
        if (def.tier > dist.tier + 1) return;
        var can = CE.empire.canBuy(s, dist.id, def.id);
        var cost = St.buyCost(dist.id, def.id);
        h.push('<div class="card card--flat biz' + (def.legal ? '' : ' biz--dirty') + '">' +
          '<div class="biz__top"><div class="biz__ico">' + A.icon(def.icon) + '</div>' +
          '<div style="flex:1;min-width:0"><div class="biz__name">' + e(def.name) + '</div>' +
          '<div class="biz__where">' + (def.legal ? 'Legal' : '<span class="red">Underground</span>') +
          ' &middot; ' + def.staff + ' staff</div></div></div>' +
          '<div class="op__desc">' + e(def.blurb) + '</div>' +
          '<div class="biz__nums">' +
          '<div class="biz__num"><b class="gold">' + money(cost) + '</b><small>Price</small></div>' +
          '<div class="biz__num"><b class="green">' + money(def.income * dist.econ) + '</b><small>Gross/wk</small></div>' +
          '<div class="biz__num"><b class="' + (def.heat ? 'amber' : 'muted') + '">' +
          (def.heat ? '+' + (def.heat * dist.lawEye).toFixed(1) : '&mdash;') + '</b><small>Heat</small></div></div>' +
          '<div class="biz__acts">' + btn('Buy', 'buyBiz', { data: { district: dist.id, type: def.id },
            cls: 'btn--primary btn--block btn--sm', disabled: !can.ok, title: can.why || '' }) + '</div>' +
          (can.ok ? '' : '<div class="why">' + e(can.why) + '</div>') + '</div>');
      });
      h.push('</div>');
    });

    return h.join('');
  }

  function bizCard(s, d, b) {
    var def = D.byId(D.BUSINESSES, b.type);
    var f = St.bizFinance(s, b);
    var dist = D.byId(D.DISTRICTS, b.district);
    var up = CE.empire.canUpgrade(s, b.id);
    var h = ['<div class="card biz' + (def.legal ? '' : ' biz--dirty') + '">'];

    h.push('<div class="biz__top"><div class="biz__ico">' + A.icon(def.icon) + '</div>' +
      '<div style="flex:1;min-width:0"><div class="biz__name">' + e(b.name) + '</div>' +
      '<div class="biz__where">' + e(dist.name) + ' &middot; Level ' + b.level + '</div>' +
      '<div class="biz__lvl">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<i class="' + (i <= b.level ? 'on' : '') + '"></i>'; }).join('') + '</div></div></div>');

    h.push('<div class="biz__nums">' +
      '<div class="biz__num"><b class="green">' + money(f.gross) + '</b><small>Gross</small></div>' +
      '<div class="biz__num"><b class="muted">' + money(f.upkeep) + '</b><small>Upkeep</small></div>' +
      '<div class="biz__num"><b class="' + (f.net >= 0 ? 'gold' : 'red') + '">' + U.moneySigned(f.net) + '</b><small>Net</small></div></div>');

    /* Personal */
    var posted = s.crew.filter(function (c) { return c.post === b.id; });
    h.push('<div class="biz__staff"><span>Staff</span>');
    for (var i = 0; i < f.slots; i++) {
      var c = posted[i];
      h.push(c ? '<span class="slot filled" title="' + e(c.name) + ' (' + e(D.byId(D.ROLES, c.role).name) + ')">' +
        e(c.name.charAt(0)) + '</span>' : '<span class="slot" title="Empty position">+</span>');
    }
    h.push('<span style="margin-left:auto">' + (f.understaffed
      ? '<span class="amber">-' + U.pct(f.staffPenalty) + ' income</span>'
      : '<span class="green">+' + U.pct(f.staffBonus) + '</span>') + '</span></div>');

    if (b.damage > 0) h.push('<div class="biz__warn">Damaged &mdash; output down ' + U.pct(b.damage) + ', recovering weekly.</div>');
    if (def.heat) h.push('<div class="biz__warn">Draws ' + f.heat.toFixed(1) + ' heat a week.</div>');
    if (b.boost) h.push('<div class="row__s green">Improved: +' + U.pct(b.boost) + ' income, permanently.</div>');

    h.push('<div class="biz__acts">' +
      btn(up.ok ? 'Upgrade ' + money(up.cost) : (b.level >= 5 ? 'Max level' : 'Upgrade'), 'upgradeBiz',
        { data: { id: b.id }, cls: 'btn--sm', disabled: !up.ok, title: up.why || '' }) +
      btn('Details', 'bizDetail', { data: { id: b.id }, cls: 'btn--sm btn--ghost' }) + '</div>');
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 4 MANNSCHAFT */

  function crew(s, d) {
    var h = [];
    var paid = s.crew.filter(function (c) { return !c.player; });
    h.push('<div class="page-head"><div><h2>Crew</h2>' +
      '<p>' + paid.length + ' of ' + d.crewCap + ' positions filled. Loyalty falls when people are ' +
      'underpaid, idle, or watching the heat climb.</p></div>' +
      '<div style="display:flex;gap:6px">' +
      filterBtn('crewFilter', 'all', 'All') + filterBtn('crewFilter', 'free', 'Unassigned') +
      filterBtn('crewFilter', 'risk', 'At risk') +
      btn('Recruit', 'recruitDialog', { cls: 'btn--primary btn--sm' }) + '</div></div>');

    h.push('<div class="card" style="margin-bottom:14px"><div class="money-grid">' +
      statBox('Payroll', money(d.salaries) + '<small class="muted">/wk</small>') +
      statBox('Strength', d.strength) +
      statBox('Capacity', paid.length + ' / ' + d.crewCap,
        paid.length >= d.crewCap ? '<span class="amber">full &mdash; build a Safe House</span>' : 'room for more') +
      '</div></div>');

    var list = s.crew.filter(function (c) {
      if (sel.crewFilter === 'free') return !c.post && !c.player;
      if (sel.crewFilter === 'risk') return !c.player && c.loyalty < 45;
      return true;
    });

    if (!list.length) {
      h.push('<div class="card"><div class="empty"><b>Nobody here</b>' +
        '<p>You are the whole organisation. Hire someone so two jobs can run at once.</p>' +
        '<div style="margin-top:12px">' + btn('Find people', 'recruitDialog', { cls: 'btn--primary btn--sm' }) + '</div></div></div>');
      return h.join('');
    }

    h.push('<div class="grid grid--3">');
    list.forEach(function (c) { h.push(crewCard(s, d, c)); });
    h.push('</div>');
    return h.join('');
  }

  function crewCard(s, d, c) {
    var role = D.byId(D.ROLES, c.role);
    var eff = St.effectiveSkill(c);
    var fair = c.player ? 0 : CE.crew.fairSalary(c);
    var busy = c.busyUntil > s.day;
    var post = c.post ? U.byId(s.businesses, c.post) : null;
    var h = ['<div class="card crew">'];

    h.push('<div class="crew__top"><div class="crew__av">' + A.portrait(c.face, 46) + '</div>' +
      '<div class="crew__id"><div class="crew__name">' + e(c.name) +
      (c.player ? ' <span class="tag tag--gold">You</span>' : '') + '</div>' +
      '<div class="crew__role">' + e(role.name) + '</div>' +
      (c.player ? '<div class="crew__pay muted">No salary</div>'
                : '<div class="crew__pay">' + money(c.salary) + '/wk' +
                  (c.salary < fair * 0.85 ? ' <span class="red">&middot; underpaid</span>' :
                   c.salary > fair * 1.2 ? ' <span class="muted">&middot; generous</span>' : '') + '</div>') +
      '</div></div>');

    h.push('<div class="crew__meters">' +
      '<div class="meter"><span>Skill</span>' + bar('bar--c', eff / 12) + '<b>' + eff + '</b></div>' +
      (c.player ? '' :
      '<div class="meter"><span>Loyalty</span>' + bar(c.loyalty < 30 ? 'bar--r' : 'bar--g', c.loyalty / 100) +
      '<b class="mood-' + (c.mood || 'steady') + '">' + Math.round(c.loyalty) + '</b></div>') +
      '<div class="meter"><span>Growth</span>' + bar('bar--v', (eff - 1) / Math.max(1, c.potential - 1)) +
      '<b>' + c.potential + '</b></div></div>');

    if (c.traits.length) {
      h.push('<div class="crew__traits">' + c.traits.map(function (t) {
        var td = D.byId(D.TRAITS, t);
        if (!td) return '';
        return '<span class="tag ' + (td.good === true ? 'tag--green' : td.good === false ? 'tag--red' : 'tag--violet') +
          '" title="' + e(td.desc) + '">' + e(td.name) + '</span>';
      }).join('') + '</div>');
    }

    h.push('<div class="crew__post">' +
      (busy ? '<span class="cyan">On a job until day ' + c.busyUntil + '</span>'
            : post ? 'Posted to <b>' + e(post.name) + '</b>'
            : role.slot === 'org' ? '<span class="muted">' + e(role.desc) + '</span>'
            : '<span class="amber">Unassigned &mdash; earning nothing</span>') + '</div>');

    if (!c.player) {
      h.push('<div class="crew__acts">' +
        btn('Manage', 'crewDialog', { data: { id: c.id }, cls: 'btn--sm' }) +
        (role.slot === 'business'
          ? btn(post ? 'Reassign' : 'Assign', 'assignDialog', { data: { id: c.id }, cls: 'btn--sm btn--ghost', disabled: busy })
          : '') + '</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 5 ORGANISATION */

  function org(s, d) {
    var h = [];
    var band = St.heatBand(s.heat);
    h.push('<div class="page-head"><div><h2>Organization</h2>' +
      '<p>Permanent investments in the machine behind the money &mdash; and the levers that ' +
      'keep the police at arm&rsquo;s length.</p></div></div>');

    /* Hitze */
    h.push('<div class="card" style="margin-bottom:14px">' +
      '<div class="card__title"><b>Police attention</b><span class="tag ' +
      (s.heat >= 60 ? 'tag--red' : s.heat >= 40 ? 'tag--gold' : '') + '">' + e(band.name) + '</span></div>');
    h.push('<div class="grid grid--2" style="gap:18px;align-items:start">');
    h.push('<div>' + statBox('Heat', Math.round(s.heat) + '<small class="muted"> / 100</small>',
      e(band.desc), s.heat >= 60 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', s.heat / 100) + '</div>' +
      '<div class="pnl" style="margin-top:14px">' +
      '<div class="pnl__row"><span class="muted">Generated by your sites</span><b class="red">+' + d.heatGain.toFixed(1) + '</b></div>' +
      '<div class="pnl__row"><span class="muted">Bled off each week</span><b class="green">-' + d.heatDecay.toFixed(1) + '</b></div>' +
      '<div class="pnl__row" style="border-top:1px solid var(--line);padding-top:6px">' +
      '<span style="font-weight:600">Net change</span><b class="' + (d.heatNet > 0 ? 'red' : 'green') + '">' +
      (d.heatNet > 0 ? '+' : '') + d.heatNet.toFixed(1) + '/wk</b></div></div>' +
      (d.heatPenalty > 0 ? '<div class="why why--bad">At this level you lose ' + U.pct(d.heatPenalty) +
        ' of all revenue, and investigations cost money on top.</div>'
        : '<div class="why">Below 40 heat there is no revenue penalty.</div>') + '</div>');

    h.push('<div style="display:flex;flex-direction:column;gap:8px">');
    CE.empire.heatActions(s).forEach(function (a) {
      var can = s.cash >= a.cost && !(a.shut && s.flags.layLowUntil > s.day);
      h.push('<div class="card card--flat" style="padding:12px">' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
        '<b style="flex:1;font-size:.9rem">' + e(a.name) + '</b>' +
        '<span class="tag tag--green">' + a.heat + ' heat</span>' +
        (a.rep ? '<span class="tag tag--red">' + a.rep + ' rep</span>' : '') + '</div>' +
        '<div class="op__desc" style="margin-bottom:9px">' + e(a.desc) + '</div>' +
        btn(a.cost ? 'Pay ' + money(a.cost) : 'Shut down for a week', 'heatAction',
          { data: { id: a.id }, cls: 'btn--sm btn--block', disabled: !can,
            title: s.cash < a.cost ? 'Not enough cash.' : (a.shut && s.flags.layLowUntil > s.day ? 'Already lying low.' : '') }) +
        '</div>');
    });
    h.push('</div></div></div>');

    /* Ausbauten */
    h.push('<div class="card__title"><b>Infrastructure</b><span>' + money(d.orgUpkeep) + '/wk upkeep</span></div>');
    h.push('<div class="grid grid--3">');
    D.ORG_UPGRADES.forEach(function (up) {
      var lv = s.org[up.id] || 0;
      var can = CE.empire.canUpgradeOrg(s, up.id);
      h.push('<div class="card biz">' +
        '<div class="biz__top"><div class="biz__ico">' + A.icon(up.icon) + '</div>' +
        '<div style="flex:1"><div class="biz__name">' + e(up.name) + '</div>' +
        '<div class="biz__where">Level ' + lv + ' of ' + up.max + '</div>' +
        '<div class="biz__lvl">' + [1, 2, 3].map(function (i) {
          return '<i class="' + (i <= lv ? 'on' : '') + '"></i>'; }).join('') + '</div></div></div>' +
        '<div class="op__desc">' + e(up.desc) + '</div>' +
        '<div class="tag tag--cyan" style="align-self:flex-start">' + e(up.effect) + '</div>' +
        (lv ? '<div class="row__s">Currently costing ' + money(up.upkeep.slice(0, lv).reduce(function (a, b) { return a + b; }, 0)) + '/wk</div>' : '') +
        '<div class="biz__acts">' + btn(lv >= up.max ? 'Fully built' : 'Build level ' + (lv + 1) + ' &middot; ' + money(up.cost[lv]),
          'upgradeOrg', { data: { id: up.id }, cls: 'btn--sm btn--block' + (can.ok ? ' btn--primary' : ''),
            disabled: !can.ok, title: can.why || '' }) + '</div>' +
        (can.ok || lv >= up.max ? '' : '<div class="why">' + e(can.why) + '</div>') + '</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 6 RIVALEN */

  function rivals(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Rivals</h2>' +
      '<p>Four organisations, all of them older than yours. They expand whether you pay attention or not.</p></div></div>');

    h.push('<div class="grid grid--2">');
    s.rivals.forEach(function (r) {
      var rd = D.byId(D.RIVALS, r.id);
      var infl = CE.rivals.totalInfl(r);
      var rel = CE.rivals.relationLabel(r.relation);
      var crest = A.crest(rd.name, rd.color);
      var canA = CE.rivals.canAlly(s, r.id);
      var negCost = CE.rivals.negotiateCost(s, r, d);
      var truce = r.truceUntil > s.day;

      h.push('<div class="card rival" style="border-left-color:' + rd.color + '">');
      h.push('<div class="rival__head">' +
        '<div class="rival__crest" style="background:linear-gradient(160deg,' + rd.color + ',' + A.shade(rd.color, -60) + ')">' +
        e(crest.initials) + '</div>' +
        '<div style="flex:1"><div class="rival__name">' + e(rd.name) + '</div>' +
        '<div class="rival__leader">' + e(rd.leader) + ' &middot; ' + e(rd.style) + '</div></div>' +
        '<span class="tag ' + (r.allied ? 'tag--green' : r.relation < -40 ? 'tag--red' : '') + '">' + e(rel) + '</span></div>');
      h.push('<p class="rival__desc">' + e(rd.desc) + '</p>');

      h.push('<div class="rel"><span class="row__s" style="width:62px">Relations</span>' +
        '<div class="rel__bar"><span class="rel__mid"></span>' +
        (r.relation >= 0
          ? '<i style="left:50%;width:' + (r.relation / 2) + '%;background:linear-gradient(90deg,#2d7a50,#4ad98a)"></i>'
          : '<i style="right:50%;width:' + (-r.relation / 2) + '%;background:linear-gradient(90deg,#e04141,#7a2020)"></i>') +
        '</div><b class="num" style="width:34px;text-align:right">' + Math.round(r.relation) + '</b></div>');

      h.push('<div class="money-grid" style="margin-bottom:12px">' +
        statBox('Influence', Math.round(infl)) +
        statBox('Strength', Math.round(r.strength),
          r.strength > d.strength ? '<span class="red">stronger than you</span>' : '<span class="green">weaker than you</span>') +
        statBox('Businesses', r.biz) + '</div>');

      /* Wo sie sitzen */
      var where = D.DISTRICTS.filter(function (x) { return (r.infl[x.id] || 0) > 3; })
        .sort(function (a, b) { return r.infl[b.id] - r.infl[a.id]; }).slice(0, 3);
      if (where.length) {
        h.push('<div class="row__s" style="margin-bottom:10px">Strongest in ' +
          where.map(function (x) { return '<b>' + e(x.name) + '</b> (' + Math.round(r.infl[x.id]) + ')'; }).join(', ') + '</div>');
      }
      if (r.lastAct) h.push('<div class="row__s muted" style="margin-bottom:10px">Last week they ' + e(r.lastAct) + '.</div>');
      if (truce) h.push('<div class="tag tag--cyan" style="margin-bottom:10px">Truce until day ' + r.truceUntil + '</div>');

      h.push('<div class="crew__acts">' +
        btn('Negotiate &middot; ' + money(negCost), 'negotiate', { data: { id: r.id }, cls: 'btn--sm',
          disabled: s.cash < negCost, title: s.cash < negCost ? 'Not enough cash.' : '' }) +
        (r.allied
          ? btn('Break alliance', 'breakAlly', { data: { id: r.id }, cls: 'btn--sm btn--danger' })
          : btn('Propose alliance', 'ally', { data: { id: r.id }, cls: 'btn--sm btn--primary',
              disabled: !canA.ok, title: canA.why || '' })) +
        btn('Pressure', 'pressureDialog', { data: { rival: r.id }, cls: 'btn--sm btn--ghost', disabled: r.allied,
          title: r.allied ? 'You are allied.' : '' }) +
        '</div>');
      if (!r.allied && !canA.ok && canA.why) h.push('<div class="why">' + e(canA.why) + '</div>');
      h.push('</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 7 FINANZEN */

  function finance(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Finances</h2>' +
      '<p>Every dollar that moves is listed here with a reason. Weeks run Monday to Sunday.</p></div></div>');

    h.push('<div class="grid grid--4" style="margin-bottom:14px">' +
      '<div class="card">' + statBox('Cash', money(s.cash), '', s.cash < 0 ? 'red' : 'gold') + '</div>' +
      '<div class="card">' + statBox('Weekly income', money(d.grossIncome), '', 'green') + '</div>' +
      '<div class="card">' + statBox('Weekly expenses', money(d.expenses), '', 'red') + '</div>' +
      '<div class="card">' + statBox('Net', U.moneySigned(d.net),
        d.net !== 0 ? (d.net > 0 ? 'doubling in ~' + Math.max(1, Math.ceil(Math.max(0, s.cash) / d.net)) + ' weeks' : 'losing money')
        : '', d.net >= 0 ? 'green' : 'red') + '</div></div>');

    /* Verlauf */
    h.push('<div class="grid grid--2" style="margin-bottom:14px">');
    h.push('<div class="card"><div class="card__title"><b>Net worth and cash</b><span>' +
      s.history.length + ' weeks</span></div>' +
      '<div class="chartbox"><canvas data-chart="worth" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#d4af5a;margin-right:5px"></i>Net worth</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4bd6e8;margin-right:5px"></i>Cash</span></div></div>');
    h.push('<div class="card"><div class="card__title"><b>Income against expenses</b></div>' +
      '<div class="chartbox"><canvas data-chart="flow" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4ad98a;margin-right:5px"></i>Income</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#e04141;margin-right:5px"></i>Expenses</span></div></div>');
    h.push('</div>');

    h.push('<div class="grid grid--2" style="margin-bottom:14px">');
    h.push('<div class="card"><div class="card__title"><b>Gross income by district</b></div>' +
      '<div class="chartbox"><canvas data-chart="districts"></canvas></div></div>');
    h.push('<div class="card"><div class="card__title"><b>Heat and reputation</b></div>' +
      '<div class="chartbox"><canvas data-chart="heat" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#e04141;margin-right:5px"></i>Heat</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4bd6e8;margin-right:5px"></i>Reputation</span></div></div>');
    h.push('</div>');

    /* Buchungen */
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>Weekly statements</b>' +
      '<span>' + s.ledger.length + ' on file</span></div>');
    if (!s.ledger.length) {
      h.push('<div class="empty"><p>The first statement arrives at the end of week 1.</p></div>');
    } else {
      s.ledger.slice(0, 6).forEach(function (L, idx) {
        h.push('<div style="padding:0 16px 8px">' +
          '<div style="display:flex;align-items:center;gap:10px;padding:12px 0 8px;border-top:1px solid var(--line)">' +
          '<b style="font-family:var(--disp);letter-spacing:.06em">WEEK ' + L.week + '</b>' +
          '<span class="row__s">' + e(U.dateLabel(L.day)) + '</span>' +
          '<span style="margin-left:auto" class="num ' + (L.net >= 0 ? 'green' : 'red') + '">' +
          U.moneySigned(L.net) + '</span>' +
          '<span class="row__s num">&rarr; ' + money(L.cashAfter) + '</span></div>' +
          '<table class="ledger"><tbody>');
        L.book.forEach(function (line) {
          h.push('<tr><td>' + e(line.label) + (line.note ? '<div class="note">' + e(line.note) + '</div>' : '') + '</td>' +
            '<td class="r ' + (line.amount >= 0 ? 'green' : (line.kind === 'bad' ? 'red' : 'muted')) + '">' +
            (line.amount === 0 ? '&mdash;' : U.moneySigned(line.amount)) + '</td></tr>');
        });
        h.push('<tr class="sum"><td>Net for the week</td><td class="r ' + (L.net >= 0 ? 'green' : 'red') + '">' +
          U.moneySigned(L.net) + '</td></tr>');
        h.push('</tbody></table></div>');
      });
    }
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 8 PROTOKOLL */

  function log(s) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Events</h2>' +
      '<p>Everything that happened, newest first. Decisions you made are marked in blue.</p></div></div>');
    h.push('<div class="card card--pad0"><div class="rowlist">' + logLines(s, 200) + '</div></div>');
    return h.join('');
  }

  function logLines(s, n) {
    if (!s.log.length) return '<div class="empty"><p>Nothing has happened yet.</p></div>';
    return s.log.slice(0, n).map(function (L) {
      return '<div class="logline t-' + e(L.t) + '">' +
        '<div class="logline__day">' + (L.day === 0 ? 'Day 0' : 'Day ' + L.day) + '</div>' +
        '<div class="logline__dot"></div>' +
        '<div class="logline__txt">' + e(L.text) +
        (L.choice ? ' <span class="tag tag--cyan">' + e(L.choice) + '</span>' : '') + '</div></div>';
    }).join('');
  }

  /* ================================================== 9 ERFOLGE */

  function awards(s, d) {
    var got = CE.progress.earned(s).length;
    var h = [];
    h.push('<div class="page-head"><div><h2>Achievements</h2>' +
      '<p>' + got + ' of ' + D.ACHIEVEMENTS.length + ' earned.</p></div></div>');

    h.push('<div class="card" style="margin-bottom:14px">' + bar('bar--g', got / D.ACHIEVEMENTS.length) +
      '<div class="money-grid" style="margin-top:14px">' +
      statBox('Operations', s.stats.opsWon + ' / ' + s.stats.opsRun, 'succeeded') +
      statBox('Raids survived', s.stats.raids) +
      statBox('Fines paid', s.stats.fines) + '</div></div>');

    h.push('<div class="grid grid--3">');
    D.ACHIEVEMENTS.forEach(function (a) {
      var when = s.achievements[a.id];
      h.push('<div class="card card--flat ach' + (when !== undefined ? ' is-got' : '') + '">' +
        '<div class="ach__medal">' + A.icon(when !== undefined ? 'trophy' : 'lock') + '</div>' +
        '<div><div class="ach__n">' + e(a.name) + '</div>' +
        '<div class="ach__d">' + e(a.desc) + '</div>' +
        (when !== undefined ? '<div class="row__s gold">Day ' + when + '</div>' : '') + '</div></div>');
    });
    h.push('</div>');

    /* Siegesstand */
    var city = CE.progress.cityProgress(s);
    h.push('<div class="card" style="margin-top:14px"><div class="card__title"><b>The city</b>' +
      '<span>' + city.held + ' / ' + city.total + ' districts at majority control</span></div>' +
      bar('bar--g', city.held / city.total) +
      '<div class="why">Hold 60 influence or more in all six districts as an Underworld Legend ' +
      'to take Blackhaven outright.' + (s.flags.won ? ' <b class="gold">Achieved on day ' + s.flags.won + '.</b>' : '') + '</div></div>');
    return h.join('');
  }

  function filterBtn(group, value, label) {
    return '<button type="button" class="btn btn--sm' + (sel[group] === value ? ' btn--primary' : '') +
      '" data-act="filter" data-group="' + group + '" data-value="' + value + '">' + e(label) + '</button>';
  }

  /* ---------------------------------------------------- Aufbau */

  function render(screen, s, d) {
    switch (screen) {
      case 'city': return city(s, d);
      case 'business': return business(s, d);
      case 'crew': return crew(s, d);
      case 'org': return org(s, d);
      case 'rivals': return rivals(s, d);
      case 'finance': return finance(s, d);
      case 'log': return log(s, d);
      case 'awards': return awards(s, d);
      default: return overview(s, d);
    }
  }

  /* Diagramme nachziehen - Canvas laesst sich nicht als HTML setzen. */
  function paintCharts(view, s, d) {
    var cs = view.querySelectorAll('canvas[data-chart]');
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i], kind = c.getAttribute('data-chart');
      var hist = s.history;
      if (kind === 'worth') {
        CE.charts.line(c, [
          { name: 'Net worth', color: '#d4af5a', values: hist.map(function (x) { return x.worth; }) },
          { name: 'Cash', color: '#4bd6e8', values: hist.map(function (x) { return x.cash; }), fill: false }
        ], { zero: true, xLast: 'Week ' + U.weekOf(s.day) });
      } else if (kind === 'flow') {
        CE.charts.line(c, [
          { name: 'Income', color: '#4ad98a', values: hist.map(function (x) { return x.income; }) },
          { name: 'Expenses', color: '#e04141', values: hist.map(function (x) { return x.expense; }), fill: false }
        ], { zero: true, xLast: 'Week ' + U.weekOf(s.day) });
      } else if (kind === 'heat') {
        CE.charts.line(c, [
          { name: 'Heat', color: '#e04141', values: hist.map(function (x) { return x.heat; }) },
          { name: 'Reputation', color: '#4bd6e8', values: hist.map(function (x) { return x.rep; }), fill: false }
        ], { min: 0, fmt: function (v) { return Math.round(v); }, xLast: 'Week ' + U.weekOf(s.day) });
      } else if (kind === 'districts') {
        var rows = [];
        D.DISTRICTS.forEach(function (dist) {
          var bd = d.byDistrict[dist.id];
          if (bd && bd.gross > 0) rows.push({ label: dist.name, value: Math.round(bd.gross), color: '#d4af5a' });
        });
        rows.sort(function (a, b) { return b.value - a.value; });
        CE.charts.bars(c, rows, { empty: 'No businesses yet' });
      }
    }
  }

  CE.ui = {
    init: init, render: render, paintCharts: paintCharts, SCREENS: SCREENS, sel: sel,
    crewCard: crewCard, bizCard: bizCard, districtPanel: districtPanel,
    helpers: { btn: btn, statBox: statBox, bar: bar, e: e, money: money, logLines: logLines }
  };
})(typeof window !== 'undefined' ? window : globalThis);
