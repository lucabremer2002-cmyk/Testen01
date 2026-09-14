/*
 * main.js - Einstieg: Startbildschirm, Vereinsauswahl, Tastenkürzel.
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util, D = FM.data, P = FM.players, UI = FM.ui;
  var doc = global.document;
  var esc = UI.esc;

  var gewaehlterVerein = null;
  var aktiveLiga = 1;

  function el(id) { return doc.getElementById(id); }

  // ------------------------------------------------------------ Erscheinungsbild

  /*
   * Hell oder dunkel. Ohne Wahl folgt das Spiel dem Betriebssystem - das
   * ist der Normalfall und braucht keine Einstellung. Wer umschaltet, legt
   * sich fest, und die Festlegung ueberlebt den Neustart.
   */
  var THEMA_KEY = 'bl-manager-thema';

  function themaLesen() {
    try { return global.localStorage.getItem(THEMA_KEY) || ''; } catch (e) { return ''; }
  }

  /*
   * Wichtig: Ohne eigene Wahl wird das Attribut nicht angefasst. Laeuft das
   * Spiel eingebettet, hat die Umgebung dort moeglicherweise schon das
   * Erscheinungsbild des Betrachters gesetzt - das duerfen wir nicht
   * ueberschreiben.
   */
  function themaAnwenden(wert) {
    var wurzel = doc.documentElement;
    if (wert === 'hell' || wert === 'dunkel') {
      wurzel.setAttribute('data-theme', wert === 'hell' ? 'light' : 'dark');
    }
    // Die Vereinsfarbe haengt am Thema - nach dem Wechsel neu rechnen.
    if (UI.vereinsfarbeAnwenden && UI.world) {
      UI.vereinsfarbeAnwenden(UI.world.nutzerVerein ? UI.world.nutzerVerein() : null);
    }
    var knopf = el('btn-thema');
    if (knopf) {
      var dunkel = istDunkel();
      knopf.textContent = dunkel ? '\u25D1' : '\u25D0';
      knopf.title = dunkel ? 'Auf helles Erscheinungsbild wechseln' : 'Auf dunkles Erscheinungsbild wechseln';
    }
  }

  /** Was gerade tatsaechlich zu sehen ist - Attribut schlaegt System. */
  function istDunkel() {
    var gesetzt = doc.documentElement.getAttribute('data-theme');
    if (gesetzt === 'dark') return true;
    if (gesetzt === 'light') return false;
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function themaUmschalten() {
    var neu = istDunkel() ? 'hell' : 'dunkel';
    try { global.localStorage.setItem(THEMA_KEY, neu); } catch (e) { /* privates Fenster */ }
    themaAnwenden(neu);
  }

  themaAnwenden(themaLesen());

  // ------------------------------------------------------------ Startbildschirm

  function zeichneVereine() {
    var grid = el('club-grid');
    var liste = D.VEREINE.filter(function (c) { return c.liga === aktiveLiga; });
    liste = U.sortBy(liste, function (c) { return -c.ruf; });
    grid.innerHTML = liste.map(function (c) {
      return '<button type="button" class="club-card' + (gewaehlterVerein === c.id ? ' is-active' : '') +
        '" data-c="' + esc(c.id) + '">' +
        '<span class="crest crest--sm" data-k="' + esc(c.kurz) + '" style="background:' + esc(c.farbe) +
        ';border-color:' + esc(c.farbe2) + '"></span>' +
        '<span><b>' + esc(c.name) + '</b><small>' + esc(c.stadt) +
        ' · <i class="club-card__grad" style="color:' + schwierigkeit(c).color + '">' +
        schwierigkeit(c).text + '</i></small></span></button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('[data-c]'), function (b) {
      b.onclick = function () {
        gewaehlterVerein = b.dataset.c;
        zeichneVereine();
        zeigeVereinsinfo();
        el('btn-start').disabled = false;
      };
    });
  }

  function schwierigkeit(club) {
    if (club.liga === 1) {
      if (club.ruf >= 88) return { text: 'Sehr leicht', farbe: '#14532d', color: '#6ee7b7' };
      if (club.ruf >= 78) return { text: 'Leicht', farbe: '#166534', color: '#bbf7d0' };
      if (club.ruf >= 68) return { text: 'Mittel', farbe: '#78350f', color: '#fed7aa' };
      if (club.ruf >= 60) return { text: 'Fordernd', farbe: '#7c2d12', color: '#fed7aa' };
      return { text: 'Schwer', farbe: '#7f1d1d', color: '#fecaca' };
    }
    if (club.ruf >= 58) return { text: 'Mittel', farbe: '#78350f', color: '#fed7aa' };
    if (club.ruf >= 48) return { text: 'Fordernd', farbe: '#7c2d12', color: '#fed7aa' };
    return { text: 'Sehr schwer', farbe: '#7f1d1d', color: '#fecaca' };
  }

  function zeigeVereinsinfo() {
    var c = D.VEREINE.filter(function (x) { return x.id === gewaehlterVerein; })[0];
    var box = el('club-info');
    if (!c) { box.innerHTML = ''; return; }
    var s = schwierigkeit(c);
    var ziel = FM.world.saisonziel(c, c.liga);
    box.innerHTML = '<div class="flex flex--zwischen"><div>' +
      '<b style="color:var(--ink);font-size:15px">' + esc(c.name) + '</b> ' +
      '<span class="schwierigkeit" style="background:' + s.farbe + ';color:' + s.color + '">' + s.text + '</span><br>' +
      esc(c.stadion) + ' · ' + U.num(c.kapazitaet) + ' Plätze · ' +
      (c.liga === 1 ? '1. Bundesliga' : '2. Bundesliga') + '</div>' +
      '<div class="rechts klein">Saisonziel des Vorstands:<br><b style="color:var(--accent)">' + esc(ziel.text) + '</b></div>' +
      '</div>' +
      '<div class="flex mt" style="gap:14px">' +
      infoPunkt('Ruf', c.ruf) + infoPunkt('Finanzkraft', c.finanz) + infoPunkt('Anhang', c.fans) +
      infoPunkt('Akademie', c.akademie) + infoPunkt('Trainingszentrum', c.trainingszentrum) +
      '</div>';
  }

  function infoPunkt(label, wert) {
    return '<span class="klein"><span class="muted">' + esc(label) + '</span> ' +
      '<b class="' + UI.wertKlasse(wert) + '">' + wert + '</b></span>';
  }

  // ------------------------------------------------------------ Spielstart

  function starteNeu() {
    var name = (el('in-name').value || 'Trainer').trim().slice(0, 28);
    var alter = U.clamp(parseInt(el('in-alter').value, 10) || 42, 25, 70);
    var seedFeld = el('in-seed').value;
    var seed = seedFeld ? parseInt(seedFeld, 10) : Math.floor(Math.random() * 2e9);

    el('start-hinweis').textContent = 'Die Spielwelt wird aufgebaut – einen Moment bitte …';
    el('btn-start').disabled = true;

    global.setTimeout(function () {
      try {
        var world = FM.world.neueWelt({
          seed: seed, saison: 2025, clubId: gewaehlterVerein,
          managerName: name, managerAlter: alter
        });
        starteSpiel(world);
      } catch (e) {
        console.error(e);
        el('start-hinweis').textContent = 'Fehler beim Aufbau: ' + e.message;
        el('btn-start').disabled = false;
      }
    }, 30);
  }

  function starteSpiel(world) {
    UI.world = world;
    el('start').hidden = true;
    el('app').hidden = false;
    UI.zeige('uebersicht');
    if (!world.inbox.length) {
      var club = world.nutzerVerein();
      world.nachricht({
        typ: 'vorstand', prioritaet: 3,
        titel: 'Willkommen bei ' + club.name,
        text: 'Der Vorstand begrüßt Sie als neuen Cheftrainer. Die Vorgabe für die Saison lautet: ' +
          world.manager.saisonziel.text + '. Nutzen Sie die Vorbereitung, um Kader, Taktik und ' +
          'Trainingsplan einzurichten. Mit "Weiter" rücken Sie im Kalender vor.'
      });
      UI.kopfzeile();
    }
  }

  // ------------------------------------------------------------ Laden

  function ladeStand() {
    el('start-hinweis').textContent = 'Spielstand wird geladen …';
    el('btn-laden').disabled = true;
    FM.save.laden(function (fehler, world) {
      el('btn-laden').disabled = false;
      if (fehler) {
        console.error(fehler);
        el('start-hinweis').textContent = 'Der Spielstand konnte nicht geladen werden: ' + fehler.message;
        return;
      }
      starteSpiel(world);
      UI.toast('Spielstand geladen.', 'gut');
    });
  }

  // ------------------------------------------------------------ Verdrahtung

  function init() {
    Array.prototype.forEach.call(doc.querySelectorAll('.liga-tab'), function (b) {
      b.onclick = function () {
        aktiveLiga = parseInt(b.dataset.liga, 10);
        Array.prototype.forEach.call(doc.querySelectorAll('.liga-tab'), function (x) {
          x.classList.toggle('is-active', x === b);
        });
        zeichneVereine();
      };
    });
    zeichneVereine();

    el('btn-start').onclick = starteNeu;
    el('btn-laden').onclick = ladeStand;
    el('in-import').onchange = function () {
      var datei = this.files && this.files[0];
      if (!datei) return;
      FM.save.importieren(datei, function (fehler, world) {
        if (fehler) { el('start-hinweis').textContent = 'Import fehlgeschlagen: ' + fehler.message; return; }
        starteSpiel(world);
        UI.toast('Spielstand importiert.', 'gut');
      });
    };

    var info = FM.save.standInfo();
    if (info) {
      el('start-hinweis').textContent = 'Gespeicherter Stand vorhanden: ' + info.verein +
        (info.datum ? ' · ' + info.datum : '') + (info.trainer ? ' · ' + info.trainer : '');
    } else {
      el('btn-laden').disabled = true;
    }

    // Navigation
    Array.prototype.forEach.call(doc.querySelectorAll('.nav__item'), function (b) {
      b.onclick = function () { UI.zeige(b.dataset.view); };
    });

    // Bedienleiste am unteren Rand (schmale Bildschirme)
    Array.prototype.forEach.call(doc.querySelectorAll('.tabbar button'), function (b) {
      b.onclick = function () {
        if (b.dataset.mehr) UI.mehrBlatt();
        else UI.zeige(b.dataset.view);
      };
    });
    el('sheet').addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.sheetZu) UI.blattZu();
    });

    var thema = el('btn-thema');
    if (thema) thema.onclick = function () { themaUmschalten(); };

    el('btn-weiter').onclick = function () { UI.weiter(); };
    var vor = el('btn-vor');
    if (vor) vor.onclick = function () { UI.vorspulen(); };
    el('btn-speichern').onclick = function () {
      var b = el('btn-speichern');
      b.disabled = true;
      b.textContent = 'Speichert …';
      FM.save.speichern(UI.world, function (fehler, kopf) {
        b.disabled = false;
        b.textContent = 'Speichern';
        if (fehler) UI.toast(fehler.message, 'fehler');
        else UI.toast('Gespeichert (' + Math.round(kopf.groesse / 1024) + ' KB).', 'gut');
      });
    };

    // Dialog schließen
    el('modal').addEventListener('click', function (e) {
      if (e.target.dataset && e.target.dataset.close) UI.modalZu();
    });

    // Tastenkürzel
    doc.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') {
        if (!el('sheet').hidden) { UI.blattZu(); return; }
        if (!el('modal').hidden) { UI.modalZu(); return; }
      }
      if (!UI.world) return;
      if (!el('matchview').hidden) return;
      if (!el('modal').hidden) return;
      if (!el('sheet').hidden) return;
      var tasten = {
        w: function () { UI.weiter(); },
        W: function () { UI.weiter(); },
        v: function () { UI.vorspulen(); },
        V: function () { UI.vorspulen(); },
        '1': function () { UI.zeige('uebersicht'); },
        '2': function () { UI.zeige('kader'); },
        '3': function () { UI.zeige('taktik'); },
        '4': function () { UI.zeige('training'); },
        '5': function () { UI.zeige('spielplan'); },
        '6': function () { UI.zeige('tabelle'); },
        '7': function () { UI.zeige('transfers'); },
        '8': function () { UI.zeige('finanzen'); },
        '9': function () { UI.zeige('medien'); },
        s: function () { el('btn-speichern').click(); }
      };
      if (tasten[e.key]) { e.preventDefault(); tasten[e.key](); }
    });

    // Vor dem Verlassen warnen
    global.addEventListener('beforeunload', function (e) {
      if (!UI.world) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

})(typeof window !== 'undefined' ? window : globalThis);
