/*
 * views2.js - Training, Spielplan, Tabellen, Transfers, Finanzen,
 * Verein, Personal, Nachwuchs, Medien, Statistik und Karriere.
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util, D = FM.data, P = FM.players, T = FM.tactics;
  var C = FM.competitions, F = FM.finance, UI = FM.ui, V = FM.views;
  var esc = UI.esc;

  // ============================================================ Training

  UI.views.training = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      var plan = world.trainingsplan || (world.trainingsplan = FM.training.standardPlan());
      var stab = world.stabWerteVon(club.id);
      var kader = world.kaderVon(club.id);
      var auswertung = FM.training.planAuswertung(plan);

      var html = '<div class="card__head"><h2>Training</h2><div class="flex">' +
        '<button class="btn btn--sm" data-a="standard">Standardwoche</button>' +
        '<button class="btn btn--sm" data-a="vorbereitung">Vorbereitungswoche</button>' +
        '<button class="btn btn--sm" data-a="lager">Trainingslager</button></div></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Trainingsqualität</span><b>' + Math.round(stab.trainingsqualitaet) + '</b>' +
        '<small>Co-Trainer und Trainingszentrum</small></div>' +
        '<div class="tile"><span>Verletzungsschutz</span><b>' + Math.round(stab.verletzungsschutz * 100) + ' %</b>' +
        '<small>Athletik &amp; Physio</small></div>' +
        '<div class="tile"><span>Reha-Tempo</span><b>' + U.num(stab.rehaTempo, 2) + '×</b>' +
        '<small>Ärzte &amp; Medizin</small></div>' +
        '<div class="tile"><span>Ø Frische</span><b>' +
        Math.round(U.avg(kader.filter(function (p) { return !p.verletzung; }).map(function (p) { return p.fitness; })) || 0) + ' %</b></div>' +
        '<div class="tile"><span>Belastung</span><b>' + U.num(auswertung.belastung, 0) + '</b>' +
        '<small>' + (auswertung.belastung > 45 ? 'hoch' : auswertung.belastung > 25 ? 'normal' : 'niedrig') + '</small></div>' +
        '<div class="tile"><span>Entwicklungstempo</span><b>' +
        (auswertung.entwicklung >= 1 ? '+' : '') + Math.round((auswertung.entwicklung - 1) * 100) + ' %</b>' +
        '<small>' + esc(auswertung.intensitaetName) + '</small></div>' +
        '</div>';

      html += '<div class="grid grid--wide"><div class="card"><div class="card__head"><h3>Wochenplan</h3>' +
        '<select data-t="intensitaet" style="width:auto">' +
        Object.keys(FM.training.INTENSITAETEN).map(function (k) {
          return '<option value="' + k + '"' + (plan.intensitaet === k ? ' selected' : '') + '>' +
            esc(FM.training.INTENSITAETEN[k].name) + '</option>';
        }).join('') + '</select></div>';

      // Spieltage der kommenden Woche markieren
      var wochenStart = world.tag - U.weekday(world.tag);
      html += '<div class="trainingsgrid"><div class="th"></div><div class="th">Vormittag</div><div class="th">Nachmittag</div>';
      FM.training.TAGE.forEach(function (tagName, i) {
        var tag = wochenStart + i;
        var spiel = world.spieleAmTag(tag).filter(function (s) {
          return s.heimId === club.id || s.gastId === club.id;
        })[0];
        html += '<div class="tag">' + esc(tagName.slice(0, 2)) + '<span class="klein muted" style="margin-left:5px">' +
          U.fmtDate(tag, 'kurz') + '</span></div>';
        if (spiel) {
          html += '<div class="zelle--spiel" style="grid-column:span 2">Spieltag: ' +
            esc(world.vereine[spiel.heimId].kurz) + ' – ' + esc(world.vereine[spiel.gastId].kurz) + '</div>';
        } else {
          [0, 1].forEach(function (slot) {
            html += '<div><select data-einheit="' + i + '-' + slot + '">' +
              '<option value="frei"' + (plan.einheiten[i][slot] === 'frei' ? ' selected' : '') + '>Frei</option>' +
              Object.keys(D.TRAININGSEINHEITEN).filter(function (k) { return k !== 'frei'; }).map(function (k) {
                return '<option value="' + k + '"' + (plan.einheiten[i][slot] === k ? ' selected' : '') + '>' +
                  esc(D.TRAININGSEINHEITEN[k].name) + '</option>';
              }).join('') + '</select></div>';
          });
        }
      });
      html += '</div>';

      html += '<div class="klein muted mt">Kondition und Zweikampfschule entwickeln am meisten, kosten aber Frische ' +
        'und erhöhen das Verletzungsrisiko. Regeneration und freie Tage bringen die Mannschaft zurück in Form.</div>';
      html += '</div>';

      // Schwerpunkte
      html += '<div class="card"><h3>Schwerpunkte der Woche</h3>';
      var keys = Object.keys(auswertung.zaehler);
      if (!keys.length) html += '<div class="leer">Es ist kein Training angesetzt.</div>';
      keys.sort(function (a, b) { return auswertung.zaehler[b] - auswertung.zaehler[a]; }).forEach(function (k) {
        var e = D.TRAININGSEINHEITEN[k];
        html += '<div class="stat-row"><span>' + esc(e.name) + '</span>' +
          '<span class="flex" style="gap:8px">' + UI.balken(auswertung.zaehler[k] / 8) +
          '<b>' + auswertung.zaehler[k] + '×</b></span></div>';
      });
      html += '</div></div>';

      // Individualtraining
      html += '<div class="card mt"><div class="card__head"><h3>Individuelles Training</h3>' +
        '<span class="klein muted">Ein Schwerpunkt je Spieler beschleunigt die Entwicklung dort deutlich.</span></div>' +
        UI.tabelle([
          { key: 'n', label: 'Spieler', haft: true, html: function (p) {
            return '<span class="name">' + esc(p.nachname) + '</span> ' + UI.posTag(p.pos); } },
          { key: 'a', label: 'Alter', klasse: 'num', wert: function (p) { return p.alter; }, html: function (p) { return p.alter; } },
          { key: 's', label: 'Stärke', klasse: 'num', wert: function (p) { return P.gesamt(p); },
            html: function (p) { return UI.wert(P.gesamt(p)); } },
          { key: 'p', label: 'Potenzial', klasse: 'num', wert: function (p) { return p.potenzial; },
            html: function (p) {
              var luft = p.potenzial - P.gesamt(p);
              return UI.wert(p.potenzial) + (luft > 2 ? ' <span class="chip chip--gruen">+' + Math.round(luft) + '</span>' : '');
            } },
          { key: 'tl', label: 'Trainingsleistung', klasse: 'num', wert: function (p) { return p.trainingsleistung; },
            html: function (p) { return UI.balken(p.trainingsleistung / 100); } },
          { key: 'f', label: 'Schwerpunkt', html: function (p) {
            return '<select data-fokus="' + esc(p.id) + '" style="min-width:150px">' +
              Object.keys(D.INDIVIDUALTRAINING).map(function (k) {
                if (k === 'torwart' && p.pos !== 'TW') return '';
                return '<option value="' + k + '"' + (p.trainingsfokus === k ? ' selected' : '') + '>' +
                  esc(D.INDIVIDUALTRAINING[k].name) + '</option>';
              }).join('') + '</select>';
          } }
        ], U.sortBy(kader, function (p) { return -(p.potenzial - P.gesamt(p)); }), {
          sortKey: z.sortKey, absteigend: z.absteigend
        }) + '</div>';

      return html;
    },
    nachher: function (container, world) {
      var plan = world.trainingsplan;
      Array.prototype.forEach.call(container.querySelectorAll('[data-einheit]'), function (e) {
        e.onchange = function () {
          var teile = e.dataset.einheit.split('-');
          plan.einheiten[+teile[0]][+teile[1]] = e.value;
          UI.zeichne();
        };
      });
      var intens = container.querySelector('[data-t="intensitaet"]');
      if (intens) intens.onchange = function () { plan.intensitaet = intens.value; UI.zeichne(); };
      Array.prototype.forEach.call(container.querySelectorAll('[data-fokus]'), function (e) {
        e.onchange = function () {
          var p = world.spieler[e.dataset.fokus];
          if (p) p.trainingsfokus = e.value;
        };
      });
      var std = container.querySelector('[data-a="standard"]');
      if (std) std.onclick = function () { world.trainingsplan = FM.training.standardPlan(); UI.zeichne(); UI.toast('Standardwoche geladen.'); };
      var vor = container.querySelector('[data-a="vorbereitung"]');
      if (vor) vor.onclick = function () { world.trainingsplan = FM.training.vorbereitungsPlan(); UI.zeichne(); UI.toast('Vorbereitungswoche geladen.'); };
      var lager = container.querySelector('[data-a="lager"]');
      if (lager) lager.onclick = function () { V.trainingslagerDialog(); };
      UI.tabelleSortierung(container, 'training');
    }
  };

  V.trainingslagerDialog = function () {
    var world = UI.world;
    var f = world.finanzen[world.nutzerClubId];
    var html = '<h2>Trainingslager</h2><p class="muted">Ein Trainingslager hebt Frische, Moral und Einspielgrad. ' +
      'Sinnvoll ist es in der Sommervorbereitung und in der Winterpause.</p>' +
      '<div class="optionen">' + FM.training.TRAININGSLAGER.map(function (l) {
        return '<button class="option" data-l="' + esc(l.id) + '"><b>' + esc(l.name) + '</b><br>' +
          '<span class="klein muted">' + (l.kosten > 0 ? 'Kosten ' + U.money(l.kosten) : 'Einnahmen ' + U.money(-l.kosten)) +
          ' · Frische +' + l.fitness + ' · Moral +' + l.moral + ' · ' + l.tage + ' Tage</span></button>';
      }).join('') + '</div>' +
      '<p class="klein muted mt">Kontostand: ' + U.money(f.kontostand) + '</p>';
    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-l]'), function (b) {
          b.onclick = function () {
            var r = FM.training.fuehreTrainingslagerDurch(world, world.nutzerClubId, b.dataset.l);
            if (!r || r.fehler) UI.toast(r ? r.fehler : 'Nicht möglich.', 'fehler');
            else { UI.toast('Trainingslager durchgeführt: ' + r.lager.name, 'gut'); UI.modalZu(); UI.zeichne(); }
          };
        });
      }
    });
  };

  // ============================================================ Spielplan

  UI.views.spielplan = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      z.wettbewerb = z.wettbewerb || 'alle';
      var spiele = world.spieleVon(club.id).filter(function (s) {
        if (z.wettbewerb === 'alle') return true;
        if (z.wettbewerb === 'liga') return s.wettbewerb === 'liga';
        if (z.wettbewerb === 'pokal') return s.wettbewerb === 'pokal';
        if (z.wettbewerb === 'europa') return s.wettbewerb === 'europa' || s.wettbewerb === 'europaKo';
        return s.wettbewerb === z.wettbewerb;
      });
      spiele = U.sortBy(spiele, function (s) { return s.tag; });

      var gespielt = spiele.filter(function (s) { return s.gespielt; });
      var bilanz = { s: 0, u: 0, n: 0, t: 0, g: 0 };
      gespielt.forEach(function (s) {
        var heim = s.heimId === club.id;
        var e = heim ? s.ergebnis.heimTore : s.ergebnis.gastTore;
        var a = heim ? s.ergebnis.gastTore : s.ergebnis.heimTore;
        bilanz.t += e; bilanz.g += a;
        if (e > a) bilanz.s++; else if (e === a) bilanz.u++; else bilanz.n++;
      });

      var html = '<div class="card__head"><h2>Spielplan</h2>' +
        '<select data-f="wettbewerb" style="width:auto">' +
        [['alle', 'Alle Wettbewerbe'], ['liga', 'Liga'], ['pokal', 'DFB-Pokal'],
         ['europa', 'Europapokal'], ['test', 'Testspiele'], ['relegation', 'Relegation']].map(function (o) {
          return '<option value="' + o[0] + '"' + (z.wettbewerb === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Bilanz</span><b>' + bilanz.s + '-' + bilanz.u + '-' + bilanz.n + '</b>' +
        '<small>' + U.pl(gespielt.length, 'Spiel', 'Spiele') + '</small></div>' +
        '<div class="tile"><span>Tore</span><b>' + bilanz.t + ':' + bilanz.g + '</b>' +
        '<small>' + (bilanz.t - bilanz.g > 0 ? '+' : '') + (bilanz.t - bilanz.g) + '</small></div>' +
        '<div class="tile"><span>Punkteschnitt</span><b>' +
        (gespielt.length ? U.num((bilanz.s * 3 + bilanz.u) / gespielt.length, 2) : '–') + '</b></div>' +
        '<div class="tile"><span>Ø Zuschauer</span><b>' +
        (gespielt.filter(function (s) { return s.heimId === club.id; }).length
          ? U.num(Math.round(U.avg(gespielt.filter(function (s) { return s.heimId === club.id; })
            .map(function (s) { return s.ergebnis.zuschauer; })))) : '–') + '</b></div>' +
        '</div>';

      html += '<div class="card">' + UI.tabelle([
        { key: 'tag', label: 'Datum', html: function (s) {
          return '<span class="' + (s.tag === world.tag ? 'w-top' : 'muted') + '">' + U.fmtDate(s.tag, 'wt') + '</span>'; } },
        { key: 'zeit', label: 'Zeit', html: function (s) { return '<span class="klein muted">' + esc(s.zeit) + '</span>'; } },
        { key: 'wb', label: 'Wettbewerb', html: function (s) {
          return '<span class="klein">' + esc(UI.wettbewerbName(world, s)) +
            (s.rundeName ? '<br><span class="muted">' + esc(s.rundeName) + '</span>' : '') + '</span>'; } },
        { key: 'ort', label: '', html: function (s) {
          return s.heimId === club.id ? '<span class="chip chip--gruen">H</span>' : '<span class="chip">A</span>'; } },
        { key: 'gegner', label: 'Gegner', html: function (s) {
          var gid = s.heimId === club.id ? s.gastId : s.heimId;
          return UI.vereinZelle(world, gid); } },
        { key: 'erg', label: 'Ergebnis', klasse: 'num', html: function (s) {
          if (!s.gespielt) return '<span class="muted">–</span>';
          var heim = s.heimId === club.id;
          var e = heim ? s.ergebnis.heimTore : s.ergebnis.gastTore;
          var a = heim ? s.ergebnis.gastTore : s.ergebnis.heimTore;
          var k = e > a ? 'w-gut' : e === a ? 'w-mittel' : 'w-schlecht';
          var extra = s.ergebnis.elfmeterschiessen
            ? ' <span class="klein muted">(' + s.ergebnis.elfmeterschiessen.heim + ':' + s.ergebnis.elfmeterschiessen.gast + ' n.E.)</span>' : '';
          return '<b class="' + k + '">' + e + ':' + a + '</b>' + extra; } },
        { key: 'zs', label: 'Zuschauer', klasse: 'num', html: function (s) {
          return s.gespielt ? U.num(s.ergebnis.zuschauer) : '<span class="muted">–</span>'; } },
        { key: 'akt', label: '', klasse: 'num', html: function (s) {
          return s.gespielt ? '<button class="btn btn--sm" data-a="bericht" data-id="' + esc(s.id) + '">Bericht</button>' : ''; } }
      ], spiele, { leerText: 'Keine Spiele in diesem Wettbewerb.' }) + '</div>';
      return html;
    },
    nachher: function (container, world, z) {
      var sel = container.querySelector('[data-f="wettbewerb"]');
      if (sel) sel.onchange = function () { z.wettbewerb = sel.value; UI.zeichne(); };
      V.verdrahteAllgemein(container, world);
    }
  };

  // ============================================================ Tabellen

  UI.views.tabelle = {
    html: function (world, z) {
      z.liga = z.liga || (world.ligaVon(world.nutzerClubId) || world.ligen.bl1).id;
      z.modus = z.modus || 'gesamt';
      var liga = world.ligen[z.liga] || world.ligen.bl1;
      var tab = C.sortierteTabelle(liga);

      var html = '<div class="card__head"><h2>Tabellen</h2><div class="flex">' +
        '<select data-f="liga" style="width:auto">' +
        world.ligaIds.map(function (id) {
          return '<option value="' + id + '"' + (z.liga === id ? ' selected' : '') + '>' + esc(world.ligen[id].name) + '</option>';
        }).join('') + '</select>' +
        '<select data-f="modus" style="width:auto">' +
        [['gesamt', 'Gesamttabelle'], ['heim', 'Heimtabelle'], ['ausw', 'Auswärtstabelle']].map(function (o) {
          return '<option value="' + o[0] + '"' + (z.modus === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div></div>';

      if (z.modus !== 'gesamt') {
        var heim = z.modus === 'heim';
        tab = U.sortBy(tab.slice(), function (e) {
          var pkt = heim ? e.heimSiege * 3 + e.heimRemis : e.auswSiege * 3 + e.auswRemis;
          var diff = heim ? e.heimTore - e.heimGegentore : e.auswTore - e.auswGegentore;
          return -(pkt * 1000 + diff * 10 + (heim ? e.heimTore : e.auswTore));
        });
      }

      var aufstieg = liga.aufstiegsplaetze, abstieg = liga.abstiegsplaetze;
      html += '<div class="card">' + UI.tabelle([
        { key: 'platz', label: '#', klasse: 'num', html: function (e, i) { return e.__platz; } },
        { key: 'verein', label: 'Verein', haft: true, html: function (e) { return UI.vereinZelle(world, e.clubId); } },
        { key: 'sp', label: 'Sp', klasse: 'num', html: function (e) {
          return z.modus === 'gesamt' ? e.spiele : (z.modus === 'heim'
            ? e.heimSiege + e.heimRemis + e.heimNiederlagen : e.auswSiege + e.auswRemis + e.auswNiederlagen); } },
        { key: 's', label: 'S', klasse: 'num', html: function (e) {
          return z.modus === 'gesamt' ? e.siege : (z.modus === 'heim' ? e.heimSiege : e.auswSiege); } },
        { key: 'u', label: 'U', klasse: 'num', html: function (e) {
          return z.modus === 'gesamt' ? e.remis : (z.modus === 'heim' ? e.heimRemis : e.auswRemis); } },
        { key: 'n', label: 'N', klasse: 'num', html: function (e) {
          return z.modus === 'gesamt' ? e.niederlagen : (z.modus === 'heim' ? e.heimNiederlagen : e.auswNiederlagen); } },
        { key: 'tore', label: 'Tore', klasse: 'num', html: function (e) {
          if (z.modus === 'gesamt') return e.tore + ':' + e.gegentore;
          return z.modus === 'heim' ? e.heimTore + ':' + e.heimGegentore : e.auswTore + ':' + e.auswGegentore; } },
        { key: 'diff', label: 'Diff', klasse: 'num', html: function (e) {
          var d = z.modus === 'gesamt' ? e.tore - e.gegentore
            : z.modus === 'heim' ? e.heimTore - e.heimGegentore : e.auswTore - e.auswGegentore;
          return (d > 0 ? '+' : '') + d; } },
        { key: 'pkt', label: 'Pkt', klasse: 'num', html: function (e) {
          var pkt = z.modus === 'gesamt' ? e.punkte - e.punktabzug
            : z.modus === 'heim' ? e.heimSiege * 3 + e.heimRemis : e.auswSiege * 3 + e.auswRemis;
          return '<b>' + pkt + '</b>' + (e.punktabzug && z.modus === 'gesamt' ? ' <span class="chip chip--rot">-' + e.punktabzug + '</span>' : ''); } },
        { key: 'form', label: 'Form', html: function (e) { return UI.formPunkte(e.form); } }
      ], tab.map(function (e, i) { e.__platz = i + 1; return e; }), {
        zeilenKlasse: function (e) {
          var k = e.clubId === world.nutzerClubId ? 'tr-eigen ' : '';
          return k;
        }
      }) + '</div>';

      // Legende
      if (liga.id === 'bl1') {
        html += '<div class="card card--flat mt klein muted">Plätze 1–4: Champions League · Platz 5–6: Europa League · ' +
          'Platz 7: Conference League · Platz 16: Relegation · Plätze 17–18: Abstieg</div>';
      } else if (liga.id === 'bl2') {
        html += '<div class="card card--flat mt klein muted">Plätze 1–2: Aufstieg · Platz 3: Relegation zur Bundesliga · ' +
          'Platz 16: Relegation zur 3. Liga · Plätze 17–18: Abstieg</div>';
      }

      // Ergebnisse des letzten Spieltags
      var letzterST = 0;
      liga.spieltage.forEach(function (st, i) {
        var alle = st.spiele.every(function (sid) { var s = world.spielIndex[sid]; return s && s.gespielt; });
        if (alle) letzterST = i;
      });
      var st = liga.spieltage[letzterST];
      if (st) {
        html += '<div class="card mt"><h3>' + (letzterST + 1) + '. Spieltag</h3>' +
          UI.tabelle([
            { key: 'h', label: 'Heim', klasse: 'rechts', html: function (s) { return UI.vereinName(world, s.heimId); } },
            { key: 'e', label: '', klasse: 'num', html: function (s) {
              return s.gespielt ? '<b>' + s.ergebnis.heimTore + ':' + s.ergebnis.gastTore + '</b>'
                : '<span class="muted">' + esc(s.zeit) + '</span>'; } },
            { key: 'g', label: 'Gast', html: function (s) { return UI.vereinName(world, s.gastId); } },
            { key: 'z', label: 'Zuschauer', klasse: 'num', html: function (s) {
              return s.gespielt ? U.num(s.ergebnis.zuschauer) : '–'; } },
            { key: 'a', label: '', klasse: 'num', html: function (s) {
              return s.gespielt ? '<button class="btn btn--sm" data-a="bericht" data-id="' + esc(s.id) + '">Bericht</button>' : ''; } }
          ], st.spiele.map(function (sid) { return world.spielIndex[sid]; }).filter(Boolean), {}) + '</div>';
      }
      return html;
    },
    nachher: function (container, world, z) {
      ['liga', 'modus'].forEach(function (k) {
        var sel = container.querySelector('[data-f="' + k + '"]');
        if (sel) sel.onchange = function () { z[k] = sel.value; UI.zeichne(); };
      });
      V.verdrahteAllgemein(container, world);
    }
  };

  // ============================================================ Transfers

  UI.views.transfers = {
    html: function (world, z) {
      var club = world.nutzerVerein();
      var f = world.finanzen[club.id];
      z.tab = z.tab || 'suche';

      var html = '<div class="card__head"><h2>Transfermarkt</h2>' +
        '<span class="chip ' + (world.transferfenster.offen ? 'chip--gruen' : 'chip--rot') + '">' +
        (world.transferfenster.offen ? 'Transferfenster geöffnet' : 'Transferfenster geschlossen') + '</span></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Transferbudget</span><b>' + U.money(f.transferbudget) + '</b></div>' +
        '<div class="tile"><span>Gehaltsbudget frei</span><b>' +
        U.money(Math.max(0, f.gehaltsbudget - F.wochenLohnsumme(world, club.id))) + '</b><small>pro Woche</small></div>' +
        '<div class="tile"><span>Kaderstärke</span><b>' + world.kaderVon(club.id).length + '</b></div>' +
        '<div class="tile"><span>Offene Angebote</span><b>' +
        world.transfer.angeboteEin.filter(function (a) { return a.status === 'offen'; }).length + '</b></div>' +
        '<div class="tile"><span>Verhandlungsstärke</span><b>' +
        Math.round(world.stabWerteVon(club.id).verhandlung * 100) + '</b><small>Sportdirektor</small></div>' +
        '</div>';

      html += '<div class="flex mb">' + [['suche', 'Spielersuche'], ['bedarf', 'Kaderbedarf'],
        ['angebote', 'Angebote'], ['merkliste', 'Merkliste'], ['scouting', 'Scouting'],
        ['historie', 'Abgeschlossene Transfers']].map(function (t) {
        return '<button class="btn btn--sm' + (z.tab === t[0] ? ' btn--primary' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';

      if (z.tab === 'suche') html += transferSuche(world, z);
      else if (z.tab === 'bedarf') html += transferBedarf(world);
      else if (z.tab === 'angebote') html += transferAngebote(world);
      else if (z.tab === 'merkliste') html += transferMerkliste(world);
      else if (z.tab === 'scouting') html += transferScouting(world, z);
      else html += transferHistorie(world);

      if (z.tab === 'angebote' || z.tab === 'merkliste') html += rueckkaufKarte(world);

      return html;
    },
    nachher: function (container, world, z) {
      Array.prototype.forEach.call(container.querySelectorAll('[data-tab]'), function (b) {
        b.onclick = function () { z.tab = b.dataset.tab; UI.zeichne(); };
      });
      UI.filterBinden(container, 'transfers', 'data-tf');
      Array.prototype.forEach.call(container.querySelectorAll('[data-angebot]'), function (b) {
        b.onclick = function () {
          var box = container.querySelector('[data-rk="' + b.dataset.angebot + '"]');
          var r = FM.transfers.angebotEntscheiden(world, b.dataset.angebot, b.dataset.ja === '1',
            { rueckkauf: !!(box && box.checked) });
          if (r.fehler) UI.toast(r.fehler, 'fehler');
          else if (r.status === 'verkauft') {
            UI.toast('Verkauft für ' + U.money(r.betrag) +
              (r.rueckkauf ? ' · Rückkauf für ' + U.money(r.rueckkauf) + ' vereinbart' : ''), 'gut');
          }
          else if (r.status === 'geplatzt') UI.toast(r.text, 'fehler');
          else UI.toast('Angebot abgelehnt.');
          UI.zeichne();
        };
      });
      Array.prototype.forEach.call(container.querySelectorAll('[data-rueckkauf]'), function (b) {
        b.onclick = function (ev) {
          ev.stopPropagation();
          var r = FM.transfers.rueckkaufZiehen(world, b.dataset.rueckkauf, world.nutzerClubId);
          if (r.fehler) UI.toast(r.fehler, 'fehler');
          else UI.toast(r.name + ' ist zurück – für ' + U.money(r.preis) + '.', 'gut');
          UI.zeichne();
        };
      });
      var scoutBtn = container.querySelector('[data-a="scoutreise"]');
      if (scoutBtn) scoutBtn.onclick = function () { V.scoutingDialog(); };
      UI.tabelleSortierung(container, 'transfers');
      V.verdrahteAllgemein(container, world);
    }
  };

  function transferSuche(world, z) {
    var club = world.nutzerVerein();
    var treffer = FM.transfers.suche(world, {
      ausserhalb: club.id,
      position: z.pos || null,
      minAlter: z.minAlter ? +z.minAlter : null,
      maxAlter: z.maxAlter ? +z.maxAlter : null,
      minStaerke: z.minStaerke ? +z.minStaerke : null,
      maxWert: z.maxWert ? +z.maxWert * 1e6 : null,
      nurVertragslos: z.nurFrei,
      nurTransferliste: z.nurListe,
      nurAuslauf: z.nurAuslauf,
      text: z.suchtext || null
    }, 120);

    var html = '<div class="filterleiste">' +
      '<div><label>Position</label><select data-tf="pos"><option value="">alle</option>' +
      D.POSITIONEN.map(function (p) {
        return '<option value="' + p + '"' + (z.pos === p ? ' selected' : '') + '>' + p + ' – ' + esc(D.POS_NAME[p]) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label>Alter von</label><input type="number" data-tf="minAlter" value="' + esc(z.minAlter || '') + '" min="15" max="40"></div>' +
      '<div><label>bis</label><input type="number" data-tf="maxAlter" value="' + esc(z.maxAlter || '') + '" min="15" max="40"></div>' +
      '<div><label>Stärke ab</label><input type="number" data-tf="minStaerke" value="' + esc(z.minStaerke || '') + '" min="1" max="99"></div>' +
      '<div><label>Wert bis (Mio.)</label><input type="number" data-tf="maxWert" value="' + esc(z.maxWert || '') + '" min="0" step="0.5"></div>' +
      '<div style="min-width:160px"><label>Name</label><input type="text" data-tf="suchtext" value="' + esc(z.suchtext || '') + '"></div>' +
      '<div><label>&nbsp;</label><label class="klein flex" style="gap:5px"><input type="checkbox" data-tf="nurFrei" style="width:auto"' +
      (z.nurFrei ? ' checked' : '') + '> ablösefrei</label></div>' +
      '<div><label>&nbsp;</label><label class="klein flex" style="gap:5px"><input type="checkbox" data-tf="nurListe" style="width:auto"' +
      (z.nurListe ? ' checked' : '') + '> Transferliste</label></div>' +
      '<div><label>&nbsp;</label><label class="klein flex" style="gap:5px"><input type="checkbox" data-tf="nurAuslauf" style="width:auto"' +
      (z.nurAuslauf ? ' checked' : '') + '> Vertrag läuft aus</label></div>' +
      '</div>';

    html += '<div class="card">' + spielerMarktTabelle(world, treffer, z) + '</div>';
    return html;
  }

  function spielerMarktTabelle(world, liste, z) {
    return UI.tabelle([
      { key: 'name', label: 'Spieler', haft: true, wert: function (p) { return p.nachname; }, html: function (p) {
        return '<span class="name">' + esc(p.nachname) + '</span> <span class="muted klein">' + esc(p.vorname) + '</span>'; } },
      { key: 'pos', label: 'Pos', wert: function (p) { return D.POSITIONEN.indexOf(p.pos); }, html: function (p) { return UI.posTag(p.pos); } },
      { key: 'alter', label: 'Alter', klasse: 'num', wert: function (p) { return p.alter; }, html: function (p) { return p.alter; } },
      { key: 'verein', label: 'Verein', wert: function (p) { return p.clubId || ''; }, html: function (p) {
        return p.clubId ? UI.vereinZelle(world, p.clubId, true) : '<span class="chip chip--gruen">vereinslos</span>'; } },
      { key: 'staerke', label: 'Stärke', klasse: 'num', wert: function (p) { return P.gesamt(p); },
        html: function (p) { return p.scoutwissen > 0.35 ? UI.wert(P.gesamt(p)) : '<span class="muted">?</span>'; } },
      { key: 'pot', label: 'Pot', klasse: 'num', wert: function (p) { return p.potenzial; },
        html: function (p) { return p.scoutwissen > 0.6 ? UI.wert(p.potenzial) : '<span class="muted">?</span>'; } },
      { key: 'wissen', label: 'Kenntnis', klasse: 'num', wert: function (p) { return p.scoutwissen; },
        html: function (p) { return UI.balken(p.scoutwissen, 'bar--blau'); } },
      { key: 'wert', label: 'Marktwert', klasse: 'num', wert: function (p) { return p.marktwert; },
        html: function (p) { return U.money(p.marktwert); } },
      { key: 'gehalt', label: 'Gehalt', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.gehalt : 0; },
        html: function (p) { return p.vertrag ? U.money(p.vertrag.gehalt) : '–'; } },
      { key: 'rest', label: 'Vertrag', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.bis : 0; },
        html: function (p) { return p.vertrag ? P.restlaufzeitMonate(p, world) + ' M' : '<span class="w-gut">frei</span>'; } },
      { key: 'st', label: '', html: function (p) { return UI.spielerStatus(world, p); } }
    ], liste, {
      sortKey: z.sortKey || 'staerke', absteigend: z.absteigend === undefined ? true : z.absteigend,
      zeilenKlasse: function () { return 'is-clickable'; },
      zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
      leerText: 'Kein Spieler entspricht der Suche.'
    });
  }

  function transferBedarf(world) {
    var club = world.nutzerVerein();
    var bedarf = FM.transfers.kaderbedarf(world, club.id);
    var kader = world.kaderVon(club.id);
    var niveau = P.niveauFuerVerein(club);

    var html = '<div class="card"><h3>Analyse des Kaders</h3>' +
      '<p class="klein muted">Der Sportdirektor bewertet, wo der Kader dünn besetzt ist. ' +
      'Als Maßstab dient das Niveau, das für einen Verein dieser Größe üblich ist (' + Math.round(niveau) + ').</p>';

    html += UI.tabelle([
      { key: 'pos', label: 'Position', html: function (b) { return UI.posTag(b.pos) + ' ' + esc(D.POS_NAME[b.pos]); } },
      { key: 'anz', label: 'Vorhanden', klasse: 'num', html: function (b) { return b.vorhanden; } },
      { key: 'best', label: 'Bester Spieler', html: function (b) {
        var passend = U.sortBy(kader.filter(function (p) {
          return p.pos === b.pos || p.nebenpos.indexOf(b.pos) >= 0;
        }), function (p) { return -P.posStaerke(p, b.pos); })[0];
        return passend ? esc(passend.nachname) + ' ' + UI.wert(P.posStaerke(passend, b.pos)) : '<span class="w-schlecht">niemand</span>'; } },
      { key: 'd', label: 'Dringlichkeit', klasse: 'num', html: function (b) {
        return UI.balken(U.clamp(b.dringlichkeit / 5, 0, 1), b.dringlichkeit > 3 ? 'bar--rot' : 'bar--gelb'); } }
    ], bedarf, { leerText: 'Der Kader ist auf allen Positionen ordentlich besetzt.' });
    html += '</div>';

    // Positionsübersicht
    html += '<div class="card mt"><h3>Besetzung nach Positionen</h3>' + UI.tabelle([
      { key: 'p', label: 'Position', html: function (r) { return UI.posTag(r.pos) + ' ' + esc(D.POS_NAME[r.pos]); } },
      { key: 'n', label: 'Spieler', klasse: 'num', html: function (r) { return r.anzahl; } },
      { key: 'b', label: 'Beste drei', html: function (r) {
        return r.beste.map(function (p) {
          return esc(p.nachname) + ' <span class="klein ' + UI.wertKlasse(P.posStaerke(p, r.pos)) + '">' +
            Math.round(P.posStaerke(p, r.pos)) + '</span>';
        }).join(' · ') || '<span class="muted">–</span>'; } },
      { key: 'a', label: 'Ø Alter', klasse: 'num', html: function (r) {
        return r.anzahl ? U.num(U.avg(r.spieler.map(function (p) { return p.alter; })), 1) : '–'; } }
    ], D.POSITIONEN.map(function (pos) {
      var sp = kader.filter(function (p) { return p.pos === pos; });
      return { pos: pos, anzahl: sp.length, spieler: sp,
        beste: U.sortBy(sp, function (p) { return -P.posStaerke(p, pos); }).slice(0, 3) };
    }), {}) + '</div>';
    return html;
  }

  function transferAngebote(world) {
    var offen = world.transfer.angeboteEin.filter(function (a) { return a.status === 'offen'; });
    var html = '<div class="card"><h3>Eingegangene Angebote</h3>';
    if (!offen.length) html += '<div class="leer">Zurzeit liegen keine Angebote vor.</div>';
    offen.forEach(function (a) {
      var p = world.spieler[a.spielerId];
      var bieter = world.vereine[a.clubId];
      if (!p || !bieter) return;
      var rk = FM.transfers.rueckkaufKonditionen(a.ablöse);
      html += '<div class="card card--flat mb"><div class="flex flex--zwischen">' +
        '<div><b>' + esc(p.vorname + ' ' + p.nachname) + '</b> ' + UI.posTag(p.pos) +
        ' <span class="muted klein">Marktwert ' + U.money(p.marktwert) + '</span><br>' +
        '<span class="klein">Bieter: ' + esc(bieter.name) + ' · Frist ' + U.fmtDate(a.frist) + '</span></div>' +
        '<div class="rechts"><b style="font-size:18px">' + U.money(a.ablöse) + '</b><br>' +
        '<span class="klein muted">' + U.money(a.sofort) + ' sofort' +
        (a.boni ? ' · Boni bis ' + U.money(a.boni) : '') +
        (a.weiterverkauf ? ' · ' + a.weiterverkauf + ' % Beteiligung' : '') + '</span></div></div>' +
        '<label class="klein muted" style="display:flex;align-items:center;gap:6px;margin-top:8px">' +
        '<input type="checkbox" data-rk="' + esc(a.id) + '" style="width:auto">' +
        'Rückkaufoption vereinbaren: ' + U.money(rk.abschlag) + ' weniger Ablöse, dafür ' +
        'Rückholrecht für ' + U.money(rk.preis) + ' über ' + U.pl(rk.jahre, 'Jahr', 'Jahre') + '</label>' +
        '<div class="flex mt"><button class="btn btn--primary btn--sm" data-angebot="' + esc(a.id) + '" data-ja="1">Annehmen</button>' +
        '<button class="btn btn--sm" data-angebot="' + esc(a.id) + '" data-ja="0">Ablehnen</button>' +
        '<button class="btn btn--sm btn--ghost" data-spieler="' + esc(p.id) + '">Spieler ansehen</button></div></div>';
    });
    html += '</div>';

    // Eigene laufende Angebote
    html += '<div class="card mt"><h3>Eigene Angebote</h3>';
    var eigene = world.transfer.angeboteAus;
    if (!eigene.length) html += '<div class="leer">Sie haben derzeit kein Angebot laufen.</div>';
    else {
      html += UI.tabelle([
        { key: 's', label: 'Spieler', html: function (a) {
          var p = world.spieler[a.spielerId];
          return p ? esc(p.nachname) : '?'; } },
        { key: 'v', label: 'Verein', html: function (a) { return UI.vereinZelle(world, a.zielClubId, true); } },
        { key: 'b', label: 'Gebot', klasse: 'num', html: function (a) { return U.money(a.ablöse); } },
        { key: 'st', label: 'Stand', html: function (a) { return esc(a.status); } }
      ], eigene, {});
    }
    html += '</div>';

    // Gerüchte
    html += '<div class="card mt"><h3>Gerüchteküche</h3>';
    if (!world.transfer.geruechte.length) html += '<div class="leer">Nichts Neues.</div>';
    world.transfer.geruechte.slice(0, 10).forEach(function (g) {
      html += '<div class="stat-row"><span>' + U.fmtDate(g.tag, 'kurz') + '</span><b class="klein">' + esc(g.text) + '</b></div>';
    });
    html += '</div>';
    return html;
  }

  function transferMerkliste(world) {
    var liste = world.transfer.beobachtet.map(function (id) { return world.spieler[id]; }).filter(Boolean);
    return '<div class="card"><h3>Merkliste</h3>' +
      spielerMarktTabelle(world, liste, {}) + '</div>';
  }

  function transferScouting(world, z) {
    var auftraege = world.transfer.scoutAuftraege.filter(function (a) { return a.clubId === world.nutzerClubId; });
    var stab = world.stabWerteVon(world.nutzerClubId);
    var html = '<div class="card"><div class="card__head"><h3>Laufende Beobachtungsaufträge</h3>' +
      '<button class="btn btn--sm btn--primary" data-a="scoutreise">Neue Scoutingreise</button></div>' +
      '<p class="klein muted">Genauigkeit des Netzwerks: ' + Math.round(stab.scoutingGenauigkeit * 100) +
      ' %. Bessere Scouts liefern engere Einschätzungen.</p>';
    html += UI.tabelle([
      { key: 'art', label: 'Auftrag', html: function (a) {
        if (a.spielerId) {
          var p = world.spieler[a.spielerId];
          return 'Einzelbeobachtung: <b>' + (p ? esc(p.nachname) : '?') + '</b>';
        }
        var r = FM.transfers.SCOUT_REGIONEN.filter(function (x) { return x.id === a.regionId; })[0];
        return 'Reise: <b>' + esc(r ? r.name : a.regionId) + '</b>'; } },
      { key: 'p', label: 'Suchprofil', html: function (a) {
        var t = [];
        if (a.position) t.push(a.position);
        if (a.minAlter || a.maxAlter) t.push((a.minAlter || 16) + '–' + (a.maxAlter || 40) + ' Jahre');
        if (a.minStaerke) t.push('ab Stärke ' + a.minStaerke);
        return '<span class="klein muted">' + esc(t.join(' · ') || 'offen') + '</span>'; } },
      { key: 'f', label: 'Fertig', klasse: 'num', html: function (a) {
        return U.fmtDate(a.fertig) + ' <span class="klein muted">(' + Math.max(0, a.fertig - world.tag) + ' T)</span>'; } }
    ], auftraege, { leerText: 'Es läuft kein Auftrag.' });
    html += '</div>';

    html += scoutnetzKarte(world);
    return html;
  }

  /**
   * Das Scoutingnetz: wo der Verein Augen hat. Jede Reise verdichtet das
   * Netz, wo nichts mehr passiert, verfaellt es langsam. Wo das Netz
   * steht, beobachten die Scouts auch ohne Auftrag - und die naechste
   * Reise dorthin geht schneller.
   */
  function scoutnetzKarte(world) {
    var netz = FM.transfers.scoutnetzVon(world, world.nutzerClubId);
    var aktiv = netz.filter(function (n) { return n.stand > 0.02; });
    return '<div class="card mt"><div class="card__head"><h3>Scoutingnetz</h3>' +
      '<span class="chip">' + aktiv.length + ' von ' + netz.length + ' Regionen</span></div>' +
      '<p class="klein muted">Jede Reise verdichtet das Netz. Wo es steht, melden die Scouts ' +
      'auch ohne Auftrag, die Berichte werden genauer und die nächste Reise dorthin geht ' +
      'schneller. Ohne Pflege verfällt es.</p>' +
      netz.map(function (n) {
        var v = n.stand;
        return '<div class="stat-row"><span>' + esc(n.region.name) + '</span>' +
          '<span style="display:flex;align-items:center;gap:10px">' +
          UI.balken(v, v >= 0.58 ? '' : v >= 0.36 ? 'bar--gelb' : 'bar--rot') +
          '<b class="klein" style="min-width:88px;text-align:right">' +
          esc(FM.transfers.netzLabel(v)) + '</b></span></div>';
      }).join('') + '</div>';
  }

  /** Spieler, die der Verein per Rueckkaufoption zurueckholen kann. */
  function rueckkaufKarte(world) {
    var clubId = world.nutzerClubId;
    var liste = world.spielerIds.map(function (id) { return world.spieler[id]; })
      .filter(function (p) { return p && FM.transfers.rueckkaufOffen(world, p, clubId); });
    if (!liste.length) return '';
    return '<div class="card mt"><h3>Rückkaufoptionen</h3>' +
      '<p class="klein muted">Diese Spieler können Sie zum vereinbarten Preis zurückholen. ' +
      'Der abgebende Verein kann das nicht verhindern.</p>' +
      liste.map(function (p) {
        var r = p.rueckkauf;
        var club = world.vereine[p.clubId];
        return '<div class="stat-row"><span>' +
          '<b>' + esc(p.vorname + ' ' + p.nachname) + '</b> ' +
          '<span class="klein muted">' + esc(club ? club.name : '') + ' · gültig bis ' +
          esc(U.fmtDate(r.bis)) + '</span></span>' +
          '<span><b>' + U.money(r.preis) + '</b> ' +
          '<button class="btn btn--sm btn--primary" data-rueckkauf="' + esc(p.id) + '">Zurückholen</button></span>' +
          '</div>';
      }).join('') + '</div>';
  }

  function transferHistorie(world) {
    return '<div class="card"><h3>Abgeschlossene Transfers</h3>' + UI.tabelle([
      { key: 'tag', label: 'Datum', html: function (t) { return U.fmtDate(t.tag); } },
      { key: 'n', label: 'Spieler', html: function (t) { return '<span class="name">' + esc(t.name) + '</span>'; } },
      { key: 'v', label: 'Von', html: function (t) { return t.vonId ? UI.vereinZelle(world, t.vonId, true) : '<span class="muted">vereinslos</span>'; } },
      { key: 'z', label: 'Zu', html: function (t) { return UI.vereinZelle(world, t.zuId, true); } },
      { key: 'a', label: 'Ablöse', klasse: 'num', html: function (t) { return t.ablöse ? U.money(t.ablöse) : '<span class="muted">ablösefrei</span>'; } },
      { key: 'art', label: 'Art', html: function (t) { return t.art === 'leihe' ? '<span class="chip chip--blau">Leihe</span>' : '<span class="chip">Transfer</span>'; } }
    ], world.transfer.historie.slice(0, 80), { leerText: 'Noch keine Transfers.' }) + '</div>';
  }

  // ============================================================ Finanzen

  UI.views.finanzen = {
    html: function (world) {
      var club = world.nutzerVerein();
      var f = world.finanzen[club.id];
      var bilanz = f.jahresbilanz;
      var einnahmen = Object.keys(bilanz.einnahmen).reduce(function (a, k) { return a + bilanz.einnahmen[k]; }, 0);
      var ausgaben = Object.keys(bilanz.ausgaben).reduce(function (a, k) { return a + bilanz.ausgaben[k]; }, 0);
      var lohn = F.wochenLohnsumme(world, club.id);
      var prognose = F.jahresPrognose(world, club.id);

      var NAMEN_E = { tv: 'Medienerlöse', ticketing: 'Spieltagserlöse', sponsoring: 'Sponsoring',
        merchandising: 'Merchandising', preisgelder: 'Preisgelder', transfers: 'Transfererlöse', sonstige: 'Sonstiges' };
      var NAMEN_A = { spielergehaelter: 'Spielergehälter', personalgehaelter: 'Gehälter Mitarbeiter',
        ablosen: 'Ablösezahlungen', spielbetrieb: 'Spielbetrieb', stadion: 'Stadion &amp; Betrieb',
        nachwuchs: 'Nachwuchszentrum', verwaltung: 'Verwaltung', scouting: 'Scouting',
        geschaeft: 'Vertrieb, Reisen &amp; Abschreibungen',
        zinsen: 'Zinsen', sonstige: 'Sonstiges' };

      var html = '<div class="card__head"><h2>Finanzen</h2><div class="flex">' +
        '<button class="btn btn--sm" data-a="vorstand">Vorstandsanfrage</button>' +
        '<button class="btn btn--sm" data-a="tickets">Ticketpreise</button></div></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Kontostand</span><b class="' + (f.kontostand < 0 ? 'w-schlecht' : 'w-gut') + '">' +
        U.money(f.kontostand) + '</b></div>' +
        '<div class="tile"><span>Saldo der Saison</span><b class="' + (einnahmen - ausgaben < 0 ? 'w-schlecht' : 'w-gut') + '">' +
        U.money(einnahmen - ausgaben) + '</b></div>' +
        '<div class="tile"><span>Transferbudget</span><b>' + U.money(f.transferbudget) + '</b></div>' +
        '<div class="tile"><span>Gehaltsbudget</span><b>' + U.money(f.gehaltsbudget) + '</b><small>ausgeschöpft: ' +
        Math.round(lohn / Math.max(1, f.gehaltsbudget) * 100) + ' %</small></div>' +
        '<div class="tile"><span>Lohnquote</span><b>' +
        Math.round(lohn * 52 / Math.max(1, prognose) * 100) + ' %</b><small>Ziel unter 60 %</small></div>' +
        '<div class="tile"><span>Kredit</span><b>' + U.money(f.kredit.betrag) + '</b>' +
        (f.kredit.betrag ? '<small>' + U.num(f.kredit.zins * 100, 1) + ' % Zinsen</small>' : '') + '</div>' +
        '</div>';

      if (f.lizenzWarnung > 3) {
        html += '<div class="card card--flat mb" style="border-color:var(--rot)"><b class="w-schlecht">Lizenzauflage:</b> ' +
          'Der Verein ist seit ' + f.lizenzWarnung + ' Wochen im Minus. Bei anhaltender Unterdeckung droht Punktabzug.</div>';
      }

      html += '<div class="grid grid--2">';
      html += '<div class="card"><h3>Einnahmen dieser Saison</h3>';
      Object.keys(bilanz.einnahmen).forEach(function (k) {
        if (!bilanz.einnahmen[k]) return;
        html += '<div class="stat-row"><span>' + NAMEN_E[k] + '</span>' +
          '<span class="flex" style="gap:8px">' + UI.balken(bilanz.einnahmen[k] / Math.max(1, einnahmen)) +
          '<b style="min-width:96px;text-align:right">' + U.money(bilanz.einnahmen[k]) + '</b></span></div>';
      });
      html += '<div class="trenner"></div><div class="stat-row"><span><b>Summe</b></span><b>' + U.money(einnahmen) + '</b></div></div>';

      html += '<div class="card"><h3>Ausgaben dieser Saison</h3>';
      Object.keys(bilanz.ausgaben).forEach(function (k) {
        if (!bilanz.ausgaben[k]) return;
        html += '<div class="stat-row"><span>' + NAMEN_A[k] + '</span>' +
          '<span class="flex" style="gap:8px">' + UI.balken(bilanz.ausgaben[k] / Math.max(1, ausgaben), 'bar--rot') +
          '<b style="min-width:96px;text-align:right">' + U.money(bilanz.ausgaben[k]) + '</b></span></div>';
      });
      html += '<div class="trenner"></div><div class="stat-row"><span><b>Summe</b></span><b>' + U.money(ausgaben) + '</b></div></div>';
      html += '</div>';

      // Sponsoren
      html += '<div class="card mt"><h3>Sponsoring</h3>' + UI.tabelle([
        { key: 'a', label: 'Art', html: function (r) { return esc(r.art); } },
        { key: 'p', label: 'Partner', html: function (r) { return '<b>' + esc(r.partner) + '</b>'; } },
        { key: 'b', label: 'Jährlich', klasse: 'num', html: function (r) { return U.money(r.betrag); } }
      ], [
        { art: 'Trikotsponsor', partner: f.sponsoren.trikot.partner, betrag: f.sponsoren.trikot.betrag },
        { art: 'Ärmelsponsor', partner: f.sponsoren.aermel.partner, betrag: f.sponsoren.aermel.betrag },
        { art: 'Ausrüster', partner: f.sponsoren.ausruester.partner, betrag: f.sponsoren.ausruester.betrag },
        { art: 'Stadionname', partner: f.sponsoren.stadion.partner, betrag: f.sponsoren.stadion.betrag }
      ].concat(f.sponsoren.premium.map(function (p) {
        return { art: 'Premiumpartner', partner: p.partner, betrag: p.betrag };
      })), {}) + '</div>';

      // Buchungen
      html += '<div class="card mt"><h3>Letzte Buchungen</h3>' + UI.tabelle([
        { key: 't', label: 'Datum', html: function (b) { return U.fmtDate(b.tag); } },
        { key: 'x', label: 'Vorgang', html: function (b) { return esc(b.text); } },
        { key: 'b', label: 'Betrag', klasse: 'num', html: function (b) {
          return '<span class="' + (b.art === 'ein' ? 'w-gut' : 'w-schlecht') + '">' +
            (b.art === 'ein' ? '+' : '−') + U.money(b.betrag).replace('-', '') + '</span>'; } }
      ], f.buch.slice(-40).reverse(), { leerText: 'Keine Buchungen.' }) + '</div>';

      return html;
    },
    nachher: function (container, world) {
      var vb = container.querySelector('[data-a="vorstand"]');
      if (vb) vb.onclick = function () { V.vorstandsDialog(); };
      var tb = container.querySelector('[data-a="tickets"]');
      if (tb) tb.onclick = function () { V.ticketDialog(); };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
