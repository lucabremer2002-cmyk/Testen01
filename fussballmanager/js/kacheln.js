/*
 * kacheln.js - Das Kachelbrett: die Startseite und zugleich die einzige
 * Navigation des Spiels.
 *
 * Der Gedanke dahinter ist der eines Telefon-Startbildschirms. Es gibt
 * genau einen Ort, an dem alles liegt, und jede Kachel sagt drei Dinge in
 * dieser Reihenfolge: ein Bild, wovon sie handelt; ein Wort, wie es heisst;
 * eine Zahl, wie es gerade darum steht. Wer nicht lesen kann, erkennt das
 * Bild. Wer lesen kann, braucht die Zahl nicht zu suchen.
 *
 * Darum gibt es keine Leiste mit vierzehn Eintraegen mehr. Aus einem
 * Bereich fuehrt ein einziger grosser Knopf zurueck.
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util;
  var P = FM.players;
  var UI = FM.ui;
  var esc = UI.esc;

  /** Sicher gerechnet: eine kaputte Kachel darf nicht das Brett zerlegen. */
  function ruhig(fn, ersatz) {
    try {
      var w = fn();
      return w === undefined || w === null ? ersatz : w;
    } catch (e) {
      return ersatz;
    }
  }

  /*
   * Die Bereiche. `name` ist bewusst das einfachste Wort, das zutrifft -
   * nicht das fachlich genaueste: "Spieler kaufen" statt "Transfers",
   * "Geld" statt "Finanzen". `was` steht als ganzer Satz darunter, damit
   * niemand raten muss, was ihn hinter der Kachel erwartet.
   */
  var BEREICHE = [
    {
      id: 'kader', name: 'Mannschaft', zeichen: '👥', farbe: 'blau',
      was: 'Alle deine Spieler ansehen.',
      stand: function (world, club) {
        var kader = world.kaderVon(club.id);
        var verletzt = kader.filter(function (p) { return p.verletzung; }).length;
        var gesperrt = kader.filter(function (p) { return p.sperre > 0; }).length;
        if (verletzt + gesperrt > 0) {
          return {
            wert: kader.length + ' Spieler',
            hinweis: verletzt + gesperrt === 1 ? '1 fehlt' : (verletzt + gesperrt) + ' fehlen',
            ton: 'warn'
          };
        }
        return { wert: kader.length + ' Spieler', hinweis: 'alle fit', ton: 'gut' };
      }
    },
    {
      id: 'taktik', name: 'Aufstellung', zeichen: '📋', farbe: 'gruen',
      was: 'Wer spielt? Stelle deine Elf auf.',
      stand: function (world, club) {
        var taktik = world.taktikVon(club.id);
        var beste = FM.views.bestmoeglicheElf(world, club, taktik);
        var elf = [];
        var f = FM.tactics.formation(taktik);
        taktik.aufstellung.forEach(function (id, i) {
          var sp = id ? world.spieler[id] : null;
          if (sp) elf.push(P.posStaerke(sp, f.slots[i].pos));
        });
        var wert = elf.length ? Math.round(U.avg(elf)) : 0;
        var luecken = 11 - elf.length;
        if (luecken > 0) {
          return { wert: 'Stärke ' + wert, hinweis: luecken + ' Platz frei', ton: 'schlecht' };
        }
        var abstand = beste.staerke - wert;
        if (abstand >= 2) return { wert: 'Stärke ' + wert, hinweis: 'geht besser', ton: 'warn' };
        return { wert: 'Stärke ' + wert, hinweis: 'beste Elf', ton: 'gut' };
      }
    },
    {
      id: 'training', name: 'Training', zeichen: '🏃', farbe: 'orange',
      was: 'Übungen für die Woche festlegen.',
      stand: function (world, club) {
        var kader = world.kaderVon(club.id);
        var frisch = Math.round(U.avg(kader.map(function (p) { return p.fitness; })) || 0);
        return {
          wert: frisch + ' % frisch',
          hinweis: frisch >= 80 ? 'gut erholt' : frisch >= 65 ? 'etwas müde' : 'sehr müde',
          ton: frisch >= 80 ? 'gut' : frisch >= 65 ? 'warn' : 'schlecht'
        };
      }
    },
    {
      id: 'spielplan', name: 'Spiele', zeichen: '📅', farbe: 'lila',
      was: 'Gegen wen spielst du als Nächstes?',
      stand: function (world, club) {
        var s = world.naechstesSpiel(club.id);
        if (!s) return { wert: 'Pause', hinweis: 'kein Spiel angesetzt', ton: '' };
        var gegnerId = s.heimId === club.id ? s.gastId : s.heimId;
        return {
          wert: world.vereine[gegnerId].kurz,
          hinweis: U.fmtDate(s.tag) + (s.heimId === club.id ? ' · zu Hause' : ' · auswärts'),
          ton: ''
        };
      }
    },
    {
      id: 'tabelle', name: 'Tabelle', zeichen: '🏆', farbe: 'gold',
      was: 'Wer steht oben, wer unten?',
      stand: function (world, club) {
        var t = world.tabellenPlatz(club.id);
        if (!t || !t.spiele) return { wert: 'Platz –', hinweis: 'die Saison beginnt', ton: '' };
        return {
          wert: 'Platz ' + t.platz,
          hinweis: (t.punkte - t.punktabzug) + ' Punkte',
          ton: t.platz <= 6 ? 'gut' : t.platz >= 16 ? 'schlecht' : ''
        };
      }
    },
    {
      id: 'transfers', name: 'Spieler kaufen', zeichen: '🔁', farbe: 'blau',
      was: 'Neue Spieler holen oder abgeben.',
      stand: function (world, club) {
        var f = world.finanzen[club.id];
        var offen = (world.transfer && world.transfer.angeboteEin || []).filter(function (a) {
          return a.status === 'offen';
        }).length;
        if (offen) return { wert: offen + ' Angebot' + (offen > 1 ? 'e' : ''), hinweis: 'warten auf dich', ton: 'warn' };
        return { wert: U.money(f.transferbudget), hinweis: 'kannst du ausgeben', ton: '' };
      }
    },
    {
      id: 'finanzen', name: 'Geld', zeichen: '💶', farbe: 'gruen',
      was: 'Was der Verein einnimmt und ausgibt.',
      stand: function (world, club) {
        var f = world.finanzen[club.id];
        return {
          wert: U.money(f.kontostand),
          hinweis: f.kontostand < 0 ? 'im Minus!' : 'auf dem Konto',
          ton: f.kontostand < 0 ? 'schlecht' : 'gut'
        };
      }
    },
    {
      id: 'verein', name: 'Verein', zeichen: '🏟', farbe: 'orange',
      was: 'Stadion, Gelände und Ausbau.',
      stand: function (world, club) {
        if (club.bauprojekt) return { wert: 'Baustelle', hinweis: 'es wird gebaut', ton: 'warn' };
        return { wert: U.num(club.kapazitaet) + ' Plätze', hinweis: esc(club.stadion || 'Stadion'), ton: '' };
      }
    },
    {
      id: 'personal', name: 'Trainerteam', zeichen: '👔', farbe: 'lila',
      was: 'Co-Trainer, Ärzte und Scouts.',
      stand: function (world, club) {
        var stab = world.stabVon(club.id) || [];
        return { wert: stab.length + ' Leute', hinweis: 'arbeiten für dich', ton: '' };
      }
    },
    {
      id: 'nachwuchs', name: 'Jugend', zeichen: '⭐', farbe: 'gold',
      was: 'Junge Talente aus dem eigenen Verein.',
      stand: function (world, club) {
        var talente = world.kaderVon(club.id).filter(function (p) {
          return p.alter <= 20 && p.potenzial - P.gesamt(p) >= 8;
        }).length;
        return { wert: talente + ' Talente', hinweis: talente ? 'können noch wachsen' : 'noch keine', ton: talente ? 'gut' : '' };
      }
    },
    {
      id: 'medien', name: 'Post', zeichen: '✉️', farbe: 'rot',
      was: 'Nachrichten und Zeitungsberichte.',
      stand: function (world) {
        var n = world.ungeleseneNachrichten();
        if (!n) return { wert: 'Alles gelesen', hinweis: 'nichts Neues', ton: 'gut' };
        return { wert: n + ' neu', hinweis: 'ungelesen', ton: 'warn' };
      }
    },
    {
      id: 'statistik', name: 'Zahlen', zeichen: '📊', farbe: 'blau',
      was: 'Torjäger, Bestwerte und Ehrungen.',
      stand: function (world, club) {
        var beste = null;
        world.kaderVon(club.id).forEach(function (p) {
          if (!beste || p.stats.tore > beste.stats.tore) beste = p;
        });
        if (!beste || !beste.stats.tore) return { wert: 'Noch kein Tor', hinweis: 'das kommt noch', ton: '' };
        return { wert: beste.stats.tore + ' Tore', hinweis: beste.nachname, ton: 'gut' };
      }
    },
    {
      id: 'uebersicht', name: 'Mein Stand', zeichen: '\uD83C\uDFAF', farbe: 'rot',
      was: 'Sind Vorstand und Fans zufrieden mit dir?',
      stand: function (world) {
        var m = world.manager;
        var v = Math.round(m.vorstandsvertrauen);
        return {
          wert: v + ' %',
          hinweis: v >= 60 ? 'Vorstand ist zufrieden' : v >= 35 ? 'Vorstand schaut genau hin' : 'Vorstand ist unzufrieden',
          ton: v >= 60 ? 'gut' : v >= 35 ? 'warn' : 'schlecht'
        };
      }
    },
    {
      id: 'karriere', name: 'Meine Laufbahn', zeichen: '🎖️', farbe: 'gold',
      was: 'Deine Ziele und was du schon geschafft hast.',
      stand: function (world) {
        var b = FM.meilensteine.bilanz(world);
        return { wert: b.erreicht + ' von ' + b.gesamt, hinweis: 'Ziele geschafft', ton: b.erreicht ? 'gut' : '' };
      }
    }
  ];

  /**
   * Was jetzt zu tun ist - in ganzen Saetzen, nicht in Fachwoertern. Hoechstens
   * drei, sonst ist es wieder eine Liste zum Ueberfliegen statt einer Ansage.
   */
  function aufgaben(world, club) {
    var liste = [];
    var kader = world.kaderVon(club.id);
    var taktik = world.taktikVon(club.id);
    var f = world.finanzen[club.id];

    var frei = 11 - taktik.aufstellung.filter(function (id) { return !!id; }).length;
    if (frei > 0) {
      liste.push({ zeichen: '📋', text: 'In deiner Elf ' + (frei === 1 ? 'fehlt noch ein Spieler' : 'fehlen noch ' + frei + ' Spieler') + '.',
        knopf: 'Aufstellen', view: 'taktik', ton: 'schlecht' });
    }
    var verletzt = kader.filter(function (p) { return p.verletzung; });
    if (verletzt.length) {
      liste.push({ zeichen: '🩹', text: verletzt.length === 1
        ? verletzt[0].nachname + ' ist verletzt und kann nicht spielen.'
        : verletzt.length + ' Spieler sind verletzt.',
        knopf: 'Ansehen', view: 'kader', ton: 'warn' });
    }
    var offen = (world.transfer && world.transfer.angeboteEin || []).filter(function (a) { return a.status === 'offen'; });
    if (offen.length) {
      liste.push({ zeichen: '🔁', text: 'Ein anderer Verein will einen deiner Spieler kaufen.',
        knopf: 'Angebot ansehen', view: 'transfers', ton: 'warn' });
    }
    if (f.kontostand < 0) {
      liste.push({ zeichen: '💶', text: 'Dein Konto ist im Minus. Du musst sparen oder jemanden verkaufen.',
        knopf: 'Geld ansehen', view: 'finanzen', ton: 'schlecht' });
    }
    var ungelesen = world.ungeleseneNachrichten();
    if (!liste.length && ungelesen) {
      liste.push({ zeichen: '✉️', text: 'Du hast ' + ungelesen + ' neue Nachricht' + (ungelesen > 1 ? 'en' : '') + '.',
        knopf: 'Post lesen', view: 'medien', ton: '' });
    }
    if (!liste.length) {
      liste.push({ zeichen: '✅', text: 'Alles in Ordnung. Du kannst weiterspielen.',
        knopf: null, view: null, ton: 'gut' });
    }
    return liste.slice(0, 3);
  }

  /** Die grosse Kachel ganz oben: das naechste Spiel. */
  function spielKachel(world, club) {
    var s = world.naechstesSpiel(club.id);
    if (!s) {
      return '<div class="kachel kachel--spiel">' +
        '<div class="kachel--spiel__kopf"><span class="kachel__zeichen kachel__zeichen--gross">⏸️</span>' +
        '<div><b>Gerade kein Spiel</b><small>Die nächste Runde wird angesetzt.</small></div></div>' +
        '<button class="btn btn--primary btn--riesig" data-kachel-a="weiter">Tag weiter</button></div>';
    }
    var heim = world.vereine[s.heimId];
    var gast = world.vereine[s.gastId];
    var heute = s.tag === world.tag;
    // Das Schild steht bei beiden Mannschaften im Aufbau, beim Gegner nur
    // unsichtbar - sonst stuende ein Wappen hoeher als das andere.
    function team(c) {
      return '<div class="paarung__team">' + UI.wappen(c) + '<b>' + esc(c.kurz) + '</b>' +
        '<span class="paarung__du"' + (c.id === club.id ? '' : ' aria-hidden="true" style="visibility:hidden"') +
        '>Du</span></div>';
    }
    return '<div class="kachel kachel--spiel' + (heute ? ' ist-heute' : '') + '">' +
      '<div class="kachel--spiel__kopf">' +
      '<span class="kachel__marke">' + (heute ? 'Heute' : U.fmtDate(s.tag, 'lang')) + '</span>' +
      '</div>' +
      '<div class="paarung">' +
      team(heim) +
      '<span class="paarung__gegen">gegen</span>' +
      team(gast) +
      '</div>' +
      '<button class="btn btn--primary btn--riesig" data-kachel-a="' + (heute ? 'anpfiff' : 'weiter') + '">' +
      (heute ? '▶︎  Spiel starten' : 'Weiter bis zum Spiel') + '</button>' +
      '</div>';
  }

  function kachelHtml(b, world, club) {
    var s = ruhig(function () { return b.stand(world, club); }, { wert: '–', hinweis: '', ton: '' }) || {};
    return '<button type="button" class="kachel kachel--bereich" data-kachel="' + esc(b.id) + '">' +
      '<span class="kachel__zeichen kachel__zeichen--' + b.farbe + '">' + b.zeichen + '</span>' +
      '<span class="kachel__name">' + esc(b.name) + '</span>' +
      '<span class="kachel__wert' + (s.ton ? ' ist-' + s.ton : '') + '">' + esc(String(s.wert)) + '</span>' +
      '<span class="kachel__hinweis">' + esc(String(s.hinweis || '')) + '</span>' +
      '<span class="kachel__was">' + esc(b.was) + '</span>' +
      '</button>';
  }

  /*
   * Die drei Schritte, aus denen dieses Spiel besteht. Sie stehen so lange
   * oben, bis man sie wegklickt - und lassen sich ueber den Knopf in der
   * Spielkachel wiederholen. Wer das einmal gelesen hat, kann spielen; alles
   * andere ist Vertiefung.
   */
  var SCHRITTE = [
    ['\uD83D\uDCCB', 'Elf aufstellen', 'Tippe auf <b>Aufstellung</b> und wähle deine elf besten Spieler.'],
    ['\u25B6\uFE0E', 'Spiel starten', 'Mit dem grünen Knopf oben geht es zum nächsten Spiel.'],
    ['\uD83C\uDFC6', 'Besser werden', 'Gewinne Spiele, steige in der <b>Tabelle</b>, kaufe bessere Spieler.']
  ];

  function anleitung(world) {
    if (world.einstellungen && world.einstellungen.anleitungWeg) return '';
    return '<div class="anleitung">' +
      '<div class="anleitung__kopf"><h3>So spielst du</h3>' +
      '<button class="btn btn--sm btn--ghost" data-kachel-a="anleitung-zu">Verstanden</button></div>' +
      '<div class="anleitung__schritte">' +
      SCHRITTE.map(function (sch, i) {
        return '<div class="schritt">' +
          '<span class="schritt__zahl">' + (i + 1) + '</span>' +
          '<span class="schritt__zeichen">' + sch[0] + '</span>' +
          '<b>' + sch[1] + '</b>' +
          '<span class="schritt__text">' + sch[2] + '</span>' +
          '</div>';
      }).join('') +
      '</div></div>';
  }

  UI.views.kacheln = {
    html: function (world) {
      var club = world.nutzerVerein();
      var html = '';

      html += anleitung(world);
      html += spielKachel(world, club);

      var liste = aufgaben(world, club);
      html += '<div class="aufgaben">' +
        '<h3 class="aufgaben__titel">Das ist jetzt wichtig</h3>' +
        liste.map(function (a) {
          return '<div class="aufgabe' + (a.ton ? ' ist-' + a.ton : '') + '">' +
            '<span class="aufgabe__zeichen">' + a.zeichen + '</span>' +
            '<span class="aufgabe__text">' + esc(a.text) + '</span>' +
            (a.knopf ? '<button class="btn btn--sm" data-kachel="' + esc(a.view) + '">' + esc(a.knopf) + '</button>' : '') +
            '</div>';
        }).join('') + '</div>';

      html += '<div class="kachelbrett">' +
        BEREICHE.map(function (b) { return kachelHtml(b, world, club); }).join('') +
        '</div>';

      return html;
    },

    nachher: function (container, world) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-kachel]'), function (k) {
        k.onclick = function () { UI.zeige(k.dataset.kachel); };
      });
      var zu = container.querySelector('[data-kachel-a="anleitung-zu"]');
      if (zu) zu.onclick = function () {
        world.einstellungen.anleitungWeg = true;
        UI.zeichne();
      };
      var weiter = container.querySelector('[data-kachel-a="weiter"]');
      if (weiter) weiter.onclick = function () { UI.vorspulen(); };
      var anpfiff = container.querySelector('[data-kachel-a="anpfiff"]');
      if (anpfiff) anpfiff.onclick = function () { UI.weiter(); };
    }
  };

  FM.kacheln = { BEREICHE: BEREICHE };

})(typeof window !== 'undefined' ? window : globalThis);
