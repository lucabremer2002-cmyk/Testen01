/*
 * views.js - Die einzelnen Ansichten des Spiels.
 *
 * Jede Ansicht liefert HTML und verdrahtet anschliessend ihre Bedienelemente.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;
  var T = FM.tactics;
  var C = FM.competitions;
  var F = FM.finance;
  var UI = FM.ui;
  var V = FM.views = {};
  var esc = UI.esc;

  // ============================================================ Übersicht

  UI.views.uebersicht = {
    html: function (world) {
      var club = world.nutzerVerein();
      var f = world.finanzen[club.id];
      var liga = world.ligaVon(club.id);
      var tab = C.sortierteTabelle(liga);
      var eigen = tab.filter(function (e) { return e.clubId === club.id; })[0];
      var naechstes = world.naechstesSpiel(club.id);
      var letztes = world.letztesSpiel(club.id);
      var kader = world.kaderVon(club.id);
      var m = world.manager;

      var html = '<div class="grid grid--wide">';

      // ---- linke Spalte
      html += '<div class="grid">';

      // Deadline Day
      if (world.transferfenster.deadline) {
        html += '<div class="card card--deadline"><div class="card__head">' +
          '<h3>Deadline Day</h3><span class="chip chip--gold">letzter Tag</span></div>' +
          '<p class="muted">Heute schließt das Transferfenster. Was bis Mitternacht nicht ' +
          'unterschrieben ist, muss bis zum nächsten Fenster warten – auf beiden Seiten.</p>' +
          '<div class="flex"><button class="btn btn--primary" data-a="zumtransfer">Zum Transfermarkt</button></div>' +
          '</div>';
      }

      // Länderspielpause
      if (FM.national.pauseLaeuft(world)) {
        var weg = FM.national.abgestellte(world, club.id);
        html += '<div class="card"><div class="card__head"><h3>Länderspielpause</h3>' +
          '<span class="chip">' + weg.length + ' abgestellt</span></div>' +
          '<p class="muted">Der Ligabetrieb ruht. ' +
          (weg.length
            ? 'Unterwegs sind: ' + weg.map(function (x) {
              return esc(x.nachname) + ' (' + esc(x.nation) + ')';
            }).join(', ') + '. Sie kehren belastet zurück.'
            : 'Aus Ihrem Kader ist niemand nominiert – gute Gelegenheit, durchzuatmen.') +
          '</p></div>';
      }

      // Nächstes Spiel
      // Ein Testspiel ist kein Pflichtspiel - die Ueberschrift richtet
      // sich nach dem Wettbewerb.
      var istPflicht = naechstes && naechstes.wettbewerb !== 'test';
      html += '<div class="card"><div class="card__head"><h3>' +
        (istPflicht ? 'Nächstes Pflichtspiel' : 'Nächstes Spiel') + '</h3>';
      if (naechstes) html += '<span class="chip">' + esc(U.fmtDate(naechstes.tag, 'lang')) + ' · ' + esc(naechstes.zeit) + '</span>';
      html += '</div>';
      if (naechstes) {
        var heim = naechstes.heimId === club.id;
        var gegnerId = heim ? naechstes.gastId : naechstes.heimId;
        var gegner = world.vereine[gegnerId];
        var gTab = world.tabellenPlatz(gegnerId);
        var riv = D.rivalitaet(naechstes.heimId, naechstes.gastId);
        html += '<div class="flex flex--zwischen mb"><div class="flex">' +
          UI.wappen(gegner) + '<div><b style="font-size:16px">' + esc(gegner.name) + '</b>' +
          (riv ? ' <span class="derby-tag" title="Ein Derby wirkt stärker auf Stimmung und Moral als ein gewöhnliches Spiel.">' +
            esc(riv.name) + '</span>' : '') + '<br>' +
          '<small class="muted">' + (heim ? 'Heimspiel' : 'Auswärtsspiel') + ' · ' +
          esc(UI.wettbewerbName(world, naechstes)) +
          (naechstes.rundeName && naechstes.rundeName !== UI.wettbewerbName(world, naechstes)
            ? ' · ' + esc(naechstes.rundeName) : '') +
          '</small></div></div>';
        if (gTab) html += '<div class="rechts klein muted">Tabellenplatz ' + gTab.platz + '<br>' +
          UI.formPunkte(gTab.form) + '</div>';
        html += '</div>';
        html += '<div class="tiles">' +
          '<div class="tile"><span>Einsatzbereit</span><b>' +
          kader.filter(function (p) { return T.einsatzbereit(p, world, naechstes.wettbewerb); }).length +
          '</b><small>von ' + kader.length + '</small></div>' +
          '<div class="tile"><span>Formation</span><b style="font-size:16px">' +
          esc(world.taktikVon(club.id).formation) + '</b><small>Einspielgrad ' +
          Math.round(world.taktikVon(club.id).einspielgrad) + ' %</small></div>' +
          '<div class="tile"><span>Ø Frische</span><b>' +
          Math.round(U.avg(kader.filter(function (p) { return !p.verletzung; }).map(function (p) { return p.fitness; })) || 0) +
          ' %</b></div>' +
          '<div class="tile"><span>Ø Moral</span><b>' +
          Math.round(U.avg(kader.map(function (p) { return p.moral; })) || 0) + ' %</b></div>' +
          '</div>';
      } else {
        html += '<div class="leer">Kein weiteres Spiel angesetzt.</div>';
      }
      html += '</div>';

      // Letztes Spiel
      if (letztes && letztes.ergebnis) {
        var lHeim = letztes.heimId === club.id;
        var eTore = lHeim ? letztes.ergebnis.heimTore : letztes.ergebnis.gastTore;
        var gTore = lHeim ? letztes.ergebnis.gastTore : letztes.ergebnis.heimTore;
        var ausgang = eTore > gTore ? 'Sieg' : eTore === gTore ? 'Unentschieden' : 'Niederlage';
        html += '<div class="card"><div class="card__head"><h3>Letztes Spiel</h3>' +
          '<button class="btn btn--sm" data-a="bericht" data-id="' + esc(letztes.id) + '">Spielbericht</button></div>' +
          '<div class="flex flex--zwischen">' +
          '<div class="flex">' + UI.wappen(world.vereine[letztes.heimId], true) +
          '<span>' + esc(world.vereine[letztes.heimId].kurz) + '</span>' +
          '<b style="font-size:20px" class="mono">' + letztes.ergebnis.heimTore + ':' + letztes.ergebnis.gastTore + '</b>' +
          '<span>' + esc(world.vereine[letztes.gastId].kurz) + '</span>' +
          UI.wappen(world.vereine[letztes.gastId], true) + '</div>' +
          '<span class="chip ' + (eTore > gTore ? 'chip--gruen' : eTore === gTore ? '' : 'chip--rot') + '">' + ausgang + '</span>' +
          '</div></div>';
      }

      // Tabellenausschnitt
      if (eigen && !eigen.spiele) {
        html += '<div class="card"><div class="card__head"><h3>' + esc(liga.name) + '</h3>' +
          '<button class="btn btn--sm" data-a="tabelle">Ganze Tabelle</button></div>' +
          '<div class="leer">Die Tabelle füllt sich ab dem 1. Spieltag.</div></div>';
      } else if (eigen) {
        var von = Math.max(0, eigen.platz - 3);
        var bis = Math.min(tab.length, von + 6);
        html += '<div class="card"><div class="card__head"><h3>' + esc(liga.name) + '</h3>' +
          '<div class="flex">' + UI.serie(eigen.form) +
          '<button class="btn btn--sm" data-a="tabelle">Ganze Tabelle</button></div></div>' +
          UI.tabelle([
            { key: 'platz', label: '#', klasse: 'num', html: function (e) { return e.platz; } },
            { key: 'club', label: 'Verein', html: function (e) { return UI.vereinZelle(world, e.clubId); } },
            { key: 'sp', label: 'Sp', klasse: 'num', html: function (e) { return e.spiele; } },
            { key: 'diff', label: 'Diff', klasse: 'num', html: function (e) { return (e.tore - e.gegentore > 0 ? '+' : '') + (e.tore - e.gegentore); } },
            { key: 'pkt', label: 'Pkt', klasse: 'num', html: function (e) { return '<b>' + (e.punkte - e.punktabzug) + '</b>'; } },
            { key: 'form', label: 'Form', html: function (e) { return UI.formPunkte(e.form); } }
          ], tab.slice(von, bis), {
            zeilenKlasse: function (e) { return e.clubId === club.id ? 'tr-eigen' : ''; }
          }) + '</div>';
      }

      // Kaderprobleme
      var verletzt = kader.filter(function (p) { return p.verletzung; });
      var gesperrt = kader.filter(function (p) { return p.sperre > 0; });
      var muede = kader.filter(function (p) { return !p.verletzung && p.fitness < 62; });
      var unzufrieden = kader.filter(function (p) { return p.wechselwunsch > 55; });
      var auslaufend = kader.filter(function (p) { return p.vertrag && P.restlaufzeitMonate(p, world) <= 7; });

      html += '<div class="card"><h3>Was ansteht</h3>';
      var punkte = [];
      if (verletzt.length) punkte.push(['✚', verletzt.length + ' Spieler verletzt', verletzt.map(function (p) {
        return p.nachname + ' (' + UI.tage(p.verletzung.tage) + ')';
      }).join(', '), 'kader']);
      if (gesperrt.length) punkte.push(['⛔', gesperrt.length + ' Spieler gesperrt', gesperrt.map(function (p) {
        return p.nachname + ' (' + p.sperre + ')';
      }).join(', '), 'kader']);
      if (muede.length) punkte.push(['◷', muede.length + ' Spieler unter 62 % Frische',
        'Rotation oder ein schonender Trainingsplan wären sinnvoll.', 'training']);
      if (unzufrieden.length) punkte.push(['👥', unzufrieden.length + ' Spieler mit Wechselwunsch',
        unzufrieden.map(function (p) { return p.nachname; }).join(', '), 'kader']);
      if (auslaufend.length) punkte.push(['✎', auslaufend.length + ' Verträge laufen bald aus',
        auslaufend.map(function (p) { return p.nachname; }).join(', '), 'kader']);
      if (f.kontostand < 0) punkte.push(['€', 'Das Konto ist im Minus',
        'Die DFL verlangt einen Liquiditätsnachweis. Verkäufe oder ein Kredit könnten helfen.', 'finanzen']);
      if (!punkte.length) punkte.push(['✓', 'Alles im grünen Bereich', 'Keine dringenden Aufgaben.', null]);

      html += '<div>' + punkte.map(function (pt) {
        return '<div class="msg" ' + (pt[3] ? 'data-goto="' + pt[3] + '"' : '') + '>' +
          '<div class="msg__icon">' + pt[0] + '</div><div class="msg__body"><b>' + esc(pt[1]) + '</b>' +
          '<p>' + esc(pt[2]) + '</p></div></div>';
      }).join('') + '</div></div>';

      html += '</div>'; // linke Spalte

      // ---- rechte Spalte
      html += '<div class="grid">';

      // Vertrauen als Ringe – der Blick soll sofort erfassen, wo man steht.
      html += '<div class="card"><h3>Ihr Standing</h3>' +
        '<div class="flex" style="justify-content:space-around;margin:6px 0 4px">' +
        vertrauensRing('Vorstand', m.vorstandsvertrauen) +
        vertrauensRing('Fans', m.fanvertrauen) +
        vertrauensRing('Kabine', m.mannschaftsvertrauen) +
        '</div><div class="trenner"></div>' +
        zielFortschritt(world, eigen, liga) +
        '<div class="stat-row"><span>Vertrag bis</span><b>' + U.fmtDate(m.vertragBis) + '</b></div>' +
        '<div class="stat-row"><span>Bilanz als Trainer</span><b>' + m.bilanz.siege + 'S · ' +
        m.bilanz.remis + 'U · ' + m.bilanz.niederlagen + 'N</b></div>' +
        '</div>';

      html += '<div class="card"><div class="card__head"><h3>Finanzen</h3>' +
        '<button class="btn btn--sm" data-goto="finanzen">Details</button></div>' +
        '<div class="stat-row"><span>Kontostand</span><b class="' + (f.kontostand < 0 ? 'w-schlecht' : 'w-gut') + '">' + U.money(f.kontostand) + '</b></div>' +
        '<div class="stat-row"><span>Transferbudget</span><b>' + U.money(f.transferbudget) + '</b></div>' +
        '<div class="stat-row"><span>Gehaltsbudget</span><b>' + U.money(f.gehaltsbudget) + ' / Woche</b></div>' +
        '<div class="stat-row"><span>Lohnkosten</span><b>' + U.money(F.wochenLohnsumme(world, club.id)) + ' / Woche</b></div>' +
        '<div class="stat-row"><span>Kaderwert</span><b>' + U.money(U.sum(kader.map(function (p) { return p.marktwert; }))) + '</b></div>' +
        '</div>';

      var neueste = world.inbox.slice(0, 5);
      html += '<div class="card"><div class="card__head"><h3>Postfach</h3>' +
        '<button class="btn btn--sm" data-goto="medien">Alle</button></div>';
      html += neueste.length ? neueste.map(function (n) {
        return '<div class="msg' + (n.gelesen ? '' : ' msg--ungelesen') + '" data-msg="' + esc(n.id) + '">' +
          '<div class="msg__icon">' + UI.nachrichtIcon(n.typ) + '</div>' +
          '<div class="msg__body"><b>' + esc(n.titel) + '</b><p>' + esc(n.text.slice(0, 90)) + '…</p></div>' +
          '<div class="msg__datum">' + U.fmtDate(n.tag, 'kurz') + '</div></div>';
      }).join('') : '<div class="leer">Keine Nachrichten.</div>';
      html += '</div>';

      html += '</div></div>';
      return html;
    },
    nachher: function (container, world) {
      verdrahteAllgemein(container, world);
    }
  };

  function vertrauensRing(label, wert) {
    var v = Math.round(wert);
    return '<div style="text-align:center">' +
      UI.ring(v / 100, { groesse: 78, dicke: 7, text: '<b>' + v + '<small>%</small></b>' }) +
      '<div class="klein muted" style="margin-top:5px;font-weight:700">' + esc(label) + '</div></div>';
  }

  /**
   * Wie weit ist das Saisonziel erreicht? Der Balken vergleicht den
   * aktuellen Tabellenplatz mit der Vorgabe des Vorstands.
   */
  function zielFortschritt(world, eintrag, liga) {
    var ziel = world.manager.saisonziel;
    if (!ziel || !eintrag) {
      return '<div class="stat-row"><span>Saisonziel</span><b>' + esc(ziel ? ziel.text : '–') + '</b></div>';
    }
    // Vor dem 1. Spieltag sagt der Tabellenplatz nichts aus - dann nur die Vorgabe.
    if (!eintrag.spiele) {
      return '<div style="padding:7px 0">' +
        '<div class="flex flex--zwischen klein" style="margin-bottom:6px">' +
        '<span class="muted">Saisonziel</span>' +
        '<b class="w-mittel">' + esc(ziel.text) + '</b></div>' +
        '<div class="klein muted">Vorgabe: Platz ' + ziel.platz + ' - die Bilanz beginnt mit dem 1. Spieltag.</div></div>';
    }
    var teams = liga.teams.length;
    var anteil = U.clamp((teams - eintrag.platz) / Math.max(1, teams - ziel.platz), 0, 1);
    var erreicht = eintrag.platz <= ziel.platz;
    return '<div style="padding:7px 0">' +
      '<div class="flex flex--zwischen klein" style="margin-bottom:6px">' +
      '<span class="muted">Saisonziel</span>' +
      '<b class="' + (erreicht ? 'w-top' : 'w-mittel') + '">' + esc(ziel.text) + '</b></div>' +
      '<div class="progress"><i style="width:' + Math.round(anteil * 100) + '%"></i></div>' +
      '<div class="flex flex--zwischen klein muted" style="margin-top:5px">' +
      '<span>Platz ' + eintrag.platz + '</span>' +
      '<span>' + (erreicht ? 'im Plan' : 'Vorgabe: Platz ' + ziel.platz) + '</span></div></div>';
  }

  /** Wiederkehrende Klickziele: Nachrichten, Sprungmarken, Spielberichte. */
  function verdrahteAllgemein(container, world) {
    Array.prototype.forEach.call(container.querySelectorAll('[data-goto]'), function (e) {
      e.onclick = function () { UI.zeige(e.dataset.goto); };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-msg]'), function (e) {
      e.onclick = function () {
        var n = world.inbox.filter(function (x) { return x.id === e.dataset.msg; })[0];
        if (n) UI.zeigeNachricht(n);
      };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-a="bericht"]'), function (e) {
      e.onclick = function () { V.spielbericht(e.dataset.id); };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-a="tabelle"]'), function (e) {
      e.onclick = function () { UI.zeige('tabelle'); };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-a="zumtransfer"]'), function (e) {
      e.onclick = function () { UI.zeige('transfers'); };
    });
    Array.prototype.forEach.call(container.querySelectorAll('[data-spieler]'), function (e) {
      e.onclick = function (ev) {
        if (ev.target.closest('button') && ev.target.closest('button') !== e) return;
        V.spielerProfil(e.dataset.spieler);
      };
    });
  }
  V.verdrahteAllgemein = verdrahteAllgemein;

  // ============================================================ Kader

  // Die Schlüssel der Attributansichten müssen den Gruppen in
  // FM.data.ATTRIBUTE entsprechen.
  var KADER_ANSICHTEN = {
    allgemein: 'Übersicht',
    technisch: 'Technik',
    mental: 'Mentalität',
    physisch: 'Physis',
    torwart: 'Torwartspiel',
    vertrag: 'Verträge',
    leistung: 'Leistung'
  };

  UI.views.kader = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      var kader = world.kaderVon(club.id);
      z.modus = z.modus || 'allgemein';
      z.sortKey = z.sortKey || 'staerke';
      if (z.absteigend === undefined) z.absteigend = true;

      var gefiltert = kader.filter(function (p) {
        if (z.filterPos && D.POS_GRUPPE[p.pos] !== z.filterPos) return false;
        if (z.nurFit && (p.verletzung || p.sperre > 0)) return false;
        if (z.suche) {
          var t = (p.vorname + ' ' + p.nachname).toLowerCase();
          if (t.indexOf(z.suche.toLowerCase()) < 0) return false;
        }
        return true;
      });

      var html = '<div class="card__head"><h2>Kader<span class="nur-gross"> &middot; ' +
        esc(club.name) + '</span></h2>' +
        '<div class="flex"><button class="btn btn--sm" data-a="druck">Kaderbericht</button></div></div>';

      // Kennzahlen
      var ohneVerletzte = kader.filter(function (p) { return !p.verletzung; });
      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Spieler</span><b>' + kader.length + '</b><small>' +
        kader.filter(function (p) { return p.verletzung; }).length + ' verletzt, ' +
        kader.filter(function (p) { return p.sperre > 0; }).length + ' gesperrt</small></div>' +
        '<div class="tile"><span>Ø Stärke (beste 11)</span><b>' +
        U.num(U.avg(U.sortBy(kader.map(P.gesamt), function (x) { return -x; }).slice(0, 11)), 1) + '</b></div>' +
        '<div class="tile"><span>Ø Alter</span><b>' + U.num(U.avg(kader.map(function (p) { return p.alter; })), 1) + '</b></div>' +
        '<div class="tile"><span>Kaderwert</span><b>' + U.money(U.sum(kader.map(function (p) { return p.marktwert; }))) + '</b></div>' +
        '<div class="tile"><span>Lohnkosten</span><b>' + U.money(U.sum(kader.map(function (p) { return p.vertrag ? p.vertrag.gehalt : 0; }))) + '</b><small>pro Woche</small></div>' +
        '<div class="tile"><span>Eigengewächse</span><b>' + kader.filter(function (p) { return p.eigengewaechs; }).length + '</b></div>' +
        '</div>';

      // Filterleiste
      html += '<div class="filterleiste">' +
        '<div><label>Ansicht</label><select data-f="modus">' +
        Object.keys(KADER_ANSICHTEN).map(function (k) {
          return '<option value="' + k + '"' + (z.modus === k ? ' selected' : '') + '>' + esc(KADER_ANSICHTEN[k]) + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Mannschaftsteil</label><select data-f="filterPos">' +
        '<option value="">alle</option>' +
        ['TW', 'ABW', 'MIT', 'ANG'].map(function (g) {
          return '<option value="' + g + '"' + (z.filterPos === g ? ' selected' : '') + '>' + g + '</option>';
        }).join('') + '</select></div>' +
        '<div><label>Suche</label><input type="text" data-f="suche" value="' + esc(z.suche || '') + '" placeholder="Name"></div>' +
        '<div><label>&nbsp;</label><label class="flex klein" style="gap:6px"><input type="checkbox" data-f="nurFit" style="width:auto"' +
        (z.nurFit ? ' checked' : '') + '> nur einsatzbereit</label></div>' +
        '</div>';

      html += '<div class="card">' + kaderTabelle(world, gefiltert, z) + '</div>';
      return html;
    },
    nachher: function (container, world, z) {
      UI.filterBinden(container, 'kader', 'data-f');
      UI.tabelleSortierung(container, 'kader');
      verdrahteAllgemein(container, world);
      var druck = container.querySelector('[data-a="druck"]');
      if (druck) druck.onclick = function () { V.kaderbericht(); };
    }
  };

  /** Ehrungen, die ein Spieler im Laufe seiner Karriere gesammelt hat. */
  function ehrungKarte(p) {
    var liste = (p.ehrungen || []).slice().reverse();
    if (!liste.length) return '';
    return '<div class="card card--flat"><h4>Ehrungen</h4>' +
      liste.slice(0, 12).map(function (e) {
        return '<div class="stat-row"><span>' + e.saison + '/' + String(e.saison + 1).slice(2) +
          '</span><b class="klein">' + esc(e.titel) + '</b></div>';
      }).join('') + '</div>';
  }

  /**
   * Wie die eigene Elf im Vergleich zur Liga dasteht. Die Spielerskala
   * ("Bundesliga-Stammkraft") passt hier nicht: Sie beschreibt einen
   * einzelnen Spieler, nicht eine Mannschaft.
   */
  function elfEinordnung(world, club, staerke) {
    var liga = world.ligaVon(club.id);
    if (!liga) return 'Mannschaftsstärke';
    var werte = liga.teams.map(function (id) {
      var k = world.kaderVon(id);
      if (!k.length) return 0;
      var beste = U.sortBy(k, function (p) { return -P.gesamt(p); }).slice(0, 11);
      return U.avg(beste.map(function (p) { return P.gesamt(p); }));
    }).filter(function (v) { return v > 0; });
    if (!werte.length) return 'Mannschaftsstärke';
    var besser = werte.filter(function (v) { return v < staerke; }).length;
    var rang = werte.length - besser;
    var anteil = rang / werte.length;
    var wo = anteil <= 0.17 ? 'Spitze der Liga'
      : anteil <= 0.34 ? 'oberes Drittel'
        : anteil <= 0.67 ? 'Mittelfeld der Liga'
          : anteil <= 0.85 ? 'unteres Drittel'
            : rang < werte.length ? 'Abstiegsregion'
              : 'schwächster Kader der Liga';
    return wo + ' (' + rang + '. von ' + werte.length + ')';
  }

  /** Vorlagen sichern und verwalten. */
  function vorlagenDialog(world, taktik) {
    var vorlagen = world.taktikVorlagen || [];
    var html = '<h2>Taktik sichern</h2>' +
      '<p class="muted">Eine Vorlage hält fest, <b>wie</b> gespielt werden soll – Formation, ' +
      'Rollen und Anweisungen –, nicht mit wem. Die Aufstellung bleibt beim Anwenden erhalten, ' +
      'soweit die Positionen passen.</p>' +
      '<div><label>Name</label><input type="text" data-v="name" maxlength="24" value="' +
      esc(taktik.formation + ' ' + (D.ANWEISUNGEN && D.ANWEISUNGEN.mentalitaet
        ? (T.anweisung('mentalitaet', taktik.anweisungen.mentalitaet) || {}).name || ''
        : '')) + '"></div>' +
      '<div class="flex mt"><button class="btn btn--primary" data-a="ok">Sichern</button>' +
      '<button class="btn" data-a="ab">Abbrechen</button></div>';

    if (vorlagen.length) {
      html += '<div class="trenner"></div><h4>Gespeicherte Vorlagen</h4>' +
        vorlagen.map(function (v) {
          return '<div class="stat-row"><span>' + esc(v.name) + ' <span class="klein muted">' +
            esc(v.formation) + '</span></span>' +
            '<button class="btn btn--sm btn--ghost" data-del="' + esc(v.name) + '">löschen</button></div>';
        }).join('');
    }

    UI.modal(html, {
      nachher: function (body) {
        body.querySelector('[data-a="ab"]').onclick = UI.modalZu;
        body.querySelector('[data-a="ok"]').onclick = function () {
          var name = body.querySelector('[data-v="name"]').value;
          var v = T.vorlageSpeichern(world, taktik, name);
          UI.modalZu();
          UI.toast('Vorlage "' + v.name + '" gesichert.', 'gut');
          UI.zeichne();
        };
        Array.prototype.forEach.call(body.querySelectorAll('[data-del]'), function (b) {
          b.onclick = function () {
            T.vorlageLoeschen(world, b.dataset.del);
            UI.modalZu(); UI.zeichne(); UI.toast('Vorlage gelöscht.');
          };
        });
      }
    });
  }

  /** Die besonderen Eigenschaften eines Spielers als eigene Karte. */
  function merkmalKarte(p) {
    var liste = (p.merkmale || []).map(function (id) { return D.MERKMAL[id]; })
      .filter(Boolean);
    if (!liste.length) {
      return '<div class="card card--flat"><h4>Merkmale</h4>' +
        '<div class="leer">Keine besonderen Eigenschaften.</div></div>';
    }
    return '<div class="card card--flat"><h4>Merkmale</h4>' +
      liste.map(function (m) {
        return '<div class="merkmal' + (m.negativ ? ' merkmal--minus' : '') + '">' +
          '<b>' + esc(m.name) + '</b>' +
          '<span class="klein muted">' + esc(m.text) + '</span></div>';
      }).join('') + '</div>';
  }

  /**
   * Der Kaderstatus als Marke - eingefaerbt danach, ob das
   * Spielzeitversprechen gerade gehalten wird.
   */
  function rollenTag(world, p) {
    var r = P.rolleVon(p);
    var b = rollenBilanz(world, p);
    var klasse = b.stand === 'gebrochen' ? ' rollen-tag--rot'
      : b.stand === 'uebererfuellt' ? ' rollen-tag--gruen' : '';
    return '<span class="rollen-tag' + klasse + '" title="' + esc(b.text) + '">' + esc(r.kurz) + '</span>';
  }

  /**
   * Vergleicht die tatsaechliche Einsatzzeit mit dem Versprechen des
   * Kaderstatus. Vor dem fuenften Spieltag wird noch nicht geurteilt.
   */
  function rollenBilanz(world, p) {
    var r = P.rolleVon(p);
    var gespielt = p.clubId ? world.spieltageGespielt(p.clubId) : 0;
    var anteil = gespielt > 0 ? p.stats.minuten / (gespielt * 90) : 0;
    var soll = r.erwartung * (p.alter <= 20 ? 0.75 : 1);
    var txt = r.name + ' · versprochen etwa ' + Math.round(soll * 100) +
      ' % Einsatzzeit, tatsächlich ' + Math.round(anteil * 100) + ' %.';
    if (gespielt < 5) return { stand: 'offen', anteil: anteil, soll: soll, text: r.name + ' · ' + r.text };
    if (anteil < soll - 0.12) return { stand: 'gebrochen', anteil: anteil, soll: soll, text: txt + ' Der Spieler ist unzufrieden.' };
    if (anteil > soll + 0.15) return { stand: 'uebererfuellt', anteil: anteil, soll: soll, text: txt + ' Mehr als zugesagt.' };
    return { stand: 'erfuellt', anteil: anteil, soll: soll, text: txt };
  }

  /** Baut die Kadertabelle je nach gewählter Ansicht. */
  function kaderTabelle(world, kader, z) {
    var spalten = [
      { key: 'nummer', label: '#', klasse: 'num', wert: function (p) { return p.nummer; }, html: function (p) { return p.nummer || '–'; } },
      { key: 'name', label: 'Name', haft: true, wert: function (p) { return p.nachname; },
        html: function (p) {
          return '<span class="name">' + esc(p.nachname) + '</span> <span class="muted klein">' + esc(p.vorname) + '</span>' +
            (p.nationalelf ? ' <span class="natio-tag" title="Beim Nationalteam">NAT</span>' : '') +
            (p.zweitteam ? ' <span class="natio-tag natio-tag--u23" title="Spielt in der zweiten Mannschaft">U23</span>' : '');
        } },
      { key: 'pos', label: 'Pos', wert: function (p) { return D.POSITIONEN.indexOf(p.pos); }, html: function (p) { return UI.posTag(p.pos); } },
      { key: 'alter', label: 'Alter', klasse: 'num', wert: function (p) { return p.alter; }, html: function (p) { return p.alter; } }
    ];

    if (z.modus === 'allgemein') {
      spalten = spalten.concat([
        { key: 'nation', label: 'Nation', wert: function (p) { return p.nation; }, html: function (p) { return '<span class="klein muted">' + esc(p.nation) + '</span>'; } },
        { key: 'staerke', label: 'Stärke', klasse: 'num', titel: 'Aktuelle Spielstärke auf der Hauptposition',
          wert: function (p) { return P.gesamt(p); }, html: function (p) { return UI.wert(P.gesamt(p)); } },
        { key: 'potenzial', label: 'Pot', klasse: 'num', titel: 'Geschätztes Entwicklungspotenzial',
          wert: function (p) { return p.potenzial; }, html: function (p) { return UI.wert(p.potenzial); } },
        { key: 'form', label: 'Form', klasse: 'num', wert: function (p) { return p.form; },
          html: function (p) { return UI.balken(p.form / 100, p.form >= 60 ? '' : p.form >= 40 ? 'bar--gelb' : 'bar--rot'); } },
        { key: 'fitness', label: 'Frische', klasse: 'num', wert: function (p) { return p.fitness; }, html: function (p) { return UI.fitnessBalken(p); } },
        { key: 'kaderrolle', label: 'Kaderplan', titel: 'Kaderstatus: das Spielzeitversprechen an den Spieler',
          wert: function (p) { return D.KADERROLLEN.map(function (r) { return r.id; }).indexOf(p.kaderrolle); },
          html: function (p) { return rollenTag(world, p); } },
        { key: 'moral', label: 'Moral', klasse: 'num', wert: function (p) { return p.moral; },
          html: function (p) { return UI.balken(p.moral / 100, p.moral >= 60 ? '' : p.moral >= 40 ? 'bar--gelb' : 'bar--rot'); } },
        { key: 'wert', label: 'Marktwert', klasse: 'num', wert: function (p) { return p.marktwert; }, html: function (p) { return U.money(p.marktwert); } },
        { key: 'status', label: 'Hinweise', titel: 'Kapitänsbinde, Verletzung, Sperre, Vertragsende, Transferliste',
          html: function (p) { return UI.spielerStatus(world, p) || '<span class="muted">–</span>'; } }
      ]);
    } else if (z.modus === 'vertrag') {
      spalten = spalten.concat([
        { key: 'gehalt', label: 'Gehalt/Wo', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.gehalt : 0; },
          html: function (p) { return p.vertrag ? U.money(p.vertrag.gehalt) : '–'; } },
        { key: 'bis', label: 'Vertrag bis', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.bis : 0; },
          html: function (p) {
            if (!p.vertrag) return '–';
            var m = P.restlaufzeitMonate(p, world);
            return '<span class="' + (m <= 6 ? 'w-schlecht' : m <= 12 ? 'w-mittel' : '') + '">' + U.fmtDate(p.vertrag.bis) + '</span>';
          } },
        { key: 'rest', label: 'Rest', klasse: 'num', wert: function (p) { return P.restlaufzeitMonate(p, world); },
          html: function (p) { return P.restlaufzeitMonate(p, world) + ' M'; } },
        { key: 'klausel', label: 'Ausstiegsklausel', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.ausstiegsklausel : 0; },
          html: function (p) { return p.vertrag && p.vertrag.ausstiegsklausel ? U.money(p.vertrag.ausstiegsklausel) : '<span class="muted">keine</span>'; } },
        { key: 'wunsch', label: 'Wechselwunsch', klasse: 'num', wert: function (p) { return p.wechselwunsch; },
          html: function (p) { return UI.balken(p.wechselwunsch / 100, p.wechselwunsch > 55 ? 'bar--rot' : 'bar--gelb'); } },
        { key: 'wert', label: 'Marktwert', klasse: 'num', wert: function (p) { return p.marktwert; }, html: function (p) { return U.money(p.marktwert); } }
      ]);
    } else if (z.modus === 'leistung') {
      spalten = spalten.concat([
        { key: 'spiele', label: 'Sp', klasse: 'num', wert: function (p) { return p.stats.spiele; }, html: function (p) { return p.stats.spiele; } },
        { key: 'minuten', label: 'Min', klasse: 'num', wert: function (p) { return p.stats.minuten; }, html: function (p) { return U.num(p.stats.minuten); } },
        { key: 'tore', label: 'Tore', klasse: 'num', wert: function (p) { return p.stats.tore; }, html: function (p) { return p.stats.tore; } },
        { key: 'vorlagen', label: 'Vorl', klasse: 'num', wert: function (p) { return p.stats.vorlagen; }, html: function (p) { return p.stats.vorlagen; } },
        { key: 'xg', label: 'xG', klasse: 'num', wert: function (p) { return p.stats.xG; }, html: function (p) { return U.num(p.stats.xG, 1); } },
        { key: 'note', label: 'Ø Note', klasse: 'num', wert: function (p) { return P.schnitt(p.stats) || 9; },
          html: function (p) { return UI.noteZelle(P.schnitt(p.stats)); } },
        { key: 'karten', label: 'Karten', klasse: 'num', wert: function (p) { return p.stats.gelb * 2 + p.stats.rot * 10; },
          html: function (p) {
            var out = [];
            if (p.stats.gelb) out.push('<span class="chip chip--gelb">' + p.stats.gelb + '</span>');
            if (p.stats.gelbrot) out.push('<span class="chip chip--rot">GR' + p.stats.gelbrot + '</span>');
            if (p.stats.rot) out.push('<span class="chip chip--rot">R' + p.stats.rot + '</span>');
            return out.join(' ') || '<span class="muted">–</span>';
          } },
        { key: 'gelbeSaison', label: 'Gelb ges.', klasse: 'num', wert: function (p) { return p.gelbeSaison; },
          html: function (p) { return p.gelbeSaison ? (p.gelbeSaison % 5 === 4 ? '<span class="w-mittel">' + p.gelbeSaison + '</span>' : p.gelbeSaison) : '–'; } },
        { key: 'training', label: 'Training', klasse: 'num', wert: function (p) { return p.trainingsleistung; },
          html: function (p) { return UI.balken(p.trainingsleistung / 100); } }
      ]);
    } else {
      // Attributansichten
      var gruppe = D.ATTRIBUTE[z.modus] || D.ATTRIBUTE.technisch;
      spalten.push({ key: 'staerke', label: 'Stärke', klasse: 'num', wert: function (p) { return P.gesamt(p); },
        html: function (p) { return UI.wert(P.gesamt(p)); } });
      gruppe.keys.forEach(function (k) {
        spalten.push({
          key: k, label: kurzAttr(D.ATTR_NAME[k]), titel: D.ATTR_NAME[k], klasse: 'num',
          wert: function (p) { return p.attr[k]; },
          html: function (p) { return UI.wert(p.attr[k]); }
        });
      });
    }

    return UI.tabelle(spalten, kader, {
      sortKey: z.sortKey, absteigend: z.absteigend,
      zeilenKlasse: function () { return 'is-clickable'; },
      zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
      leerText: 'Kein Spieler entspricht dem Filter.'
    });
  }

  function kurzAttr(name) {
    if (name.length <= 8) return esc(name);
    return esc(name.slice(0, 7) + '.');
  }

  /**
   * Saison fuer Saison: wo hat er gespielt, was kam dabei heraus.
   * Die laufende Saison steht oben, damit man sie sofort einordnen kann.
   */
  function laufbahnKarte(world, p) {
    var alt = (p.saisonhistorie || []).slice();
    var zeilen = alt.slice().reverse();
    if (p.stats && p.stats.spiele) {
      var club = p.clubId ? world.vereine[p.clubId] : null;
      zeilen.unshift({
        s: world.saison, c: p.clubId, l: club ? club.liga : 0,
        sp: p.stats.spiele, st: p.stats.startelf, t: p.stats.tore, v: p.stats.vorlagen,
        n: P.schnitt(p.stats), zn: p.pos === 'TW' ? p.stats.zuNull : 0, laufend: true
      });
    }
    if (!zeilen.length) {
      return '<div class="card card--flat"><h4>Laufbahn</h4>' +
        '<div class="leer">Noch kein Pflichtspiel bestritten.</div></div>';
    }
    var tw = p.pos === 'TW';
    return '<div class="card card--flat"><h4>Laufbahn</h4>' +
      UI.tabelle([
        { key: 's', label: 'Saison', klasse: 'mono', html: function (e) {
          return e.s + '/' + String(e.s + 1).slice(2); } },
        { key: 'c', label: 'Verein', html: function (e) {
          var v = e.c ? world.vereine[e.c] : null;
          return (v ? esc(v.kurz) : '<span class="muted">–</span>') +
            (e.l ? ' <span class="muted klein">L' + e.l + '</span>' : ''); } },
        { key: 'sp', label: 'Sp', klasse: 'num', html: function (e) { return e.sp; } },
        { key: 'st', label: 'Elf', klasse: 'num', html: function (e) { return e.st; } },
        { key: 't', label: tw ? 'Zu Null' : 'Tore', klasse: 'num', html: function (e) {
          return '<b>' + (tw ? (e.zn || 0) : e.t) + '</b>'; } },
        { key: 'v', label: 'Vor', klasse: 'num', html: function (e) { return e.v; } },
        { key: 'n', label: 'Ø', klasse: 'num', html: function (e) { return e.n ? U.note(e.n) : '–'; } }
      ], zeilen, {
        zeilenKlasse: function (e) { return e.laufend ? 'tr-eigen' : ''; }
      }) + '</div>';
  }

  // ============================================================ Spielerprofil

  V.spielerProfil = function (spielerId, tab) {
    var world = UI.world;
    var p = world.spieler[spielerId];
    if (!p) return;
    var eigener = p.clubId === world.nutzerClubId;
    var club = p.clubId ? world.vereine[p.clubId] : null;
    var wissen = eigener ? 1 : p.scoutwissen;

    var html = '<div class="profil-kopf">' +
      '<div class="profil-kopf__haupt">' +
      '<h2>' + esc(p.vorname + ' ' + p.nachname) + (p.nummer ? ' <span class="muted">#' + p.nummer + '</span>' : '') + '</h2>' +
      '<div class="meta">' + esc(D.POS_NAME[p.pos]) +
      (p.nebenpos.length ? ' · auch ' + p.nebenpos.join(', ') : '') +
      ' · ' + p.alter + ' Jahre · ' + esc(p.nation) + ' · ' + esc(p.fuss) + 'er Fuß</div>' +
      '<div class="meta">' + (club ? esc(club.name) : 'vereinslos') +
      (p.leihe ? ' (Leihe von ' + esc(world.vereine[p.leihe.vonClubId] ? world.vereine[p.leihe.vonClubId].name : '?') + ')' : '') + '</div>' +
      '<div class="flex mt">' + (UI.spielerStatus(world, p) || '') + '</div>' +
      '</div>' +
      '<div class="tiles" style="min-width:280px">' +
      '<div class="tile"><span>Stärke</span><b>' + UI.wert(P.gesamt(p)) + '</b><small>' + esc(P.staerkeLabel(P.gesamt(p))) + '</small></div>' +
      '<div class="tile"><span>Potenzial</span><b>' + (wissen > 0.6 ? UI.wert(p.potenzial) : '<span class="muted">?</span>') + '</b>' +
      '<small>' + (wissen > 0.6 ? esc(P.staerkeLabel(p.potenzial)) : 'Scouting nötig') + '</small></div>' +
      '<div class="tile"><span>Marktwert</span><b style="font-size:15px">' + U.money(p.marktwert) + '</b></div>' +
      '<div class="tile"><span>Form</span><b>' + Math.round(p.form) + '</b><small>Frische ' + Math.round(p.fitness) + ' %</small></div>' +
      '</div></div>';

    if (wissen < 0.95) {
      html += '<div class="card card--flat mb klein"><b>Kenntnisstand: ' + Math.round(wissen * 100) + ' %.</b> ' +
        'Die Werte sind Schätzungen der Scoutingabteilung. Ein Beobachtungsauftrag verbessert die Angaben.</div>';
    }

    // Attribute
    html += '<div class="grid grid--2">';
    ['technisch', 'mental', 'physisch'].concat(p.pos === 'TW' ? ['torwart'] : []).forEach(function (g) {
      var gruppe = D.ATTRIBUTE[g];
      html += '<div class="card card--flat attr-gruppe"><h4>' + esc(gruppe.label) + '</h4><div class="attr-liste">';
      gruppe.keys.forEach(function (k) {
        var s = P.sichtbaresAttribut(p, k, wissen);
        var anzeige = s.sicher ? String(s.wert) : s.min + '–' + s.max;
        html += '<div class="attr-zeile"><span>' + esc(D.ATTR_NAME[k]) + '</span>' +
          UI.balken(s.wert / 99, s.wert >= 70 ? '' : s.wert >= 50 ? 'bar--gelb' : 'bar--rot') +
          '<b class="' + UI.wertKlasse(s.wert) + '">' + anzeige + '</b></div>';
      });
      html += '</div></div>';
    });

    // Persönlichkeit und Vertrag
    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
    html += '<div class="card card--flat"><h4>Person &amp; Vertrag</h4>' +
      '<div class="stat-row"><span>Persönlichkeit</span><b>' + esc(pers ? pers.name : '–') + '</b></div>' +
      '<div class="stat-row"><span>Verletzungsanfälligkeit</span><b>' +
      (p.verletzungsneigung > 66 ? '<span class="w-schlecht">hoch</span>' : p.verletzungsneigung > 40 ? '<span class="w-mittel">mittel</span>' : '<span class="w-gut">gering</span>') + '</b></div>' +
      (p.laenderspiele
        ? '<div class="stat-row"><span>Nationalmannschaft</span><b>' +
          U.pl(p.laenderspiele, 'Einsatz', 'Einsätze') +
          (p.laendertore ? ', ' + U.pl(p.laendertore, 'Tor', 'Tore') : '') + '</b></div>'
        : '') +
      (p.nationalelf
        ? '<div class="stat-row"><span>Aktuell</span><b class="w-mittel">bei der Nationalmannschaft</b></div>'
        : '') +
      (p.vorvertrag
        ? '<div class="stat-row"><span>Vorvertrag</span><b class="w-mittel">' +
          esc((world.vereine[p.vorvertrag.clubId] || {}).name || '?') + ' ab ' +
          esc(U.fmtDate(p.vorvertrag.ab)) + '</b></div>'
        : '') +
      (p.zweitteam
        ? '<div class="stat-row"><span>Zweite Mannschaft</span><b>' +
          U.pl((p.u23 && p.u23.spiele) || 0, 'Spiel', 'Spiele') +
          (p.u23 && p.u23.tore ? ', ' + U.pl(p.u23.tore, 'Tor', 'Tore') : '') + '</b></div>'
        : '') +
      (p.umschulung
        ? '<div class="stat-row"><span>Umschulung</span><b>' +
          esc(D.POS_NAME[p.umschulung.pos] || p.umschulung.pos) + ' · ' +
          Math.round(P.umschulungsStand(p) * 100) + ' %</b></div>'
        : '');
    if (p.vertrag) {
      html += '<div class="stat-row"><span>Gehalt</span><b>' + U.money(p.vertrag.gehalt) + ' / Woche</b></div>' +
        '<div class="stat-row"><span>Vertrag bis</span><b>' + U.fmtDate(p.vertrag.bis) +
        ' (' + P.restlaufzeitMonate(p, world) + ' Monate)</b></div>';
      if (p.vertrag.ausstiegsklausel) {
        html += '<div class="stat-row"><span>Ausstiegsklausel</span><b>' + U.money(p.vertrag.ausstiegsklausel) + '</b></div>';
      }
      html += '<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.045)">' +
        '<div class="klein muted" style="margin-bottom:4px">Prämien je Einsatz / Tor / Sieg</div>' +
        '<b class="klein">' + U.money(p.vertrag.praemien.einsatz) + ' · ' +
        U.money(p.vertrag.praemien.tor) + ' · ' + U.money(p.vertrag.praemien.sieg) + '</b></div>';
    } else {
      html += '<div class="stat-row"><span>Vertrag</span><b class="w-gut">ablösefrei verfügbar</b></div>';
    }
    if (eigener) {
      var bil = rollenBilanz(world, p);
      html += '<div class="stat-row"><span>Kaderstatus</span>' +
        '<select data-rolle="' + p.id + '" style="width:auto">' +
        D.KADERROLLEN.map(function (r) {
          return '<option value="' + r.id + '"' + (p.kaderrolle === r.id ? ' selected' : '') +
            '>' + esc(r.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="klein ' + (bil.stand === 'gebrochen' ? 'w-schlecht' : bil.stand === 'uebererfuellt' ? 'w-gut' : 'muted') +
        '" style="padding:0 0 8px">' + esc(bil.text) + '</div>';
      html += '<div class="stat-row"><span>Unzufriedenheit</span><b class="klein">Spielzeit ' +
        Math.round(p.unzufriedenheit.spielzeit) + ' · Gehalt ' + Math.round(p.unzufriedenheit.gehalt) +
        ' · Ambition ' + Math.round(p.unzufriedenheit.ambition) + '</b></div>';
    }
    html += '</div>';

    // Merkmale
    html += merkmalKarte(p);

    // Ehrungen
    html += ehrungKarte(p);

    // Statistik
    html += '<div class="card card--flat"><h4>Saison &amp; Karriere</h4>' +
      statZeile('Spiele', p.stats.spiele, p.karriere.spiele) +
      statZeile('Startelf', p.stats.startelf, p.karriere.startelf) +
      statZeile('Minuten', U.num(p.stats.minuten), U.num(p.karriere.minuten)) +
      statZeile('Tore', p.stats.tore, p.karriere.tore) +
      statZeile('Vorlagen', p.stats.vorlagen, p.karriere.vorlagen) +
      statZeile('Ø Note', P.schnitt(p.stats) ? U.note(P.schnitt(p.stats)) : '–', P.schnitt(p.karriere) ? U.note(P.schnitt(p.karriere)) : '–') +
      statZeile('Gelbe Karten', p.stats.gelb, p.karriere.gelb) +
      (p.pos === 'TW' ? statZeile('Zu-Null-Spiele', p.stats.zuNull, p.karriere.zuNull) : '') +
      '</div>';
    html += '</div>';

    // Laufbahn: Saison fuer Saison
    html += laufbahnKarte(world, p);

    // Aktionen
    if (eigener) {
      html += '<div class="trenner"></div><div class="flex">' +
        '<button class="btn" data-a="gespraech">Gespräch führen</button>' +
        '<button class="btn" data-a="vertrag">Vertrag verhandeln</button>' +
        '<button class="btn" data-a="fokus">Individualtraining</button>' +
        '<button class="btn" data-a="vergleich">Vergleichen</button>' +
        (p.pos !== 'TW' ? '<button class="btn" data-a="umschulung">' +
          (p.umschulung ? 'Umschulung läuft' : 'Position umschulen') + '</button>' : '') +
        '<button class="btn" data-a="transferliste">' + (p.transferliste ? 'Von Transferliste nehmen' : 'Auf Transferliste setzen') + '</button>' +
        '<button class="btn" data-a="leihliste">' + (p.leihliste ? 'Nicht mehr verleihen' : 'Zum Verleih anbieten') + '</button>' +
        (!p.leihe && FM.kooperation.partnerVon(world, world.nutzerClubId)
          .some(function (k) { return k.clubId === world.nutzerClubId; })
          ? '<button class="btn" data-a="partnerleihe">Zum Partner verleihen</button>' : '') +
        '</div>';
    } else {
      html += '<div class="trenner"></div><div class="flex">' +
        '<button class="btn btn--primary" data-a="angebot">' + (p.clubId ? 'Angebot abgeben' : 'Vertrag anbieten') + '</button>' +
        (FM.transfers.vorvertragMoeglich(world, p)
          ? '<button class="btn" data-a="vorvertrag" title="Sein Vertrag läuft im Sommer aus">Vorvertrag anbieten</button>' : '') +
        '<button class="btn" data-a="scouten">Beobachten lassen</button>' +
        '<button class="btn" data-a="vergleich">Vergleichen</button>' +
        '<button class="btn" data-a="merken">' + (world.transfer.beobachtet.indexOf(p.id) >= 0 ? 'Von Merkliste entfernen' : 'Auf Merkliste') + '</button>' +
        '</div>';
    }

    UI.modal(html, {
      breit: true,
      nachher: function (body) {
        function bind(a, fn) {
          var b = body.querySelector('[data-a="' + a + '"]');
          if (b) b.onclick = fn;
        }
        var rw = body.querySelector('[data-rolle]');
        if (rw) rw.onchange = function () {
          var r = P.setzeKaderrolle(p, rw.value, world);
          if (!r) return;
          UI.toast(p.nachname + ': ' + r.neu.name + '.', r.sprung >= 0 ? 'gut' : '');
          UI.modalZu(); UI.zeichne(); V.spielerProfil(p.id);
        };
        bind('gespraech', function () { V.gespraechsDialog(p.id); });
        bind('vertrag', function () { V.vertragsDialog(p.id); });
        bind('fokus', function () { V.fokusDialog(p.id); });
        bind('umschulung', function () { V.umschulungsDialog(p.id); });
        bind('vergleich', function () { V.vergleich(p.id); });
        bind('partnerleihe', function () {
          var partner = FM.kooperation.partnerVon(world, world.nutzerClubId)
            .filter(function (k) { return k.clubId === world.nutzerClubId; });
          if (!partner.length) return;
          if (partner.length === 1) {
            var r = FM.kooperation.leiheZumPartner(world, p.id, partner[0].partnerId);
            if (r.fehler) UI.toast(r.fehler, 'fehler');
            else UI.toast(r.name + ' spielt bis zum Saisonende bei ' + r.partner + '.', 'gut');
            UI.modalZu(); UI.zeichne();
            return;
          }
          UI.modal('<h2>Zu welchem Partner?</h2><div class="optionen">' +
            partner.map(function (k) {
              return '<button class="option" data-pl="' + esc(k.partnerId) + '"><b>' +
                esc(world.vereine[k.partnerId].name) + '</b></button>';
            }).join('') + '</div>', {
            nachher: function (body) {
              Array.prototype.forEach.call(body.querySelectorAll('[data-pl]'), function (b) {
                b.onclick = function () {
                  var r = FM.kooperation.leiheZumPartner(world, p.id, b.dataset.pl);
                  if (r.fehler) UI.toast(r.fehler, 'fehler');
                  else UI.toast(r.name + ' spielt bis zum Saisonende bei ' + r.partner + '.', 'gut');
                  UI.modalZu(); UI.zeichne();
                };
              });
            }
          });
        });
        bind('transferliste', function () {
          p.transferliste = !p.transferliste;
          UI.toast(p.transferliste ? p.nachname + ' steht auf der Transferliste.' : 'Von der Transferliste genommen.');
          UI.modalZu(); UI.zeichne();
        });
        bind('leihliste', function () {
          p.leihliste = !p.leihliste;
          UI.toast(p.leihliste ? p.nachname + ' wird zum Verleih angeboten.' : 'Nicht mehr zum Verleih angeboten.');
          UI.modalZu(); UI.zeichne();
        });
        bind('angebot', function () { V.angebotsDialog(p.id); });
        bind('vorvertrag', function () { V.vertragsDialog(p.id, true, true); });
        bind('scouten', function () {
          var r = FM.transfers.scoutAuftragAnlegen(world, world.nutzerClubId, { spielerId: p.id });
          if (r.fehler) UI.toast(r.fehler, 'fehler');
          else { UI.toast('Scout beauftragt. Bericht in etwa 10 Tagen.', 'gut'); UI.modalZu(); }
        });
        bind('merken', function () {
          var i = world.transfer.beobachtet.indexOf(p.id);
          if (i >= 0) world.transfer.beobachtet.splice(i, 1);
          else world.transfer.beobachtet.push(p.id);
          UI.toast(i >= 0 ? 'Von der Merkliste entfernt.' : 'Auf die Merkliste gesetzt.');
          UI.modalZu(); UI.zeichne();
        });
        if (tab === 'gespraech') V.gespraechsDialog(p.id);
      }
    });
  };

  function statZeile(label, saison, karriere) {
    return '<div class="stat-row"><span>' + esc(label) + '</span><b>' + saison +
      ' <span class="muted klein">/ ' + karriere + '</span></b></div>';
  }

  // ============================================================ Taktik

  // Kurzformen der Rollen für die Anzeige auf dem Spielfeld.
  var ROLLE_KURZ = {
    tw_klassisch: 'TW', tw_mitspielend: 'MITSP', tw_linie: 'LINIE',
    iv_klassisch: 'IV', iv_aufbau: 'AUFBAU', iv_libero: 'LIBERO', iv_zerstoerer: 'ZERST', iv_vorstoss: 'VORST',
    av_klassisch: 'AV', av_offensiv: 'OFF-AV', av_fluegel: 'FLÜGEL', av_invers: 'INVERS', av_defensiv: 'DEF-AV',
    dm_abraeumer: 'ABRÄUM', dm_regista: 'REGISTA', dm_b2b: 'BOX2BOX', dm_anker: 'ANKER',
    zm_allrounder: 'ALLROUND', zm_achter: 'ACHTER', zm_spielmacher: 'SPIELM', zm_arbeiter: 'ARBEIT',
    om_spielmacher: 'SPIELM', om_schatten: 'SCHATTEN', om_freigeist: 'FREIGEIST',
    am_klassisch: 'AUSSEN', am_defensiv: 'DEF-AUS', am_offensiv: 'OFF-AUS',
    fl_fluegel: 'FLÜGEL', fl_invers: 'INVERS', fl_vorbereiter: 'VORBER', fl_arbeitstier: 'ARBEIT',
    st_mittel: 'MITTELST', st_ziel: 'ZIELSP', st_wand: 'WANDSP', st_falsche9: 'FALSCHE 9',
    st_tiefe: 'TIEFE', st_presser: 'PRESSING'
  };

  function rolleKurz(r) {
    return ROLLE_KURZ[r.id] || r.name.slice(0, 7).toUpperCase();
  }

  /** Formpfeil aus Form und den letzten Noten. */
  function formPfeil(p) {
    var noten = p.letzteNoten.slice(-4);
    var tendenz = p.form;
    if (noten.length >= 2) tendenz += (3.5 - U.avg(noten)) * 14;
    if (tendenz >= 68) return '<span class="w-top">▲</span>';
    if (tendenz >= 52) return '<span class="w-gut">▲</span>';
    if (tendenz >= 40) return '<span class="muted">▬</span>';
    return '<span class="w-schlecht">▼</span>';
  }

  function eignungPunkt(wert) {
    var k = wert >= 0.9 ? 'top' : wert >= 0.62 ? 'ok' : 'schlecht';
    return '<span class="eignung eignung--' + k + '" title="' + esc(T.eignungText(wert)) + '"></span>';
  }

  UI.views.taktik = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      var taktik = world.taktikVon(club.id);
      var f = T.formation(taktik);
      var probleme = T.pruefeAufstellung(world, club, taktik);
      var naechstes = world.naechstesSpiel(club.id);
      var gegnerId = naechstes ? (naechstes.heimId === club.id ? naechstes.gastId : naechstes.heimId) : null;
      var heim = naechstes ? naechstes.heimId === club.id : true;

      var elf = taktik.aufstellung.map(function (id) { return id ? world.spieler[id] : null; });
      var vorhanden = elf.filter(Boolean);

      // Eigene Mannschaftswerte und die des nächsten Gegners
      var werte = T.bewerteMannschaft({
        world: world, club: club, taktik: taktik, heim: heim && !!naechstes,
        stimmung: 0.8, staffBonus: world.staffBonus(club.id, 'taktik')
      });
      var analyse = gegnerId ? T.gegneranalyse(world, club.id, gegnerId) : null;

      // Wie weit ist die aktuelle Elf von der bestmöglichen entfernt?
      var beste = bestmoeglicheElf(world, club, taktik, naechstes);

      var html = '<div class="card__head"><h2>Aufstellung &amp; Taktik</h2><div class="flex">' +
        '<button class="btn btn--sm" data-a="auto">Beste Elf</button>' +
        '<button class="btn btn--sm" data-a="standards">Standards neu vergeben</button>' +
        '</div></div>';

      // ---- Kennzahlen
      var elfStaerke = vorhanden.length
        ? U.avg(vorhanden.map(function (p, i) {
          var idx = taktik.aufstellung.indexOf(p.id);
          return P.posStaerke(p, f.slots[idx >= 0 ? idx : 0].pos);
        })) : 0;
      var diff = elfStaerke - beste.staerke;
      var probleme11 = vorhanden.filter(function (p) {
        return p.verletzung || p.sperre > 0 || p.fitness < 62;
      }).length;

      html += '<div class="tiles mb">' +
        kachel('Stärke der Elf', U.num(elfStaerke, 1), elfEinordnung(world, club, elfStaerke),
          elfStaerke >= 68 ? 'gut' : elfStaerke >= 52 ? '' : 'warn') +
        kachel('Gegenüber der besten Elf', (diff >= -0.05 ? '±0' : U.num(diff, 1)),
          diff >= -0.05 ? 'optimal besetzt' : 'Luft nach oben', diff >= -0.05 ? 'gut' : 'warn') +
        kachel('Einspielgrad', Math.round(taktik.einspielgrad) + ' %',
          taktik.einspielgrad >= 75 ? 'eingespielt' : taktik.einspielgrad >= 50 ? 'wächst' : 'neu formiert',
          taktik.einspielgrad >= 75 ? 'gut' : taktik.einspielgrad >= 50 ? '' : 'warn') +
        kachel('Ø Frische', Math.round(U.avg(vorhanden.map(function (p) { return p.fitness; })) || 0) + ' %',
          '', U.avg(vorhanden.map(function (p) { return p.fitness; })) >= 80 ? 'gut' : 'warn') +
        kachel('Ø Moral', Math.round(U.avg(vorhanden.map(function (p) { return p.moral; })) || 0) + ' %', '') +
        kachel('Angeschlagen', String(probleme11), probleme11 ? 'prüfen' : 'alles bereit',
          probleme11 ? 'schlecht' : 'gut') +
        '</div>';

      html += '<div class="taktik-layout">';

      // ================= Spielfeld =================
      html += '<div class="grid">';
      var vorlagen = world.taktikVorlagen || [];
      html += '<div class="card"><div class="card__head"><h3>Aufstellung</h3>' +
        '<div class="flex">' +
        '<select data-f="vorlage" style="width:auto;max-width:170px" title="Gespeicherte Taktiken">' +
        '<option value="">Vorlage …</option>' +
        vorlagen.map(function (v) {
          return '<option value="' + esc(v.name) + '">' + esc(v.name) + ' (' + esc(v.formation) + ')</option>';
        }).join('') +
        '</select>' +
        '<button class="btn btn--sm btn--ghost" data-a="vorlage-neu" title="Formation, Rollen und Anweisungen als Vorlage sichern">Sichern</button>' +
        '<select data-f="formation" style="width:auto;max-width:170px">' +
        Object.keys(D.FORMATIONEN).map(function (k) {
          return '<option value="' + esc(k) + '"' + (taktik.formation === k ? ' selected' : '') + '>' + esc(k) + '</option>';
        }).join('') + '</select></div></div>';
      html += '<p class="klein muted" style="margin-top:-6px">' + esc(f.beschreibung) + '</p>';

      html += '<div class="pitch"><div class="pitch__linien">' +
        '<i class="pitch__strafraum--o"></i><i class="pitch__strafraum--u"></i>' +
        '<i class="pitch__fuenfer--o"></i><i class="pitch__fuenfer--u"></i>' +
        '<i class="pitch__mittellinie"></i><i class="pitch__kreis"></i></div>';

      f.slots.forEach(function (slot, i) {
        html += spotHtml(world, club, taktik, f, i, z);
      });
      html += '</div>';

      if (probleme.length) {
        html += '<div class="mt klein" style="color:var(--red)">' +
          probleme.map(function (t) { return '⚠ ' + esc(t); }).join('<br>') + '</div>';
      }
      html += '<div class="flex klein muted mt" style="gap:14px">' +
        '<span><span class="eignung eignung--top"></span> Stammposition</span>' +
        '<span><span class="eignung eignung--ok"></span> geeignet</span>' +
        '<span><span class="eignung eignung--schlecht"></span> fachfremd</span>' +
        '<span>Ring = Frische</span></div>';
      html += '</div>';

      // ---- Mannschaftsteile im Vergleich
      html += '<div class="card"><div class="card__head"><h3>Mannschaftsteile</h3>' +
        (analyse ? '<span class="chip chip--gelb">Marke = ' + esc(analyse.club.kurz) + '</span>' : '') +
        '</div><div class="teile">' +
        teilBalken('Torwart', werte.tw, analyse ? analyse.werte.tw : null) +
        teilBalken('Abwehr', werte.def, analyse ? analyse.werte.def : null) +
        teilBalken('Mittelfeld', werte.mid, analyse ? analyse.werte.mid : null) +
        teilBalken('Angriff', werte.att, analyse ? analyse.werte.att : null) +
        '</div>';
      html += '<div class="trenner"></div>';
      html += '<div class="grid grid--3" style="gap:8px">' +
        merkmal('Kreativität', werte.kreativ / 110) +
        merkmal('Kopfballstärke', werte.kopfball / 110) +
        merkmal('Tempo', werte.tempo / 110) +
        merkmal('Konterwucht', werte.konter / 90) +
        merkmal('Pressing', werte.pressing / 90) +
        merkmal('Spielaufbau', werte.aufbau / 220) +
        '</div></div>';

      html += '</div>'; // linke Spalte

      // ================= rechte Spalte =================
      html += '<div class="grid">';

      // Slotauswahl
      if (z.gewaehlterSlot !== undefined && z.gewaehlterSlot !== null && f.slots[z.gewaehlterSlot]) {
        html += slotPanel(world, club, taktik, f, z);
      }

      // Anweisungen
      html += '<div class="card"><h3>Mannschaftsanweisungen</h3><div class="anweisungen">';
      Object.keys(D.ANWEISUNGEN).forEach(function (kat) {
        var a = D.ANWEISUNGEN[kat];
        var aktiv = a.werte.filter(function (w) { return w.id === taktik.anweisungen[kat]; })[0] || a.werte[0];
        html += '<div><label>' + esc(a.label) + '</label><select data-anw="' + esc(kat) + '">' +
          a.werte.map(function (w) {
            return '<option value="' + esc(w.id) + '"' + (taktik.anweisungen[kat] === w.id ? ' selected' : '') +
              '>' + esc(w.name) + '</option>';
          }).join('') + '</select>' +
          '<div class="klein muted" style="margin-top:4px">' + esc(anweisungsWirkung(kat, aktiv)) + '</div></div>';
      });
      html += '</div></div>';

      // Gegneranalyse
      if (analyse) html += analysePanel(world, analyse, naechstes, heim);

      // Standards und Kapitän
      var elfIds = taktik.aufstellung.filter(Boolean);
      function auswahl(key, label) {
        return '<div><label>' + esc(label) + '</label><select data-std="' + key + '">' +
          '<option value="">–</option>' +
          elfIds.map(function (id) {
            var sp = world.spieler[id];
            if (!sp) return '';
            var gut = key === 'elfmeter' ? sp.attr.elfmeter
              : key === 'einwurf' ? sp.attr.kraft : sp.attr.standards;
            return '<option value="' + esc(id) + '"' + (taktik.standards[key] === id ? ' selected' : '') +
              '>' + esc(sp.nachname) + ' (' + gut + ')</option>';
          }).join('') + '</select></div>';
      }
      html += '<div class="card"><h3>Standards &amp; Führung</h3><div class="anweisungen">' +
        auswahl('elfmeter', 'Elfmeter') + auswahl('freistoss', 'Freistöße') +
        auswahl('ecken', 'Eckbälle') + auswahl('einwurf', 'Weite Einwürfe') +
        '<div><label>Kapitän</label><select data-std="kapitaen">' +
        U.sortBy(world.kaderVon(club.id), function (sp) { return -sp.attr.fuehrung; }).map(function (sp) {
          return '<option value="' + esc(sp.id) + '"' + (taktik.kapitaen === sp.id ? ' selected' : '') +
            '>' + esc(sp.nachname) + ' · Führung ' + sp.attr.fuehrung + '</option>';
        }).join('') + '</select></div>' +
        '</div></div>';

      // Bank
      html += '<div class="card"><div class="card__head"><h3>Ersatzbank</h3>' +
        '<span class="chip' + (taktik.bank.length >= 7 ? ' chip--gruen' : ' chip--gelb') + '">' +
        taktik.bank.length + ' / 9</span></div>' +
        UI.tabelle([
          { key: 'n', label: 'Spieler', html: function (p) {
            return '<span class="name">' + esc(p.nachname) + '</span>'; } },
          { key: 'p', label: 'Pos', html: function (p) { return UI.posTag(p.pos); } },
          { key: 's', label: 'Stärke', klasse: 'num', html: function (p) { return UI.wert(P.gesamt(p)); } },
          { key: 'fo', label: 'Form', klasse: 'num', html: function (p) { return formPfeil(p); } },
          { key: 'fr', label: 'Frische', klasse: 'num', html: function (p) { return UI.fitnessBalken(p); } },
          { key: 'x', label: '', klasse: 'num', html: function (p) {
            return '<button class="btn btn--sm btn--ghost" data-bank-raus="' + esc(p.id) + '">✕</button>'; } }
        ], taktik.bank.map(function (id) { return world.spieler[id]; }).filter(Boolean), {
          leerText: 'Niemand auf der Bank.'
        }) +
        '<div class="mt"><label>Spieler auf die Bank setzen</label><select data-bank-rein>' +
        '<option value="">auswählen…</option>' +
        U.sortBy(world.kaderVon(club.id).filter(function (p) {
          return elfIds.indexOf(p.id) < 0 && taktik.bank.indexOf(p.id) < 0 &&
            T.einsatzbereit(p, world, naechstes ? naechstes.wettbewerb : null);
        }), function (p) { return -P.gesamt(p); }).map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.nachname) + ' · ' + p.pos +
            ' · Stärke ' + Math.round(P.gesamt(p)) + '</option>';
        }).join('') + '</select></div></div>';

      html += '</div></div>';
      return html;
    },

    nachher: function (container, world, z) {
      var club = world.nutzerVerein();
      var taktik = world.taktikVon(club.id);
      var naechstes = world.naechstesSpiel(club.id);

      Array.prototype.forEach.call(container.querySelectorAll('[data-slot]'), function (e) {
        e.onclick = function () {
          var i = parseInt(e.dataset.slot, 10);
          var geoeffnet = z.gewaehlterSlot !== i;
          z.gewaehlterSlot = geoeffnet ? i : null;
          UI.zeichne();
          // Auf schmalen Bildschirmen steht das Positionsdetail unterhalb
          // des Spielfelds – ohne Sprung dorthin sähe es aus, als sei nichts
          // passiert.
          if (geoeffnet && UI.schmal()) {
            var panel = UI.el('content').querySelector('[data-slotpanel]');
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-setz]'), function (e) {
        e.onclick = function () {
          var id = e.dataset.setz;
          var ziel = z.gewaehlterSlot;
          var alterSlot = taktik.aufstellung.indexOf(id);
          if (alterSlot >= 0) {
            taktik.aufstellung[alterSlot] = taktik.aufstellung[ziel];
          } else {
            var verdraengt = taktik.aufstellung[ziel];
            taktik.bank = taktik.bank.filter(function (b) { return b !== id; });
            if (verdraengt && taktik.bank.length < 9) taktik.bank.unshift(verdraengt);
          }
          taktik.aufstellung[ziel] = id;
          UI.zeichne();
          UI.toast(world.spieler[id].nachname + ' aufgestellt.', 'gut');
        };
      });
      var vsel = container.querySelector('[data-f="vorlage"]');
      if (vsel) vsel.onchange = function () {
        var name = vsel.value;
        if (!name) return;
        var v = (world.taktikVorlagen || []).filter(function (x) { return x.name === name; })[0];
        if (!v) return;
        T.vorlageAnwenden(taktik, v);
        z.gewaehlterSlot = null;
        UI.zeichne();
        UI.toast('Vorlage "' + name + '" angewendet.', 'gut');
      };
      var vneu = container.querySelector('[data-a="vorlage-neu"]');
      if (vneu) vneu.onclick = function () { vorlagenDialog(world, taktik); };

      var fsel = container.querySelector('[data-f="formation"]');
      if (fsel) fsel.onchange = function () {
        T.setzeFormation(taktik, fsel.value);
        z.gewaehlterSlot = null;
        UI.zeichne();
        UI.toast('Umgestellt auf ' + fsel.value + '. Der Einspielgrad sinkt zunächst.');
      };
      var rsel = container.querySelector('[data-f="rolle"]');
      if (rsel) rsel.onchange = function () {
        taktik.rollen[z.gewaehlterSlot] = rsel.value;
        UI.zeichne();
      };
      Array.prototype.forEach.call(container.querySelectorAll('[data-anw]'), function (e) {
        e.onchange = function () {
          taktik.anweisungen[e.dataset.anw] = e.value;
          UI.zeichne();
        };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-std]'), function (e) {
        e.onchange = function () {
          if (e.dataset.std === 'kapitaen') {
            world.kaderVon(club.id).forEach(function (p) { p.kapitaen = p.id === e.value; });
            taktik.kapitaen = e.value;
          } else {
            taktik.standards[e.dataset.std] = e.value || null;
          }
          UI.zeichne();
        };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-bank-raus]'), function (e) {
        e.onclick = function () {
          taktik.bank = taktik.bank.filter(function (b) { return b !== e.dataset.bankRaus; });
          UI.zeichne();
        };
      });
      var brein = container.querySelector('[data-bank-rein]');
      if (brein) brein.onchange = function () {
        if (brein.value && taktik.bank.length < 9) taktik.bank.push(brein.value);
        UI.zeichne();
      };
      var auto = container.querySelector('[data-a="auto"]');
      if (auto) auto.onclick = function () {
        T.autoAufstellung(world, club, taktik, { wettbewerb: naechstes ? naechstes.wettbewerb : null });
        z.gewaehlterSlot = null;
        UI.zeichne();
        UI.toast('Beste verfügbare Elf aufgestellt.', 'gut');
      };
      var std = container.querySelector('[data-a="standards"]');
      if (std) std.onclick = function () {
        T.setzeStandardschuetzen(world, taktik);
        UI.zeichne();
        UI.toast('Standardschützen neu bestimmt.');
      };
      var zu = container.querySelector('[data-a="slotzu"]');
      if (zu) zu.onclick = function () { z.gewaehlterSlot = null; UI.zeichne(); };
    }
  };

  function kachel(label, wert, unter, art) {
    return '<div class="tile' + (art ? ' tile--' + art : '') + '"><span>' + esc(label) + '</span>' +
      '<b>' + wert + '</b>' + (unter ? '<small>' + esc(unter) + '</small>' : '') + '</div>';
  }

  function teilBalken(name, wert, gegner) {
    var anteil = U.clamp(wert / 100, 0, 1);
    return '<div class="teil"><span class="teil__name">' + esc(name) + '</span>' +
      '<span class="teil__spur"><i class="teil__wert" style="--w:' + Math.round(anteil * 100) + '%"></i>' +
      (gegner !== null && gegner !== undefined
        ? '<i class="teil__gegner" style="left:' + U.clamp(gegner, 0, 100).toFixed(1) + '%" title="' +
          Math.round(gegner) + '"></i>' : '') +
      '</span><span class="teil__zahl ' + UI.wertKlasse(wert) + '">' + U.num(wert, 0) + '</span></div>';
  }

  function merkmal(name, anteil) {
    return '<div><div class="klein muted" style="margin-bottom:3px">' + esc(name) + '</div>' +
      UI.balken(anteil) + '</div>';
  }

  /** Ein Spieler auf dem Spielfeld – mit Frischering, Rolle und Eignung. */
  function spotHtml(world, club, taktik, f, i, z) {
    var slot = f.slots[i];
    var id = taktik.aufstellung[i];
    var p = id ? world.spieler[id] : null;
    var rolle = T.rolleFinden(slot.pos, taktik.rollen[i]);
    var problem = p && (p.verletzung || p.sperre > 0 || p.clubId !== club.id);
    var stil = 'left:' + slot.x + '%;bottom:' + (slot.y * 0.90 + 4) + '%';

    var marken = '';
    if (p) {
      if (p.id === taktik.kapitaen) marken += '<span class="spot__marke marke--k" title="Kapitän">C</span>';
      if (p.id === taktik.standards.elfmeter) marken += '<span class="spot__marke marke--e" title="Elfmeterschütze">E</span>';
      if (p.id === taktik.standards.ecken || p.id === taktik.standards.freistoss) {
        marken += '<span class="spot__marke marke--f" title="Standards">S</span>';
      }
      if (problem) marken += '<span class="spot__marke marke--v" title="nicht einsatzbereit">!</span>';
    }

    var innen;
    if (p) {
      innen = UI.ring(p.fitness / 100, { groesse: 42, dicke: 3.5 }) +
        '<span class="spot__nr">' + (p.nummer || '·') + '</span>';
    } else {
      innen = '<span class="spot__nr">+</span>';
    }

    var zeile2 = p
      ? eignungPunkt(T.eignung(p, slot.pos)) +
        '<span class="spot__rolle">' + esc(rolleKurz(rolle)) + '</span>' +
        '<span class="spot__pos">' + esc(slot.pos) + '</span>' + formPfeil(p)
      : esc(slot.pos);

    return '<div class="spot' + (p ? '' : ' spot--leer') + (problem ? ' spot--problem' : '') +
      (z.gewaehlterSlot === i ? ' spot--gewaehlt' : '') + '" data-slot="' + i + '" style="' + stil + '">' +
      '<div class="spot__ring">' + innen + (marken ? '<span class="spot__marken">' + marken + '</span>' : '') + '</div>' +
      '<div class="spot__name">' + (p ? esc(p.nachname) : '<i class="muted">frei</i>') + '</div>' +
      '<div class="spot__zeile">' + zeile2 + '</div>' +
      '</div>';
  }

  /** Detailpanel für die gewählte Position. */
  function slotPanel(world, club, taktik, f, z) {
    var slot = f.slots[z.gewaehlterSlot];
    var rollen = D.ROLLEN[slot.pos] || D.ROLLEN.ZM;
    var aktuelleRolle = T.rolleFinden(slot.pos, taktik.rollen[z.gewaehlterSlot]);
    var aktuell = taktik.aufstellung[z.gewaehlterSlot] ? world.spieler[taktik.aufstellung[z.gewaehlterSlot]] : null;
    var naechstes = world.naechstesSpiel(club.id);

    var html = '<div class="card" data-slotpanel="1"><div class="card__head"><h3>' +
      UI.posTag(slot.pos) + ' ' + esc(D.POS_NAME[slot.pos]) + '</h3>' +
      '<button class="btn btn--sm btn--ghost" data-a="slotzu">Schließen</button></div>';

    html += '<div class="mb"><label>Rolle</label><select data-f="rolle">' +
      rollen.map(function (r) {
        return '<option value="' + esc(r.id) + '"' + (aktuelleRolle.id === r.id ? ' selected' : '') +
          '>' + esc(r.name) + '</option>';
      }).join('') + '</select>' +
      '<div class="klein muted mt" style="margin-top:6px">Wichtig auf dieser Rolle: <b>' +
      (aktuelleRolle.attrs || []).map(function (a) { return esc(D.ATTR_NAME[a]); }).join(', ') + '</b>' +
      ' · Beitrag: Abwehr ' + U.num((aktuelleRolle.def || 0) * 100, 0) + ' %, Mittelfeld ' +
      U.num((aktuelleRolle.mid || 0) * 100, 0) + ' %, Angriff ' + U.num((aktuelleRolle.att || 0) * 100, 0) + ' %</div></div>';

    if (aktuell) {
      html += '<div class="card card--flat mb"><div class="flex flex--zwischen">' +
        '<div><b>' + esc(aktuell.vorname + ' ' + aktuell.nachname) + '</b> ' +
        '<span class="klein muted">' + esc(T.eignungText(T.eignung(aktuell, slot.pos))) + '</span></div>' +
        '<div class="flex klein">' +
        (aktuelleRolle.attrs || []).map(function (a) {
          return '<span class="muted">' + esc(D.ATTR_NAME[a]) + '</span> ' + UI.wert(aktuell.attr[a]);
        }).join(' · ') + '</div></div></div>';
    }

    var kandidaten = U.sortBy(world.kaderVon(club.id).filter(function (p) {
      return slot.pos === 'TW' ? p.pos === 'TW' : p.pos !== 'TW';
    }), function (p) { return -P.tagesform(p, slot.pos); });

    html += '<h4>Kandidaten</h4><div class="table-wrap" style="max-height:390px;overflow-y:auto">' +
      UI.tabelle([
        { key: 'n', label: 'Spieler', haft: true, html: function (p) {
          return (p.id === (aktuell && aktuell.id) ? '<span class="chip chip--gruen">aufgestellt</span> ' : '') +
            '<span class="name">' + esc(p.nachname) + '</span> ' + UI.posTag(p.pos) + ' ' +
            UI.spielerStatus(world, p); } },
        { key: 'e', label: 'Eignung', html: function (p) {
          var w = T.eignung(p, slot.pos);
          return eignungPunkt(w) + ' <span class="klein muted">' + esc(T.eignungText(w)) + '</span>'; } },
        { key: 's', label: 'Auf Position', klasse: 'num', html: function (p) {
          return UI.wert(P.posStaerke(p, slot.pos)); } },
        { key: 'r', label: 'Rollenpassung', klasse: 'num', html: function (p) {
          var b = 0;
          (aktuelleRolle.attrs || []).forEach(function (a) { b += p.attr[a]; });
          b = (aktuelleRolle.attrs && aktuelleRolle.attrs.length) ? b / aktuelleRolle.attrs.length : 50;
          return UI.balken(b / 99, b >= 68 ? '' : b >= 50 ? 'bar--gelb' : 'bar--rot'); } },
        { key: 'fo', label: 'Form', klasse: 'num', html: function (p) { return formPfeil(p); } },
        { key: 'fr', label: 'Frische', klasse: 'num', html: function (p) { return UI.fitnessBalken(p); } },
        { key: 'no', label: 'Note', klasse: 'num', html: function (p) {
          return UI.noteZelle(P.schnitt(p.stats)); } },
        { key: 'a', label: '', klasse: 'num', html: function (p) {
          if (!T.einsatzbereit(p, world, naechstes ? naechstes.wettbewerb : null)) {
            return '<span class="chip chip--rot">nicht einsatzbereit</span>';
          }
          return '<button class="btn btn--sm" data-setz="' + esc(p.id) + '">setzen</button>'; } }
      ], kandidaten.slice(0, 24), {}) + '</div></div>';
    return html;
  }

  /** Kurzbeschreibung der Wirkung einer Anweisung. */
  function anweisungsWirkung(kategorie, wert) {
    var t = {
      defensiv: 'Sicherheit vor Risiko, wenig eigene Chancen.',
      abwartend: 'Kontrolliert, lässt hinten wenig zu.',
      ausgeglichen: 'Ausgewogen zwischen Absicherung und Angriff.',
      offensiv: 'Mehr Chancen, dafür offener nach hinten.',
      allesoderNichts: 'Volles Risiko – lohnt nur bei Rückstand.',
      tief: 'Zieht sich zurück, spart Kraft, lädt Gegner ein.',
      mittel: 'Attackiert ab der Mittellinie.',
      hoch: 'Früher Zugriff, kostet spürbar Kraft.',
      extrem: 'Attackiert schon im gegnerischen Sechzehner.',
      normal: 'Standardeinstellung ohne Sonderwirkung.',   // je Kategorie unten ueberschrieben
      kurz: 'Mehr Ballbesitz, aber Risiko im Aufbau.',
      gemischt: 'Situative Wahl zwischen kurz und lang.',
      lang: 'Überbrückt das Mittelfeld, gut gegen hohe Ketten.',
      langsam: 'Ruhig zirkulieren, schont Kräfte.',
      schnell: 'Schnell nach vorn, mehr Abschlüsse.',
      eng: 'Zentrum überladen, Flügel bleiben frei.',
      breit: 'Spiel über außen, mehr Flanken.',
      aus: 'Kein zusätzlicher Aufwand.',
      sofort: 'Sofort nachsetzen – anstrengend, aber wirksam.',
      fair: 'Wenig Karten, aber auch weniger Zweikämpfe.',
      hart: 'Gewinnt Zweikämpfe, kostet Karten.',
      ein: 'Nimmt spät Tempo heraus, riskiert Karten.'
    };
    // Mehrere Kategorien teilen sich die Kennung "normal" oder "aus". Ohne
    // eigenen Text stuende fuenfmal derselbe Satz untereinander.
    var jeKategorie = {
      abwehrlinie: { normal: 'Kette auf normaler Hoehe - kein Sonderrisiko.' },
      tempo: { normal: 'Weder forciert noch gebremst.' },
      breite: { normal: 'Zentrum und Flügel gleich gewichtet.' },
      gegenpressing: { normal: 'Nachsetzen nur, wenn die Situation es hergibt.' },
      zweikampf: { normal: 'Normale Härte, normales Kartenrisiko.' },
      zeitspiel: { aus: 'Es wird bis zum Schlusspfiff durchgespielt.' }
    };
    if (jeKategorie[kategorie] && jeKategorie[kategorie][wert.id]) {
      return jeKategorie[kategorie][wert.id];
    }
    return t[wert.id] || wert.name;
  }

  /** Bericht der Analyseabteilung zum nächsten Gegner. */
  function analysePanel(world, a, spiel, heim) {
    var html = '<div class="card"><div class="card__head"><h3>Gegneranalyse</h3>' +
      '<span class="chip">Genauigkeit ' + Math.round(a.genauigkeit * 100) + ' %</span></div>';
    html += '<div class="flex flex--zwischen mb">' +
      '<div class="flex">' + UI.wappen(a.club) +
      '<div><b>' + esc(a.club.name) + '</b><br><span class="klein muted">' +
      (heim ? 'zu Gast' : 'auswärts') + ' · ' + U.fmtDate(spiel.tag, 'wt') + ' · ' + esc(spiel.zeit) + '</span></div></div>' +
      (a.tabelle ? '<div class="rechts klein"><span class="muted">Platz ' + a.tabelle.platz + '</span><br>' +
        UI.formPunkte(a.tabelle.form) + '</div>' : '') + '</div>';

    if (a.formation) {
      html += '<div class="stat-row"><span>Erwartete Formation</span><b>' + esc(a.formation) + '</b></div>';
    }
    html += '<div class="stat-row"><span>Stärkster Mannschaftsteil</span><b class="w-schlecht">' +
      esc(a.staerke.name) + '</b></div>' +
      '<div class="stat-row"><span>Schwächster Mannschaftsteil</span><b class="w-top">' +
      esc(a.schwaeche.name) + '</b></div>';
    if (a.schluesselspieler) {
      var s = a.schluesselspieler;
      html += '<div class="stat-row"><span>Schlüsselspieler</span><b>' + esc(s.nachname) +
        ' <span class="klein muted">' + s.pos + ' · ' + s.stats.tore + ' Tore</span></b></div>';
    }
    if (a.hinweise.length) {
      html += '<div class="trenner"></div><h4>Was die Analysten sehen</h4>' +
        a.hinweise.map(function (h) {
          return '<div class="msg" style="cursor:default"><div class="msg__icon">›</div>' +
            '<div class="msg__body"><p>' + esc(h) + '</p></div></div>';
        }).join('');
    } else {
      html += '<p class="klein muted mt">Die Analyseabteilung liefert zu wenig belastbares Material. ' +
        'Bessere Spielanalysten würden hier konkrete Hinweise geben.</p>';
    }
    return html + '</div>';
  }

  /** Stärke der bestmöglichen Aufstellung – als Vergleichsmaßstab. */
  function bestmoeglicheElf(world, club, taktik, spiel) {
    var kopie = U.clone(taktik);
    T.autoAufstellung(world, club, kopie, { wettbewerb: spiel ? spiel.wettbewerb : null });
    var f = T.formation(kopie);
    var werte = [];
    kopie.aufstellung.forEach(function (id, i) {
      var p = id ? world.spieler[id] : null;
      if (p) werte.push(P.posStaerke(p, f.slots[i].pos));
    });
    return { staerke: werte.length ? U.avg(werte) : 0, aufstellung: kopie.aufstellung };
  }

})(typeof window !== 'undefined' ? window : globalThis);
