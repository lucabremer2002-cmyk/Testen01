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

      // Nächstes Spiel
      html += '<div class="card"><div class="card__head"><h3>Nächstes Pflichtspiel</h3>';
      if (naechstes) html += '<span class="chip">' + esc(U.fmtDate(naechstes.tag, 'lang')) + ' · ' + esc(naechstes.zeit) + '</span>';
      html += '</div>';
      if (naechstes) {
        var heim = naechstes.heimId === club.id;
        var gegnerId = heim ? naechstes.gastId : naechstes.heimId;
        var gegner = world.vereine[gegnerId];
        var gTab = world.tabellenPlatz(gegnerId);
        html += '<div class="flex flex--zwischen mb"><div class="flex">' +
          UI.wappen(gegner) + '<div><b style="font-size:16px">' + esc(gegner.name) + '</b><br>' +
          '<small class="muted">' + (heim ? 'Heimspiel' : 'Auswärtsspiel') + ' · ' +
          esc(UI.wettbewerbName(world, naechstes)) + (naechstes.rundeName ? ' · ' + esc(naechstes.rundeName) : '') +
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
      if (eigen) {
        var von = Math.max(0, eigen.platz - 3);
        var bis = Math.min(tab.length, von + 6);
        html += '<div class="card"><div class="card__head"><h3>' + esc(liga.name) + '</h3>' +
          '<button class="btn btn--sm" data-a="tabelle">Ganze Tabelle</button></div>' +
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

      html += '<div class="card"><h3>Standing</h3>' +
        vertrauensZeile('Vorstand', m.vorstandsvertrauen) +
        vertrauensZeile('Fans', m.fanvertrauen) +
        vertrauensZeile('Mannschaft', m.mannschaftsvertrauen) +
        '<div class="trenner"></div>' +
        '<div class="stat-row"><span>Saisonziel</span><b>' + esc(m.saisonziel ? m.saisonziel.text : '–') + '</b></div>' +
        '<div class="stat-row"><span>Vertrag bis</span><b>' + U.fmtDate(m.vertragBis) + '</b></div>' +
        '<div class="stat-row"><span>Bilanz</span><b>' + m.bilanz.siege + 'S / ' + m.bilanz.remis + 'U / ' + m.bilanz.niederlagen + 'N</b></div>' +
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

  function vertrauensZeile(label, wert) {
    var v = Math.round(wert);
    var klasse = v >= 60 ? '' : v >= 35 ? 'bar--gelb' : 'bar--rot';
    return '<div class="stat-row"><span>' + esc(label) + '</span>' +
      '<span class="flex" style="gap:8px">' + UI.balken(v / 100, klasse) +
      '<b style="min-width:38px;text-align:right">' + v + ' %</b></span></div>';
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

      var html = '<div class="card__head"><h2>Kader &middot; ' + esc(club.name) + '</h2>' +
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

  /** Baut die Kadertabelle je nach gewählter Ansicht. */
  function kaderTabelle(world, kader, z) {
    var spalten = [
      { key: 'nummer', label: '#', klasse: 'num', wert: function (p) { return p.nummer; }, html: function (p) { return p.nummer || '–'; } },
      { key: 'name', label: 'Name', wert: function (p) { return p.nachname; },
        html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span> <span class="muted klein">' + esc(p.vorname) + '</span>'; } },
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
        { key: 'moral', label: 'Moral', klasse: 'num', wert: function (p) { return p.moral; },
          html: function (p) { return UI.balken(p.moral / 100, p.moral >= 60 ? '' : p.moral >= 40 ? 'bar--gelb' : 'bar--rot'); } },
        { key: 'wert', label: 'Marktwert', klasse: 'num', wert: function (p) { return p.marktwert; }, html: function (p) { return U.money(p.marktwert); } },
        { key: 'status', label: 'Status', html: function (p) { return UI.spielerStatus(world, p) || '<span class="muted">–</span>'; } }
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
      (p.verletzungsneigung > 66 ? '<span class="w-schlecht">hoch</span>' : p.verletzungsneigung > 40 ? '<span class="w-mittel">mittel</span>' : '<span class="w-gut">gering</span>') + '</b></div>';
    if (p.vertrag) {
      html += '<div class="stat-row"><span>Gehalt</span><b>' + U.money(p.vertrag.gehalt) + ' / Woche</b></div>' +
        '<div class="stat-row"><span>Vertrag bis</span><b>' + U.fmtDate(p.vertrag.bis) +
        ' (' + P.restlaufzeitMonate(p, world) + ' Monate)</b></div>';
      if (p.vertrag.ausstiegsklausel) {
        html += '<div class="stat-row"><span>Ausstiegsklausel</span><b>' + U.money(p.vertrag.ausstiegsklausel) + '</b></div>';
      }
      html += '<div class="stat-row"><span>Prämien</span><b class="klein">Einsatz ' + U.money(p.vertrag.praemien.einsatz) +
        ' · Tor ' + U.money(p.vertrag.praemien.tor) + ' · Sieg ' + U.money(p.vertrag.praemien.sieg) + '</b></div>';
    } else {
      html += '<div class="stat-row"><span>Vertrag</span><b class="w-gut">ablösefrei verfügbar</b></div>';
    }
    if (eigener) {
      html += '<div class="stat-row"><span>Unzufriedenheit</span><b class="klein">Spielzeit ' +
        Math.round(p.unzufriedenheit.spielzeit) + ' · Gehalt ' + Math.round(p.unzufriedenheit.gehalt) +
        ' · Ambition ' + Math.round(p.unzufriedenheit.ambition) + '</b></div>';
    }
    html += '</div>';

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

    // Aktionen
    if (eigener) {
      html += '<div class="trenner"></div><div class="flex">' +
        '<button class="btn" data-a="gespraech">Gespräch führen</button>' +
        '<button class="btn" data-a="vertrag">Vertrag verhandeln</button>' +
        '<button class="btn" data-a="fokus">Individualtraining</button>' +
        '<button class="btn" data-a="transferliste">' + (p.transferliste ? 'Von Transferliste nehmen' : 'Auf Transferliste setzen') + '</button>' +
        '<button class="btn" data-a="leihliste">' + (p.leihliste ? 'Nicht mehr verleihen' : 'Zum Verleih anbieten') + '</button>' +
        '</div>';
    } else {
      html += '<div class="trenner"></div><div class="flex">' +
        '<button class="btn btn--primary" data-a="angebot">' + (p.clubId ? 'Angebot abgeben' : 'Vertrag anbieten') + '</button>' +
        '<button class="btn" data-a="scouten">Beobachten lassen</button>' +
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
        bind('gespraech', function () { V.gespraechsDialog(p.id); });
        bind('vertrag', function () { V.vertragsDialog(p.id); });
        bind('fokus', function () { V.fokusDialog(p.id); });
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

  UI.views.taktik = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      var taktik = world.taktikVon(club.id);
      var f = T.formation(taktik);
      var probleme = T.pruefeAufstellung(world, club, taktik);
      var naechstes = world.naechstesSpiel(club.id);

      var html = '<div class="card__head"><h2>Taktik</h2><div class="flex">' +
        '<button class="btn btn--sm" data-a="auto">Beste Elf aufstellen</button>' +
        '<button class="btn btn--sm" data-a="standards">Standards neu vergeben</button>' +
        '</div></div>';

      html += '<div class="taktik-layout">';

      // ---- Spielfeld
      html += '<div class="card"><div class="card__head"><h3>Aufstellung</h3>' +
        '<select data-f="formation" style="width:auto">' +
        Object.keys(D.FORMATIONEN).map(function (k) {
          return '<option value="' + esc(k) + '"' + (taktik.formation === k ? ' selected' : '') + '>' + esc(k) + '</option>';
        }).join('') + '</select></div>';
      html += '<p class="klein muted">' + esc(f.beschreibung) + '</p>';
      html += '<div class="pitch"><div class="pitch__mid"></div><div class="pitch__circle"></div>';
      f.slots.forEach(function (slot, i) {
        var id = taktik.aufstellung[i];
        var p = id ? world.spieler[id] : null;
        var problem = p && (p.verletzung || p.sperre > 0 || p.clubId !== club.id);
        html += '<div class="spot' + (p ? '' : ' spot--leer') + (problem ? ' spot--problem' : '') +
          (z.gewaehlterSlot === i ? ' spot--gewaehlt' : '') + '" data-slot="' + i + '"' +
          ' style="left:' + slot.x + '%;bottom:' + (slot.y * 0.92 + 3) + '%">' +
          '<div class="spot__nr">' + (p ? (p.nummer || '·') : '+') + '</div>' +
          '<div class="spot__name">' + (p ? esc(p.nachname) : '<i class="muted">frei</i>') + '</div>' +
          '<div class="spot__pos">' + esc(slot.pos) + '</div></div>';
      });
      html += '</div>';

      if (probleme.length) {
        html += '<div class="klein mt" style="color:var(--rot)">' +
          probleme.map(esc).join('<br>') + '</div>';
      }
      html += '<div class="klein muted mt">Einspielgrad: ' + Math.round(taktik.einspielgrad) +
        ' %. Er steigt, wenn dieselbe Elf regelmäßig zusammenspielt.</div>';
      html += '</div>';

      // ---- rechte Seite
      html += '<div class="grid">';

      // Slotauswahl
      if (z.gewaehlterSlot !== undefined && z.gewaehlterSlot !== null) {
        var slot = f.slots[z.gewaehlterSlot];
        var rollen = D.ROLLEN[slot.pos] || D.ROLLEN.ZM;
        html += '<div class="card"><div class="card__head"><h3>Position ' + esc(slot.pos) + ' &middot; ' +
          esc(D.POS_NAME[slot.pos]) + '</h3><button class="btn btn--sm" data-a="slotzu">Schließen</button></div>';
        html += '<div class="mb"><label>Rolle</label><select data-f="rolle">' +
          rollen.map(function (r) {
            return '<option value="' + esc(r.id) + '"' + (taktik.rollen[z.gewaehlterSlot] === r.id ? ' selected' : '') +
              '>' + esc(r.name) + '</option>';
          }).join('') + '</select></div>';

        var kandidaten = U.sortBy(world.kaderVon(club.id).filter(function (p) {
          return slot.pos === 'TW' ? p.pos === 'TW' : p.pos !== 'TW';
        }), function (p) { return -P.tagesform(p, slot.pos); });
        html += '<div class="table-wrap" style="max-height:340px;overflow-y:auto">' + UI.tabelle([
          { key: 'n', label: 'Spieler', html: function (p) {
            return '<span class="name">' + esc(p.nachname) + '</span> ' + UI.posTag(p.pos); } },
          { key: 's', label: 'Eignung', klasse: 'num', html: function (p) { return UI.wert(P.posStaerke(p, slot.pos)); } },
          { key: 'fit', label: 'Frische', klasse: 'num', html: function (p) { return UI.fitnessBalken(p); } },
          { key: 'st', label: '', html: function (p) { return UI.spielerStatus(world, p); } },
          { key: 'akt', label: '', klasse: 'num', html: function (p) {
            return '<button class="btn btn--sm" data-setz="' + esc(p.id) + '">setzen</button>'; } }
        ], kandidaten.slice(0, 22), {}) + '</div></div>';
      }

      // Anweisungen
      html += '<div class="card"><h3>Mannschaftsanweisungen</h3><div class="anweisungen">';
      Object.keys(D.ANWEISUNGEN).forEach(function (kat) {
        var a = D.ANWEISUNGEN[kat];
        html += '<div><label>' + esc(a.label) + '</label><select data-anw="' + esc(kat) + '">' +
          a.werte.map(function (w) {
            return '<option value="' + esc(w.id) + '"' + (taktik.anweisungen[kat] === w.id ? ' selected' : '') +
              '>' + esc(w.name) + '</option>';
          }).join('') + '</select></div>';
      });
      html += '</div></div>';

      // Standards und Kapitän
      var elfIds = taktik.aufstellung.filter(Boolean);
      function auswahl(key, label) {
        return '<div><label>' + esc(label) + '</label><select data-std="' + key + '">' +
          '<option value="">–</option>' +
          elfIds.map(function (id) {
            var sp = world.spieler[id];
            if (!sp) return '';
            return '<option value="' + esc(id) + '"' + (taktik.standards[key] === id ? ' selected' : '') +
              '>' + esc(sp.nachname) + '</option>';
          }).join('') + '</select></div>';
      }
      html += '<div class="card"><h3>Standards &amp; Führung</h3><div class="anweisungen">' +
        auswahl('elfmeter', 'Elfmeter') + auswahl('freistoss', 'Freistöße') +
        auswahl('ecken', 'Eckbälle') + auswahl('einwurf', 'Weite Einwürfe') +
        '<div><label>Kapitän</label><select data-std="kapitaen">' +
        world.kaderVon(club.id).map(function (sp) {
          return '<option value="' + esc(sp.id) + '"' + (taktik.kapitaen === sp.id ? ' selected' : '') +
            '>' + esc(sp.nachname) + ' (Führung ' + sp.attr.fuehrung + ')</option>';
        }).join('') + '</select></div>' +
        '</div></div>';

      // Bank
      html += '<div class="card"><div class="card__head"><h3>Ersatzbank</h3>' +
        '<span class="chip">' + taktik.bank.length + ' / 9</span></div>' +
        UI.tabelle([
          { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
          { key: 'p', label: 'Pos', html: function (p) { return UI.posTag(p.pos); } },
          { key: 's', label: 'Stärke', klasse: 'num', html: function (p) { return UI.wert(P.gesamt(p)); } },
          { key: 'f', label: 'Frische', klasse: 'num', html: function (p) { return UI.fitnessBalken(p); } },
          { key: 'x', label: '', klasse: 'num', html: function (p) {
            return '<button class="btn btn--sm" data-bank-raus="' + esc(p.id) + '">✕</button>'; } }
        ], taktik.bank.map(function (id) { return world.spieler[id]; }).filter(Boolean), {
          leerText: 'Keine Spieler auf der Bank.'
        }) +
        '<div class="mt"><label>Spieler auf die Bank setzen</label><select data-bank-rein>' +
        '<option value="">auswählen…</option>' +
        world.kaderVon(club.id).filter(function (p) {
          return elfIds.indexOf(p.id) < 0 && taktik.bank.indexOf(p.id) < 0 && !p.verletzung && p.sperre === 0;
        }).map(function (p) {
          return '<option value="' + esc(p.id) + '">' + esc(p.nachname) + ' (' + p.pos + ', ' + Math.round(P.gesamt(p)) + ')</option>';
        }).join('') + '</select></div></div>';

      html += '</div></div>';
      return html;
    },
    nachher: function (container, world, z) {
      var club = world.nutzerVerein();
      var taktik = world.taktikVon(club.id);

      Array.prototype.forEach.call(container.querySelectorAll('[data-slot]'), function (e) {
        e.onclick = function () {
          var i = parseInt(e.dataset.slot, 10);
          z.gewaehlterSlot = z.gewaehlterSlot === i ? null : i;
          UI.zeichne();
        };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-setz]'), function (e) {
        e.onclick = function () {
          var id = e.dataset.setz;
          var alterSlot = taktik.aufstellung.indexOf(id);
          var ziel = z.gewaehlterSlot;
          if (alterSlot >= 0) {
            // Tausch
            taktik.aufstellung[alterSlot] = taktik.aufstellung[ziel];
          } else {
            var verdraengt = taktik.aufstellung[ziel];
            taktik.bank = taktik.bank.filter(function (b) { return b !== id; });
            if (verdraengt && taktik.bank.length < 9) taktik.bank.unshift(verdraengt);
          }
          taktik.aufstellung[ziel] = id;
          UI.zeichne();
        };
      });
      var fsel = container.querySelector('[data-f="formation"]');
      if (fsel) fsel.onchange = function () {
        T.setzeFormation(taktik, fsel.value);
        z.gewaehlterSlot = null;
        UI.zeichne();
        UI.toast('Formation auf ' + fsel.value + ' umgestellt. Der Einspielgrad sinkt zunächst.');
      };
      var rsel = container.querySelector('[data-f="rolle"]');
      if (rsel) rsel.onchange = function () {
        taktik.rollen[z.gewaehlterSlot] = rsel.value;
        UI.zeichne();
      };
      Array.prototype.forEach.call(container.querySelectorAll('[data-anw]'), function (e) {
        e.onchange = function () { taktik.anweisungen[e.dataset.anw] = e.value; UI.toast('Anweisung übernommen.'); };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-std]'), function (e) {
        e.onchange = function () {
          if (e.dataset.std === 'kapitaen') {
            world.kaderVon(club.id).forEach(function (p) { p.kapitaen = p.id === e.value; });
            taktik.kapitaen = e.value;
          } else {
            taktik.standards[e.dataset.std] = e.value || null;
          }
          UI.toast('Übernommen.');
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
        T.autoAufstellung(world, club, taktik, { wettbewerb: (world.naechstesSpiel(club.id) || {}).wettbewerb });
        z.gewaehlterSlot = null;
        UI.zeichne();
        UI.toast('Beste verfügbare Elf aufgestellt.', 'gut');
      };
      var std = container.querySelector('[data-a="standards"]');
      if (std) std.onclick = function () { T.setzeStandardschuetzen(world, taktik); UI.zeichne(); UI.toast('Standardschützen neu bestimmt.'); };
      var zu = container.querySelector('[data-a="slotzu"]');
      if (zu) zu.onclick = function () { z.gewaehlterSlot = null; UI.zeichne(); };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
