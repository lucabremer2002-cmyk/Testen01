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
    ansicht: 'kacheln',
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

  /** Schmaler Bildschirm? Entscheidet über Sprungverhalten und Dialogform. */
  function schmal() {
    return global.matchMedia ? global.matchMedia('(max-width: 820px)').matches : false;
  }

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
    // Die Breite kommt als Variable herein, damit sie per Animation
    // von null einlaufen kann.
    return '<span class="bar ' + (klasse || '') + '"><i style="--w:' + pct + '%"></i></span>';
  }

  /**
   * Fortschrittsring als SVG. Wird für Vertrauenswerte, Saisonziel und
   * die Frische auf dem Spielfeld verwendet.
   */
  function ring(anteil, opts) {
    opts = opts || {};
    var groesse = opts.groesse || 54;
    var dicke = opts.dicke || 5;
    var radius = (groesse - dicke) / 2;
    var umfang = 2 * Math.PI * radius;
    var wert = U.clamp(anteil, 0, 1);
    // Helle Töne: der Ring liegt oft auf dem dunklen Rasen, wo ein
    // dunkles Ocker als Schmutzrand liest.
    var farbe = opts.farbe || (wert >= .66 ? 'var(--gut)' : wert >= .34 ? 'var(--warn-hell)' : 'var(--schlecht)');
    return '<span class="ring" style="width:' + groesse + 'px;height:' + groesse + 'px">' +
      '<svg width="' + groesse + '" height="' + groesse + '" viewBox="0 0 ' + groesse + ' ' + groesse + '">' +
      '<circle class="ring__spur" cx="' + groesse / 2 + '" cy="' + groesse / 2 + '" r="' + radius +
      '" stroke-width="' + dicke + '"></circle>' +
      // Der Ring startet leer und läuft nach dem Einfügen auf seinen Wert.
      '<circle class="ring__wert" cx="' + groesse / 2 + '" cy="' + groesse / 2 + '" r="' + radius +
      '" stroke-width="' + dicke + '" stroke="' + farbe + '"' +
      ' stroke-dasharray="' + umfang.toFixed(1) + '"' +
      ' stroke-dashoffset="' + umfang.toFixed(1) + '"' +
      ' data-ziel="' + (umfang * (1 - wert)).toFixed(1) + '"></circle></svg>' +
      (opts.text !== undefined
        ? '<span class="ring__mitte">' + opts.text +
          (opts.unter ? '<small>' + opts.unter + '</small>' : '') + '</span>'
        : '') +
      '</span>';
  }

  /** Setzt alle frisch gezeichneten Ringe auf ihren Zielwert. */
  function ringeStarten(container) {
    var kreise = (container || doc).querySelectorAll('.ring__wert[data-ziel]');
    if (!kreise.length) return;
    global.requestAnimationFrame(function () {
      Array.prototype.forEach.call(kreise, function (c) {
        c.style.strokeDashoffset = c.getAttribute('data-ziel');
      });
    });
  }

  /** Kurzer Konfettiregen – für Siege, Titel und Aufstiege. */
  function konfetti(staerke) {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var anzahl = staerke || 60;
    var farben = ['#00E585', '#6BFFC0', '#FFC94D', '#56A8FF', '#B98BFF', '#ffffff'];
    var box = doc.createElement('div');
    box.className = 'konfetti';
    var html = '';
    for (var i = 0; i < anzahl; i++) {
      var links = Math.random() * 100;
      var dx = (Math.random() - 0.5) * 260;
      var dauer = 2.2 + Math.random() * 1.6;
      html += '<i style="left:' + links.toFixed(1) + '%;background:' +
        farben[i % farben.length] + ';--dx:' + dx.toFixed(0) + 'px;--dr:' +
        Math.round(Math.random() * 900 - 450) + 'deg;--dur:' + dauer.toFixed(2) + 's;animation-delay:' +
        (Math.random() * 0.5).toFixed(2) + 's"></i>';
    }
    box.innerHTML = html;
    doc.body.appendChild(box);
    global.setTimeout(function () { box.remove(); }, 4600);
  }

  /** Zählt eine Zahl im Element sichtbar hoch. */
  function zahlHoch(element, ziel, formatieren, dauer) {
    if (!element) return;
    dauer = dauer || 700;
    var start = 0;
    var beginn = null;
    function schritt(zeit) {
      if (beginn === null) beginn = zeit;
      var t = U.clamp((zeit - beginn) / dauer, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      element.textContent = formatieren(start + (ziel - start) * e);
      if (t < 1) global.requestAnimationFrame(schritt);
    }
    global.requestAnimationFrame(schritt);
  }

  /**
   * Serienanzeige: drei Siege in Folge sollen sich auch so anfühlen.
   * Liefert einen Chip oder einen leeren String.
   */
  function serie(form) {
    if (!form || form.length < 2) return '';
    var letzte = form[form.length - 1];
    var n = 0;
    for (var i = form.length - 1; i >= 0; i--) {
      if (form[i] === letzte) n++; else break;
    }
    if (letzte === 'S' && n >= 2) {
      return '<span class="streak"><i>🔥</i>' + n + ' Siege in Folge</span>';
    }
    if (letzte === 'N' && n >= 3) {
      return '<span class="streak streak--kalt"><i>❄</i>' + n + ' Niederlagen in Folge</span>';
    }
    if (letzte === 'U' && n >= 3) {
      return '<span class="streak streak--kalt"><i>=</i>' + n + ' Unentschieden in Folge</span>';
    }
    return '';
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
    // Auslaufende Vertraege: erklaert nebenbei, warum der Marktwert faellt.
    if (p.clubId && p.vertrag && !p.leihe) {
      var rest = FM.players.restlaufzeitMonate(p, world);
      if (rest <= 12) {
        out.push('<span class="chip chip--' + (rest <= 6 ? 'rot' : 'gelb') +
          '" title="Vertrag läuft in ' + U.pl(rest, 'Monat', 'Monaten') + ' aus - ab Januar darf er ablösefrei woanders unterschreiben">V ' +
          rest + ' M</span>');
      }
    }
    if (p.vorvertrag) {
      out.push('<span class="chip chip--rot" title="Hat bereits woanders unterschrieben">Vorvertrag</span>');
    }
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
    var symbol = art === 'gut' ? '✓' : art === 'fehler' ? '!' : '›';
    t.innerHTML = '<span aria-hidden="true">' + symbol + '</span><span>' + esc(text) + '</span>';
    t.className = 'toast is-an' + (art ? ' toast--' + art : '');
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { t.className = 'toast'; }, art === 'fehler' ? 4400 : 2700);
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
    ringeStarten(el('modal-body'));
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
    if (!UI.views[name]) name = 'kacheln';
    UI.ansicht = name;
    if (zustand) UI.zustand[name] = Object.assign(UI.zustand[name] || {}, zustand);
    Array.prototype.forEach.call(doc.querySelectorAll('.nav__item'), function (b) {
      b.classList.toggle('is-active', b.dataset.view === name);
    });
    Array.prototype.forEach.call(doc.querySelectorAll('.tabbar button'), function (b) {
      b.classList.toggle('is-active', b.dataset.view === name);
    });
    blattZu();
    zeichne();
    el('content').scrollTop = 0;
    global.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ Aufklappblatt

  /** Alle Bereiche als Kachelraster – die Navigation für schmale Geräte. */
  function mehrBlatt() {
    var world = UI.world;
    var eintraege = [{ view: 'kacheln', label: 'Start', icon: '\u25A6' }].concat(
      (FM.kacheln && FM.kacheln.BEREICHE || []).map(function (b) {
        return { view: b.id, label: b.name, icon: b.zeichen };
      }));
    var ungelesen = world ? world.ungeleseneNachrichten() : 0;

    var html = '<h3 style="margin-bottom:12px">Alle Bereiche</h3><div class="sheet__liste">' +
      eintraege.map(function (e) {
        return '<button type="button" class="sheet__eintrag' +
          (UI.ansicht === e.view ? ' is-active' : '') + '" data-blatt-view="' + esc(e.view) + '">' +
          '<i>' + esc(e.icon) + '</i>' + esc(e.label) +
          (e.view === 'medien' && ungelesen ? '<span class="badge">' + ungelesen + '</span>' : '') +
          '</button>';
      }).join('') + '</div>';

    html += '<div class="trenner"></div>' +
      '<div class="flex" style="gap:8px">' +
      '<button class="btn btn--primary" data-blatt-a="speichern" style="flex:1;justify-content:center">Speichern</button>' +
      '<button class="btn" data-blatt-a="export" style="flex:1;justify-content:center">Als Datei sichern</button>' +
      '</div>' +
      '<div class="flex mt" style="gap:8px">' +
      '<button class="btn" data-blatt-a="thema" style="flex:1;justify-content:center">Erscheinungsbild wechseln</button>' +
      '</div>' +
      '<p class="klein muted" style="margin:10px 0 0" id="blatt-stand">' + speicherStandText() + '</p>';

    el('sheet-body').innerHTML = html;
    el('sheet').hidden = false;

    Array.prototype.forEach.call(el('sheet-body').querySelectorAll('[data-blatt-view]'), function (b) {
      b.onclick = function () { zeige(b.dataset.blattView); };
    });
    var sp = el('sheet-body').querySelector('[data-blatt-a="speichern"]');
    if (sp) sp.onclick = function () {
      sp.disabled = true; sp.textContent = 'Speichert …';
      FM.save.speichern(UI.world, function (fehler, kopf) {
        sp.disabled = false; sp.textContent = 'Speichern';
        if (fehler) toast(fehler.message, 'fehler');
        else {
          toast('Gespeichert (' + Math.round(kopf.groesse / 1024) + ' KB).', 'gut');
          var st = el('blatt-stand');
          if (st) st.textContent = speicherStandText();
        }
      });
    };
    var th = el('sheet-body').querySelector('[data-blatt-a="thema"]');
    if (th) th.onclick = function () {
      var knopf = el('btn-thema');
      if (knopf) knopf.click();
      blattZu();
    };
    var ex = el('sheet-body').querySelector('[data-blatt-a="export"]');
    if (ex) ex.onclick = function () {
      FM.save.exportieren(UI.world, function (fehler, status) {
        if (fehler) toast('Export nicht möglich: ' + fehler, 'fehler');
        else if (status === 'abgebrochen') toast('Export abgebrochen.');
        else toast('Spielstand als Datei gesichert.', 'gut');
      });
    };
  }

  function speicherStandText() {
    var info = FM.save.standInfo();
    if (!info || !info.gespeichert) return 'Noch nicht gespeichert.';
    var minuten = Math.round((Date.now() - info.gespeichert) / 60000);
    return 'Zuletzt gespeichert: ' + (minuten < 1 ? 'gerade eben'
      : minuten < 60 ? 'vor ' + minuten + (minuten === 1 ? ' Minute' : ' Minuten')
        : 'am ' + new Date(info.gespeichert).toLocaleString('de-DE'));
  }

  function blattZu() {
    var b = el('sheet');
    if (b && !b.hidden) { b.hidden = true; el('sheet-body').innerHTML = ''; }
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
    var name = UI.views[UI.ansicht] ? UI.ansicht : 'kacheln';
    var view = UI.views[name];
    var zustand = UI.zustand[name] = UI.zustand[name] || {};
    var content = el('content');
    content.innerHTML = zurueckLeiste(name) + spieltagsband(world) + view.html(world, zustand);
    if (view.nachher) view.nachher(content, world, zustand);
    var zur = content.querySelector('[data-a="zum-start"]');
    if (zur) zur.onclick = function () { zeige('kacheln'); };
    bandVerdrahten(content, world);
    ringeStarten(content);
  }

  /**
   * Der Weg zurueck. Das Kachelbrett ist die einzige Navigation; aus einem
   * Bereich muss man ohne Suchen wieder herausfinden.
   */
  function zurueckLeiste(name) {
    if (name === 'kacheln') return '';
    var b = (FM.kacheln && FM.kacheln.BEREICHE || []).filter(function (x) { return x.id === name; })[0];
    var html = '<div class="bereichskopf">' +
      '<button type="button" class="zurueck" data-a="zum-start">' +
      '<span class="zurueck__pfeil">\u2039</span>' +
      '<span class="zurueck__wort">Start</span>' +
      '</button>';
    if (b) {
      html += '<div class="bereichskopf__titel">' +
        '<span class="bereichskopf__zeichen kachel__zeichen kachel__zeichen--' + b.farbe + '">' + b.zeichen + '</span>' +
        '<div><b>' + esc(b.name) + '</b><small>' + esc(b.was) + '</small></div>' +
        '</div>';
    }
    return html + '</div>';
  }

  /**
   * Steht heute ein eigenes Spiel an, liegt ueber jeder Ansicht ein Band
   * mit dem Weg hinein. Ohne das waere der Spieltagsdialog der einzige
   * Zugang - wer ihn wegklickt oder erst in die Taktik geht, muesste ihn
   * ueber "Weiter" wiederfinden, ohne dass irgendwo steht, warum.
   */
  function anstehendesSpiel(world) {
    if (!world || !world.nutzerClubId) return null;
    var heute = world.spieleAmTag(world.tag) || [];
    for (var i = 0; i < heute.length; i++) {
      var s = heute[i];
      if (s.gespielt) continue;
      if (s.heimId === world.nutzerClubId || s.gastId === world.nutzerClubId) return s;
    }
    return null;
  }

  /**
   * Wie viel Staerke liegt zwischen der aufgestellten und der besten
   * verfuegbaren Elf? Ohne diese Zahl merkt niemand, dass er seit vier
   * Spieltagen mit derselben muedenen Elf antritt.
   */
  function elfAbstand(world, club, taktik, spiel) {
    try {
      var beste = FM.views.bestmoeglicheElf(world, club, taktik, spiel);
      var f = FM.tactics.formation(taktik);
      var werte = [];
      taktik.aufstellung.forEach(function (id, i) {
        var sp = id ? world.spieler[id] : null;
        if (sp) werte.push(FM.players.tagesform(sp, f.slots[i].pos));
      });
      return beste.tagesform - (werte.length ? U.avg(werte) : 0);
    } catch (e) { return 0; }
  }

  function spieltagsband(world) {
    var spiel = anstehendesSpiel(world);
    if (!spiel) return '';
    var heim = world.vereine[spiel.heimId];
    var gast = world.vereine[spiel.gastId];
    var riv = FM.data.rivalitaet(spiel.heimId, spiel.gastId);
    var nutzerClub = world.nutzerVerein();
    var bandAbstand = world.einstellungen && world.einstellungen.autoAufstellung
      ? 0 : elfAbstand(world, nutzerClub, world.taktikVon(nutzerClub.id), spiel);
    return '<div class="spieltagsband">' +
      '<div class="spieltagsband__info">' +
      '<span class="spieltagsband__marke">Heute</span>' +
      '<b>' + esc(heim.kurz) + ' – ' + esc(gast.kurz) + '</b>' +
      '<span class="klein muted">' + esc(wettbewerbName(world, spiel)) +
      (spiel.rundeName && spiel.rundeName !== wettbewerbName(world, spiel)
        ? ' · ' + esc(spiel.rundeName) : '') + ' · ' + esc(spiel.zeit) + ' Uhr</span>' +
      (riv ? '<span class="derby-tag">' + esc(riv.name) + '</span>' : '') +
      '</div>' +
      '<div class="flex">' +
      (bandAbstand >= 1.2
        ? '<button class="btn btn--ghost" data-band="beste" title="Frische, Form oder Sperren haben sich geändert">' +
          'Beste Elf <span class="w-mittel">+' + U.num(bandAbstand, 1) + '</span></button>'
        : '') +
      '<button class="btn btn--primary" data-band="anpfiff">Spiel leiten</button>' +
      '<button class="btn btn--ghost" data-band="sim">Ergebnis simulieren</button>' +
      '</div></div>';
  }

  function bandVerdrahten(container, world) {
    var an = container.querySelector('[data-band="anpfiff"]');
    var sim = container.querySelector('[data-band="sim"]');
    var beste = container.querySelector('[data-band="beste"]');
    if (!an && !sim) return;
    var spiel = anstehendesSpiel(world);
    if (!spiel) return;
    if (beste) beste.onclick = function () {
      var club = world.nutzerVerein();
      FM.tactics.autoAufstellung(world, club, world.taktikVon(club.id), { wettbewerb: spiel.wettbewerb });
      zeichne();
      toast('Beste verfügbare Elf aufgestellt.', 'gut');
    };
    if (an) an.onclick = function () { vorSpielAblauf(spiel); };
    if (sim) sim.onclick = function () {
      var state = FM.match.simuliere(world, spiel);
      FM.engine.verarbeiteSpiel(world, spiel, state);
      zeichne();
      toast(spiel.rundeName ? spiel.rundeName + ' simuliert.' : 'Spiel simuliert.');
      FM.views.spielbericht(spiel.id);
    };
  }

  function kopfzeile() {
    var world = UI.world;
    var club = world.nutzerVerein();
    if (!club) return;
    vereinsfarbeAnwenden(club);
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
    // Kontostand und Vorstandsvertrauen stehen auf ihren eigenen Kacheln;
    // in der Kopfzeile waeren sie nur eine zweite Stelle fuer dieselbe Zahl.

    // Die ungelesene Post steht auf der Post-Kachel; am Telefon zeigt die
    // untere Leiste zusaetzlich einen Punkt.
    var ungelesen = world.ungeleseneNachrichten();
    var punkt = el('tab-punkt');
    if (punkt) punkt.hidden = ungelesen === 0;
  }

  // ------------------------------------------------------------ Vereinsfarbe

  /**
   * Die Farbe des eigenen Vereins wird zur Farbe der Oberflaeche: aktiver
   * Menuepunkt, Hauptknopf, die eigene Tabellenzeile, der Jubel nach einem
   * Tor. Damit das auf hellem wie dunklem Grund lesbar bleibt, wird nur der
   * Farbton uebernommen - Saettigung und Helligkeit zwingt die Rechnung in
   * ein Band, in dem Text darauf noch zu lesen ist. Gelb bleibt also Gelb,
   * wird aber zu einem tiefen Goldton statt zu Neon auf Weiss.
   *
   * Ein Verein in Schwarz oder Weiss hat keinen Farbton; dort greift die
   * Zweitfarbe, und wenn auch die grau ist, bleibt es beim Gruen des Platzes.
   */
  var AKZENT_TOKEN = ['--accent', '--accent-tief', '--accent-hell', '--accent-weich',
    '--auf-accent', '--sh-akzent'];

  function hexZuHsl(hex) {
    if (!hex) return null;
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var z = parseInt(m[1], 16);
    var r = ((z >> 16) & 255) / 255, g = ((z >> 8) & 255) / 255, b = (z & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, sat = 0;
    if (max !== min) {
      var d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: sat, l: l };
  }

  function hsl(h, s, l, a) {
    var w = Math.round(h) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
    return a === undefined ? 'hsl(' + w + ')' : 'hsl(' + w + ' / ' + a + ')';
  }

  /** Relative Leuchtdichte einer HSL-Farbe nach WCAG. */
  function leuchtdichte(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    function k(v) { v += m; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b);
  }

  function kontrast(a, b) {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  /**
   * Sucht die Helligkeit, bei der die Farbe gegen den Grund noch zu lesen
   * ist. Eine feste Helligkeit reicht nicht: Gelb ist bei gleichem Wert
   * sehr viel heller als Rot, und Dortmunds Gelb verfehlte damit die
   * Lesbarkeitsschwelle, waehrend Bayerns Rot sie weit uebertraf.
   */
  function helligkeitFuerKontrast(h, s, grundDichte, ziel, start, schritt) {
    var l = start;
    for (var i = 0; i < 60; i++) {
      if (kontrast(leuchtdichte(h, s, l), grundDichte) >= ziel) return l;
      l += schritt;
      if (l < 0.05 || l > 0.95) break;
    }
    return U.clamp(l, 0.05, 0.95);
  }

  function dunklesThema() {
    var t = doc.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function vereinsfarbeAnwenden(club) {
    var wurzel = doc.documentElement;
    function zuruecksetzen() {
      AKZENT_TOKEN.forEach(function (n) { wurzel.style.removeProperty(n); });
    }
    if (!club) { zuruecksetzen(); return; }
    var f = hexZuHsl(club.farbe);
    if (!f || f.s < 0.16) f = hexZuHsl(club.farbe2);
    if (!f || f.s < 0.16) { zuruecksetzen(); return; }

    var h = f.h;
    var s = U.clamp(f.s, 0.45, 0.90);

    if (dunklesThema()) {
      // Gegen den dunklen Grund muss die Farbe hell genug sein. Sie traegt
      // dort Text und dient zugleich als Flaeche - auf ihr steht dann ein
      // sehr dunkler Ton aus demselben Farbton.
      var lD = helligkeitFuerKontrast(h, s, leuchtdichte(0, 0, 0.09), 4.6, 0.46, 0.015);
      wurzel.style.setProperty('--accent', hsl(h, s, lD));
      // "tief" meint die betonte Variante, nicht die dunklere: hier steht
      // sie als Text auf getoenter Flaeche und muss heller sein.
      wurzel.style.setProperty('--accent-tief', hsl(h, s, Math.min(0.84, lD + 0.14)));
      wurzel.style.setProperty('--accent-hell', hsl(h, s, Math.min(0.82, lD + 0.15)));
      wurzel.style.setProperty('--accent-weich', hsl(h, s, lD, 0.15));
      wurzel.style.setProperty('--auf-accent', hsl(h, s * 0.5, 0.07));
      wurzel.style.setProperty('--sh-akzent', '0 6px 20px -8px ' + hsl(h, s, lD, 0.45));
    } else {
      // Dieselbe Farbe traegt hier Text auf Weiss und Weiss auf sich selbst.
      // Beides ist dieselbe Bedingung: Kontrast gegen Weiss.
      var lH = helligkeitFuerKontrast(h, s, 1, 4.6, 0.44, -0.015);
      wurzel.style.setProperty('--accent', hsl(h, s, lH));
      wurzel.style.setProperty('--accent-tief', hsl(h, s, Math.max(0.08, lH - 0.07)));
      wurzel.style.setProperty('--accent-hell', hsl(h, s, Math.min(0.60, lH + 0.10)));
      wurzel.style.setProperty('--accent-weich', hsl(h, s, Math.min(0.55, lH + 0.10), 0.12));
      wurzel.style.setProperty('--auf-accent', '#FFFFFF');
      wurzel.style.setProperty('--sh-akzent', '0 6px 18px -8px ' + hsl(h, s, lH, 0.5));
    }
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
      html += '<th class="' + (s.klasse || '') + (s.haft ? ' haft' : '') + (s.wert ? ' sortable' : '') +
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
        html += '<td class="' + (s.klasse || '') + (s.haft ? ' haft' : '') + '">' + s.html(z) + '</td>';
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
   * Sichert den Stand im Hintergrund, ohne den Nutzer zu unterbrechen.
   * Auf dem Handy räumt der Browser Tabs gern von selbst ab – ein
   * verlorener Spielstand wäre das Ärgerlichste, was passieren kann.
   */
  var ABSTAND_SICHERUNG = 14;      // Spieltage zwischen zwei Sicherungen

  function stilleSicherung(erzwingen) {
    var world = UI.world;
    if (!world || !world.nutzerClubId) return;
    if (world.einstellungen.autoSpeichern === false) return;
    if (!erzwingen && world.letzteSicherung !== undefined &&
      world.tag - world.letzteSicherung < ABSTAND_SICHERUNG) return;
    world.letzteSicherung = world.tag;
    FM.save.speichern(world, function (fehler) {
      if (fehler) console.warn('Automatisches Speichern fehlgeschlagen:', fehler.message);
    });
  }

  /**
   * Rueckt einen Tag vor. Erkennt eigene Spiele, Nachrichten und das
   * Saisonende und reagiert entsprechend.
   */
  /**
   * Vorspulen: springt bis zum naechsten eigenen Spiel oder einer
   * wichtigen Nachricht. Ohne das kostet eine Saison dreihundertvierzig
   * Klicks - einen je Kalendertag.
   */
  function vorspulen() {
    var world = UI.world;
    if (UI.beschaeftigt) return;
    // Steht heute schon ein Spiel an, hilft Vorspulen nicht weiter.
    if (anstehendesSpiel(world)) { vorSpielAblauf(anstehendesSpiel(world)); return; }
    UI.beschaeftigt = true;
    try {
      var r = FM.engine.weiterBisEreignis(world, 45);
      UI.beschaeftigt = false;
      zeichne();
      stilleSicherung(false);
      if (r.status === 'spiel') { vorSpielAblauf(r.spiel); return; }
      if (r.status === 'saisonende') { saisonende(); return; }
      if (r.status === 'entlassen') { entlassung(); return; }
      if (r.status === 'nachricht' && r.nachrichten.length) {
        zeigeNachricht(r.nachrichten[0]);
        return;
      }
      toast(r.tage + ' Tage übersprungen – nichts Dringendes.');
    } catch (e) {
      UI.beschaeftigt = false;
      console.error(e);
      toast('Fehler beim Vorspulen: ' + e.message, 'fehler');
    }
  }

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
      stilleSicherung(false);
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
      html += '<div class="card card--flat mb" style="border-color:var(--schlecht)"><h4 style="color:var(--schlecht)">Hinweise zur Aufstellung</h4><ul class="klein">' +
        probleme.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }

    // Wer die Aufstellung stehen laesst, spielt schnell mit muedem Personal.
    // Wenn die beste verfuegbare Elf deutlich staerker waere, steht das hier -
    // sonst faellt der Nachteil erst in der Tabelle auf.
    var abstand = elfAbstand(world, club, taktik, spiel);
    if (abstand >= 1.2) {
      html += '<div class="card card--flat mb" style="border-color:var(--gold)">' +
        '<b class="w-mittel">Die beste verfügbare Elf wäre ' + U.num(abstand, 1) + ' Punkte stärker.</b> ' +
        '<span class="klein muted">Frische, Form oder Sperren haben sich seit Ihrer letzten Aufstellung verändert.</span>' +
        '<div class="flex mt"><button class="btn btn--sm" data-a="beste">Beste Elf aufstellen</button></div></div>';
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
        var bestKnopf = body.querySelector('[data-a="beste"]');
        if (bestKnopf) bestKnopf.onclick = function () {
          FM.tactics.autoAufstellung(world, club, taktik, { wettbewerb: spiel.wettbewerb });
          modalZu();
          toast('Beste verfügbare Elf aufgestellt.', 'gut');
          vorSpielAblauf(spiel);
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
        }).join('') + '</div>' +
        '<div class="flex mt"><button class="btn btn--ghost btn--sm" data-co="1" ' +
        'title="Der Co-Trainer antwortet neutral - ohne Ausschlag nach oben oder unten">' +
        'Co-Trainer übernehmen lassen</button></div>';
      modal(html, {
        nachher: function (body) {
          var co = body.querySelector('[data-co]');
          if (co) co.onclick = function () {
            // Der Co-Trainer sagt nichts Falsches, aber auch nichts Mitreissendes.
            while (index < pk.fragen.length) {
              var f = pk.fragen[index];
              var neutral = 0;
              f.optionen.forEach(function (o, i) {
                var wucht = Math.abs(o.moral || 0) + Math.abs(o.fans || 0) + Math.abs(o.vorstand || 0);
                var besteWucht = Math.abs(f.optionen[neutral].moral || 0) +
                  Math.abs(f.optionen[neutral].fans || 0) + Math.abs(f.optionen[neutral].vorstand || 0);
                if (wucht < besteWucht) neutral = i;
              });
              FM.media.antworten(world, pk, index, neutral);
              index++;
            }
            pk.beantwortet = true;
            modalZu();
            toast('Der Co-Trainer hat die Pressekonferenz übernommen.');
            if (fertig) fertig();
          };
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

  var JUBEL_TITEL = /Aufstieg geschafft|Meister|Pokalsieger|Saisonziel erreicht|^Meilenstein/i;

  function zeigeNachricht(n) {
    n.gelesen = true;
    var world = UI.world;
    if (JUBEL_TITEL.test(n.titel)) konfetti(120);
    var html = '<h4>' + esc(nachrichtTyp(n.typ)) + ' · ' + U.fmtDate(n.tag, 'lang') + '</h4>' +
      '<h2>' + esc(n.titel) + '</h2><p>' + esc(n.text).replace(/\n/g, '<br>') + '</p>';

    // Ein Meilenstein soll nicht nur abgehakt werden, sondern den Blick auf
    // den naechsten lenken - sonst ist der Moment vorbei, sobald er da ist.
    if (/^Meilenstein/.test(n.titel) && FM.meilensteine) {
      var bil = FM.meilensteine.bilanz(world);
      var weiter = FM.meilensteine.naechste(world, 3);
      html += '<div class="card card--flat mt"><div class="flex flex--zwischen">' +
        '<b>Ihre Laufbahn</b><span class="chip chip--gruen">' + bil.erreicht + ' von ' + bil.gesamt + '</span></div>' +
        '<div class="progress mt"><i style="width:' + Math.round(bil.erreicht / bil.gesamt * 100) + '%"></i></div>';
      if (weiter.length) {
        html += '<div class="klein muted" style="margin-top:10px">Als Nächstes in Reichweite</div>';
        html += weiter.map(function (e) {
          return '<div class="stat-row"><span>' + esc(e.name) + '</span><b>' +
            Math.round(e.anteil * 100) + ' %</b></div>';
        }).join('');
      }
      html += '<div class="flex mt"><button class="btn btn--sm" data-a="laufbahn">Alle Meilensteine</button></div></div>';
    }

    if (n.aktion === 'angebot' && n.angebotId) {
      var angebot = world.transfer.angeboteEin.filter(function (a) { return a.id === n.angebotId; })[0];
      if (angebot && angebot.status === 'offen') {
        html += '<div class="flex mt">' +
          '<button class="btn btn--primary" data-a="ja">Angebot annehmen</button>' +
          '<button class="btn" data-a="nein">Ablehnen</button>' +
          '<button class="btn btn--ghost" data-a="spieler">Spieler ansehen</button></div>';
      }
    } else if (n.aktion === 'einigung' && n.einigungId) {
      var off = FM.transfers.einigungVon(world, n.einigungId);
      if (off) {
        html += '<div class="flex mt">' +
          '<button class="btn btn--primary" data-a="weiter">Vertragsgespräch fortsetzen</button>' +
          '<button class="btn" data-a="spieler">Spielerprofil</button></div>';
      } else {
        html += '<div class="klein muted mt">Diese Einigung besteht nicht mehr.</div>';
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
        var lb = body.querySelector('[data-a="laufbahn"]');
        if (lb) lb.onclick = function () { modalZu(); zeige('karriere'); };
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
        var weiter = body.querySelector('[data-a="weiter"]');
        if (weiter) weiter.onclick = function () { modalZu(); FM.views.einigungFortsetzen(n.einigungId); };
      }
    });
  }

  /**
   * Zweiter Bildschirm des Saisonwechsels: Ehrungen, Auf- und Absteiger.
   * Er laeuft nach saisonAbschluss, weil die Ehrungen erst dort entstehen.
   */
  function ehrentafel(world, saison) {
    var eigene = FM.awards.auszeichnungenVon(world, { saison: saison, clubId: world.nutzerClubId });
    var alle = FM.awards.auszeichnungenVon(world, { saison: saison });
    var letzte = world.historie.saisons[world.historie.saisons.length - 1];

    function zeile(a) {
      var sp = a.spielerId ? world.spieler[a.spielerId] : null;
      var v = a.clubId ? world.vereine[a.clubId] : null;
      return '<div class="stat-row"><span>' + esc(a.titel) + '</span><b>' +
        esc(sp ? sp.vorname + ' ' + sp.nachname : a.text || '–') +
        (v ? ' <span class="muted klein">' + esc(v.kurz) + '</span>' : '') +
        (a.zusatz ? ' <span class="muted klein">' + esc(a.zusatz) + '</span>' : '') + '</b></div>';
    }

    var html = '<h4>Saison ' + saison + '/' + String(saison + 1).slice(2) + '</h4>' +
      '<h2>Die Ehrungen der Saison</h2>';

    if (eigene.length) {
      html += '<div class="card card--flat mb"><h4>Aus Ihrem Verein</h4>' +
        eigene.map(zeile).join('') + '</div>';
    }

    var saisontitel = alle.filter(function (a) {
      return ['spielerDerSaison', 'torwartDerSaison', 'nachwuchsDerSaison', 'torjaeger'].indexOf(a.typ) >= 0;
    });
    if (saisontitel.length) {
      html += '<div class="card card--flat mb"><h4>Die Besten der Ligen</h4>' +
        saisontitel.map(zeile).join('') + '</div>';
    }

    var elf = alle.filter(function (a) { return a.typ === 'elfDerSaison'; });
    elf.forEach(function (a) {
      html += '<div class="card card--flat mb"><h4>' + esc(a.titel) + '</h4>' +
        '<div class="klein">' + esc(a.text) + '</div></div>';
    });

    if (letzte && (letzte.aufsteiger.length || letzte.absteiger.length)) {
      function namen(ids) {
        return ids.map(function (id) {
          var v = world.vereine[id];
          return v ? esc(v.name) : '?';
        }).join(', ') || '–';
      }
      html += '<div class="card card--flat mb"><h4>Auf und ab</h4>' +
        '<div class="stat-row"><span>Aufsteiger in die Bundesliga</span><b class="w-gut">' +
        namen(letzte.aufsteiger) + '</b></div>' +
        '<div class="stat-row"><span>Absteiger aus der Bundesliga</span><b class="w-schlecht">' +
        namen(letzte.absteiger) + '</b></div></div>';
    }

    html += '<div class="flex mt"><button class="btn btn--primary btn--big" data-a="los">' +
      'Saison ' + world.saison + '/' + String(world.saison + 1).slice(2) + ' beginnen</button></div>';

    modal(html, {
      beimSchliessen: function () { zeige('kacheln'); },
      nachher: function (body) {
        if (eigene.length) konfetti(100);
        body.querySelector('[data-a="los"]').onclick = function () {
          modalZu();
          toast('Willkommen in der Saison ' + world.saison + '/' + String(world.saison + 1).slice(2), 'gut');
        };
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

    html += saisonRueckblick(world);

    // Was der Vorstand daraus macht - das ist die eigentliche Nachricht
    // des Saisonendes, und sie gehoert nicht nur ins Postfach.
    var m = world.manager;
    // Dieselbe Messlatte wie im Urteil des Vorstands: die Vorgabe, gemildert
    // um das, was dieser Kader in dieser Liga ueberhaupt hergibt.
    var rang = world.nutzerClubId ? FM.players.ligaRang(world, world.nutzerClubId) : null;
    var messlatte = ziel
      ? (rang ? U.clamp(Math.round(ziel.platz * 0.6 + rang.rang * 0.4), 1, rang.von) : ziel.platz)
      : 0;
    var abweichung = ziel && eigen ? messlatte - eigen.platz : 0;
    var achtbar = !erreicht && abweichung >= 2;
    var urteilswert = U.clamp(abweichung * 5, -22, 22);
    if (erreicht) urteilswert = Math.max(urteilswert, 8);
    var kuenftig = U.clamp(m.vorstandsvertrauen + urteilswert, 0, 100);
    var urteil = erreicht
      ? (eigen && eigen.platz <= 3
        ? 'Der Vorstand ist begeistert. So eine Saison spricht sich herum.'
        : 'Der Vorstand ist zufrieden. Sie haben geliefert, was verabredet war.')
      : achtbar
        ? 'Die Vorgabe steht auf dem Papier, die Mannschaft auf dem Platz. Aus diesem Kader ' +
          (rang ? '- dem ' + rang.rang + '.-besten der Liga - ' : '') +
          'war kaum mehr herauszuholen. Der Vorstand hält an Ihnen fest.'
        : (kuenftig < 25
          ? 'Der Vorstand ist alarmiert. Ein weiterer Fehlschlag kostet Sie das Amt.'
          : 'Der Vorstand erwartet eine deutliche Steigerung.');
    html += '<div class="card card--flat mt"><h4>Das Urteil des Vorstands</h4>' +
      '<p class="klein">' + esc(urteil) + '</p>' +
      '<div class="stat-row"><span>Vertrauen des Vorstands</span><b class="' +
      (kuenftig >= 55 ? 'w-gut' : kuenftig >= 30 ? 'w-mittel' : 'w-schlecht') + '">' +
      Math.round(m.vorstandsvertrauen) + ' % → ' + Math.round(kuenftig) + ' %</b></div>' +
      // Ein erfuelltes Jahr wandert ins Guthaben - das ist der Grund, warum
      // sich Konstanz lohnt, auch wenn das Vertrauen schon bei 100 steht.
      (erreicht || achtbar
        ? '<div class="stat-row"><span>Rückhalt beim Vorstand</span><b class="w-gut">+' +
          (erreicht && abweichung >= 3 ? 2 : 1) + ' → ' +
          Math.min(3, (m.rueckhalt || 0) + (erreicht && abweichung >= 3 ? 2 : 1)) +
          ' von 3</b></div>'
        : abweichung <= -4
          ? '<div class="stat-row"><span>Rückhalt beim Vorstand</span><b class="w-schlecht">−1 → ' +
            Math.max(0, (m.rueckhalt || 0) - 1) + ' von 3</b></div>'
          : '') +
      '</div>';

    html += '<div class="flex mt"><button class="btn btn--primary btn--big" data-a="weiter">Neue Saison beginnen</button></div>';

    modal(html, {
      nachher: function (body) {
        if (erreicht) konfetti(140);
        body.querySelector('[data-a="weiter"]').onclick = function () {
          modalZu();
          var abgelaufen = world.saison;
          FM.engine.saisonAbschluss(world);
          ehrentafel(world, abgelaufen);
        };
      }
    });
  }

  /**
   * Der Blick zurueck auf die eigene Saison: beste Spieler, Ehrungen und
   * die Rekorde, die in diesen zehn Monaten entstanden sind.
   */
  function saisonRueckblick(world) {
    var P = FM.players;
    var clubId = world.nutzerClubId;
    if (!clubId) return '';
    var kader = world.kaderVon(clubId).filter(function (p) { return p.stats.spiele >= 5; });
    var html = '<div class="trenner"></div><h3>Ihre Saison</h3>';

    if (kader.length) {
      var bester = U.sortBy(kader.filter(function (p) { return p.stats.notenAnzahl >= 8; }),
        function (p) { return P.schnitt(p.stats); })[0];
      var knipser = U.sortBy(kader, function (p) { return -p.stats.tore; })[0];
      var vorbereiter = U.sortBy(kader, function (p) { return -p.stats.vorlagen; })[0];
      html += '<div class="tiles mb">';
      if (bester) {
        html += '<div class="tile"><span>Bester Spieler</span><b style="font-size:14px">' +
          esc(bester.nachname) + '</b><small>Note ' + U.note(P.schnitt(bester.stats)) + '</small></div>';
      }
      if (knipser && knipser.stats.tore) {
        html += '<div class="tile"><span>Meiste Tore</span><b style="font-size:14px">' +
          esc(knipser.nachname) + '</b><small>' + U.pl(knipser.stats.tore, 'Tor', 'Tore') + '</small></div>';
      }
      if (vorbereiter && vorbereiter.stats.vorlagen) {
        html += '<div class="tile"><span>Meiste Vorlagen</span><b style="font-size:14px">' +
          esc(vorbereiter.nachname) + '</b><small>' + U.pl(vorbereiter.stats.vorlagen, 'Vorlage', 'Vorlagen') + '</small></div>';
      }
      html += '</div>';
    }

    var ehrungen = FM.awards.auszeichnungenVon(world, { saison: world.saison })
      .filter(function (a) {
        if (a.clubId === clubId) return true;
        var sp = a.spielerId ? world.spieler[a.spielerId] : null;
        return sp && sp.clubId === clubId;
      });
    if (ehrungen.length) {
      html += '<p class="klein muted" style="margin-bottom:4px">Ehrungen in dieser Saison</p><ul class="liste">' +
        ehrungen.slice(0, 6).map(function (a) {
          return '<li>' + esc(a.titel) + (a.text ? ' <span class="klein muted">' + esc(a.text) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
    }

    var r = world.rekorde;
    if (r && (r.hoechsterSieg || r.besteSerieSiege)) {
      html += '<div class="stat-row"><span>Höchster Sieg</span><b>' +
        (r.hoechsterSieg ? r.hoechsterSieg.tore + ':' + r.hoechsterSieg.gegentore +
          ' gegen ' + esc((world.vereine[r.hoechsterSieg.gegnerId] || {}).kurz || '?') : '–') + '</b></div>' +
        '<div class="stat-row"><span>Längste Siegesserie</span><b>' + U.pl(r.besteSerieSiege || 0, 'Spiel', 'Spiele') + '</b></div>';
    }
    return html;
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

  UI.vorspulen = vorspulen;
  UI.anstehendesSpiel = anstehendesSpiel;
  UI.esc = esc;
  UI.el = el;
  UI.schmal = schmal;
  UI.wappen = wappen;
  UI.vereinName = vereinName;
  UI.vereinZelle = vereinZelle;
  UI.posTag = posTag;
  UI.wert = wert;
  UI.wertKlasse = wertKlasse;
  UI.balken = balken;
  UI.ring = ring;
  UI.ringeStarten = ringeStarten;
  UI.konfetti = konfetti;
  UI.zahlHoch = zahlHoch;
  UI.serie = serie;
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
  UI.vereinsfarbeAnwenden = vereinsfarbeAnwenden;
  UI.mehrBlatt = mehrBlatt;
  UI.blattZu = blattZu;
  UI.speicherStandText = speicherStandText;
  UI.zeichne = zeichne;
  UI.kopfzeile = kopfzeile;
  UI.tabelle = tabelle;
  UI.tabelleSortierung = tabelleSortierung;
  UI.filterBinden = filterBinden;
  UI.weiter = weiter;
  UI.stilleSicherung = stilleSicherung;
  UI.vorSpielAblauf = vorSpielAblauf;
  UI.pressekonferenz = pressekonferenz;
  UI.zeigeNachricht = zeigeNachricht;
  UI.nachrichtTyp = nachrichtTyp;
  UI.nachrichtIcon = nachrichtIcon;
  UI.wettbewerbName = wettbewerbName;
  UI.saisonende = saisonende;

})(typeof window !== 'undefined' ? window : globalThis);
