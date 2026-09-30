/* ---------------------------------------------------------------------
   Operationen: die kleinen Auftraege, aus denen der Anfang besteht.

   Warum es sie gibt: ein Verwaltungsspiel, das mit "kauf einen Betrieb"
   beginnt, hat in der ersten Viertelstunde nichts zu entscheiden. Die
   Auftraege schliessen die Luecke und bleiben spaeter relevant, weil sie
   Einfluss bringen - die einzige Waehrung, die man nicht kaufen kann.

   Eine Operation kostet das Knappste, was man hat: Leute und Zeit. Wer
   drei Leute auf einen Auftrag setzt, hat sie tagelang nicht im Betrieb.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* Wie viele Auftraege ein Bezirk gleichzeitig bietet. */
  function offerCount(tier) { return tier >= 3 ? 4 : (tier === 2 ? 3 : 3); }

  /* Auftragsliste eines Bezirks neu wuerfeln. Laeuft woechentlich. */
  function refreshOffers(s, rng, districtId) {
    var dist = D.byId(D.DISTRICTS, districtId);
    var dd = s.districts[districtId];
    if (!dd.open) { s.offers[districtId] = []; return; }

    var pool = D.OPS.filter(function (o) {
      if (o.id === 'contract' && dist.tier < 2) return false;
      if (o.id === 'smugrun' && districtId !== 'harbor' && districtId !== 'industrial') return false;
      if (o.id === 'blackmail' && dist.tier < 2) return false;
      if (o.id === 'launder' && s.businesses.length === 0) return false;
      return true;
    });
    rng.shuffle(pool);

    var list = [], n = offerCount(dist.tier);
    for (var i = 0; i < n && i < pool.length; i++) list.push(makeOffer(s, rng, pool[i], districtId));
    s.offers[districtId] = list;
  }

  function makeOffer(s, rng, tmpl, districtId) {
    var dist = D.byId(D.DISTRICTS, districtId);
    var tierMul = [1, 1, 2.15, 3.8][dist.tier];
    var vary = rng.range(0.85, 1.2);
    var pay = Math.round(tmpl.pay * tierMul * vary * dist.econ / 50) * 50;
    var risk = U.clamp(tmpl.risk * (0.85 + dist.tier * 0.09) * rng.range(0.9, 1.12), 0.05, 0.62);

    /* Ein Rivale sitzt manchmal auf dem Auftrag. Das kostet Beziehung,
       bringt aber deutlich mehr Einfluss. */
    var against = null;
    if (tmpl.hostile || rng.chance(0.18)) {
      var cands = s.rivals.filter(function (r) { return r.infl[districtId] > 8 && !r.allied; });
      if (cands.length) against = rng.pick(cands).id;
    }

    return {
      id: U.nextId(s, 'o'),
      type: tmpl.id, name: tmpl.name, desc: tmpl.desc, district: districtId,
      days: Math.max(1, Math.round(tmpl.days * rng.range(0.85, 1.15))),
      pay: pay, risk: risk, heat: tmpl.heat * dist.lawEye,
      rep: tmpl.rep, infl: tmpl.infl * (against ? 1.6 : 1),
      crewNeed: tmpl.crew + (dist.tier >= 3 ? 1 : 0),
      against: against, expires: s.day + 7
    };
  }

  /* Erfolgsaussicht - wird dem Spieler *vor* dem Start gezeigt, sonst
     waere die Entscheidung keine. */
  function odds(s, offer, crewIds) {
    var d = St.derive(s);
    var base = 1 - offer.risk;
    var skillSum = 0, bonus = 0, n = 0;
    for (var i = 0; i < crewIds.length; i++) {
      var c = U.byId(s.crew, crewIds[i]);
      if (!c) continue;
      n++;
      var eff = St.effectiveSkill(c);
      skillSum += eff;
      var role = D.byId(D.ROLES, c.role);
      bonus += (role.opBonus || 0);
      bonus += CE.crew.traitMod(c, 'opBonus');
      bonus += (c.loyalty - 50) / 900;
    }
    /* Faehigkeit 4 ist der Nullpunkt: brauchbar, aber kein Vorteil.
       Erst darueber zahlt sich ein teurer Kopf aus, darunter merkt man es. */
    var avg = n ? skillSum / n : 0;
    var p = base + (avg - 4) * 0.030 + bonus + (d.opBonusUpgrade || 0);
    p += (s.districts[offer.district].mine / 100) * 0.13;
    p -= (s.heat / 100) * 0.16;
    if (n < offer.crewNeed) p -= (offer.crewNeed - n) * 0.22;
    return U.clamp(p, 0.04, 0.93);
  }

  function duration(s, offer, crewIds) {
    var d = St.derive(s);
    var speed = d.opSpeedUpgrade || 0;
    for (var i = 0; i < crewIds.length; i++) {
      var c = U.byId(s.crew, crewIds[i]);
      if (c) speed += (D.byId(D.ROLES, c.role).opSpeed || 0);
    }
    return Math.max(1, Math.round(offer.days * (1 - U.clamp(speed, 0, 0.55))));
  }

  function available(s) {
    var out = [];
    for (var i = 0; i < s.crew.length; i++) {
      var c = s.crew[i];
      if (c.busyUntil > s.day) continue;
      out.push(c);
    }
    return out;
  }

  function start(s, offerId, crewIds) {
    var offer = null, dk;
    for (dk in s.offers) {
      var f = U.byId(s.offers[dk] || [], offerId);
      if (f) { offer = f; break; }
    }
    if (!offer) return { ok: false, why: 'That job is gone.' };
    if (!crewIds.length) return { ok: false, why: 'Send somebody.' };
    for (var i = 0; i < crewIds.length; i++) {
      var c = U.byId(s.crew, crewIds[i]);
      if (!c) return { ok: false, why: 'Unknown crew member.' };
      if (c.busyUntil > s.day) return { ok: false, why: c.name + ' is already out.' };
    }
    var dur = duration(s, offer, crewIds);
    var p = odds(s, offer, crewIds);

    for (i = 0; i < crewIds.length; i++) U.byId(s.crew, crewIds[i]).busyUntil = s.day + dur;

    var run = {
      id: U.nextId(s, 'run'), offer: JSON.parse(JSON.stringify(offer)),
      crew: crewIds.slice(), started: s.day, ends: s.day + dur, odds: p
    };
    s.ops.push(run);
    s.offers[offer.district] = s.offers[offer.district].filter(function (o) { return o.id !== offerId; });
    s.stats.opsRun++;
    return { ok: true, run: run };
  }

  /* Faellige Auftraege abrechnen. Wird taeglich aufgerufen. */
  function resolveDue(s, rng, report) {
    var done = [];
    for (var i = s.ops.length - 1; i >= 0; i--) {
      var run = s.ops[i];
      if (run.ends > s.day) continue;
      s.ops.splice(i, 1);
      done.push(resolve(s, rng, run, report));
    }
    return done;
  }

  function resolve(s, rng, run, report) {
    var o = run.offer;
    var win = rng.chance(run.odds);
    var dist = D.byId(D.DISTRICTS, o.district);
    var names = run.crew.map(function (id) {
      var c = U.byId(s.crew, id); return c ? c.name : 'someone';
    });
    var res = { run: run, win: win, cash: 0, rep: 0, heat: 0, infl: 0, text: '' };

    if (win) {
      s.stats.opsWon++;
      var netzBonus = 1 + (St.derive(s).opPayBonus || 0);
      res.cash = Math.round(o.pay * rng.range(0.94, 1.14) * netzBonus);
      res.rep = o.rep;
      res.heat = o.heat * 0.55 * (s.mods ? s.mods.heat : 1);
      res.infl = o.infl;
      s.cash += res.cash;
      s.stats.earned += res.cash;
      s.rep = U.clamp(s.rep + res.rep, 0, 100);
      s.heat = U.clamp(s.heat + res.heat, 0, 100);
      s.districts[o.district].mine = U.clamp(s.districts[o.district].mine + res.infl, 0, 100);
      res.text = o.name + ' in ' + dist.name + ' paid out ' + U.money(res.cash) + '.';
      if (o.against) {
        var r = U.byId(s.rivals, o.against);
        if (r) {
          r.infl[o.district] = Math.max(0, r.infl[o.district] - res.infl * 0.8);
          r.relation = U.clamp(r.relation - 9, -100, 100);
          /* Nur der offen gewaltsame Auftrag macht Furcht, und wenig.
             Vorher zaehlte jeder Auftrag, der zufaellig gegen einen
             Rivalen lief - bei 1.200 Auftraegen je Partie stand am Ende
             auch der vorsichtige Spieler bei 98 Furcht. Furcht soll aus
             Entscheidungen kommen, nicht aus Betriebsamkeit. */
          /* Nur dieser eine Auftragstyp, dafuer spuerbar: er ist die
             Einstiegsrampe. Ohne ihn war die aggressive Spielweise gar
             nicht erreichbar - man braucht Furcht 18 fuer die erste
             Forderung, und die einzige andere Quelle (Druck auf einen
             Rivalen) setzt eine Organisation voraus, die man ohne
             Aggression erst spaet hat. Henne und Ei. */
          if (o.type === 'raid') CE.fear.add(s, 1.2, 'muscled a rival corner');
          res.text += ' ' + D.byId(D.RIVALS, r.id).name + ' lost ground and noticed.';
        }
      }
      for (var i = 0; i < run.crew.length; i++) {
        var c = U.byId(s.crew, run.crew[i]);
        if (c) { c.xp += 26; c.loyalty = U.clamp(c.loyalty + 2.5, 0, 100); }
      }
    } else {
      /* Scheitern kostet, aber nie alles - sonst wird jeder Auftrag zur
         Zitterpartie statt zur Abwaegung. */
      res.cash = -Math.round(o.pay * rng.range(0.12, 0.3));
      res.heat = o.heat * rng.range(1.2, 2.0) * (s.mods ? s.mods.heat : 1);
      if (res.heat < 1) res.heat = 1;
      res.rep = -Math.max(1, Math.round(o.rep * 0.8));
      s.cash += res.cash;
      s.heat = U.clamp(s.heat + res.heat, 0, 100);
      s.rep = U.clamp(s.rep + res.rep, 0, 100);
      res.text = o.name + ' in ' + dist.name + ' fell apart. ' + U.money(-res.cash) +
                 ' gone, heat +' + res.heat.toFixed(1) + '.';
      for (i = 0; i < run.crew.length; i++) {
        var c2 = U.byId(s.crew, run.crew[i]);
        if (c2) { c2.xp += 9; c2.loyalty = U.clamp(c2.loyalty - 3, 0, 100); }
      }
      /* Ein Mann kann verletzt ausfallen - selten, und nie der Spieler. */
      if (rng.chance(0.14)) {
        /* Nur wer noch da ist, kann verletzt werden. crew.remove() haelt
           run.crew sauber, aber ein geladener Altstand koennte eine
           Kennung enthalten, die es nicht mehr gibt. */
        var pool = run.crew.filter(function (id) {
          return id !== 'you' && U.byId(s.crew, id);
        });
        if (pool.length) {
          var hurt = U.byId(s.crew, rng.pick(pool));
          hurt.busyUntil = s.day + rng.int(5, 12);
          hurt.hurt = hurt.busyUntil;
          res.text += ' ' + hurt.name + ' is laid up until day ' + hurt.busyUntil + '.';
        }
      }
    }
    if (report) report.push({ t: win ? 'good' : 'bad', text: res.text, crew: names.join(', ') });
    return res;
  }

  /* Abgelaufene Angebote entfernen. */
  function expire(s) {
    for (var k in s.offers) {
      var list = s.offers[k] || [];
      s.offers[k] = list.filter(function (o) { return o.expires > s.day; });
    }
  }

  function allOffers(s) {
    var out = [];
    for (var k in s.offers) out = out.concat(s.offers[k] || []);
    return out;
  }

  CE.ops = {
    refreshOffers: refreshOffers, odds: odds, duration: duration, start: start,
    resolveDue: resolveDue, expire: expire, available: available, allOffers: allOffers
  };
})(typeof window !== 'undefined' ? window : globalThis);
