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
    if (!dd) return { ok: false, why: 'Unbekannter Bezirk.' };
    if (dd.open) return { ok: false, why: 'Darin arbeitest du bereits.' };
    var d = St.derive(s);
    if (d.rank < def.rank) return { ok: false, why: 'Erfordert Rang ' + D.RANKS[def.rank].name + '.' };
    var cost = entryCost(s, id);
    if (s.cash < cost) return { ok: false, why: 'Benötigt ' + U.money(cost) + '.' };
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

  /* Sich hineinzwingen. Der zweite Weg in einen Bezirk: kein Eintritts-
     geld, dafuer Staerke, Hitze und eine Stadt, die zusieht. Der Bezirk
     startet umkaempft statt ruhig - man hat ihn genommen, nicht
     gekauft. Ein vorsichtiger Spieler bekommt diesen Knopf nie zu
     sehen, weil er die Furcht dafuer nicht aufbringt. */
  function canMuscleIn(s, id) {
    var F = CE.fear;
    var dd = s.districts[id], ddef = D.byId(D.DISTRICTS, id);
    if (!dd) return { ok: false, why: 'Unbekannter Bezirk.' };
    if (dd.open) return { ok: false, why: 'Darin arbeitest du bereits.' };
    if ((s.fear || 0) < F.TORE.muscle) {
      return { ok: false, why: 'Sich hineinzuzwingen braucht ' + F.TORE.muscle + ' Furcht (du hast ' +
        Math.round(s.fear || 0) + ').' };
    }
    var d = St.derive(s);
    if (d.rank < ddef.rank) return { ok: false, why: 'Erfordert Rang ' + D.RANKS[ddef.rank].name + '.' };
    var fremd = 0;
    for (var i = 0; i < s.rivals.length; i++) fremd += s.rivals[i].infl[id] || 0;
    var noetig = 35 + fremd * 0.75;
    if (d.strength < noetig) {
      return { ok: false, why: 'Benötigt Organisationsstärke ' + Math.round(noetig) +
        ' (du hast ' + d.strength + ').' };
    }
    var odds = U.clamp(0.35 + (d.strength - noetig) / 130 + ((s.fear || 0) - 40) / 150, 0.2, 0.88);
    return { ok: true, odds: odds, strength: noetig };
  }

  function muscleIn(s, rng, id) {
    var pre = canMuscleIn(s, id);
    if (!pre.ok) return pre;
    var ddef = D.byId(D.DISTRICTS, id);

    s.heat = U.clamp(s.heat + 12, 0, 100);
    s.rep = U.clamp(s.rep - 4, 0, 100);
    CE.fear.add(s, 15, 'mit Gewalt eingedrungen ' + ddef.wohin);
    for (var i = 0; i < s.rivals.length; i++) {
      if ((s.rivals[i].infl[id] || 0) > 5) {
        s.rivals[i].relation = U.clamp(s.rivals[i].relation - 22, -100, 100);
        s.rivals[i].truceUntil = -1;
      }
    }

    if (!rng.chance(pre.odds)) {
      /* Ein gescheiterter Einmarsch kostet Leute. */
      var verletzt = s.crew.filter(function (c) { return !c.player && c.busyUntil <= s.day; });
      if (verletzt.length) {
        var wer = rng.pick(verletzt);
        wer.busyUntil = s.day + rng.int(8, 16);
        wer.hurt = wer.busyUntil;
      }
      return { ok: true, win: false,
        text: 'Sie haben gehalten. Du bist nicht ' + ddef.wo + ', und jetzt weiß dort jeder, dass du es versucht hast.' };
    }

    s.districts[id].open = true;
    s.districts[id].mine = 14;
    s.districts[id].state = 'contested';
    s.districts[id].stateSince = s.day;
    s.stats.muscled = (s.stats.muscled || 0) + 1;
    return { ok: true, win: true,
      text: 'Du bist ' + ddef.wo + ', und du hast keinen Cent dafür bezahlt. ' +
            'Der Bezirk ist umkämpft und bleibt es eine Weile.' };
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
    if (!def || !dd) return { ok: false, why: 'Unbekannt.' };
    if (!dd.open) return { ok: false, why: 'In diesem Bezirk hast du keinen Fuß in der Tür.' };
    if (s.rep < def.rep) return { ok: false, why: 'Erfordert ' + def.rep + ' Ansehen (du hast ' + Math.floor(s.rep) + ').' };
    /* Kein Lizenzgeber unterschreibt fuer jemanden, vor dem die Stadt
       Angst hat. Das ist die Tuer, die Furcht zuschlaegt. */
    if (def.legal && def.tier >= 3 && (s.fear || 0) >= 45) {
      return { ok: false, why: 'Keine Genehmigungsbehörde unterschreibt für dich bei ' +
        Math.round(s.fear) + ' Furcht. Diese Tür schließt sich oberhalb von 45.' };
    }
    var dist = D.byId(D.DISTRICTS, districtId);
    if (def.tier > dist.tier + 1) return { ok: false, why: 'Dieser Bezirk trägt keinen Betrieb dieser Größe.' };
    /* Ein Bezirk traegt nur so viele Betriebe, wie man dort Rueckhalt
       hat. Ohne diese Grenze wird das Spaetspiel zum Kaufknopf-Druecken:
       die Simulation lief auf 123 Standorte, was nichts mehr entscheidet.
       Jetzt ist Einfluss die Voraussetzung fuer Wachstum, nicht Beiwerk. */
    var here = s.businesses.filter(function (b) { return b.district === districtId; }).length;
    var room = maxBusinesses(s, districtId, rang);
    if (here >= room) {
      return { ok: false, why: 'Du kannst hier ' + room + ' Betriebe tragen. ' +
        'Bau hier Einfluss auf, um Platz für mehr zu schaffen.' };
    }

    /* Ein Betriebstyp zweimal im selben Bezirk verwaessert sich. */
    var same = s.businesses.filter(function (b) { return b.district === districtId && b.type === typeId; }).length;
    if (same >= 2) return { ok: false, why: 'Zwei davon in einem Bezirk sind schon einer zu viel.' };
    var cost = St.buyCost(districtId, typeId) * (same ? 1.35 : 1);
    cost = Math.round(cost);
    if (s.cash < cost) return { ok: false, why: 'Benötigt ' + U.money(cost) + '.' };
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
    if (!b) return { ok: false, why: 'Unbekannter Betrieb.' };
    if (b.level >= D.UPGRADE.max) return { ok: false, why: 'Bereits auf der höchsten Stufe.' };
    var cost = St.upgradeCost(s, b);
    if (s.cash < cost) return { ok: false, why: 'Benötigt ' + U.money(cost) + '.' };
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
    if (!b) return { ok: false, why: 'Unbekannter Betrieb.' };
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
    if (!up) return { ok: false, why: 'Unbekannt.' };
    var lv = s.org[upId] || 0;
    if (lv >= up.max) return { ok: false, why: 'Vollständig ausgebaut.' };
    var cost = up.cost[lv];
    if (s.cash < cost) return { ok: false, why: 'Benötigt ' + U.money(cost) + '.' };
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
      { id: 'counsel', name: 'Anwälte einschalten', cost: Math.round(base * 0.55),
        heat: -9, rep: 0,
        desc: 'Anwälte stellen Anträge, verzögern und verlieren Akten. Langsam, sauber, teuer.' },
      { id: 'grease', name: 'Hände schmieren', cost: Math.round(base * 1.1),
        heat: -19, rep: -3,
        desc: 'Umschläge erreichen die richtigen Schreibtische. Es wirkt, und man weiß, dass es gewirkt hat.' },
      { id: 'laylow', name: 'Untertauchen', cost: 0, heat: -14, rep: -1, shut: 7,
        desc: 'Schließe jeden Untergrundbetrieb für eine Woche. Kein schmutziges Geld, keine neue Aufmerksamkeit.' }
    ];
  }

  function doHeatAction(s, id) {
    var act = null, list = heatActions(s);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) act = list[i];
    if (!act) return { ok: false, why: 'Unbekannte Aktion.' };
    if (s.cash < act.cost) return { ok: false, why: 'Benötigt ' + U.money(act.cost) + '.' };
    if (act.shut && s.flags.layLowUntil > s.day) return { ok: false, why: 'Du tauchst bereits unter.' };
    s.cash -= act.cost;
    s.stats.spent += act.cost;
    s.heat = U.clamp(s.heat + act.heat, 0, 100);
    s.rep = U.clamp(s.rep + act.rep, 0, 100);
    if (act.shut) s.flags.layLowUntil = s.day + act.shut;
    return { ok: true, act: act };
  }

  CE.empire = {
    maxBusinesses: maxBusinesses, canOpenDistrict: canOpenDistrict, openDistrict: openDistrict, entryCost: entryCost,
    canMuscleIn: canMuscleIn, muscleIn: muscleIn,
    canBuy: canBuy, buy: buy, canUpgrade: canUpgrade, upgrade: upgrade, sell: sell,
    canUpgradeOrg: canUpgradeOrg, upgradeOrg: upgradeOrg,
    heatActions: heatActions, doHeatAction: doHeatAction
  };
})(typeof window !== 'undefined' ? window : globalThis);
