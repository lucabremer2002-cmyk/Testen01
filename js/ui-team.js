/* ui-team.js - Kaderuebersicht sowie Aufstellung und Taktik. */
(function (g) {
  'use strict';

  var UI = g.UI;
  var $ = UI.$;

  /* ---------- Kader ---------- */

  var SORTIER = {
    pos: function (a, b) {
      var r = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST'];
      return r.indexOf(a.pos) - r.indexOf(b.pos) || b.staerke - a.staerke;
    },
    staerke: function (a, b) { return b.staerke - a.staerke; },
    name: function (a, b) { return a.nachname < b.nachname ? -1 : 1; },
    alter: function (a, b) { return a.alter - b.alter; },
    marktwert: function (a, b) { return b.marktwert - a.marktwert; },
    gehalt: function (a, b) { return b.gehalt - a.gehalt; },
    vertrag: function (a, b) { return a.vertragBis - b.vertragBis; },
    tore: function (a, b) { return b.stats.tore - a.stats.tore; },
    note: function (a, b) {
      var na = UI.noteSchnitt(a), nb = UI.noteSchnitt(b);
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    }
  };

  /* Der Kader wird nach Mannschaftsteilen gruppiert und in drei Ansichten
     geteilt - so stehen nie mehr als sieben Spalten nebeneinander. */
  var KADER_ANSICHTEN = [
    { id: 'ueberblick', name: 'Überblick' },
    { id: 'leistung', name: 'Leistung' },
    { id: 'vertraege', name: 'Werte & Verträge' }
  ];

  var GRUPPEN = [
    { id: 'TW', name: 'Torhüter' },
    { id: 'ABW', name: 'Abwehr' },
    { id: 'MIT', name: 'Mittelfeld' },
    { id: 'ANG', name: 'Angriff' }
  ];

  function kaderSpalten(ansicht) {
    if (ansicht === 'leistung') {
      return ['<th class="zahl">Nr</th><th class="mitte">Pos</th><th>Spieler</th>' +
        '<th class="zahl">Spiele</th><th class="zahl">Tore</th><th class="zahl">Vorlagen</th>' +
        '<th class="zahl">Note</th><th class="zahl">Form</th>'];
    }
    if (ansicht === 'vertraege') {
      return ['<th class="zahl">Nr</th><th class="mitte">Pos</th><th>Spieler</th>' +
        '<th class="zahl">Alter</th><th class="zahl">Marktwert</th>' +
        '<th class="zahl">Gehalt / Woche</th><th class="zahl">Vertrag bis</th>'];
    }
    return ['<th class="zahl">Nr</th><th class="mitte">Pos</th><th>Spieler</th>' +
      '<th class="zahl">Alter</th><th class="zahl">Stärke</th><th class="mitte">Fitness</th>' +
      '<th>Status</th>'];
  }

  function kaderZeile(p, ansicht, st) {
    var kopf = '<td class="zahl mini">' + (p.nummer || '') + '</td>' +
      '<td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
      '<td><b>' + Util.esc(p.nachname) + '</b> <span class="mini">' +
      Util.esc(p.vorname) + '</span></td>';
    if (ansicht === 'leistung') {
      return kopf +
        '<td class="zahl">' + (p.stats.spiele || '–') + '</td>' +
        '<td class="zahl">' + (p.stats.tore || '') + '</td>' +
        '<td class="zahl">' + (p.stats.vorlagen || '') + '</td>' +
        '<td class="zahl">' + UI.noteText(UI.noteSchnitt(p)) + '</td>' +
        '<td class="zahl mini">' + p.form + '</td>';
    }
    if (ansicht === 'vertraege') {
      var rest = p.vertragBis - st.saison;
      var farbe = rest <= 0 ? 'schlecht' : (rest === 1 ? 'akzent' : '');
      return kopf +
        '<td class="zahl">' + p.alter + '</td>' +
        '<td class="zahl">' + Fmt.money(p.marktwert) + '</td>' +
        '<td class="zahl">' + Fmt.money(p.gehalt) + '</td>' +
        '<td class="zahl ' + farbe + '">' + p.vertragBis + '</td>';
    }
    return kopf +
      '<td class="zahl">' + p.alter + '</td>' +
      '<td class="zahl">' + UI.staerkeBalken(p.staerke) + '</td>' +
      '<td class="mitte">' + UI.fitnessBalken(p.fitness) + '</td>' +
      '<td>' + UI.zustand(p) + '</td>';
  }

  UI.seiten.kader = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var kader = Game.kaderVon(st, mein);
    var ansicht = UI.daten.ansicht || 'ueberblick';

    var gehaltWoche = Util.sum(kader, function (p) { return p.gehalt; });
    var budget = mein.finanzen.gehaltsbudget;
    var auslastung = budget ? gehaltWoche / budget : 0;
    var verletzt = kader.filter(function (p) { return p.verletztBis > st.tag; }).length;
    var gesperrt = kader.filter(function (p) { return p.sperre > 0; }).length;

    var html = '<div class="raster raster--4">' +
      UI.kennzahl('Spieler im Kader', String(kader.length),
        verletzt + ' verletzt · ' + gesperrt + ' gesperrt') +
      UI.kennzahl('Kaderwert', Fmt.money(Util.sum(kader, function (p) { return p.marktwert; })), '') +
      UI.kennzahl('Lohnsumme', Fmt.money(gehaltWoche), 'pro Woche') +
      UI.kennzahl('Gehaltsrahmen', Fmt.pct(auslastung) + ' genutzt',
        'Rahmen ' + Fmt.money(budget)) +
      '</div>';

    if (auslastung > 1) {
      html += '<div class="karte"><p class="schlecht" style="margin:0">Die Lohnsumme liegt ' +
        Fmt.money(gehaltWoche - budget) + ' über dem Rahmen des Vorstands. ' +
        'Solange das so bleibt, sinkt sein Vertrauen Woche für Woche.</p></div>';
    }

    html += '<div class="reiter">' + KADER_ANSICHTEN.map(function (a) {
      return '<button data-kaderansicht="' + a.id + '" class="' +
        (a.id === ansicht ? 'aktiv' : '') + '">' + a.name + '</button>';
    }).join('') + '</div>';

    html += '<div class="karte">';
    GRUPPEN.forEach(function (grp) {
      var teil = kader.filter(function (p) { return Players.GRUPPE[p.pos] === grp.id; })
        .sort(function (a, b) { return b.staerke - a.staerke; });
      if (!teil.length) return;
      html += '<h4 class="gruppenkopf">' + grp.name +
        ' <span class="mini">' + teil.length + '</span></h4>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr>' +
        kaderSpalten(ansicht) + '</tr></thead><tbody>' +
        teil.map(function (p) {
          return '<tr class="klickbar" data-spieler="' + p.id + '">' +
            kaderZeile(p, ansicht, st) + '</tr>';
        }).join('') + '</tbody></table></div>';
    });
    html += '</div>';

    /* Verliehene Spieler stehen nicht im Kader, gehören aber dem Verein. */
    var verliehen = UI.verliehene();
    if (verliehen.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Verliehen</h3>' +
        '<span class="mini">Rückkehr am Saisonende</span></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr>' +
        '<th class="zahl">Nr</th><th class="mitte">Pos</th><th>Spieler</th><th>Verein</th>' +
        '<th class="zahl">Stärke</th><th class="zahl">Ihr Anteil</th>' +
        '<th class="zahl">Einsätze</th></tr></thead><tbody>' +
        verliehen.map(function (p) {
          return '<tr class="klickbar" data-spieler="' + p.id + '">' +
            '<td class="zahl mini">' + (p.nummer || '') + '</td>' +
            '<td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
            '<td>' + Util.esc(p.name) + '</td>' +
            '<td>' + UI.klubZelle(st.klubs[p.klubId], 18, true) + '</td>' +
            '<td class="zahl">' + UI.staerkeBalken(p.staerke) + '</td>' +
            '<td class="zahl">' + (p.leihe ? (100 - p.leihe.gehaltsanteil) + ' %' : '–') + '</td>' +
            '<td class="zahl">' + p.stats.spiele + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  UI.nachZeichnen.kader = function () {
    UI.spielerKlicks();
    Array.prototype.forEach.call(document.querySelectorAll('[data-kaderansicht]'), function (b) {
      b.onclick = function () { UI.wechsle('kader', { ansicht: b.dataset.kaderansicht }); };
    });
  };

  /* ---------- Aufstellung ---------- */

  var gewaehlt = null;

  function slotsVon(formation) {
    return Match.FORMATIONEN[formation] || Match.FORMATIONEN['4-2-3-1'];
  }

  function elfStaerke(mein, spielerMap) {
    var seite = {
      klubId: mein.id, formation: mein.aufstellung.formation,
      elf: mein.aufstellung.elf, taktik: mein.taktik
    };
    return Match.teamWerte(seite, spielerMap);
  }

  UI.seiten.taktik = function () {
    var st = UI.S(), mein = UI.meinKlub();
    Game.aufstellungPruefen(st, mein, st.tag);
    var auf = mein.aufstellung;
    var kader = Game.kaderVon(st, mein);
    var map = {};
    kader.forEach(function (p) { map[p.id] = p; });
    var slots = slotsVon(auf.formation);
    var werte = elfStaerke(mein, map);

    var html = '<div class="taktikraster">';

    /* Spielfeld */
    html += '<div class="karte"><div class="karte__kopf"><h3>Startelf</h3>' +
      '<button class="knopf knopf--klein" id="btnAutoElf">Beste Elf</button></div>';
    html += '<div class="platz-feld" id="platzFeld">' +
      '<div class="linie mittellinie"></div><div class="linie mittelkreis"></div>' +
      '<div class="linie strafraum strafraum--unten"></div><div class="linie strafraum strafraum--oben"></div>';
    slots.forEach(function (slot, i) {
      var pid = auf.elf[i];
      var p = map[pid];
      var raus = !p || p.verletztBis > st.tag || p.sperre > 0;
      var eignung = p ? Players.eignung(p.pos, slot[0]) : 0;
      var warn = raus || eignung < 0.88;
      var titel = slot[0] + (p ? ' · ' + p.name + ' (' + p.pos + ', Eignung ' +
        Math.round(eignung * 100) + ' %)' : ' · frei');
      html += '<div class="spielerchip' + (warn ? ' warn' : '') + '" data-slot="' + i + '" ' +
        'style="left:' + slot[1] + '%;top:' + slot[2] + '%" title="' + Util.esc(titel) + '">' +
        '<div class="spielerchip__kreis">' + (p ? (p.nummer || p.staerke) : '–') + '</div>' +
        '<div class="spielerchip__name">' + (p ? Util.esc(p.nachname) : '<i>frei</i>') + '</div>' +
        '<div class="spielerchip__note">' + slot[0] + '</div>' +
        '</div>';
    });
    html += '</div>';
    html += '<div class="raster raster--3" style="margin-top:var(--s4)">' +
      UI.kennzahl('Abwehr', werte.abw.toFixed(0), '') +
      UI.kennzahl('Mittelfeld', werte.mit.toFixed(0), '') +
      UI.kennzahl('Angriff', werte.ang.toFixed(0), '') +
      '</div>';

    /* Hinweise nur, wenn es wirklich etwas zu sagen gibt */
    var probleme = [];
    auf.elf.forEach(function (pid, i) {
      var p = map[pid];
      if (!p) { probleme.push(slots[i][0] + ' ist nicht besetzt.'); return; }
      if (p.verletztBis > st.tag) probleme.push(p.nachname + ' ist verletzt.');
      else if (p.sperre > 0) probleme.push(p.nachname + ' ist gesperrt.');
      else if (Players.eignung(p.pos, slots[i][0]) < 0.88) {
        probleme.push(p.nachname + ' spielt auf ' + slots[i][0] + ' statt ' + p.pos + '.');
      }
    });
    if (probleme.length) {
      html += '<div class="dossier__hinweise"><ul>' +
        probleme.slice(0, 4).map(function (t) { return '<li>' + Util.esc(t) + '</li>'; }).join('') +
        '</ul></div>';
    } else {
      html += '<p class="mini" style="margin-top:var(--s3)">Alle elf stehen auf ihrer Position ' +
        'und sind einsatzbereit. Zum Tauschen einen Spieler anklicken, dann einen zweiten.</p>';
    }
    html += '</div>';

    /* Rechte Spalte */
    html += '<div>';
    html += '<div class="karte"><div class="karte__kopf"><h3>Taktik</h3></div>' +
      '<div class="formularraster">' +
      auswahlFeld('Formation', 'taktFormation', Object.keys(Match.FORMATIONEN).map(function (f) {
        return [f, f];
      }), auf.formation) +
      auswahlFeld('Ausrichtung', 'taktMentalitaet', Object.keys(Match.MENTALITAET).map(function (k) {
        return [k, Match.MENTALITAET[k].name];
      }), mein.taktik.mentalitaet) +
      auswahlFeld('Pressing', 'taktPressing', Object.keys(Match.PRESSING).map(function (k) {
        return [k, Match.PRESSING[k].name];
      }), mein.taktik.pressing) +
      auswahlFeld('Spielweise', 'taktSpielweise', Object.keys(Match.SPIELWEISE).map(function (k) {
        return [k, Match.SPIELWEISE[k].name];
      }), mein.taktik.spielweise) +
      auswahlFeld('Zweikampfhärte', 'taktHaerte',
        [['fair', 'Fair'], ['normal', 'Normal'], ['hart', 'Hart']], mein.taktik.haerte) +
      '</div></div>';

    var aufFeld = {};
    auf.elf.forEach(function (id) { aufFeld[id] = true; });
    var bank = auf.bank.map(function (id) { return map[id]; }).filter(Boolean);
    var rest = kader.filter(function (p) { return !aufFeld[p.id] && auf.bank.indexOf(p.id) < 0; });

    html += '<div class="karte"><div class="karte__kopf"><h3>Ersatzbank</h3>' +
      '<span class="mini">' + bank.length + ' von 9</span></div>' +
      spielerListe(bank, st, false) + '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Übrige Spieler</h3>' +
      '<span class="mini">' + rest.length + '</span></div>' +
      spielerListe(rest, st, true) + '</div>';
    html += '</div></div>';
    return html;
  };

  function auswahlFeld(titel, id, optionen, wert) {
    return '<label class="feld"><span>' + titel + '</span><select id="' + id + '">' +
      optionen.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === wert ? ' selected' : '') + '>' + Util.esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
  }

  /* Spielerliste nach Mannschaftsteilen gegliedert - so findet man den
     passenden Ersatz sofort. */
  function spielerListe(liste, st, gruppiert) {
    if (!liste.length) return '<p class="leer">Niemand.</p>';
    function tabelle(teil) {
      return '<div class="tabellenrahmen"><table class="liste"><tbody>' +
        teil.sort(function (a, b) { return b.staerke - a.staerke; }).map(function (p) {
          return '<tr class="klickbar" data-tausch="' + p.id + '">' +
            '<td class="zahl mini" style="width:2.2em">' + (p.nummer || '') + '</td>' +
            '<td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
            '<td>' + Util.esc(p.nachname) + '</td>' +
            '<td class="zahl">' + UI.staerkeBalken(p.staerke) + '</td>' +
            '<td class="mitte">' + UI.fitnessBalken(p.fitness) + '</td>' +
            '<td>' + UI.zustand(p) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (!gruppiert) return tabelle(liste);
    var teile = [
      ['TW', 'Torhüter'], ['ABW', 'Abwehr'], ['MIT', 'Mittelfeld'], ['ANG', 'Angriff']
    ];
    return teile.map(function (t) {
      var teil = liste.filter(function (p) { return Players.GRUPPE[p.pos] === t[0]; });
      if (!teil.length) return '';
      return '<h4 class="gruppenkopf">' + t[1] + '</h4>' + tabelle(teil);
    }).join('');
  }

  function tausche(idA, idB) {
    var mein = UI.meinKlub();
    var auf = mein.aufstellung;
    function ort(id) {
      var i = auf.elf.indexOf(id);
      if (i >= 0) return { liste: 'elf', index: i };
      i = auf.bank.indexOf(id);
      if (i >= 0) return { liste: 'bank', index: i };
      return { liste: 'rest' };
    }
    var a = ort(idA), b = ort(idB);
    if (a.liste === 'elf' && b.liste === 'elf') {
      auf.elf[a.index] = idB; auf.elf[b.index] = idA;
    } else if (a.liste === 'elf') {
      auf.elf[a.index] = idB;
      if (b.liste === 'bank') auf.bank[b.index] = idA;
      else auf.bank.push(idA);
    } else if (b.liste === 'elf') {
      auf.elf[b.index] = idA;
      if (a.liste === 'bank') auf.bank[a.index] = idB;
      else auf.bank.push(idB);
    } else {
      if (a.liste === 'bank' && b.liste === 'rest') { auf.bank[a.index] = idB; }
      else if (b.liste === 'bank' && a.liste === 'rest') { auf.bank[b.index] = idA; }
    }
    auf.bank = auf.bank.filter(function (id, i, arr) {
      return auf.elf.indexOf(id) < 0 && arr.indexOf(id) === i;
    }).slice(0, 9);
  }

  UI.nachZeichnen.taktik = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var auf = mein.aufstellung;

    function markiere() {
      Array.prototype.forEach.call(document.querySelectorAll('.spielerchip'), function (c) {
        var pid = auf.elf[+c.dataset.slot];
        c.classList.toggle('gewaehlt', !!gewaehlt && pid === gewaehlt);
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-tausch]'), function (tr) {
        tr.style.background = (gewaehlt === tr.dataset.tausch) ? 'var(--akzent-weich)' : '';
      });
    }

    function klick(pid) {
      if (!pid) return;
      if (gewaehlt === null) { gewaehlt = pid; markiere(); return; }
      if (gewaehlt === pid) { gewaehlt = null; markiere(); return; }
      tausche(gewaehlt, pid);
      gewaehlt = null;
      UI.zeichne();
    }

    Array.prototype.forEach.call(document.querySelectorAll('.spielerchip'), function (c) {
      c.onclick = function () { klick(auf.elf[+c.dataset.slot]); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tausch]'), function (tr) {
      tr.onclick = function () { klick(tr.dataset.tausch); };
    });

    var auto = $('btnAutoElf');
    if (auto) auto.onclick = function () {
      mein.aufstellung = Match.autoAufstellung(Game.kaderVon(st, mein), mein.aufstellung.formation, st.tag);
      gewaehlt = null;
      UI.toast('Beste verfügbare Elf aufgestellt.');
      UI.zeichne();
    };

    function bind(id, feld, istFormation) {
      var el = $(id);
      if (!el) return;
      el.onchange = function () {
        if (istFormation) {
          var alteElf = mein.aufstellung.elf.slice();
          mein.taktik.formation = el.value;
          mein.aufstellung = Match.autoAufstellung(Game.kaderVon(st, mein), el.value, st.tag);
          /* Bereits gewaehlte Spieler moeglichst behalten */
          mein.aufstellung.elf = mein.aufstellung.elf.slice();
          alteElf = null;
        } else {
          mein.taktik[feld] = el.value;
        }
        UI.zeichne();
      };
    }
    bind('taktFormation', 'formation', true);
    bind('taktMentalitaet', 'mentalitaet');
    bind('taktPressing', 'pressing');
    bind('taktSpielweise', 'spielweise');
    bind('taktHaerte', 'haerte');
  };

  /* ---------- Vertragsuebersicht ---------- */

  UI.seiten.vertraege = function () {
    var st = UI.S(), mein = UI.meinKlub();
    var kader = Game.kaderVon(st, mein).sort(function (a, b) {
      return (a.vertragBis - b.vertragBis) || (b.staerke - a.staerke);
    });
    var auslaufend = kader.filter(function (p) { return p.vertragBis <= st.saison; });

    var html = '';
    if (auslaufend.length) {
      html += '<div class="karte" style="border-color:#5c4a12"><h3>Verträge laufen aus</h3>' +
        '<p class="hinweis">Diese ' + auslaufend.length + ' Spieler verlassen den Verein am Saisonende ablösefrei, ' +
        'wenn Sie nicht verlängern.</p>' +
        '<div class="knopfreihe">' + auslaufend.map(function (p) {
          return '<button class="knopf knopf--klein knopf--haupt" data-verl="' + p.id + '">' +
            Util.esc(p.nachname) + ' verlängern</button>';
        }).join('') + '</div></div>';
    }

    html += '<div class="karte"><div class="karte__kopf"><h3>Laufende Verträge</h3>' +
      '<span class="mini">Gesamt ' + Fmt.money(Util.sum(kader, function (p) { return p.gehalt; }) * 52) + ' im Jahr</span></div>' +
      '<div class="tabellenrahmen"><table class="liste"><thead><tr><th class="mitte">Pos</th><th>Spieler</th>' +
      '<th class="zahl">Alter</th><th class="zahl">Stärke</th><th class="zahl">Gehalt/Woche</th>' +
      '<th class="zahl">Anteil</th><th class="zahl">Vertrag bis</th><th class="zahl">Rest</th><th></th></tr></thead><tbody>' +
      kader.map(function (p) {
        var rest = p.vertragBis - st.saison;
        var anteil = p.gehalt / Math.max(1, Util.sum(kader, function (x) { return x.gehalt; }));
        var farbe = rest <= 0 ? 'schlecht' : (rest === 1 ? 'akzent' : '');
        return '<tr><td class="mitte">' + UI.posMarke(p.pos) + '</td>' +
          '<td class="klickbar" data-spieler="' + p.id + '"><b>' + Util.esc(p.name) + '</b></td>' +
          '<td class="zahl">' + p.alter + '</td>' +
          '<td class="zahl">' + p.staerke + '</td>' +
          '<td class="zahl">' + Fmt.money(p.gehalt) + '</td>' +
          '<td class="zahl mini">' + Fmt.pct(anteil) + '</td>' +
          '<td class="zahl ' + farbe + '">' + p.vertragBis + '</td>' +
          '<td class="zahl ' + farbe + '">' + (rest <= 0 ? 'läuft aus' : rest + ' J.') + '</td>' +
          '<td><button class="knopf knopf--klein" data-verl="' + p.id + '">Verlängern</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return html;
  };

  UI.nachZeichnen.vertraege = function () {
    UI.spielerKlicks();
    Array.prototype.forEach.call(document.querySelectorAll('[data-verl]'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        UI.vertragsVerhandlung(b.dataset.verl);
      };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
