/* ui-transfer.js - Transfermarkt, Transfer-, Vertrags- und Leihverhandlungen.
 *
 * Vor jedem Angebot steht ein Dossier: Forderung, Interesse des Spielers,
 * seine Bedeutung im alten Kader und konkrete Hinweise. Während der
 * Verhandlung zeigt eine Messlatte, was das Angebot dem Verein wirklich
 * wert ist - so wird nachvollziehbar, warum Raten weniger zählen als Bargeld.
 */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  /* ---------- Bausteine ---------- */

  function feldAuswahl(titel, id, optionen, wert) {
    return '<label class="feld"><span>' + titel + '</span><select id="' + id + '">' +
      optionen.map(function (o) {
        return '<option value="' + Util.esc(o[0]) + '"' +
          (String(o[0]) === String(wert) ? ' selected' : '') + '>' + Util.esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
  }
  function feldZahl(titel, id, wert, min, max, schritt) {
    return '<label class="feld"><span>' + titel + '</span><input type="number" id="' + id +
      '" value="' + wert + '"' + (min !== undefined ? ' min="' + min + '"' : '') +
      (max !== undefined ? ' max="' + max + '"' : '') + (schritt ? ' step="' + schritt + '"' : '') + '></label>';
  }
  function feldText(titel, id, wert) {
    return '<label class="feld"><span>' + titel + '</span><input type="text" id="' + id +
      '" value="' + Util.esc(wert) + '"></label>';
  }

  function dossierZeile(label, wert) {
    return '<div class="dossier__zeile"><span class="dossier__label">' + label +
      '</span><span class="dossier__wert">' + wert + '</span></div>';
  }

  function messlatte(wert, forderung) {
    var anteil = Util.clamp(wert / Math.max(1, forderung) * 100, 0, 100);
    var fehlt = Math.max(0, forderung - wert);
    return '<div class="messlatte"><div class="messlatte__spur">' +
      '<div class="messlatte__fuell" style="width:' + anteil.toFixed(1) + '%"></div></div>' +
      '<div class="messlatte__text"><span>Angebotswert ' + Fmt.money(wert) + '</span>' +
      '<span>' + (fehlt > 0 ? 'es fehlen ' + Fmt.money(fehlt) : 'Forderung erfüllt') + '</span></div></div>';
  }

  /* ---------- Transfermarkt ---------- */

  var filter = {
    bereich: 'alle', pos: 'alle', maxAlter: 40, minStaerke: 0,
    maxWert: 0, nation: 'alle', suche: '', sortierung: 'marktwert'
  };

  UI.seiten.transfermarkt = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var offen = Game.istTransferfenster(st);

    var html = '<div class="karte">' +
      '<div class="karte__kopf"><h3>Suche</h3>' +
      '<span class="marke ' + (offen ? 'marke--gut' : 'marke--gefahr') + '">' +
      (offen ? 'Transferfenster geöffnet' : 'Transferfenster geschlossen') + '</span></div>';

    if (!offen) {
      html += '<p class="hinweis">Verpflichtungen und Leihen sind nur im Sommer ' +
        '(1. Juli bis 31. August) und im Winter (1. bis 31. Januar) möglich. ' +
        'Beobachten können Sie den Markt jederzeit.</p>';
    }

    html += '<div class="formularraster">' +
      feldAuswahl('Bereich', 'fBereich', [
        ['alle', 'Alle Vereine'], ['deutschland', 'Nur Deutschland'],
        ['international', 'Nur international'], ['ablösefrei', 'Nur vereinslose'],
        ['liste', 'Nur Transferliste']
      ], filter.bereich) +
      feldAuswahl('Position', 'fPos', [['alle', 'Alle'], ['TW', 'Torwart'], ['ABW', 'Abwehr'],
        ['MIT', 'Mittelfeld'], ['ANG', 'Angriff']].concat(Players.POSITIONEN.map(function (p) {
          return [p, p];
        })), filter.pos) +
      feldZahl('Mindeststärke', 'fStaerke', filter.minStaerke) +
      feldZahl('Höchstalter', 'fAlter', filter.maxAlter) +
      feldZahl('Marktwert bis (€)', 'fWert', filter.maxWert) +
      feldAuswahl('Nation', 'fNation', [['alle', 'Alle']].concat(Names.nationen.map(function (n) {
        return [n, n];
      })), filter.nation) +
      feldText('Suche', 'fSuche', filter.suche) +
      feldAuswahl('Sortierung', 'fSort', [['marktwert', 'Marktwert'], ['staerke', 'Stärke'],
        ['potenzial', 'Potenzial'], ['alter', 'Alter'], ['name', 'Name']], filter.sortierung) +
      '</div>';
    html += '<div class="knopfreihe" style="margin-top:1rem">' +
      '<button class="knopf knopf--haupt" id="fSuchen">Suchen</button>' +
      '<button class="knopf knopf--still" id="fReset">Zurücksetzen</button>' +
      '<span class="mini">Transferbudget <b>' + Fmt.money(mein.finanzen.transferbudget) +
      '</b> · sofort verfügbar <b>' + Fmt.money(Game.verfuegbaresGeld(st, mein)) + '</b></span>' +
      '</div></div>';

    var treffer = Transfers.marktSuche(st, filter);
    html += '<div class="karte"><div class="karte__kopf"><h3>Ergebnisse</h3>' +
      '<span class="mini">' + Fmt.num(treffer.length) + ' Spieler' +
      (treffer.length > 80 ? ', die ersten 80 werden gezeigt' : '') + '</span></div>' +
      '<div class="tabellenrahmen"><table class="liste"><thead><tr>' +
      '<th class="mitte">Pos</th><th>Spieler</th><th>Verein</th><th class="zahl">Alter</th>' +
      '<th class="zahl">Stärke</th><th class="zahl">Pot</th><th class="zahl">Marktwert</th>' +
      '<th class="zahl">Gehalt/Wo</th><th class="zahl">Vertrag</th><th></th></tr></thead><tbody>' +
      treffer.slice(0, 80).map(function (p) {
        var klub = p.klubId ? st.klubs[p.klubId] : null;
        return '<tr class="klickbar" data-spieler="' + p.id + '">' +
          '<td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
          '<td><b>' + Util.esc(p.name) + '</b> <span class="mini">' + Util.esc(p.nation) + '</span></td>' +
          '<td>' + (klub ? UI.klubZelle(klub, 18, true) : '<span class="akzent">vereinslos</span>') + '</td>' +
          '<td class="zahl">' + p.alter + '</td>' +
          '<td class="zahl">' + UI.staerkeBalken(p.staerke) + '</td>' +
          '<td class="zahl mini">' + p.potenzial + '</td>' +
          '<td class="zahl">' + Fmt.money(p.marktwert) + '</td>' +
          '<td class="zahl">' + Fmt.money(p.gehalt) + '</td>' +
          '<td class="zahl">' + p.vertragBis + '</td>' +
          '<td>' + (p.transferliste ? '<span class="marke marke--info">Liste</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return html;
  };

  UI.nachZeichnen.transfermarkt = function () {
    UI.spielerKlicks();
    var b = $('fSuchen');
    if (b) b.onclick = function () {
      filter.bereich = $('fBereich').value;
      filter.pos = $('fPos').value;
      filter.minStaerke = +$('fStaerke').value || 0;
      filter.maxAlter = +$('fAlter').value || 40;
      filter.maxWert = +$('fWert').value || 0;
      filter.nation = $('fNation').value;
      filter.suche = $('fSuche').value.trim();
      filter.sortierung = $('fSort').value;
      UI.zeichne();
    };
    var r = $('fReset');
    if (r) r.onclick = function () {
      filter = { bereich: 'alle', pos: 'alle', maxAlter: 40, minStaerke: 0, maxWert: 0,
        nation: 'alle', suche: '', sortierung: 'marktwert' };
      UI.zeichne();
    };
    var suche = $('fSuche');
    if (suche) suche.onkeydown = function (e) { if (e.key === 'Enter') $('fSuchen').click(); };
  };

  /* ---------- Fenstercheck ---------- */

  function fensterOffen() {
    var st = UI.S();
    if (Game.istTransferfenster(st)) return true;
    UI.modal('Transferfenster geschlossen',
      '<p>Verpflichtungen, Verkäufe und Leihen sind nur während des Transferfensters möglich: ' +
      '1. Juli bis 31. August sowie 1. bis 31. Januar.</p>',
      [{ text: 'Verstanden', klasse: 'knopf--still' }]);
    return false;
  }

  /* ---------- Transferverhandlung (Kauf) ---------- */

  UI.transferVerhandlung = function (spielerId) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p || !fensterOffen()) return;
    if (!p.klubId) { UI.vertragsVerhandlung(spielerId, true); return; }
    if (Game.kaderVon(st, mein).length >= 30) {
      UI.toast('Ihr Kader ist mit 30 Spielern voll.');
      return;
    }

    var v = st.verhandlungen.filter(function (x) {
      return x.typ === 'kauf' && x.spielerId === spielerId && x.status === 'offen';
    })[0];

    if (!v) {
      var d = Transfers.dossier(st, p, mein);
      v = Transfers.verhandlungStarten(st, {
        typ: 'kauf', spielerId: spielerId, vonKlubId: p.klubId,
        zuKlubId: mein.id, tag: st.tag, forderung: d.forderung
      });
      v.dossier = d;
      v.historie.push({
        von: 'verkaeufer',
        text: st.klubs[p.klubId].name + ': „Unsere Forderung für ' + p.nachname + ' liegt bei ' +
          Fmt.money(d.forderung) + '."'
      });
      st.verhandlungen.push(v);
    }
    zeigeKaufVerhandlung(v);
  };

  function dossierHTML(d, p, st) {
    var html = '<div class="dossier">' +
      dossierZeile('Ablöseforderung', '<b>' + Fmt.money(d.forderung) + '</b> ' +
        '<span class="mini">(Marktwert ' + Fmt.money(p.marktwert) + ')</span>') +
      dossierZeile('Interesse des Spielers', Util.esc(d.interesseText)) +
      dossierZeile('Rolle im alten Kader', Util.esc(d.wichtigkeitText)) +
      dossierZeile('Vertrag läuft bis', p.vertragBis + ' <span class="mini">(' +
        Math.max(0, d.restlaufzeit) + ' Jahre)</span>') +
      dossierZeile('Gehaltsvorstellung', Fmt.money(d.gehaltswunsch) + ' / Woche ' +
        '<span class="mini">(bisher ' + Fmt.money(p.gehalt) + ')</span>') +
      dossierZeile('Wunschlaufzeit', d.laufzeitwunsch + ' Jahre') +
      '</div>';
    if (d.hinweise.length) {
      html += '<div class="dossier__hinweise"><ul>' +
        d.hinweise.map(function (h) { return '<li>' + Util.esc(h) + '</li>'; }).join('') +
        '</ul></div>';
    }
    return html;
  }

  function zeigeKaufVerhandlung(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var verkaeufer = st.klubs[v.vonKlubId];
    var d = v.dossier || Transfers.dossier(st, p, mein);

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">' +
      UI.wappen(verkaeufer, 44) +
      '<div><b style="font-size:1.02rem">' + Util.esc(p.name) + '</b>' +
      '<div class="mini">' + p.pos + ' · ' + p.alter + ' Jahre · Stärke ' + p.staerke +
      ' · ' + Util.esc(verkaeufer.name) + '</div></div>' +
      '<span class="marke marke--' + (v.klima >= 55 ? 'gut' : (v.klima >= 30 ? 'warn' : 'gefahr')) +
      '" style="margin-left:auto">Klima: ' + Transfers.klimaText(v.klima) + '</span></div>';

    if (v.runde === 0) html += dossierHTML(d, p, st);
    html += verlaufHTML(v);

    if (v.phase === 'verein') {
      var vorschlag = Math.min(v.forderung, mein.finanzen.transferbudget,
        Game.verfuegbaresGeld(st, mein));
      html += '<h4>Ihr Angebot an ' + Util.esc(verkaeufer.name) + '</h4>' +
        '<div class="knopfreihe" style="margin-bottom:.8rem">' +
        '<button class="knopf knopf--klein" id="aErfuellen">Forderung erfüllen</button>' +
        '<button class="knopf knopf--klein" id="aRaten">Mit Raten strukturieren</button>' +
        '</div>' +
        '<div class="formularraster">' +
        feldZahl('Sofortzahlung (€)', 'aSofort', Math.round(vorschlag / 5000) * 5000, 0, undefined, 5000) +
        feldZahl('Ratenzahlung (€)', 'aRatenBetrag', 0, 0, undefined, 5000) +
        feldAuswahl('Raten über', 'aRatenJahre', [[1, '1 Jahr'], [2, '2 Jahre'], [3, '3 Jahre'], [4, '4 Jahre']], 2) +
        feldZahl('Bonus nach 25 Einsätzen (€)', 'aBonus', 0, 0, undefined, 5000) +
        feldZahl('Bonus bei Aufstieg/Titel (€)', 'aBonusAuf', 0, 0, undefined, 5000) +
        feldZahl('Weiterverkauf (%)', 'aWeiter', 0, 0, 40, 1) +
        '</div>' +
        '<div id="aMesslatte"></div>' +
        '<p class="mini" id="aSumme"></p>';
    } else if (v.phase === 'spieler') {
      html += vertragsBereich(p, mein, v, false);
    }

    var aktionen = [];
    if (v.phase === 'verein') {
      aktionen.push({ text: 'Angebot abgeben', klasse: 'knopf--haupt', schliessen: false,
        fn: function () { angebotAbgeben(v); } });
    } else if (v.phase === 'spieler') {
      aktionen.push({ text: 'Vertrag anbieten', klasse: 'knopf--haupt', schliessen: false,
        fn: function () { vertragAnbieten(v, p, mein, false); } });
    }
    if (v.phase === 'verein' || v.phase === 'spieler') {
      aktionen.push({ text: 'Abbrechen', klasse: 'knopf--gefahr',
        fn: function () {
          v.status = 'abgebrochen'; v.phase = 'geplatzt';
          UI.toast('Verhandlung abgebrochen.'); UI.zeichne();
        } });
    }
    aktionen.push({ text: 'Später', klasse: 'knopf--still' });

    UI.modal('Transferverhandlung', html, aktionen, true);
    if (v.phase === 'verein') angebotsRechner(v);
    if (v.phase === 'spieler') vertragsRechner(p, mein, v, false);
  }

  function angebotLesen() {
    return {
      sofort: Math.max(0, +($('aSofort') || {}).value || 0),
      raten: Math.max(0, +($('aRatenBetrag') || {}).value || 0),
      ratenJahre: +($('aRatenJahre') || {}).value || 2,
      bonusEinsaetze: Math.max(0, +($('aBonus') || {}).value || 0),
      bonusAufstieg: Math.max(0, +($('aBonusAuf') || {}).value || 0),
      weiterverkauf: Util.clamp(+($('aWeiter') || {}).value || 0, 0, 40)
    };
  }

  function angebotsRechner(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];

    function rechne() {
      var a = angebotLesen();
      var wert = Transfers.angebotsWert(a, p.marktwert);
      var gesamt = Transfers.angebotGesamt(a);
      var latte = $('aMesslatte');
      if (latte) latte.innerHTML = messlatte(wert, v.forderung);
      var el = $('aSumme');
      if (el) {
        var text = 'Volumen <b>' + Fmt.money(gesamt) + '</b>, davon sofort fällig <b>' +
          Fmt.money(a.sofort) + '</b>. Der Verein bewertet das mit <b>' + Fmt.money(wert) + '</b>';
        if (gesamt > wert) text += ' – Raten, Boni und Beteiligungen zählen weniger als Bargeld.';
        else text += '.';
        var frei = Game.verfuegbaresGeld(st, mein);
        if (a.sofort > frei) {
          text += ' <span class="schlecht">Die Sofortzahlung übersteigt Ihr freies Guthaben von ' +
            Fmt.money(frei) + '. Verteilen Sie den Betrag auf Raten.</span>';
        } else if (a.sofort > mein.finanzen.transferbudget) {
          text += ' <span class="schlecht">Die Sofortzahlung übersteigt Ihr Transferbudget von ' +
            Fmt.money(mein.finanzen.transferbudget) + '.</span> Ein Transferkredit bei der Bank ' +
            'würde das Budget erhöhen.';
        }
        el.innerHTML = text;
      }
    }

    ['aSofort', 'aRatenBetrag', 'aRatenJahre', 'aBonus', 'aBonusAuf', 'aWeiter'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = el.onchange = rechne;
    });

    var grenze = Math.min(mein.finanzen.transferbudget, Game.verfuegbaresGeld(st, mein));
    var erf = $('aErfuellen');
    if (erf) erf.onclick = function () {
      var bar = Math.min(v.forderung, grenze);
      $('aSofort').value = Math.round(bar / 5000) * 5000;
      var rest = Math.max(0, v.forderung - bar);
      $('aRatenBetrag').value = rest > 0 ? Math.round(rest * 1.15 / 5000) * 5000 : 0;
      $('aRatenJahre').value = 3;
      rechne();
    };
    var strukt = $('aRaten');
    if (strukt) strukt.onclick = function () {
      var bar = Math.min(Math.round(v.forderung * 0.4 / 5000) * 5000, grenze);
      $('aSofort').value = bar;
      $('aRatenBetrag').value = Math.round((v.forderung - bar) * 1.2 / 5000) * 5000;
      $('aRatenJahre').value = 3;
      rechne();
    };
    rechne();
  }

  function angebotAbgeben(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var verkaeufer = st.klubs[v.vonKlubId];
    var angebot = angebotLesen();

    var frei = Game.verfuegbaresGeld(st, mein);
    if (angebot.sofort > frei) {
      UI.toast('Die Sofortzahlung übersteigt Ihr freies Guthaben von ' + Fmt.money(frei) + '.');
      return;
    }
    if (angebot.sofort > mein.finanzen.transferbudget) {
      UI.toast('Die Sofortzahlung übersteigt Ihr Transferbudget.');
      return;
    }
    if (Transfers.angebotGesamt(angebot) <= 0) {
      UI.toast('Bitte geben Sie zuerst ein Angebot ein.');
      return;
    }

    var antwort = Transfers.vereinAntwort(Game.rng, v, angebot, p, verkaeufer,
      Game.kaderVon(st, verkaeufer));

    if (antwort.art === 'angenommen') {
      var d = v.dossier || Transfers.dossier(st, p, mein);
      if (d.interesse < 0.18) {
        v.phase = 'geplatzt'; v.status = 'geplatzt';
        v.historie.push({ von: 'spieler', text: 'Der Spieler lehnt einen Wechsel zu Ihnen ab. ' +
          'Ohne sein Einverständnis kommt kein Transfer zustande.' });
      }
    }
    if (v.status === 'geplatzt') UI.toast('Die Verhandlung ist gescheitert.');
    zeigeKaufVerhandlung(v);
    UI.kopfZeichnen();
    UI.menueZeichnen();
  }

  /* ---------- Vertragsteil ---------- */

  function vertragsBereich(p, klub, v, istVerlaengerung) {
    var st = UI.S();
    var kaderNeu = Game.kaderVon(st, klub);
    var wunsch = v.spielerWunsch || Transfers.vertragswunsch(p, klub, kaderNeu, istVerlaengerung);
    v.spielerWunsch = wunsch;
    var rolle = Util.byId(Transfers.ROLLEN, wunsch.rolle);

    var html = '<h4>' + (istVerlaengerung ? 'Neuer Vertrag für ' : 'Vertragsangebot an ') +
      Util.esc(p.name) + '</h4>';
    html += '<div class="dossier">' +
      dossierZeile('Er verlangt', '<b>' + Fmt.money(wunsch.gehalt) + '</b> pro Woche') +
      dossierZeile('Wunschlaufzeit', wunsch.jahre + ' Jahre') +
      dossierZeile('Handgeld', Fmt.money(wunsch.handgeld)) +
      dossierZeile('Erwartete Rolle', Util.esc(rolle ? rolle.name : '–')) +
      (wunsch.ausstiegsklausel
        ? dossierZeile('Ausstiegsklausel', 'gewünscht, etwa ' + Fmt.money(wunsch.ausstiegsklausel))
        : '') +
      '</div>';
    html += '<div class="knopfreihe" style="margin:.6rem 0 .9rem">' +
      '<button class="knopf knopf--klein" id="vUebernehmen">Forderungen übernehmen</button></div>';
    html += '<div class="formularraster">' +
      feldZahl('Gehalt pro Woche (€)', 'vGehalt', Math.round(wunsch.gehalt), 0, undefined, 10) +
      feldAuswahl('Laufzeit', 'vJahre', Transfers.VERTRAGSDAUER.map(function (j) {
        return [j, j + (j === 1 ? ' Jahr' : ' Jahre')];
      }), wunsch.jahre) +
      feldZahl('Handgeld (€)', 'vHandgeld', Math.round(wunsch.handgeld), 0, undefined, 1000) +
      feldAuswahl('Versprochene Rolle', 'vRolle', Transfers.ROLLEN.map(function (r) {
        return [r.id, r.name];
      }), wunsch.rolle) +
      feldZahl('Ausstiegsklausel (€, 0 = keine)', 'vKlausel', wunsch.ausstiegsklausel || 0, 0, undefined, 100000) +
      '</div>' +
      '<p class="mini" id="vHinweis"></p>';
    return html;
  }

  function vertragLesen() {
    return {
      gehalt: Math.max(0, +$('vGehalt').value || 0),
      jahre: +$('vJahre').value || 3,
      handgeld: Math.max(0, +$('vHandgeld').value || 0),
      rolle: $('vRolle').value,
      ausstiegsklausel: Math.max(0, +$('vKlausel').value || 0) || null
    };
  }

  function vertragsRechner(p, klub, v, istVerlaengerung) {
    var st = UI.S();
    var kaderNeu = Game.kaderVon(st, klub);
    var altKlub = p.klubId ? st.klubs[p.klubId] : null;

    function rechne() {
      var vertrag = vertragLesen();
      var b = Transfers.vertragBewerten(p, klub, altKlub, vertrag, kaderNeu, st.saison, istVerlaengerung);
      var el = $('vHinweis');
      if (!el) return;
      var jahr = 'Jahresgehalt ' + Fmt.money(vertrag.gehalt * 52) +
        ', Gesamtkosten über die Laufzeit ' +
        Fmt.money(vertrag.gehalt * 52 * vertrag.jahre + (vertrag.handgeld || 0)) + '. ';
      var urteil;
      if (b.punkte >= 8) urteil = '<span class="gut">Das dürfte er annehmen.</span>';
      else if (b.punkte >= -6) urteil = '<span class="akzent">Knapp – er könnte noch nachverhandeln.</span>';
      else urteil = '<span class="schlecht">Zu wenig: ' +
        (b.maengel.length ? Util.esc(b.maengel[0].text) : 'Er wird ablehnen.') + '</span>';
      el.innerHTML = jahr + urteil;
    }

    ['vGehalt', 'vJahre', 'vHandgeld', 'vRolle', 'vKlausel'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = el.onchange = rechne;
    });
    var u = $('vUebernehmen');
    if (u) u.onclick = function () {
      var w = v.spielerWunsch;
      $('vGehalt').value = Math.round(w.gehalt);
      $('vJahre').value = w.jahre;
      $('vHandgeld').value = Math.round(w.handgeld);
      $('vRolle').value = w.rolle;
      $('vKlausel').value = w.ausstiegsklausel || 0;
      rechne();
    };
    rechne();
  }

  function vertragAnbieten(v, p, klub, istVerlaengerung) {
    var st = UI.S();
    var vertrag = vertragLesen();
    var altKlub = p.klubId ? st.klubs[p.klubId] : null;
    var antwort = Transfers.spielerAntwort(Game.rng, v, vertrag, p, klub, altKlub,
      Game.kaderVon(st, klub), st.saison, istVerlaengerung);
    if (antwort.art === 'angenommen') { abschluss(v, p, klub, vertrag, istVerlaengerung); return; }
    if (istVerlaengerung) zeigeVerlaengerung(v); else zeigeKaufVerhandlung(v);
  }

  function abschluss(v, p, klub, vertrag, istVerlaengerung) {
    var st = UI.S();
    if (istVerlaengerung) {
      p.gehalt = vertrag.gehalt;
      p.vertragBis = st.saison + vertrag.jahre;
      p.rolle = vertrag.rolle;
      p.ausstiegsklausel = vertrag.ausstiegsklausel;
      p.moral = Util.clamp(p.moral + 10, 5, 100);
      p.wechselwunsch = false;
      p.marktwert = Players.marktwert(p, st.saison);
      if (vertrag.handgeld) {
        Finance.buchen(klub.finanzen, st.tag, 'Vertrag', 'Handgeld ' + p.name,
          -vertrag.handgeld, 'Handgelder');
      }
      v.status = 'erledigt'; v.phase = 'fertig';
      UI.modalZu();
      UI.toast(p.name + ' hat bis ' + p.vertragBis + ' verlängert.');
      Game.post(st, 'Vertrag verlängert: ' + p.name,
        p.name + ' hat bis ' + p.vertragBis + ' unterschrieben. Wochengehalt: ' +
        Fmt.money(vertrag.gehalt) + '.', 'gut');
    } else {
      var verkaeufer = p.klubId ? st.klubs[p.klubId] : null;
      var struktur = v.struktur || { sofort: 0 };
      var gesamt = Transfers.angebotGesamt(struktur);
      Game.transferAusfuehren(st, p, verkaeufer, klub, gesamt, vertrag, struktur);
      v.status = 'erledigt'; v.phase = 'fertig';
      UI.modalZu();
      UI.toast(p.name + ' wechselt zu ' + klub.name + '.');
      Game.post(st, 'Neuzugang: ' + p.name,
        p.name + ' (' + p.pos + ', ' + p.alter + ') hat unterschrieben' +
        (verkaeufer ? ' und kommt von ' + verkaeufer.name : ' und war vereinslos') +
        '. Ablöse: ' + (gesamt ? Fmt.money(gesamt) : 'keine') + ', Gehalt: ' +
        Fmt.money(vertrag.gehalt) + ' pro Woche bis ' + p.vertragBis + '.', 'gut');
    }
    UI.zeichne();
  }

  /* ---------- Verlängerung / vereinslose Spieler ---------- */

  UI.vertragsVerhandlung = function (spielerId, ablösefrei) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p) return;
    if (ablösefrei && !fensterOffen()) return;
    var v = st.verhandlungen.filter(function (x) {
      return x.typ === 'vertrag' && x.spielerId === spielerId && x.status === 'offen';
    })[0];
    if (!v) {
      v = Transfers.verhandlungStarten(st, {
        typ: 'vertrag', spielerId: spielerId, vonKlubId: p.klubId,
        zuKlubId: mein.id, tag: st.tag, forderung: 0, phase: 'spieler'
      });
      v.ablösefrei = !!ablösefrei;
      st.verhandlungen.push(v);
    }
    zeigeVerlaengerung(v);
  };

  function zeigeVerlaengerung(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var istVerlaengerung = !v.ablösefrei;

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem">' +
      UI.wappen(mein, 44) +
      '<div><b style="font-size:1.02rem">' + Util.esc(p.name) + '</b>' +
      '<div class="mini">' + p.pos + ' · ' + p.alter + ' Jahre · Stärke ' + p.staerke +
      ' · Marktwert ' + Fmt.money(p.marktwert) + '</div></div></div>';
    html += verlaufHTML(v);
    if (v.phase === 'spieler') html += vertragsBereich(p, mein, v, istVerlaengerung);

    var aktionen = [];
    if (v.phase === 'spieler') {
      aktionen.push({ text: istVerlaengerung ? 'Vertrag anbieten' : 'Verpflichten',
        klasse: 'knopf--haupt', schliessen: false,
        fn: function () { vertragAnbieten(v, p, mein, istVerlaengerung); } });
      aktionen.push({ text: 'Abbrechen', klasse: 'knopf--gefahr',
        fn: function () { v.status = 'abgebrochen'; v.phase = 'geplatzt'; UI.zeichne(); } });
    }
    aktionen.push({ text: 'Später', klasse: 'knopf--still' });
    UI.modal(istVerlaengerung ? 'Vertragsverhandlung' : 'Ablösefreie Verpflichtung', html, aktionen, true);
    if (v.phase === 'spieler') vertragsRechner(p, mein, v, istVerlaengerung);
  }

  function verlaufHTML(v) {
    if (!v.historie.length) return '';
    return '<div class="verlauf">' + v.historie.slice(-8).map(function (h) {
      var wer = h.von === 'kaeufer' ? 'Sie' : (h.von === 'spieler' ? 'Spieler / Berater' : 'Verein');
      return '<div class="verlauf__zeile ' + h.von + '"><span class="verlauf__wer">' + wer +
        '</span>' + Util.esc(h.text) + '</div>';
    }).join('') + '</div>';
  }

  /* ---------- Leihgeschäfte ---------- */

  UI.leihVerhandlung = function (spielerId, richtung) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p || !fensterOffen()) return;

    if (richtung === 'rein') {
      var geber = st.klubs[p.klubId];
      if (!geber || !geber.ligaId) {
        UI.modal('Leihe nicht möglich',
          '<p>Leihen sind nur zwischen Vereinen mit laufendem Spielbetrieb möglich. ' +
          'Bei einem Verein ohne Ligabetrieb käme der Spieler zu keinen Einsätzen.</p>',
          [{ text: 'Verstanden', klasse: 'knopf--still' }]);
        return;
      }
      leihFenster(p, geber, mein, 'rein');
    } else {
      leihFenster(p, mein, null, 'raus');
    }
  };

  function leihFenster(p, geber, nehmer, richtung, vorauswahl) {
    var st = UI.S(), mein = UI.meinKlub();
    var kaderAlt = Game.kaderVon(st, geber);

    /* Beim Verleihen muss zuerst ein Zielverein gewählt werden. */
    var zielId = vorauswahl || (nehmer ? nehmer.id : null);
    var moegliche = [];
    if (richtung === 'raus') {
      /* Vereine danach ordnen, wo der Spieler wirklich spielen würde -
         eine Leihe zum Spitzenreiter nützt niemandem, wenn er dort
         auf der Bank sitzt. */
      moegliche = Object.keys(st.klubs).filter(function (id) {
        var k = st.klubs[id];
        return id !== mein.id && !k.wartend && k.ligaId && k.kader.length < 30;
      }).map(function (id) {
        var k = st.klubs[id];
        k.__aussicht = Transfers.spielzeitAussicht(p, Game.kaderVon(st, k));
        return k;
      }).sort(function (a, b) {
        /* Zuerst Vereine mit echter Einsatzaussicht, darin die stärksten. */
        var ga = a.__aussicht >= 0.5 ? 1 : 0, gb = b.__aussicht >= 0.5 ? 1 : 0;
        if (ga !== gb) return gb - ga;
        return b.ruf - a.ruf;
      });
      if (!zielId) zielId = moegliche.length ? moegliche[0].id : null;
    }
    var ziel = zielId ? st.klubs[zielId] : nehmer;
    if (!ziel) { UI.toast('Kein passender Verein gefunden.'); return; }

    var kaderNeu = Game.kaderVon(st, ziel);
    var kond = Transfers.leihKonditionen(p, kaderAlt, geber, ziel, st.saison);
    var aussicht = Transfers.spielzeitAussicht(p, kaderNeu);

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">' +
      UI.wappen(geber, 40) + '<span class="mini">→</span>' + UI.wappen(ziel, 40) +
      '<div><b>' + Util.esc(p.name) + '</b><div class="mini">' + p.pos + ' · ' + p.alter +
      ' Jahre · Stärke ' + p.staerke + '</div></div></div>';

    if (richtung === 'raus') {
      html += feldAuswahl('Verein', 'lZiel', moegliche.map(function (k) {
        return [k.id, k.name + ' · ' + st.ligen[k.ligaId].kurz + ' · Einsatzaussicht ' +
          Math.round(k.__aussicht * 100) + ' %'];
      }), ziel.id);
    }

    html += '<div class="dossier">' +
      dossierZeile('Erwarteter Gehaltsanteil', '<b>' + kond.gehaltsanteil + ' %</b> ' +
        '<span class="mini">= ' + Fmt.money(p.gehalt * kond.gehaltsanteil / 100) + ' / Woche</span>') +
      dossierZeile('Übliche Leihgebühr', kond.gebuehr ? Fmt.money(kond.gebuehr) : 'keine') +
      dossierZeile('Einsatzaussicht dort', Math.round(aussicht * 100) + ' % ' +
        '<span class="mini">' + (aussicht > 0.7 ? '(gesetzt)' : aussicht > 0.45 ? '(Rotation)' : '(Bank)') +
        '</span>') +
      '</div>';

    html += '<div class="formularraster" style="margin-top:.8rem">' +
      feldZahl('Gehaltsanteil des ausleihenden Vereins (%)', 'lAnteil', kond.gehaltsanteil, 0, 100, 5) +
      feldZahl('Leihgebühr (€)', 'lGebuehr', kond.gebuehr, 0, undefined, 1000) +
      feldZahl('Kaufoption (€, 0 = keine)', 'lKaufoption', 0, 0, undefined, 10000) +
      '</div>' +
      '<p class="mini" id="lHinweis"></p>' +
      '<p class="mini">Die Leihe läuft bis zum Saisonende. Danach kehrt der Spieler ' +
      'automatisch zurück, falls die Kaufoption nicht gezogen wird.</p>';

    var inhalt = UI.modal(richtung === 'raus' ? 'Spieler verleihen' : 'Spieler ausleihen', html, [
      {
        text: richtung === 'raus' ? 'Verleihen' : 'Anfrage stellen',
        klasse: 'knopf--haupt', schliessen: false,
        fn: function () { leiheAbschliessen(p, geber, ziel, richtung); }
      },
      { text: 'Abbrechen', klasse: 'knopf--still' }
    ], true);

    var zielFeld = $('lZiel');
    if (zielFeld) zielFeld.onchange = function () {
      UI.modalZu();
      leihFenster(p, geber, null, 'raus', zielFeld.value);
    };

    function pruefe() {
      var angebot = {
        gehaltsanteil: Util.clamp(+$('lAnteil').value || 0, 0, 100),
        gebuehr: Math.max(0, +$('lGebuehr').value || 0),
        kaufoption: Math.max(0, +$('lKaufoption').value || 0)
      };
      var b = Transfers.leihBewertung(p, kaderAlt, geber, ziel, kaderNeu, angebot, st.saison);
      var el = $('lHinweis');
      if (!el) return;
      var teile = [];
      teile.push(b.vereinOk ? '<span class="gut">' + Util.esc(geber.name) + ' würde zustimmen.</span>'
                            : '<span class="schlecht">' + Util.esc(geber.name) + ' lehnt zu diesen Konditionen ab.</span>');
      teile.push(b.spielerOk ? '<span class="gut">Der Spieler ist einverstanden.</span>'
                             : '<span class="schlecht">Der Spieler sieht dort zu wenig Spielzeit.</span>');
      if (b.gruende.length) teile.push('<span class="mini">' + Util.esc(b.gruende.join(' ')) + '</span>');
      el.innerHTML = teile.join(' ');
    }
    ['lAnteil', 'lGebuehr', 'lKaufoption'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = pruefe;
    });
    pruefe();
  }

  function leiheAbschliessen(p, geber, ziel, richtung) {
    var st = UI.S(), mein = UI.meinKlub();
    var kaderAlt = Game.kaderVon(st, geber);
    var kaderNeu = Game.kaderVon(st, ziel);
    var angebot = {
      gehaltsanteil: Util.clamp(+$('lAnteil').value || 0, 0, 100),
      gebuehr: Math.max(0, +$('lGebuehr').value || 0),
      kaufoption: Math.max(0, +$('lKaufoption').value || 0)
    };
    var b = Transfers.leihBewertung(p, kaderAlt, geber, ziel, kaderNeu, angebot, st.saison);

    if (!b.vereinOk) { UI.toast(geber.name + ' lehnt diese Konditionen ab.'); return; }
    if (!b.spielerOk) { UI.toast('Der Spieler lehnt ab – ihm fehlt die Aussicht auf Spielzeit.'); return; }
    if (richtung === 'rein' && angebot.gebuehr > mein.finanzen.transferbudget) {
      UI.toast('Die Leihgebühr übersteigt Ihr Transferbudget.');
      return;
    }
    if (richtung === 'rein' && Game.kaderVon(st, mein).length >= 30) {
      UI.toast('Ihr Kader ist voll.');
      return;
    }
    if (richtung === 'raus' && Game.kaderVon(st, mein).length <= 17) {
      UI.toast('Ihr Kader wäre danach zu klein.');
      return;
    }

    Game.leiheAusfuehren(st, p, geber, ziel, {
      bisTag: League.SAISON_ENDE_ZIEL + 20,
      gehaltsanteil: angebot.gehaltsanteil,
      gebuehr: angebot.gebuehr,
      kaufoption: angebot.kaufoption
    });
    UI.modalZu();
    UI.toast(richtung === 'raus'
      ? p.name + ' ist bis Saisonende an ' + ziel.name + ' verliehen.'
      : p.name + ' kommt bis Saisonende von ' + geber.name + '.');
    Game.post(st, 'Leihgeschäft: ' + p.name,
      richtung === 'raus'
        ? p.name + ' wechselt bis Saisonende zu ' + ziel.name + '. ' + ziel.name + ' trägt ' +
          angebot.gehaltsanteil + ' % des Gehalts.'
        : p.name + ' kommt bis Saisonende von ' + geber.name + '. Sie tragen ' +
          angebot.gehaltsanteil + ' % des Gehalts.',
      'transfer');
    UI.zeichne();
  }

  /* ---------- Spieler aktiv anbieten ---------- */

  UI.verkaufAnbieten = function (spielerId) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p) return;
    var imFenster = Game.istTransferfenster(st);
    var notlage = mein.finanzen.kontostand < 0;

    var html = '<p>Sie lassen bei interessierten Vereinen anfragen, was sie für <b>' +
      Util.esc(p.name) + '</b> zu zahlen bereit wären.</p>' +
      '<div class="dossier">' +
      dossierZeile('Marktwert', Fmt.money(p.marktwert)) +
      dossierZeile('Ihre Vorstellung', Fmt.money(
        Transfers.forderung(p, Game.kaderVon(st, mein), mein, null, st.saison))) +
      dossierZeile('Gehalt, das frei wird', Fmt.money(p.gehalt) + ' / Woche ' +
        '<span class="mini">= ' + Fmt.money(p.gehalt * 52) + ' im Jahr</span>') +
      '</div>';

    if (!imFenster && notlage) {
      html += '<div class="dossier__hinweise">Das Transferfenster ist geschlossen. Weil Ihr Konto ' +
        'im Minus steht, genehmigt der Verband einen <b>Notverkauf</b> – die Käufer wissen das ' +
        'allerdings und drücken den Preis um etwa 15 %.</div>';
    } else if (!imFenster) {
      html += '<div class="dossier__hinweise">Das Transferfenster ist geschlossen. Verkäufe sind ' +
        'außerhalb des Fensters nur erlaubt, wenn das Konto im Minus steht.</div>';
    }

    UI.modal('Spieler anbieten', html, [
      {
        text: 'Angebote einholen', klasse: 'knopf--haupt', schliessen: false,
        deaktiviert: !imFenster && !notlage,
        fn: function () {
          var r = Game.verkaufAnbieten(st, p);
          if (!r.ok) { UI.toast(r.grund); return; }
          UI.modalZu();
          UI.toast(r.angebote.length + (r.angebote.length === 1 ? ' Angebot' : ' Angebote') +
            ' eingegangen – nachzulesen unter Verhandlungen.');
          UI.wechsle('verhandlungen');
        }
      },
      { text: 'Abbrechen', klasse: 'knopf--still' }
    ]);
  };

  /* ---------- Verhandlungsübersicht ---------- */

  UI.seiten.verhandlungen = function () {
    var st = UI.S();
    var offen = st.verhandlungen.filter(function (v) { return v.status === 'offen'; });
    var eingehend = offen.filter(function (v) { return v.typ === 'verkauf'; });
    var leihanfragen = offen.filter(function (v) { return v.typ === 'leihanfrage'; });
    var eigene = offen.filter(function (v) { return v.typ === 'kauf' || v.typ === 'vertrag'; });

    var html = '<div class="karte"><div class="karte__kopf"><h3>Angebote für Ihre Spieler</h3>' +
      '<span class="mini">' + eingehend.length + ' offen</span></div>';
    if (!eingehend.length) {
      html += '<p class="leer">Zurzeit liegt kein Kaufangebot vor.<br>' +
        'Bieten Sie einen Spieler aktiv an, um Interessenten zu wecken.</p>';
    } else {
      html += eingehend.map(function (v) {
        var p = st.spieler[v.spielerId];
        var interessent = st.klubs[v.zuKlubId];
        if (!p || !interessent) return '';
        var diff = v.gebot - p.marktwert;
        return '<div class="nachricht transfer">' +
          '<div class="nachricht__kopf"><span class="nachricht__betreff">' +
          Util.esc(p.name) + ' → ' + Util.esc(interessent.name) + '</span>' +
          '<span class="nachricht__datum">Frist: ' + Fmt.date(v.frist, st.saison) + '</span></div>' +
          (v.notverkauf ? '<span class="marke marke--warn">Notverkauf</span> ' : '') +
          '<p class="nachricht__text">Gebot <b>' + Fmt.money(v.gebot) + '</b> · Marktwert ' +
          Fmt.money(p.marktwert) + ' <span class="' + (diff >= 0 ? 'gut' : 'schlecht') + '">(' +
          (diff >= 0 ? '+' : '') + Fmt.money(diff) + ')</span> · Ihre Vorstellung wäre ' +
          Fmt.money(v.forderung) + '.</p>' +
          '<div class="knopfreihe" style="margin-top:.6em">' +
          '<button class="knopf knopf--klein knopf--haupt" data-annehmen="' + v.id + '">Annehmen</button>' +
          '<button class="knopf knopf--klein" data-fordern="' + v.id + '">Mehr fordern</button>' +
          '<button class="knopf knopf--klein knopf--gefahr" data-ablehnen="' + v.id + '">Ablehnen</button>' +
          '<button class="knopf knopf--klein knopf--still" data-spieler="' + p.id + '">Spieler ansehen</button>' +
          '</div></div>';
      }).join('');
    }
    html += '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Leihanfragen</h3>' +
      '<span class="mini">' + leihanfragen.length + ' offen</span></div>';
    if (!leihanfragen.length) {
      html += '<p class="leer">Keine offenen Leihanfragen.<br>Junge Reservisten wecken das meiste Interesse.</p>';
    } else {
      html += leihanfragen.map(function (v) {
        var p = st.spieler[v.spielerId];
        var k = st.klubs[v.zuKlubId];
        if (!p || !k) return '';
        var kaderNeu = Game.kaderVon(st, k);
        var aussicht = Math.round(Transfers.spielzeitAussicht(p, kaderNeu) * 100);
        return '<div class="nachricht transfer">' +
          '<div class="nachricht__kopf"><span class="nachricht__betreff">' +
          Util.esc(p.name) + ' → ' + Util.esc(k.name) + '</span>' +
          '<span class="nachricht__datum">Frist: ' + Fmt.date(v.frist, st.saison) + '</span></div>' +
          '<p class="nachricht__text">' + Util.esc(k.name) + ' übernimmt <b>' + v.gehaltsanteil +
          ' %</b> des Gehalts' + (v.gebuehr ? ', zahlt ' + Fmt.money(v.gebuehr) + ' Leihgebühr' : '') +
          (v.kaufoption ? ' und wünscht eine Kaufoption über ' + Fmt.money(v.kaufoption) : '') +
          '. Einsatzaussicht dort: <b>' + aussicht + ' %</b>.</p>' +
          '<div class="knopfreihe" style="margin-top:.6em">' +
          '<button class="knopf knopf--klein knopf--haupt" data-leiheja="' + v.id + '">Zustimmen</button>' +
          '<button class="knopf knopf--klein knopf--gefahr" data-leihenein="' + v.id + '">Ablehnen</button>' +
          '<button class="knopf knopf--klein knopf--still" data-spieler="' + p.id + '">Spieler ansehen</button>' +
          '</div></div>';
      }).join('');
    }
    html += '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Ihre laufenden Verhandlungen</h3></div>';
    if (!eigene.length) {
      html += '<p class="leer">Sie führen derzeit keine Verhandlungen.</p>';
    } else {
      html += '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Spieler</th>' +
        '<th>Verein</th><th>Stand</th><th>Klima</th><th class="zahl">Forderung</th><th></th>' +
        '</tr></thead><tbody>' +
        eigene.map(function (v) {
          var p = st.spieler[v.spielerId];
          if (!p) return '';
          var klub = v.vonKlubId ? st.klubs[v.vonKlubId] : null;
          var stand = v.phase === 'verein' ? 'Ablöse wird verhandelt'
            : (v.phase === 'spieler' ? 'Gespräch mit dem Spieler' : v.phase);
          return '<tr><td><b>' + Util.esc(p.name) + '</b></td>' +
            '<td>' + (klub ? UI.klubZelle(klub, 18, true) : '<span class="mini">vereinslos</span>') + '</td>' +
            '<td>' + stand + '</td>' +
            '<td><span class="marke marke--' + (v.klima >= 55 ? 'gut' : (v.klima >= 30 ? 'warn' : 'gefahr')) +
            '">' + Transfers.klimaText(v.klima) + '</span></td>' +
            '<td class="zahl">' + (v.forderung ? Fmt.money(v.forderung) : '–') + '</td>' +
            '<td><button class="knopf knopf--klein knopf--haupt" data-weiter="' + v.id + '">Fortsetzen</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  };

  UI.nachZeichnen.verhandlungen = function () {
    var st = UI.S();
    UI.spielerKlicks();
    function finde(id) {
      return st.verhandlungen.filter(function (v) { return v.id === id; })[0];
    }
    Array.prototype.forEach.call(document.querySelectorAll('[data-weiter]'), function (b) {
      b.onclick = function () {
        var v = finde(b.dataset.weiter);
        if (!v) return;
        if (v.typ === 'kauf') zeigeKaufVerhandlung(v); else zeigeVerlaengerung(v);
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-annehmen]'), function (b) {
      b.onclick = function () { angebotAnnehmen(finde(b.dataset.annehmen)); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ablehnen]'), function (b) {
      b.onclick = function () {
        var v = finde(b.dataset.ablehnen);
        if (!v) return;
        v.status = 'abgelehnt';
        UI.toast('Angebot abgelehnt.');
        UI.zeichne();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-fordern]'), function (b) {
      b.onclick = function () { mehrFordern(finde(b.dataset.fordern)); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-leiheja]'), function (b) {
      b.onclick = function () { leihanfrageAnnehmen(finde(b.dataset.leiheja)); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-leihenein]'), function (b) {
      b.onclick = function () {
        var v = finde(b.dataset.leihenein);
        if (!v) return;
        v.status = 'abgelehnt';
        UI.toast('Leihanfrage abgelehnt.');
        UI.zeichne();
      };
    });
  };

  function leihanfrageAnnehmen(v) {
    var st = UI.S(), mein = UI.meinKlub();
    if (!v) return;
    var p = st.spieler[v.spielerId];
    var ziel = st.klubs[v.zuKlubId];
    if (!p || !ziel) return;
    if (Game.kaderVon(st, mein).length <= 17) {
      UI.toast('Ihr Kader wäre danach zu klein.');
      return;
    }
    Game.leiheAusfuehren(st, p, mein, ziel, {
      bisTag: League.SAISON_ENDE_ZIEL + 20,
      gehaltsanteil: v.gehaltsanteil,
      gebuehr: v.gebuehr,
      kaufoption: v.kaufoption
    });
    v.status = 'erledigt';
    UI.toast(p.name + ' ist bis Saisonende an ' + ziel.name + ' verliehen.');
    UI.zeichne();
  }

  function angebotAnnehmen(v) {
    var st = UI.S(), mein = UI.meinKlub();
    if (!v) return;
    var p = st.spieler[v.spielerId];
    var kaeufer = st.klubs[v.zuKlubId];
    if (!p || !kaeufer) return;
    if (Game.kaderVon(st, mein).length <= 16) {
      UI.toast('Ihr Kader ist zu klein für einen weiteren Abgang.');
      return;
    }
    Game.transferAusfuehren(st, p, mein, kaeufer, v.gebot, null, { sofort: v.gebot });
    v.status = 'erledigt';
    Game.post(st, 'Abgang: ' + p.name,
      p.name + ' wechselt für ' + Fmt.money(v.gebot) + ' zu ' + kaeufer.name + '.', 'transfer');
    UI.toast(p.name + ' wurde für ' + Fmt.money(v.gebot) + ' verkauft.');
    UI.zeichne();
  }

  function mehrFordern(v) {
    var st = UI.S();
    if (!v) return;
    var p = st.spieler[v.spielerId];
    var kaeufer = st.klubs[v.zuKlubId];
    var vorschlag = Math.round(Math.max(v.gebot * 1.25, v.forderung) / 5000) * 5000;
    var html = '<p>' + Util.esc(kaeufer.name) + ' bietet <b>' + Fmt.money(v.gebot) + '</b> für ' +
      Util.esc(p.name) + '.</p>' +
      feldZahl('Ihre Forderung (€)', 'gForderung', vorschlag, 0, undefined, 5000) +
      '<p class="mini">Je weiter Sie über dem Gebot liegen, desto eher springt der Interessent ab. ' +
      'Sein geschätztes Transferbudget: ' + Fmt.money(kaeufer.finanzen.transferbudget) + '.</p>';

    UI.modal('Nachverhandeln', html, [
      {
        text: 'Forderung senden', klasse: 'knopf--haupt', schliessen: false,
        fn: function () {
          var wunsch = Math.max(0, +$('gForderung').value || 0);
          v.runde = (v.runde || 0) + 1;
          var grenze = Math.min(kaeufer.finanzen.transferbudget, v.forderung * 1.35);
          if (wunsch <= v.gebot) {
            v.gebot = wunsch;
            UI.modalZu(); UI.toast('Der Interessent stimmt sofort zu.');
          } else if (wunsch <= grenze && Game.rng.chance(0.75 - (wunsch / Math.max(1, grenze)) * 0.35)) {
            v.gebot = wunsch;
            UI.modalZu(); UI.toast(kaeufer.name + ' erhöht auf ' + Fmt.money(wunsch) + '.');
          } else if (v.runde >= 3 || wunsch > grenze * 1.3) {
            v.status = 'geplatzt';
            UI.modalZu(); UI.toast(kaeufer.name + ' zieht das Angebot zurück.');
          } else {
            var mitte = Math.round((wunsch + v.gebot) / 2 / 5000) * 5000;
            v.gebot = mitte;
            UI.modalZu(); UI.toast(kaeufer.name + ' bietet nun ' + Fmt.money(mitte) + '.');
          }
          UI.zeichne();
        }
      },
      { text: 'Abbrechen', klasse: 'knopf--still' }
    ]);
  }

  UI.feldZahl = feldZahl;
  UI.feldAuswahl = feldAuswahl;
  UI.feldText = feldText;
})(typeof window !== 'undefined' ? window : globalThis);
