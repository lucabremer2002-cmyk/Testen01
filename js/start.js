/* start.js - Startbildschirm, Vereinswahl, Spielsteuerung und Speichern. */
(function (g) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var gewaehlterKlub = null;
  var aktiveLiga = 'bl1';

  /* ---------- Startbildschirm ---------- */

  function ligaKnoepfe() {
    var el = $('ligaWahl');
    el.innerHTML = DataClubs.LIGEN.map(function (l) {
      return '<button data-liga="' + l.id + '" class="' + (l.id === aktiveLiga ? 'aktiv' : '') + '">' +
        Util.esc(l.name) + '</button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        aktiveLiga = b.dataset.liga;
        ligaKnoepfe();
        vereinsGitter();
      };
    });
  }

  function vereinsGitter() {
    var liga = DataClubs.LIGEN.filter(function (l) { return l.id === aktiveLiga; })[0];
    var el = $('vereinsGitter');
    var teams = liga.teams.slice().sort(function (a, b) { return b.ruf - a.ruf; });
    el.innerHTML = teams.map(function (t) {
      return '<button class="vereinskachel' + (gewaehlterKlub === t.id ? ' aktiv' : '') + '" data-klub="' + t.id + '">' +
        Logos.svg(t, 34) +
        '<span class="vereinskachel__text">' +
        '<span class="vereinskachel__name">' + Util.esc(t.name) + '</span>' +
        '<span class="vereinskachel__info">' + Util.esc(t.stadt) + ' · ' + Fmt.num(t.kapazitaet) + ' Plätze</span>' +
        '</span></button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        gewaehlterKlub = b.dataset.klub;
        vereinsGitter();
        var t = teams.filter(function (x) { return x.id === gewaehlterKlub; })[0];
        var schwierig = t.ruf >= 80 ? 'sehr komfortabel' : (t.ruf >= 60 ? 'solide' :
          (t.ruf >= 45 ? 'anspruchsvoll' : (t.ruf >= 33 ? 'schwierig' : 'sehr schwierig')));
        $('wahlInfo').innerHTML = 'Gewählt: <b>' + Util.esc(t.name) + '</b> (' + Util.esc(liga.name) +
          ') · Ausgangslage: ' + schwierig;
        $('btnStarten').disabled = false;
      };
    });
  }

  function startbildschirm() {
    ligaKnoepfe();
    vereinsGitter();
    if (Speicher.vorhanden()) {
      $('startLaden').hidden = false;
      $('startLadenInfo').textContent = 'Es liegt eine gespeicherte Karriere vor.';
    }
    $('btnStarten').onclick = neuesSpiel;
    $('btnWeiterspielen').onclick = function () {
      var st = Speicher.laden();
      if (!st) { UI.toast('Der Spielstand konnte nicht gelesen werden.'); return; }
      Game.state = st;
      spielStarten();
    };
    $('btnSpielstandLoeschen').onclick = function () {
      UI.modal('Spielstand löschen', '<p>Der gespeicherte Spielstand wird unwiderruflich gelöscht. Fortfahren?</p>', [
        {
          text: 'Endgültig löschen', klasse: 'knopf--gefahr',
          fn: function () { Speicher.loeschen(); $('startLaden').hidden = true; UI.toast('Spielstand gelöscht.'); }
        },
        { text: 'Abbrechen', klasse: 'knopf--still' }
      ]);
    };
  }

  function neuesSpiel() {
    if (!gewaehlterKlub) return;
    $('btnStarten').disabled = true;
    $('btnStarten').textContent = 'Spielwelt wird aufgebaut …';
    setTimeout(function () {
      var seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      var st = Game.weltErzeugen(seed, 2025);
      st.meinKlubId = gewaehlterKlub;
      st.managerName = ($('managerName').value || '').trim() || 'Trainer';
      Game.budgetsSetzen(st, st.klubs[gewaehlterKlub]);
      /* Ein Sponsorenplatz ist zum Karrierestart frei - so gibt es gleich
         eine erste Entscheidung zu treffen. */
      var meinKlub = st.klubs[gewaehlterKlub];
      meinKlub.finanzen.sponsoren.aermel = null;
      Game.sponsorenPruefen(st);
      Game.post(st, 'Willkommen bei ' + st.klubs[gewaehlterKlub].name,
        'Herzlich willkommen, ' + st.managerName + '! Der Vorstand erwartet: ' +
        st.klubs[gewaehlterKlub].vorstand.ziel +
        ' Nutzen Sie das Transferfenster bis zum 31. August, um den Kader zu verstärken.', 'info');
      Game.state = st;
      spielStarten();
    }, 40);
  }

  function spielStarten() {
    $('start').hidden = true;
    $('app').hidden = false;
    UI.wechsle('uebersicht');
    steuerung();
  }

  /* ---------- Spielsteuerung ---------- */

  function steuerung() {
    $('btnWeiter').onclick = weiter;
    $('btnSpeichern').onclick = function () { speichern(true); };
    $('btnHauptmenue').onclick = hauptmenue;
    $('btnMenue').onclick = function () { $('seitenleiste').classList.toggle('offen'); };
    $('modalZu').onclick = UI.modalZu;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').hidden) UI.modalZu();
    });
  }

  function speichern(meldung) {
    var r = Speicher.speichern(Game.state);
    if (meldung) {
      UI.toast(r.ok ? 'Spielstand gespeichert (' + Math.round(r.groesse / 1024) + ' KB).'
                    : r.grund);
    }
    return r.ok;
  }

  function hauptmenue() {
    UI.modal('Hauptmenü', '<p>Möchten Sie zum Startbildschirm zurückkehren? ' +
      'Nicht gespeicherte Fortschritte gehen verloren.</p>', [
      {
        text: 'Speichern und zurück', klasse: 'knopf--gold',
        fn: function () { speichern(false); location.reload(); }
      },
      { text: 'Ohne Speichern zurück', klasse: 'knopf--gefahr', fn: function () { location.reload(); } },
      { text: 'Abbrechen', klasse: 'knopf--still' }
    ]);
  }

  /* Ein Klick auf „Weiter" laeuft bis zum naechsten Ereignis. */
  function weiter() {
    var st = Game.state;
    if (!st) return;
    if (st.anstehendesSpiel) { UI.spielVorbereiten(); return; }

    var postVorher = st.postfach.length;
    var schritte = 0;
    var grund = null;

    while (schritte < 10) {
      var r = Game.naechsterTag(st);
      schritte++;
      if (r.typ === 'spiel') { UI.zeichne(); UI.spielVorbereiten(); return; }
      if (r.typ === 'saisonende') { UI.zeichne(); speichern(false); UI.saisonAbschluss(); return; }
      /* Bei wichtigen neuen Nachrichten anhalten. */
      var neu = st.postfach.slice(0, st.postfach.length - postVorher);
      var wichtig = neu.filter(function (m) {
        return m.art === 'warnung' || m.art === 'transfer' || m.art === 'geld';
      });
      if (wichtig.length) { grund = wichtig[0].betreff; break; }
      if (r.spieltage) break;
    }

    UI.zeichne();
    if (grund) UI.toast(grund);
    if (st.tag % 7 === 0) speichern(false);
  }

  /* ---------- Start ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    startbildschirm();
    $('modalZu').onclick = UI.modalZu;
  });
})(typeof window !== 'undefined' ? window : globalThis);
