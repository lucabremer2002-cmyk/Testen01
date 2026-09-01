/* ui-jugend.js - Jugendakademie: Ausbau, Scouting und Talente. */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  UI.seiten.jugend = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var j = mein.jugend;
    if (!j) return '<div class="karte"><p>Dieser Verein unterhält keine Jugendabteilung.</p></div>';

    var akademie = Jugend.stufe(j.stufe);
    var scout = Jugend.scoutStufe(j.scouting);
    var talente = j.talente.map(function (id) { return st.spieler[id]; }).filter(Boolean)
      .sort(function (a, b) { return b.einschaetzung.bis - a.einschaetzung.bis; });
    var naechster = st.tag <= Jugend.JAHRGANG_TAG
      ? Jugend.JAHRGANG_TAG - st.tag
      : (League.SAISON_ENDE_ZIEL + 40 - st.tag + Jugend.JAHRGANG_TAG);

    var html = '<div class="raster raster--4">' +
      UI.kennzahl('Akademie', 'Stufe ' + j.stufe, Util.esc(akademie.name)) +
      UI.kennzahl('Scouting', 'Stufe ' + j.scouting, Util.esc(scout.name)) +
      UI.kennzahl('Talente im Haus', String(talente.length),
        j.hervorgebracht + ' seit Amtsantritt ausgebildet') +
      UI.kennzahl('Kosten', Fmt.money(Jugend.unterhaltWoche(j)) + ' / Woche',
        'Nächster Jahrgang in ' + naechster + ' Tagen') +
      '</div>';

    /* Laufende Maßnahme */
    if (j.ausbau) {
      var gesamt = j.ausbau.fertigTag - j.ausbau.startTag;
      var anteil = Util.clamp((st.tag - j.ausbau.startTag) / Math.max(1, gesamt) * 100, 0, 100);
      html += '<div class="karte"><div class="karte__kopf"><h3>Ausbau läuft</h3>' +
        '<span class="marke marke--warn">noch ' + Math.max(0, j.ausbau.fertigTag - st.tag) + ' Tage</span></div>' +
        '<p class="hinweis">' + (j.ausbau.art === 'scouting' ? 'Scouting' : 'Akademie') +
        ' wird auf Stufe ' + j.ausbau.ziel + ' gebracht.</p>' +
        '<div class="fortschritt"><i style="width:' + anteil.toFixed(0) + '%"></i></div></div>';
    }

    /* Talente */
    html += '<div class="karte"><div class="karte__kopf"><h2>Talente</h2>' +
      '<span class="mini">Einschätzung des Scouts – je besser das Scouting, desto enger die Spanne</span></div>';
    if (!talente.length) {
      html += '<p class="hinweis">Zurzeit ist kein Talent im Haus. Der nächste Jahrgang rückt in ' +
        naechster + ' Tagen nach.</p>';
    } else {
      html += '<div class="raster raster--3">' + talente.map(function (p) {
        var e = p.einschaetzung;
        var vonProz = (e.von / 99 * 100).toFixed(1);
        var bisProz = (e.bis / 99 * 100).toFixed(1);
        var istProz = (p.staerke / 99 * 100).toFixed(1);
        return '<div class="talentkarte">' +
          '<div class="talentkarte__kopf">' +
          '<span class="talentkarte__name">' + Util.esc(p.name) + '</span>' +
          UI.posMarke(p.pos) + '</div>' +
          '<div class="mini">' + p.alter + ' Jahre · ' + Util.esc(p.nation) +
          ' · aktuelle Stärke ' + p.staerke + '</div>' +
          '<div class="talentspanne">' +
          '<div class="talentspanne__spur">' +
          '<i class="talentspanne__ist" style="width:' + istProz + '%"></i>' +
          '<i class="talentspanne__band" style="left:' + vonProz + '%;width:' +
          Math.max(2, bisProz - vonProz) + '%"></i></div>' +
          '<div class="talentspanne__text"><span>jetzt ' + p.staerke + '</span>' +
          '<span>Potenzial ' + e.von + '–' + e.bis + '</span></div></div>' +
          '<div class="mini">„' + Util.esc(e.urteil) + '"</div>' +
          '<div class="knopfreihe" style="margin-top:auto">' +
          '<button class="knopf knopf--klein knopf--haupt" data-profi="' + p.id + '">Profivertrag</button>' +
          '<button class="knopf knopf--klein knopf--still" data-talent="' + p.id + '">Details</button>' +
          '<button class="knopf knopf--klein knopf--gefahr" data-freigeben="' + p.id + '" style="margin-left:auto">Freigeben</button>' +
          '</div></div>';
      }).join('') + '</div>';
      html += '<p class="mini" style="margin-top:.9rem">Talente verlassen den Verein mit 20 Jahren oder ' +
        'nach drei Jahrgängen, wenn sie bis dahin keinen Profivertrag bekommen haben.</p>';
    }
    html += '</div>';

    /* Ausbau der Akademie */
    html += '<div class="raster raster--2">';
    html += ausbauKarte('Akademie', 'akademie', j.stufe, Jugend.STUFEN, j, akademie,
      'Bestimmt, wie viele Talente nachrücken und wie weit sie es bringen können.');
    html += ausbauKarte('Scouting', 'scouting', j.scouting, Jugend.SCOUTING, j, scout,
      'Bestimmt, wie genau der Scout das Potenzial einschätzt. Ohne gutes Scouting tappen Sie im Dunkeln.');
    html += '</div>';

    return html;
  };

  function ausbauKarte(titel, art, aktuell, liste, j, jetzt, erklaerung) {
    var naechste = aktuell < 5 ? liste[aktuell] : null;
    var html = '<div class="karte"><div class="karte__kopf"><h3>' + titel + '</h3>' +
      '<span class="marke marke--akzent">Stufe ' + aktuell + ' von 5</span></div>' +
      '<div class="stufenleiter" style="margin-bottom:.8rem">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<i class="' + (n <= aktuell ? 'voll' : '') + '"></i>';
      }).join('') + '</div>' +
      '<p class="hinweis">' + Util.esc(jetzt.text || erklaerung) + '</p>';
    if (naechste) {
      html += '<div class="kennzahl" style="margin-bottom:.7rem"><span>Nächste Stufe</span>' +
        '<b style="font-size:1rem">' + Util.esc(naechste.name) + '</b>' +
        '<small>' + Fmt.money(naechste.kosten) + ' einmalig · ' +
        Fmt.money(naechste.unterhalt) + ' pro Woche</small></div>';
      if (!j.ausbau) {
        html += '<button class="knopf knopf--haupt" data-jausbau="' + art + '">Auf Stufe ' +
          (aktuell + 1) + ' ausbauen</button>';
      }
    } else {
      html += '<p class="akzent">Höchste Stufe erreicht.</p>';
    }
    return html + '</div>';
  }

  UI.nachZeichnen.jugend = function () {
    var st = UI.S(), mein = UI.meinKlub();
    UI.spielerKlicks();

    Array.prototype.forEach.call(document.querySelectorAll('[data-jausbau]'), function (b) {
      b.onclick = function () {
        var art = b.dataset.jausbau;
        var aktuell = art === 'scouting' ? mein.jugend.scouting : mein.jugend.stufe;
        var naechste = art === 'scouting' ? Jugend.scoutStufe(aktuell + 1) : Jugend.stufe(aktuell + 1);
        UI.modal('Ausbau: ' + naechste.name,
          '<p>' + Util.esc(naechste.text || 'Verbessert die Einschätzung Ihrer Talente deutlich.') + '</p>' +
          '<p>Kosten: <b>' + Fmt.money(naechste.kosten) + '</b> einmalig, danach <b>' +
          Fmt.money(naechste.unterhalt) + '</b> pro Woche.</p>' +
          '<p class="mini">Frei verfügbar: ' + Fmt.money(Game.verfuegbaresGeld(st, mein)) +
          ' <span class="mini">(Kontostand ' + Fmt.money(mein.finanzen.kontostand) +
          ' abzüglich Betriebsreserve)</span></p>',
          [
            {
              text: 'Ausbauen', klasse: 'knopf--haupt',
              fn: function () {
                var r = Jugend.ausbauStarten(mein, st.tag, art, Game.verfuegbaresGeld(st, mein));
                if (!r.ok) { UI.toast(r.grund); return; }
                UI.toast('Ausbau beauftragt, fertig in ' + r.tage + ' Tagen.');
                UI.zeichne();
              }
            },
            { text: 'Abbrechen', klasse: 'knopf--still' }
          ]);
      };
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-talent]'), function (b) {
      b.onclick = function () { talentFenster(b.dataset.talent); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-profi]'), function (b) {
      b.onclick = function () { profivertrag(b.dataset.profi); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-freigeben]'), function (b) {
      b.onclick = function () {
        var p = st.spieler[b.dataset.freigeben];
        UI.modal('Talent freigeben',
          '<p><b>' + Util.esc(p.name) + '</b> verlässt den Verein. Der Scout schätzt ihn auf ' +
          p.einschaetzung.von + '–' + p.einschaetzung.bis + ' – er kann sich auch anders entwickeln.</p>' +
          '<p class="hinweis">Das spart die Aufwandsentschädigung, macht die Entscheidung aber unumkehrbar.</p>',
          [
            {
              text: 'Freigeben', klasse: 'knopf--gefahr',
              fn: function () {
                Jugend.freigeben(st, mein, p);
                UI.toast(p.name + ' hat den Verein verlassen.');
                UI.zeichne();
              }
            },
            { text: 'Behalten', klasse: 'knopf--still' }
          ]);
      };
    });
  };

  function talentFenster(id) {
    var st = UI.S();
    var p = st.spieler[id];
    if (!p) return;
    var e = p.einschaetzung;
    var html = '<div class="mini" style="margin-bottom:.8rem">' + p.pos + ' · ' + p.alter +
      ' Jahre · ' + Util.esc(p.nation) + ' · im Verein seit ' + p.jugendSeit + '</div>';
    html += '<div class="raster raster--3" style="margin-bottom:1rem">' +
      UI.kennzahl('Aktuelle Stärke', String(p.staerke), '') +
      UI.kennzahl('Potenzial (Schätzung)', e.von + '–' + e.bis,
        'Treffsicherheit ' + Math.round(e.genauigkeit * 100) + ' %') +
      UI.kennzahl('Aufwandsentschädigung', Fmt.money(p.gehalt), 'pro Woche') +
      '</div>';
    html += '<p class="hinweis">„' + Util.esc(e.urteil) + '"</p>';
    html += '<h4>Fähigkeiten</h4>' + Object.keys(Players.ATTR_NAMEN).filter(function (a) {
      return p.pos === 'TW' ? a !== 'abschluss' : a !== 'reflexe';
    }).map(function (a) {
      return '<div style="display:grid;grid-template-columns:9em 1fr 2.2em;align-items:center;gap:.5em;margin-bottom:.3em;font-size:.85rem">' +
        '<span class="mini">' + Players.ATTR_NAMEN[a] + '</span>' +
        '<span class="balken" style="width:auto"><i style="width:' + p.attrs[a] + '%;background:' +
        UI.staerkeFarbe(p.attrs[a]) + '"></i></span>' +
        '<b style="text-align:right;font-variant-numeric:tabular-nums">' + p.attrs[a] + '</b></div>';
    }).join('');
    UI.modal(p.name, html, [
      { text: 'Profivertrag anbieten', klasse: 'knopf--haupt', schliessen: false,
        fn: function () { profivertrag(p.id); } },
      { text: 'Schließen', klasse: 'knopf--still' }
    ]);
  }

  function profivertrag(id) {
    var st = UI.S(), mein = UI.meinKlub();
    var p = st.spieler[id];
    if (!p) return;
    var wunsch = Jugend.vertragsforderung(p, mein);
    var e = p.einschaetzung;

    var html = '<p>Ein erster Profivertrag für <b>' + Util.esc(p.name) + '</b> (' + p.alter +
      ', ' + p.pos + '). Der Scout traut ihm ein Potenzial von <b>' + e.von + '–' + e.bis +
      '</b> zu: „' + Util.esc(e.urteil) + '"</p>' +
      '<div class="formularraster">' +
      UI.feldZahl('Gehalt pro Woche (€)', 'jGehalt', wunsch, 0, undefined, 10) +
      UI.feldAuswahl('Laufzeit', 'jJahre', [3, 4, 5].map(function (n) {
        return [n, n + ' Jahre'];
      }), 4) +
      '</div>' +
      '<p class="mini">Er erwartet etwa ' + Fmt.money(wunsch) + ' pro Woche. Lange Verträge ' +
      'sichern den Marktwert, falls er einschlägt.</p>' +
      '<p class="mini">Kader: ' + mein.kader.length + ' von 30 Plätzen belegt.</p>';

    UI.modal('Profivertrag', html, [
      {
        text: 'Vertrag anbieten', klasse: 'knopf--haupt', schliessen: false,
        fn: function () {
          var gehalt = Math.max(0, +$('jGehalt').value || 0);
          var jahre = +$('jJahre').value || 4;
          if (gehalt < wunsch * 0.82) {
            UI.toast('Das ist ihm zu wenig – er erwartet rund ' + Fmt.money(wunsch) + '.');
            return;
          }
          var r = Jugend.hochziehen(st, mein, p, { gehalt: gehalt, jahre: jahre, rolle: 'talent' });
          if (!r.ok) { UI.toast(r.grund); return; }
          UI.modalZu();
          UI.toast(p.name + ' hat seinen ersten Profivertrag unterschrieben.');
          Game.post(st, 'Profivertrag: ' + p.name,
            p.name + ' rückt aus der eigenen Jugend in den Profikader auf. Vertrag bis ' +
            p.vertragBis + ', ' + Fmt.money(gehalt) + ' pro Woche.', 'gut');
          UI.zeichne();
        }
      },
      { text: 'Abbrechen', klasse: 'knopf--still' }
    ]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
