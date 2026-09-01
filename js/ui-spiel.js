/* ui-spiel.js - Live-Spiel mit Ticker und Wechseln sowie Saisonabschluss. */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  var live = null;   /* {match, liga, partie, spieltagNr, timer, tempo, gezeigt} */

  var TEMPO = { langsam: 620, normal: 260, schnell: 90 };

  /* ---------- Spielvorbereitung ---------- */

  UI.spielVorbereiten = function () {
    var st = UI.S();
    var an = st.anstehendesSpiel;
    if (!an) return;
    var liga = st.ligen[an.ligaId];
    var mein = UI.meinKlub();
    var heim = st.klubs[an.heim], gast = st.klubs[an.gast];
    var gegner = an.heim === mein.id ? gast : heim;
    var istHeim = an.heim === mein.id;

    Game.aufstellungPruefen(st, mein, st.tag);
    var kader = Game.kaderVon(st, mein);
    var fehlend = kader.filter(function (p) {
      return p.verletztBis > st.tag || p.sperre > 0;
    });

    var html = '<div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-bottom:1rem;flex-wrap:wrap">' +
      UI.wappen(heim, 64) + '<b style="font-size:1.2rem">' + Util.esc(heim.kurz) + ' – ' + Util.esc(gast.kurz) + '</b>' +
      UI.wappen(gast, 64) + '</div>' +
      '<p style="text-align:center">' + an.spieltagNr + '. Spieltag ' + Util.esc(liga.name) + ' · ' +
      (istHeim ? 'Heimspiel' : 'Auswärtsspiel') + ' gegen <b>' + Util.esc(gegner.name) + '</b> ' +
      '(Platz ' + League.platzVon(liga, gegner.id) + ')</p>';

    html += '<div class="raster raster--3" style="margin:1rem 0">' +
      UI.kennzahl('Ihre Aufstellung', mein.aufstellung.formation,
        Match.MENTALITAET[mein.taktik.mentalitaet].name) +
      UI.kennzahl('Ihre Form', UI.formIcons(liga.tabelle[mein.id].form),
        'Platz ' + League.platzVon(liga, mein.id)) +
      UI.kennzahl('Form des Gegners', UI.formIcons(liga.tabelle[gegner.id].form),
        'Platz ' + League.platzVon(liga, gegner.id)) +
      '</div>';

    if (fehlend.length) {
      html += '<p class="hinweis">Nicht einsatzbereit: ' + fehlend.map(function (p) {
        return Util.esc(p.nachname) + ' (' + (p.sperre > 0 ? 'gesperrt' : 'verletzt') + ')';
      }).join(', ') + '</p>';
    }

    UI.modal('Spieltag', html, [
      { text: 'Aufstellung ändern', klasse: 'knopf--still', fn: function () { UI.wechsle('taktik'); } },
      /* Beide oeffnen selbst ein neues Fenster, deshalb nicht automatisch schliessen. */
      { text: 'Ergebnis simulieren', klasse: 'knopf--still', schliessen: false, fn: function () { schnellSpiel(); } },
      { text: 'Spiel anpfeifen', klasse: 'knopf--haupt', schliessen: false, fn: function () { liveStarten(); } }
    ]);
  };

  function partieFinden() {
    var st = UI.S();
    var an = st.anstehendesSpiel;
    var liga = st.ligen[an.ligaId];
    var stag = liga.spieltage[an.spieltagNr - 1];
    var partie = stag.partien.filter(function (p) {
      return p.heim === an.heim && p.gast === an.gast;
    })[0];
    return { liga: liga, stag: stag, partie: partie };
  }

  function schnellSpiel() {
    var st = UI.S();
    var f = partieFinden();
    if (!f.partie || f.partie.th !== null) return;
    var m = Game.spielSimulieren(st, f.liga, f.partie, f.stag.nr);
    Game.tagAbschliessen(st);
    ergebnisFenster(m, f);
  }

  /* ---------- Live-Spiel ---------- */

  function liveStarten() {
    var st = UI.S();
    var f = partieFinden();
    if (!f.partie || f.partie.th !== null) return;
    var ctx = Game.matchKontext(st, f.liga, f.partie.heim, f.partie.gast);
    ctx.spieltag = f.stag.nr;
    var m = Match.neu(Game.rng, ctx);
    live = {
      match: m, liga: f.liga, partie: f.partie, stag: f.stag,
      tempo: 'normal', timer: null, laeuft: true,
      meinSeite: f.partie.heim === st.meinKlubId ? 'heim' : 'gast'
    };
    UI.modalZu();
    $('spielOverlay').hidden = false;
    zeichneLive();
    starteTakt();
  }

  function starteTakt() {
    if (!live) return;
    stopTakt();
    live.timer = setInterval(schritt, TEMPO[live.tempo]);
  }
  function stopTakt() {
    if (live && live.timer) { clearInterval(live.timer); live.timer = null; }
  }

  function schritt() {
    if (!live) return;
    var m = live.match;
    if (m.beendet) { beenden(); return; }
    Match.minute(m);
    /* Die KI wechselt selbst. */
    var kiSeite = live.meinSeite === 'heim' ? 'gast' : 'heim';
    if (m.minute === 60 || m.minute === 72 || m.minute === 81) {
      Match.autoWechsel(m, kiSeite, UI.S().tag);
    }
    zeichneLive();
    if (m.beendet) beenden();
  }

  function beenden() {
    stopTakt();
    if (!live) return;
    var st = UI.S();
    var m = live.match;
    if (!m.beendet) Match.abpfiff(m);
    Game.ergebnisVerbuchen(st, live.liga, live.partie, m, live.stag.nr);
    Game.tagAbschliessen(st);
    var f = { liga: live.liga, partie: live.partie, stag: live.stag };
    zeichneLive();
    setTimeout(function () {
      $('spielOverlay').hidden = true;
      $('spielOverlay').innerHTML = '';
      var fertig = live;
      live = null;
      ergebnisFenster(m, f);
    }, 1400);
  }

  function zeichneLive() {
    var st = UI.S();
    var m = live.match;
    var heim = m.heimKlub, gast = m.gastKlub;
    var minute = m.beendet ? 'Ende' : (m.minute > 90 ? '90+' + (m.minute - 90) : m.minute) + "'";

    var html = '<div class="spiel__kopf"><div class="spiel__stand">' +
      '<div class="spiel__team">' + UI.wappen(heim, 46) + '<b>' + Util.esc(heim.name) + '</b></div>' +
      '<div><div class="spiel__tore">' + m.heim.tore + ' : ' + m.gast.tore + '</div>' +
      '<div class="spiel__minute">' + minute + '</div></div>' +
      '<div class="spiel__team spiel__team--gast"><b>' + Util.esc(gast.name) + '</b>' + UI.wappen(gast, 46) + '</div>' +
      '</div></div>';

    html += '<div class="spiel__leiste">' +
      '<button class="knopf knopf--klein' + (live.laeuft ? '' : ' knopf--haupt') + '" id="spPause">' +
      (live.laeuft ? '❚❚ Pause' : '▶ Weiter') + '</button>' +
      ['langsam', 'normal', 'schnell'].map(function (t) {
        return '<button class="knopf knopf--klein ' + (live.tempo === t ? 'knopf--haupt' : 'knopf--still') +
          '" data-tempo="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
      }).join('') +
      '<button class="knopf knopf--klein" id="spWechsel">Wechseln (' +
      (live.meinSeite === 'heim' ? m.heim.wechsel : m.gast.wechsel) + '/5)</button>' +
      '<button class="knopf knopf--klein" id="spTaktik">Taktik</button>' +
      '<button class="knopf knopf--klein knopf--still" id="spEnde">Rest simulieren</button>' +
      '</div>';

    html += '<div class="spiel__koerper"><div class="raster raster--2">';

    /* Ticker */
    html += '<div><h3>Spielverlauf</h3><div class="ticker">' +
      m.ereignisse.slice().reverse().slice(0, 40).map(function (e) {
        var klub = e.klubId ? st.klubs[e.klubId] : null;
        return '<div class="ticker__zeile ' + e.typ + '">' +
          '<span class="ticker__min">' + (e.min ? e.min + "'" : '') + '</span>' +
          '<span>' + (klub ? '<b>' + Util.esc(klub.kurz) + '</b> · ' : '') + Util.esc(e.text) + '</span></div>';
      }).join('') + '</div></div>';

    /* Statistik + Aufstellung */
    var s = [
      ['Ballbesitz', m.ballbesitz, 100 - m.ballbesitz, '%'],
      ['Torschüsse', m.heim.schuesse, m.gast.schuesse, ''],
      ['Ecken', m.heim.ecken, m.gast.ecken, ''],
      ['Gelbe Karten', Object.keys(m.heim.gelb).length, Object.keys(m.gast.gelb).length, '']
    ];
    html += '<div><h3>Statistik</h3>' + s.map(function (z) {
      var summe = Math.max(1, z[1] + z[2]);
      return '<div class="statbalken"><span>' + z[1] + z[3] + '</span>' +
        '<span class="statbalken__spur"><i style="width:' + (z[1] / summe * 100) + '%"></i>' +
        '<i style="width:' + (z[2] / summe * 100) + '%"></i></span>' +
        '<span style="text-align:right">' + z[2] + z[3] + '</span>' +
        '<span class="mini" style="grid-column:1/-1;text-align:center">' + z[0] + '</span></div>';
    }).join('');

    var seite = live.meinSeite === 'heim' ? m.heim : m.gast;
    var slots = Match.FORMATIONEN[seite.formation] || [];
    html += '<h3 style="margin-top:1rem">Ihre Elf</h3><div class="tabellenrahmen"><table class="liste"><tbody>' +
      seite.elf.map(function (pid, i) {
        var p = m.spieler[pid];
        if (!p) return '';
        var e = seite.eingesetzt[pid];
        var slotPos = (slots[i] && slots[i][0]) || p.pos;
        return '<tr><td class="mitte">' + UI.posMarke(slotPos) + '</td>' +
          '<td>' + Util.esc(p.nachname) +
          (slotPos !== p.pos ? ' <span class="mini">(' + p.pos + ')</span>' : '') +
          (e && e.von > 0 ? ' <span class="mini">ab ' + e.von + "'</span>" : '') + '</td>' +
          '<td class="zahl mini">' + (e && e.tore ? '⚽'.repeat(e.tore) : '') +
          (seite.gelb[pid] ? ' 🟨' : '') + '</td>' +
          '<td class="zahl">' + (e ? e.note.toFixed(1).replace('.', ',') : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    html += '</div></div></div>';

    var ov = $('spielOverlay');
    ov.innerHTML = html;

    $('spPause').onclick = function () {
      live.laeuft = !live.laeuft;
      if (live.laeuft) starteTakt(); else stopTakt();
      zeichneLive();
    };
    Array.prototype.forEach.call(ov.querySelectorAll('[data-tempo]'), function (b) {
      b.onclick = function () {
        live.tempo = b.dataset.tempo;
        if (live.laeuft) starteTakt();
        zeichneLive();
      };
    });
    $('spEnde').onclick = function () {
      stopTakt();
      Match.restSimulieren(m);
      beenden();
    };
    $('spWechsel').onclick = wechselFenster;
    $('spTaktik').onclick = taktikFenster;
  }

  function wechselFenster() {
    var m = live.match;
    var seite = live.meinSeite === 'heim' ? m.heim : m.gast;
    if (seite.wechsel >= 5) { UI.toast('Alle fünf Wechsel sind aufgebraucht.'); return; }
    stopTakt();

    var html = '<p>Wählen Sie zuerst den Spieler, der herausgeht, dann den Einwechselspieler.</p>' +
      '<div class="raster raster--2">' +
      '<div><h4>Auf dem Platz</h4><div class="tabellenrahmen"><table class="liste"><tbody>' +
      seite.elf.map(function (pid) {
        var p = m.spieler[pid];
        var e = seite.eingesetzt[pid];
        return '<tr class="klickbar" data-raus="' + pid + '"><td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
          '<td>' + Util.esc(p.nachname) + '</td><td class="mitte">' + UI.fitnessBalken(p.fitness) + '</td>' +
          '<td class="zahl">' + (e ? e.note.toFixed(1).replace('.', ',') : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div><h4>Auf der Bank</h4><div class="tabellenrahmen"><table class="liste"><tbody>' +
      seite.bank.map(function (pid) {
        var p = m.spieler[pid];
        return '<tr class="klickbar" data-rein="' + pid + '"><td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
          '<td>' + Util.esc(p.nachname) + '</td><td class="zahl">' + UI.staerkeBalken(p.staerke) + '</td></tr>';
      }).join('') + '</tbody></table></div></div></div>' +
      '<p class="mini" id="wechselInfo">Kein Spieler gewählt.</p>';

    var inhalt = UI.modal('Wechsel vornehmen', html, [
      { text: 'Zurück zum Spiel', klasse: 'knopf--still', fn: function () { if (live.laeuft) starteTakt(); } }
    ], true);

    var raus = null, rein = null;
    function pruefe() {
      var info = $('wechselInfo');
      if (raus && rein) {
        var r = Match.wechsel(m, live.meinSeite, raus, rein);
        if (r.ok) {
          UI.modalZu();
          UI.toast('Wechsel durchgeführt.');
          zeichneLive();
          if (live.laeuft) starteTakt();
        } else {
          info.textContent = r.grund;
          raus = rein = null;
        }
      } else if (info) {
        info.textContent = raus ? 'Heraus: ' + m.spieler[raus].name + ' – jetzt Einwechselspieler wählen.'
          : 'Kein Spieler gewählt.';
      }
    }
    Array.prototype.forEach.call(inhalt.querySelectorAll('[data-raus]'), function (tr) {
      tr.onclick = function () {
        raus = tr.dataset.raus;
        Array.prototype.forEach.call(inhalt.querySelectorAll('[data-raus]'), function (x) { x.style.background = ''; });
        tr.style.background = 'rgba(232,182,76,.18)';
        pruefe();
      };
    });
    Array.prototype.forEach.call(inhalt.querySelectorAll('[data-rein]'), function (tr) {
      tr.onclick = function () { rein = tr.dataset.rein; pruefe(); };
    });
  }

  function taktikFenster() {
    var m = live.match;
    var seite = live.meinSeite === 'heim' ? m.heim : m.gast;
    stopTakt();
    var html = '<div class="formularraster">' +
      UI.feldAuswahl('Ausrichtung', 'lvMent', Object.keys(Match.MENTALITAET).map(function (k) {
        return [k, Match.MENTALITAET[k].name];
      }), seite.taktik.mentalitaet) +
      UI.feldAuswahl('Pressing', 'lvPress', Object.keys(Match.PRESSING).map(function (k) {
        return [k, Match.PRESSING[k].name];
      }), seite.taktik.pressing) +
      UI.feldAuswahl('Spielweise', 'lvSpiel', Object.keys(Match.SPIELWEISE).map(function (k) {
        return [k, Match.SPIELWEISE[k].name];
      }), seite.taktik.spielweise) +
      '</div>';
    UI.modal('Taktik umstellen', html, [
      {
        text: 'Übernehmen', klasse: 'knopf--haupt',
        fn: function () {
          Match.taktikAendern(m, live.meinSeite, {
            mentalitaet: $('lvMent').value,
            pressing: $('lvPress').value,
            spielweise: $('lvSpiel').value
          });
          UI.toast('Taktik umgestellt.');
          zeichneLive();
          if (live.laeuft) starteTakt();
        }
      },
      { text: 'Abbrechen', klasse: 'knopf--still', fn: function () { if (live.laeuft) starteTakt(); } }
    ]);
  }

  /* ---------- Ergebnisfenster ---------- */

  function ergebnisFenster(m, f) {
    var st = UI.S();
    var mein = UI.meinKlub();
    var istHeim = f.partie.heim === mein.id;
    var eigene = istHeim ? f.partie.th : f.partie.tg;
    var fremde = istHeim ? f.partie.tg : f.partie.th;
    var gegner = st.klubs[istHeim ? f.partie.gast : f.partie.heim];
    var titel = eigene > fremde ? 'Sieg!' : (eigene < fremde ? 'Niederlage' : 'Unentschieden');

    var html = '<div style="text-align:center;margin-bottom:1rem">' +
      '<div style="font-size:2.4rem;font-weight:800">' + f.partie.th + ' : ' + f.partie.tg + '</div>' +
      '<div class="mini">' + Util.esc(st.klubs[f.partie.heim].name) + ' gegen ' +
      Util.esc(st.klubs[f.partie.gast].name) + ' · ' + Fmt.num(f.partie.zuschauer || 0) + ' Zuschauer</div></div>';

    if (f.partie.bericht && f.partie.bericht.length) {
      html += '<h4>Höhepunkte</h4><div class="ticker">' + f.partie.bericht.map(function (e) {
        var klub = e.klubId ? st.klubs[e.klubId] : null;
        return '<div class="ticker__zeile ' + e.typ + '"><span class="ticker__min">' + e.min + "'</span>" +
          '<span>' + (klub ? '<b>' + Util.esc(klub.kurz) + '</b> · ' : '') + Util.esc(e.text) + '</span></div>';
      }).join('') + '</div>';
    }

    /* Tabelle danach */
    html += '<h4 style="margin-top:1rem">Tabelle</h4>' + UI.tabelleHTML(f.liga, true);

    /* Andere Ergebnisse des Spieltags */
    var andere = f.stag.partien.filter(function (p) { return p !== f.partie && p.th !== null; });
    if (andere.length) {
      html += '<h4 style="margin-top:1rem">Weitere Ergebnisse</h4><div class="tabellenrahmen"><table class="liste"><tbody>' +
        andere.map(function (p) {
          return '<tr><td style="text-align:right">' + UI.klubZelle(st.klubs[p.heim], 18, true) + '</td>' +
            '<td class="mitte"><b>' + p.th + ':' + p.tg + '</b></td>' +
            '<td>' + UI.klubZelle(st.klubs[p.gast], 18, true) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    UI.modal(titel + ' gegen ' + gegner.kurz, html, [
      { text: 'Weiter', klasse: 'knopf--haupt' }
    ], true);
    UI.zeichne();
  }

  /* ---------- Saisonabschluss ---------- */

  UI.saisonAbschluss = function () {
    var st = UI.S();
    var meinAlt = UI.meinKlub();
    var ligaAlt = st.ligen[meinAlt.ligaId];
    var platzAlt = ligaAlt ? League.platzVon(ligaAlt, meinAlt.id) : 0;
    var bericht = Saison.saisonwechsel(st);
    var m = bericht.meinKlub;

    var html = '<h3 style="text-align:center">Saison ' + bericht.saison + '/' +
      String(bericht.saison + 1).slice(2) + ' abgeschlossen</h3>';

    if (m) {
      var text = m.aufgestiegen ? '<span class="gut">Aufstieg geschafft!</span>' :
        (m.abgestiegen ? '<span class="schlecht">Der Abstieg ist besiegelt.</span>' :
          (m.platz <= m.ziel ? '<span class="gut">Das Saisonziel wurde erreicht.</span>' :
            '<span class="mini">Das Saisonziel wurde verfehlt.</span>'));
      html += '<div class="raster raster--3" style="margin:1rem 0">' +
        UI.kennzahl('Ihr Platz', m.platz + '.', Util.esc(m.liga)) +
        UI.kennzahl('Ziel des Vorstands', 'Platz ' + m.ziel, '') +
        UI.kennzahl('Vertrauen', m.vertrauen + ' %',
          Fmt.signed(m.vertrauen - m.vertrauenAlt) + ' Punkte') +
        '</div><p style="text-align:center">' + text + '</p>';
      if (m.entlassen) {
        html += '<p class="schlecht" style="text-align:center"><b>Der Vorstand hat das Vertrauen verloren. ' +
          'Sie wurden freigestellt.</b></p>';
      }
    }

    bericht.ligen.forEach(function (l) {
      html += '<h4 style="margin-top:1rem">' + Util.esc(l.name) + '</h4>' +
        '<div class="tabellenrahmen"><table class="liste"><tbody>' +
        l.tabelle.slice(0, 5).map(function (z) {
          return '<tr' + (z.klubId === st.meinKlubId ? ' class="eigen"' : '') + '>' +
            '<td class="mitte"><span class="platz' + (z.platz === 1 ? ' platz--auf' : '') + '">' + z.platz + '</span></td>' +
            '<td>' + UI.klubZelle(st.klubs[z.klubId], 18) + '</td>' +
            '<td class="zahl">' + z.punkte + '</td><td class="zahl">' + z.tore + ':' + z.gegentore + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });

    if (bericht.relegation.length) {
      html += '<h4 style="margin-top:1rem">Relegation</h4>';
      bericht.relegation.forEach(function (r) {
        html += '<p class="hinweis">' + Util.esc(st.klubs[r.klubA].name) + ' gegen ' +
          Util.esc(st.klubs[r.klubB].name) + ': ' + r.hin.th + ':' + r.hin.tg + ' und ' +
          r.rueck.th + ':' + r.rueck.tg + (r.elfmeter ? ' (' + r.elfmeter + ')' : '') +
          ' – <b>' + Util.esc(st.klubs[r.siegerId].name) + '</b> setzt sich durch.</p>';
      });
    }

    var aufListe = bericht.auf.filter(function (b) { return b.von; });
    if (aufListe.length) {
      html += '<h4 style="margin-top:1rem">Aufsteiger</h4><p class="hinweis">' +
        aufListe.map(function (b) {
          return Util.esc(st.klubs[b.klubId].name) + ' → ' + Util.esc(st.ligen[b.nach].kurz);
        }).join(' · ') + '</p>';
    }

    UI.modal('Saisonrückblick', html, [
      { text: 'Neue Saison beginnen', klasse: 'knopf--haupt', fn: function () { UI.zeichne(); } }
    ], true);
  };

  UI.liveLaeuft = function () { return !!live; };
})(typeof window !== 'undefined' ? window : globalThis);
