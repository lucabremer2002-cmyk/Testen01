/**
 * Kooperationsvereine.
 *
 * Ein grosser Verein und ein kleiner schliessen sich zusammen: Der
 * kleine bekommt Geld und Spieler, der grosse einen Ort, an dem seine
 * Talente wirklich spielen - und das erste Wort, wenn dort jemand
 * auffaellt.
 *
 * Die Partnerschaft ist keine Einbahnstrasse: Der kleine Verein sagt
 * nur zu, wenn der Abstand stimmt. Ein Zweitligist wird nicht
 * Juniorpartner eines anderen Zweitligisten.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var P = FM.players;
  var F = FM.finance;

  var MIN_RUF_ABSTAND = 12;      // so viel muss der grosse Verein voraus sein
  var MAX_PARTNER = 2;

  function liste(world) {
    if (!world.kooperationen) world.kooperationen = [];
    return world.kooperationen;
  }

  /** Alle Partnerschaften eines Vereins - als grosser wie als kleiner. */
  function partnerVon(world, clubId) {
    return liste(world).filter(function (k) {
      return k.clubId === clubId || k.partnerId === clubId;
    });
  }

  function istPartner(world, aId, bId) {
    return liste(world).some(function (k) {
      return (k.clubId === aId && k.partnerId === bId) ||
        (k.clubId === bId && k.partnerId === aId);
    });
  }

  /** Die jaehrliche Gebuehr, die der grosse Verein zahlt. */
  function gebuehrFuer(world, partnerId) {
    var partner = world.vereine[partnerId];
    if (!partner) return 0;
    return Math.round((120000 + partner.ruf * 9000) / 10000) * 10000;
  }

  /**
   * Prueft, ob ein Verein eine Partnerschaft eingehen wuerde.
   * Rueckgabe: { moeglich, grund }
   */
  function pruefePartner(world, clubId, partnerId) {
    var club = world.vereine[clubId];
    var partner = world.vereine[partnerId];
    if (!club || !partner) return { moeglich: false, grund: 'Verein unbekannt.' };
    if (clubId === partnerId) return { moeglich: false, grund: 'Das ist derselbe Verein.' };
    if (partner.auslaendisch) return { moeglich: false, grund: 'Nur Vereine aus dem deutschen Ligasystem.' };
    if (istPartner(world, clubId, partnerId)) {
      return { moeglich: false, grund: 'Es besteht bereits eine Partnerschaft.' };
    }
    if (partnerVon(world, clubId).length >= MAX_PARTNER) {
      return { moeglich: false, grund: 'Mehr als ' + MAX_PARTNER + ' Partnerschaften führt kein Verein.' };
    }
    if (partnerVon(world, partnerId).length >= MAX_PARTNER) {
      return { moeglich: false, grund: partner.name + ' unterhält bereits genug Partnerschaften.' };
    }
    if (partner.liga < club.liga) {
      return { moeglich: false, grund: partner.name + ' spielt höher und käme nicht infrage.' };
    }
    if (club.ruf - partner.ruf < MIN_RUF_ABSTAND) {
      return { moeglich: false, grund: partner.name + ' sieht sich nicht als Juniorpartner.' };
    }
    return { moeglich: true };
  }

  /** Schliesst eine Partnerschaft. */
  function anbieten(world, clubId, partnerId) {
    var pruef = pruefePartner(world, clubId, partnerId);
    if (!pruef.moeglich) return { fehler: pruef.grund };

    var gebuehr = gebuehrFuer(world, partnerId);
    var f = world.finanzen[clubId];
    if (f && f.kontostand < gebuehr) {
      return { fehler: 'Die erste Jahresgebühr von ' + U.money(gebuehr) + ' ist nicht gedeckt.' };
    }

    F.buche(world, clubId, 'aus', 'sonstige', gebuehr,
      'Kooperationsgebühr ' + world.vereine[partnerId].name);
    F.buche(world, partnerId, 'ein', 'sonstige', gebuehr,
      'Kooperationsgebühr ' + world.vereine[clubId].name);

    var eintrag = {
      clubId: clubId, partnerId: partnerId,
      seit: world.tag, naechsteGebuehr: world.tag + 365, gebuehr: gebuehr
    };
    liste(world).push(eintrag);

    if (world.istNutzerVerein(clubId)) {
      world.nachricht({
        typ: 'verein', prioritaet: 2,
        titel: 'Kooperation mit ' + world.vereine[partnerId].name,
        text: 'Die Partnerschaft steht. Sie können Talente ohne Verhandlung dorthin verleihen ' +
          'und haben das erste Wort, wenn dort ein Spieler auffällt. Jahresgebühr: ' +
          U.money(gebuehr) + '.'
      });
    }
    return { ok: true, kooperation: eintrag };
  }

  function beenden(world, clubId, partnerId) {
    world.kooperationen = liste(world).filter(function (k) {
      return !((k.clubId === clubId && k.partnerId === partnerId) ||
        (k.clubId === partnerId && k.partnerId === clubId));
    });
    return { ok: true };
  }

  /** Vereine, die als Partner infrage kaemen, beste zuerst. */
  function kandidaten(world, clubId) {
    var raus = [];
    world.vereinIds.forEach(function (id) {
      var pruef = pruefePartner(world, clubId, id);
      if (!pruef.moeglich) return;
      var partner = world.vereine[id];
      raus.push({
        clubId: id, name: partner.name, liga: partner.liga, ruf: partner.ruf,
        akademie: partner.akademie, gebuehr: gebuehrFuer(world, id)
      });
    });
    return U.sortBy(raus, function (k) { return -(k.ruf + k.akademie * 0.4); });
  }

  // ------------------------------------------------------------ Wirkung

  /**
   * Jahresgebuehr abrechnen und den Partner am Erfolg teilhaben lassen.
   * Laeuft im Wochenrhythmus.
   */
  function wochenlauf(world) {
    liste(world).slice().forEach(function (k) {
      if (world.tag < k.naechsteGebuehr) return;
      var gebuehr = gebuehrFuer(world, k.partnerId);
      var f = world.finanzen[k.clubId];
      if (!f || f.kontostand < gebuehr) {
        // Wer nicht zahlt, verliert die Partnerschaft.
        beenden(world, k.clubId, k.partnerId);
        if (world.istNutzerVerein(k.clubId)) {
          world.nachricht({
            typ: 'verein', prioritaet: 3,
            titel: 'Kooperation beendet',
            text: 'Die Jahresgebühr an ' + world.vereine[k.partnerId].name +
              ' konnte nicht aufgebracht werden. Die Partnerschaft ist aufgelöst.'
          });
        }
        return;
      }
      F.buche(world, k.clubId, 'aus', 'sonstige', gebuehr,
        'Kooperationsgebühr ' + world.vereine[k.partnerId].name);
      F.buche(world, k.partnerId, 'ein', 'sonstige', gebuehr,
        'Kooperationsgebühr ' + world.vereine[k.clubId].name);
      k.gebuehr = gebuehr;
      k.naechsteGebuehr = world.tag + 365;
    });
  }

  /**
   * Erstzugriff: Faellt beim Partner ein Talent auf, meldet er sich
   * zuerst beim grossen Verein - und zwar mit Rabatt.
   */
  function erstzugriffPruefen(world) {
    var rng = world.rng;
    liste(world).forEach(function (k) {
      if (!world.istNutzerVerein(k.clubId)) return;
      if (!rng.chance(0.05)) return;
      var kader = world.kaderVon(k.partnerId);
      var talente = kader.filter(function (p) {
        return p.alter <= 21 && p.potenzial >= P.gesamt(p) + 8 &&
          p.potenzial >= 62 && !p.gemeldetErstzugriff;
      });
      if (!talente.length) return;
      var p = U.sortBy(talente, function (x) { return -x.potenzial; })[0];
      p.gemeldetErstzugriff = true;
      p.scoutwissen = 1;
      world.nachricht({
        typ: 'scouting', prioritaet: 3,
        titel: 'Erstzugriff: ' + p.vorname + ' ' + p.nachname,
        text: world.vereine[k.partnerId].name + ' meldet sich zuerst bei Ihnen. ' +
          p.nachname + ' (' + p.alter + ', ' + p.pos + ') gilt dort als das größte Talent. ' +
          'Als Partner zahlen Sie 25 Prozent weniger Ablöse.',
        spielerId: p.id
      });
    });
  }

  /** Der Rabatt, den ein Partner auf die Ablöse gewaehrt. */
  function ablöseRabatt(world, kaeuferId, verkaeuferId) {
    return istPartner(world, kaeuferId, verkaeuferId) ? 0.75 : 1;
  }

  /**
   * Eine Leihe zum Partner geht ohne Verhandlung durch - dafuer ist er
   * der Partner. Der Spieler bekommt dort eine Einsatzgarantie.
   */
  function leiheZumPartner(world, spielerId, partnerId) {
    var p = world.spieler[spielerId];
    if (!p) return { fehler: 'Spieler nicht gefunden.' };
    if (!p.clubId || !istPartner(world, p.clubId, partnerId)) {
      return { fehler: 'Mit diesem Verein besteht keine Partnerschaft.' };
    }
    if (p.leihe) return { fehler: p.nachname + ' ist bereits verliehen.' };
    var partner = world.vereine[partnerId];
    if (world.kaderVon(partnerId).length >= 30) {
      return { fehler: partner.name + ' hat keinen Kaderplatz frei.' };
    }
    FM.transfers.fuehreLeiheDurch(world, p, partnerId, {
      bis: world.tag + 330,
      gehaltsanteil: 0.35,
      gebuehr: 0,
      einsatzgarantie: 60
    });
    return { ok: true, name: p.vorname + ' ' + p.nachname, partner: partner.name };
  }

  FM.kooperation = {
    partnerVon: partnerVon,
    istPartner: istPartner,
    pruefePartner: pruefePartner,
    anbieten: anbieten,
    beenden: beenden,
    kandidaten: kandidaten,
    gebuehrFuer: gebuehrFuer,
    wochenlauf: wochenlauf,
    erstzugriffPruefen: erstzugriffPruefen,
    ablöseRabatt: ablöseRabatt,
    leiheZumPartner: leiheZumPartner,
    MAX_PARTNER: MAX_PARTNER
  };

})(typeof window !== 'undefined' ? window : globalThis);
