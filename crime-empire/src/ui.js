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
    { id: 'overview', name: 'Übersicht',     icon: 'grid' },
    { id: 'city',     name: 'Stadt',         icon: 'map' },
    { id: 'business', name: 'Betriebe',   icon: 'building' },
    { id: 'crew',     name: 'Crew',         icon: 'people' },
    { id: 'org',      name: 'Organisation', icon: 'org' },
    { id: 'rivals',   name: 'Rivalen',       icon: 'swords' },
    { id: 'finance',  name: 'Finanzen',     icon: 'chart' },
    { id: 'log',      name: 'Ereignisse',       icon: 'bell' },
    { id: 'awards',   name: 'Erfolge', icon: 'trophy' }
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

    h.push('<div class="page-head"><div><h2>Übersicht</h2>' +
      '<p>' + e(D.RANKS[d.rank].blurb) + '</p></div>' +
      '<div class="tag tag--gold">' + city.held + '/' + city.total + ' Bezirke kontrolliert</div></div>');

    /* Rang + Geld */
    h.push('<div class="hero">');
    h.push('<div class="card rankcard">' +
      '<div class="card__title"><b>Stellung</b><span>' + d.notoriety + ' Bekanntheit</span></div>' +
      '<div class="rankcard__rank">' + e(d.rankName) + '</div>' +
      '<div class="rankcard__blurb">' + e(D.RANKS[d.rank].blurb) + '</div>' +
      (d.nextRank
        ? '<div class="rankcard__next"><span>Nächster: ' + e(d.nextRank.name) + '</span>' +
          '<span>' + d.notoriety + ' / ' + d.nextRank.at + '</span></div>' +
          bar('bar--g', d.rankProgress)
        : '<div class="rankcard__next"><span class="gold">Höchster Rang erreicht</span></div>' + bar('bar--g', 1)) +
      '<div class="money-grid" style="margin-top:18px">' +
        statBox('Bargeld', money(s.cash), '', 'gold') +
        statBox('Vermögen', money(d.netWorth), money(d.bizValue) + ' an Werten') +
        statBox('Netto / Woche', U.moneySigned(d.net), '', d.net >= 0 ? 'green' : 'red') +
      '</div></div>');

    /* Wochenbilanz */
    var maxFlow = Math.max(d.grossIncome, d.expenses, 1);
    h.push('<div class="card"><div class="card__title"><b>Diese Woche</b>' +
      '<span>' + (s.flags.layLowUntil > s.day ? '<span class="amber">Untergetaucht</span>' : 'voraussichtlich') + '</span></div>' +
      '<div class="pnl">' +
      pnlRow('Legale Einnahmen', d.cleanGross, maxFlow, '#4ad98a') +
      pnlRow('Untergrund-Einnahmen', d.dirtyGross, maxFlow, '#e04141') +
      (d.launderLoss > 0 ? pnlRow('Waschverluste', -d.launderLoss, maxFlow, '#8e1f1f') : '') +
      (d.caseLoss > 0 ? pnlRow('Bundesverfahren', -d.caseLoss, maxFlow, '#7a2020') : '') +
      (d.heatLoss > 0 ? pnlRow('Polizeidruck', -d.heatLoss, maxFlow, '#8e1f1f') : '') +
      pnlRow('Laufende Kosten', -d.upkeep, maxFlow, '#6d7280') +
      pnlRow('Gehälter', -d.salaries, maxFlow, '#6d7280') +
      pnlRow('Organisation', -d.orgUpkeep, maxFlow, '#6d7280') +
      pnlRow('Bezirke', -d.districtCost, maxFlow, '#6d7280') +
      '</div>' +
      '<div class="pnl__row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">' +
      '<span style="font-weight:600">Netto</span><b class="' + (d.net >= 0 ? 'green' : 'red') + '">' +
      U.moneySigned(d.net) + '</b></div>' +
      (d.launderLoss > 0
        ? '<div class="why">Untergrund-Einnahmen über ' + money(d.launderCap) + ' verlieren 42%. ' +
          'Kauf legale Betriebe oder eine Waschkette, um die Kapazität zu erhöhen.</div>' : '') +
      '</div>');
    h.push('</div>');

    /* Vier Messwerte */
    h.push('<div class="grid grid--3" style="margin-bottom:14px">');
    h.push('<div class="card">' + statBox('Ansehen', Math.floor(s.rep) + '<small class="muted"> / 100</small>', '', 'cyan') +
      '<div style="margin-top:10px">' + bar('bar--c', s.rep / 100) + '</div>' +
      '<div class="why">Schaltet Betriebe und bessere Bewerber frei.</div></div>');
    h.push('<div class="card">' + statBox('Hitze', Math.round(s.heat) + '<small class="muted"> / 100</small>',
      '<span class="' + (s.heat >= 60 ? 'red' : (s.heat >= 40 ? 'amber' : 'muted')) + '">' + e(band.name) + '</span>',
      s.heat >= 60 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', s.heat / 100) + '</div>' +
      '<div class="why">' + e(band.desc) + '</div></div>');
    h.push('<div class="card">' + statBox('Einfluss', Math.round(d.totalInfluence), 'in ' + d.districtsOpen + ' Bezirken') +
      '<div style="margin-top:10px">' + bar('bar--g', d.totalInfluence / 600) + '</div>' +
      '<div class="why">Einfluss schafft Platz für mehr Betriebe.</div></div>');
    h.push('<div class="card">' + statBox('Furcht', Math.round(d.fear) + '<small class="muted"> / 100</small>',
      '<span class="' + (d.fear >= 45 ? 'red' : d.fear >= 25 ? 'amber' : 'muted') + '">' +
      e(d.fearLevel ? d.fearLevel.name : '') + '</span>', d.fear >= 45 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', d.fear / 100) + '</div>' +
      '<div class="why">' + (d.fear >= CE.fear.TORE.seize ? 'Du kannst einem Rivalen einen Betrieb einfach wegnehmen.'
        : d.fear >= CE.fear.TORE.muscle ? 'Du kannst dich in einen Bezirk hineinzwingen.'
        : d.fear >= CE.fear.TORE.tribute ? 'Du kannst von schwächeren Rivalen Schutzgeld fordern.'
        : 'Ab 25 kannst du Schutzgeld fordern. Ab 40 Bezirke mit Gewalt nehmen.') + '</div></div>');
    h.push('<div class="card">' + statBox('Stellung', e(CE.fear.legitimacyLabel(d.legitimacy)),
      d.legitimacy >= 2 ? 'Banken, Versicherer und Behörden machen Geschäfte mit dir'
        : d.legitimacy === 1 ? 'geduldet, aber nicht vertraut'
        : 'die seriösen Türen sind zu', d.legitimacy >= 2 ? 'green' : d.legitimacy === 1 ? 'cyan' : 'muted') +
      '<div style="margin-top:10px">' + bar('bar--c', d.legitimacy / 2) + '</div>' +
      '<div class="why">' + (d.legitimacy >= 2 ? '-5% Ausgaben, +' + money(12000) + ' Waschkapazität.'
        : 'Braucht 55 Ansehen und Furcht bei höchstens 20. Furcht schließt diese Tür.') + '</div></div>');
    h.push('<div class="card">' + statBox('Stärke', d.strength, s.crew.length - 1 + ' auf der Lohnliste') +
      '<div style="margin-top:10px">' + bar('bar--v', U.clamp(d.strength / 260, 0, 1)) + '</div>' +
      '<div class="why">Entscheidet, wie Rivalen dich behandeln.</div></div>');
    h.push('</div>');

    /* Was jetzt zu tun ist */
    h.push('<div class="grid grid--2">');
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>Was als Nächstes</b></div>' +
      '<div class="rowlist">' + advice(s, d) + '</div></div>');

    /* Laufende Auftraege */
    var runs = s.ops;
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>Laufende Operationen</b>' +
      '<span>' + runs.length + ' aktiv</span></div>');
    if (!runs.length) {
      h.push('<div class="empty"><b>Niemand arbeitet</b><p>Nimm einen Auftrag von der Stadtkarte. ' +
        'Operationen sind dein Einkommen, bevor die Betriebe dich tragen.</p>' +
        '<div style="margin-top:12px">' + btn('Zur Stadt', 'go', { data: { screen: 'city' }, cls: 'btn--primary btn--sm' }) + '</div></div>');
    } else {
      h.push('<div class="rowlist">');
      runs.forEach(function (r) {
        var total = r.ends - r.started, left = r.ends - s.day;
        var names = r.crew.map(function (id) { var c = U.byId(s.crew, id); return c ? c.name : '?'; });
        h.push('<div class="running"><div class="row__main">' +
          '<div class="row__t">' + e(r.offer.name) + '</div>' +
          '<div class="row__s">' + e(D.byId(D.DISTRICTS, r.offer.district).name) + ' &middot; ' + e(names.join(', ')) + '</div></div>' +
          '<div class="running__bar" style="flex:1">' + bar('bar--c', 1 - left / Math.max(1, total)) +
          '<div class="row__s" style="margin-top:3px">' + (left <= 0 ? 'wird abgeschlossen' : left + ' day' + (left === 1 ? '' : 's') + ' left') +
          ' &middot; ' + Math.round(r.odds * 100) + '% Aussicht</div></div>' +
          '<div class="num gold">' + money(r.offer.pay) + '</div></div>');
      });
      h.push('</div>');
    }
    h.push('</div>');
    h.push('</div>');

    /* Letzte Meldungen */
    h.push('<div class="card card--pad0" style="margin-top:14px">' +
      '<div class="card__title" style="padding:16px 16px 0"><b>Letzte Ereignisse</b>' +
      btn('Volles Protokoll', 'go', { data: { screen: 'log' }, cls: 'btn--sm btn--ghost' }) + '</div>');
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
    /* Wirklich untaetig ist nur, wer einen Betriebsposten haben koennte
       und keinen hat. Ein Anwalt ohne Auftrag arbeitet trotzdem - er
       senkt jede Woche die Hitze. Die alte Zaehlung warf beides zusammen
       und meldete "6 Leute untaetig", waehrend sechs Spezialisten ihre
       Wirkung entfalteten. */
    var muessig = s.crew.filter(function (c) {
      return !c.player && !c.post && c.busyUntil <= s.day &&
             D.byId(D.ROLES, c.role).slot === 'business';
    });

    if (s.event) tips.push(tip('Eine Entscheidung wartet', 'Nichts geht weiter, bis du sie beantwortest.', 'Öffnen', 'showEvent', {}, 'gold'));
    if (muessig.length) {
      tips.push(tip(muessig.length + ' ' + (muessig.length === 1 ? 'Person hat' : 'Leute haben') + ' keinen Einsatzort',
        'Betriebsleiter und Geschäftsführer bringen nichts, solange sie keinem Betrieb zugeteilt sind.', 'Einsetzen', 'go', { screen: 'crew' }, 'amber'));
    }
    if (free.length && CE.ops.allOffers(s).length) {
      tips.push(tip(free.length + ' ' + (free.length === 1 ? 'Person ist' : 'Leute sind') + ' frei für einen Auftrag',
        'Operationen sind dein schnellstes Geld und bringen Einfluss.', 'Stadtkarte', 'go', { screen: 'city' }, 'cyan'));
    }
    if (s.heat >= 55) {
      tips.push(tip('Die Hitze liegt bei ' + Math.round(s.heat), 'Der Polizeidruck frisst ' +
        U.pct(St.heatPenalty(s.heat)) + ' deiner Einnahmen.', 'Kümmer dich darum', 'go', { screen: 'org' }, 'red'));
    }
    var kom = s.commission;
    if (kom && kom.open) {
      var kf = CE.commission.feed(s, d);
      if (kom.strength > 55 || (kf.netto > 0 && kom.strength > 25)) {
        var bis = kf.netto > 0 ? Math.ceil((100 - kom.strength) / kf.netto) : null;
        tips.push(tip('Bundesverfahren bei ' + Math.round(kom.strength),
          CE.commission.phase(s).name + (bis !== null ? ' - Anklage in etwa ' + bis + ' weeks' : ''),
          'Dagegen vorgehen', 'go', { screen: 'org' }, 'red'));
      }
    }
    if (d.launderLoss > 500) {
      tips.push(tip('Du verbrennst ' + money(d.launderLoss) + ' pro Woche',
        'Schmutziges Geld über deiner Waschkapazität verliert 42%.', 'In Ordnung bringen', 'go', { screen: 'org' }, 'amber'));
    }
    var under = s.businesses.filter(function (b) { return b._f && b._f.understaffed > 0; });
    /* Nur melden, wenn es sich auch abstellen laesst. Wer 48 Standorte
       und 23 Leute hat, kann nichts dagegen tun - dann stand dort
       dauerhaft "29 Betriebe unterbesetzt", ohne Knopf, der hilft. In
       dem Fall ist die Mannschaftsgrenze die eigentliche Nachricht. */
    var bezahlt = s.crew.filter(function (c) { return !c.player; }).length;
    if (under.length && muessig.length) {
      tips.push(tip(under.length + (under.length === 1 ? ' Betrieb' : ' Betriebe') + ' unterbesetzt',
        'Du hast ' + muessig.length + ' unposted ' + (muessig.length === 1 ? 'person' : 'people') +
        ', die sie besetzen könnten.', 'Einsetzen', 'go', { screen: 'crew' }, 'amber'));
    } else if (under.length > 3 && bezahlt >= d.crewCap) {
      tips.push(tip('Dein Imperium ist deiner Crew entwachsen',
        under.length + ' Betriebe sind unterbesetzt, und jede Stelle ist vergeben. ' +
        'Ein Unterschlupf oder der nächste Rang hebt die Grenze.', 'Organisation', 'go', { screen: 'org' }, 'amber'));
    }
    var unhappy = s.crew.filter(function (c) { return !c.player && c.loyalty < 35; });
    if (unhappy.length) {
      tips.push(tip(unhappy.length + ' ' + (unhappy.length === 1 ? 'Person ist' : 'Leute sind') + ' kurz davor zu gehen',
        'Unter 14 Loyalität gehen sie, und manche reden.', 'Crew', 'go', { screen: 'crew' }, 'red'));
    }
    /* Kaufbares */
    var best = null;
    for (var k in s.districts) {
      if (!s.districts[k].open) continue;
      for (var i = 0; i < D.BUSINESSES.length; i++) {
        var can = CE.empire.canBuy(s, k, D.BUSINESSES[i].id, d.rank);
        if (!can.ok) continue;
        var score = D.BUSINESSES[i].income / can.cost;
        if (!best || score > best.score) best = { k: k, def: D.BUSINESSES[i], cost: can.cost, score: score };
      }
    }
    if (best && tips.length < 4) {
      tips.push(tip('Du kannst dir leisten: ' + best.def.name,
        money(best.cost) + ' ' + D.byId(D.DISTRICTS, best.k).wo + '.', 'Kaufen', 'go', { screen: 'business' }, 'gold'));
    }
    for (k in s.districts) {
      if (s.districts[k].open) continue;
      var co = CE.empire.canOpenDistrict(s, k);
      if (co.ok && tips.length < 5) {
        tips.push(tip('Du kannst ' + D.byId(D.DISTRICTS, k).wohin,
          'für ' + money(co.cost) + ' hinein und dort Fuß fassen.', 'Stadtkarte', 'go', { screen: 'city' }, 'cyan'));
        break;
      }
    }
    if (!tips.length) {
      tips.push(tip('Alles läuft', 'Keine Brände. Bau Einfluss auf oder lass die Woche zu Ende gehen.', 'Finanzen', 'go', { screen: 'finance' }, ''));
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
      '<p>Sechs Bezirke. Der Einfluss entscheidet, wie viel von jedem dir gehorcht &mdash; ' +
      'und wie viele Betriebe er trägt.</p></div></div>');

    h.push('<div class="mapwrap"><div><div class="mapbox">' + mapSvg(s, d) +
      '<div class="mapbox__legend">' +
      '<span><i style="background:#d4af5a"></i>Du</span>' +
      D.RIVALS.map(function (r) { return '<span><i style="background:' + r.color + '"></i>' + e(r.name) + '</span>'; }).join('') +
      '<span><i style="background:#2a2f3d"></i>Frei</span></div></div>');

    /* Einflussuebersicht */
    h.push('<div class="card" style="margin-top:14px"><div class="card__title"><b>Einfluss nach Bezirk</b>' +
      '<span>' + Math.round(d.totalInfluence) + ' / 600 gesamt</span></div><div class="infl-rows">');
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
    h.push('</div><div class="why">Gold bist du, Rot sind alle Rivalen zusammen. ' +
      'Über 100 zusammen heißt: der Bezirk ist voll umkämpft.</div></div>');
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
      /* Der Zustand faerbt den Bezirk. Ein Blick auf die Karte soll
         reichen, um zu sehen, wo es brennt und wo es laeuft. */
      var z = dd.open && dd.state && dd.state !== 'stable' ? CE.city.zustand(dd.state) : null;
      var stil = z ? ' style="fill:' + z.color + '1f;stroke:' + z.color + '66"' : '';
      o.push('<polygon class="' + cls + '"' + stil + ' points="' + dist.poly +
        '" data-act="district" data-id="' + dist.id + '">' +
        '<title>' + e(dist.name) + (z ? ' - ' + e(z.name) : '') + '</title></polygon>');
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
          (CE.empire.canOpenDistrict(s, dist.id).ok ? 'offen &middot; ' + money(CE.empire.entryCost(s, dist.id))
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
        var zz = dd.state && dd.state !== 'stable' ? CE.city.zustand(dd.state) : null;
        if (count || zz) {
          o.push('<text x="' + lx + '" y="' + (ly + 6.2) + '">' +
            (count ? count + ' owned' : '') + (count && zz ? ' \u00b7 ' : '') +
            (zz ? '<tspan fill="' + zz.color + '">' + e(zz.name.toUpperCase()) + '</tspan>' : '') +
            '</text>');
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
      '<span class="tag ' + (dd.open ? 'tag--gold' : '') + '">' + (dd.open ? 'Etabliert' : 'Nicht deiner') + '</span></div>');
    h.push('<p style="margin:0 0 6px;font-size:.84rem;color:var(--ink2);line-height:1.55">' + e(dist.desc) + '</p>');
    h.push('<p style="margin:0 0 10px;font-size:.76rem;color:var(--gold)">' + e(dist.tag) + '</p>');
    if (dd.open && dd.state) {
      var z = CE.city.zustand(dd.state);
      h.push('<div class="card card--flat" style="padding:10px 12px;margin-bottom:14px;border-left:3px solid ' + z.color + '">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">' +
        '<b style="font-size:.86rem;color:' + z.color + '">' + e(z.name) + '</b>' +
        (z.econ !== 1 ? '<span class="tag ' + (z.econ > 1 ? 'tag--green' : 'tag--red') + '">' +
          (z.econ > 1 ? '+' : '') + Math.round((z.econ - 1) * 100) + '% Ertrag</span>' : '') +
        (z.infl !== 1 ? '<span class="tag ' + (z.infl > 1 ? 'tag--green' : 'tag--red') + '">' +
          (z.infl > 1 ? '+' : '') + Math.round((z.infl - 1) * 100) + '% Einfluss</span>' : '') +
        '</div><div class="op__desc">' + e(z.desc) + '</div></div>');
    }

    h.push('<div class="money-grid" style="margin-bottom:14px">' +
      statBox('Einwohner', U.group(dist.pop)) +
      statBox('Wirtschaft', Math.round(dist.econ * 100) + '%', 'Ertragsfaktor') +
      statBox('Polizei', Math.round(dist.lawEye * 100) + '%', 'Hitzefaktor') +
      '</div>');

    h.push('<div class="infl-rows" style="margin-bottom:14px">');
    h.push('<div class="infl-row"><span>Dein Einfluss</span>' + bar('bar--g', dd.mine / 100) +
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
      h.push('<div class="why">Dort Fuß zu fassen kostet ' + money(CE.empire.entryCost(s, id)) +
        (rivalSum > 0 ? ' &mdash; erhöht um den ' + Math.round(rivalSum) + ' Einfluss, den Rivalen hier schon halten.' : '.') + '</div>');
      h.push('<div style="margin-top:10px">' + btn('Hinein ' + e(dist.wohin), 'openDistrict',
        { data: { id: id }, cls: 'btn--primary btn--block', disabled: !can.ok, title: can.why || '' }) + '</div>');
      if (!can.ok) h.push('<div class="why why--bad">' + e(can.why) + '</div>');

      /* Der zweite Weg hinein. Er kostet kein Geld, aber alles andere. */
      var mus = CE.empire.canMuscleIn(s, id);
      h.push('<div class="card card--flat" style="margin-top:12px;padding:12px;border-left:3px solid var(--red)">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px">' +
        '<b style="flex:1;font-size:.88rem">Mit Gewalt hinein</b>' +
        (mus.ok ? '<span class="tag tag--red">' + Math.round(mus.odds * 100) + '% Aussicht</span>' : '') +
        '<span class="tag">kein Eintrittsgeld</span></div>' +
        '<div class="op__desc" style="margin-bottom:9px">Keine Zahlung, keine Erlaubnis. Kostet Stärke, ' +
        '12 Hitze und 4 Ansehen, macht jeden, der hier Boden hält, zum Feind, und der ' +
        'Bezirk startet umkämpft.</div>' +
        btn('Reingehen', 'muscleIn', { data: { id: id }, cls: 'btn--sm btn--danger btn--block',
          disabled: !mus.ok, title: mus.why || '' }) +
        (mus.ok ? '' : '<div class="why">' + e(mus.why) + '</div>') + '</div>');
      h.push('</div>');
      return h.join('');
    }

    /* Wirtschaft im Bezirk */
    var room = CE.empire.maxBusinesses(s, id, d.rank);
    h.push('<div class="money-grid" style="margin-bottom:12px">' +
      statBox('Betriebe', owned.length + ' / ' + room, room > owned.length ? 'Platz zum Wachsen' : 'Kapazität erreicht') +
      statBox('Ertrag je Woche', bd ? money(bd.gross) : '$0') +
      statBox('Hitze je Woche', bd ? '+' + bd.heat.toFixed(1) : '0') + '</div>');
    if (owned.length >= room) {
      h.push('<div class="why">Die Kapazität wächst mit dem Einfluss: je 22 Punkte ein weiterer Betrieb.</div>');
    }
    h.push('<div style="display:flex;gap:6px;margin-bottom:6px">' +
      btn('Hier einen Betrieb kaufen', 'go', { data: { screen: 'business', district: id }, cls: 'btn--sm' }) +
      btn('Einen Rivalen verdrängen', 'pressureDialog', { data: { district: id }, cls: 'btn--sm' }) + '</div>');
    h.push('</div>');

    /* Auftraege */
    var offers = s.offers[id] || [];
    h.push('<div class="card card--pad0" style="margin-top:14px">' +
      '<div class="card__title" style="padding:16px 16px 0"><b>Verfügbare Aufträge</b>' +
      '<span>' + offers.length + ' diese Woche</span></div>');
    if (!offers.length) {
      h.push('<div class="empty"><p>Hier gibt es gerade nichts. Jede Woche kommt neue Arbeit.</p></div>');
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
      '<span>Dauer <b>' + days + 'd</b></span>' +
      '<span>Crew <b>' + o.crewNeed + '</b></span>' +
      '<span>Hitze <b class="' + (o.heat > 0 ? 'amber' : 'green') + '">' + (o.heat > 0 ? '+' : '') + o.heat.toFixed(1) + '</b></span>' +
      '<span>Einfluss <b class="cyan">+' + o.infl.toFixed(1) + '</b></span>' +
      (o.rep ? '<span>Ansehen <b class="cyan">+' + o.rep + '</b></span>' : '') +
      (against ? '<span class="tag tag--red">gegen ' + e(against.name) + '</span>' : '') + '</div>');

    h.push('<div class="op__crew">');
    if (!free.length) {
      h.push('<span class="why">Alle sind beschäftigt oder einem Betrieb zugeteilt.</span>');
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
          '<span class="why" style="margin:0">Erfolgsaussicht</span>'
        : '<span class="why" style="margin:0">Wähl aus, wer geht.</span>') +
      '<div style="margin-left:auto">' +
      btn('Losschicken', 'startOp', { data: { op: o.id }, cls: 'btn--primary btn--sm', disabled: !enough,
        title: enough ? '' : 'Dieser Auftrag braucht ' + o.crewNeed + ' people.' }) + '</div></div>');
    if (picked.length && !enough) h.push('<div class="why why--bad">Braucht ' + o.crewNeed + ' Leute &mdash; mit weniger sinkt die Aussicht stark.</div>');
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 3 BETRIEBE */

  function business(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Betriebe</h2>' +
      '<p>Legale Betriebe waschen Geld und bringen Ansehen. Untergrundbetriebe zahlen weit besser und ' +
      'ziehen genau die Aufmerksamkeit an, die man erwartet.</p></div>' +
      '<div style="display:flex;gap:6px">' +
      filterBtn('bizFilter', 'all', 'Alle') + filterBtn('bizFilter', 'legal', 'Legal') +
      filterBtn('bizFilter', 'dirty', 'Untergrund') + '</div></div>');

    /* Besitz */
    var owned = s.businesses.filter(function (b) {
      var def = D.byId(D.BUSINESSES, b.type);
      return sel.bizFilter === 'all' || (sel.bizFilter === 'legal') === def.legal;
    });

    h.push('<div class="card" style="margin-bottom:14px"><div class="money-grid">' +
      statBox('Im Besitz', s.businesses.length, d.districtsOpen + ' Bezirken') +
      statBox('Ertrag je Woche', money(d.cleanGross + d.dirtyGross)) +
      statBox('Wäsche', money(d.dirtyGross) + ' / ' + money(d.launderCap),
        d.launderLoss > 0 ? '<span class="red">Verlust ' + money(d.launderLoss) + '</span>' : '<span class="green">innerhalb der Kapazität</span>') +
      '</div>' +
      '<div style="margin-top:12px">' + bar(d.dirtyGross > d.launderCap ? 'bar--r' : 'bar--g',
        d.launderCap ? d.dirtyGross / d.launderCap : 0) + '</div></div>');

    if (!s.businesses.length) {
      h.push('<div class="card"><div class="empty"><b>Du besitzt noch nichts</b>' +
        '<p>Ein Eckrestaurant in der Altstadt ist der günstigste Einstieg. Bis dahin zahlen Aufträge die Rechnungen.</p></div></div>');
    } else {
      h.push('<div class="grid grid--3" style="margin-bottom:22px">');
      owned.forEach(function (b) { h.push(bizCard(s, d, b)); });
      h.push('</div>');
    }

    /* Markt */
    h.push('<h3 style="font-family:var(--disp);letter-spacing:.06em;text-transform:uppercase;' +
      'font-size:1.1rem;margin:4px 0 12px">Zu kaufen</h3>');
    var districts = D.DISTRICTS.filter(function (x) { return s.districts[x.id].open; });
    if (!districts.length) {
      h.push('<div class="card"><div class="empty"><p>Du hast keinen Bezirk, in dem du bauen kannst.</p></div></div>');
    }
    districts.forEach(function (dist) {
      var room = CE.empire.maxBusinesses(s, dist.id, d.rank);
      var have = s.businesses.filter(function (b) { return b.district === dist.id; }).length;
      h.push('<div class="card__title" style="margin-top:14px"><b>' + e(dist.name) + '</b>' +
        '<span>' + have + ' / ' + room + ' Plätze belegt</span></div>');
      h.push('<div class="grid grid--4">');
      D.BUSINESSES.forEach(function (def) {
        if (sel.bizFilter !== 'all' && (sel.bizFilter === 'legal') !== def.legal) return;
        if (def.tier > dist.tier + 1) return;
        var can = CE.empire.canBuy(s, dist.id, def.id, d.rank);
        var cost = St.buyCost(dist.id, def.id);
        h.push('<div class="card card--flat biz' + (def.legal ? '' : ' biz--dirty') + '">' +
          '<div class="biz__top"><div class="biz__ico">' + A.icon(def.icon) + '</div>' +
          '<div style="flex:1;min-width:0"><div class="biz__name">' + e(def.name) + '</div>' +
          '<div class="biz__where">' + (def.legal ? 'Legal' : '<span class="red">Untergrund</span>') +
          ' &middot; ' + def.staff + ' Stellen</div></div></div>' +
          '<div class="op__desc">' + e(def.blurb) + '</div>' +
          '<div class="biz__nums">' +
          '<div class="biz__num"><b class="gold">' + money(cost) + '</b><small>Preis</small></div>' +
          '<div class="biz__num"><b class="green">' + money(def.income * dist.econ) + '</b><small>Ertrag/Wo</small></div>' +
          '<div class="biz__num"><b class="' + (def.heat ? 'amber' : 'muted') + '">' +
          (def.heat ? '+' + (def.heat * dist.lawEye).toFixed(1) : '&mdash;') + '</b><small>Hitze</small></div></div>' +
          '<div class="biz__acts">' + btn('Kaufen', 'buyBiz', { data: { district: dist.id, type: def.id },
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
      '<div class="biz__where">' + e(dist.name) + ' &middot; Stufe ' + b.level + '</div>' +
      '<div class="biz__lvl">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<i class="' + (i <= b.level ? 'on' : '') + '"></i>'; }).join('') + '</div></div></div>');

    h.push('<div class="biz__nums">' +
      '<div class="biz__num"><b class="green">' + money(f.gross) + '</b><small>Ertrag</small></div>' +
      '<div class="biz__num"><b class="muted">' + money(f.upkeep) + '</b><small>Kosten</small></div>' +
      '<div class="biz__num"><b class="' + (f.net >= 0 ? 'gold' : 'red') + '">' + U.moneySigned(f.net) + '</b><small>Netto</small></div></div>');

    /* Personal */
    var posted = s.crew.filter(function (c) { return c.post === b.id; });
    h.push('<div class="biz__staff"><span>Personal</span>');
    for (var i = 0; i < f.slots; i++) {
      var c = posted[i];
      h.push(c ? '<span class="slot filled" title="' + e(c.name) + ' (' + e(D.byId(D.ROLES, c.role).name) + ')">' +
        e(c.name.charAt(0)) + '</span>' : '<span class="slot" title="Empty position">+</span>');
    }
    h.push('<span style="margin-left:auto">' + (f.understaffed
      ? '<span class="amber">-' + U.pct(f.staffPenalty) + ' Ertrag</span>'
      : '<span class="green">+' + U.pct(f.staffBonus) + '</span>') + '</span></div>');

    if (f.wiretap) h.push('<div class="biz__warn red">Verwanzt &mdash; 12% weniger Ertrag, bis du nach Wanzen suchst.</div>');
    if (b.damage > 0) h.push('<div class="biz__warn">Beschädigt &mdash; Ertrag ' + U.pct(b.damage) + ' niedriger, erholt sich wöchentlich.</div>');
    if (def.heat) h.push('<div class="biz__warn">Zieht ' + f.heat.toFixed(1) + ' Hitze pro Woche.</div>');
    if (b.boost) h.push('<div class="row__s green">Verbessert: +' + U.pct(b.boost) + ' Ertrag, dauerhaft.</div>');

    h.push('<div class="biz__acts">' +
      btn(up.ok ? 'Ausbauen ' + money(up.cost) : (b.level >= 5 ? 'Höchste Stufe' : 'Ausbauen'), 'upgradeBiz',
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
      '<p>' + paid.length + ' von ' + d.crewCap + ' Stellen besetzt. Die Loyalität sinkt, wenn Leute ' +
      'unterbezahlt oder unbeschäftigt sind oder die Hitze steigen sehen.</p></div>' +
      '<div style="display:flex;gap:6px">' +
      filterBtn('crewFilter', 'all', 'Alle') + filterBtn('crewFilter', 'free', 'Nicht eingesetzt') +
      filterBtn('crewFilter', 'risk', 'Gefährdet') +
      btn('Anwerben', 'recruitDialog', { cls: 'btn--primary btn--sm' }) + '</div></div>');

    h.push('<div class="card" style="margin-bottom:14px"><div class="money-grid">' +
      statBox('Lohnkosten', money(d.salaries) + '<small class="muted">/Wo</small>') +
      statBox('Stärke', d.strength) +
      statBox('Plätze', paid.length + ' / ' + d.crewCap,
        paid.length >= d.crewCap ? '<span class="amber">voll &mdash; bau einen Unterschlupf</span>' : 'Platz für mehr') +
      '</div></div>');

    var list = s.crew.filter(function (c) {
      if (sel.crewFilter === 'free') return !c.post && !c.player;
      if (sel.crewFilter === 'risk') return !c.player && c.loyalty < 45;
      return true;
    });

    if (!list.length) {
      h.push('<div class="card"><div class="empty"><b>Niemand hier</b>' +
        '<p>Du bist die ganze Organisation. Stell jemanden ein, damit zwei Aufträge gleichzeitig laufen können.</p>' +
        '<div style="margin-top:12px">' + btn('Leute suchen', 'recruitDialog', { cls: 'btn--primary btn--sm' }) + '</div></div></div>');
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
      (c.player ? ' <span class="tag tag--gold">Du</span>' : '') + '</div>' +
      '<div class="crew__role">' + e(role.name) + '</div>' +
      (c.player ? '<div class="crew__pay muted">Kein Gehalt</div>'
                : '<div class="crew__pay">' + money(c.salary) + '/wk' +
                  (c.salary < fair * 0.85 ? ' <span class="red">&middot; unterbezahlt</span>' :
                   c.salary > fair * 1.2 ? ' <span class="muted">&middot; großzügig</span>' : '') + '</div>') +
      '</div></div>');

    h.push('<div class="crew__meters">' +
      '<div class="meter"><span>Können</span>' + bar('bar--c', eff / 12) + '<b>' + eff + '</b></div>' +
      (c.player ? '' :
      '<div class="meter"><span>Loyalität</span>' + bar(c.loyalty < 30 ? 'bar--r' : 'bar--g', c.loyalty / 100) +
      '<b class="mood-' + (c.mood || 'steady') + '">' + Math.round(c.loyalty) + '</b></div>') +
      '<div class="meter"><span>Entwicklung</span>' + bar('bar--v', (eff - 1) / Math.max(1, c.potential - 1)) +
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
      (busy ? '<span class="cyan">Auf Auftrag bis Tag ' + c.busyUntil + '</span>'
            : post ? 'Eingesetzt in <b>' + e(post.name) + '</b>'
            : role.slot === 'org' ? '<span class="muted">' + e(role.desc) + '</span>'
            : '<span class="amber">Nicht eingesetzt &mdash; bringt nichts</span>') + '</div>');

    if (!c.player) {
      h.push('<div class="crew__acts">' +
        btn('Verwalten', 'crewDialog', { data: { id: c.id }, cls: 'btn--sm' }) +
        (role.slot === 'business'
          ? btn(post ? 'Umsetzen' : 'Einsetzen', 'assignDialog', { data: { id: c.id }, cls: 'btn--sm btn--ghost', disabled: busy })
          : '') + '</div>');
    }
    h.push('</div>');
    return h.join('');
  }

  /* ================================================== 5 ORGANISATION */

  function org(s, d) {
    var h = [];
    var band = St.heatBand(s.heat);
    h.push('<div class="page-head"><div><h2>Organisation</h2>' +
      '<p>Dauerhafte Investitionen in die Maschine hinter dem Geld &mdash; und die Hebel, die ' +
      'die Polizei auf Abstand halten.</p></div></div>');

    /* Hitze */
    h.push('<div class="card" style="margin-bottom:14px">' +
      '<div class="card__title"><b>Aufmerksamkeit der Polizei</b><span class="tag ' +
      (s.heat >= 60 ? 'tag--red' : s.heat >= 40 ? 'tag--gold' : '') + '">' + e(band.name) + '</span></div>');
    h.push('<div class="grid grid--2" style="gap:18px;align-items:start">');
    h.push('<div>' + statBox('Hitze', Math.round(s.heat) + '<small class="muted"> / 100</small>',
      e(band.desc), s.heat >= 60 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', s.heat / 100) + '</div>' +
      '<div class="pnl" style="margin-top:14px">' +
      '<div class="pnl__row"><span class="muted">Von deinen Betrieben erzeugt</span><b class="red">+' + d.heatGain.toFixed(1) + '</b></div>' +
      '<div class="pnl__row"><span class="muted">Jede Woche abgebaut</span><b class="green">-' + d.heatDecay.toFixed(1) + '</b></div>' +
      '<div class="pnl__row" style="border-top:1px solid var(--line);padding-top:6px">' +
      '<span style="font-weight:600">Nettoveränderung</span><b class="' + (d.heatNet > 0 ? 'red' : 'green') + '">' +
      (d.heatNet > 0 ? '+' : '') + d.heatNet.toFixed(1) + '/Wo</b></div></div>' +
      (d.heatPenalty > 0 ? '<div class="why why--bad">Auf diesem Stand verlierst du ' + U.pct(d.heatPenalty) +
        ' aller Einnahmen, und Ermittlungen kosten obendrauf Geld.</div>'
        : '<div class="why">Unter 40 Hitze gibt es keinen Abzug.</div>') + '</div>');

    h.push('<div style="display:flex;flex-direction:column;gap:8px">');
    CE.empire.heatActions(s).forEach(function (a) {
      var can = s.cash >= a.cost && !(a.shut && s.flags.layLowUntil > s.day);
      h.push('<div class="card card--flat" style="padding:12px">' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">' +
        '<b style="flex:1;font-size:.9rem">' + e(a.name) + '</b>' +
        '<span class="tag tag--green">' + a.heat + ' Hitze</span>' +
        (a.rep ? '<span class="tag tag--red">' + a.rep + ' Ansehen</span>' : '') + '</div>' +
        '<div class="op__desc" style="margin-bottom:9px">' + e(a.desc) + '</div>' +
        btn(a.cost ? 'Zahlen ' + money(a.cost) : 'Eine Woche dichtmachen', 'heatAction',
          { data: { id: a.id }, cls: 'btn--sm btn--block', disabled: !can,
            title: s.cash < a.cost ? 'Nicht genug Bargeld.' : (a.shut && s.flags.layLowUntil > s.day ? 'Du bist bereits untergetaucht.' : '') }) +
        '</div>');
    });
    h.push('</div></div></div>');

    /* Die Kommission */
    h.push(commissionPanel(s, d));

    /* Ausbauten */
    h.push('<div class="card__title"><b>Infrastruktur</b><span>' + money(d.orgUpkeep) + '/Wo Kosten</span></div>');
    h.push('<div class="grid grid--3">');
    D.ORG_UPGRADES.forEach(function (up) {
      var lv = s.org[up.id] || 0;
      var can = CE.empire.canUpgradeOrg(s, up.id);
      h.push('<div class="card biz">' +
        '<div class="biz__top"><div class="biz__ico">' + A.icon(up.icon) + '</div>' +
        '<div style="flex:1"><div class="biz__name">' + e(up.name) + '</div>' +
        '<div class="biz__where">Stufe ' + lv + ' von ' + up.max + '</div>' +
        '<div class="biz__lvl">' + [1, 2, 3].map(function (i) {
          return '<i class="' + (i <= lv ? 'on' : '') + '"></i>'; }).join('') + '</div></div></div>' +
        '<div class="op__desc">' + e(up.desc) + '</div>' +
        '<div class="tag tag--cyan" style="align-self:flex-start">' + e(up.effect) + '</div>' +
        (lv ? '<div class="row__s">Kostet derzeit ' + money(up.upkeep.slice(0, lv).reduce(function (a, b) { return a + b; }, 0)) + '/Wo</div>' : '') +
        '<div class="biz__acts">' + btn(lv >= up.max ? 'Vollständig ausgebaut' : 'Stufe bauen: ' + (lv + 1) + ' &middot; ' + money(up.cost[lv]),
          'upgradeOrg', { data: { id: up.id }, cls: 'btn--sm btn--block' + (can.ok ? ' btn--primary' : ''),
            disabled: !can.ok, title: can.why || '' }) + '</div>' +
        (can.ok || lv >= up.max ? '' : '<div class="why">' + e(can.why) + '</div>') + '</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* Die Kommission: Stand, Naehrboden, Gegenwehr - alles an einem Ort.
     Ein Gegner, dessen Wachstum man nicht nachlesen kann, ist Willkuer. */
  function commissionPanel(s, d) {
    var K = CE.commission;
    var c = s.commission || K.fresh();
    var p = K.phase(s);
    var h = [];

    if (!c.open) {
      return '<div class="card" style="margin-bottom:14px;opacity:.65">' +
        '<div class="card__title"><b>Interesse des Bundes</b><span class="tag">Keine Akte</span></div>' +
        '<div class="why" style="margin:0">Noch hat niemand eine Akte angelegt. Das ändert sich, sobald eine ' +
        'Organisation groß genug ist, dass sich der Papierkram lohnt.</div></div>';
    }

    var f = K.feed(s, d);
    var wochenBis = f.netto > 0 ? Math.ceil((100 - c.strength) / f.netto) : null;

    h.push('<div class="card" style="margin-bottom:14px;border-color:' +
      (c.phase >= 2 ? 'rgba(224,65,65,.4)' : 'var(--line)') + '">');
    h.push('<div class="card__title"><b>Die Kommission</b>' +
      '<span class="tag ' + (c.phase >= 2 ? 'tag--red' : c.phase === 1 ? 'tag--gold' : '') + '">' +
      e(p.name) + '</span></div>');

    h.push('<div class="grid grid--2" style="gap:18px;align-items:start">');

    /* Links: Stand und Naehrboden */
    h.push('<div>' + statBox('Stärke des Falls', Math.round(c.strength) + '<small class="muted"> / 100</small>',
      e(p.desc), c.phase >= 2 ? 'red' : 'amber') +
      '<div style="margin-top:10px">' + bar('bar--r', c.strength / 100) + '</div>');

    h.push('<div class="pnl" style="margin-top:14px">');
    f.zeilen.forEach(function (z) {
      h.push('<div class="pnl__row"><span class="muted">' + e(z.label) +
        '<div class="row__s" style="font-size:.7rem">' + e(z.note) + '</div></span>' +
        '<b class="' + (z.v > 0 ? 'red' : 'green') + '">' + (z.v > 0 ? '+' : '') + z.v.toFixed(1) + '</b></div>');
    });
    h.push('<div class="pnl__row" style="border-top:1px solid var(--line);padding-top:6px;margin-top:4px">' +
      '<span style="font-weight:600">Netto je Woche</span><b class="' + (f.netto > 0 ? 'red' : 'green') + '">' +
      (f.netto > 0 ? '+' : '') + f.netto.toFixed(1) + '</b></div></div>');

    if (wochenBis !== null && c.strength < 100) {
      h.push('<div class="why ' + (wochenBis < 12 ? 'why--bad' : '') + '">In diesem Tempo klagen sie in etwa ' +
        wochenBis + (wochenBis === 1 ? ' Woche' : ' Wochen') + ' an. Eine Anklage beschlagnahmt Untergrund' +
        'betriebe, friert Bargeld ein und nimmt Leute mit.</div>');
    } else if (f.netto <= 0) {
      h.push('<div class="why green">Der Fall geht zurück. Halte das so.</div>');
    }
    if (c.raids) h.push('<div class="why why--bad">Angeklagt ' + c.raids + ' time' + (c.raids === 1 ? '' : 's') + ' bisher.</div>');

    /* Was sie aufgebaut haben. Der Spitzel bleibt namenlos - ihn zu
       finden ist eine eigene Handlung, keine Anzeige. */
    if (c.assets && c.assets.length) {
      h.push('<div class="card__title" style="margin-top:14px"><b>Was sie haben</b>' +
        (c.target ? '<span>Schwerpunkt ' + e(D.byId(D.DISTRICTS, c.target).name) + '</span>' : '') + '</div>');
      h.push('<div class="rowlist" style="border:1px solid var(--line);border-radius:var(--r)">');
      c.assets.forEach(function (a) {
        var txt, ico;
        if (a.kind === 'wiretap') { txt = 'Eine Wanze in <b>' + e(a.name) + '</b> &mdash; 12% weniger Ertrag dort'; ico = 'eye'; }
        else if (a.kind === 'informant') { txt = '<b>Jemand auf deiner Lohnliste</b> kooperiert'; ico = 'informant'; }
        else if (a.kind === 'witness') { txt = '<b>' + e(a.name.charAt(0).toUpperCase() + a.name.slice(1)) + '</b> wird aussagen'; ico = 'scales'; }
        else if (a.kind === 'freeze') { txt = '<b>' + money(a.amount) + '</b> eingefroren bis Tag ' + a.until; ico = 'cash'; }
        else return;
        h.push('<div class="row" style="padding:8px 12px">' +
          '<span style="width:18px;color:var(--red)">' + A.icon(ico) + '</span>' +
          '<div class="row__main"><div class="row__s" style="color:var(--ink2)">' + txt + '</div></div>' +
          '<span class="row__s muted">Tag ' + a.since + '</span></div>');
      });
      h.push('</div>');
    } else {
      h.push('<div class="why">Sie haben gerade nichts auf dem Brett. Das bleibt nicht so.</div>');
    }
    h.push('</div>');

    /* Rechts: Gegenwehr. Gezieltes zuerst - es ist wirksamer und
       billiger als das Allgemeine, aber nur verfuegbar, wenn die
       Kommission tatsaechlich etwas aufgebaut hat. */
    h.push('<div style="display:flex;flex-direction:column;gap:8px">');

    var gezielt = K.targeted(s, d);
    if (gezielt.length) {
      h.push('<div class="card__title" style="margin:0 0 2px"><b>Auf dem Brett</b>' +
        '<span>' + (c.budget ? money(c.budget) + ' in ihrem Budget' : '') + '</span></div>');
      gezielt.forEach(function (a) {
        var bezahlbar = s.cash >= a.cost;
        h.push('<div class="card card--flat" style="padding:12px;border-left:3px solid var(--red)">' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
          '<b style="flex:1;font-size:.9rem">' + e(a.name) + '</b>' +
          '<span class="tag tag--red">' + e(a.badge) + '</span></div>' +
          '<div class="op__desc" style="margin-bottom:9px">' + e(a.desc) + '</div>' +
          btn('Zahlen ' + money(a.cost), 'caseTargeted',
            { data: { id: a.id }, cls: 'btn--sm btn--block btn--primary', disabled: !bezahlbar,
              title: bezahlbar ? '' : 'Nicht genug Bargeld.' }) + '</div>');
      });
      h.push('<div class="card__title" style="margin:10px 0 2px"><b>Allgemeine Verteidigung</b></div>');
    }

    K.actions(s, d).forEach(function (a) {
      var can = K.canDo(s, a.id);
      h.push('<div class="card card--flat" style="padding:12px">' +
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
        '<b style="flex:1;font-size:.9rem">' + e(a.name) + '</b>' +
        '<span class="tag tag--green">' + a.strength + ' Fall</span>' +
        (a.rep ? '<span class="tag ' + (a.rep > 0 ? 'tag--cyan' : 'tag--red') + '">' +
          (a.rep > 0 ? '+' : '') + a.rep + ' Ansehen</span>' : '') +
        (a.heat ? '<span class="tag ' + (a.heat > 0 ? 'tag--red' : 'tag--green') + '">' +
          (a.heat > 0 ? '+' : '') + a.heat + ' Hitze</span>' : '') + '</div>' +
        '<div class="op__desc" style="margin-bottom:9px">' + e(a.desc) + '</div>' +
        btn(a.divest ? 'Aufgeben' : 'Zahlen ' + money(a.cost), 'caseAction',
          { data: { id: a.id }, cls: 'btn--sm btn--block' + (can.ok && c.strength > 40 ? ' btn--primary' : ''),
            disabled: !can.ok, title: can.why || '' }) +
        (can.ok ? '' : '<div class="why">' + e(can.why) + '</div>') + '</div>');
    });
    h.push('</div>');

    h.push('</div></div>');
    return h.join('');
  }

  /* ================================================== 6 RIVALEN */

  function rivals(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Rivalen &amp; Kontakte</h2>' +
      '<p>Vier Organisationen, alle älter als deine, und die Leute dieser Stadt, ' +
      'die deinen Namen kennen.</p></div></div>');

    /* Die Figuren zuerst - sie sind das Persoenlichere. */
    h.push(peoplePanel(s, d));

    h.push('<div class="card__title"><b>Organisationen</b></div>');
    h.push('<div class="grid grid--2">');
    s.rivals.forEach(function (r) {
      var rd = D.byId(D.RIVALS, r.id);
      var infl = CE.rivals.totalInfl(r);
      var rel = CE.rivals.relationLabel(r.relation);
      var crest = A.crest(rd.name, rd.color);
      var canA = CE.rivals.canAlly(s, r.id);
      var negCost = CE.rivals.negotiateCost(s, r, d);
      var tribCost = CE.rivals.tributeCost(s, r, d);
      var truce = r.truceUntil > s.day;

      h.push('<div class="card rival" style="border-left-color:' + rd.color + '">');
      h.push('<div class="rival__head">' +
        '<div class="rival__crest" style="background:linear-gradient(160deg,' + rd.color + ',' + A.shade(rd.color, -60) + ')">' +
        e(crest.initials) + '</div>' +
        '<div style="flex:1"><div class="rival__name">' + e(rd.name) + '</div>' +
        '<div class="rival__leader">' + e(rd.leader) + ' &middot; ' + e(rd.style) + '</div></div>' +
        '<span class="tag ' + (r.allied ? 'tag--green' : r.relation < -40 ? 'tag--red' : '') + '">' + e(rel) + '</span></div>');
      h.push('<p class="rival__desc">' + e(rd.desc) + '</p>');

      h.push('<div class="rel"><span class="row__s" style="width:62px">Verhältnis</span>' +
        '<div class="rel__bar"><span class="rel__mid"></span>' +
        (r.relation >= 0
          ? '<i style="left:50%;width:' + (r.relation / 2) + '%;background:linear-gradient(90deg,#2d7a50,#4ad98a)"></i>'
          : '<i style="right:50%;width:' + (-r.relation / 2) + '%;background:linear-gradient(90deg,#e04141,#7a2020)"></i>') +
        '</div><b class="num" style="width:34px;text-align:right">' + Math.round(r.relation) + '</b></div>');

      h.push('<div class="money-grid" style="margin-bottom:12px">' +
        statBox('Einfluss', Math.round(infl)) +
        statBox('Stärke', Math.round(r.strength),
          r.strength > d.strength ? '<span class="red">stärker als du</span>' : '<span class="green">schwächer als du</span>') +
        statBox('Betriebe', r.biz) + '</div>');

      /* Wo sie sitzen */
      var where = D.DISTRICTS.filter(function (x) { return (r.infl[x.id] || 0) > 3; })
        .sort(function (a, b) { return r.infl[b.id] - r.infl[a.id]; }).slice(0, 3);
      if (where.length) {
        h.push('<div class="row__s" style="margin-bottom:10px">Am stärksten in ' +
          where.map(function (x) { return '<b>' + e(x.name) + '</b> (' + Math.round(r.infl[x.id]) + ')'; }).join(', ') + '</div>');
      }
      var ziel = CE.rivals.zielText(s, r);
      if (ziel) {
        h.push('<div class="row__s" style="margin-bottom:6px">' +
          '<span class="tag tag--violet">Aktuelles Ziel</span> ' + e(ziel) + '</div>');
      }
      if (r.lastAct) h.push('<div class="row__s muted" style="margin-bottom:10px">Letzte Woche: ' + e(r.lastAct) + '.</div>');
      if (truce) h.push('<div class="tag tag--cyan" style="margin-bottom:10px">Waffenruhe bis Tag ' + r.truceUntil + '</div>');

      h.push('<div class="crew__acts">' +
        btn('Verhandeln &middot; ' + money(negCost), 'negotiate', { data: { id: r.id }, cls: 'btn--sm',
          disabled: s.cash < negCost || truce, title: s.cash < negCost ? 'Nicht genug Bargeld.'
            : (truce ? 'Es läuft bereits eine Waffenruhe. Schick stattdessen ein Geschenk.' : '') }) +
        (r.allied ? '' :
          /* "Gift" statt "Tribute": das diplomatische Geschenk und das
             erpresste Schutzgeld standen beide als "Tribute" auf
             derselben Karte - zwei gegensaetzliche Handlungen unter
             einem Namen. */
          btn('Geschenk schicken &middot; ' + money(tribCost), 'tribute', { data: { id: r.id }, cls: 'btn--sm',
            disabled: s.cash < tribCost, title: s.cash < tribCost ? 'Nicht genug Bargeld.'
              : 'Eine kleine, wiederholbare Geste. +9 Verhältnis, ohne Waffenruhe.' })) +
        (r.allied
          ? btn('Bündnis brechen', 'breakAlly', { data: { id: r.id }, cls: 'btn--sm btn--danger' })
          : btn('Bündnis vorschlagen', 'ally', { data: { id: r.id }, cls: 'btn--sm btn--primary',
              disabled: !canA.ok, title: canA.why || '' })) +
        btn('Druck machen', 'pressureDialog', { data: { rival: r.id }, cls: 'btn--sm btn--ghost', disabled: r.allied,
          title: r.allied ? 'Ihr seid verbündet.' : '' }) +
        '</div>');

      /* Die aggressiven Wege. Sie erscheinen nur, wenn die Furcht dafuer
         reicht - ein vorsichtiger Spieler sieht hier eine Zeile, die
         erklaert, was ihm entgeht, und keinen Knopf. */
      var zahlt = (s.tributes || []).some(function (x) { return x.rival === r.id; });
      var canT = CE.rivals.canDemandTribute(s, r.id);
      var canS = CE.rivals.canSeize(s, r.id, sel.district);
      var fearGen = (s.fear || 0);
      if (zahlt) {
        var tb = CE.fear.tributeIncome(s, d).zeilen.filter(function (x) { return x.rival === r.id; })[0];
        h.push('<div class="card card--flat" style="margin-top:8px;padding:10px 12px;border-left:3px solid var(--gold)">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<b style="flex:1;font-size:.86rem" class="gold">Zahlt dir Schutzgeld</b>' +
          '<span class="tag tag--gold">' + money(tb ? tb.amount : 0) + '/Wo</span></div>' +
          '<div class="op__desc" style="margin:4px 0 8px">Direkt in deine Tasche. Niemand wäscht ' +
          'Schutzgeld, weil es niemand meldet.</div>' +
          btn('Laufen lassen', 'stopTribute', { data: { id: r.id }, cls: 'btn--sm btn--ghost' }) + '</div>');
      } else if (fearGen >= CE.fear.TORE.tribute - 10 || canT.ok) {
        h.push('<div class="crew__acts" style="margin-top:6px">' +
          btn('Schutzgeld fordern' + (canT.ok ? ' &middot; ' + Math.round(canT.odds * 100) + '%' : ''),
            'demandTribute', { data: { id: r.id }, cls: 'btn--sm btn--danger',
              disabled: !canT.ok, title: canT.why || '' }) +
          btn('Betrieb nehmen', 'seizeDialog', { data: { rival: r.id }, cls: 'btn--sm btn--danger',
            disabled: fearGen < CE.fear.TORE.seize,
            title: fearGen < CE.fear.TORE.seize ? 'Benötigt ' + CE.fear.TORE.seize + ' fear.' : '' }) +
          '</div>');
        if (!canT.ok && canT.why) h.push('<div class="why">' + e(canT.why) + '</div>');
      }
      if (!r.allied && !canA.ok && canA.why) {
        h.push('<div class="why">' + e(canA.why) +
          (r.relation < 42 ? ' Verhandeln hebt das Verhältnis um 14-22, ein Geschenk um bis zu 11 ' +
            '(weniger, je freundlicher es schon ist). Aufträge gegen sie drücken es wieder herunter.' : '') +
          '</div>');
      }
      if (r.allied) {
        h.push('<div class="why green">Verbündet: sie halten sich aus deinen Bezirken heraus, bestreiten deinen ' +
          'Einfluss nicht mehr und zahlen dir ' + money(Math.round(infl * 58 * (0.7 + s.rep / 250))) + ' pro Woche.</div>');
      } else if (canA.ok) {
        h.push('<div class="why">Ein Bündnis brächte etwa ' +
          money(Math.round(infl * 58 * (0.7 + s.rep / 250))) + ' pro Woche und ein Ende des Streits um deine Bezirke.</div>');
      }
      h.push('</div>');
    });
    h.push('</div>');
    return h.join('');
  }

  /* Wiederkehrende Figuren: wen man kennt, wie man zueinander steht und
     wie weit die gemeinsame Geschichte ist. Ohne diese Anzeige waeren es
     wieder nur Textmeldungen, die zufaellig denselben Namen tragen. */
  function peoplePanel(s, d) {
    var P = CE.people;
    var leute = P.known(s);
    if (!leute.length) {
      return '<div class="card" style="margin-bottom:16px;opacity:.6">' +
        '<div class="card__title"><b>Leute</b><span>noch niemand</span></div>' +
        '<div class="why" style="margin:0">Sobald du jemand bist, den man kennen sollte, ' +
        'stellen sich dir Leute vor. Sie erinnern sich, wie es gelaufen ist.</div></div>';
    }
    var h = ['<div class="card card--pad0" style="margin-bottom:16px">' +
      '<div class="card__title" style="padding:16px 16px 0"><b>Leute</b>' +
      '<span>' + leute.length + ' von ' + P.CAST.length + ' getroffen</span></div>' +
      '<div class="grid grid--2" style="padding:12px 16px 16px">'];
    leute.forEach(function (x) {
      var pd = x.def, st = x.state;
      var lbl = P.trustLabel(st.trust);
      var cls = st.trust >= 25 ? 'tag--green' : st.trust > -20 ? '' : 'tag--red';
      h.push('<div class="card card--flat" style="display:flex;gap:11px;align-items:flex-start">' +
        '<div class="crew__av" style="border-color:' + pd.color + '55">' + A.portrait(pd.face, 46) + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<b style="font-size:.92rem">' + e(pd.name) + '</b>' +
        '<span class="tag ' + cls + '">' + e(lbl) + '</span>' +
        (st.done ? '<span class="tag">Geschichte beendet</span>' : '') + '</div>' +
        '<div class="row__s" style="color:' + pd.color + '">' + e(pd.role) + '</div>' +
        '<div class="op__desc" style="margin:6px 0">' + e(pd.blurb) + '</div>' +
        '<div class="meter" style="grid-template-columns:44px 1fr 34px">' +
        '<span>Vertrauen</span><div class="bar ' + (st.trust >= 0 ? 'bar--g' : 'bar--r') + '">' +
        '<i style="width:' + Math.abs(st.trust) + '%"></i></div>' +
        '<b>' + Math.round(st.trust) + '</b></div>' +
        (st.flags && Object.keys(st.flags).length
          ? '<div class="row__s muted" style="margin-top:5px">' +
            e(flagText(pd.id, st.flags)) + '</div>' : '') +
        '</div></div>');
    });
    h.push('</div></div>');
    return h.join('');
  }

  /* Was zwischen euch steht, in einem Satz. */
  function flagText(id, f) {
    var teile = [];
    if (f.bribed) teile.push('du wolltest sie kaufen');
    if (f.channel) teile.push('es gibt eine offene Leitung');
    if (f.fed) teile.push('du hast ihr einen Rivalen geliefert');
    if (f.closed) teile.push('du hast die Tür zugemacht');
    if (f.ally) teile.push('sie hat ihre eigene Akte begraben');
    if (f.destroyed) teile.push('du hast ihre Laufbahn beendet');
    if (f.gavePenn) teile.push('du hast den Stadtrat preisgegeben');
    if (f.saved) teile.push('du hast seine Verteidigung bezahlt');
    if (f.silenced) teile.push('er wird nicht aussagen');
    if (f.network) teile.push('sein ganzes Netz arbeitet für dich');
    return teile.join(' \u00b7 ');
  }

  /* ================================================== 7 FINANZEN */

  function finance(s, d) {
    var h = [];
    h.push('<div class="page-head"><div><h2>Finanzen</h2>' +
      '<p>Jeder Dollar, der sich bewegt, steht hier mit Begründung. Die Woche läuft von Montag bis Sonntag.</p></div></div>');

    h.push('<div class="grid grid--4" style="margin-bottom:14px">' +
      '<div class="card">' + statBox('Bargeld', money(s.cash), '', s.cash < 0 ? 'red' : 'gold') + '</div>' +
      '<div class="card">' + statBox('Einnahmen je Woche', money(d.grossIncome), '', 'green') + '</div>' +
      '<div class="card">' + statBox('Ausgaben je Woche', money(d.expenses), '', 'red') + '</div>' +
      '<div class="card">' + statBox('Netto', U.moneySigned(d.net),
        d.net !== 0 ? (d.net > 0 ? 'Verdopplung in ~' + Math.max(1, Math.ceil(Math.max(0, s.cash) / d.net)) + ' weeks' : 'Verlust')
        : '', d.net >= 0 ? 'green' : 'red') + '</div></div>');

    /* Verlauf */
    h.push('<div class="grid grid--2" style="margin-bottom:14px">');
    h.push('<div class="card"><div class="card__title"><b>Vermögen und Bargeld</b><span>' +
      s.history.length + ' Wochen</span></div>' +
      '<div class="chartbox"><canvas data-chart="worth" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#d4af5a;margin-right:5px"></i>Vermögen</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4bd6e8;margin-right:5px"></i>Bargeld</span></div></div>');
    h.push('<div class="card"><div class="card__title"><b>Einnahmen gegen Ausgaben</b></div>' +
      '<div class="chartbox"><canvas data-chart="flow" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4ad98a;margin-right:5px"></i>Einnahmen</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#e04141;margin-right:5px"></i>Ausgaben</span></div></div>');
    h.push('</div>');

    h.push('<div class="grid grid--2" style="margin-bottom:14px">');
    h.push('<div class="card"><div class="card__title"><b>Ertrag nach Bezirk</b></div>' +
      '<div class="chartbox"><canvas data-chart="districts"></canvas></div></div>');
    h.push('<div class="card"><div class="card__title"><b>Hitze und Ansehen</b></div>' +
      '<div class="chartbox"><canvas data-chart="heat" height="180"></canvas></div>' +
      '<div style="display:flex;gap:14px;margin-top:8px;font-size:.74rem">' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#e04141;margin-right:5px"></i>Hitze</span>' +
      '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#4bd6e8;margin-right:5px"></i>Ansehen</span></div></div>');
    h.push('</div>');

    /* Buchungen */
    h.push('<div class="card card--pad0"><div class="card__title" style="padding:16px 16px 0"><b>Wochenabrechnungen</b>' +
      '<span>' + s.ledger.length + ' vorhanden</span></div>');
    if (!s.ledger.length) {
      h.push('<div class="empty"><p>Die erste Abrechnung kommt am Ende von Woche 1.</p></div>');
    } else {
      s.ledger.slice(0, 6).forEach(function (L, idx) {
        h.push('<div style="padding:0 16px 8px">' +
          '<div style="display:flex;align-items:center;gap:10px;padding:12px 0 8px;border-top:1px solid var(--line)">' +
          '<b style="font-family:var(--disp);letter-spacing:.06em">WOCHE ' + L.week + '</b>' +
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
        h.push('<tr class="sum"><td>Netto für die Woche</td><td class="r ' + (L.net >= 0 ? 'green' : 'red') + '">' +
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
    h.push('<div class="page-head"><div><h2>Ereignisse</h2>' +
      '<p>Alles, was passiert ist, das Neueste zuerst. Deine Entscheidungen sind blau markiert.</p></div></div>');
    h.push('<div class="card card--pad0"><div class="rowlist">' + logLines(s, 200) + '</div></div>');
    return h.join('');
  }

  function logLines(s, n) {
    if (!s.log.length) return '<div class="empty"><p>Noch ist nichts passiert.</p></div>';
    return s.log.slice(0, n).map(function (L) {
      return '<div class="logline t-' + e(L.t) + '">' +
        '<div class="logline__day">' + (L.day === 0 ? 'Tag 0' : 'Tag ' + L.day) + '</div>' +
        '<div class="logline__dot"></div>' +
        '<div class="logline__txt">' + e(L.text) +
        (L.choice ? ' <span class="tag tag--cyan">' + e(L.choice) + '</span>' : '') + '</div></div>';
    }).join('');
  }

  /* ================================================== 9 ERFOLGE */

  function awards(s, d) {
    var got = CE.progress.earned(s).length;
    var h = [];
    h.push('<div class="page-head"><div><h2>Erfolge</h2>' +
      '<p>' + got + ' von ' + D.ACHIEVEMENTS.length + ' erreicht.</p></div></div>');

    h.push('<div class="card" style="margin-bottom:14px">' + bar('bar--g', got / D.ACHIEVEMENTS.length) +
      '<div class="money-grid" style="margin-top:14px">' +
      statBox('Operationen', s.stats.opsWon + ' / ' + s.stats.opsRun, 'erfolgreich') +
      statBox('Razzien überstanden', s.stats.raids) +
      statBox('Strafen gezahlt', s.stats.fines) + '</div></div>');

    h.push('<div class="grid grid--3">');
    D.ACHIEVEMENTS.forEach(function (a) {
      var when = s.achievements[a.id];
      h.push('<div class="card card--flat ach' + (when !== undefined ? ' is-got' : '') + '">' +
        '<div class="ach__medal">' + A.icon(when !== undefined ? 'trophy' : 'lock') + '</div>' +
        '<div><div class="ach__n">' + e(a.name) + '</div>' +
        '<div class="ach__d">' + e(a.desc) + '</div>' +
        (when !== undefined ? '<div class="row__s gold">Tag ' + when + '</div>' : '') + '</div></div>');
    });
    h.push('</div>');

    /* Siegesstand */
    var city = CE.progress.cityProgress(s);
    h.push('<div class="card" style="margin-top:14px"><div class="card__title"><b>Die Stadt</b>' +
      '<span>' + city.held + ' / ' + city.total + ' Bezirke mehrheitlich kontrolliert</span></div>' +
      bar('bar--g', city.held / city.total) +
      '<div class="why">Halte als Legende der Unterwelt in allen sechs Bezirken mindestens 60 Einfluss. ' +
      'Dann halte entweder das Bundesverfahren unter 60 oder sei bei 65 oder mehr gefürchtet &mdash; ' +
      'Kontrolle durch Ansehen oder Kontrolle durch Schrecken, beides hält die Stadt.' +
      (s.commission && s.commission.open && s.commission.strength >= 60
        ? ' <b class="red">Der Fall steht bei ' + Math.round(s.commission.strength) +
          ' &mdash; man kontrolliert keine Stadt, die einen gleich hochnimmt.</b>' : '') + (s.flags.won ? ' <b class="gold">Erreicht an Tag ' + s.flags.won + '.</b>' : '') + '</div></div>');
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
          { name: 'Vermögen', color: '#d4af5a', values: hist.map(function (x) { return x.worth; }) },
          { name: 'Bargeld', color: '#4bd6e8', values: hist.map(function (x) { return x.cash; }), fill: false }
        ], { zero: true, xLast: 'Woche ' + U.weekOf(s.day) });
      } else if (kind === 'flow') {
        CE.charts.line(c, [
          { name: 'Einnahmen', color: '#4ad98a', values: hist.map(function (x) { return x.income; }) },
          { name: 'Ausgaben', color: '#e04141', values: hist.map(function (x) { return x.expense; }), fill: false }
        ], { zero: true, xLast: 'Woche ' + U.weekOf(s.day) });
      } else if (kind === 'heat') {
        CE.charts.line(c, [
          { name: 'Hitze', color: '#e04141', values: hist.map(function (x) { return x.heat; }) },
          { name: 'Ansehen', color: '#4bd6e8', values: hist.map(function (x) { return x.rep; }), fill: false }
        ], { min: 0, fmt: function (v) { return Math.round(v); }, xLast: 'Woche ' + U.weekOf(s.day) });
      } else if (kind === 'districts') {
        var rows = [];
        D.DISTRICTS.forEach(function (dist) {
          var bd = d.byDistrict[dist.id];
          if (bd && bd.gross > 0) rows.push({ label: dist.name, value: Math.round(bd.gross), color: '#d4af5a' });
        });
        rows.sort(function (a, b) { return b.value - a.value; });
        CE.charts.bars(c, rows, { empty: 'Noch keine Betriebe' });
      }
    }
  }

  CE.ui = {
    init: init, render: render, paintCharts: paintCharts, SCREENS: SCREENS, sel: sel,
    crewCard: crewCard, bizCard: bizCard, districtPanel: districtPanel,
    helpers: { btn: btn, statBox: statBox, bar: bar, e: e, money: money, logLines: logLines }
  };
})(typeof window !== 'undefined' ? window : globalThis);
