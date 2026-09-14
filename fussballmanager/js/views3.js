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

  /**
   * Vereinsrekorde unter der eigenen Leitung: hoechster Sieg, hoechste
   * Niederlage, Zuschauerrekord, laengste Serien und die teuersten
   * Transfers.
   */
  function rekordKarte(world, club) {
    var r = world.rekorde;
    if (!r) return '';
    function partie(e, sieg) {
      if (!e) return '<span class="muted">–</span>';
      var g = world.vereine[e.gegnerId];
      return '<b class="' + (sieg ? 'w-gut' : 'w-schlecht') + '">' + e.tore + ':' + e.gegentore + '</b> ' +
        '<span class="klein muted">' + (e.heim ? 'gegen ' : 'bei ') + esc(g ? g.kurz : '?') +
        ', ' + esc(U.fmtDate(e.tag)) + '</span>';
    }
    function transfer(e) {
      if (!e) return '<span class="muted">–</span>';
      var g = world.vereine[e.gegenueber];
      return '<b>' + U.money(e.ablöse) + '</b> <span class="klein muted">' + esc(e.name) +
        (g ? ' · ' + esc(g.kurz) : '') + ', ' + esc(U.fmtDate(e.tag)) + '</span>';
    }
    var leer = !r.hoechsterSieg && !r.hoechsteNiederlage && !r.zuschauerrekord &&
      !r.rekordzugang && !r.rekordabgang;
    return '<div class="card mt"><h3>Rekorde unter Ihrer Leitung</h3>' +
      (leer ? '<div class="leer">Noch keine Rekorde – die ersten Spiele stehen aus.</div>' :
        '<div class="stat-row"><span>Höchster Sieg</span><span>' + partie(r.hoechsterSieg, true) + '</span></div>' +
        '<div class="stat-row"><span>Höchste Niederlage</span><span>' + partie(r.hoechsteNiederlage, false) + '</span></div>' +
        '<div class="stat-row"><span>Zuschauerrekord</span><span>' +
          (r.zuschauerrekord
            ? '<b>' + U.num(r.zuschauerrekord.zahl) + '</b> <span class="klein muted">gegen ' +
              esc((world.vereine[r.zuschauerrekord.gegnerId] || {}).kurz || '?') + ', ' +
              esc(U.fmtDate(r.zuschauerrekord.tag)) + '</span>'
            : '<span class="muted">–</span>') + '</span></div>' +
        '<div class="stat-row"><span>Längste Siegesserie</span><b>' +
          U.pl(r.besteSerieSiege || 0, 'Spiel', 'Spiele') + '</b></div>' +
        '<div class="stat-row"><span>Längste Serie ohne Niederlage</span><b>' +
          U.pl(r.besteSerieUngeschlagen || 0, 'Spiel', 'Spiele') + '</b></div>' +
        '<div class="stat-row"><span>Teuerster Zugang</span><span>' + transfer(r.rekordzugang) + '</span></div>' +
        '<div class="stat-row"><span>Teuerster Abgang</span><span>' + transfer(r.rekordabgang) + '</span></div>'
      ) + '</div>';
  }

  UI.views.verein = {
    html: function (world) {
      var club = world.nutzerVerein();
      var f = world.finanzen[club.id];
      var titel = world.historie.titel[club.id] || [];

      var html = '<div class="card__head"><span></span>' +
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
        '<div class="stat-row"><span>Anhängerschaft</span><b>' + Math.round(club.fans) + ' / 99</b></div>' +
        '<div class="stat-row"><span>Tradition</span><b>' + Math.round(club.tradition) + ' / 99</b></div>' +
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

      html += kooperationsKarte(world, club);
      html += rekordKarte(world, club);

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
    nachher: function (container, world) {
      var club = world.nutzerVerein();
      var b = container.querySelector('[data-a="bau"]');
      if (b) b.onclick = function () { V.bauDialog(); };
      var koopNeu = container.querySelector('[data-a="koop-neu"]');
      if (koopNeu) koopNeu.onclick = function () { kooperationsDialog(world, club); };
      Array.prototype.forEach.call(container.querySelectorAll('[data-koop-ende]'), function (e) {
        e.onclick = function () {
          var id = e.getAttribute('data-koop-ende');
          UI.bestaetigen('Kooperation beenden',
            'Die Partnerschaft mit <b>' + esc(world.vereine[id].name) + '</b> auflösen?',
            function () {
              FM.kooperation.beenden(world, club.id, id);
              UI.toast('Partnerschaft beendet.');
              UI.zeichne();
            });
        };
      });
      V.verdrahteAllgemein(container, world);
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

      var html = '<div class="card__head"><span></span>' +
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

      var html = '';

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

      html += u23Karte(world, kader);

      html += '<div class="card card--flat mt klein muted">Jedes Jahr im Sommer rückt ein neuer Jahrgang nach. ' +
        'Wie stark er ist, hängt an der Ausbaustufe der Akademie und am Nachwuchsleiter. ' +
        'Talente entwickeln sich nur mit Spielpraxis – wer nie spielt, stagniert.</div>';
      return html;
    },
    nachher: function (container, world) {
      V.verdrahteAllgemein(container, world);
      Array.prototype.forEach.call(container.querySelectorAll('[data-u23]'), function (b) {
        b.onclick = function (ev) {
          ev.stopPropagation();
          var p = world.spieler[b.dataset.u23];
          if (!p) return;
          p.zweitteam = !p.zweitteam;
          UI.toast(p.zweitteam
            ? p.nachname + ' spielt ab sofort in der U23.'
            : p.nachname + ' ist zurück im Profikader.', 'gut');
          UI.zeichne();
        };
      });
    }
  };

  /**
   * Die zweite Mannschaft. Sie wird nicht ausgespielt - was zaehlt, ist
   * die Spielpraxis: Wer hier spielt, entwickelt sich, als haette er
   * weitgehend durchgespielt, und verlangt keine Profiminuten.
   */
  function u23Karte(world, kader) {
    var moeglich = kader.filter(function (p) { return P.u23Moeglich(p); });
    var drin = moeglich.filter(function (p) { return p.zweitteam; });
    return '<div class="card mt"><div class="card__head"><h3>Zweite Mannschaft (U23)</h3>' +
      '<span class="chip">' + U.pl(drin.length, 'Spieler', 'Spieler') + '</span></div>' +
      '<p class="klein muted">Wer im Profikader keine Minuten bekommt, sammelt sie hier. ' +
      'Spieler in der U23 entwickeln sich weiter und werden nicht unzufrieden, ' +
      'weil sie oben nicht spielen. Bis 23 Jahre.</p>' +
      UI.tabelle([
        { key: 'n', label: 'Spieler', haft: true, wert: function (p) { return p.nachname; },
          html: function (p) {
            return '<span class="name">' + esc(p.nachname) + '</span> ' +
              '<span class="muted klein">' + esc(p.vorname) + '</span>';
          } },
        { key: 'pos', label: 'Pos', wert: function (p) { return D.POSITIONEN.indexOf(p.pos); },
          html: function (p) { return UI.posTag(p.pos); } },
        { key: 'alter', label: 'Alter', klasse: 'num', wert: function (p) { return p.alter; },
          html: function (p) { return p.alter; } },
        { key: 'profi', label: 'Profis', klasse: 'num', wert: function (p) { return p.stats.minuten; },
          html: function (p) { return p.stats.spiele + ' <span class="muted klein">(' + U.num(p.stats.minuten) + ' Min)</span>'; } },
        { key: 'u23', label: 'U23', klasse: 'num', wert: function (p) { return (p.u23 && p.u23.spiele) || 0; },
          html: function (p) {
            var u = p.u23 || { spiele: 0, tore: 0 };
            return u.spiele + (u.tore ? ' <span class="muted klein">(' + U.pl(u.tore, 'Tor', 'Tore') + ')</span>' : '');
          } },
        { key: 'a', label: '', html: function (p) {
          return '<button class="btn btn--sm' + (p.zweitteam ? '' : ' btn--ghost') +
            '" data-u23="' + esc(p.id) + '">' + (p.zweitteam ? 'in der U23' : 'hochziehen') + '</button>';
        } }
      ], U.sortBy(moeglich, function (p) { return -(p.zweitteam ? 1000 : 0) - p.potenzial; }), {
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Kein Spieler im Kader ist jung genug für die zweite Mannschaft.'
      }) + '</div>';
  }

  // ============================================================ Medien

  /**
   * Die Kabine: wer den Ton angibt, welche Gruppen es gibt und wo es
   * hakt. Die Stimmung wird nach Einfluss gewichtet - ein unzufriedener
   * Wortfuehrer wiegt schwerer als drei zufriedene Ergaenzungsspieler.
   */
  function kabinenKarte(world) {
    var a = FM.kabine.analyse(world, world.nutzerClubId);
    if (!a.hierarchie.length) return '';
    var klasse = a.klima >= 66 ? 'w-gut' : a.klima >= 48 ? 'w-mittel' : 'w-schlecht';

    var html = '<div class="card mt"><div class="card__head"><h3>Kabine</h3>' +
      '<span class="chip">Klima ' + a.klima + '</span></div>' +
      '<p class="' + klasse + '" style="margin:0 0 10px">' + esc(FM.kabine.stimmungstext(a)) + '</p>';

    if (a.klima !== a.schnittMoral) {
      html += '<p class="klein muted" style="margin:-6px 0 10px">Die reine Durchschnittsmoral liegt bei ' +
        a.schnittMoral + '. Der Unterschied kommt aus der Hierarchie.</p>';
    }

    html += '<div class="grid grid--2">';

    html += '<div><h4>Hierarchie</h4>' + a.hierarchie.slice(0, 8).map(function (x) {
      return '<div class="stat-row is-clickable" data-spieler="' + esc(x.p.id) + '">' +
        '<span>' + esc(x.p.nachname) + ' <span class="klein muted">' + esc(x.stufe.name) + '</span></span>' +
        '<b class="klein">' + Math.round(x.gewicht * 100) + ' % Gewicht · Moral ' +
        Math.round(x.p.moral) + '</b></div>';
    }).join('') + '</div>';

    html += '<div><h4>Gruppen</h4>' +
      (a.gruppen.length
        ? a.gruppen.map(function (g) {
          return '<div class="merkmal' + (g.warnung ? ' merkmal--minus' : '') + '">' +
            '<b>' + esc(g.name) + ' <span class="klein muted">' + U.pl(g.spieler.length, 'Spieler', 'Spieler') + '</span></b>' +
            '<span class="klein muted">' + esc(g.text) + '</span></div>';
        }).join('')
        : '<div class="leer">Keine erkennbaren Gruppen.</div>') + '</div>';

    html += '</div>';

    if (a.spannungen.length) {
      html += '<div class="trenner"></div><h4>Spannungen</h4>' +
        a.spannungen.map(function (sp) {
          return '<div class="msg is-clickable" data-spieler="' + esc(sp.spielerId) + '">' +
            '<div class="msg__icon">!</div><div class="msg__body"><b>' + esc(sp.name) + '</b>' +
            '<p>' + esc(sp.stufe) + ' – stört sich an: ' + esc(sp.grund) + '.</p></div></div>';
        }).join('');
    }
    return html + '</div>';
  }

  UI.views.medien = {
    html: function (world, z) {
      z.filter = z.filter || 'alle';
      var inbox = world.inbox.filter(function (n) {
        if (z.filter === 'alle') return true;
        if (z.filter === 'ungelesen') return !n.gelesen;
        return n.typ === z.filter;
      });

      var html = '<div class="card__head"><span></span><div class="flex">' +
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
      html += kabinenKarte(world);
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
      // Alle Listen dieser Ansicht zaehlen nur Ligaspiele - Pokal und
      // Europapokal wuerden die Torjaegerliste sonst verfaelschen.
      function ls(p) { return p.ligaStats || p.stats; }

      var html = '<div class="card__head"><span></span>' +
        '<select data-f="liga" style="width:auto">' +
        world.ligaIds.slice(0, 2).map(function (id) {
          return '<option value="' + id + '"' + (z.liga === id ? ' selected' : '') + '>' + esc(world.ligen[id].name) + '</option>';
        }).join('') + '</select></div>';

      html += '<div class="klein muted mb">Alle Zahlen zählen ausschließlich Ligaspiele.</div>';
      html += '<div class="grid grid--2">';

      html += '<div class="card"><h3>Torschützenliste</h3>' + UI.tabelle([
        { key: 'r', label: '#', klasse: 'num', html: function (p, i) { return p.__rang; } },
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 't', label: 'Tore', klasse: 'num', html: function (p) { return '<b>' + ls(p).tore + '</b>'; } },
        { key: 'm', label: 'Min/Tor', klasse: 'num', html: function (p) {
          return ls(p).tore ? Math.round(ls(p).minuten / ls(p).tore) : '–'; } },
        { key: 'xg', label: 'xG', klasse: 'num', html: function (p) { return U.num(ls(p).xG, 1); } }
      ], U.sortBy(spieler.filter(function (p) { return ls(p).tore > 0; }),
        function (p) { return -ls(p).tore; }).slice(0, 15).map(function (p, i) { p.__rang = i + 1; return p; }), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Noch keine Tore gefallen.'
      }) + '</div>';

      html += '<div class="card"><h3>Vorlagen</h3>' + UI.tabelle([
        { key: 'r', label: '#', klasse: 'num', html: function (p) { return p.__rang; } },
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 'a', label: 'Vorl.', klasse: 'num', html: function (p) { return '<b>' + ls(p).vorlagen + '</b>'; } },
        { key: 'x', label: 'xA', klasse: 'num', html: function (p) { return U.num(ls(p).xA, 1); } }
      ], U.sortBy(spieler.filter(function (p) { return ls(p).vorlagen > 0; }),
        function (p) { return -ls(p).vorlagen; }).slice(0, 15).map(function (p, i) { p.__rang = i + 1; return p; }), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Noch keine Vorlagen.'
      }) + '</div>';

      html += '<div class="card"><h3>Beste Durchschnittsnoten</h3>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 's', label: 'Sp', klasse: 'num', html: function (p) { return ls(p).spiele; } },
        { key: 'no', label: 'Ø Note', klasse: 'num', html: function (p) { return UI.noteZelle(P.schnitt(ls(p))); } }
      ], U.sortBy(spieler.filter(function (p) { return ls(p).spiele >= 8; }),
        function (p) { return P.schnitt(ls(p)); }).slice(0, 15), {
        zeilenKlasse: function (p) { return 'is-clickable' + (p.clubId === world.nutzerClubId ? ' tr-eigen' : ''); },
        zeilenAttr: function (p) { return 'data-spieler="' + esc(p.id) + '"'; },
        leerText: 'Zu wenige Spiele absolviert.'
      }) + '</div>';

      html += '<div class="card"><h3>Torhüter</h3>' + UI.tabelle([
        { key: 'n', label: 'Spieler', html: function (p) { return '<span class="name">' + esc(p.nachname) + '</span>'; } },
        { key: 'v', label: 'Verein', html: function (p) { return UI.vereinZelle(world, p.clubId, true); } },
        { key: 'z', label: 'Zu Null', klasse: 'num', html: function (p) { return '<b>' + ls(p).zuNull + '</b>'; } },
        { key: 'g', label: 'Gegentore', klasse: 'num', html: function (p) { return ls(p).gegentore; } },
        { key: 'pa', label: 'Paraden', klasse: 'num', html: function (p) { return ls(p).paraden; } }
      ], U.sortBy(spieler.filter(function (p) { return p.pos === 'TW' && ls(p).spiele >= 5; }),
        function (p) { return -ls(p).zuNull; }).slice(0, 12), { leerText: 'Zu wenige Spiele.' }) + '</div>';
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

      html += ehrentafelKarte(world, z.liga);

      return html;
    },
    nachher: function (container, world, z) {
      var sel = container.querySelector('[data-f="liga"]');
      if (sel) sel.onchange = function () { z.liga = sel.value; UI.zeichne(); };
      UI.tabelleSortierung(container, 'statistik');
      V.verdrahteAllgemein(container, world);
    }
  };

  /**
   * Die Ehrentafel: Auszeichnungen der laufenden und der vergangenen
   * Spielzeiten, neueste zuerst.
   */
  function ehrentafelKarte(world, ligaId) {
    var alle = FM.awards.auszeichnungenVon(world, { ligaId: ligaId }).slice(0, 40);
    return '<div class="card mt"><h3>Auszeichnungen</h3>' + UI.tabelle([
      { key: 'zeit', label: 'Zeitraum', html: function (a) {
        return '<span class="klein muted">' + a.saison + '/' + String(a.saison + 1).slice(2) +
          (a.monat ? ' · ' + esc(U.MONATE_KURZ[a.monat - 1]) : '') + '</span>';
      } },
      { key: 'titel', label: 'Ehrung', haft: true, html: function (a) {
        return '<b>' + esc(a.titel.replace(/\s*\([^)]*\)\s*$/, '')) + '</b>';
      } },
      { key: 'wer', label: 'Wer', html: function (a) {
        var p = a.spielerId ? world.spieler[a.spielerId] : null;
        if (p) {
          return '<span class="spieler-link" data-spieler="' + esc(p.id) + '">' +
            esc(p.vorname + ' ' + p.nachname) + '</span>';
        }
        return a.clubId ? UI.vereinZelle(world, a.clubId) : '–';
      } },
      { key: 'text', label: 'Anmerkung', html: function (a) {
        return '<span class="klein muted">' + esc(a.text || '') + '</span>';
      } }
    ], alle, { leerText: 'Noch keine Ehrungen. Spieler und Trainer des Monats werden am Monatsende gekürt.' }) +
      '</div>';
  }

  function zuschauerSchnitt(world, clubId) {
    var heim = world.spiele.filter(function (s) {
      return s.heimId === clubId && s.gespielt && s.wettbewerb === 'liga';
    });
    if (!heim.length) return 0;
    return U.avg(heim.map(function (s) { return s.ergebnis.zuschauer; }));
  }

  // ============================================================ Karriere

  /**
   * Kooperationsvereine: wo der Verein Talente unterbringt und wo er das
   * erste Wort hat, wenn dort jemand auffaellt.
   */
  function kooperationsKarte(world, club) {
    var K = FM.kooperation;
    var eigene = K.partnerVon(world, club.id);
    var html = '<div class="card mt"><div class="card__head"><h3>Kooperationsvereine</h3>' +
      (eigene.length < K.MAX_PARTNER
        ? '<button class="btn btn--sm btn--primary" data-a="koop-neu">Partner suchen</button>' : '') +
      '</div>' +
      '<p class="klein muted">Ein Partnerverein nimmt Ihre Talente ohne Verhandlung auf Leihbasis ' +
      'und mit Einsatzgarantie. Dafür zahlen Sie eine Jahresgebühr – und bekommen 25 Prozent ' +
      'Nachlass auf Ablösen sowie das erste Wort, wenn dort jemand auffällt.</p>';

    if (!eigene.length) {
      html += '<div class="leer">Noch keine Partnerschaft.</div>';
    } else {
      eigene.forEach(function (k) {
        var istGross = k.clubId === club.id;
        var anderer = world.vereine[istGross ? k.partnerId : k.clubId];
        if (!anderer) return;
        html += '<div class="stat-row"><span>' + UI.vereinZelle(world, anderer.id) +
          ' <span class="klein muted">' + (istGross ? 'Juniorpartner' : 'Seniorpartner') +
          ' seit ' + esc(U.fmtDate(k.seit)) + '</span></span>' +
          '<span><b class="klein">' + U.money(k.gebuehr) + ' / Jahr</b> ' +
          (istGross ? '<button class="btn btn--sm btn--ghost" data-koop-ende="' + esc(anderer.id) +
            '">beenden</button>' : '') + '</span></div>';
      });
    }
    return html + '</div>';
  }

  /** Auswahl eines neuen Partnervereins. */
  function kooperationsDialog(world, club) {
    var K = FM.kooperation;
    var liste = K.kandidaten(world, club.id).slice(0, 24);
    var html = '<h2>Partnerverein suchen</h2>' +
      '<p class="muted">Infrage kommt nur, wer deutlich kleiner ist – ein Verein auf Augenhöhe ' +
      'sieht sich nicht als Juniorpartner. Je besser die Akademie des Partners, desto mehr ' +
      'bringt die Verbindung.</p>';
    if (!liste.length) {
      html += '<div class="leer">Zurzeit kommt kein Verein infrage.</div>';
    } else {
      html += '<div class="optionen">' + liste.map(function (k) {
        return '<button class="option" data-koop="' + esc(k.clubId) + '">' +
          '<b>' + esc(k.name) + '</b><br><span class="klein muted">' +
          (k.liga === 1 ? 'Bundesliga' : k.liga === 2 ? '2. Bundesliga' : '3. Liga') +
          ' · Ruf ' + k.ruf + ' · Akademie ' + k.akademie + ' · ' + U.money(k.gebuehr) + ' / Jahr' +
          '</span></button>';
      }).join('') + '</div>';
    }
    UI.modal(html, {
      breit: true,
      nachher: function (body) {
        Array.prototype.forEach.call(body.querySelectorAll('[data-koop]'), function (b) {
          b.onclick = function () {
            var r = K.anbieten(world, club.id, b.dataset.koop);
            if (r.fehler) { UI.toast(r.fehler, 'fehler'); return; }
            UI.modalZu();
            UI.toast('Partnerschaft mit ' + world.vereine[b.dataset.koop].name + ' geschlossen.', 'gut');
            UI.zeichne();
          };
        });
      }
    });
  }

  /**
   * Meilensteine: das Rueckgrat einer langen Laufbahn. Ein Saisonziel ist
   * nach neun Monaten abgehakt - diese Vorhaben tragen ueber Jahre und
   * zeigen jederzeit, wie weit man ist.
   */
  function meilensteinKarte(world) {
    var liste = FM.meilensteine.uebersicht(world);
    var bilanz = FM.meilensteine.bilanz(world);
    var gruppen = [];
    liste.forEach(function (e) {
      var g = gruppen.filter(function (x) { return x.name === e.gruppe; })[0];
      if (!g) { g = { name: e.gruppe, eintraege: [] }; gruppen.push(g); }
      g.eintraege.push(e);
    });

    function zeile(e) {
      var wertText = e.geld
        ? U.money(e.wert) + ' von ' + U.money(e.ziel)
        : (e.alsWert ? Math.round(e.wert) + ' von ' + e.ziel
          : Math.min(Math.round(e.wert), e.ziel) + ' / ' + e.ziel);
      return '<div class="mstein' + (e.erreicht ? ' mstein--fertig' : '') + '">' +
        '<div class="mstein__kopf">' +
        '<span class="mstein__haken">' + (e.erreicht ? '✓' : '') + '</span>' +
        '<b>' + esc(e.name) + '</b>' +
        '<span class="klein muted mstein__stand">' +
        (e.erreicht ? U.fmtDate(e.tag) : wertText) + '</span></div>' +
        '<div class="progress progress--duenn"><i style="width:' + Math.round(e.anteil * 100) + '%"></i></div>' +
        '<div class="klein muted mstein__text">' + esc(e.text) + '</div>' +
        '</div>';
    }

    return '<div class="card mb"><div class="card__head"><h3>Meilensteine</h3>' +
      '<span class="chip' + (bilanz.erreicht ? ' chip--gruen' : '') + '">' +
      bilanz.erreicht + ' von ' + bilanz.gesamt + '</span></div>' +
      '<div class="progress mb"><i style="width:' +
      Math.round(bilanz.erreicht / Math.max(1, bilanz.gesamt) * 100) + '%"></i></div>' +
      '<div class="msteine">' +
      gruppen.map(function (g) {
        return '<div class="msteine__gruppe"><h4>' + esc(g.name) + '</h4>' +
          g.eintraege.map(zeile).join('') + '</div>';
      }).join('') +
      '</div></div>';
  }

  /** Eine Zeile des Trainerprofils mit Balken und Erklaerung. */
  function profilZeile(label, wert, hinweis) {
    var v = Math.round(wert);
    return '<div class="stat-row" title="' + esc(hinweis) + '">' +
      '<span>' + esc(label) + '</span>' +
      '<span style="display:flex;align-items:center;gap:10px">' +
      UI.balken(v / 100, v >= 70 ? '' : v >= 50 ? 'bar--gelb' : 'bar--rot') +
      '<b style="min-width:28px;text-align:right">' + v + '</b></span></div>';
  }

  UI.views.karriere = {
    html: function (world) {
      var m = world.manager;
      var html = '<div class="card__head"><span></span><div class="flex">' +
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

      if (m.jobangebot && world.tag <= m.jobangebot.frist) {
        var ziel = world.vereine[m.jobangebot.clubId];
        html += '<div class="card card--deadline mb"><div class="card__head">' +
          '<h3>Anfrage von ' + esc(ziel.name) + '</h3>' +
          '<span class="chip chip--gold">noch ' + (m.jobangebot.frist - world.tag) + ' Tage</span></div>' +
          '<p class="muted">' + esc(ziel.name) + ' sucht einen neuen Trainer. Angeboten werden <b>' +
          U.money(m.jobangebot.gehalt) + ' pro Woche</b> – Ihr aktuelles Gehalt liegt bei ' +
          U.money(m.gehalt) + '. Ein Wechsel beendet Ihre Arbeit bei ' +
          esc(world.nutzerVerein().name) + ' sofort.</p>' +
          '<div class="flex"><button class="btn btn--primary" data-a="job-ja">Angebot annehmen</button>' +
          '<button class="btn" data-a="job-nein">Ablehnen und bleiben</button></div></div>';
      }

      html += '<div class="card mb"><h3>Ihr Trainerprofil</h3>' +
        '<p class="klein muted">Diese Werte wachsen mit jeder Woche im Amt. Sie wirken auf ' +
        'Trainingsqualität, die taktische Ausrichtung der Mannschaft und darauf, wie leicht ' +
        'sich Spieler von Ihnen überzeugen lassen.</p>' +
        profilZeile('Ruf', m.ruf, 'Wie sehr Ihr Name für sich spricht. Titel heben ihn sprunghaft, ' +
          'ein verfehltes Saisonziel drückt ihn.') +
        profilZeile('Taktik', m.taktik, 'Fließt in die taktische Feinabstimmung der Mannschaft ein.') +
        profilZeile('Training', m.training, 'Hebt die Trainingsqualität neben Ihrem Stab.') +
        profilZeile('Menschenführung', m.menschenfuehrung, 'Entscheidet, wie gut Gespräche mit Spielern wirken.') +
        '</div>';

      // Die Meilensteine bekommen die volle Breite - sie sind die
      // Landkarte der Laufbahn, nicht eine Randnotiz.
      html += meilensteinKarte(world);

      html += '<div class="grid grid--2">';
      html += '<div class="card"><h3>Stationen</h3>' + UI.tabelle([
        { key: 's', label: 'Saison', html: function (k) { return k.saison + '/' + String(k.saison + 1).slice(2); } },
        { key: 'v', label: 'Verein', html: function (k) { return UI.vereinZelle(world, k.clubId, true); } },
        { key: 'l', label: 'Liga', html: function (k) { return k.liga === 1 ? 'BL' : k.liga === 2 ? '2. BL' : '3. L'; } },
        { key: 'p', label: 'Platz', klasse: 'num', html: function (k) {
          // Auf- und Abstieg sind die Wendepunkte einer Laufbahn und
          // gehoeren neben den Platz, nicht in eine Fussnote.
          var pfeil = k.aufgestiegen ? '<span class="w-gut" title="Aufstieg">\u2191</span>'
            : k.abgestiegen ? '<span class="w-schlecht" title="Abstieg">\u2193</span>' : '';
          return k.platz + '. ' + pfeil; } },
        { key: 'pk', label: 'Punkte', klasse: 'num', html: function (k) { return k.punkte; } },
        { key: 'z', label: 'Ziel', html: function (k) {
          return '<span class="chip ' + (k.erreicht ? 'chip--gruen' : 'chip--rot') + '">' +
            (k.erreicht ? 'erreicht' : 'verfehlt') + '</span>' +
            '<div class="klein muted zeilenumbruch">' + esc(k.ziel) + '</div>'; } }
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
      var ja = container.querySelector('[data-a="job-ja"]');
      if (ja) ja.onclick = function () {
        var ziel = world.vereine[world.manager.jobangebot.clubId];
        UI.bestaetigen('Verein wechseln',
          'Sie übernehmen <b>' + esc(ziel.name) + '</b> und verlassen ' +
          esc(world.nutzerVerein().name) + '. Fortfahren?', function () {
            var r = FM.media.jobangebotAnnehmen(world);
            if (r.fehler) { UI.toast(r.fehler, 'fehler'); return; }
            UI.zeige('uebersicht');
            UI.toast('Sie übernehmen ' + world.vereine[r.clubId].name + '.', 'gut');
          });
      };
      var nein = container.querySelector('[data-a="job-nein"]');
      if (nein) nein.onclick = function () {
        var r = FM.media.jobangebotAblehnen(world);
        UI.toast(r.fehler || ('Absage an ' + r.name + '. Ihr Vorstand nimmt das wohlwollend auf.'),
          r.fehler ? 'fehler' : 'gut');
        UI.zeichne();
      };
      var ex = container.querySelector('[data-a="export"]');
      if (ex) ex.onclick = function () {
        FM.save.exportieren(world, function (fehler, status) {
          if (fehler) UI.toast('Export nicht möglich: ' + fehler, 'fehler');
          else if (status === 'abgebrochen') UI.toast('Export abgebrochen.');
          else UI.toast('Spielstand als Datei gesichert.', 'gut');
        });
      };
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
