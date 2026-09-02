/* ui-pokal.js - Der DFB-Pokal: eigener Weg, Auslosung und alle Ergebnisse. */
(function (g) {
  'use strict';

  var UI = g.UI;

  UI.seiten.pokal = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var pokal = st.pokal;
    if (!pokal) return '<div class="karte"><p class="leer">Kein Wettbewerb angesetzt.</p></div>';

    var naechste = Pokal.naechstePartie(st);
    var raus = Pokal.ausgeschieden(st);
    var eigenerWeg = [];
    pokal.runden.forEach(function (r) {
      r.partien.forEach(function (p) {
        if (p.heim === mein.id || p.gast === mein.id) {
          eigenerWeg.push({ runde: r, partie: p, heim: p.heim === mein.id });
        }
      });
    });

    var html = '<div class="raster raster--3">' +
      UI.kennzahl('Wettbewerb', 'DFB-Pokal', pokal.teilnehmer + ' Mannschaften') +
      UI.kennzahl('Aktuelle Runde',
        (Pokal.runde(pokal, pokal.aktuelleRunde) || { name: '–' }).name,
        pokal.sieger ? 'Sieger: ' + Util.esc(st.klubs[pokal.sieger].name) : 'K.-o.-System, ein Spiel') +
      UI.kennzahl('Ihr Weg',
        pokal.sieger === mein.id ? 'Pokalsieger'
          : (naechste ? naechste.runde.name : (raus ? 'ausgeschieden' : '–')),
        eigenerWeg.length + (eigenerWeg.length === 1 ? ' Partie' : ' Partien')) +
      '</div>';

    /* Nächste eigene Partie */
    if (naechste) {
      var gegner = st.klubs[naechste.heim ? naechste.partie.gast : naechste.partie.heim];
      var gLiga = gegner.ligaId ? st.ligen[gegner.ligaId] : null;
      html += '<div class="karte"><div class="karte__kopf"><h3>' +
        Util.esc(naechste.runde.name) + '</h3>' +
        '<span class="mini">' + Fmt.weekday(naechste.runde.tag, st.saison) + ', ' +
        Fmt.date(naechste.runde.tag, st.saison) + '</span></div>' +
        '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">' +
        UI.wappen(gegner, 48) +
        '<div><b style="font-size:1.02rem">' + Util.esc(gegner.name) + '</b>' +
        '<div class="mini">' + (naechste.heim ? 'Heimspiel' : 'Auswärtsspiel') +
        (gLiga ? ' · ' + Util.esc(gLiga.name) : '') + '</div>' +
        '<div class="mini">Prämie für das Weiterkommen: ' +
        Fmt.money((Pokal.runde(pokal, naechste.runde.nr + 1) || { praemie: Pokal.SIEGPRAEMIE }).praemie) +
        '</div></div></div>' +
        '<p class="mini" style="margin-top:.8em">Bei Gleichstand nach 90 Minuten folgen Verlängerung ' +
        'und, wenn nötig, Elfmeterschießen.</p></div>';
    }

    /* Eigener Weg durch den Wettbewerb */
    if (eigenerWeg.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Ihre Partien</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Runde</th><th>Gegner</th>' +
        '<th class="mitte">Ort</th><th class="zahl">Ergebnis</th><th></th></tr></thead><tbody>' +
        eigenerWeg.map(function (w) {
          var gegnerId = w.heim ? w.partie.gast : w.partie.heim;
          var erg = '<span class="mini">–</span>';
          var zusatz = '';
          if (w.partie.th !== null) {
            var e1 = w.heim ? w.partie.th : w.partie.tg;
            var e2 = w.heim ? w.partie.tg : w.partie.th;
            var weiter = w.partie.sieger === mein.id;
            erg = '<b class="' + (weiter ? 'gut' : 'schlecht') + '">' + e1 + ':' + e2 + '</b>';
            if (w.partie.elfmeter) zusatz = '<span class="marke">' + Util.esc(w.partie.elfmeter.text) + '</span>';
            else if (w.partie.verlaengerung) zusatz = '<span class="marke">nach Verlängerung</span>';
          }
          return '<tr><td>' + Util.esc(w.runde.name) + '</td>' +
            '<td>' + (w.heim ? '' : 'bei ') + UI.klubZelle(st.klubs[gegnerId], 18) + '</td>' +
            '<td class="mitte"><span class="marke">' + (w.heim ? 'H' : 'A') + '</span></td>' +
            '<td class="zahl">' + erg + '</td><td>' + zusatz + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    /* Alle Runden */
    var offeneRunde = UI.daten.pokalRunde ||
      (Pokal.runde(pokal, pokal.aktuelleRunde) ? pokal.aktuelleRunde : 1);
    html += '<div class="reiter">' + pokal.runden.filter(function (r) {
      return r.partien.length;
    }).map(function (r) {
      return '<button data-pokalrunde="' + r.nr + '" class="' + (r.nr === offeneRunde ? 'aktiv' : '') +
        '">' + Util.esc(r.name) + '</button>';
    }).join('') + '</div>';

    var r2 = Pokal.runde(pokal, offeneRunde);
    html += '<div class="karte"><div class="karte__kopf"><h3>' + Util.esc(r2.name) + '</h3>' +
      '<span class="mini">' + Fmt.date(r2.tag, st.saison) + '</span></div>';
    if (!r2.partien.length) {
      html += '<p class="leer">Diese Runde ist noch nicht ausgelost.</p>';
    } else {
      html += '<div class="tabellenrahmen"><table class="liste"><tbody>' +
        r2.partien.map(function (p) {
          var eigen = (p.heim === mein.id || p.gast === mein.id) ? ' class="eigen"' : '';
          var mitte = p.th === null ? '– : –' : p.th + ' : ' + p.tg;
          var zusatz = p.elfmeter ? '<span class="mini">' + Util.esc(p.elfmeter.text) + '</span>'
            : (p.verlaengerung ? '<span class="mini">n. V.</span>' : '');
          return '<tr' + eigen + '><td style="text-align:right">' +
            UI.klubZelle(st.klubs[p.heim], 18) + '</td>' +
            '<td class="mitte" style="width:5.5em"><b>' + mitte + '</b></td>' +
            '<td>' + UI.klubZelle(st.klubs[p.gast], 18) + '</td>' +
            '<td class="zahl">' + zusatz + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  };

  UI.nachZeichnen.pokal = function () {
    UI.tabellenKlicks();
    Array.prototype.forEach.call(document.querySelectorAll('[data-pokalrunde]'), function (b) {
      b.onclick = function () { UI.wechsle('pokal', { pokalRunde: +b.dataset.pokalrunde }); };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
