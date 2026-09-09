/*
 * ui.js - Grundgerüst der Oberfläche.
 *
 * Hier stehen der Zustand der Anzeige, die Navigation, wiederkehrende
 * Bausteine (Tabellenzeilen, Wappen, Balken) sowie Dialog und Hinweise.
 * Die einzelnen Ansichten selbst liegen in views.js.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;
  var doc = global.document;

  var UI = FM.ui = {
    world: null,
    ansicht: 'uebersicht',
    zustand: {},          // je Ansicht: Sortierung, Filter usw.
    views: {},
    beschaeftigt: false
  };

  // ------------------------------------------------------------ Kleinteile

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(id) { return doc.getElementById(id); }

  /** Wappenersatz: farbiges Feld mit dem Kürzel des Vereins. */
  function wappen(club, klein) {
    if (!club) return '';
    return '<span class="crest' + (klein ? ' crest--sm' : '') + '" data-k="' + esc(club.kurz) +
      '" style="background:' + esc(club.farbe) + ';border-color:' + esc(club.farbe2) + '"></span>';
  }

  function vereinName(world, id, kurz) {
    var c = world.vereine[id];
    if (!c) return '?';
    return esc(kurz ? c.kurz : c.name);
  }

  /** Verein mit Wappen als Zelleninhalt. */
  function vereinZelle(world, id, kurz) {
    var c = world.vereine[id];
    if (!c) return '?';
    return '<span class="flex" style="gap:6px">' + wappen(c, true) +
      '<span>' + esc(kurz ? c.kurz : c.name) + '</span></span>';
  }

  function posTag(pos) {
    var g = D.POS_GRUPPE[pos] || 'MIT';
    return '<span class="pos-tag pos-' + g + '">' + esc(pos) + '</span>';
  }

  function wertKlasse(v) {
    if (v >= 78) return 'w-top';
    if (v >= 68) return 'w-gut';
    if (v >= 56) return 'w-mittel';
    if (v >= 44) return 'w-schwach';
    return 'w-schlecht';
  }

  function wert(v, digits) {
    return '<span class="wert ' + wertKlasse(v) + '">' + U.num(v, digits === undefined ? 0 : digits) + '</span>';
  }

  function balken(anteil, klasse) {
    var pct = Math.round(U.clamp(anteil, 0, 1) * 100);
    return '<span class="bar ' + (klasse || '') + '"><i style="width:' + pct + '%"></i></span>';
  }

  function formPunkte(form) {
    if (!form || !form.length) return '<span class="muted">–</span>';
    return '<span class="form-dots">' + form.slice(-5).map(function (f) {
      return '<i class="form-' + f + '">' + f + '</i>';
    }).join('') + '</span>';
  }

  /** Zustandssymbole eines Spielers: verletzt, gesperrt, wechselwillig. */
  function spielerStatus(world, p) {
    var out = [];
    if (p.verletzung) {
      out.push('<span class="chip chip--rot" title="' + esc(p.verletzung.name) + '">✚ ' +
        Math.ceil(p.verletzung.tage) + ' T</span>');
    }
    if (p.sperre > 0) out.push('<span class="chip chip--gelb" title="' + esc(p.sperreGrund) + '">⛔ ' + p.sperre + '</span>');
    if (p.leihe && p.leihe.vonClubId) out.push('<span class="chip chip--blau" title="Leihspieler">⇄</span>');
    if (p.transferliste) out.push('<span class="chip" title="Auf der Transferliste">TL</span>');
    if (p.wechselwunsch > 60) out.push('<span class="chip chip--rot" title="Wechselwunsch">↗</span>');
    if (p.kapitaen) out.push('<span class="chip chip--gruen" title="Kapitän">C</span>');
    if (p.eigengewaechs) out.push('<span class="chip chip--lila" title="Eigengewächs">★</span>');
    return out.join(' ');
  }

  function noteFarbe(note) {
    if (!note) return 'muted';
    if (note <= 2.0) return 'w-top';
    if (note <= 2.9) return 'w-gut';
    if (note <= 3.6) return 'w-mittel';
    if (note <= 4.4) return 'w-schwach';
    return 'w-schlecht';
  }

  function noteZelle(note) {
    if (!note) return '<span class="muted">–</span>';
    return '<span class="wert ' + noteFarbe(note) + '">' + U.note(note) + '</span>';
  }

  function fitnessBalken(p) {
    var k = p.fitness >= 85 ? '' : p.fitness >= 65 ? 'bar--gelb' : 'bar--rot';
    return balken(p.fitness / 100, k);
  }

  function tage(n) { return Math.ceil(n) + ' Tag' + (Math.ceil(n) === 1 ? '' : 'e'); }

  // ------------------------------------------------------------ Hinweise & Dialog

  var toastTimer = null;
  function toast(text, art) {
    var t = el('toast');
    t.textContent = text;
    t.className = 'toast is-an' + (art ? ' toast--' + art : '');
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { t.className = 'toast'; }, art === 'fehler' ? 4200 : 2600);
  }

  var modalNachSchliessen = null;
  function modal(html, opts) {
    opts = opts || {};
    var m = el('modal');
    var box = m.querySelector('.modal__box');
    box.className = 'modal__box' + (opts.breit ? ' modal__box--breit' : '');
    el('modal-body').innerHTML = html;
    m.hidden = false;
    modalNachSchliessen = opts.beimSchliessen || null;
    if (opts.nachher) opts.nachher(el('modal-body'));
  }

  function modalZu() {
    el('modal').hidden = true;
    el('modal-body').innerHTML = '';
    var fn = modalNachSchliessen;
    modalNachSchliessen = null;
    if (fn) fn();
  }

  function bestaetigen(titel, text, aufOk, okText, gefahr) {
    modal('<h2>' + esc(titel) + '</h2><p>' + text + '</p>' +
      '<div class="flex mt"><button class="btn' + (gefahr ? ' btn--danger' : ' btn--primary') +
      '" data-ja="1">' + esc(okText || 'Bestätigen') + '</button>' +
      '<button class="btn" data-nein="1">Abbrechen</button></div>', {
      nachher: function (body) {
        body.querySelector('[data-ja]').onclick = function () { modalZu(); aufOk(); };
        body.querySelector('[data-nein]').onclick = modalZu;
      }
    });
  }

  // ------------------------------------------------------------ Navigation

  function zeige(name, zustand) {
    if (!UI.views[name]) name = 'uebersicht';
    UI.ansicht = name;
    if (zustand) UI.zustand[name] = Object.assign(UI.zustand[name] || {}, zustand);
    Array.prototype.forEach.call(doc.querySelectorAll('.nav__item'), function (b) {
      b.classList.toggle('is-active', b.dataset.view === name);
    });
    zeichne();
    el('content').scrollTop = 0;
    global.scrollTo(0, 0);
  }

  /**
   * Zeichnet die aktuelle Ansicht und die Kopfzeile neu.
   *
   * Der Zustand einer Ansicht (Filter, Sortierung, gewählter Reiter) wird
   * dauerhaft in UI.zustand gehalten. Er muss vor dem Rendern angelegt
   * werden - sonst schreiben die Bedienelemente in ein Wegwerfobjekt und
   * jede Einstellung wäre beim nächsten Zeichnen wieder verloren.
   */
  function zeichne() {
    var world = UI.world;
    if (!world) return;
    kopfzeile();
    var name = UI.views[UI.ansicht] ? UI.ansicht : 'uebersicht';
    var view = UI.views[name];
    var zustand = UI.zustand[name] = UI.zustand[name] || {};
    var content = el('content');
    content.innerHTML = view.html(world, zustand);
    if (view.nachher) view.nachher(content, world, zustand);
  }

  function kopfzeile() {
    var world = UI.world;
    var club = world.nutzerVerein();
    if (!club) return;
    var f = world.finanzen[club.id];
    var tab = world.tabellenPlatz(club.id);
    var liga = world.ligaVon(club.id);

    el('tb-crest').setAttribute('data-k', club.kurz);
    el('tb-crest').style.background = club.farbe;
    el('tb-crest').style.borderColor = club.farbe2;
    el('tb-verein').textContent = club.name;
    el('tb-liga').textContent = (liga ? liga.name : '') +
      (world.manager.saisonziel ? ' · Ziel: ' + world.manager.saisonziel.text : '');
    el('tb-datum').textContent = U.fmtDate(world.tag, 'lang');
    el('tb-platz').textContent = tab ? tab.platz + '. (' + (tab.punkte - tab.punktabzug) + ' Pkt)' : '–';
    el('tb-konto').textContent = U.money(f.kontostand);
    el('tb-konto').className = f.kontostand < 0 ? 'w-schlecht' : '';
    var v = Math.round(world.manager.vorstandsvertrauen);
    el('tb-vorstand').innerHTML = '<span class="' + (v >= 60 ? 'w-gut' : v >= 35 ? 'w-mittel' : 'w-schlecht') +
      '">' + v + ' %</span>';

    var ungelesen = world.ungeleseneNachrichten();
    var badge = el('nav-inbox');
    badge.hidden = ungelesen === 0;
    badge.textContent = ungelesen;
  }

  // ------------------------------------------------------------ Sortierbare Tabellen

  /**
   * Baut eine Tabelle mit sortierbaren Spalten.
   * spalten: [{ key, label, klasse, wert(zeile), html(zeile), sortierbar }]
   */
  function tabelle(spalten, zeilen, opts) {
    opts = opts || {};
    var sortKey = opts.sortKey;
    var absteigend = opts.absteigend;
    if (sortKey) {
      var sp = spalten.filter(function (s) { return s.key === sortKey; })[0];
      if (sp && sp.wert) zeilen = U.sortBy(zeilen, sp.wert, absteigend);
    }
    var html = '<div class="table-wrap"><table><thead><tr>';
    spalten.forEach(function (s) {
      html += '<th class="' + (s.klasse || '') + (s.wert ? ' sortable' : '') +
        (s.key === sortKey ? ' is-sorted' : '') + '"' +
        (s.wert ? ' data-sort="' + esc(s.key) + '"' : '') +
        (s.titel ? ' title="' + esc(s.titel) + '"' : '') + '>' + s.label +
        (s.key === sortKey ? (absteigend ? ' ▾' : ' ▴') : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    if (!zeilen.length) {
      html += '<tr><td colspan="' + spalten.length + '"><div class="leer">' +
        esc(opts.leerText || 'Keine Einträge.') + '</div></td></tr>';
    }
    zeilen.forEach(function (z) {
      html += '<tr class="' + (opts.zeilenKlasse ? opts.zeilenKlasse(z) : '') + '"' +
        (opts.zeilenAttr ? ' ' + opts.zeilenAttr(z) : '') + '>';
      spalten.forEach(function (s) {
        html += '<td class="' + (s.klasse || '') + '">' + s.html(z) + '</td>';
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  /**
   * Verbindet Filter-Bedienelemente mit dem Zustand der Ansicht.
   * Textfelder und Zahlenfelder reagieren schon beim Tippen; damit dabei
   * der Eingabefokus nicht verloren geht, wird er nach dem Neuzeichnen
   * wiederhergestellt.
   */
  function filterBinden(container, ansicht, attribut) {
    var zustand = UI.zustand[ansicht] = UI.zustand[ansicht] || {};
    Array.prototype.forEach.call(container.querySelectorAll('[' + attribut + ']'), function (e) {
      var key = e.getAttribute(attribut);
      var tippend = e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'number');
      function uebernehmen() {
        zustand[key] = e.type === 'checkbox' ? e.checked : e.value;
        var pos = null;
        try { pos = tippend && e.type === 'text' ? e.selectionStart : null; } catch (f) { pos = null; }
        zeichne();
        if (!tippend) return;
        var neu = el('content').querySelector('[' + attribut + '="' + key + '"]');
        if (!neu) return;
        neu.focus();
        try { if (pos !== null) neu.setSelectionRange(pos, pos); } catch (f2) { /* Zahlenfelder */ }
      }
      e.addEventListener('change', uebernehmen);
      if (tippend) e.addEventListener('input', uebernehmen);
    });
  }

  /** Verdrahtet die Sortierklicks einer Tabelle mit dem Ansichtszustand. */
  function tabelleSortierung(container, ansicht, standardKey) {
    Array.prototype.forEach.call(container.querySelectorAll('th[data-sort]'), function (th) {
      th.onclick = function () {
        var z = UI.zustand[ansicht] = UI.zustand[ansicht] || {};
        var key = th.dataset.sort;
        if (z.sortKey === key) z.absteigend = !z.absteigend;
        else { z.sortKey = key; z.absteigend = true; }
        zeichne();
      };
    });
  }

  // ------------------------------------------------------------ Weiter-Taste

  /**
   * Rueckt einen Tag vor. Erkennt eigene Spiele, Nachrichten und das
   * Saisonende und reagiert entsprechend.
   */
  function weiter(schnell) {
    var world = UI.world;
    if (UI.beschaeftigt) return;
    UI.beschaeftigt = true;
    try {
      var r = FM.engine.tagWeiter(world);
      if (r.status === 'spiel') {
        UI.beschaeftigt = false;
        vorSpielAblauf(r.spiel);
        return;
      }
      if (r.status === 'saisonende') {
        UI.beschaeftigt = false;
        saisonende();
        return;
      }
      if (r.status === 'entlassen') {
        UI.beschaeftigt = false;
        entlassung();
        return;
      }
      UI.beschaeftigt = false;
      zeichne();
      var neue = world.inbox.filter(function (n) {
        return !n.gelesen && n.prioritaet >= 3 && n.tag >= world.tag - 1;
      });
      if (neue.length) zeigeNachricht(neue[0]);
    } catch (e) {
      UI.beschaeftigt = false;
      console.error(e);
      toast('Fehler beim Fortsetzen: ' + e.message, 'fehler');
    }
  }

  /** Vor dem eigenen Spiel: Aufstellung prüfen, Pressekonferenz, Anpfiff. */
  function vorSpielAblauf(spiel) {
    var world = UI.world;
    var club = world.nutzerVerein();
    var gegnerId = spiel.heimId === club.id ? spiel.gastId : spiel.heimId;
    var gegner = world.vereine[gegnerId];
    var taktik = world.taktikVon(club.id);
    FM.tactics.aufstellungVorbereiten(world, club.id, spiel.wettbewerb, false);
    var probleme = FM.tactics.pruefeAufstellung(world, club, taktik);

    var html = '<h2>' + esc(spiel.rundeName || 'Spieltag') + '</h2>' +
      '<div class="flex flex--zwischen mb"><div class="flex">' +
      wappen(world.vereine[spiel.heimId]) + '<b>' + esc(world.vereine[spiel.heimId].name) + '</b>' +
      '<span class="muted">gegen</span>' +
      wappen(world.vereine[spiel.gastId]) + '<b>' + esc(world.vereine[spiel.gastId].name) + '</b>' +
      '</div><span class="chip">' + esc(spiel.zeit) + ' Uhr</span></div>';

    html += '<div class="card card--flat mb"><div class="grid grid--3">' +
      '<div><h4>Aufstellung</h4><div>' + esc(taktik.formation) + ' · Einspielgrad ' +
      Math.round(taktik.einspielgrad) + ' %</div></div>' +
      '<div><h4>Gegner</h4><div>' + esc(gegner.name) + ' · Ruf ' + gegner.ruf + '</div></div>' +
      '<div><h4>Wettbewerb</h4><div>' + esc(wettbewerbName(world, spiel)) + '</div></div>' +
      '</div></div>';

    if (probleme.length) {
      html += '<div class="card card--flat mb" style="border-color:var(--rot)"><h4 style="color:var(--rot)">Hinweise zur Aufstellung</h4><ul class="klein">' +
        probleme.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }

    html += '<div class="flex mt">' +
      '<button class="btn btn--primary btn--big" data-a="anpfiff">Spiel leiten</button>' +
      '<button class="btn" data-a="taktik">Zur Taktik</button>' +
      '<button class="btn" data-a="simulieren">Ergebnis simulieren</button>' +
      '</div>';

    modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="anpfiff"]').onclick = function () {
          modalZu();
          var pk = FM.media.pkVorSpiel(world, spiel);
          if (pk.fragen.length) pressekonferenz(pk, function () { FM.matchview.starte(spiel); });
          else FM.matchview.starte(spiel);
        };
        body.querySelector('[data-a="taktik"]').onclick = function () { modalZu(); zeige('taktik'); };
        body.querySelector('[data-a="simulieren"]').onclick = function () {
          modalZu();
          var state = FM.match.simuliere(world, spiel);
          FM.engine.verarbeiteSpiel(world, spiel, state);
          zeichne();
          FM.views.spielbericht(spiel);
        };
      }
    });
  }

  function wettbewerbName(world, spiel) {
    switch (spiel.wettbewerb) {
      case 'liga': return world.ligen[spiel.ligaId] ? world.ligen[spiel.ligaId].name : 'Liga';
      case 'pokal': return 'DFB-Pokal';
      case 'europa': case 'europaKo':
        return world.europa[spiel.europaId] ? world.europa[spiel.europaId].name : 'Europapokal';
      case 'supercup': return 'DFL-Supercup';
      case 'relegation': return 'Relegation';
      case 'test': return 'Testspiel';
      default: return spiel.wettbewerb;
    }
  }

  /** Zeigt eine Pressekonferenz Frage für Frage. */
  function pressekonferenz(pk, fertig) {
    var world = UI.world;
    var index = 0;

    function naechste() {
      if (index >= pk.fragen.length) {
        pk.beantwortet = true;
        modalZu();
        if (fertig) fertig();
        return;
      }
      var frage = pk.fragen[index];
      var html = '<h4>Pressekonferenz · Frage ' + (index + 1) + ' von ' + pk.fragen.length + '</h4>' +
        '<h2 style="font-size:17px">' + esc(frage.frage) + '</h2>' +
        '<div class="optionen mt">' +
        frage.optionen.map(function (o, i) {
          return '<button class="option" data-i="' + i + '">' + esc(o.text) + '</button>';
        }).join('') + '</div>';
      modal(html, {
        nachher: function (body) {
          Array.prototype.forEach.call(body.querySelectorAll('.option'), function (b) {
            b.onclick = function () {
              var opt = FM.media.antworten(world, pk, index, parseInt(b.dataset.i, 10));
              index++;
              if (opt) {
                var teile = [];
                if (opt.moral) teile.push('Mannschaft ' + (opt.moral > 0 ? '+' : '') + opt.moral);
                if (opt.fans) teile.push('Fans ' + (opt.fans > 0 ? '+' : '') + opt.fans);
                if (opt.vorstand) teile.push('Vorstand ' + (opt.vorstand > 0 ? '+' : '') + opt.vorstand);
                if (teile.length) toast(teile.join(' · '), opt.moral >= 0 ? 'gut' : null);
              }
              naechste();
            };
          });
        }
      });
    }
    naechste();
  }

  function zeigeNachricht(n) {
    n.gelesen = true;
    var world = UI.world;
    var html = '<h4>' + esc(nachrichtTyp(n.typ)) + ' · ' + U.fmtDate(n.tag, 'lang') + '</h4>' +
      '<h2>' + esc(n.titel) + '</h2><p>' + esc(n.text).replace(/\n/g, '<br>') + '</p>';

    if (n.aktion === 'angebot' && n.angebotId) {
      var angebot = world.transfer.angeboteEin.filter(function (a) { return a.id === n.angebotId; })[0];
      if (angebot && angebot.status === 'offen') {
        html += '<div class="flex mt">' +
          '<button class="btn btn--primary" data-a="ja">Angebot annehmen</button>' +
          '<button class="btn" data-a="nein">Ablehnen</button>' +
          '<button class="btn btn--ghost" data-a="spieler">Spieler ansehen</button></div>';
      }
    } else if (n.aktion === 'gespraech' && n.spielerId) {
      html += '<div class="flex mt"><button class="btn btn--primary" data-a="reden">Gespräch führen</button>' +
        '<button class="btn" data-a="spieler">Spielerprofil</button></div>';
    } else if (n.spielerId || (n.spielerIds && n.spielerIds.length)) {
      html += '<div class="flex mt"><button class="btn" data-a="spieler">Spielerprofil</button></div>';
    }

    modal(html, {
      beimSchliessen: function () { kopfzeile(); },
      nachher: function (body) {
        var ja = body.querySelector('[data-a="ja"]');
        if (ja) ja.onclick = function () {
          var r = FM.transfers.angebotEntscheiden(world, n.angebotId, true);
          modalZu();
          if (r.fehler) toast(r.fehler, 'fehler');
          else if (r.status === 'verkauft') toast('Transfer abgeschlossen: ' + U.money(r.betrag), 'gut');
          else if (r.status === 'geplatzt') toast(r.text || 'Der Wechsel ist geplatzt.', 'fehler');
          zeichne();
        };
        var nein = body.querySelector('[data-a="nein"]');
        if (nein) nein.onclick = function () {
          FM.transfers.angebotEntscheiden(world, n.angebotId, false);
          modalZu(); toast('Angebot abgelehnt.'); zeichne();
        };
        var sp = body.querySelector('[data-a="spieler"]');
        if (sp) sp.onclick = function () {
          var id = n.spielerId || (n.spielerIds && n.spielerIds[0]);
          modalZu();
          if (id) FM.views.spielerProfil(id);
        };
        var reden = body.querySelector('[data-a="reden"]');
        if (reden) reden.onclick = function () { modalZu(); FM.views.spielerProfil(n.spielerId, 'gespraech'); };
      }
    });
  }

  function nachrichtTyp(t) {
    var m = {
      medizin: 'Medizinische Abteilung', transfer: 'Transfermarkt', angebot: 'Angebot',
      vertrag: 'Vertragswesen', scouting: 'Scouting', kabine: 'Kabine', vorstand: 'Vorstand',
      verband: 'Verband', wettbewerb: 'Wettbewerb', training: 'Training', saison: 'Saison',
      nachwuchs: 'Nachwuchs', verein: 'Verein', presse: 'Presse'
    };
    return m[t] || 'Mitteilung';
  }

  function nachrichtIcon(t) {
    var m = {
      medizin: '✚', transfer: '⇄', angebot: '€', vertrag: '✎', scouting: '🔍', kabine: '👥',
      vorstand: '⌂', verband: '⚖', wettbewerb: '🏆', training: '◷', saison: '◆',
      nachwuchs: '★', verein: '⌂', presse: '✉'
    };
    return m[t] || '✉';
  }

  // ------------------------------------------------------------ Saisonende / Entlassung

  function saisonende() {
    var world = UI.world;
    var C = FM.competitions;
    var liga = world.ligaVon(world.nutzerClubId);
    var tab = C.sortierteTabelle(liga);
    var eigen = tab.filter(function (e) { return e.clubId === world.nutzerClubId; })[0];
    var ziel = world.manager.saisonziel;
    var erreicht = eigen && ziel && eigen.platz <= ziel.platz;

    var html = '<h4>Saison ' + world.saison + '/' + String(world.saison + 1).slice(2) + '</h4>' +
      '<h2>' + (erreicht ? 'Saisonziel erreicht' : 'Saison beendet') + '</h2>' +
      '<div class="tiles mb">' +
      '<div class="tile"><span>Abschlussplatz</span><b>' + (eigen ? eigen.platz + '.' : '–') + '</b><small>' + esc(liga.name) + '</small></div>' +
      '<div class="tile"><span>Punkte</span><b>' + (eigen ? eigen.punkte - eigen.punktabzug : 0) + '</b><small>' +
      (eigen ? eigen.siege + 'S ' + eigen.remis + 'U ' + eigen.niederlagen + 'N' : '') + '</small></div>' +
      '<div class="tile"><span>Tore</span><b>' + (eigen ? eigen.tore + ':' + eigen.gegentore : '–') + '</b></div>' +
      '<div class="tile"><span>Vorgabe</span><b>' + (ziel ? 'Platz ' + ziel.platz : '–') + '</b><small>' +
      esc(ziel ? ziel.text : '') + '</small></div>' +
      '</div>';

    html += '<h3>Meister: ' + esc(world.vereine[tab[0].clubId] ? world.vereine[tab[0].clubId].name : '') + '</h3>';
    if (world.pokal && world.pokal.sieger) {
      html += '<p>DFB-Pokalsieger: <b>' + esc(world.vereine[world.pokal.sieger].name) + '</b></p>';
    }
    var tk = FM.engine.torschuetzenkoenig(world);
    if (tk) html += '<p>Torschützenkönig: <b>' + esc(tk.name) + '</b> mit ' + tk.tore + ' Toren</p>';

    html += '<div class="flex mt"><button class="btn btn--primary btn--big" data-a="weiter">Neue Saison beginnen</button></div>';

    modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="weiter"]').onclick = function () {
          modalZu();
          FM.engine.saisonAbschluss(world);
          zeige('uebersicht');
          toast('Willkommen in der Saison ' + world.saison + '/' + String(world.saison + 1).slice(2), 'gut');
        };
      }
    });
  }

  function entlassung() {
    var world = UI.world;
    var club = world.nutzerVerein();
    var html = '<h2>Sie wurden entlassen</h2>' +
      '<p>Der Vorstand von <b>' + esc(club.name) + '</b> hat sich entschieden, den Trainerposten neu zu besetzen. ' +
      'Die sportliche Entwicklung entsprach nicht den Erwartungen.</p>' +
      '<div class="tiles mb">' +
      '<div class="tile"><span>Spiele</span><b>' + world.manager.bilanz.spiele + '</b></div>' +
      '<div class="tile"><span>Siege</span><b>' + world.manager.bilanz.siege + '</b></div>' +
      '<div class="tile"><span>Unentschieden</span><b>' + world.manager.bilanz.remis + '</b></div>' +
      '<div class="tile"><span>Niederlagen</span><b>' + world.manager.bilanz.niederlagen + '</b></div>' +
      '</div>' +
      '<p>Andere Vereine könnten Interesse an Ihnen haben.</p>' +
      '<div class="flex mt"><button class="btn btn--primary" data-a="neu">Neuen Verein suchen</button>' +
      '<button class="btn" data-a="ende">Karriere beenden</button></div>';
    modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="neu"]').onclick = function () { modalZu(); FM.views.vereinSuche(); };
        body.querySelector('[data-a="ende"]').onclick = function () { global.location.reload(); };
      }
    });
  }

  UI.esc = esc;
  UI.el = el;
  UI.wappen = wappen;
  UI.vereinName = vereinName;
  UI.vereinZelle = vereinZelle;
  UI.posTag = posTag;
  UI.wert = wert;
  UI.wertKlasse = wertKlasse;
  UI.balken = balken;
  UI.formPunkte = formPunkte;
  UI.spielerStatus = spielerStatus;
  UI.noteZelle = noteZelle;
  UI.noteFarbe = noteFarbe;
  UI.fitnessBalken = fitnessBalken;
  UI.tage = tage;
  UI.toast = toast;
  UI.modal = modal;
  UI.modalZu = modalZu;
  UI.bestaetigen = bestaetigen;
  UI.zeige = zeige;
  UI.zeichne = zeichne;
  UI.kopfzeile = kopfzeile;
  UI.tabelle = tabelle;
  UI.tabelleSortierung = tabelleSortierung;
  UI.filterBinden = filterBinden;
  UI.weiter = weiter;
  UI.vorSpielAblauf = vorSpielAblauf;
  UI.pressekonferenz = pressekonferenz;
  UI.zeigeNachricht = zeigeNachricht;
  UI.nachrichtTyp = nachrichtTyp;
  UI.nachrichtIcon = nachrichtIcon;
  UI.wettbewerbName = wettbewerbName;
  UI.saisonende = saisonende;

})(typeof window !== 'undefined' ? window : globalThis);
