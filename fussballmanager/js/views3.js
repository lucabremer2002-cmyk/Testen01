/*
 * views3.js - Verein, Personal, Nachwuchs, Medien, Statistik, Karriere
 * sowie sämtliche Dialoge (Gespräche, Verträge, Angebote, Spielbericht).
 */
(function (global) {
  'use strict';

  var FM = global.FM;
  var U = FM.util, D = FM.data, P = FM.players, T = FM.tactics;
  var C = FM.competitions, F = FM.finance, UI = FM.ui, V = FM.views;
  var esc = UI.esc;

  // ============================================================ Verein

  UI.views.verein = {
    html: function (world) {
      var club = world.nutzerVerein();
      var f = world.finanzen[club.id];
      var titel = world.historie.titel[club.id] || [];

      var html = '<div class="card__head"><h2>' + esc(club.name) + '</h2>' +
        '<button class="btn btn--sm" data-a="bau">Baumaßnahme beantragen</button></div>';

      html += '<div class="grid grid--2">';

      html += '<div class="card"><h3>Stammdaten</h3>' +
        '<div class="stat-row"><span>Stadt</span><b>' + esc(club.stadt) + '</b></div>' +
        '<div class="stat-row"><span>Stadion</span><b>' + esc(club.stadion) + '</b></div>' +
        '<div class="stat-row"><span>Kapazität</span><b>' + U.num(club.kapazitaet) + ' Plätze</b></div>' +
        '<div class="stat-row"><span>Dauerkarten</span><b>' + U.num(f.dauerkarten) + '</b></div>' +
        '<div class="stat-row"><span>Mitglieder</span><b>' + U.num(club.mitglieder) + '</b></div>' +
        '<div class="stat-row"><span>Ligazugehörigkeit</span><b>' +
        (club.liga === 1 ? 'Bundesliga' : club.liga === 2 ? '2. Bundesliga' : '3. Liga') + '</b></div>' +
        '<div class="stat-row"><span>Ruf</span><b>' + club.ruf + ' / 99</b></div>' +
        '<div class="stat-row"><span>Rasen</span><b>' + club.rasen + ' %</b></div>' +
        '</div>';

      html += '<div class="card"><h3>Infrastruktur</h3>' +
        infraZeile('Trainingszentrum', club.trainingszentrum) +
        infraZeile('Nachwuchsleistungszentrum', club.akademie) +
        infraZeile('Medizinische Abteilung', club.medizin) +
        infraZeile('Scoutingnetzwerk', club.scoutingnetz) +
        '<div class="trenner"></div>' +
        (club.bauprojekt
          ? '<div class="stat-row"><span>Laufende Baumaßnahme</span><b>' + esc(club.bauprojekt.name) + '</b></div>' +
            '<div class="stat-row"><span>Fertigstellung</span><b>' + U.fmtDate(club.bauprojekt.fertig) + '</b></div>'
          : '<p class="klein muted">Zurzeit läuft keine Baumaßnahme.</p>') +
        '</div>';

      html += '<div class="card"><h3>Fans</h3>' +
        '<div class="stat-row"><span>Stimmung</span><span class="flex" style="gap:8px">' +
        UI.balken(club.fanstimmung / 100, club.fanstimmung >= 60 ? '' : club.fanstimmung >= 35 ? 'bar--gelb' : 'bar--rot') +
        '<b>' + Math.round(club.fanstimmung) + ' %</b></span></div>' +
        '<div class="stat-row"><span>Anhängerschaft</span><b>' + club.fans + ' / 99</b></div>' +
        '<div class="stat-row"><span>Tradition</span><b>' + club.tradition + ' / 99</b></div>' +
        '<div class="stat-row"><span>Ticketpreis</span><b>' + U.money(f.ticketpreis) + '</b></div>' +
        '<p class="klein muted mt">Die Fans reagieren auf Ergebnisse, Ticketpreise und Ihre Aussagen in der Presse. ' +
        'Eine gute Stimmung bringt einen spürbaren Heimvorteil.</p></div>';

      html += '<div class="card"><h3>Titel &amp; Erfolge</h3>';
      if (!titel.length) html += '<div class="leer">Unter Ihrer Leitung noch keine Titel.</div>';
      else {
        html += UI.tabelle([
          { key: 's', label: 'Saison', html: function (t) { return t.saison + '/' + String(t.saison + 1).slice(2); } },
          { key: 't', label: 'Titel', html: function (t) { return '<b>' + esc(t.titel) + '</b>'; } }
        ], titel.slice().reverse(), {});
      }
      html += '</div>';
      html += '</div>';

      // Europapokal
      var euro = [];
      Object.keys(world.europa).forEach(function (k) {
        var wb = world.europa[k];
        if (wb.deutsche.indexOf(club.id) >= 0) euro.push(wb);
      });
      if (euro.length) {
        euro.forEach(function (wb) {
          var eintrag = wb.tabelle[club.id];
          html += '<div class="card mt"><h3>' + esc(wb.name) + '</h3>';
          if (eintrag) {
            html += '<div class="tiles mb">' +
              '<div class="tile"><span>Spiele</span><b>' + eintrag.spiele + '</b></div>' +
              '<div class="tile"><span>Punkte</span><b>' + eintrag.punkte + '</b></div>' +
              '<div class="tile"><span>Tore</span><b>' + eintrag.tore + ':' + eintrag.gegentore + '</b></div>' +
              '<div class="tile"><span>Bilanz</span><b>' + eintrag.siege + '-' + eintrag.remis + '-' + eintrag.niederlagen + '</b></div>' +
              '</div>';
          }
          var partien = world.spiele.filter(function (s) {
            return (s.europaId === wb.id) && (s.heimId === club.id || s.gastId === club.id);
          });
          html += UI.tabelle([
            { key: 'd', label: 'Datum', html: function (s) { return U.fmtDate(s.tag, 'wt'); } },
            { key: 'r', label: 'Runde', html: function (s) { return '<span class="klein">' + esc(s.rundeName) + '</span>'; } },
            { key: 'g', label: 'Gegner', html: function (s) {
              var gid = s.heimId === club.id ? s.gastId : s.heimId;
              return UI.vereinZelle(world, gid) + (s.heimId === club.id ? ' <span class="chip chip--gruen">H</span>' : ' <span class="chip">A</span>'); } },
            { key: 'e', label: 'Ergebnis', klasse: 'num', html: function (s) {
              if (!s.gespielt) return '<span class="muted">–</span>';
              var heim = s.heimId === club.id;
              var e = heim ? s.ergebnis.heimTore : s.ergebnis.gastTore;
              var a = heim ? s.ergebnis.gastTore : s.ergebnis.heimTore;
              return '<b class="' + (e > a ? 'w-gut' : e === a ? 'w-mittel' : 'w-schlecht') + '">' + e + ':' + a + '</b>'; } }
          ], partien, {}) + '</div>';
        });
      }

      return html;
    },
    nachher: function (container) {
      var b = container.querySelector('[data-a="bau"]');
      if (b) b.onclick = function () { V.bauDialog(); };
    }
  };

  function infraZeile(label, wert) {
    var text = wert >= 88 ? 'herausragend' : wert >= 74 ? 'sehr gut' : wert >= 60 ? 'gut'
      : wert >= 46 ? 'ausreichend' : wert >= 32 ? 'einfach' : 'dürftig';
    return '<div class="stat-row"><span>' + esc(label) + '</span>' +
      '<span class="flex" style="gap:8px">' + UI.balken(wert / 99) +
      '<b style="min-width:96px;text-align:right">' + text + '</b></span></div>';
  }

  // ============================================================ Personal

  UI.views.personal = {
    html: function (world) {
      var club = world.nutzerVerein();
      var stab = world.stabVon(club.id);
      var werte = world.stabWerteVon(club.id);
      var m = world.manager;

      var html = '<div class="card__head"><h2>Trainerstab &amp; Mitarbeiter</h2>' +
        '<button class="btn btn--sm" data-a="einstellen">Mitarbeiter suchen</button></div>';

      html += '<div class="card mb"><h3>Cheftrainer</h3>' +
        '<div class="stat-row"><span>Name</span><b>' + esc(m.name) + ' (' + m.alter + ')</b></div>' +
        '<div class="stat-row"><span>Ruf</span><b>' + Math.round(m.ruf) + ' / 99</b></div>' +
        '<div class="stat-row"><span>Vertrag bis</span><b>' + U.fmtDate(m.vertragBis) + '</b></div>' +
        '<div class="stat-row"><span>Gehalt</span><b>' + U.money(m.gehalt) + ' / Woche</b></div>' +
        '</div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Trainingsqualität</span><b>' + Math.round(werte.trainingsqualitaet) + '</b></div>' +
        '<div class="tile"><span>Verletzungsschutz</span><b>' + Math.round(werte.verletzungsschutz * 100) + ' %</b></div>' +
        '<div class="tile"><span>Reha-Tempo</span><b>' + U.num(werte.rehaTempo, 2) + '×</b></div>' +
        '<div class="tile"><span>Scouting</span><b>' + Math.round(werte.scoutingGenauigkeit * 100) + ' %</b></div>' +
        '<div class="tile"><span>Verhandlung</span><b>' + Math.round(werte.verhandlung * 100) + ' %</b></div>' +
        '<div class="tile"><span>Jugendarbeit</span><b>' + Math.round(werte.jugendQualitaet * 100) + ' %</b></div>' +
        '</div>';

      html += '<div class="card">' + UI.tabelle([
        { key: 'r', label: 'Funktion', haft: true, wert: function (s) { return FM.staff.ROLLE_REIHENFOLGE.indexOf(s.rolle); },
          html: function (s) { return '<b>' + esc(D.STAFF_ROLLEN[s.rolle].name) + '</b>'; } },
        { key: 'n', label: 'Name', wert: function (s) { return s.nachname; },
          html: function (s) { return esc(s.vorname + ' ' + s.nachname); } },
        { key: 'a', label: 'Alter', klasse: 'num', wert: function (s) { return s.alter; }, html: function (s) { return s.alter; } },
        { key: 'k', label: 'Kompetenz', klasse: 'num', wert: function (s) { return FM.staff.koennen(s); },
          html: function (s) { return UI.wert(FM.staff.koennen(s)); } },
        { key: 'w', label: 'Wirkung', html: function (s) {
          return '<span class="klein muted">' + esc(D.STAFF_ROLLEN[s.rolle].wirkung) + '</span>'; } },
        { key: 'g', label: 'Gehalt', klasse: 'num', wert: function (s) { return s.gehalt; },
          html: function (s) { return U.money(s.gehalt); } },
        { key: 'v', label: 'Vertrag', klasse: 'num', wert: function (s) { return s.vertragBis; },
          html: function (s) { return U.fmtDate(s.vertragBis); } },
        { key: 'x', label: '', klasse: 'num', html: function (s) {
          return '<button class="btn btn--sm" data-entlassen="' + esc(s.id) + '">entlassen</button>'; } }
      ], stab, { sortKey: 'r', absteigend: false }) + '</div>';

      return html;
    },
    nachher: function (container, world) {
      var b = container.querySelector('[data-a="einstellen"]');
      if (b) b.onclick = function () { V.personalDialog(); };
      Array.prototype.forEach.call(container.querySelectorAll('[data-entlassen]'), function (e) {
        e.onclick = function () {
          var m = world.stab[e.dataset.entlassen];
          if (!m) return;
          var abfindung = Math.round(m.gehalt * 26);
          UI.bestaetigen('Mitarbeiter entlassen',
            esc(m.vorname + ' ' + m.nachname) + ' entlassen? Es wird eine Abfindung von <b>' +
            U.money(abfindung) + '</b> fällig.', function () {
              F.buche(world, world.nutzerClubId, 'aus', 'personalgehaelter', abfindung, 'Abfindung ' + m.nachname);
              m.clubId = null;
              world.stabIndexVerwerfen();
              world.stabCacheLeeren();
              UI.toast('Mitarbeiter entlassen.');
              UI.zeichne();
            }, 'Entlassen', true);
        };
      });
      UI.tabelleSortierung(container, 'personal');
    }
  };

  V.personalDialog = function () {
    var world = UI.world;
    var rollen = FM.staff.ROLLE_REIHENFOLGE;
    var html = '<h2>Mitarbeiter suchen</h2><p class="muted">Wählen Sie die Funktion. Die Personalabteilung legt Ihnen ' +
      'passende Kandidaten vor.</p><div class="optionen">' +
      rollen.map(function (r) {
        var vorhanden = world.stabVon(world.nutzerClubId).filter(function (m) { return m.rolle === r; }).length;
        return '<button class="option" data-r="' + r + '"><b>' + esc(D.STAFF_ROLLEN[r].name) + '</b> ' +
          '<span class="chip">' + vorhanden + ' im Verein</span><br><span class="klein muted">' +
          esc(D.STAFF_ROLLEN[r].wirkung) + '</span></button>';
      }).join('') + '</div>';
    UI.modal(html, {
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-r]'), function (b) {
          b.onclick = function () { zeigeBewerber(b.dataset.r); };
        });
      }
    });
  };

  function zeigeBewerber(rolleId) {
    var world = UI.world;
    var liste = FM.staff.bewerber(world.rng, world, rolleId, world.nutzerClubId, 6);
    var html = '<h2>Bewerber: ' + esc(D.STAFF_ROLLEN[rolleId].name) + '</h2>' +
      UI.tabelle([
        { key: 'n', label: 'Name', html: function (m) { return '<b>' + esc(m.vorname + ' ' + m.nachname) + '</b>'; } },
        { key: 'a', label: 'Alter', klasse: 'num', html: function (m) { return m.alter; } },
        { key: 'k', label: 'Kompetenz', klasse: 'num', html: function (m) { return UI.wert(FM.staff.koennen(m)); } },
        { key: 'd', label: 'Stärken', html: function (m) {
          return '<span class="klein muted">' + D.STAFF_ROLLEN[rolleId].attrs.map(function (a) {
            return esc(D.STAFF_ATTR_NAME[a]) + ' ' + m.attr[a];
          }).join(' · ') + '</span>'; } },
        { key: 'g', label: 'Gehalt', klasse: 'num', html: function (m) { return U.money(m.gehalt); } },
        { key: 'x', label: '', klasse: 'num', html: function (m) {
          return '<button class="btn btn--sm btn--primary" data-hire="' + esc(m.id) + '">verpflichten</button>'; } }
      ], liste, {});
    UI.modal(html, {
      breit: true,
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-hire]'), function (b) {
          b.onclick = function () {
            var m = liste.filter(function (x) { return x.id === b.dataset.hire; })[0];
            if (!m) return;
            var f = world.finanzen[world.nutzerClubId];
            if (F.wochenLohnsumme(world, world.nutzerClubId) + m.gehalt > f.gehaltsbudget * 1.05) {
              UI.toast('Das Gehaltsbudget lässt diese Verpflichtung nicht zu.', 'fehler');
              return;
            }
            m.clubId = world.nutzerClubId;
            m.vertragBis = world.tag + 3 * 365;
            world.stab[m.id] = m;
            world.stabIds.push(m.id);
            world.stabIndexVerwerfen();
            world.stabCacheLeeren();
            UI.modalZu();
            UI.toast(m.vorname + ' ' + m.nachname + ' verpflichtet.', 'gut');
            UI.zeichne();
          };
        });
      }
    });
  }

  // ============================================================ Nachwuchs

  UI.views.nachwuchs = {
    html: function (world) {
      var club = world.nutzerVerein();
      var kader = world.kaderVon(club.id);
      var talente = U.sortBy(kader.filter(function (p) { return p.alter <= 21; }),
        function (p) { return -(p.potenzial * 1.5 - p.alter * 2); });
      var stab = world.stabWerteVon(club.id);
      var hinweise = FM.youth.entwicklungsHinweise(world, club.id);

      var html = '<div class="card__head"><h2>Nachwuchs</h2></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Akademie</span><b>' + club.akademie + '</b><small>Ausbaustufe</small></div>' +
        '<div class="tile"><span>Nachwuchsleiter</span><b>' + Math.round(stab.nachwuchsleiter) + '</b></div>' +
        '<div class="tile"><span>Jahrgangsqualität</span><b>' + Math.round(stab.jugendQualitaet * 100) + ' %</b></div>' +
        '<div class="tile"><span>Spieler bis 21</span><b>' + talente.length + '</b></div>' +
        '<div class="tile"><span>Eigengewächse</span><b>' + kader.filter(function (p) { return p.eigengewaechs; }).length + '</b></div>' +
        '</div>';

      if (hinweise.length) {
        html += '<div class="card card--flat mb"><h4>Hinweise des Nachwuchsleiters</h4>' +
          hinweise.map(function (h) { return '<div class="msg" data-spieler="' + esc(h.spielerId) + '">' +
            '<div class="msg__icon">★</div><div class="msg__body"><p>' + esc(h.text) + '</p></div></div>'; }).join('') +
          '</div>';
      }

      html += '<div class="card">' + UI.tabelle([
        { key: 'n', label: 'Spieler', haft: true, wert: function (p) { return p.nachname; }, html: function (p) {
          return '<span class="name">' + esc(p.nachname) + '</span> <span class="muted klein">' + esc(p.vorname) + '</span>' +
            (p.eigengewaechs ? ' <span class="chip chip--lila">★</span>' : ''); } },
        { key: 'pos', label: 'Pos', wert: function (p) { return D.POSITIONEN.indexOf(p.pos); }, html: function (p) { return UI.posTag(p.pos); } },
        { key: 'alter', label: 'Alter', klasse: 'num', wert: function (p) { return p.alter; }, html: function (p) { return p.alter; } },
        { key: 's', label: 'Aktuell', klasse: 'num', wert: function (p) { return P.gesamt(p); },
          html: function (p) { return UI.wert(P.gesamt(p)); } },
        { key: 'p', label: 'Potenzial', klasse: 'num', wert: function (p) { return p.potenzial; }, html: function (p) {
          var e = FM.youth.einschaetzung(world, club.id, p);
          return UI.wert(e.min) + '–' + UI.wert(e.max); } },
        { key: 'e', label: 'Einschätzung', html: function (p) {
          return '<span class="klein">' + esc(FM.youth.einschaetzung(world, club.id, p).text) + '</span>'; } },
        { key: 'm', label: 'Einsätze', klasse: 'num', wert: function (p) { return p.stats.minuten; },
          html: function (p) { return p.stats.spiele + ' <span class="muted klein">(' + U.num(p.stats.minuten) + ' Min)</span>'; } },
        { key: 'tl', label: 'Training', klasse: 'num', wert: function (p) { return p.trainingsleistung; },
          html: function (p) { return UI.balken(p.trainingsleistung / 100); } },
        { key: 'v', label: 'Vertrag', klasse: 'num', wert: function (p) { return p.vertrag ? p.vertrag.bis : 0; },
          html: function (p) { return p.vertrag ? U.fmtDate(p.vertrag.bis) : '–'; } }
      ], talente, {
        zeilenKlasse: function () { return 'is-clickable'; },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Zurzeit stehen keine Nachwuchsspieler im Kader.'
      }) + '</div>';

      html += '<div class="card card--flat mt klein muted">Jedes Jahr im Sommer rückt ein neuer Jahrgang nach. ' +
        'Wie stark er ist, hängt an der Ausbaustufe der Akademie und am Nachwuchsleiter. ' +
        'Talente entwickeln sich nur mit Spielpraxis – wer nie spielt, stagniert.</div>';
      return html;
    },
    nachher: function (container, world) { V.verdrahteAllgemein(container, world); }
  };

  // ============================================================ Medien

  UI.views.medien = {
    html: function (world, z) {
      z.filter = z.filter || 'alle';
      var inbox = world.inbox.filter(function (n) {
        if (z.filter === 'alle') return true;
        if (z.filter === 'ungelesen') return !n.gelesen;
        return n.typ === z.filter;
      });

      var html = '<div class="card__head"><h2>Postfach</h2><div class="flex">' +
        '<select data-f="filter" style="width:auto">' +
        [['alle', 'Alle'], ['ungelesen', 'Ungelesen'], ['transfer', 'Transfermarkt'], ['angebot', 'Angebote'],
         ['medizin', 'Medizin'], ['kabine', 'Kabine'], ['vorstand', 'Vorstand'], ['verband', 'Verband'],
         ['wettbewerb', 'Wettbewerbe'], ['scouting', 'Scouting'], ['training', 'Training']].map(function (o) {
          return '<option value="' + o[0] + '"' + (z.filter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>' +
        '<button class="btn btn--sm" data-a="alleGelesen">Alle als gelesen markieren</button></div></div>';

      html += '<div class="card">';
      if (!inbox.length) html += '<div class="leer">Keine Nachrichten.</div>';
      inbox.slice(0, 120).forEach(function (n) {
        html += '<div class="msg' + (n.gelesen ? '' : ' msg--ungelesen') + (n.prioritaet >= 3 ? ' msg--wichtig' : '') +
          '" data-msg="' + esc(n.id) + '">' +
          '<div class="msg__icon">' + UI.nachrichtIcon(n.typ) + '</div>' +
          '<div class="msg__body"><b>' + esc(n.titel) + '</b><p>' + esc(n.text) + '</p></div>' +
          '<div class="msg__datum">' + U.fmtDate(n.tag, 'wt') + '</div></div>';
      });
      html += '</div>';
      return html;
    },
    nachher: function (container, world, z) {
      var sel = container.querySelector('[data-f="filter"]');
      if (sel) sel.onchange = function () { z.filter = sel.value; UI.zeichne(); };
      var alle = container.querySelector('[data-a="alleGelesen"]');
      if (alle) alle.onclick = function () {
        world.inbox.forEach(function (n) { n.gelesen = true; });
        UI.zeichne(); UI.toast('Alles gelesen.');
      };
      V.verdrahteAllgemein(container, world);
    }
  };

  // ============================================================ Statistik

  UI.views.statistik = {
    html: function (world, z) {
      z.liga = z.liga || (world.ligaVon(world.nutzerClubId) || world.ligen.bl1).id;
      var liga = world.ligen[z.liga];
      var teams = liga.teams;

      function ligaSpieler() {
        var out = [];
        teams.forEach(function (id) {
          world.kaderVon(id).forEach(function (p) { out.push(p); });
        });
        return out;
      }
      var spieler = ligaSpieler();

      var html = '<div class="card__head"><h2>Statistik</h2>' +
        '<select data-f="liga" style="width:auto">' +
        world.ligaIds.slice(0, 2).map(function (id) {
          return '<option value="' + id + '"' + (z.liga === id ? ' selected' : '') + '>' + esc(world.ligen[id].name) + '</option>';
        }).join('') + '</select></div>';

      html += '<div class="grid grid--2">';

      html += '<div class="card"><h3>Torschützenliste</h3>' + UI.tabelle([
        { key: 'r', label: '#', klasse: 'num', html: function (p, i) { return p.__rang; } },
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 't', label: 'Tore', klasse: 'num', html: function (p) { return '<b>' + p.stats.tore + '</b>'; } },
        { key: 'm', label: 'Min/Tor', klasse: 'num', html: function (p) {
          return p.stats.tore ? Math.round(p.stats.minuten / p.stats.tore) : '–'; } },
        { key: 'xg', label: 'xG', klasse: 'num', html: function (p) { return U.num(p.stats.xG, 1); } }
      ], U.sortBy(spieler.filter(function (p) { return p.stats.tore > 0; }),
        function (p) { return -p.stats.tore; }).slice(0, 15).map(function (p, i) { p.__rang = i + 1; return p; }), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Noch keine Tore gefallen.'
      }) + '</div>';

      html += '<div class="card"><h3>Vorlagen</h3>' + UI.tabelle([
        { key: 'r', label: '#', klasse: 'num', html: function (p) { return p.__rang; } },
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 'a', label: 'Vorl.', klasse: 'num', html: function (p) { return '<b>' + p.stats.vorlagen + '</b>'; } },
        { key: 'x', label: 'xA', klasse: 'num', html: function (p) { return U.num(p.stats.xA, 1); } }
      ], U.sortBy(spieler.filter(function (p) { return p.stats.vorlagen > 0; }),
        function (p) { return -p.stats.vorlagen; }).slice(0, 15).map(function (p, i) { p.__rang = i + 1; return p; }), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Noch keine Vorlagen.'
      }) + '</div>';

      html += '<div class="card"><h3>Beste Durchschnittsnoten</h3>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 's', label: 'Sp', klasse: 'num', html: function (p) { return p.stats.spiele; } },
        { key: 'no', label: 'Ø Note', klasse: 'num', html: function (p) { return UI.noteZelle(P.schnitt(p.stats)); } }
      ], U.sortBy(spieler.filter(function (p) { return p.stats.spiele >= 8; }),
        function (p) { return P.schnitt(p.stats); }).slice(0, 15), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Zu wenige Spiele absolviert.'
      }) + '</div>';

      html += '<div class="card"><h3>Torhüter</h3>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 'z', label: 'Zu Null', klasse: 'num', html: function (p) { return '<b>' + p.stats.zuNull + '</b>'; } },
        { key: 'g', label: 'Gegentore', klasse: 'num', html: function (p) { return p.stats.gegentore; } },
        { key: 'pa', label: 'Paraden', klasse: 'num', html: function (p) { return p.stats.paraden; } }
      ], U.sortBy(spieler.filter(function (p) { return p.pos === 'TW' && p.stats.spiele >= 5; }),
        function (p) { return -p.stats.zuNull; }).slice(0, 12), { leerText: 'Zu wenige Spiele.' }) + '</div>';
      html += '</div>';

      // Mannschaftsstatistik
      var tab = C.sortierteTabelle(liga);
      html += '<div class="card mt"><h3>Mannschaftswerte</h3>' + UI.tabelle([
        { key: 'v', label: 'Verein', html: function (e) { return UI.vereinZelle(world, e.clubId); } },
        { key: 'sp', label: 'Sp', klasse: 'num', wert: function (e) { return e.spiele; }, html: function (e) { return e.spiele; } },
        { key: 't', label: 'Tore', klasse: 'num', wert: function (e) { return e.tore; }, html: function (e) { return e.tore; } },
        { key: 'g', label: 'Gegentore', klasse: 'num', wert: function (e) { return e.gegentore; }, html: function (e) { return e.gegentore; } },
        { key: 'ts', label: 'Tore/Spiel', klasse: 'num', wert: function (e) { return e.spiele ? e.tore / e.spiele : 0; },
          html: function (e) { return e.spiele ? U.num(e.tore / e.spiele, 2) : '–'; } },
        { key: 'kw', label: 'Kaderwert', klasse: 'num', wert: function (e) {
          return U.sum(world.kaderVon(e.clubId).map(function (p) { return p.marktwert; })); },
          html: function (e) { return U.money(U.sum(world.kaderVon(e.clubId).map(function (p) { return p.marktwert; }))); } },
        { key: 'al', label: 'Ø Alter', klasse: 'num', wert: function (e) {
          return U.avg(world.kaderVon(e.clubId).map(function (p) { return p.alter; })); },
          html: function (e) { return U.num(U.avg(world.kaderVon(e.clubId).map(function (p) { return p.alter; })), 1); } },
        { key: 'zs', label: 'Ø Zuschauer', klasse: 'num', wert: function (e) { return zuschauerSchnitt(world, e.clubId); },
          html: function (e) { var v = zuschauerSchnitt(world, e.clubId); return v ? U.num(Math.round(v)) : '–'; } }
      ], tab, { sortKey: z.sortKey, absteigend: z.absteigend,
        zeilenKlasse: function (e) { return e.clubId === world.nutzerClubId ? 'tr-eigen' : ''; } }) + '</div>';

      return html;
    },
    nachher: function (container, world, z) {
      var sel = container.querySelector('[data-f="liga"]');
      if (sel) sel.onchange = function () { z.liga = sel.value; UI.zeichne(); };
      UI.tabelleSortierung(container, 'statistik');
      V.verdrahteAllgemein(container, world);
    }
  };

  function zuschauerSchnitt(world, clubId) {
    var heim = world.spiele.filter(function (s) {
      return s.heimId === clubId && s.gespielt && s.wettbewerb === 'liga';
    });
    if (!heim.length) return 0;
    return U.avg(heim.map(function (s) { return s.ergebnis.zuschauer; }));
  }

  // ============================================================ Karriere

  UI.views.karriere = {
    html: function (world) {
      var m = world.manager;
      var html = '<div class="card__head"><h2>Karriere</h2><div class="flex">' +
        '<button class="btn btn--sm" data-a="export">Spielstand exportieren</button>' +
        '<button class="btn btn--sm btn--danger" data-a="neu">Neue Karriere</button></div></div>';

      html += '<div class="tiles mb">' +
        '<div class="tile"><span>Trainer</span><b style="font-size:15px">' + esc(m.name) + '</b><small>' + m.alter + ' Jahre</small></div>' +
        '<div class="tile"><span>Ruf</span><b>' + Math.round(m.ruf) + '</b></div>' +
        '<div class="tile"><span>Spiele</span><b>' + m.bilanz.spiele + '</b></div>' +
        '<div class="tile"><span>Siege</span><b>' + m.bilanz.siege + '</b><small>' +
        (m.bilanz.spiele ? Math.round(m.bilanz.siege / m.bilanz.spiele * 100) : 0) + ' %</small></div>' +
        '<div class="tile"><span>Punkteschnitt</span><b>' +
        (m.bilanz.spiele ? U.num((m.bilanz.siege * 3 + m.bilanz.remis) / m.bilanz.spiele, 2) : '–') + '</b></div>' +
        '<div class="tile"><span>Titel</span><b>' + m.titel.length + '</b></div>' +
        '</div>';

      html += '<div class="grid grid--2">';
      html += '<div class="card"><h3>Stationen</h3>' + UI.tabelle([
        { key: 's', label: 'Saison', html: function (k) { return k.saison + '/' + String(k.saison + 1).slice(2); } },
        { key: 'v', label: 'Verein', html: function (k) { return UI.vereinZelle(world, k.clubId, true); } },
        { key: 'l', label: 'Liga', html: function (k) { return k.liga === 1 ? 'BL' : k.liga === 2 ? '2. BL' : '3. L'; } },
        { key: 'p', label: 'Platz', klasse: 'num', html: function (k) { return k.platz + '.'; } },
        { key: 'pk', label: 'Punkte', klasse: 'num', html: function (k) { return k.punkte; } },
        { key: 'z', label: 'Ziel', html: function (k) {
          return '<span class="chip ' + (k.erreicht ? 'chip--gruen' : 'chip--rot') + '">' +
            (k.erreicht ? 'erreicht' : 'verfehlt') + '</span> <span class="klein muted">' + esc(k.ziel) + '</span>'; } }
      ], m.karriere.slice().reverse(), { leerText: 'Noch keine abgeschlossene Saison.' }) + '</div>';

      html += '<div class="card"><h3>Titel</h3>' + UI.tabelle([
        { key: 's', label: 'Saison', html: function (t) { return t.saison + '/' + String(t.saison + 1).slice(2); } },
        { key: 't', label: 'Titel', html: function (t) { return '<b>' + esc(t.titel) + '</b>'; } }
      ], m.titel.slice().reverse(), { leerText: 'Noch keine Titel gewonnen.' }) + '</div>';
      html += '</div>';

      // Chronik der Liga
      html += '<div class="card mt"><h3>Chronik</h3>' + UI.tabelle([
        { key: 's', label: 'Saison', html: function (s) { return s.saison + '/' + String(s.saison + 1).slice(2); } },
        { key: 'm', label: 'Deutscher Meister', html: function (s) { return UI.vereinZelle(world, s.meister); } },
        { key: 'p', label: 'Pokalsieger', html: function (s) { return s.pokalsieger ? UI.vereinZelle(world, s.pokalsieger) : '–'; } },
        { key: 't', label: 'Torschützenkönig', html: function (s) {
          return s.torschuetzenkoenig ? esc(s.torschuetzenkoenig.name) + ' (' + s.torschuetzenkoenig.tore + ')' : '–'; } },
        { key: 'a', label: 'Absteiger', html: function (s) {
          return '<span class="klein">' + (s.absteiger || []).map(function (id) {
            return UI.vereinName(world, id, true); }).join(', ') + '</span>'; } }
      ], world.historie.saisons.slice().reverse(), { leerText: 'Noch keine abgeschlossene Saison.' }) + '</div>';

      // Einstellungen
      html += '<div class="card mt"><h3>Einstellungen</h3>' +
        '<div class="stat-row"><span>Geschwindigkeit der Live-Simulation</span>' +
        '<select data-e="simGeschwindigkeit" style="width:auto">' +
        [[1, 'Langsam'], [2, 'Normal'], [3, 'Schnell'], [4, 'Sehr schnell']].map(function (o) {
          return '<option value="' + o[0] + '"' + (world.einstellungen.simGeschwindigkeit === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>' +
        '<div class="stat-row"><span>Aufstellung vor jedem Spiel automatisch optimieren</span>' +
        '<input type="checkbox" data-e="autoAufstellung" style="width:auto"' +
        (world.einstellungen.autoAufstellung ? ' checked' : '') + '></div>' +
        '<div class="stat-row"><span>Automatisch zwischenspeichern</span>' +
        '<input type="checkbox" data-e="autoSpeichern" style="width:auto"' +
        (world.einstellungen.autoSpeichern !== false ? ' checked' : '') + '></div>' +
        '<p class="klein muted" style="margin:10px 0 0">' + esc(UI.speicherStandText()) + '</p>' +
        '</div>';

      return html;
    },
    nachher: function (container, world) {
      var ex = container.querySelector('[data-a="export"]');
      if (ex) ex.onclick = function () { FM.save.exportieren(world); UI.toast('Spielstand heruntergeladen.', 'gut'); };
      var neu = container.querySelector('[data-a="neu"]');
      if (neu) neu.onclick = function () {
        UI.bestaetigen('Neue Karriere', 'Der aktuelle Spielstand geht dabei verloren, sofern er nicht gespeichert ist. Fortfahren?',
          function () { FM.save.loeschen(); global.location.reload(); }, 'Neu starten', true);
      };
      Array.prototype.forEach.call(container.querySelectorAll('[data-e]'), function (e) {
        e.onchange = function () {
          world.einstellungen[e.dataset.e] = e.type === 'checkbox' ? e.checked : parseInt(e.value, 10);
          UI.toast('Einstellung gespeichert.');
        };
      });
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
