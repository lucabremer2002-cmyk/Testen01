/* ui.js - Grundgeruest der Oberflaeche: Navigation, Kopfzeile, Modal,
 * wiederverwendbare Bausteine und die Uebersichtsseite. */
(function (g) {
  'use strict';

  var UI = {
    seite: 'uebersicht',
    seiten: {},
    daten: {},
    modalAktion: null
  };

  function S() { return Game.state; }
  function meinKlub() { return Game.state.klubs[Game.state.meinKlubId]; }
  function $(id) { return document.getElementById(id); }

  /* ---------- Bausteine ---------- */

  function wappen(klub, groesse) {
    if (!klub) return '';
    return Logos.svg(klub, groesse || 26);
  }

  function klubZelle(klub, groesse, kurz) {
    if (!klub) return '<span class="mini">unbekannt</span>';
    return '<span class="klubzelle">' + wappen(klub, groesse || 22) +
      '<span>' + Util.esc(kurz ? klub.kurz : klub.name) + '</span></span>';
  }

  function staerkeFarbe(v) {
    if (v >= 78) return '#46c27a';
    if (v >= 64) return '#9ad06a';
    if (v >= 50) return '#e8c34c';
    if (v >= 38) return '#e39a4c';
    return '#e0524b';
  }

  function staerkeBalken(v, max) {
    var breite = Util.clamp(v / (max || 99) * 100, 3, 100);
    return '<span class="staerke"><b>' + Math.round(v) + '</b>' +
      '<span class="balken"><i style="width:' + breite.toFixed(0) + '%;background:' + staerkeFarbe(v) + '"></i></span></span>';
  }

  function posMarke(pos) {
    var grp = Players.GRUPPE[pos] || 'MIT';
    return '<span class="marke marke--' + grp.toLowerCase() + '">' + pos + '</span>';
  }

  function formIcons(form) {
    if (!form || !form.length) return '<span class="mini">–</span>';
    return '<span class="form">' + form.slice(-5).map(function (f) {
      return '<i class="' + f + '">' + f + '</i>';
    }).join('') + '</span>';
  }

  function noteSchnitt(p) {
    if (!p.stats.noten.length) return null;
    return Util.sum(p.stats.noten) / p.stats.noten.length;
  }

  function noteText(n) {
    if (n === null || n === undefined) return '<span class="mini">–</span>';
    var farbe = n <= 2.5 ? 'var(--gruen-gut)' : (n <= 3.5 ? 'var(--text)' : 'var(--rot)');
    return '<span style="color:' + farbe + ';font-variant-numeric:tabular-nums">' + n.toFixed(2).replace('.', ',') + '</span>';
  }

  function zustand(p) {
    var st = S();
    if (p.leihe) {
      var von = st.klubs[p.leihe.vonKlubId];
      return '<span class="marke marke--info">Leihe von ' + Util.esc(von ? von.kurz : '?') + '</span>';
    }
    if (p.verletztBis > st.tag) {
      return '<span class="marke marke--gefahr" title="' + Util.esc(p.verletzung || '') + '">verletzt ' +
        (p.verletztBis - st.tag) + ' T</span>';
    }
    if (p.sperre > 0) return '<span class="marke marke--warn">gesperrt ' + p.sperre + '</span>';
    if (p.fitness < 65) return '<span class="marke marke--warn">müde</span>';
    if (p.transferliste) return '<span class="marke marke--info">Transferliste</span>';
    if (p.wechselwunsch) return '<span class="marke marke--warn">Wechselwunsch</span>';
    return '';
  }

  function fitnessBalken(v) {
    var farbe = v >= 85 ? 'var(--gruen-gut)' : (v >= 65 ? 'var(--gelb)' : 'var(--rot)');
    return '<span class="balken" title="Fitness ' + v + ' %"><i style="width:' + v + '%;background:' + farbe + '"></i></span>';
  }

  /* ---------- Modal ---------- */

  function modal(titel, inhalt, aktionen, breit) {
    $('modalTitel').textContent = titel;
    $('modalInhalt').innerHTML = inhalt;
    var fuss = $('modalFuss');
    fuss.innerHTML = '';
    (aktionen || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'knopf ' + (a.klasse || '');
      b.textContent = a.text;
      b.onclick = function () {
        if (a.fn) a.fn();
        if (a.schliessen !== false) modalZu();
      };
      if (a.deaktiviert) b.disabled = true;
      fuss.appendChild(b);
    });
    var box = document.querySelector('.modal__box');
    box.style.width = breit ? 'min(1000px,100%)' : '';
    $('modal').hidden = false;
    return $('modalInhalt');
  }

  function modalZu() {
    $('modal').hidden = true;
    $('modalInhalt').innerHTML = '';
    UI.modalAktion = null;
  }

  var toastTimer = null;
  function toast(text, dauer) {
    var t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, dauer || 2600);
  }

  /* ---------- Navigation ---------- */

  /* Einheitliche Strichsymbole statt Emoji - sie nehmen die Textfarbe an
     und bleiben in beiden Farbschemata ruhig. */
  var SYMBOLE = {
    uebersicht: '<path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1z"/>',
    kader: '<circle cx="7" cy="6.5" r="2.6"/><path d="M2.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2"/>' +
           '<circle cx="14.5" cy="7.5" r="2"/><path d="M13 12.2c2.3-.5 4.5 1 4.5 3.8"/>',
    taktik: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 10h14"/>' +
            '<circle cx="10" cy="10" r="2.6"/><path d="M7 3v2.4h6V3M7 17v-2.4h6V17"/>',
    spielplan: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>' +
               '<circle cx="7" cy="12" r="1" fill="currentColor" stroke="none"/>' +
               '<circle cx="10.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
    tabellen: '<path d="M3 5h14M3 10h14M3 15h9"/>',
    transfermarkt: '<path d="M4 7h11l-2.6-2.6M16 13H5l2.6 2.6"/>',
    verhandlungen: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h6A2.5 2.5 0 0 1 14 6.5v2A2.5 2.5 0 0 1 11.5 11H7l-3 2.6z"/>' +
                   '<path d="M16.5 8.5A2.5 2.5 0 0 1 17 10v3.5a2 2 0 0 1-2 2h-.5"/>',
    vertraege: '<path d="M5 3h6l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>' +
               '<path d="M11 3v4h4M7 11h6M7 14h4"/>',
    sponsoring: '<path d="M10 2.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L3.2 7.8l4.7-.7z"/>',
    jugend: '<path d="M10 17v-6"/><path d="M10 11c0-3 2-5 5-5 0 3-2 5-5 5z"/>' +
            '<path d="M10 13c0-2.4-1.7-4-4-4 0 2.4 1.7 4 4 4z"/>',
    stadion: '<path d="M3 8c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z"/>' +
             '<path d="M3 8v5c0 1.7 3.1 3 7 3s7-1.3 7-3V8"/>',
    bank: '<path d="M3 8l7-4 7 4"/><path d="M4.5 8v6M8 8v6M12 8v6M15.5 8v6M3 16.5h14"/>',
    finanzen: '<path d="M3.5 16.5V9M8 16.5V5M12.5 16.5v-5M17 16.5V7"/>',
    postfach: '<rect x="3" y="5" width="14" height="10" rx="2"/><path d="M3.6 6.2 10 10.8l6.4-4.6"/>',
    verein: '<path d="M10 2.8 16 5v5.2c0 3.4-2.4 5.7-6 7.2-3.6-1.5-6-3.8-6-7.2V5z"/>'
  };

  function icon(name) {
    return '<svg class="sym" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" ' +
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round">' + (SYMBOLE[name] || '') + '</svg>';
  }

  var MENUE = [
    { id: 'uebersicht', name: 'Übersicht' },
    { id: 'kader', name: 'Kader' },
    { id: 'taktik', name: 'Aufstellung' },
    { id: 'spielplan', name: 'Spielplan' },
    { id: 'tabellen', name: 'Tabellen' },
    { id: 'transfermarkt', name: 'Transfermarkt' },
    { id: 'verhandlungen', name: 'Verhandlungen', zaehler: 'verhandlungen' },
    { id: 'vertraege', name: 'Verträge', zaehler: 'vertraege' },
    { id: 'sponsoring', name: 'Sponsoring', zaehler: 'sponsoren' },
    { id: 'jugend', name: 'Jugend', zaehler: 'talente' },
    { id: 'stadion', name: 'Stadion' },
    { id: 'bank', name: 'Bank' },
    { id: 'finanzen', name: 'Finanzen' },
    { id: 'postfach', name: 'Postfach', zaehler: 'post' },
    { id: 'verein', name: 'Verein' }
  ];

  function zaehlerWerte() {
    var st = S();
    var mein = meinKlub();
    var offen = st.verhandlungen.filter(function (v) { return v.status === 'offen'; }).length;
    var auslaufend = Game.kaderVon(st, mein).filter(function (p) {
      return p.vertragBis <= st.saison;
    }).length;
    var sponsoren = Object.keys(mein.finanzen.sponsorAngebote || {}).length;
    var post = st.postfach.filter(function (m) { return !m.gelesen; }).length;
    /* Nur Talente melden, die reif für einen Profivertrag sind. */
    var talente = mein.jugend ? mein.jugend.talente.filter(function (id) {
      var p = st.spieler[id];
      return p && p.alter >= 17 && p.staerke >= Game.basisStaerke(mein) - 14;
    }).length : 0;
    return { verhandlungen: offen, vertraege: auslaufend, sponsoren: sponsoren,
      post: post, talente: talente };
  }

  function menueZeichnen() {
    var z = zaehlerWerte();
    var nav = $('menue');
    nav.innerHTML = MENUE.map(function (m) {
      var anzahl = m.zaehler ? z[m.zaehler] : 0;
      return '<button data-seite="' + m.id + '" class="' + (UI.seite === m.id ? 'aktiv' : '') + '">' +
        icon(m.id) + '<span>' + m.name + '</span>' +
        (anzahl ? '<span class="zaehler">' + anzahl + '</span>' : '') +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        UI.wechsle(b.dataset.seite);
        $('seitenleiste').classList.remove('offen');
      };
    });
  }

  function kopfZeichnen() {
    var st = S(), mein = meinKlub();
    $('kopfDatum').textContent = Fmt.weekday(st.tag, st.saison) + ', ' + Fmt.date(st.tag, st.saison);
    var liga = mein.ligaId ? st.ligen[mein.ligaId] : null;
    $('kopfSaison').textContent = 'Saison ' + st.saison + '/' + String(st.saison + 1).slice(2) +
      (liga ? ' · ' + liga.name : '') + (Game.istTransferfenster(st) ? ' · Transferfenster offen' : '');
    var konto = $('kopfKonto');
    konto.textContent = Fmt.money(mein.finanzen.kontostand);
    konto.className = mein.finanzen.kontostand < 0 ? 'minus' : '';
    $('kopfBudget').textContent = Fmt.money(mein.finanzen.transferbudget);
    var z = zaehlerWerte();
    $('kopfPost').textContent = z.post;

    var sk = $('seitenKlub');
    sk.innerHTML = wappen(mein, 40) +
      '<div><div class="seitenklub__name">' + Util.esc(mein.name) + '</div>' +
      '<div class="seitenklub__liga">' + Util.esc(liga ? liga.name : '–') + '</div></div>';
  }

  UI.wechsle = function (seite, daten) {
    UI.seite = seite;
    UI.daten = daten || {};
    UI.zeichne();
    var inhalt = $('inhalt');
    if (inhalt) inhalt.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  UI.zeichne = function () {
    if (!Game.state) return;
    kopfZeichnen();
    menueZeichnen();
    var fn = UI.seiten[UI.seite] || UI.seiten.uebersicht;
    $('inhalt').innerHTML = fn();
    if (UI.nachZeichnen[UI.seite]) UI.nachZeichnen[UI.seite]();
  };

  UI.nachZeichnen = {};

  /* ---------- Tabellenbaustein ---------- */

  function tabellenZonen(liga, platz) {
    var n = liga.klubs.length;
    if (liga.id === 'bl1') {
      if (platz <= 4) return 'eu';
      if (platz <= 6) return 'eu';
      if (platz > n - liga.direktAb) return 'ab';
      if (platz === n - liga.direktAb) return 'rel';
      return '';
    }
    if (platz <= liga.aufstieg) return 'auf';
    if (liga.relegation && platz === liga.aufstieg + 1) return 'rel';
    if (platz > n - liga.direktAb) return 'ab';
    if (liga.relegation && platz === n - liga.direktAb) return 'rel';
    return '';
  }

  function tabelleHTML(liga, kompakt) {
    var st = S();
    var zeilen = League.tabelleAls(liga);
    var kopf = '<thead><tr><th class="mitte">#</th><th>Verein</th><th class="zahl">Sp</th>' +
      (kompakt ? '' : '<th class="zahl">S</th><th class="zahl">U</th><th class="zahl">N</th>') +
      '<th class="zahl">Tore</th><th class="zahl">Diff</th><th class="zahl">Pkt</th>' +
      (kompakt ? '' : '<th>Form</th>') + '</tr></thead>';
    var koerper = zeilen.map(function (z, i) {
      var platz = i + 1;
      var klub = st.klubs[z.klubId];
      var zone = tabellenZonen(liga, platz);
      var eigen = z.klubId === st.meinKlubId ? ' eigen' : '';
      return '<tr class="klickbar' + eigen + '" data-klub="' + z.klubId + '">' +
        '<td class="mitte"><span class="platz' + (zone ? ' platz--' + zone : '') + '">' + platz + '</span></td>' +
        '<td>' + klubZelle(klub, 20, kompakt) + '</td>' +
        '<td class="zahl">' + z.sp + '</td>' +
        (kompakt ? '' : '<td class="zahl">' + z.s + '</td><td class="zahl">' + z.u + '</td><td class="zahl">' + z.n + '</td>') +
        '<td class="zahl">' + z.tore + ':' + z.gegentore + '</td>' +
        '<td class="zahl">' + Fmt.signed(z.tore - z.gegentore) + '</td>' +
        '<td class="zahl"><b>' + (z.punkte - z.abzug) + '</b></td>' +
        (kompakt ? '' : '<td>' + formIcons(z.form) + '</td>') +
        '</tr>';
    }).join('');
    return '<div class="tabellenrahmen"><table class="liste">' + kopf + '<tbody>' + koerper + '</tbody></table></div>';
  }

  function tabellenKlicks() {
    Array.prototype.forEach.call(document.querySelectorAll('tr[data-klub]'), function (tr) {
      tr.onclick = function () { UI.klubFenster(tr.dataset.klub); };
    });
  }

  /* ---------- Vereinsfenster ---------- */

  UI.klubFenster = function (klubId) {
    var st = S();
    var k = st.klubs[klubId];
    if (!k) return;
    var kader = Game.kaderVon(st, k).sort(function (a, b) { return b.staerke - a.staerke; });
    var liga = k.ligaId ? st.ligen[k.ligaId] : null;
    var mw = Util.sum(kader, function (p) { return p.marktwert; });
    var gh = Util.sum(kader, function (p) { return p.gehalt; });
    var kap = k.finanzen ? Finance.kapazitaet(k.finanzen.stadion) : k.kapazitaet;

    var html = '<div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem">' +
      wappen(k, 64) +
      '<div><h3 style="margin:0">' + Util.esc(k.name) + '</h3>' +
      '<div class="mini">' + Util.esc(k.stadt || '') +
      (liga ? ' · ' + Util.esc(liga.name) : (k.international ? ' · ' + Util.esc(k.wettbewerb) + ' (' + Util.esc(k.land) + ')' : ' · ohne Liga')) +
      '</div></div></div>';

    html += '<div class="raster raster--4" style="margin-bottom:1rem">' +
      kennzahl('Stadion', Util.esc(k.finanzen ? k.finanzen.stadion.name : k.stadion), Fmt.num(kap) + ' Plätze') +
      kennzahl('Kaderwert', Fmt.money(mw), kader.length + ' Spieler') +
      kennzahl('Gehälter', Fmt.money(gh * 52), 'pro Jahr') +
      kennzahl('Ansehen', String(k.ruf), 'von 100') +
      '</div>';

    if (liga) {
      var platz = League.platzVon(liga, k.id);
      var z = liga.tabelle[k.id];
      html += '<p class="hinweis">Tabellenplatz <b>' + platz + '</b> mit ' + (z.punkte - z.abzug) +
        ' Punkten aus ' + z.sp + ' Spielen. ' + formIcons(z.form) + '</p>';
    }

    html += '<h4>Kader</h4><div class="tabellenrahmen"><table class="liste"><thead><tr>' +
      '<th>Spieler</th><th class="mitte">Pos</th><th class="zahl">Alter</th>' +
      '<th class="zahl">Stärke</th><th class="zahl">Marktwert</th><th class="zahl">Vertrag</th></tr></thead><tbody>' +
      kader.map(function (p) {
        return '<tr class="klickbar" data-spieler="' + p.id + '"><td>' + Util.esc(p.name) +
          ' <span class="mini">' + Util.esc(p.nation) + '</span></td>' +
          '<td class="mitte">' + posMarke(p.pos) + '</td>' +
          '<td class="zahl">' + p.alter + '</td>' +
          '<td class="zahl">' + staerkeBalken(p.staerke) + '</td>' +
          '<td class="zahl">' + Fmt.money(p.marktwert) + '</td>' +
          '<td class="zahl">' + p.vertragBis + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var inhalt = modal(k.name, html, [{ text: 'Schließen', klasse: 'knopf--still' }], true);
    Array.prototype.forEach.call(inhalt.querySelectorAll('tr[data-spieler]'), function (tr) {
      tr.onclick = function () { UI.spielerFenster(tr.dataset.spieler); };
    });
  };

  /* ---------- Spielerfenster ---------- */

  UI.spielerFenster = function (spielerId, extraAktionen) {
    var st = S();
    var mein = meinKlub;
    var p = st.spieler[spielerId];
    if (!p) return;
    var klub = p.klubId ? st.klubs[p.klubId] : null;
    var eigen = p.klubId === st.meinKlubId;
    var note = noteSchnitt(p);

    var html = '<div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:1rem">' +
      (klub ? wappen(klub, 54) : '') +
      '<div style="flex:1;min-width:200px"><h3 style="margin:0">' + Util.esc(p.name) + '</h3>' +
      '<div class="mini">' + posMarke(p.pos) + ' · ' + p.alter + ' Jahre · ' + Util.esc(p.nation) +
      (klub ? ' · ' + Util.esc(klub.name) : ' · <span class="akzent">vereinslos</span>') + '</div>' +
      '<div style="margin-top:.4em">' + zustand(p) + '</div></div></div>';

    html += '<div class="raster raster--4" style="margin-bottom:1rem">' +
      kennzahl('Stärke', String(p.staerke), 'Potenzial ' + p.potenzial) +
      kennzahl('Marktwert', Fmt.money(p.marktwert), '') +
      kennzahl('Gehalt', Fmt.money(p.gehalt), 'pro Woche') +
      kennzahl('Vertrag bis', String(p.vertragBis), Math.max(0, p.vertragBis - st.saison) + ' Jahre Restlaufzeit') +
      '</div>';

    html += '<div class="raster raster--2">';
    html += '<div><h4>Fähigkeiten</h4>' + Object.keys(Players.ATTR_NAMEN).filter(function (a) {
      return p.pos === 'TW' ? a !== 'abschluss' : a !== 'reflexe';
    }).map(function (a) {
      return '<div style="display:grid;grid-template-columns:9em 1fr 2.2em;align-items:center;gap:.5em;margin-bottom:.28em;font-size:.85rem">' +
        '<span class="mini">' + Players.ATTR_NAMEN[a] + '</span>' +
        '<span class="balken" style="width:auto"><i style="width:' + p.attrs[a] + '%;background:' + staerkeFarbe(p.attrs[a]) + '"></i></span>' +
        '<b style="text-align:right;font-variant-numeric:tabular-nums">' + p.attrs[a] + '</b></div>';
    }).join('') + '</div>';

    html += '<div><h4>Zustand & Saison</h4>' +
      '<table class="liste"><tbody>' +
      '<tr><td>Form</td><td class="zahl">' + p.form + ' / 100</td></tr>' +
      '<tr><td>Fitness</td><td class="zahl">' + p.fitness + ' %</td></tr>' +
      '<tr><td>Moral</td><td class="zahl">' + p.moral + ' / 100</td></tr>' +
      '<tr><td>Einsätze</td><td class="zahl">' + p.stats.spiele + ' (' + Fmt.num(p.stats.minuten) + ' Min.)</td></tr>' +
      '<tr><td>Tore / Vorlagen</td><td class="zahl">' + p.stats.tore + ' / ' + p.stats.vorlagen + '</td></tr>' +
      '<tr><td>Karten</td><td class="zahl">' + p.stats.gelb + ' gelb, ' + p.stats.rot + ' rot</td></tr>' +
      '<tr><td>Notenschnitt</td><td class="zahl">' + noteText(note) + '</td></tr>' +
      '</tbody></table></div></div>';

    /* Leihstatus sichtbar machen */
    if (p.leihe) {
      var geber = st.klubs[p.leihe.vonKlubId];
      html += '<div class="dossier__hinweise"><b>Leihspieler</b> von ' +
        Util.esc(geber ? geber.name : '?') + ' bis ' + Fmt.date(p.leihe.bisTag, st.saison) +
        '. Sie tragen ' + p.leihe.gehaltsanteil + ' % des Gehalts' +
        (p.leihe.kaufoption ? ', vereinbarte Kaufoption: <b>' + Fmt.money(p.leihe.kaufoption) + '</b>' : '') +
        '.</div>';
    }
    var verliehenVon = null;
    if (eigen === false && klub && mein() && (mein().verliehen || []).indexOf(p.id) >= 0) verliehenVon = klub;
    if (verliehenVon) {
      html += '<div class="dossier__hinweise">Aktuell an <b>' + Util.esc(verliehenVon.name) +
        '</b> verliehen. Er kehrt am Saisonende zurück.</div>';
    }

    var aktionen = [];
    if (eigen && p.leihe && p.leihe.kaufoption) {
      aktionen.push({
        text: 'Kaufoption ziehen (' + Fmt.money(p.leihe.kaufoption) + ')',
        klasse: 'knopf--haupt', schliessen: false,
        fn: function () {
          var r = Game.kaufoptionZiehen(st, p);
          if (!r.ok) { toast(r.grund); return; }
          modalZu();
          toast(p.name + ' gehört jetzt fest zum Verein.');
          Game.post(st, 'Kaufoption gezogen: ' + p.name,
            p.name + ' wurde für ' + Fmt.money(r.preis) + ' fest verpflichtet.', 'gut');
          UI.zeichne();
        }
      });
    }
    if (eigen) {
      aktionen.push({
        text: p.transferliste ? 'Von Transferliste nehmen' : 'Auf die Transferliste',
        klasse: 'knopf--still',
        fn: function () {
          p.transferliste = !p.transferliste;
          toast(p.transferliste ? p.name + ' steht auf der Transferliste.' : p.name + ' wurde von der Liste genommen.');
          UI.zeichne();
        }
      });
      /* schliessen: false, weil die Funktion selbst ein neues Fenster oeffnet. */
      if (!p.leihe) {
        aktionen.push({
          text: 'Verleihen', klasse: 'knopf--still', schliessen: false,
          fn: function () { UI.leihVerhandlung(p.id, 'raus'); }
        });
        aktionen.push({
          text: 'Vertrag verlängern', klasse: 'knopf--haupt', schliessen: false,
          fn: function () { UI.vertragsVerhandlung(p.id); }
        });
      }
    } else if (klub) {
      if (!p.leihe && !verliehenVon) {
        aktionen.push({
          text: 'Ausleihen', klasse: 'knopf--still', schliessen: false,
          fn: function () { UI.leihVerhandlung(p.id, 'rein'); }
        });
      }
      aktionen.push({
        text: 'Transferangebot abgeben', klasse: 'knopf--haupt', schliessen: false,
        fn: function () { UI.transferVerhandlung(p.id); }
      });
    } else {
      aktionen.push({
        text: 'Ablösefrei verpflichten', klasse: 'knopf--haupt', schliessen: false,
        fn: function () { UI.vertragsVerhandlung(p.id, true); }
      });
    }
    (extraAktionen || []).forEach(function (a) { aktionen.push(a); });
    aktionen.push({ text: 'Schließen', klasse: 'knopf--still' });
    modal(p.name, html, aktionen, true);
  };

  function kennzahl(titel, wert, unten) {
    return '<div class="kennzahl"><span>' + titel + '</span><b>' + wert + '</b>' +
      (unten ? '<small>' + unten + '</small>' : '') + '</div>';
  }

  /* ---------- Übersicht ---------- */

  UI.seiten.uebersicht = function () {
    var st = S(), mein = meinKlub();
    var liga = st.ligen[mein.ligaId];
    var kader = Game.kaderVon(st, mein);
    var platz = liga ? League.platzVon(liga, mein.id) : 0;
    var z = liga ? liga.tabelle[mein.id] : null;
    var naechstes = liga ? League.naechstesSpiel(liga, mein.id, st.tag) : null;
    var fin = mein.finanzen;

    var html = '<div class="raster raster--4">' +
      kennzahl('Tabellenplatz', platz ? platz + '.' : '–', liga ? liga.name : '') +
      kennzahl('Punkte', z ? String(z.punkte - z.abzug) : '0', z ? z.sp + ' Spiele · ' + z.tore + ':' + z.gegentore + ' Tore' : '') +
      kennzahl('Kontostand', Fmt.money(fin.kontostand), 'Transferbudget ' + Fmt.money(fin.transferbudget)) +
      kennzahl('Kadergröße', String(kader.length), 'Wert ' + Fmt.money(Util.sum(kader, function (p) { return p.marktwert; }))) +
      '</div>';

    html += '<div class="raster raster--2">';

    /* Nächstes Spiel */
    html += '<div class="karte"><div class="karte__kopf"><h3>Nächstes Spiel</h3></div>';
    if (naechstes) {
      var gegnerId = naechstes.heim ? naechstes.partie.gast : naechstes.partie.heim;
      var gegner = st.klubs[gegnerId];
      var gPlatz = League.platzVon(liga, gegnerId);
      html += '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">' +
        wappen(gegner, 52) +
        '<div><b style="font-size:1.05rem">' + Util.esc(gegner.name) + '</b>' +
        '<div class="mini">' + (naechstes.heim ? 'Heimspiel' : 'Auswärtsspiel') + ' · ' +
        naechstes.spieltag.nr + '. Spieltag · ' + Fmt.weekday(naechstes.spieltag.tag, st.saison) + ', ' +
        Fmt.date(naechstes.spieltag.tag, st.saison) + '</div>' +
        '<div class="mini">Tabellenplatz ' + gPlatz + ' · ' + formIcons(liga.tabelle[gegnerId].form) + '</div>' +
        '</div></div>';
      html += '<p class="hinweis" style="margin-top:.8em">Noch <b>' + (naechstes.spieltag.tag - st.tag) + '</b> Tage bis zum Anpfiff.</p>';
    } else {
      html += '<p class="hinweis">Kein weiteres Ligaspiel in dieser Saison.</p>';
    }
    html += '</div>';

    /* Vorstand */
    html += '<div class="karte"><div class="karte__kopf"><h3>Vorstand</h3>' +
      '<span class="marke ' + (mein.vorstand.vertrauen >= 60 ? 'marke--gut' : (mein.vorstand.vertrauen >= 30 ? 'marke--warn' : 'marke--gefahr')) +
      '">Vertrauen ' + mein.vorstand.vertrauen + ' %</span></div>' +
      '<div class="fortschritt" style="margin-bottom:.7em"><i style="width:' + mein.vorstand.vertrauen + '%"></i></div>' +
      '<p class="hinweis">' + Util.esc(mein.vorstand.ziel) + '</p>';
    if (fin.kontostand < 0) {
      html += '<p class="schlecht">Das Konto ist im Minus. Der Vorstand erwartet, dass Sie gegensteuern.</p>';
    }
    html += '</div>';

    html += '</div>';

    /* Letzte Ergebnisse und Nachrichten */
    html += '<div class="raster raster--2">';
    html += '<div class="karte"><div class="karte__kopf"><h3>Letzte Spiele</h3></div>';
    if (liga) {
      var spiele = League.spieleVon(liga, mein.id).filter(function (s) { return s.partie.th !== null; }).slice(-6).reverse();
      if (spiele.length) {
        html += '<table class="liste"><tbody>' + spiele.map(function (s) {
          var gegnerId = s.heim ? s.partie.gast : s.partie.heim;
          var eigene = s.heim ? s.partie.th : s.partie.tg;
          var fremde = s.heim ? s.partie.tg : s.partie.th;
          var res = eigene > fremde ? 'S' : (eigene < fremde ? 'N' : 'U');
          return '<tr class="klickbar" data-partie="' + s.nr + '"><td class="mitte"><span class="form"><i class="' + res + '">' + res + '</i></span></td>' +
            '<td>' + (s.heim ? '' : 'bei ') + klubZelle(st.klubs[gegnerId], 18) + '</td>' +
            '<td class="zahl"><b>' + eigene + ':' + fremde + '</b></td>' +
            '<td class="zahl mini">' + s.nr + '. ST</td></tr>';
        }).join('') + '</tbody></table>';
      } else {
        html += '<p class="hinweis">Noch keine Spiele bestritten.</p>';
      }
    }
    html += '</div>';

    html += '<div class="karte"><div class="karte__kopf"><h3>Neuigkeiten</h3></div>';
    var nachrichten = st.postfach.slice(0, 4);
    if (nachrichten.length) {
      html += nachrichten.map(function (m) {
        return '<div class="nachricht ' + m.art + (m.gelesen ? '' : ' ungelesen') + '">' +
          '<div class="nachricht__kopf"><span class="nachricht__betreff">' + Util.esc(m.betreff) + '</span>' +
          '<span class="nachricht__datum">' + Fmt.date(m.tag, m.saison) + '</span></div></div>';
      }).join('');
    } else {
      html += '<p class="hinweis">Keine neuen Nachrichten.</p>';
    }
    if (st.news.length) {
      html += '<h4 style="margin-top:1em">Aus den Ligen</h4>' +
        st.news.slice(0, 4).map(function (n) {
          return '<p class="mini" style="margin:.2em 0">' + Util.esc(n.text) + '</p>';
        }).join('');
    }
    html += '</div></div>';

    /* Formstärkste Spieler */
    var top = kader.slice().sort(function (a, b) {
      var na = noteSchnitt(a), nb = noteSchnitt(b);
      if (na === null) return 1;
      if (nb === null) return -1;
      return na - nb;
    }).filter(function (p) { return p.stats.spiele > 0; }).slice(0, 5);
    if (top.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Beste Spieler der Saison</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Spieler</th><th class="mitte">Pos</th>' +
        '<th class="zahl">Spiele</th><th class="zahl">Tore</th><th class="zahl">Vorl.</th><th class="zahl">Note</th></tr></thead><tbody>' +
        top.map(function (p) {
          return '<tr class="klickbar" data-spieler="' + p.id + '"><td>' + Util.esc(p.name) + '</td>' +
            '<td class="mitte">' + posMarke(p.pos) + '</td><td class="zahl">' + p.stats.spiele + '</td>' +
            '<td class="zahl">' + p.stats.tore + '</td><td class="zahl">' + p.stats.vorlagen + '</td>' +
            '<td class="zahl">' + noteText(noteSchnitt(p)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  UI.nachZeichnen.uebersicht = function () {
    spielerKlicks();
  };

  function spielerKlicks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-spieler]'), function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        UI.spielerFenster(el.dataset.spieler);
      };
    });
  }

  /* ---------- Tabellenseite ---------- */

  UI.seiten.tabellen = function () {
    var st = S();
    var aktiv = UI.daten.liga || meinKlub().ligaId || 'bl1';
    var html = '<div class="reiter">' + st.ligaReihenfolge.map(function (lid) {
      return '<button data-liga="' + lid + '" class="' + (lid === aktiv ? 'aktiv' : '') + '">' +
        Util.esc(st.ligen[lid].name) + '</button>';
    }).join('') + '</div>';
    var liga = st.ligen[aktiv];
    html += '<div class="karte"><div class="karte__kopf"><h2>' + Util.esc(liga.name) + '</h2>' +
      '<span class="mini">' + liga.aktuellerSpieltag + '. von ' + liga.spieltage.length + ' Spieltagen</span></div>' +
      tabelleHTML(liga) + legende(liga) + '</div>';

    /* Torjäger */
    var schuetzen = [];
    liga.klubs.forEach(function (kid) {
      Game.kaderVon(st, st.klubs[kid]).forEach(function (p) {
        if (p.stats.tore > 0) schuetzen.push(p);
      });
    });
    schuetzen.sort(function (a, b) { return b.stats.tore - a.stats.tore || b.stats.vorlagen - a.stats.vorlagen; });
    if (schuetzen.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Torjägerliste</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th class="mitte">#</th><th>Spieler</th>' +
        '<th>Verein</th><th class="zahl">Tore</th><th class="zahl">Vorlagen</th><th class="zahl">Spiele</th></tr></thead><tbody>' +
        schuetzen.slice(0, 15).map(function (p, i) {
          return '<tr class="klickbar" data-spieler="' + p.id + '"><td class="mitte">' + (i + 1) + '</td>' +
            '<td>' + Util.esc(p.name) + '</td><td>' + klubZelle(st.klubs[p.klubId], 18, true) + '</td>' +
            '<td class="zahl"><b>' + p.stats.tore + '</b></td><td class="zahl">' + p.stats.vorlagen + '</td>' +
            '<td class="zahl">' + p.stats.spiele + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  function legende(liga) {
    var teile = [];
    if (liga.id === 'bl1') teile.push('<span class="platz platz--eu">1–6</span> internationale Wettbewerbe');
    if (liga.aufstieg) teile.push('<span class="platz platz--auf">1–' + liga.aufstieg + '</span> Aufstieg');
    if (liga.relegation) teile.push('<span class="platz platz--rel">Rel.</span> Relegation');
    teile.push('<span class="platz platz--ab">unten</span> Abstieg');
    return '<p class="mini" style="margin-top:.7em">' + teile.join(' · ') + '</p>';
  }

  UI.nachZeichnen.tabellen = function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-liga]'), function (b) {
      b.onclick = function () { UI.wechsle('tabellen', { liga: b.dataset.liga }); };
    });
    tabellenKlicks();
    spielerKlicks();
  };

  /* ---------- Spielplan ---------- */

  UI.seiten.spielplan = function () {
    var st = S(), mein = meinKlub();
    var liga = st.ligen[mein.ligaId];
    if (!liga) return '<div class="karte"><p>Ihr Verein spielt derzeit in keiner Liga.</p></div>';
    var ansicht = UI.daten.ansicht || 'eigene';

    var html = '<div class="reiter">' +
      '<button data-ansicht="eigene" class="' + (ansicht === 'eigene' ? 'aktiv' : '') + '">Eigene Spiele</button>' +
      '<button data-ansicht="spieltag" class="' + (ansicht === 'spieltag' ? 'aktiv' : '') + '">Spieltag</button>' +
      '</div>';

    if (ansicht === 'eigene') {
      var spiele = League.spieleVon(liga, mein.id);
      html += '<div class="karte"><div class="karte__kopf"><h2>Spielplan ' + Util.esc(liga.name) + '</h2></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th class="zahl">ST</th><th>Datum</th>' +
        '<th>Gegner</th><th class="mitte">Ort</th><th class="zahl">Ergebnis</th><th class="zahl">Zuschauer</th></tr></thead><tbody>' +
        spiele.map(function (s) {
          var gegnerId = s.heim ? s.partie.gast : s.partie.heim;
          var erg = '<span class="mini">–</span>';
          if (s.partie.th !== null) {
            var eigene = s.heim ? s.partie.th : s.partie.tg;
            var fremde = s.heim ? s.partie.tg : s.partie.th;
            var farbe = eigene > fremde ? 'gut' : (eigene < fremde ? 'schlecht' : '');
            erg = '<b class="' + farbe + '">' + eigene + ':' + fremde + '</b>';
          }
          var heute = s.tag === st.tag ? ' style="background:rgba(232,182,76,.12)"' : '';
          return '<tr' + heute + '><td class="zahl">' + s.nr + '</td>' +
            '<td class="mini">' + Fmt.weekday(s.tag, st.saison) + ', ' + Fmt.date(s.tag, st.saison) + '</td>' +
            '<td>' + klubZelle(st.klubs[gegnerId], 18) + '</td>' +
            '<td class="mitte"><span class="marke">' + (s.heim ? 'H' : 'A') + '</span></td>' +
            '<td class="zahl">' + erg + '</td>' +
            '<td class="zahl mini">' + (s.partie.zuschauer ? Fmt.num(s.partie.zuschauer) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    } else {
      var nr = UI.daten.spieltag || Math.max(1, liga.aktuellerSpieltag);
      var stag = liga.spieltage[nr - 1];
      html += '<div class="karte"><div class="karte__kopf">' +
        '<h2>' + nr + '. Spieltag</h2>' +
        '<div class="knopfreihe">' +
        '<button class="knopf knopf--klein knopf--still" id="stZurueck"' + (nr <= 1 ? ' disabled' : '') + '>◀</button>' +
        '<button class="knopf knopf--klein knopf--still" id="stVor"' + (nr >= liga.spieltage.length ? ' disabled' : '') + '>▶</button>' +
        '</div></div>' +
        '<p class="mini">' + Fmt.weekday(stag.tag, st.saison) + ', ' + Fmt.date(stag.tag, st.saison) + '</p>' +
        '<div class="tabellenrahmen"><table class="liste"><tbody>' +
        stag.partien.map(function (p) {
          var eigen = (p.heim === mein.id || p.gast === mein.id) ? ' class="eigen"' : '';
          return '<tr' + eigen + '><td style="text-align:right">' + klubZelle(st.klubs[p.heim], 18) + '</td>' +
            '<td class="mitte" style="width:5em"><b>' + (p.th === null ? '– : –' : p.th + ' : ' + p.tg) + '</b></td>' +
            '<td>' + klubZelle(st.klubs[p.gast], 18) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  UI.nachZeichnen.spielplan = function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ansicht]'), function (b) {
      b.onclick = function () { UI.wechsle('spielplan', { ansicht: b.dataset.ansicht }); };
    });
    var mein = meinKlub();
    var liga = S().ligen[mein.ligaId];
    var nr = UI.daten.spieltag || (liga ? Math.max(1, liga.aktuellerSpieltag) : 1);
    var zurueck = $('stZurueck'), vor = $('stVor');
    if (zurueck) zurueck.onclick = function () { UI.wechsle('spielplan', { ansicht: 'spieltag', spieltag: nr - 1 }); };
    if (vor) vor.onclick = function () { UI.wechsle('spielplan', { ansicht: 'spieltag', spieltag: nr + 1 }); };
  };

  /* ---------- Postfach ---------- */

  UI.seiten.postfach = function () {
    var st = S();
    if (!st.postfach.length) {
      return '<div class="karte"><h2>Postfach</h2><p class="hinweis">Keine Nachrichten vorhanden.</p></div>';
    }
    return '<div class="karte"><div class="karte__kopf"><h2>Postfach</h2>' +
      '<button class="knopf knopf--klein knopf--still" id="allesGelesen">Alle als gelesen markieren</button></div>' +
      st.postfach.map(function (m) {
        return '<div class="nachricht ' + m.art + (m.gelesen ? '' : ' ungelesen') + '" data-post="' + m.id + '">' +
          '<div class="nachricht__kopf"><span class="nachricht__betreff">' + Util.esc(m.betreff) + '</span>' +
          '<span class="nachricht__datum">' + Fmt.date(m.tag, m.saison) + '</span></div>' +
          '<p class="nachricht__text">' + Util.esc(m.text) + '</p>' +
          (m.daten && m.daten.verhandlungId ? '<button class="knopf knopf--klein knopf--haupt" data-verh="' + m.daten.verhandlungId + '">Zur Verhandlung</button>' : '') +
          '</div>';
      }).join('') + '</div>';
  };

  UI.nachZeichnen.postfach = function () {
    var st = S();
    st.postfach.forEach(function (m) { m.gelesen = true; });
    var b = $('allesGelesen');
    if (b) b.onclick = function () { st.postfach.forEach(function (m) { m.gelesen = true; }); UI.zeichne(); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-verh]'), function (el) {
      el.onclick = function () { UI.wechsle('verhandlungen'); };
    });
    kopfZeichnen();
    menueZeichnen();
  };

  /* ---------- Verein / Statistik ---------- */

  UI.seiten.verein = function () {
    var st = S(), mein = meinKlub();
    var liga = st.ligen[mein.ligaId];
    var html = '<div class="karte"><div class="karte__kopf"><h2>' + Util.esc(mein.name) + '</h2></div>' +
      '<div style="display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">' +
      wappen(mein, 84) +
      '<div><div class="mini">' + Util.esc(mein.stadt) + ' · gegründet als Verein der Region</div>' +
      '<div style="margin-top:.3em">' + (liga ? Util.esc(liga.name) : '') + ' · Ansehen ' + mein.ruf + '/100</div>' +
      '<div class="mini">Trainer: ' + Util.esc(st.managerName) + '</div></div></div>';

    html += '<div class="raster raster--3">' +
      kennzahl('Vorstandsvertrauen', mein.vorstand.vertrauen + ' %', mein.vorstand.ziel) +
      kennzahl('Saisonziel', 'Platz ' + mein.vorstand.zielPlatz, liga ? liga.name : '') +
      kennzahl('Europapokal', mein.europapokal ? mein.europapokal.name : 'keine Teilnahme',
        mein.europapokal ? Fmt.money(mein.europapokal.betrag) + ' pro Saison' : '') +
      '</div></div>';

    if (st.saisonHistorie.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Ihre bisherigen Saisons</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Saison</th><th>Liga</th>' +
        '<th class="zahl">Platz</th><th class="zahl">Ziel</th><th>Ergebnis</th></tr></thead><tbody>' +
        st.saisonHistorie.map(function (h) {
          if (!h.meinKlub) return '';
          var m = h.meinKlub;
          var text = m.aufgestiegen ? '<span class="gut">Aufstieg</span>' :
            (m.abgestiegen ? '<span class="schlecht">Abstieg</span>' :
              (m.platz <= m.ziel ? '<span class="gut">Ziel erreicht</span>' : '<span class="mini">Ziel verfehlt</span>'));
          return '<tr><td>' + h.saison + '/' + String(h.saison + 1).slice(2) + '</td><td>' + Util.esc(m.liga) + '</td>' +
            '<td class="zahl">' + m.platz + '</td><td class="zahl">' + m.ziel + '</td><td>' + text + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    /* Weltweite Transfers */
    if (st.statistik.transfers.length) {
      html += '<div class="karte"><div class="karte__kopf"><h3>Transfers weltweit</h3></div>' +
        '<div class="tabellenrahmen"><table class="liste"><thead><tr><th>Spieler</th><th>von</th><th>nach</th>' +
        '<th class="zahl">Ablöse</th></tr></thead><tbody>' +
        st.statistik.transfers.slice(0, 20).map(function (t) {
          return '<tr><td>' + Util.esc(t.name) + '</td>' +
            '<td>' + (t.von ? klubZelle(st.klubs[t.von], 16, true) : '<span class="mini">vereinslos</span>') + '</td>' +
            '<td>' + klubZelle(st.klubs[t.zu], 16, true) + '</td>' +
            '<td class="zahl">' + (t.abloese ? Fmt.money(t.abloese) : 'ablösefrei') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
    return html;
  };

  /* ---------- Export ---------- */

  UI.$ = $;
  UI.S = S;
  UI.meinKlub = meinKlub;
  UI.wappen = wappen;
  UI.klubZelle = klubZelle;
  UI.staerkeBalken = staerkeBalken;
  UI.staerkeFarbe = staerkeFarbe;
  UI.posMarke = posMarke;
  UI.formIcons = formIcons;
  UI.noteSchnitt = noteSchnitt;
  UI.noteText = noteText;
  UI.zustand = zustand;
  UI.fitnessBalken = fitnessBalken;
  UI.kennzahl = kennzahl;
  UI.icon = icon;
  UI.verliehene = function () {
    var st = S(), k = meinKlub();
    return (k.verliehen || []).map(function (id) { return st.spieler[id]; }).filter(Boolean);
  };
  UI.modal = modal;
  UI.modalZu = modalZu;
  UI.toast = toast;
  UI.tabelleHTML = tabelleHTML;
  UI.tabellenKlicks = tabellenKlicks;
  UI.spielerKlicks = spielerKlicks;
  UI.kopfZeichnen = kopfZeichnen;
  UI.menueZeichnen = menueZeichnen;
  g.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
