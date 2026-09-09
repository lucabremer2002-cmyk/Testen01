/*
 * matchview.js - Der eigene Spieltag in der Live-Ansicht.
 *
 * Zeigt den Spielverlauf Minute für Minute, erlaubt Wechsel, taktische
 * Umstellungen und die Halbzeitansprache und schliesst mit dem Bericht ab.
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util, D = FM.data, P = FM.players, T = FM.tactics;
  var UI = FM.ui;
  var esc = UI.esc;
  var doc = global.document;

  var MV = FM.matchview = {};

  var state = null;
  var spiel = null;
  var timer = null;
  var laeuft = false;
  var eigeneSeite = null;
  var gegnerSeite = null;
  var halbzeitGezeigt = false;

  var TEMPO = { 1: 1400, 2: 700, 3: 330, 4: 120 };

  MV.starte = function (partie) {
    var world = UI.world;
    spiel = partie;
    halbzeitGezeigt = false;
    state = FM.match.erstelle(world, spiel, {});
    eigeneSeite = state.heim.club.id === world.nutzerClubId ? state.heim : state.gast;
    gegnerSeite = eigeneSeite === state.heim ? state.gast : state.heim;

    var mv = UI.el('matchview');
    mv.hidden = false;
    zeichne();
    laeuft = false;
    starteUhr();
  };

  function starteUhr() {
    stoppeUhr();
    laeuft = true;
    var tempo = TEMPO[UI.world.einstellungen.simGeschwindigkeit] || 700;
    timer = global.setInterval(schritt, tempo);
    aktualisiereSteuerung();
  }

  function stoppeUhr() {
    if (timer) { global.clearInterval(timer); timer = null; }
    laeuft = false;
  }

  function schritt() {
    if (!state || state.beendet) { stoppeUhr(); return; }
    FM.match.tick(state);
    zeichneLive();
    if (state.phase === 'pause' && !halbzeitGezeigt) {
      halbzeitGezeigt = true;
      stoppeUhr();
      halbzeitansprache();
      return;
    }
    if (state.beendet) {
      stoppeUhr();
      abschluss();
    }
  }

  // ------------------------------------------------------------ Darstellung

  function zeichne() {
    var mv = UI.el('matchview');
    mv.innerHTML = '<div class="mv">' + kopf() + leiste() +
      '<div class="mv__grid">' +
      '<div class="card"><h3>Spielverlauf</h3><div class="ticker" id="mv-ticker"></div></div>' +
      '<div class="grid">' +
      '<div class="card"><h3>Statistik</h3><div id="mv-stats"></div></div>' +
      '<div class="card"><h3>Ihre Mannschaft</h3><div id="mv-elf"></div></div>' +
      '</div></div></div>';
    verdrahte();
    zeichneLive();
  }

  function kopf() {
    var h = state.heim.club, g = state.gast.club;
    return '<div class="mv__kopf">' +
      '<div class="mv__team">' + UI.wappen(h) + '<b>' + esc(h.name) + '</b></div>' +
      '<div class="mv__stand"><b id="mv-stand">' + state.tore.heim + ' : ' + state.tore.gast + '</b>' +
      '<small id="mv-uhr" class="mv__uhr">' + minuteText() + '</small>' +
      '<small>' + U.num(state.zuschauer) + ' Zuschauer · ' + esc(state.wetter.name) + '</small></div>' +
      '<div class="mv__team mv__team--gast"><b>' + esc(g.name) + '</b>' + UI.wappen(g) + '</div>' +
      '</div>';
  }

  function leiste() {
    return '<div class="mv__leiste">' +
      '<button class="btn btn--primary" id="mv-play">Pause</button>' +
      '<select id="mv-tempo" style="width:auto">' +
      [[1, 'Langsam'], [2, 'Normal'], [3, 'Schnell'], [4, 'Sehr schnell']].map(function (o) {
        return '<option value="' + o[0] + '"' + (UI.world.einstellungen.simGeschwindigkeit === o[0] ? ' selected' : '') +
          '>' + o[1] + '</option>';
      }).join('') + '</select>' +
      '<button class="btn" id="mv-wechsel">Wechseln</button>' +
      '<button class="btn" id="mv-taktik">Taktik anpassen</button>' +
      '<button class="btn" id="mv-durch">Bis zum Ende simulieren</button>' +
      '<span class="klein muted" id="mv-info"></span>' +
      '</div>';
  }

  function minuteText() {
    if (state.phase === 'vor') return 'Anpfiff';
    if (state.phase === 'pause') return 'Halbzeit';
    if (state.beendet) return 'Ende';
    var m = state.minute;
    if (state.phase === '1hz' && m > 45) return "45+" + (m - 45) + "'";
    if (state.phase === '2hz' && m > 90) return "90+" + (m - 90) + "'";
    return m + "'";
  }

  function zeichneLive() {
    var stand = doc.getElementById('mv-stand');
    if (stand) stand.textContent = state.tore.heim + ' : ' + state.tore.gast;
    var uhr = doc.getElementById('mv-uhr');
    if (uhr) uhr.textContent = minuteText();

    var ticker = doc.getElementById('mv-ticker');
    if (ticker) {
      var relevante = state.ereignisse.filter(function (e) {
        return ['ecke', 'geblockt'].indexOf(e.typ) < 0;
      });
      ticker.innerHTML = relevante.slice().reverse().slice(0, 60).map(function (e) {
        var gross = ['tor', 'rot', 'gelbrot', 'elfmeterpfiff', 'elfmeterVerschossen', 'elfmeterGehalten'].indexOf(e.typ) >= 0;
        return '<div class="tick tick--' + esc(e.typ) + (gross ? ' tick--gross' : '') + '">' +
          '<span class="tick__min">' + (e.minute ? e.minute + "'" : '') + '</span>' +
          '<span>' + esc(e.text) + '</span></div>';
      }).join('');
    }

    var stats = doc.getElementById('mv-stats');
    if (stats) stats.innerHTML = statistikHtml();

    var elf = doc.getElementById('mv-elf');
    if (elf) elf.innerHTML = elfHtml();

    var info = doc.getElementById('mv-info');
    if (info) {
      info.textContent = 'Wechsel: ' + eigeneSeite.wechselGemacht + ' / 5 · Fenster: ' +
        eigeneSeite.fensterGenutzt + ' / ' + eigeneSeite.wechselFenster;
    }
  }

  function statistikHtml() {
    var h = state.heim.stat, g = state.gast.stat;
    var bbSumme = h.ballbesitz + g.ballbesitz || 1;
    var zeilen = [
      ['Ballbesitz', Math.round(h.ballbesitz / bbSumme * 100) + ' %', Math.round(g.ballbesitz / bbSumme * 100) + ' %',
        h.ballbesitz / bbSumme, g.ballbesitz / bbSumme],
      ['Torschüsse', h.schuesse, g.schuesse, h.schuesse, g.schuesse],
      ['Aufs Tor', h.aufsTor, g.aufsTor, h.aufsTor, g.aufsTor],
      ['xG', U.num(h.xg, 2), U.num(g.xg, 2), h.xg, g.xg],
      ['Großchancen', h.grosschancen, g.grosschancen, h.grosschancen, g.grosschancen],
      ['Ecken', h.ecken, g.ecken, h.ecken, g.ecken],
      ['Fouls', h.fouls, g.fouls, h.fouls, g.fouls],
      ['Karten', h.gelb + h.rot + h.gelbrot, g.gelb + g.rot + g.gelbrot, h.gelb, g.gelb]
    ];
    return zeilen.map(function (r) {
      var s = (r[3] + r[4]) || 1;
      return '<div class="statbar"><div class="statbar__kopf"><b>' + r[1] + '</b><span class="muted">' +
        esc(r[0]) + '</span><b>' + r[2] + '</b></div><div class="statbar__spur">' +
        '<i style="width:' + (r[3] / s * 100) + '%"></i><i style="width:' + (r[4] / s * 100) + '%"></i>' +
        '</div></div>';
    }).join('');
  }

  function elfHtml() {
    var world = UI.world;
    var zeilen = eigeneSeite.elf.map(function (e) {
      var p = world.spieler[e.id];
      var d = eigeneSeite.spielerDaten[e.id] || {};
      if (!p) return '';
      var fit = Math.round(p.fitness);
      var marker = [];
      if (d.tore) marker.push('<span class="chip chip--gruen">' + d.tore + ' Tor' + (d.tore > 1 ? 'e' : '') + '</span>');
      if (d.vorlagen) marker.push('<span class="chip chip--blau">' + d.vorlagen + ' V</span>');
      if (d.gelb) marker.push('<span class="chip chip--gelb">G</span>');
      return '<tr><td>' + UI.posTag(e.pos) + '</td>' +
        '<td class="name">' + esc(p.nachname) + '</td>' +
        '<td style="width:70px">' + UI.balken(fit / 100, fit >= 70 ? '' : fit >= 50 ? 'bar--gelb' : 'bar--rot') + '</td>' +
        '<td class="num">' + fit + '</td>' +
        '<td>' + marker.join(' ') + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><tbody>' + zeilen + '</tbody></table></div>' +
      '<div class="klein muted mt">Bank: ' + eigeneSeite.bank.map(function (id) {
        var p = world.spieler[id];
        return p ? esc(p.nachname) : '';
      }).filter(Boolean).join(', ') + '</div>';
  }

  // ------------------------------------------------------------ Bedienung

  function verdrahte() {
    doc.getElementById('mv-play').onclick = function () {
      if (state.beendet) return;
      if (laeuft) { stoppeUhr(); } else { starteUhr(); }
      aktualisiereSteuerung();
    };
    doc.getElementById('mv-tempo').onchange = function () {
      UI.world.einstellungen.simGeschwindigkeit = parseInt(this.value, 10);
      if (laeuft) starteUhr();
    };
    doc.getElementById('mv-wechsel').onclick = function () { stoppeUhr(); aktualisiereSteuerung(); wechselDialog(); };
    doc.getElementById('mv-taktik').onclick = function () { stoppeUhr(); aktualisiereSteuerung(); taktikDialog(); };
    doc.getElementById('mv-durch').onclick = function () {
      stoppeUhr();
      FM.match.bisEnde(state);
      zeichneLive();
      abschluss();
    };
  }

  function aktualisiereSteuerung() {
    var b = doc.getElementById('mv-play');
    if (b) b.textContent = laeuft ? 'Pause' : 'Weiter';
  }

  function wechselDialog() {
    var world = UI.world;
    if (eigeneSeite.wechselKontingent <= 0) {
      UI.toast('Alle Wechsel sind aufgebraucht.', 'fehler');
      return;
    }
    var html = '<h2>Auswechslung</h2>' +
      '<p class="muted">Noch ' + eigeneSeite.wechselKontingent + ' Wechsel, ' +
      Math.max(0, eigeneSeite.wechselFenster - eigeneSeite.fensterGenutzt) + ' Wechselfenster übrig. ' +
      'Mehrere Wechsel in derselben Minute kosten nur ein Fenster.</p>' +
      '<div class="grid grid--2">' +
      '<div><h4>Auf dem Platz</h4><div id="mv-raus">' + eigeneSeite.elf.map(function (e) {
        var p = world.spieler[e.id];
        var d = eigeneSeite.spielerDaten[e.id] || {};
        if (!p) return '';
        return '<button class="option" data-raus="' + esc(e.id) + '">' + UI.posTag(e.pos) + ' <b>' + esc(p.nachname) + '</b>' +
          ' <span class="klein muted">Frische ' + Math.round(p.fitness) + ' %' +
          (d.gelb ? ' · verwarnt' : '') + (d.tore ? ' · ' + d.tore + ' Tore' : '') + '</span></button>';
      }).join('') + '</div></div>' +
      '<div><h4>Bank</h4><div id="mv-rein">' + eigeneSeite.bank.map(function (id) {
        var p = world.spieler[id];
        if (!p) return '';
        return '<button class="option" data-rein="' + esc(id) + '">' + UI.posTag(p.pos) + ' <b>' + esc(p.nachname) + '</b>' +
          ' <span class="klein muted">Stärke ' + Math.round(P.gesamt(p)) + ' · Frische ' + Math.round(p.fitness) + ' %</span></button>';
      }).join('') + '</div></div></div>' +
      '<div class="flex mt"><span class="klein muted" id="mv-wsel">Erst einen Spieler auf dem Platz wählen.</span></div>';

    var rausId = null;
    UI.modal(html, {
      breit: true,
      beimSchliessen: function () { if (!state.beendet) starteUhr(); },
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-raus]'), function (b) {
          b.onclick = function () {
            rausId = b.dataset.raus;
            Array.prototype.forEach.call(body.querySelectorAll('[data-raus]'), function (x) {
              x.style.borderColor = x === b ? 'var(--accent)' : '';
            });
            body.querySelector('#mv-wsel').textContent = 'Jetzt den Einwechselspieler wählen.';
          };
        });
        Array.prototype.forEach.call(body.querySelectorAll('[data-rein]'), function (b) {
          b.onclick = function () {
            if (!rausId) { UI.toast('Bitte zuerst einen Spieler auf dem Platz wählen.', 'fehler'); return; }
            var ok = FM.match.fuehreWechselDurch(state, eigeneSeite, rausId, b.dataset.rein, state.minute, false);
            if (!ok) { UI.toast('Der Wechsel ist nicht möglich.', 'fehler'); return; }
            UI.modalZu();
            zeichneLive();
            UI.toast('Wechsel durchgeführt.');
          };
        });
      }
    });
  }

  function taktikDialog() {
    var an = eigeneSeite.taktik.anweisungen;
    var html = '<h2>Taktik anpassen</h2><p class="muted">Änderungen wirken ab der nächsten Spielminute.</p>' +
      '<div class="anweisungen">' + Object.keys(D.ANWEISUNGEN).map(function (kat) {
        var a = D.ANWEISUNGEN[kat];
        return '<div><label>' + esc(a.label) + '</label><select data-anw="' + kat + '">' +
          a.werte.map(function (w) {
            return '<option value="' + esc(w.id) + '"' + (an[kat] === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>';
          }).join('') + '</select></div>';
      }).join('') + '</div>' +
      '<div class="flex mt"><button class="btn btn--primary" data-a="ok">Übernehmen</button></div>';

    UI.modal(html, {
      beimSchliessen: function () { if (!state.beendet) starteUhr(); },
      nachher: function (body) {
        body.querySelector('[data-a="ok"]').onclick = function () {
          Array.prototype.forEach.call(body.querySelectorAll('[data-anw]'), function (s) {
            an[s.dataset.anw] = s.value;
          });
          FM.match.neuBewerten(state, eigeneSeite, gegnerSeite);
          UI.modalZu();
          UI.toast('Umstellung vorgenommen.');
        };
      }
    });
  }

  // ------------------------------------------------------------ Halbzeit

  var ANSPRACHEN = [
    { id: 'lob', name: 'Das war stark – genau so weiter!',
      wirkung: function (fuehrung) { return fuehrung >= 0 ? { moral: 8, form: 4 } : { moral: -4, form: -2 }; } },
    { id: 'ruhig', name: 'Ruhig bleiben, wir spielen unser Spiel.',
      wirkung: function () { return { moral: 3, form: 1 }; } },
    { id: 'fordern', name: 'Ich erwarte deutlich mehr in der zweiten Hälfte.',
      wirkung: function (fuehrung) { return fuehrung < 0 ? { moral: -2, form: 7 } : { moral: -6, form: 2 }; } },
    { id: 'laut', name: 'So kann es nicht weitergehen! (laut werden)',
      wirkung: function (fuehrung) { return fuehrung < -1 ? { moral: -8, form: 10 } : { moral: -12, form: -2 }; } },
    { id: 'taktik', name: 'Wir stellen taktisch um.',
      wirkung: function () { return { moral: 1, form: 3, taktik: true }; } }
  ];

  function halbzeitansprache() {
    var world = UI.world;
    var eigeneTore = eigeneSeite === state.heim ? state.tore.heim : state.tore.gast;
    var gegnerTore = eigeneSeite === state.heim ? state.tore.gast : state.tore.heim;
    var fuehrung = eigeneTore - gegnerTore;
    var st = eigeneSeite.stat, gst = gegnerSeite.stat;

    var html = '<h4>Halbzeit</h4><h2>' + esc(state.heim.club.kurz) + ' ' + state.tore.heim + ':' +
      state.tore.gast + ' ' + esc(state.gast.club.kurz) + '</h2>' +
      '<div class="tiles mb">' +
      '<div class="tile"><span>Torschüsse</span><b>' + st.schuesse + ':' + gst.schuesse + '</b></div>' +
      '<div class="tile"><span>xG</span><b>' + U.num(st.xg, 2) + ':' + U.num(gst.xg, 2) + '</b></div>' +
      '<div class="tile"><span>Großchancen</span><b>' + st.grosschancen + ':' + gst.grosschancen + '</b></div>' +
      '<div class="tile"><span>Ø Frische</span><b>' +
      Math.round(U.avg(eigeneSeite.elf.map(function (e) {
        var p = world.spieler[e.id]; return p ? p.fitness : 0;
      }))) + ' %</b></div>' +
      '</div>' +
      '<h3>Kabinenansprache</h3><div class="optionen">' +
      ANSPRACHEN.map(function (a) {
        return '<button class="option" data-h="' + a.id + '">' + esc(a.name) + '</button>';
      }).join('') + '</div>';

    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-h]'), function (b) {
          b.onclick = function () {
            var a = ANSPRACHEN.filter(function (x) { return x.id === b.dataset.h; })[0];
            var w = a.wirkung(fuehrung);
            eigeneSeite.elf.forEach(function (e) {
              var p = world.spieler[e.id];
              if (!p) return;
              p.moral = U.clamp(p.moral + w.moral, 5, 99);
              p.form = U.clamp(p.form + w.form, 5, 99);
            });
            FM.match.neuBewerten(state, eigeneSeite, gegnerSeite);
            UI.modalZu();
            if (w.taktik) { taktikDialog(); return; }
            var text = w.form > 3 ? 'Die Mannschaft wirkt aufgeweckt.'
              : w.moral < 0 ? 'Die Ansprache kam nicht überall gut an.'
                : 'Die Mannschaft nimmt es auf.';
            UI.toast(text, w.form > 0 ? 'gut' : null);
            starteUhr();
          };
        });
      }
    });
  }

  // ------------------------------------------------------------ Abschluss

  function abschluss() {
    var world = UI.world;
    if (!spiel.gespielt) {
      FM.engine.verarbeiteSpiel(world, spiel, state);
    }
    var eigeneTore = eigeneSeite === state.heim ? state.tore.heim : state.tore.gast;
    var gegnerTore = eigeneSeite === state.heim ? state.tore.gast : state.tore.heim;
    var ausgang = eigeneTore > gegnerTore ? 'Sieg' : eigeneTore === gegnerTore ? 'Unentschieden' : 'Niederlage';

    var html = '<h4>Schlusspfiff</h4><h2>' + ausgang + ' – ' + esc(state.heim.club.kurz) + ' ' +
      state.tore.heim + ':' + state.tore.gast + ' ' + esc(state.gast.club.kurz) + '</h2>';
    if (state.elfmeterschiessen) {
      html += '<p>Elfmeterschießen: <b>' + state.elfmeterschiessen.heim + ':' + state.elfmeterschiessen.gast + '</b></p>';
    }
    var sds = state.spielerDesSpiels;
    if (sds && world.spieler[sds.spielerId]) {
      html += '<p>Spieler des Spiels: <b>' + esc(world.spieler[sds.spielerId].nachname) + '</b> (Note ' +
        U.note(sds.note) + ', ' + esc(world.vereine[sds.teamId].kurz) + ')</p>';
    }
    html += '<div class="flex mt">' +
      '<button class="btn btn--primary" data-a="pk">Pressekonferenz</button>' +
      '<button class="btn" data-a="bericht">Spielbericht</button>' +
      '<button class="btn" data-a="zu">Zurück zum Verein</button></div>';

    UI.modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="bericht"]').onclick = function () { UI.modalZu(); FM.views.spielbericht(spiel); };
        body.querySelector('[data-a="zu"]').onclick = function () { UI.modalZu(); schliesse(); };
        body.querySelector('[data-a="pk"]').onclick = function () {
          UI.modalZu();
          var pk = FM.media.pkNachSpiel(world, spiel, spiel.ergebnis);
          UI.pressekonferenz(pk, function () { schliesse(); });
        };
      }
    });
  }

  function schliesse() {
    stoppeUhr();
    UI.el('matchview').hidden = true;
    UI.el('matchview').innerHTML = '';
    state = null;
    spiel = null;
    UI.zeichne();
  }

  MV.schliesse = schliesse;
  MV.laeuft = function () { return !!state; };

})(typeof window !== 'undefined' ? window : globalThis);
