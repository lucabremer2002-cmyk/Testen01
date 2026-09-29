/* ---------------------------------------------------------------------
   Alles, was der Spieler mit Geld tut: Betriebe kaufen, ausbauen,
   verkaufen, Bezirke oeffnen, die Organisation ausbauen, Hitze senken.

   Jede Funktion gibt {ok, why} zurueck. Die Oberflaeche fragt vorher mit
   der jeweiligen can*-Funktion, damit ein Knopf nie erst nach dem Klick
   sagt, dass er nicht geht - er ist dann schon ausgegraut und nennt den
   Grund.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* ---------------------------------------------------------- Bezirke */

  function canOpenDistrict(s, id) {
    var dd = s.districts[id], def = D.byId(D.DISTRICTS, id);
    if (!dd) return { ok: false, why: 'Unknown district.' };
    if (dd.open) return { ok: false, why: 'Already yours to work.' };
    var d = St.derive(s);
    if (d.rank < def.rank) return { ok: false, why: 'Requires rank ' + D.RANKS[def.rank].name + '.' };
    var cost = entryCost(s, id);
    if (s.cash < cost) return { ok: false, why: 'Needs ' + U.money(cost) + '.' };
    return { ok: true, cost: cost };
  }

  /* Eintrittsgeld steigt mit der fremden Praesenz: wo schon jemand sitzt,
     kostet der erste Fuss auf dem Boden mehr. */
  /* Der Aufschlag fuer fremde Praesenz ist gedeckelt, und wer einen Namen
     hat, kommt guenstiger hinein. Vorher wuchs der Preis ungebremst mit
     dem Einfluss der Rivalen - und weil die nachwachsen, wurde Expansion
     mit der Zeit *teurer* statt leichter. Im Testlauf sass der Spieler
     deshalb 39 Wochen in einem einzigen Bezirk fest, mit Einfluss am
     Anschlag und nichts mehr zu tun. */
  function entryCost(s, id) {
    var def = D.byId(D.DISTRICTS, id);
    var rivalInfl = 0;
    for (var i = 0; i < s.rivals.length; i++) rivalInfl += s.rivals[i].infl[id] || 0;
    var aufschlag = 1 + Math.min(rivalInfl, 90) / 220;      /* hoechstens +41 % */
    var ruf = 1 - (s.rep / 100) * 0.25;                     /* bis zu 25 % Rabatt */
    return Math.round(def.entry * aufschlag * ruf);
  }

  function openDistrict(s, id) {
    var c = canOpenDistrict(s, id);
    if (!c.ok) return c;
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    s.districts[id].open = true;
    s.districts[id].mine = Math.max(s.districts[id].mine, 4);
    s.rep = U.clamp(s.rep + 2, 0, 100);
    /* Wer einzieht, wird bemerkt. */
    for (var i = 0; i < s.rivals.length; i++) {
      if ((s.rivals[i].infl[id] || 0) > 10) s.rivals[i].relation = U.clamp(s.rivals[i].relation - 6, -100, 100);
    }
    return { ok: true, cost: c.cost };
  }

  /* --------------------------------------------------------- Betriebe */

  /* Wie viele Standorte ein Bezirk traegt: zwei ohne Rueckhalt, sechs bei
     voller Kontrolle - und zwei mehr, wenn man einen Namen hat.

     Der Rangteil ist kein Beiwerk. Einfluss endet bei 100, und ein voll
     kontrollierter Bezirk war damit fertig: im Testlauf stand der
     Spieler dreizehn Wochen mit maximalem Einfluss und sechs Betrieben
     da und konnte nur noch Geld ansammeln. Mit dem Rang waechst ein
     alter Bezirk weiter, statt zum Standbild zu werden. */
  function maxBusinesses(s, districtId, rang) {
    var dd = s.districts[districtId];
    if (!dd || !dd.open) return 0;
    /* Der Rang darf mitgegeben werden. Der Betriebe-Bildschirm fragt
       diese Funktion bis zu achtzig Mal je Aufbau - jedes Mal derive()
       zu rechnen waere Verschwendung, auch wenn es billig ist. */
    if (rang === undefined) rang = St.derive(s).rank;
    return 2 + Math.floor(dd.mine / 22) + Math.floor(rang / 2);
  }

  function canBuy(s, districtId, typeId, rang) {
    var def = D.byId(D.BUSINESSES, typeId);
    var dd = s.districts[districtId];
    if (!def || !dd) return { ok: false, why: 'Unknown.' };
    if (!dd.open) return { ok: false, why: 'You have no foothold in this district.' };
    if (s.rep < def.rep) return { ok: false, why: 'Requires ' + def.rep + ' reputation (you have ' + Math.floor(s.rep) + ').' };
    var dist = D.byId(D.DISTRICTS, districtId);
    if (def.tier > dist.tier + 1) return { ok: false, why: 'This district cannot support an operation that size.' };
    /* Ein Bezirk traegt nur so viele Betriebe, wie man dort Rueckhalt
       hat. Ohne diese Grenze wird das Spaetspiel zum Kaufknopf-Druecken:
       die Simulation lief auf 123 Standorte, was nichts mehr entscheidet.
       Jetzt ist Einfluss die Voraussetzung fuer Wachstum, nicht Beiwerk. */
    var here = s.businesses.filter(function (b) { return b.district === districtId; }).length;
    var room = maxBusinesses(s, districtId, rang);
    if (here >= room) {
      return { ok: false, why: 'You can support ' + room + ' businesses in this district. ' +
        'Build influence here to make room for more.' };
    }

    /* Ein Betriebstyp zweimal im selben Bezirk verwaessert sich. */
    var same = s.businesses.filter(function (b) { return b.district === districtId && b.type === typeId; }).length;
    if (same >= 2) return { ok: false, why: 'Two of these in one district is already one too many.' };
    var cost = St.buyCost(districtId, typeId) * (same ? 1.35 : 1);
    cost = Math.round(cost);
    if (s.cash < cost) return { ok: false, why: 'Needs ' + U.money(cost) + '.' };
    return { ok: true, cost: cost };
  }

  function buy(s, districtId, typeId, name) {
    var c = canBuy(s, districtId, typeId);   /* Kauf rechnet frisch */
    if (!c.ok) return c;
    var def = D.byId(D.BUSINESSES, typeId);
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    var b = {
      id: U.nextId(s, 'b'), type: typeId, district: districtId, level: 1,
      name: name || def.name, bought: s.day, shut: 0, damage: 0
    };
    s.businesses.push(b);
    s.rep = U.clamp(s.rep + (def.legal ? 2.5 : 1), 0, 100);
    s.districts[districtId].mine = U.clamp(s.districts[districtId].mine + 2, 0, 100);
    return { ok: true, biz: b, cost: c.cost };
  }

  function canUpgrade(s, bizId) {
    var b = U.byId(s.businesses, bizId);
    if (!b) return { ok: false, why: 'Unknown business.' };
    if (b.level >= D.UPGRADE.max) return { ok: false, why: 'Already at maximum level.' };
    var cost = St.upgradeCost(s, b);
    if (s.cash < cost) return { ok: false, why: 'Needs ' + U.money(cost) + '.' };
    return { ok: true, cost: cost };
  }

  function upgrade(s, bizId) {
    var c = canUpgrade(s, bizId);
    if (!c.ok) return c;
    var b = U.byId(s.businesses, bizId);
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    b.level++;
    return { ok: true, level: b.level, cost: c.cost };
  }

  /* Verkauf bringt 68 % des Buchwerts - genug, um umzudisponieren, zu
     wenig, um Kaufen und Verkaufen zur Einnahmequelle zu machen. */
  function sell(s, bizId) {
    var b = U.byId(s.businesses, bizId);
    if (!b) return { ok: false, why: 'Unknown business.' };
    var price = Math.round(St.bizValue(s, b) * 0.68);
    s.cash += price;
    s.stats.earned += price;
    s.businesses = s.businesses.filter(function (x) { return x.id !== bizId; });
    for (var i = 0; i < s.crew.length; i++) if (s.crew[i].post === bizId) s.crew[i].post = null;
    return { ok: true, price: price };
  }

  /* --------------------------------------------------- Ausbau der Org */

  function canUpgradeOrg(s, upId) {
    var up = D.byId(D.ORG_UPGRADES, upId);
    if (!up) return { ok: false, why: 'Unknown.' };
    var lv = s.org[upId] || 0;
    if (lv >= up.max) return { ok: false, why: 'Fully built.' };
    var cost = up.cost[lv];
    if (s.cash < cost) return { ok: false, why: 'Needs ' + U.money(cost) + '.' };
    return { ok: true, cost: cost, level: lv + 1 };
  }

  function upgradeOrg(s, upId) {
    var c = canUpgradeOrg(s, upId);
    if (!c.ok) return c;
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    s.org[upId] = c.level;
    return { ok: true, level: c.level, cost: c.cost };
  }

  /* ------------------------------------------------------------ Hitze

     Drei Wege nach unten, alle mit einem anderen Preis. Der Spieler soll
     nie in eine Lage kommen, in der er nichts tun kann - Hitze ist
     Druck, keine Sackgasse.
  */
  function heatActions(s) {
    var d = St.derive(s);
    /* Der Preis muss zur Groesse passen. Die feste Untergrenze von 6.000
       traf einen Anfaenger ohne Betriebe genauso hart wie ein Imperium:
       drei Auftraege Ertrag fuer neun Punkte Hitze. Im Szenarienlauf
       verbrannte der vorsichtige Spieler damit hundertzehn Wochen lang
       sein gesamtes Einkommen und kam nie ueber 11.000 Dollar hinaus -
       er lief auf einem Laufband statt zu wachsen. */
    var base = U.clamp(d.grossIncome * 0.9 + Math.max(0, d.netWorth) * 0.035,
                       1400, 400000);
    return [
      { id: 'counsel', name: 'Retain Counsel', cost: Math.round(base * 0.55),
        heat: -9, rep: 0,
        desc: 'Lawyers file, delay and lose paperwork. Slow, clean, expensive.' },
      { id: 'grease', name: 'Grease Palms', cost: Math.round(base * 1.1),
        heat: -19, rep: -3,
        desc: 'Envelopes reach the right desks. It works, and people know it worked.' },
      { id: 'laylow', name: 'Lay Low', cost: 0, heat: -14, rep: -1, shut: 7,
        desc: 'Shut every underground operation for a week. No dirty income, no new attention.' }
    ];
  }

  function doHeatAction(s, id) {
    var act = null, list = heatActions(s);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) act = list[i];
    if (!act) return { ok: false, why: 'Unknown action.' };
    if (s.cash < act.cost) return { ok: false, why: 'Needs ' + U.money(act.cost) + '.' };
    if (act.shut && s.flags.layLowUntil > s.day) return { ok: false, why: 'You are already lying low.' };
    s.cash -= act.cost;
    s.stats.spent += act.cost;
    s.heat = U.clamp(s.heat + act.heat, 0, 100);
    s.rep = U.clamp(s.rep + act.rep, 0, 100);
    if (act.shut) s.flags.layLowUntil = s.day + act.shut;
    return { ok: true, act: act };
  }

  CE.empire = {
    maxBusinesses: maxBusinesses, canOpenDistrict: canOpenDistrict, openDistrict: openDistrict, entryCost: entryCost,
    canBuy: canBuy, buy: buy, canUpgrade: canUpgrade, upgrade: upgrade, sell: sell,
    canUpgradeOrg: canUpgradeOrg, upgradeOrg: upgradeOrg,
    heatActions: heatActions, doHeatAction: doHeatAction
  };
})(typeof window !== 'undefined' ? window : globalThis);
