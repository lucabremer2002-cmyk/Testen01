/* ui-transfer.js - Transfermarkt, Transferverhandlungen, Vertragsverhandlungen. */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  /* ---------- Transfermarkt ---------- */

  var filter = {
    bereich: 'alle', pos: 'alle', maxAlter: 40, minStaerke: 0,
    maxWert: 0, nation: 'alle', suche: '', sortierung: 'marktwert'
  };

  UI.seiten.transfermarkt = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var offen = Game.istTransferfenster(st);

    var html = '<div class="karte">' +
      '<div class="karte__kopf"><h2>Transfermarkt</h2>' +
      '<span class="marke ' + (offen ? 'marke--gut' : 'marke--gefahr') + '">' +
      (offen ? 'Transferfenster geöffnet' : 'Transferfenster geschlossen') + '</span></div>';

    if (!offen) {
      html += '<p class="hinweis">Verpflichtungen sind nur im Sommer (1. Juli bis 31. August) und ' +
        'im Winter (1. bis 31. Januar) möglich. Beobachten können Sie den Markt jederzeit.</p>';
    }

    html += '<div class="formularraster">' +
      feldAuswahl('Bereich', 'fBereich', [
        ['alle', 'Alle Vereine'], ['deutschland', 'Nur Deutschland'],
        ['international', 'Nur international'], ['ablösefrei', 'Nur vereinslose'],
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
    html += '<div class="knopfreihe" style="margin-top:.8rem">' +
      '<button class="knopf" id="fSuchen">Suchen</button>' +
      '<button class="knopf knopf--still" id="fReset">Filter zurücksetzen</button>' +
      '<span class="mini">Transferbudget: <b>' + Fmt.money(mein.finanzen.transferbudget) + '</b></span>' +
      '</div></div>';

    var treffer = Transfers.marktSuche(st, filter);
    html += '<div class="karte"><div class="karte__kopf"><h3>Ergebnisse</h3>' +
      '<span class="mini">' + Fmt.num(treffer.length) + ' Spieler gefunden' +
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
          '<td>' + (klub ? UI.klubZelle(klub, 18, true) : '<span class="gold">vereinslos</span>') + '</td>' +
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

  function feldAuswahl(titel, id, optionen, wert) {
    return '<label class="feld"><span>' + titel + '</span><select id="' + id + '">' +
      optionen.map(function (o) {
        return '<option value="' + Util.esc(o[0]) + '"' + (String(o[0]) === String(wert) ? ' selected' : '') + '>' +
          Util.esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
  }
  function feldZahl(titel, id, wert, min, max, schritt) {
    return '<label class="feld"><span>' + titel + '</span><input type="number" id="' + id + '" value="' + wert +
      '"' + (min !== undefined ? ' min="' + min + '"' : '') + (max !== undefined ? ' max="' + max + '"' : '') +
      (schritt ? ' step="' + schritt + '"' : '') + '></label>';
  }
  function feldText(titel, id, wert) {
    return '<label class="feld"><span>' + titel + '</span><input type="text" id="' + id + '" value="' + Util.esc(wert) + '"></label>';
  }

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

  /* ---------- Transferverhandlung (Kauf) ---------- */

  UI.transferVerhandlung = function (spielerId) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p) return;
    if (!Game.istTransferfenster(st)) {
      UI.modal('Transferfenster geschlossen',
        '<p>Verhandlungen sind nur während des Transferfensters möglich: ' +
        '1. Juli bis 31. August sowie 1. bis 31. Januar.</p>',
        [{ text: 'Verstanden', klasse: 'knopf--still' }]);
      return;
    }
    if (!p.klubId) { UI.vertragsVerhandlung(spielerId, true); return; }
    var verkaeufer = st.klubs[p.klubId];
    if (Game.kaderVon(st, mein).length >= 30) {
      UI.toast('Ihr Kader ist mit 30 Spielern voll.');
      return;
    }

    var v = st.verhandlungen.filter(function (x) {
      return x.typ === 'kauf' && x.spielerId === spielerId && x.status === 'offen';
    })[0];

    if (!v) {
      var kader = Game.kaderVon(st, verkaeufer);
      var ford = Transfers.forderung(p, kader, verkaeufer, mein, st.saison);
      v = Transfers.verhandlungStarten(st, {
        typ: 'kauf', spielerId: spielerId, vonKlubId: verkaeufer.id,
        zuKlubId: mein.id, tag: st.tag, forderung: ford
      });
      var bereit = Transfers.wechselbereitschaft(p, verkaeufer, mein, kader, st.saison);
      v.wechselbereitschaft = bereit;
      v.historie.push({
        von: 'verkaeufer',
        text: verkaeufer.name + ': „' + p.name + ' ist bei uns unter Vertrag. Unter ' +
          Fmt.money(ford) + ' brauchen wir gar nicht zu reden."'
      });
      if (bereit < 0.25) {
        v.historie.push({ von: 'spieler', text: 'Der Berater lässt durchblicken, dass ein Wechsel für den Spieler derzeit kaum in Frage kommt.' });
      } else if (bereit > 0.7) {
        v.historie.push({ von: 'spieler', text: 'Der Berater signalisiert: Der Spieler wäre einem Wechsel gegenüber sehr aufgeschlossen.' });
      }
      st.verhandlungen.push(v);
    }
    zeigeKaufVerhandlung(v);
  };

  function zeigeKaufVerhandlung(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var verkaeufer = st.klubs[v.vonKlubId];

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:.8rem;flex-wrap:wrap">' +
      UI.wappen(verkaeufer, 44) +
      '<div><b>' + Util.esc(p.name) + '</b> <span class="mini">' + p.pos + ' · ' + p.alter + ' Jahre · Stärke ' + p.staerke + '</span>' +
      '<div class="mini">' + Util.esc(verkaeufer.name) + ' · Marktwert ' + Fmt.money(p.marktwert) +
      ' · Vertrag bis ' + p.vertragBis + '</div></div></div>';

    html += verlaufHTML(v);

    if (v.phase === 'verein') {
      var vorschlag = Math.round(v.forderung * 0.85 / 5000) * 5000;
      html += '<h4>Ihr Angebot an ' + Util.esc(verkaeufer.name) + '</h4>' +
        '<div class="formularraster">' +
        feldZahl('Sofortzahlung (€)', 'aSofort', Math.min(vorschlag, mein.finanzen.transferbudget), 0, undefined, 5000) +
        feldZahl('Ratenzahlung (€)', 'aRaten', 0, 0, undefined, 5000) +
        feldAuswahl('Raten über', 'aRatenJahre', [[1, '1 Jahr'], [2, '2 Jahre'], [3, '3 Jahre'], [4, '4 Jahre']], 2) +
        feldZahl('Bonus nach 25 Einsätzen (€)', 'aBonus', 0, 0, undefined, 5000) +
        feldZahl('Bonus bei Aufstieg/Titel (€)', 'aBonusAuf', 0, 0, undefined, 5000) +
        feldZahl('Weiterverkauf (%)', 'aWeiter', 0, 0, 40, 1) +
        '</div>' +
        '<p class="mini" id="aSumme"></p>' +
        '<p class="mini">Ratenzahlungen und Boni schonen Ihr Budget, sind dem Verkäufer aber weniger wert als Bargeld. ' +
        'Ihr Transferbudget: <b>' + Fmt.money(mein.finanzen.transferbudget) + '</b></p>';
    } else if (v.phase === 'spieler') {
      html += vertragsFormular(p, mein, v, false);
    }

    var aktionen = [];
    if (v.phase === 'verein') {
      aktionen.push({
        text: 'Angebot abgeben', klasse: 'knopf--gold', schliessen: false,
        fn: function () { angebotAbgeben(v); }
      });
    } else if (v.phase === 'spieler') {
      aktionen.push({
        text: 'Vertrag anbieten', klasse: 'knopf--gold', schliessen: false,
        fn: function () { vertragAnbieten(v, p, mein, false); }
      });
    }
    if (v.phase === 'verein' || v.phase === 'spieler') {
      aktionen.push({
        text: 'Verhandlung abbrechen', klasse: 'knopf--gefahr',
        fn: function () {
          v.status = 'abgebrochen'; v.phase = 'geplatzt';
          UI.toast('Verhandlung abgebrochen.'); UI.zeichne();
        }
      });
    }
    aktionen.push({ text: 'Später', klasse: 'knopf--still' });

    UI.modal('Transferverhandlung', html, aktionen, true);
    if (v.phase === 'verein') summeAktualisieren();
  }

  function summeAktualisieren() {
    ['aSofort', 'aRaten', 'aBonus', 'aBonusAuf', 'aWeiter'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = rechne;
    });
    rechne();
    function rechne() {
      var s = +($('aSofort') || {}).value || 0;
      var r = +($('aRaten') || {}).value || 0;
      var b = +($('aBonus') || {}).value || 0;
      var ba = +($('aBonusAuf') || {}).value || 0;
      var el = $('aSumme');
      if (el) {
        el.innerHTML = 'Gesamtvolumen: <b>' + Fmt.money(s + r + b + ba) + '</b> ' +
          '(sofort fällig: ' + Fmt.money(s) + ')';
      }
    }
  }

  function angebotAbgeben(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var verkaeufer = st.klubs[v.vonKlubId];
    var angebot = {
      sofort: Math.max(0, +$('aSofort').value || 0),
      raten: Math.max(0, +$('aRaten').value || 0),
      ratenJahre: +$('aRatenJahre').value || 2,
      bonusEinsaetze: Math.max(0, +$('aBonus').value || 0),
      bonusAufstieg: Math.max(0, +$('aBonusAuf').value || 0),
      weiterverkauf: Util.clamp(+$('aWeiter').value || 0, 0, 40)
    };
    if (angebot.sofort > mein.finanzen.transferbudget) {
      UI.toast('Die Sofortzahlung übersteigt Ihr Transferbudget.');
      return;
    }
    if (Transfers.angebotGesamt(angebot) <= 0) {
      UI.toast('Bitte geben Sie ein Angebot ein.');
      return;
    }
    var kader = Game.kaderVon(st, verkaeufer);
    var antwort = Transfers.vereinAntwort(Game.rng, v, angebot, p, verkaeufer, kader);
    if (antwort.art === 'angenommen') {
      /* Der Spieler muss noch zustimmen. */
      var bereit = v.wechselbereitschaft === undefined ? 0.5 : v.wechselbereitschaft;
      if (bereit < 0.18) {
        v.phase = 'geplatzt'; v.status = 'geplatzt';
        v.historie.push({ von: 'spieler', text: 'Der Spieler lehnt Gespräche über einen Wechsel ab.' });
      }
      v.struktur = angebot;
    }
    if (v.status === 'geplatzt') {
      UI.toast('Die Verhandlung ist gescheitert.');
    }
    zeigeKaufVerhandlung(v);
    UI.kopfZeichnen();
    UI.menueZeichnen();
  }

  /* ---------- Vertragsformular ---------- */

  function vertragsFormular(p, klub, v, istVerlaengerung) {
    var st = UI.S();
    var rolleVor = (v && v.vertragEntwurf && v.vertragEntwurf.rolle) || 'stamm';
    var jahreVor = (v && v.spielerWunsch && v.spielerWunsch.jahre) || (p.alter >= 31 ? 2 : 3);
    var gehaltVor = (v && v.spielerWunsch && v.spielerWunsch.gehalt) ||
      Transfers.gehaltsforderung(p, klub, rolleVor, jahreVor, istVerlaengerung);
    var handgeldVor = (v && v.spielerWunsch && v.spielerWunsch.handgeld) ||
      Transfers.handgeldforderung(p, gehaltVor, jahreVor);

    var html = '<h4>' + (istVerlaengerung ? 'Neuer Vertrag für ' : 'Vertragsangebot an ') + Util.esc(p.name) + '</h4>';
    html += '<p class="mini">Aktuelles Gehalt: ' + Fmt.money(p.gehalt) + ' pro Woche · Vertrag bis ' + p.vertragBis + '</p>';
    html += '<div class="formularraster">' +
      feldZahl('Gehalt pro Woche (€)', 'vGehalt', Math.round(gehaltVor), 0, undefined, 10) +
      feldAuswahl('Laufzeit', 'vJahre', Transfers.VERTRAGSDAUER.map(function (j) {
        return [j, j + (j === 1 ? ' Jahr' : ' Jahre')];
      }), jahreVor) +
      feldZahl('Handgeld (€)', 'vHandgeld', Math.round(handgeldVor), 0, undefined, 1000) +
      feldAuswahl('Versprochene Rolle', 'vRolle', Transfers.ROLLEN.map(function (r) {
        return [r.id, r.name];
      }), rolleVor) +
      feldZahl('Ausstiegsklausel (€, 0 = keine)', 'vKlausel', 0, 0, undefined, 100000) +
      '</div>';
    html += '<p class="mini" id="vHinweis">Das Jahresgehalt beträgt ' +
      Fmt.money(gehaltVor * 52) + '.</p>';
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

  function vertragAnbieten(v, p, klub, istVerlaengerung) {
    var st = UI.S();
    var vertrag = vertragLesen();
    var altKlub = p.klubId ? st.klubs[p.klubId] : null;
    var kader = Game.kaderVon(st, klub);
    var antwort = Transfers.spielerAntwort(Game.rng, v, vertrag, p, klub, altKlub, kader, st.saison, istVerlaengerung);

    if (antwort.art === 'angenommen') {
      abschluss(v, p, klub, vertrag, istVerlaengerung);
      return;
    }
    v.vertragEntwurf = vertrag;
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
        Finance.buchen(klub.finanzen, st.tag, 'Vertrag', 'Handgeld ' + p.name, -vertrag.handgeld, 'Handgelder');
      }
      v.status = 'erledigt'; v.phase = 'fertig';
      UI.modalZu();
      UI.toast(p.name + ' hat bis ' + p.vertragBis + ' verlängert.');
      Game.post(st, 'Vertrag verlängert: ' + p.name,
        p.name + ' hat einen neuen Vertrag bis ' + p.vertragBis + ' unterschrieben. Wochengehalt: ' +
        Fmt.money(vertrag.gehalt) + '.', 'gut');
    } else {
      var verkaeufer = p.klubId ? st.klubs[p.klubId] : null;
      var struktur = v.struktur || { sofort: 0 };
      var gesamt = Transfers.angebotGesamt(struktur);
      Game.transferAusfuehren(st, p, verkaeufer, klub, gesamt, vertrag, struktur);
      v.status = 'erledigt'; v.phase = 'fertig';
      UI.modalZu();
      UI.toast(p.name + ' wechselt zu ' + klub.name + '!');
      Game.post(st, 'Neuzugang: ' + p.name,
        p.name + ' (' + p.pos + ', ' + p.alter + ') hat unterschrieben' +
        (verkaeufer ? ' und kommt von ' + verkaeufer.name : ' und war vereinslos') +
        '. Ablöse: ' + (gesamt ? Fmt.money(gesamt) : 'keine') +
        ', Gehalt: ' + Fmt.money(vertrag.gehalt) + ' pro Woche bis ' + p.vertragBis + '.', 'gut');
    }
    UI.zeichne();
  }

  /* ---------- Vertragsverlängerung / vereinslose Spieler ---------- */

  UI.vertragsVerhandlung = function (spielerId, ablösefrei) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[spielerId];
    if (!p) return;
    if (ablösefrei && !Game.istTransferfenster(st)) {
      UI.modal('Transferfenster geschlossen',
        '<p>Vereinslose Spieler können Sie nur im Transferfenster verpflichten.</p>',
        [{ text: 'Verstanden', klasse: 'knopf--still' }]);
      return;
    }
    var v = st.verhandlungen.filter(function (x) {
      return x.typ === 'vertrag' && x.spielerId === spielerId && x.status === 'offen';
    })[0];
    if (!v) {
      v = Transfers.verhandlungStarten(st, {
        typ: 'vertrag', spielerId: spielerId,
        vonKlubId: p.klubId, zuKlubId: mein.id, tag: st.tag, forderung: 0
      });
      v.phase = 'spieler';
      v.ablösefrei = !!ablösefrei;
      st.verhandlungen.push(v);
    }
    zeigeVerlaengerung(v);
  };

  function zeigeVerlaengerung(v) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[v.spielerId];
    var istVerlaengerung = !v.ablösefrei;

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:.8rem">' +
      UI.wappen(mein, 44) +
      '<div><b>' + Util.esc(p.name) + '</b> <span class="mini">' + p.pos + ' · ' + p.alter +
      ' Jahre · Stärke ' + p.staerke + ' · Marktwert ' + Fmt.money(p.marktwert) + '</span></div></div>';
    html += verlaufHTML(v);
    if (v.phase === 'spieler') {
      html += vertragsFormular(p, mein, v, istVerlaengerung);
    }

    var aktionen = [];
    if (v.phase === 'spieler') {
      aktionen.push({
        text: istVerlaengerung ? 'Vertrag anbieten' : 'Verpflichten', klasse: 'knopf--gold', schliessen: false,
        fn: function () { vertragAnbieten(v, p, mein, istVerlaengerung); }
      });
      aktionen.push({
        text: 'Abbrechen', klasse: 'knopf--gefahr',
        fn: function () { v.status = 'abgebrochen'; v.phase = 'geplatzt'; UI.zeichne(); }
      });
    }
    aktionen.push({ text: 'Später', klasse: 'knopf--still' });
    UI.modal(istVerlaengerung ? 'Vertragsverhandlung' : 'Ablösefreie Verpflichtung', html, aktionen, true);
  }

  function verlaufHTML(v) {
    if (!v.historie.length) return '';
    return '<div class="verlauf">' + v.historie.slice(-8).map(function (h) {
      var wer = h.von === 'kaeufer' ? 'Sie' : (h.von === 'spieler' ? 'Spieler / Berater' : 'Verein');
      return '<div class="verlauf__zeile ' + h.von + '"><span class="verlauf__wer">' + wer + '</span>' +
        Util.esc(h.text) + '</div>';
    }).join('') + '</div>';
  }

  /* ---------- Verhandlungsübersicht ---------- */

  UI.seiten.verhandlungen = function () {
    var st = UI.S();
    var offen = st.verhandlungen.filter(function (v) { return v.status === 'offen'; });
    var eingehend = offen.filter(function (v) { return v.typ === 'verkauf'; });
    var eigene = offen.filter(function (v) { return v.typ !== 'verkauf'; });

    var html = '';

    html += '<div class="karte"><div class="karte__kopf"><h2>Angebote für Ihre Spieler</h2>' +
      '<span class="mini">' + eingehend.length + ' offen</span></div>';
    if (!eingehend.length) {
      html += '<p class="hinweis">Derzeit liegt kein Angebot für einen Ihrer Spieler vor. ' +
        'Setzen Sie Spieler auf die Transferliste, um Interessenten anzulocken.</p>';
    } else {
      html += eingehend.map(function (v) {
        var p = st.spieler[v.spielerId];
        var interessent = st.klubs[v.zuKlubId];
        if (!p || !interessent) return '';
        return '<div class="nachricht transfer">' +
          '<div class="nachricht__kopf"><span class="nachricht__betreff">' +
          Util.esc(p.name) + ' · ' + Util.esc(interessent.name) + '</span>' +
          '<span class="nachricht__datum">bis ' + Fmt.date(v.frist, st.saison) + '</span></div>' +
          '<p class="nachricht__text">Gebot: <b>' + Fmt.money(v.gebot) + '</b> · Marktwert ' +
          Fmt.money(p.marktwert) + ' · Ihre Vorstellung wäre ' + Fmt.money(v.forderung) + '.</p>' +
          '<div class="knopfreihe" style="margin-top:.5em">' +
          '<button class="knopf knopf--klein knopf--gold" data-annehmen="' + v.id + '">Annehmen</button>' +
          '<button class="knopf knopf--klein" data-fordern="' + v.id + '">Mehr fordern</button>' +
          '<button class="knopf knopf--klein knopf--gefahr" data-ablehnen="' + v.id + '">Ablehnen</button>' +
          '<button class="knopf knopf--klein knopf--still" data-spieler="' + p.id + '">Spieler ansehen</button>' +
          '</div></div>';
      }).join('');
    }
    html += '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h2>Ihre laufenden Verhandlungen</h2></div>';
    if (!eigene.length) {
      html += '<p class="hinweis">Sie führen derzeit keine Verhandlungen. ' +
        'Im Transfermarkt finden Sie neue Spieler.</p>';
    } else {
      html += '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Spieler</th><th>Verein</th>' +
        '<th>Art</th><th>Stand</th><th class="zahl">Forderung</th><th></th></tr></thead><tbody>' +
        eigene.map(function (v) {
          var p = st.spieler[v.spielerId];
          if (!p) return '';
          var klub = v.vonKlubId ? st.klubs[v.vonKlubId] : null;
          var stand = v.phase === 'verein' ? 'Ablöse wird verhandelt' :
            (v.phase === 'spieler' ? 'Gespräch mit dem Spieler' : v.phase);
          return '<tr><td><b>' + Util.esc(p.name) + '</b></td>' +
            '<td>' + (klub ? UI.klubZelle(klub, 18, true) : '<span class="mini">vereinslos</span>') + '</td>' +
            '<td>' + (v.typ === 'kauf' ? 'Verpflichtung' : 'Vertrag') + '</td>' +
            '<td>' + stand + '</td>' +
            '<td class="zahl">' + (v.forderung ? Fmt.money(v.forderung) : '–') + '</td>' +
            '<td><button class="knopf knopf--klein knopf--gold" data-weiter="' + v.id + '">Fortsetzen</button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</div>';

    var erledigt = st.verhandlungen.filter(function (v) { return v.status !== 'offen'; }).slice(0, 12);
    if (erledigt.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Abgeschlossene Gespräche</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><tbody>' +
        erledigt.map(function (v) {
          var p = st.spieler[v.spielerId];
          return '<tr><td>' + Util.esc(p ? p.name : '–') + '</td><td class="mini">' +
            (v.status === 'erledigt' ? '<span class="gut">abgeschlossen</span>' :
              (v.status === 'abgelaufen' ? 'Frist abgelaufen' : 'gescheitert')) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
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
  };

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
      Util.esc(p.name) + '. Nennen Sie Ihre Forderung.</p>' +
      feldZahl('Ihre Forderung (€)', 'gForderung', vorschlag, 0, undefined, 5000) +
      '<p class="mini">Je weiter Sie über dem Gebot liegen, desto wahrscheinlicher springt der Interessent ab. ' +
      'Das Transferbudget des Vereins beträgt geschätzt ' + Fmt.money(kaeufer.finanzen.transferbudget) + '.</p>';

    UI.modal('Nachverhandeln', html, [
      {
        text: 'Forderung senden', klasse: 'knopf--gold', schliessen: false,
        fn: function () {
          var wunsch = Math.max(0, +$('gForderung').value || 0);
          v.runde = (v.runde || 0) + 1;
          v.historie.push({ von: 'verkaeufer', text: 'Wir fordern ' + Fmt.money(wunsch) + '.' });
          var grenze = Math.min(kaeufer.finanzen.transferbudget, v.forderung * 1.35);
          if (wunsch <= v.gebot) {
            v.gebot = wunsch;
            UI.modalZu(); UI.toast('Der Interessent stimmt sofort zu.');
            v.historie.push({ von: 'kaeufer', text: 'Einverstanden.' });
            UI.zeichne();
            return;
          }
          if (wunsch <= grenze && Game.rng.chance(0.75 - (wunsch / Math.max(1, grenze)) * 0.35)) {
            v.gebot = wunsch;
            v.historie.push({ von: 'kaeufer', text: 'Wir gehen mit: ' + Fmt.money(wunsch) + '.' });
            UI.modalZu(); UI.toast(kaeufer.name + ' erhöht auf ' + Fmt.money(wunsch) + '.');
          } else if (v.runde >= 3 || wunsch > grenze * 1.3) {
            v.status = 'geplatzt';
            v.historie.push({ von: 'kaeufer', text: 'Das ist uns zu viel. Wir ziehen unser Angebot zurück.' });
            UI.modalZu(); UI.toast(kaeufer.name + ' zieht das Angebot zurück.');
          } else {
            var mitte = Math.round((wunsch + v.gebot) / 2 / 5000) * 5000;
            v.gebot = mitte;
            v.historie.push({ von: 'kaeufer', text: 'Unser letztes Wort: ' + Fmt.money(mitte) + '.' });
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
