/* ui-verein.js - Sponsoring, Stadion, Bank und Finanzen. */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  /* ---------- Sponsoring ---------- */

  UI.seiten.sponsoring = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen;
    var jahr = Util.sum(Finance.SLOTS, function (s) {
      var sp = fin.sponsoren[s.id];
      return sp ? sp.fixJahr : 0;
    });

    var html = '<div class="raster raster--3">' +
      UI.kennzahl('Sponsoreneinnahmen', Fmt.money(jahr), 'pro Jahr, fest zugesagt') +
      UI.kennzahl('Pro Woche', Fmt.money(Finance.sponsorEinnahmenWoche(fin)), 'laufende Zahlung') +
      UI.kennzahl('Offene Angebote', String(Object.keys(fin.sponsorAngebote || {}).length), 'warten auf Entscheidung') +
      '</div>';

    Finance.SLOTS.forEach(function (slot) {
      var sp = fin.sponsoren[slot.id];
      var angebote = (fin.sponsorAngebote || {})[slot.id];
      html += '<div class="karte"><div class="karte__kopf"><h3>' + Util.esc(slot.name) + '</h3>' +
        (sp ? '<span class="marke marke--gut">Vertrag bis ' + sp.bisSaison + '</span>'
            : '<span class="marke marke--gefahr">kein Partner</span>') + '</div>';

      if (sp) {
        html += '<div class="raster raster--4" style="margin-bottom:.8rem">' +
          UI.kennzahl('Partner', Util.esc(sp.firma), 'seit ' + sp.seitSaison) +
          UI.kennzahl('Festbetrag', Fmt.money(sp.fixJahr), 'pro Jahr') +
          UI.kennzahl('Siegprämie', Fmt.money(sp.siegBonus), 'je Sieg') +
          UI.kennzahl('Erfolgsbonus', Fmt.money(sp.titelBonus), 'Meisterschaft · ' + Fmt.money(sp.aufstiegBonus) + ' Aufstieg') +
          '</div>';
      }

      if (angebote && angebote.length) {
        html += '<h4>Angebote</h4><div class="raster raster--3">' +
          angebote.map(function (a) {
            return '<div class="kennzahl" style="display:flex;flex-direction:column;gap:.4em">' +
              '<span>' + Util.esc(a.label) + '</span>' +
              '<b style="font-size:1.05rem">' + Util.esc(a.firma) + '</b>' +
              '<div class="mini">Laufzeit: <b>' + a.jahre + (a.jahre === 1 ? ' Jahr' : ' Jahre') + '</b></div>' +
              '<div class="mini">Fest: <b>' + Fmt.money(a.fixJahr) + '</b> pro Jahr</div>' +
              '<div class="mini">Je Sieg: ' + Fmt.money(a.siegBonus) + '</div>' +
              '<div class="mini">Meisterschaft: ' + Fmt.money(a.titelBonus) + '</div>' +
              '<div class="mini">Aufstieg: ' + Fmt.money(a.aufstiegBonus) + '</div>' +
              '<div class="mini">Gesamtvolumen: <b>' + Fmt.money(a.fixJahr * a.jahre) + '</b></div>' +
              '<button class="knopf knopf--klein knopf--haupt" data-sponsor="' + a.id + '" data-slot="' + slot.id + '">' +
              (sp ? 'Partner wechseln' : 'Vertrag abschließen') + '</button></div>';
          }).join('') + '</div>' +
          '<p class="mini" style="margin-top:.6em">Bei Abschluss wird ein Viertel der Jahressumme sofort ausgezahlt.</p>';
      } else if (!sp) {
        html += '<p class="hinweis">Zurzeit liegt kein Angebot vor. Neue Angebote kommen, sobald der Verein ' +
          'sportlich überzeugt oder der alte Vertrag ausläuft.</p>';
      } else {
        html += '<p class="hinweis">Der laufende Vertrag endet nach der Saison ' + sp.bisSaison +
          '. Danach können Sie neu verhandeln.</p>';
      }
      html += '</div>';
    });
    return html;
  };

  UI.nachZeichnen.sponsoring = function () {
    var st = UI.S(), mein = UI.meinKlub();
    Array.prototype.forEach.call(document.querySelectorAll('[data-sponsor]'), function (b) {
      b.onclick = function () {
        var slot = b.dataset.slot;
        var liste = mein.finanzen.sponsorAngebote[slot] || [];
        var a = liste.filter(function (x) { return x.id === b.dataset.sponsor; })[0];
        if (!a) return;
        UI.modal('Vertrag mit ' + a.firma,
          '<p>Sie schließen einen Vertrag über <b>' + a.jahre + (a.jahre === 1 ? ' Jahr' : ' Jahre') +
          '</b> ab.</p><ul><li>Festbetrag: <b>' + Fmt.money(a.fixJahr) + '</b> pro Jahr</li>' +
          '<li>Siegprämie: ' + Fmt.money(a.siegBonus) + '</li>' +
          '<li>Meisterprämie: ' + Fmt.money(a.titelBonus) + '</li>' +
          '<li>Aufstiegsprämie: ' + Fmt.money(a.aufstiegBonus) + '</li></ul>' +
          '<p class="mini">Sofort ausgezahlt werden ' + Fmt.money(a.fixJahr * 0.25) + '.</p>',
          [
            {
              text: 'Unterschreiben', klasse: 'knopf--haupt',
              fn: function () {
                Finance.sponsorAbschliessen(mein.finanzen, a, st.saison, st.tag);
                UI.toast('Vertrag mit ' + a.firma + ' abgeschlossen.');
                UI.zeichne();
              }
            },
            { text: 'Abbrechen', klasse: 'knopf--still' }
          ]);
      };
    });
  };

  /* ---------- Stadion ---------- */

  UI.seiten.stadion = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen;
    var sd = fin.stadion;
    var kap = Finance.kapazitaet(sd);
    var ref = Finance.PREIS_REFERENZ[mein.stufe] || Finance.PREIS_REFERENZ[4];

    var html = '<div class="raster raster--4">' +
      UI.kennzahl('Stadion', Util.esc(sd.name), Util.esc(mein.stadt)) +
      UI.kennzahl('Kapazität', Fmt.num(kap), 'Plätze') +
      UI.kennzahl('Letzter Zuschauerschnitt', Fmt.num(sd.zuletztZuschauer || 0),
        kap ? Fmt.pct((sd.zuletztZuschauer || 0) / kap) + ' Auslastung' : '') +
      UI.kennzahl('Unterhalt', Fmt.money(Finance.unterhaltWoche(fin, mein.stufe)), 'pro Woche') +
      '</div>';

    /* Draufsicht – sie ändert sich mit jedem Ausbau. */
    html += '<div class="karte"><div class="karte__kopf"><h3>Ihr Stadion</h3>' +
      '<span class="mini">' + StadionGrafik.raenge(kap) +
      (StadionGrafik.raenge(kap) === 1 ? ' Rang' : ' Ränge') + ' · ' +
      Fmt.num(sd.sektoren.steh.plaetze) + ' Steh · ' + Fmt.num(sd.sektoren.sitz.plaetze) +
      ' Sitz · ' + Fmt.num(sd.sektoren.vip.plaetze) + ' VIP</span></div>' +
      '<div id="stadionBild" class="stadionrahmen">' + StadionGrafik.svg(mein, sd, {}) + '</div>' +
      '<div class="stadionteile">' + Finance.MODULE.map(function (m) {
        var da = !!sd.module[m.id];
        return '<span class="marke' + (da ? ' marke--akzent' : '') + '"' +
          (da ? '' : ' style="opacity:.45"') + '>' + Util.esc(m.name) + '</span>';
      }).join('') + '</div></div>';

    /* Laufende Baumaßnahme */
    if (sd.ausbau) {
      var a = sd.ausbau;
      var gesamt = a.fertigTag - a.startTag;
      var fortschritt = Util.clamp((st.tag - a.startTag) / Math.max(1, gesamt) * 100, 0, 100);
      html += '<div class="karte"><div class="karte__kopf"><h3>Baustelle</h3>' +
        '<span class="marke marke--warn">noch ' + Math.max(0, a.fertigTag - st.tag) + ' Tage</span></div>' +
        '<p>' + (a.art === 'modul' ? Util.esc(a.name) : a.plaetze + ' neue ' + Finance.sektorName(a.sektor)) +
        ' · Kosten ' + Fmt.money(a.kosten) + '</p>' +
        '<div class="fortschritt"><i style="width:' + fortschritt.toFixed(0) + '%"></i></div></div>';
    }

    /* Eintrittspreise */
    html += '<div class="karte"><div class="karte__kopf"><h2>Eintrittspreise</h2>' +
      '<span class="mini">Übliche Preise in Ihrer Liga: Steh ' + ref.steh + ' € · Sitz ' + ref.sitz +
      ' € · VIP ' + ref.vip + ' €</span></div>' +
      '<div class="formularraster">' +
      ['steh', 'sitz', 'vip'].map(function (s) {
        return '<label class="feld"><span>' + Finance.sektorName(s) + ' (' + Fmt.num(sd.sektoren[s].plaetze) +
          ' Plätze)</span><input type="number" id="preis_' + s + '" min="1" step="1" value="' +
          sd.sektoren[s].preis + '"></label>';
      }).join('') + '</div>' +
      '<div class="knopfreihe" style="margin-top:.6rem">' +
      '<button class="knopf knopf--haupt" id="preiseSpeichern">Preise übernehmen</button>' +
      '<button class="knopf knopf--still" id="preiseStandard">Ligaüblich setzen</button></div>' +
      '<p class="mini" style="margin-top:.6em">Hohe Preise bringen mehr pro Besucher, schrecken aber Zuschauer ab. ' +
      'Bei voller Auslastung lohnt sich eine Erhöhung fast immer.</p>' +
      '<p class="mini">Erwartete Einnahmen bei ausverkauftem Haus: <b>' +
      Fmt.money(Finance.spieltagEinnahmen(fin, kap).gesamt) + '</b> pro Heimspiel.</p>' +
      '</div>';

    /* Ausbau */
    html += '<div class="karte"><div class="karte__kopf"><h3>Ausbau</h3></div>';
    if (sd.ausbau) {
      html += '<p class="hinweis">Solange eine Baumaßnahme läuft, kann keine zweite begonnen werden.</p>';
    } else {
      html += '<div class="formularraster">' +
        UI.feldAuswahl('Bereich', 'ausbauSektor', [['steh', 'Stehplätze (1.100 € je Platz)'],
          ['sitz', 'Sitzplätze (2.400 € je Platz)'], ['vip', 'VIP-Plätze (11.000 € je Platz)']], 'sitz') +
        UI.feldZahl('Zusätzliche Plätze', 'ausbauPlaetze', 2000, 100, 40000, 100) +
        '</div>' +
        '<p class="mini" id="ausbauInfo"></p>' +
        '<button class="knopf knopf--haupt" id="ausbauStart">Ausbau beauftragen</button>' +
        '<p class="mini" style="margin-top:.6em">Die Draufsicht oben zeigt den geplanten Zustand, ' +
        'solange Sie hier etwas verändern.</p>';
    }
    html += '</div>';

    /* Module */
    html += '<div class="karte"><div class="karte__kopf"><h3>Ausstattung</h3></div><div class="raster raster--3">' +
      Finance.MODULE.map(function (m) {
        var vorhanden = !!sd.module[m.id];
        return '<div class="kennzahl" style="display:flex;flex-direction:column;gap:.35em">' +
          '<span>' + Util.esc(m.name) + '</span>' +
          (vorhanden ? '<b class="gut">vorhanden</b>' : '<b>' + Fmt.money(m.kosten) + '</b>') +
          '<div class="mini">' + Util.esc(m.text) + '</div>' +
          (vorhanden ? '<div class="mini">Unterhalt ' + Fmt.money(m.unterhalt) + '/Woche</div>'
            : '<div class="mini">Bauzeit ' + m.tage + ' Tage · Unterhalt ' + Fmt.money(m.unterhalt) + '/Woche</div>') +
          (vorhanden || sd.ausbau ? '' :
            '<button class="knopf knopf--klein knopf--haupt" data-modul="' + m.id + '">Bauen</button>') +
          '</div>';
      }).join('') + '</div></div>';
    return html;
  };

  UI.nachZeichnen.stadion = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen, sd = fin.stadion;

    var speichern = $('preiseSpeichern');
    if (speichern) speichern.onclick = function () {
      ['steh', 'sitz', 'vip'].forEach(function (s) {
        var v = Math.max(1, Math.round(+$('preis_' + s).value || 1));
        sd.sektoren[s].preis = v;
      });
      UI.toast('Eintrittspreise angepasst.');
      UI.zeichne();
    };
    var standard = $('preiseStandard');
    if (standard) standard.onclick = function () {
      var ref = Finance.PREIS_REFERENZ[mein.stufe] || Finance.PREIS_REFERENZ[4];
      sd.sektoren.steh.preis = ref.steh;
      sd.sektoren.sitz.preis = ref.sitz;
      sd.sektoren.vip.preis = ref.vip;
      UI.zeichne();
    };

    /* Die Vorschau erscheint erst, wenn wirklich etwas eingestellt wurde -
       beim Öffnen zeigt die Draufsicht den heutigen Zustand. */
    function ausbauInfo(mitVorschau) {
      var sektor = $('ausbauSektor'), plaetze = $('ausbauPlaetze'), info = $('ausbauInfo');
      if (!sektor || !info) return;
      var n = Math.max(0, +plaetze.value || 0);
      var kosten = Finance.ausbauKosten(sektor.value, n);
      var dauer = Finance.ausbauDauer(n);
      var alteKap = Finance.kapazitaet(sd);
      var neueKap = alteKap + n;
      info.innerHTML = 'Kosten: <b>' + Fmt.money(kosten) + '</b> · Bauzeit: <b>' + dauer + ' Tage</b> · ' +
        'Kapazität: <b>' + Fmt.num(alteKap) + ' → ' + Fmt.num(neueKap) + '</b>' +
        (StadionGrafik.raenge(neueKap) > StadionGrafik.raenge(alteKap)
          ? ' <span class="akzent">– das Stadion bekommt einen weiteren Rang.</span>' : '') +
        (kosten > Game.verfuegbaresGeld(st, mein)
          ? ' <span class="schlecht">– dafür reicht das freie Guthaben nicht.</span>' : '');
      if (!mitVorschau) return;
      var bild = $('stadionBild');
      if (bild) {
        bild.innerHTML = StadionGrafik.svg(mein, sd,
          n > 0 ? { vorschau: { sektor: sektor.value, plaetze: n } } : {});
        bild.classList.toggle('stadionrahmen--vorschau', n > 0);
      }
    }
    ['ausbauSektor', 'ausbauPlaetze'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = el.onchange = function () { ausbauInfo(true); };
    });
    ausbauInfo(false);

    var start = $('ausbauStart');
    if (start) start.onclick = function () {
      var r = Finance.ausbauStarten(fin, st.tag, $('ausbauSektor').value,
        Math.max(0, +$('ausbauPlaetze').value || 0), Game.verfuegbaresGeld(st, mein));
      if (!r.ok) { UI.toast(r.grund); return; }
      UI.toast('Bauauftrag erteilt. Fertigstellung in ' + r.dauer + ' Tagen.');
      UI.zeichne();
    };

    Array.prototype.forEach.call(document.querySelectorAll('[data-modul]'), function (b) {
      b.onclick = function () {
        var m = Util.byId(Finance.MODULE, b.dataset.modul);
        UI.modal(m.name, '<p>' + Util.esc(m.text) + '</p>' +
          '<p>Kosten: <b>' + Fmt.money(m.kosten) + '</b> · Bauzeit: <b>' + m.tage + ' Tage</b> · ' +
          'laufender Unterhalt: ' + Fmt.money(m.unterhalt) + ' pro Woche.</p>' +
          '<p class="mini">Frei verfügbar: ' + Fmt.money(Game.verfuegbaresGeld(st, mein)) + '</p>',
          [
            {
              text: 'Bauen', klasse: 'knopf--haupt',
              fn: function () {
                var r = Finance.modulBauen(fin, st.tag, m.id, Game.verfuegbaresGeld(st, mein));
                if (!r.ok) { UI.toast(r.grund); return; }
                UI.toast('Bauauftrag erteilt.');
                UI.zeichne();
              }
            },
            { text: 'Abbrechen', klasse: 'knopf--still' }
          ]);
      };
    });
  };

  /* ---------- Bank ---------- */

  UI.seiten.bank = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen;
    var stufe = mein.stufe;
    var rahmen = Finance.kreditRahmen(mein, fin, stufe);
    var bonitaet = Finance.bonitaet(mein, fin, stufe);
    var schulden = Finance.restschuld(fin);
    var raten = Finance.offeneRaten(fin);
    var wochenRate = Util.sum(fin.kredite, function (k) { return k.rate; });

    var note = bonitaet >= 80 ? 'sehr gut' : (bonitaet >= 60 ? 'gut' : (bonitaet >= 40 ? 'befriedigend' :
      (bonitaet >= 22 ? 'ausreichend' : 'kritisch')));

    var html = '<div class="raster raster--4">' +
      UI.kennzahl('Kontostand', Fmt.money(fin.kontostand), fin.kontostand < 0 ? 'im Dispo (' +
        (Finance.DISPO_ZINS * 100).toFixed(1).replace('.', ',') + ' % p. a.)' : '') +
      UI.kennzahl('Bonität', bonitaet + ' / 100', note) +
      UI.kennzahl('Restschulden', Fmt.money(schulden),
        fin.kredite.length === 1 ? 'ein laufender Kredit' : fin.kredite.length + ' laufende Kredite') +
      UI.kennzahl('Freier Kreditrahmen', Fmt.money(rahmen), 'Wochenrate aktuell ' + Fmt.money(wochenRate)) +
      '</div>';

    if (raten > 0) {
      html += '<div class="karte"><h3>Offene Transferraten</h3>' +
        '<p class="hinweis">Aus Ratenzahlungen für Transfers stehen noch <b>' + Fmt.money(raten) +
        '</b> aus. Diese mindern Ihre Bonität.</p>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Spieler</th><th class="zahl">Wochenrate</th>' +
        '<th class="zahl">Restwochen</th><th>Empfänger</th></tr></thead><tbody>' +
        fin.verpflichtungen.filter(function (v) { return v.art === 'rate'; }).map(function (v) {
          var k = st.klubs[v.anKlubId];
          return '<tr><td>' + Util.esc(v.text) + '</td><td class="zahl">' + Fmt.money(v.wocheBetrag) + '</td>' +
            '<td class="zahl">' + v.restWochen + '</td><td>' + (k ? UI.klubZelle(k, 16, true) : '–') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    html += '<div class="karte"><div class="karte__kopf"><h3>Neuen Kredit aufnehmen</h3></div>';
    if (rahmen < 10000) {
      html += '<p class="hinweis">Die Bank gewährt derzeit keinen weiteren Kredit. ' +
        'Verbessern Sie zuerst Ihre Bonität, indem Sie Schulden abbauen oder Einnahmen steigern.</p>';
    } else {
      html += '<div class="formularraster">' +
        UI.feldAuswahl('Verwendungszweck', 'krZweck', [
          ['betrieb', 'Betriebsmittel'], ['transfer', 'Transferkredit']
        ], 'betrieb') +
        UI.feldZahl('Betrag (€)', 'krBetrag', Math.round(rahmen * 0.3 / 10000) * 10000, 10000, rahmen, 10000) +
        UI.feldAuswahl('Laufzeit', 'krJahre', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (j) {
          return [j, j + (j === 1 ? ' Jahr' : ' Jahre')];
        }), 4) +
        '</div>' +
        '<p class="hinweis" id="krZweckText" style="margin-top:.3em"></p>' +
        '<p class="mini" id="krInfo"></p>' +
        '<button class="knopf knopf--haupt" id="krAufnehmen">Kredit aufnehmen</button>' +
        '<p class="mini" style="margin-top:.6em">Der Zinssatz hängt von Ihrer Bonität, der Ligazugehörigkeit ' +
        'und der Laufzeit ab. Die Tilgung erfolgt wöchentlich als gleichbleibende Rate und läuft ' +
        'unabhängig davon weiter, ob sich der Einkauf sportlich auszahlt.</p>';
    }
    html += '</div>';

    if (fin.kredite.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Laufende Kredite</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Aufgenommen</th>' +
        '<th>Zweck</th>' +
        '<th class="zahl">Ursprung</th><th class="zahl">Restschuld</th><th class="zahl">Zins</th>' +
        '<th class="zahl">Wochenrate</th><th class="zahl">Restwochen</th><th class="zahl">Zinsen gezahlt</th>' +
        '<th></th></tr></thead><tbody>' +
        fin.kredite.map(function (k) {
          var zw = Finance.ZWECKE[k.zweck] || Finance.ZWECKE.betrieb;
          return '<tr><td class="mini">' + Fmt.date(k.aufgenommenTag, st.saison) + '</td>' +
            '<td><span class="marke' + (k.zweck === 'transfer' ? ' marke--akzent' : '') + '">' +
            Util.esc(zw.name) + '</span></td>' +
            '<td class="zahl">' + Fmt.money(k.betrag) + '</td>' +
            '<td class="zahl"><b>' + Fmt.money(k.restschuld) + '</b></td>' +
            '<td class="zahl">' + (k.zinssatz * 100).toFixed(2).replace('.', ',') + ' %</td>' +
            '<td class="zahl">' + Fmt.money(k.rate) + '</td>' +
            '<td class="zahl">' + k.restWochen + '</td>' +
            '<td class="zahl mini">' + Fmt.money(k.gezahlteZinsen) + '</td>' +
            '<td><button class="knopf knopf--klein" data-tilgen="' + k.id + '">Sondertilgung</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  UI.nachZeichnen.bank = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen;

    function info() {
      var b = $('krBetrag'), j = $('krJahre'), el = $('krInfo');
      if (!b || !el) return;
      var zweck = ($('krZweck') || {}).value || 'betrieb';
      var betrag = Math.max(0, +b.value || 0);
      var jahre = +j.value || 1;
      var z = Finance.zinssatz(mein, fin, mein.stufe, jahre, zweck);
      var iw = z / 52, wochen = jahre * 52;
      var rate = betrag * iw / (1 - Math.pow(1 + iw, -wochen));
      var zt = $('krZweckText');
      if (zt) {
        zt.innerHTML = Util.esc(Finance.ZWECKE[zweck].text) +
          (zweck === 'transfer'
            ? ' Ihr Transferbudget stiege damit von <b>' + Fmt.money(fin.transferbudget) +
              '</b> auf <b>' + Fmt.money(fin.transferbudget + betrag) + '</b>.'
            : '');
      }
      var mehr = Finance.zinssatz(mein, fin, mein.stufe, jahre, 'transfer') -
                 Finance.zinssatz(mein, fin, mein.stufe, jahre, 'betrieb');
      el.innerHTML = 'Zinssatz: <b>' + (z * 100).toFixed(2).replace('.', ',') + ' %</b> pro Jahr' +
        (zweck === 'transfer' ? ' <span class="mini">(inklusive ' +
          (mehr * 100).toFixed(1).replace('.', ',') + ' Punkte Aufschlag)</span>' : '') +
        ' · Wochenrate: <b>' + Fmt.money(rate) + '</b> · ' +
        'Gesamtrückzahlung: <b>' + Fmt.money(rate * wochen) + '</b> ' +
        '(Zinskosten ' + Fmt.money(rate * wochen - betrag) + ')';
    }
    ['krBetrag', 'krJahre', 'krZweck'].forEach(function (id) {
      var el = $(id);
      if (el) el.oninput = el.onchange = info;
    });
    info();

    var b = $('krAufnehmen');
    if (b) b.onclick = function () {
      var betrag = Math.max(0, +$('krBetrag').value || 0);
      var jahre = +$('krJahre').value || 1;
      var zweck = $('krZweck').value;
      var r = Finance.kreditAufnehmen(mein, fin, mein.stufe, betrag, jahre, st.tag, zweck);
      if (!r.ok) { UI.toast(r.grund); return; }
      UI.toast(zweck === 'transfer'
        ? 'Transferkredit über ' + Fmt.money(betrag) + ' aufgenommen – das Transferbudget ist erhöht.'
        : 'Kredit über ' + Fmt.money(betrag) + ' aufgenommen.');
      Game.post(st, Finance.ZWECKE[zweck].name + ' aufgenommen',
        'Die Bank hat ' + Fmt.money(betrag) + ' zu ' +
        (r.kredit.zinssatz * 100).toFixed(2).replace('.', ',') + ' % über ' + jahre +
        ' Jahre bewilligt. Wochenrate: ' + Fmt.money(r.kredit.rate) + '.' +
        (zweck === 'transfer'
          ? ' Das Transferbudget beträgt jetzt ' + Fmt.money(fin.transferbudget) + '.'
          : ''), 'geld');
      UI.zeichne();
    };

    Array.prototype.forEach.call(document.querySelectorAll('[data-tilgen]'), function (btn) {
      btn.onclick = function () {
        var k = Util.byId(fin.kredite, btn.dataset.tilgen);
        if (!k) return;
        var vor = Math.min(k.restschuld, Math.max(0, fin.kontostand));
        UI.modal('Sondertilgung',
          '<p>Restschuld: <b>' + Fmt.money(k.restschuld) + '</b> · Verfügbar: <b>' +
          Fmt.money(fin.kontostand) + '</b></p>' +
          UI.feldZahl('Betrag (€)', 'tilgBetrag', Math.round(vor / 1000) * 1000, 0, k.restschuld, 1000) +
          '<p class="mini">Die Bank berechnet 1 % Vorfälligkeitsentschädigung auf den getilgten Betrag.</p>',
          [
            {
              text: 'Tilgen', klasse: 'knopf--haupt',
              fn: function () {
                var r = Finance.sondertilgung(fin, k.id, +$('tilgBetrag').value || 0, st.tag);
                if (!r.ok) { UI.toast(r.grund); return; }
                UI.toast(r.abgeloest ? 'Kredit vollständig abgelöst.' : 'Sondertilgung gebucht.');
                UI.zeichne();
              }
            },
            { text: 'Abbrechen', klasse: 'knopf--still' }
          ]);
      };
    });
  };

  /* ---------- Finanzen ---------- */

  UI.seiten.finanzen = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var fin = mein.finanzen;
    var kader = Game.kaderVon(st, mein);
    var einnahmen = fin.saison.einnahmen, ausgaben = fin.saison.ausgaben;
    var summeE = Util.sum(Object.keys(einnahmen), function (k) { return einnahmen[k]; });
    var summeA = Util.sum(Object.keys(ausgaben), function (k) { return ausgaben[k]; });

    var html = '<div class="raster raster--4">' +
      UI.kennzahl('Kontostand', Fmt.money(fin.kontostand), '') +
      UI.kennzahl('Einnahmen (Saison)', Fmt.money(summeE), '') +
      UI.kennzahl('Ausgaben (Saison)', Fmt.money(summeA), '') +
      UI.kennzahl('Saldo', Fmt.money(summeE - summeA),
        (summeE - summeA >= 0 ? 'Überschuss' : 'Fehlbetrag')) +
      '</div>';

    html += '<div class="raster raster--2">';
    html += '<div class="karte"><div class="karte__kopf"><h3>Einnahmen</h3></div>' + posten(einnahmen, summeE, 'var(--gut)') + '</div>';
    html += '<div class="karte"><div class="karte__kopf"><h3>Ausgaben</h3></div>' + posten(ausgaben, summeA, 'var(--schlecht)') + '</div>';
    html += '</div>';

    /* Vorschau und Deckungsvorschläge */
    var wochen = Math.max(1, st.tag / 7);
    var schnittEin = summeE / wochen, schnittAus = summeA / wochen;
    var saldoWoche = schnittEin - schnittAus;
    var reserve = Game.betriebsreserve(st, mein);
    var frei = Game.verfuegbaresGeld(st, mein);

    html += '<div class="karte"><div class="karte__kopf"><h3>Vorschau</h3></div>' +
      '<div class="raster raster--3">' +
      UI.kennzahl('Frei verfügbar', Fmt.money(frei),
        'Betriebsreserve ' + Fmt.money(reserve) + ' bleibt liegen') +
      UI.kennzahl('Wöchentlicher Saldo', Fmt.money(saldoWoche),
        Fmt.money(schnittEin) + ' ein, ' + Fmt.money(schnittAus) + ' aus') +
      UI.kennzahl('Reichweite',
        saldoWoche >= 0 ? 'unbegrenzt'
          : Math.max(0, Math.floor(fin.kontostand / -saldoWoche)) + ' Wochen',
        saldoWoche >= 0 ? 'Der Verein erwirtschaftet einen Überschuss.'
          : 'bis das Konto ins Minus rutscht') +
      '</div>';

    if (fin.kontostand < 0 || saldoWoche < 0) {
      var luecke = fin.kontostand < 0
        ? -fin.kontostand + reserve
        : Math.round(-saldoWoche * 26);
      var kader = Game.kaderVon(st, mein).slice()
        .sort(function (a, b) { return b.marktwert - a.marktwert; });
      var kandidaten = kader.filter(function (p) {
        return !p.leihe && Transfers.wichtigkeit(p, kader) < 0.7;
      }).slice(0, 6);

      html += '<h4 style="margin-top:1.2rem">Konto decken</h4>' +
        '<p class="hinweis">' + (fin.kontostand < 0
          ? 'Das Konto steht im Minus. Um es samt Betriebsreserve auszugleichen, fehlen '
          : 'Bei gleichbleibendem Verlauf entsteht bis zum Saisonende eine Lücke von ') +
        '<b>' + Fmt.money(luecke) + '</b>. Ein Verkauf bringt neben der Ablöse auch das ' +
        'eingesparte Gehalt.</p>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th class="mitte">Pos</th>' +
        '<th>Spieler</th><th class="zahl">Alter</th><th class="zahl">Stärke</th>' +
        '<th class="zahl">Erwartete Ablöse</th><th class="zahl">Gehalt/Jahr</th>' +
        '<th class="zahl">Deckt die Lücke</th><th></th></tr></thead><tbody>' +
        kandidaten.map(function (p) {
          var sch = Game.verkaufsschaetzung(st, p, kader);
          var anteil = Util.clamp((sch.erwartet + p.gehalt * 26) / Math.max(1, luecke) * 100, 0, 100);
          return '<tr><td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
            '<td class="klickbar" data-spieler="' + p.id + '"><b>' + Util.esc(p.name) + '</b></td>' +
            '<td class="zahl">' + p.alter + '</td>' +
            '<td class="zahl">' + p.staerke + '</td>' +
            '<td class="zahl">' + (sch.interessenten
              ? Fmt.money(sch.erwartet) + ' <span class="mini">(' + sch.interessenten +
                (sch.interessenten === 1 ? ' Interessent)' : ' Interessenten)') + '</span>'
              : '<span class="mini">kein Interesse</span>') + '</td>' +
            '<td class="zahl">' + Fmt.money(p.gehalt * 52) + '</td>' +
            '<td class="zahl">' + Math.round(anteil) + ' %' +
            '<span class="balken" style="margin-left:.4em"><i style="width:' + anteil.toFixed(0) +
            '%;background:' + (anteil >= 100 ? 'var(--gut)' : 'var(--warn)') + '"></i></span></td>' +
            '<td><button class="knopf knopf--klein" data-anbieten="' + p.id + '"' +
            (sch.interessenten ? '' : ' disabled') + '>Anbieten</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="mini">Die erwartete Ablöse berücksichtigt, welche Vereine den Spieler ' +
        'sportlich brauchen und was ihr Transferbudget hergibt. Ein Verkauf spart zusätzlich ' +
        'das Gehalt für den Rest der Saison.</p>';
      if (!Game.istTransferfenster(st) && fin.kontostand >= 0) {
        html += '<p class="mini">Verkäufe sind erst im nächsten Transferfenster möglich. ' +
          'Steht das Konto im Minus, genehmigt der Verband einen Notverkauf.</p>';
      }
    }
    html += '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Budgets</h3></div>' +
      '<div class="raster raster--3">' +
      UI.kennzahl('Transferbudget', Fmt.money(fin.transferbudget),
        'davon sofort zahlbar ' + Fmt.money(Math.min(fin.transferbudget, Game.verfuegbaresGeld(st, mein)))) +
      UI.kennzahl('Gehaltsrahmen', Fmt.money(fin.gehaltsbudget) + ' / Woche',
        'genutzt: ' + Fmt.money(Util.sum(kader, function (p) { return p.gehalt; }))) +
      UI.kennzahl('Geschätzter Jahresumsatz',
        Fmt.money(Finance.jahresUmsatzSchaetzung(mein, fin, mein.stufe)), '') +
      '</div></div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Letzte Buchungen</h3></div>' +
      '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Datum</th><th>Art</th>' +
      '<th>Vorgang</th><th class="zahl">Betrag</th></tr></thead><tbody>' +
      fin.buchungen.slice(-40).reverse().map(function (b) {
        return '<tr><td class="mini">' + Fmt.date(b.tag, st.saison) + '</td>' +
          '<td><span class="marke">' + Util.esc(b.art) + '</span></td>' +
          '<td>' + Util.esc(b.text) + '</td>' +
          '<td class="zahl ' + (b.betrag >= 0 ? 'gut' : 'schlecht') + '">' +
          (b.betrag >= 0 ? '+' : '') + Fmt.moneyExact(b.betrag) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return html;
  };

  UI.nachZeichnen.finanzen = function () {
    UI.spielerKlicks();
    Array.prototype.forEach.call(document.querySelectorAll('[data-anbieten]'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        UI.verkaufAnbieten(b.dataset.anbieten);
      };
    });
  };

  function posten(obj, summe, farbe) {
    var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
    if (!keys.length) return '<p class="hinweis">Noch keine Buchungen in dieser Saison.</p>';
    return keys.map(function (k) {
      var anteil = summe ? obj[k] / summe * 100 : 0;
      return '<div style="margin-bottom:.5em">' +
        '<div style="display:flex;justify-content:space-between;font-size:.87rem">' +
        '<span>' + Util.esc(k) + '</span><b>' + Fmt.money(obj[k]) + '</b></div>' +
        '<div class="balken" style="width:100%"><i style="width:' + anteil.toFixed(1) + '%;background:' + farbe + '"></i></div>' +
        '</div>';
    }).join('') + '<div style="border-top:1px solid var(--line);margin-top:.6em;padding-top:.5em;' +
      'display:flex;justify-content:space-between"><b>Gesamt</b><b>' + Fmt.money(summe) + '</b></div>';
  }
})(typeof window !== 'undefined' ? window : globalThis);
