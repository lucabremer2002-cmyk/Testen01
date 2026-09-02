/* transfers.js - Bewertungen, Transfer- und Vertragsverhandlungen, Leihgeschäfte.
 *
 * Leitgedanke: Der Spieler soll vor jedem Angebot wissen, woran er ist.
 * Deshalb liefert dossier() eine vollständige Einschätzung, und jede Antwort
 * benennt die Abweichung in Prozent statt nur "zu wenig".
 */
(function (g) {
  'use strict';

  var ROLLEN = [
    { id: 'star', name: 'Unverzichtbarer Star', faktor: 1.55, erwartung: 1.00 },
    { id: 'stamm', name: 'Stammspieler', faktor: 1.22, erwartung: 0.78 },
    { id: 'rotation', name: 'Rotationsspieler', faktor: 1.00, erwartung: 0.50 },
    { id: 'ergaenzung', name: 'Ergänzungsspieler', faktor: 0.86, erwartung: 0.28 },
    { id: 'talent', name: 'Talent für die Zukunft', faktor: 0.78, erwartung: 0.20 }
  ];

  var VERTRAGSDAUER = [1, 2, 3, 4, 5];
  var zaehler = 0;

  /* ================= Bewertungen ================= */

  /* Bedeutung eines Spielers für seinen Verein, 0 bis 1. */
  function wichtigkeit(spieler, kader) {
    if (!kader || !kader.length) return 0.5;
    var gleiche = kader.filter(function (p) {
      return Players.GRUPPE[p.pos] === Players.GRUPPE[spieler.pos];
    }).sort(function (a, b) { return b.staerke - a.staerke; });
    var rangGruppe = gleiche.indexOf(spieler);
    var sortiert = kader.slice().sort(function (a, b) { return b.staerke - a.staerke; });
    var rangGesamt = sortiert.indexOf(spieler);
    var w = 1 - Util.clamp(rangGesamt / Math.max(1, kader.length - 1), 0, 1);
    if (rangGruppe === 0) w = Math.min(1, w + 0.22);
    if (rangGruppe > 2) w = Math.max(0, w - 0.18);
    return Util.clamp(w, 0, 1);
  }

  function wichtigkeitText(w) {
    if (w >= 0.85) return 'unverzichtbar';
    if (w >= 0.65) return 'gesetzt';
    if (w >= 0.42) return 'Rotationsspieler';
    if (w >= 0.22) return 'Ergänzungsspieler';
    return 'außen vor';
  }

  /* Ablöseforderung des abgebenden Vereins. */
  function forderung(spieler, kader, verkaeuferKlub, kaeuferKlub, saison) {
    var mw = spieler.marktwert;
    var f = 1.15;
    var w = wichtigkeit(spieler, kader);
    f += w * 0.85;
    var rest = spieler.vertragBis - saison;
    if (rest >= 4) f += 0.30;
    else if (rest === 3) f += 0.15;
    else if (rest === 1) f -= 0.28;
    else if (rest <= 0) f -= 0.75;
    if (spieler.transferliste) f -= 0.32;
    if (spieler.wechselwunsch) f -= 0.22;
    if (spieler.alter <= 21 && spieler.potenzial - spieler.staerke > 8) f += 0.35;
    if (spieler.alter >= 32) f -= 0.22;
    var rufDiff = (verkaeuferKlub.ruf - (kaeuferKlub ? kaeuferKlub.ruf : 50)) / 100;
    f += Util.clamp(rufDiff, -0.25, 0.45);
    f = Util.clamp(f, 0.35, 3.4);
    return Math.max(5000, Math.round(mw * f / 5000) * 5000);
  }

  /* Wechselbereitschaft des Spielers, 0 bis 1. */
  function wechselbereitschaft(spieler, altKlub, neuKlub, kader, saison) {
    var s = 0.35;
    s += (neuKlub.ruf - altKlub.ruf) / 100 * 1.25;
    var rest = spieler.vertragBis - saison;
    if (rest <= 0) s += 0.35; else if (rest === 1) s += 0.18; else if (rest >= 4) s -= 0.12;
    if (spieler.transferliste) s += 0.30;
    if (spieler.wechselwunsch) s += 0.35;
    if (kader) s += (0.45 - wichtigkeit(spieler, kader)) * 0.55;
    if (spieler.alter >= 31) s -= 0.10;
    if (spieler.moral < 45) s += 0.15;
    return Util.clamp(s, 0.02, 0.98);
  }

  function interesseText(b) {
    if (b >= 0.75) return 'drängt auf den Wechsel';
    if (b >= 0.55) return 'sehr aufgeschlossen';
    if (b >= 0.38) return 'gesprächsbereit';
    if (b >= 0.20) return 'zurückhaltend';
    return 'lehnt einen Wechsel derzeit ab';
  }

  /* Gehaltsforderung für einen neuen Vertrag. */
  function gehaltsforderung(spieler, klub, rolleId, jahre, istVerlaengerung) {
    var rolle = Util.byId(ROLLEN, rolleId) || ROLLEN[2];
    var basis = Players.gehaltsBasis(spieler.staerke, klub.ruf, spieler.alter,
      klub.international ? 1 : klub.stufe);
    var f = rolle.faktor;
    if (spieler.alter >= 30) f *= 1.08;
    if (spieler.alter <= 21) f *= 0.88;
    if (spieler.form > 70) f *= 1.06;
    if (jahre >= 4) f *= 0.96;
    if (jahre <= 1) f *= 1.10;
    var wunsch = basis * f;
    wunsch = Math.max(wunsch, spieler.gehalt * (istVerlaengerung ? 1.06 : 1.02));
    return Math.round(wunsch / 10) * 10;
  }

  function handgeldforderung(spieler, gehaltWoche, jahre) {
    var basis = gehaltWoche * 52 * 0.28;
    if (!spieler.klubId) basis *= 1.8;
    if (spieler.alter >= 30) basis *= 0.8;
    return Math.round(basis * (0.7 + jahre * 0.08) / 1000) * 1000;
  }

  function wunschLaufzeit(spieler) {
    return spieler.alter >= 31 ? 2 : (spieler.alter <= 22 ? 4 : 3);
  }

  /* Welche Rolle der Spieler im neuen Kader erwartet. */
  function rollenerwartung(spieler, kaderNeu) {
    if (!kaderNeu || !kaderNeu.length) return 'rotation';
    var w = wichtigkeit(spieler, kaderNeu.concat([spieler]));
    if (w >= 0.85) return 'star';
    if (w >= 0.62) return 'stamm';
    if (w >= 0.38) return 'rotation';
    return spieler.alter <= 21 ? 'talent' : 'ergaenzung';
  }

  /* ================= Dossier vor der Verhandlung ================= */

  function dossier(state, spieler, kaeufer) {
    var verkaeufer = spieler.klubId ? state.klubs[spieler.klubId] : null;
    var kaderAlt = verkaeufer ? Game.kaderVon(state, verkaeufer) : [];
    var kaderNeu = Game.kaderVon(state, kaeufer);
    var rest = spieler.vertragBis - state.saison;
    var w = verkaeufer ? wichtigkeit(spieler, kaderAlt) : 0;
    var bereit = verkaeufer ? wechselbereitschaft(spieler, verkaeufer, kaeufer, kaderAlt, state.saison) : 0.9;
    var ford = verkaeufer ? forderung(spieler, kaderAlt, verkaeufer, kaeufer, state.saison) : 0;
    var rolle = rollenerwartung(spieler, kaderNeu);
    var jahre = wunschLaufzeit(spieler);
    var gehalt = gehaltsforderung(spieler, kaeufer, rolle, jahre, false);

    var hinweise = [];
    if (!verkaeufer) hinweise.push('Der Spieler ist vereinslos – es fällt keine Ablöse an.');
    if (rest <= 0) hinweise.push('Sein Vertrag läuft am Saisonende aus. Der Verein verhandelt deshalb weich.');
    else if (rest === 1) hinweise.push('Nur noch ein Jahr Vertrag – das drückt die Forderung spürbar.');
    else if (rest >= 4) hinweise.push('Langfristig gebunden (bis ' + spieler.vertragBis + '). Der Verein sitzt am längeren Hebel.');
    if (spieler.transferliste) hinweise.push('Er steht auf der Transferliste und soll den Verein verlassen.');
    if (spieler.wechselwunsch) hinweise.push('Er hat selbst um einen Wechsel gebeten.');
    if (w >= 0.8 && verkaeufer) hinweise.push('Für ' + verkaeufer.name + ' ist er ' + wichtigkeitText(w) + ' – unter der vollen Forderung wird es nichts.');
    if (spieler.alter <= 21 && spieler.potenzial - spieler.staerke > 10) {
      hinweise.push('Großes Entwicklungspotenzial – der abgebende Verein lässt sich das bezahlen.');
    }
    if (spieler.alter >= 32) hinweise.push('Mit ' + spieler.alter + ' Jahren ist der Marktwert im Sinkflug.');
    if (spieler.verletztBis > state.tag) {
      hinweise.push('Aktuell verletzt: fällt noch rund ' + (spieler.verletztBis - state.tag) + ' Tage aus.');
    }
    if (bereit < 0.2) hinweise.push('Der Berater winkt ab: Ein Wechsel zu Ihnen ist für den Spieler derzeit kein Thema.');
    else if (bereit > 0.72) hinweise.push('Der Spieler würde sofort unterschreiben – nutzen Sie das im Gespräch.');

    if (verkaeufer) {
      var aufschlag = ford / Math.max(1, spieler.marktwert);
      if (aufschlag >= 1.9) {
        hinweise.push('Die Forderung liegt beim ' + aufschlag.toFixed(1).replace('.', ',') +
          '-fachen des Marktwerts – ein sportlich teurer Transfer.');
      } else if (aufschlag <= 1.15) {
        hinweise.push('Die Forderung liegt nur knapp über dem Marktwert – ein fairer Preis.');
      } else {
        hinweise.push('Die Forderung entspricht dem ' + aufschlag.toFixed(1).replace('.', ',') +
          '-fachen des Marktwerts, also dem üblichen Rahmen.');
      }
    }

    var budget = kaeufer.finanzen.transferbudget;
    if (ford > budget) {
      hinweise.push('Die Forderung übersteigt Ihr Transferbudget um ' + Fmt.money(ford - budget) +
        '. Mit Raten und Boni kommen Sie trotzdem ins Geschäft – oder Sie nehmen bei der Bank ' +
        'einen Transferkredit auf, der das Budget direkt erhöht.');
    }

    return {
      verkaeufer: verkaeufer,
      forderung: ford,
      schmerzgrenze: Math.round(ford * 0.87),
      interesse: bereit,
      interesseText: interesseText(bereit),
      wichtigkeit: w,
      wichtigkeitText: wichtigkeitText(w),
      restlaufzeit: rest,
      gehaltswunsch: gehalt,
      handgeldwunsch: handgeldforderung(spieler, gehalt, jahre),
      laufzeitwunsch: jahre,
      rollenwunsch: rolle,
      hinweise: hinweise
    };
  }

  /* ================= Angebotsbewertung ================= */

  /* Was ein angebotener Tauschspieler dem anderen Verein wert ist.
     Ein Spieler, den er sportlich braucht, zählt fast voll - einer, der
     ihm nichts bringt, nur einen Bruchteil. */
  function tauschwert(spieler, kaeuferKlub, kaderKaeufer, niveau) {
    var f = 0.55;
    if (kaderKaeufer && kaderKaeufer.length) {
      var gruppe = kaderKaeufer.filter(function (p) {
        return Players.GRUPPE[p.pos] === Players.GRUPPE[spieler.pos];
      }).sort(function (a, b) { return b.staerke - a.staerke; });
      var soll = { TW: 1, ABW: 4, MIT: 4, ANG: 2 }[Players.GRUPPE[spieler.pos]] || 3;
      var referenz = gruppe.length >= soll ? gruppe[soll - 1] : null;
      /* Verstärkt er die Startelf, ist er deutlich mehr wert. */
      if (!referenz) f += 0.25;
      else f += Util.clamp((spieler.staerke - referenz.staerke) * 0.035, -0.2, 0.28);
      if (gruppe.length >= soll + 3) f -= 0.12;
    }
    if (niveau !== undefined) {
      /* Ein Spieler weit unter dem Niveau des Vereins interessiert nicht. */
      f += Util.clamp((spieler.staerke - niveau) * 0.02, -0.25, 0.12);
    }
    if (spieler.alter <= 22 && spieler.potenzial - spieler.staerke > 8) f += 0.08;
    if (spieler.alter >= 32) f -= 0.12;
    if (spieler.verletztBis) f -= 0.05;
    return Math.round(spieler.marktwert * Util.clamp(f, 0.3, 0.95));
  }

  /* Was ein strukturiertes Angebot dem Verkäufer wirklich wert ist. */
  function angebotsWert(angebot, marktwert) {
    return (angebot.sofort || 0) +
      (angebot.raten || 0) * 0.88 +
      (angebot.bonusEinsaetze || 0) * 0.45 +
      (angebot.bonusAufstieg || 0) * 0.30 +
      (angebot.tauschWert || 0) +
      (angebot.weiterverkauf || 0) / 100 * marktwert * 0.35;
  }

  function angebotGesamt(angebot) {
    return (angebot.sofort || 0) + (angebot.raten || 0) +
           (angebot.bonusEinsaetze || 0) + (angebot.bonusAufstieg || 0) +
           (angebot.tauschWert || 0);
  }

  function verhandlungStarten(state, opt) {
    return {
      id: 'v' + (++zaehler),
      typ: opt.typ,
      spielerId: opt.spielerId,
      vonKlubId: opt.vonKlubId,
      zuKlubId: opt.zuKlubId,
      phase: opt.phase || 'verein',
      runde: 0,
      spielerRunde: 0,
      klima: 72,
      forderung: opt.forderung,
      startForderung: opt.forderung,
      letztesAngebot: null,
      struktur: null,
      historie: [],
      startTag: opt.tag,
      status: 'offen'
    };
  }

  function klimaText(k) {
    if (k >= 75) return 'entspannt';
    if (k >= 55) return 'sachlich';
    if (k >= 35) return 'angespannt';
    if (k >= 18) return 'gereizt';
    return 'kurz vor dem Abbruch';
  }

  /* Antwort des abgebenden Vereins. Benennt immer die Abweichung. */
  function vereinAntwort(rng, v, angebot, spieler, verkaeufer, kader) {
    v.runde++;
    v.letztesAngebot = angebot;
    var wert = angebotsWert(angebot, spieler.marktwert);
    var ford = v.forderung;
    var abweichung = (ford - wert) / Math.max(1, ford);
    var anteilBar = angebotGesamt(angebot) > 0 ? (angebot.sofort || 0) / angebotGesamt(angebot) : 1;

    v.historie.push({
      von: 'kaeufer',
      text: 'Angebot über ' + Fmt.money(angebotGesamt(angebot)) +
        (angebot.raten ? ', davon ' + Fmt.money(angebot.sofort || 0) + ' sofort' : '') +
        (angebot.spieler && angebot.spieler.length
          ? ' – inklusive ' + angebot.spieler.length +
            (angebot.spieler.length === 1 ? ' Tauschspieler' : ' Tauschspielern') : '') + '.'
    });

    /* Das Gesprächsklima leidet unter niedrigen Angeboten. */
    if (abweichung > 0.45) v.klima -= 26;
    else if (abweichung > 0.25) v.klima -= 13;
    else if (abweichung > 0.08) v.klima -= 5;
    else v.klima += 4;
    v.klima = Util.clamp(v.klima, 0, 100);

    if (wert >= ford * 0.97) {
      v.phase = 'spieler';
      v.struktur = angebot;
      v.historie.push({
        von: 'verkaeufer',
        text: 'Einverstanden. Zu diesen Konditionen geben wir ' + spieler.nachname +
          ' ab. Sprechen Sie jetzt mit dem Spieler.'
      });
      return { ok: true, art: 'angenommen', abweichung: abweichung };
    }

    if (v.klima <= 0 || v.runde >= 6) {
      v.phase = 'geplatzt'; v.status = 'geplatzt';
      v.historie.push({ von: 'verkaeufer', text: 'Wir beenden die Gespräche. So kommen wir nicht zusammen.' });
      return { ok: false, art: 'abgebrochen', abweichung: abweichung };
    }

    /* Gegenangebot: Die Forderung sinkt, je näher das Angebot liegt. */
    var nachlass = abweichung < 0.12 ? 0.06 : (abweichung < 0.3 ? 0.035 : 0.015);
    var neueFord = Math.max(wert * 1.04, ford * (1 - nachlass));
    v.forderung = Math.round(neueFord / 5000) * 5000;

    var prozent = Math.round(abweichung * 100);
    var text;
    if (abweichung > 0.4) {
      text = 'Das liegt rund ' + prozent + ' % unter unserer Forderung. Wir sind nicht gezwungen zu verkaufen.';
    } else if (anteilBar < 0.4 && angebot.raten) {
      text = 'Uns fehlen noch etwa ' + prozent + ' %. Vor allem ist uns der Sofortanteil zu klein – ' +
        'Raten sind uns weniger wert als Bargeld.';
    } else if (angebot.tauschWert && angebot.tauschWert > (angebot.sofort || 0) && abweichung > 0.12) {
      text = 'Die angebotenen Spieler helfen uns nur bedingt – so fehlen noch rund ' + prozent +
        ' %. Mit mehr Bargeld ginge es schneller.';
    } else if (abweichung > 0.12) {
      text = 'Wir liegen noch rund ' + prozent + ' % auseinander. Neue Forderung: ' + Fmt.money(v.forderung) + '.';
    } else {
      text = 'Fast am Ziel – es fehlen noch etwa ' + prozent + ' %. Bei ' + Fmt.money(v.forderung) +
        ' wären wir dabei.';
    }
    v.historie.push({ von: 'verkaeufer', text: text });
    return { ok: false, art: 'gegenangebot', forderung: v.forderung, abweichung: abweichung };
  }

  /* ================= Vertragsverhandlung ================= */

  /* Vollständige Vorstellung des Spielers - wird dem Nutzer offen angezeigt. */
  function vertragswunsch(spieler, klub, kaderNeu, istVerlaengerung) {
    var rolle = istVerlaengerung
      ? rollenerwartung(spieler, kaderNeu.filter(function (p) { return p.id !== spieler.id; }))
      : rollenerwartung(spieler, kaderNeu);
    var jahre = wunschLaufzeit(spieler);
    var gehalt = gehaltsforderung(spieler, klub, rolle, jahre, istVerlaengerung);
    return {
      gehalt: gehalt,
      jahre: jahre,
      handgeld: handgeldforderung(spieler, gehalt, jahre),
      rolle: rolle,
      ausstiegsklausel: spieler.staerke >= 70 || spieler.potenzial - spieler.staerke > 12
        ? Math.round(spieler.marktwert * 2.2 / 100000) * 100000 : 0
    };
  }

  function vertragBewerten(spieler, klub, altKlub, vertrag, kaderNeu, saison, istVerlaengerung) {
    var wunsch = vertragswunsch(spieler, klub, kaderNeu, istVerlaengerung);
    var punkte = 0;
    var maengel = [];

    var gq = vertrag.gehalt / Math.max(1, wunsch.gehalt);
    punkte += Util.clamp((gq - 1) * 130, -70, 55);
    if (gq < 0.97) maengel.push({ feld: 'gehalt', text: 'Das Gehalt liegt ' +
      Math.round((1 - gq) * 100) + ' % unter meiner Vorstellung.' });

    var wunschHandgeld = Math.max(1, wunsch.handgeld);
    var hq = (vertrag.handgeld || 0) / wunschHandgeld;
    punkte += Util.clamp((hq - 1) * 22, -18, 18);
    if (hq < 0.8) maengel.push({ feld: 'handgeld', text: 'Beim Handgeld erwarte ich ' +
      Fmt.money(wunsch.handgeld) + '.' });

    var rolleAngeboten = Util.byId(ROLLEN, vertrag.rolle) || ROLLEN[2];
    var rolleErwartet = Util.byId(ROLLEN, wunsch.rolle) || ROLLEN[2];
    punkte += Util.clamp((rolleAngeboten.erwartung - rolleErwartet.erwartung) * 55, -24, 26);
    if (rolleAngeboten.erwartung < rolleErwartet.erwartung - 0.05) {
      maengel.push({ feld: 'rolle', text: 'Ich sehe mich hier als ' + rolleErwartet.name.toLowerCase() + '.' });
    }

    if (!istVerlaengerung && altKlub) {
      punkte += Util.clamp((klub.ruf - altKlub.ruf) * 0.75, -35, 40);
    }
    var jahresAbstand = Math.abs(vertrag.jahre - wunsch.jahre);
    punkte -= jahresAbstand * 5;
    if (jahresAbstand >= 2) maengel.push({ feld: 'jahre', text: 'Ich hätte gern ' + wunsch.jahre + ' Jahre.' });

    if (vertrag.ausstiegsklausel) punkte += 9;
    else if (wunsch.ausstiegsklausel) {
      punkte -= 6;
      maengel.push({ feld: 'klausel', text: 'Eine Ausstiegsklausel wäre mir wichtig.' });
    }
    if (spieler.moral < 40 && istVerlaengerung) punkte -= 12;

    return { punkte: punkte, wunsch: wunsch, maengel: maengel };
  }

  function spielerAntwort(rng, v, vertrag, spieler, klub, altKlub, kaderNeu, saison, istVerlaengerung) {
    var b = vertragBewerten(spieler, klub, altKlub, vertrag, kaderNeu, saison, istVerlaengerung);
    v.spielerRunde++;
    var schwelle = 6 - v.spielerRunde * 1.6 + rng.float(-3, 3);

    v.historie.push({
      von: 'kaeufer',
      text: 'Vertragsangebot: ' + Fmt.money(vertrag.gehalt) + ' pro Woche, ' + vertrag.jahre +
        ' Jahre, ' + Fmt.money(vertrag.handgeld || 0) + ' Handgeld.'
    });

    if (b.punkte >= schwelle) {
      v.phase = 'fertig';
      v.vertrag = vertrag;
      v.historie.push({ von: 'spieler', text: 'Das passt. Ich unterschreibe.' });
      return { ok: true, art: 'angenommen', bewertung: b };
    }
    if (v.spielerRunde >= 4) {
      v.phase = 'geplatzt'; v.status = 'geplatzt';
      v.historie.push({ von: 'spieler', text: 'Wir drehen uns im Kreis. Ich sage ab.' });
      return { ok: false, art: 'abgebrochen', bewertung: b };
    }

    var text = b.maengel.length
      ? b.maengel.map(function (m) { return m.text; }).join(' ')
      : 'So ganz überzeugt mich das noch nicht.';
    v.historie.push({ von: 'spieler', text: text });
    v.spielerWunsch = b.wunsch;
    return { ok: false, art: 'gegenforderung', wunsch: b.wunsch, bewertung: b };
  }

  /* ================= Leihgeschäfte ================= */

  /* Käme der Spieler beim neuen Verein zu Einsätzen? 0 bis 1. */
  function spielzeitAussicht(spieler, kaderNeu) {
    var gruppe = kaderNeu.filter(function (p) {
      return Players.GRUPPE[p.pos] === Players.GRUPPE[spieler.pos];
    }).sort(function (a, b) { return b.staerke - a.staerke; });
    if (!gruppe.length) return 1;
    var soll = { TW: 1, ABW: 4, MIT: 4, ANG: 2 }[Players.GRUPPE[spieler.pos]] || 3;
    var referenz = gruppe[Math.min(soll - 1, gruppe.length - 1)];
    var diff = spieler.staerke - referenz.staerke;
    return Util.clamp(0.5 + diff * 0.07, 0, 1);
  }

  /* Was der abgebende Verein für eine Leihe erwartet. */
  function leihKonditionen(spieler, kaderAlt, altKlub, neuKlub, saison) {
    var w = wichtigkeit(spieler, kaderAlt);
    var jung = spieler.alter <= 21;
    /* Junge Spieler sollen Spielpraxis sammeln - da zahlt der Heimatverein mit. */
    var anteil = Util.clamp(Math.round((45 + w * 50 - (jung ? 28 : 0)) / 5) * 5, 20, 100);
    var gebuehr = jung ? 0 : Math.round(spieler.marktwert * (0.03 + w * 0.09) / 1000) * 1000;
    return {
      gehaltsanteil: anteil,
      gebuehr: gebuehr,
      kaufoptionVorschlag: Math.round(spieler.marktwert * 1.15 / 10000) * 10000
    };
  }

  /* Bewertet ein konkretes Leihangebot aus beiden Blickwinkeln. */
  function leihBewertung(spieler, kaderAlt, altKlub, neuKlub, kaderNeu, angebot, saison) {
    var soll = leihKonditionen(spieler, kaderAlt, altKlub, neuKlub, saison);
    var w = wichtigkeit(spieler, kaderAlt);
    var gruende = [];

    /* Sicht des abgebenden Vereins */
    var vereinPunkte = 0;
    vereinPunkte += (angebot.gehaltsanteil - soll.gehaltsanteil) * 0.9;
    vereinPunkte += soll.gebuehr > 0
      ? Util.clamp(((angebot.gebuehr || 0) / soll.gebuehr - 1) * 30, -35, 25)
      : Math.min(20, (angebot.gebuehr || 0) / Math.max(1, spieler.marktwert) * 200);
    if (w >= 0.75) { vereinPunkte -= 45; gruende.push('Der Spieler ist im eigenen Kader gesetzt.'); }
    else if (w <= 0.3) { vereinPunkte += 18; gruende.push('Er kommt zu wenig zum Einsatz – eine Leihe hilft beiden Seiten.'); }
    if (spieler.alter <= 21) { vereinPunkte += 22; gruende.push('Ein junger Spieler soll Spielpraxis sammeln.'); }
    if (spieler.alter >= 31) vereinPunkte -= 10;
    if (kaderAlt.length <= 18) { vereinPunkte -= 30; gruende.push('Der Kader ist bereits dünn besetzt.'); }
    if (angebot.kaufoption) vereinPunkte += 6;

    /* Sicht des Spielers */
    var aussicht = spielzeitAussicht(spieler, kaderNeu);
    var spielerPunkte = aussicht * 70 - 25;
    spielerPunkte += (neuKlub.ruf - altKlub.ruf) * 0.35;
    if (spieler.alter <= 21) spielerPunkte += 18;
    if (spieler.alter >= 30) spielerPunkte -= 12;
    if (aussicht < 0.35) gruende.push('Der Spieler fürchtet, auch dort auf der Bank zu sitzen.');

    return {
      soll: soll,
      vereinPunkte: Math.round(vereinPunkte),
      spielerPunkte: Math.round(spielerPunkte),
      vereinOk: vereinPunkte >= 0,
      spielerOk: spielerPunkte >= 0,
      spielzeit: aussicht,
      gruende: gruende
    };
  }

  /* ================= Marktsuche ================= */

  function marktSuche(state, filter) {
    var out = [];
    var alle = Object.keys(state.spieler);
    for (var i = 0; i < alle.length; i++) {
      var p = state.spieler[alle[i]];
      if (p.klubId === state.meinKlubId) continue;
      if (p.jugend || p.leihe) continue;
      if (filter.pos && filter.pos !== 'alle') {
        if (Players.GRUPPE[p.pos] !== filter.pos && p.pos !== filter.pos) continue;
      }
      if (filter.maxAlter && p.alter > filter.maxAlter) continue;
      if (filter.minStaerke && p.staerke < filter.minStaerke) continue;
      if (filter.maxWert && p.marktwert > filter.maxWert) continue;
      if (filter.nation && filter.nation !== 'alle' && p.nation !== filter.nation) continue;
      var klub = p.klubId ? state.klubs[p.klubId] : null;
      if (filter.bereich === 'deutschland' && (!klub || klub.international)) continue;
      if (filter.bereich === 'international' && (!klub || !klub.international)) continue;
      if (filter.bereich === 'ablösefrei' && p.klubId) continue;
      if (filter.bereich === 'liste' && !p.transferliste) continue;
      if (filter.suche) {
        var q = filter.suche.toLowerCase();
        if (p.name.toLowerCase().indexOf(q) < 0 && (!klub || klub.name.toLowerCase().indexOf(q) < 0)) continue;
      }
      out.push(p);
    }
    var sort = filter.sortierung || 'marktwert';
    out.sort(function (a, b) {
      if (sort === 'staerke') return b.staerke - a.staerke;
      if (sort === 'alter') return a.alter - b.alter;
      if (sort === 'potenzial') return b.potenzial - a.potenzial;
      if (sort === 'name') return a.name < b.name ? -1 : 1;
      return b.marktwert - a.marktwert;
    });
    return out;
  }

  g.Transfers = {
    ROLLEN: ROLLEN,
    VERTRAGSDAUER: VERTRAGSDAUER,
    wichtigkeit: wichtigkeit,
    wichtigkeitText: wichtigkeitText,
    forderung: forderung,
    wechselbereitschaft: wechselbereitschaft,
    interesseText: interesseText,
    gehaltsforderung: gehaltsforderung,
    handgeldforderung: handgeldforderung,
    wunschLaufzeit: wunschLaufzeit,
    rollenerwartung: rollenerwartung,
    dossier: dossier,
    verhandlungStarten: verhandlungStarten,
    klimaText: klimaText,
    tauschwert: tauschwert,
    angebotsWert: angebotsWert,
    angebotGesamt: angebotGesamt,
    vereinAntwort: vereinAntwort,
    vertragswunsch: vertragswunsch,
    vertragBewerten: vertragBewerten,
    spielerAntwort: spielerAntwort,
    spielzeitAussicht: spielzeitAussicht,
    leihKonditionen: leihKonditionen,
    leihBewertung: leihBewertung,
    marktSuche: marktSuche,
    setZaehler: function (n) { zaehler = n; },
    getZaehler: function () { return zaehler; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
