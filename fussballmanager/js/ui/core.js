/* UI-Grundgeruest: Shell, Router, Aktionen, Modals, Toasts und kleine Bausteine. */
(function () {
  'use strict';
  var FM = window.FM;
  var esc = FM.esc;

  var UI = FM.ui = {
    view: 'dashboard',
    params: {},
    s: {},            // fluechtiger UI-Zustand je Ansicht (Filter, Sortierung, Tabs)
    views: {},
    actions: {},
    busy: false
  };

  /* ---------- Icons ---------- */
  var IC = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tactics: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/><path d="M8 3v3.5h8V3M8 21v-3.5h8V21"/>',
    training: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    table: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    transfer: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    euro: '<path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    skip: '<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.4-1.4M14.5 15.1l2.7 3.8M9.5 15.1l-2.7 3.8M8 10.4 3.6 9"/>',
    swap: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    medic: '<path d="M12 5v14M5 12h14"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    board: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    youth: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    whistle: '<circle cx="8" cy="15" r="5"/><path d="M12 12 21 7l-1 4-5 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>'
  };
  UI.icon = function (name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';
  };

  /* ---------- Farben ---------- */
  function lum(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    function f(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  UI.ink = function (hex) { return lum(hex) > 0.42 ? '#111827' : '#ffffff'; };

  /* Vereinswappen-Ersatz: Schild in Vereinsfarben mit Kuerzel (keine Originalwappen) */
  UI.badge = function (club, size) {
    if (!club) return '';
    size = size || 32;
    var c1 = club.colors[0], c2 = club.colors[1] || '#ffffff';
    var txt = club.reserve ? club.abbr.replace(/\d$/, '') : club.abbr;
    var fs = txt.length >= 4 ? 10 : txt.length === 3 ? 12 : 14;
    var ink = UI.ink(c1);
    var light = lum(c1) > 0.8;
    var id = 'b' + club.id;
    return '<svg class="badge-club" width="' + size + '" height="' + Math.round(size * 1.12) + '" viewBox="0 0 40 45" role="img" aria-label="' + esc(club.name) + '">' +
      '<defs><clipPath id="' + id + '"><path d="M20 1.5 37.5 6.5V22c0 11.5-7.7 18.6-17.5 21.8C10.2 40.6 2.5 33.5 2.5 22V6.5z"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + ')"><rect width="40" height="45" fill="' + c1 + '"/>' +
      '<path d="M0 33 40 25V45H0z" fill="' + c2 + '" opacity="' + (c2.toLowerCase() === c1.toLowerCase() ? 0 : 0.95) + '"/></g>' +
      '<path d="M20 1.5 37.5 6.5V22c0 11.5-7.7 18.6-17.5 21.8C10.2 40.6 2.5 33.5 2.5 22V6.5z" fill="none" stroke="' + (light ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.12)') + '" stroke-width="1.2"/>' +
      '<text x="20" y="22" text-anchor="middle" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="' + fs + '" fill="' + ink + '" letter-spacing="-.3">' + esc(txt) + '</text>' +
      (club.reserve ? '<text x="20" y="35.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="7.5" fill="' + UI.ink(c2) + '">II</text>' : '') +
      '</svg>';
  };

  UI.tier = function (v) { return v >= 85 ? 'r1' : v >= 80 ? 'r2' : v >= 75 ? 'r3' : v >= 70 ? 'r4' : v >= 65 ? 'r5' : 'r6'; };
  UI.pill = function (v, cls) { return '<span class="pill ' + UI.tier(v) + ' ' + (cls || '') + '">' + v + '</span>'; };
  UI.posTag = function (pos) { return '<span class="pos ' + FM.posGroup(pos) + '" title="' + esc(FM.POS_NAME[pos] || pos) + '">' + (FM.POS_LABEL[pos] || pos) + '</span>'; };
  UI.gradeCls = function (g) { return g == null ? '' : g <= 1.5 ? 'g1' : g <= 2.5 ? 'g2' : g <= 3.5 ? 'g3' : g <= 4.5 ? 'g4' : 'g5'; };
  UI.grade = function (g) { return g == null ? '<span class="muted">–</span>' : '<span class="grade ' + UI.gradeCls(g) + '">' + FM.fmtGrade(g) + '</span>'; };
  UI.formDots = function (arr) {
    return '<span class="form-dots">' + (arr || []).map(function (r) { return '<i class="' + r + '">' + r + '</i>'; }).join('') + '</span>';
  };
  UI.fit = function (v) {
    var c = v >= 80 ? '' : v >= 65 ? 'warn' : 'bad';
    return '<span class="fitmini ' + c + '" title="Fitness ' + Math.round(v) + '%"><i style="width:' + Math.round(v) + '%"></i></span>';
  };
  UI.stars = function (n, max) {
    max = max || 5;
    var s = '';
    for (var i = 1; i <= max; i++) s += i <= Math.round(n) ? '★' : '<span class="off">★</span>';
    return '<span class="stars" aria-label="' + n + ' von ' + max + '">' + s + '</span>';
  };
  UI.shortName = function (name) {
    var parts = name.split(' ');
    if (parts.length < 2) return name;
    var particles = { de: 1, van: 1, von: 1, da: 1, den: 1, der: 1, di: 1, dos: 1, le: 1, el: 1 };
    var idx = parts.length - 1;
    while (idx > 1 && particles[parts[idx - 1].toLowerCase()]) idx--;
    if (/^(Kim|Lee|Jeong|Kwon|Hong|Seo|Cho)$/.test(parts[0])) return name;
    return parts[0].charAt(0) + '. ' + parts.slice(idx).join(' ');
  };
  UI.clubLink = function (cid, opts) {
    var c = FM.state.clubs[cid];
    if (!c) return '<span class="muted">vereinslos</span>';
    opts = opts || {};
    return '<span class="club-cell" data-action="club" data-id="' + cid + '" style="cursor:pointer">' + UI.badge(c, opts.size || 20) +
      '<span class="ellipsis' + (cid === FM.state.user.club ? ' strong' : '') + '">' + esc(opts.full ? c.name : c.short) + '</span></span>';
  };
  UI.playerLink = function (p, short) {
    return '<span class="pname" data-action="player" data-id="' + p.id + '" style="cursor:pointer">' + esc(short ? UI.shortName(p.name) : p.name) + '</span>';
  };
  UI.srcMark = function (p) {
    if (p.src === 'v' || p.src === 'o') return '';
    var t = p.src === 'f' ? 'FC 26' : p.src === 'y' ? 'Akademie' : 'geschätzt';
    return ' <span class="muted tiny" title="' + esc(FM.SRC_LABEL[p.src]) + '">' + (p.src === 'e' ? '≈' : p.src === 'f' ? '²⁶' : '') + '</span>' + (p.src === 'y' ? ' <span class="tag info" title="' + esc(FM.SRC_LABEL.y) + '">' + t + '</span>' : '');
  };
  UI.status = function (p) {
    var out = [];
    if (p.injury) out.push('<span class="tag bad" title="' + esc(p.injury.type) + '">' + UI.icon('medic', '') .replace('<svg', '<svg width="10" height="10"') + ' ' + p.injury.days + ' T</span>');
    if (p.susp > 0) out.push('<span class="tag warn" title="Gesperrt (Liga)">Sperre ' + p.susp + '</span>');
    if (p.yel === 4 || p.yel === 9) out.push('<span class="tag warn" title="Nächste Gelbe Karte = Sperre">' + p.yel + '×G</span>');
    if (p.listed) out.push('<span class="tag info">Transferliste</span>');
    if (p.contract && p.contract.until <= FM.state.season.year + 1) out.push('<span class="tag" title="Vertrag läuft aus">Vertr. endet</span>');
    return out.join(' ');
  };
  UI.potRange = function (p) {
    if (p.club === FM.state.user.club || p.age >= 27) return String(p.pot);
    var spread = p.age <= 20 ? 4 : 2;
    var h = FM.hash(p.id + 'scout') % (spread + 1);
    var lo = Math.max(p.ovr, p.pot - h), hi = Math.min(95, lo + spread);
    return lo === hi ? String(lo) : lo + '–' + hi;
  };

  /* ---------- Toast & Modal ---------- */
  UI.toast = function (msg, kind) {
    var root = document.getElementById('toasts');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2800);
    setTimeout(function () { el.remove(); }, 3200);
  };

  UI.modal = function (html, opts) {
    opts = opts || {};
    var root = document.getElementById('modal');
    root.innerHTML = '<div class="modal-backdrop" data-action="closeModal"></div><div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    root.classList.add('open');
    UI.modalOpen = true;
    UI.onModalClose = opts.onClose || null;
    if (opts.mount) opts.mount(root.querySelector('.modal'));
    var f = root.querySelector('[autofocus]');
    if (f) f.focus();
  };
  UI.closeModal = function () {
    var root = document.getElementById('modal');
    root.classList.remove('open');
    root.innerHTML = '';
    UI.modalOpen = false;
    var cb = UI.onModalClose; UI.onModalClose = null;
    if (cb) cb();
  };
  UI.modalHead = function (title, sub, extra) {
    return '<div class="modal-h">' + (extra || '') + '<div class="grow"><h2>' + title + '</h2>' + (sub ? '<div class="muted small">' + sub + '</div>' : '') + '</div>' +
      '<button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
  };
  UI.confirm = function (title, text, okLabel, onOk, danger) {
    UI.modal(UI.modalHead(esc(title)) + '<div class="modal-b"><p class="dim">' + text + '</p></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="confirm-ok">' + esc(okLabel) + '</button></div>',
      { size: 'narrow', mount: function (m) { m.querySelector('#confirm-ok').addEventListener('click', function () { UI.closeModal(); onOk(); }); } });
  };

  /* ---------- Navigation ---------- */
  var NAV = [
    ['dashboard', 'Übersicht', 'home'],
    ['inbox', 'Posteingang', 'inbox'],
    ['squad', 'Kader', 'users'],
    ['tactics', 'Taktik & Aufstellung', 'tactics'],
    ['training', 'Training', 'training'],
    null,
    ['fixtures', 'Spielplan', 'calendar'],
    ['table', 'Tabellen', 'table'],
    ['stats', 'Statistiken', 'chart'],
    null,
    ['transfers', 'Transfermarkt', 'transfer'],
    ['finances', 'Finanzen', 'euro'],
    ['club', 'Verein & Vorstand', 'board']
  ];
  var MOBILE = [['dashboard', 'Übersicht', 'home'], ['squad', 'Kader', 'users'], ['tactics', 'Taktik', 'tactics'], ['table', 'Tabelle', 'table'], ['transfers', 'Transfers', 'transfer']];

  UI.renderShell = function () {
    var st = FM.state, club = st.clubs[st.user.club];
    var unread = FM.unreadCount(st);
    var nav = NAV.map(function (n) {
      if (!n) return '<div class="nav-sep"></div>';
      var count = n[0] === 'inbox' && unread ? '<span class="count">' + (unread > 99 ? '99+' : unread) + '</span>' : '';
      return '<button data-action="go" data-view="' + n[0] + '" class="' + (UI.view === n[0] ? 'active' : '') + '">' + UI.icon(n[2]) + '<span>' + n[1] + '</span>' + count + '</button>';
    }).join('');
    var mob = MOBILE.map(function (n) {
      return '<button data-action="go" data-view="' + n[0] + '" class="' + (UI.view === n[0] ? 'active' : '') + '">' + UI.icon(n[2]) + '<span>' + n[1] + '</span></button>';
    }).join('');
    var league = st.leagues[club.league];
    var pos = FM.playedRounds(st, club.league) ? FM.clubPosition(st, club.id) : null;
    document.getElementById('app').innerHTML =
      '<div class="shell" id="shell">' +
      '<aside class="sidebar">' +
      '<div class="brand"><div class="brand-mark">' + UI.icon('ball') + '</div><div><div class="brand-name">Matchplan</div><div class="brand-sub">Fußballmanager 26/27</div></div></div>' +
      '<div class="club-chip">' + UI.badge(club, 30) + '<div style="min-width:0"><div class="name ellipsis">' + esc(club.name) + '</div><div class="sub">' + esc(league.name) + (pos ? ' · Platz ' + pos : '') + '</div></div></div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="sidebar-foot nav"><button data-action="saveGame">' + UI.icon('save') + '<span>Speichern</span></button>' +
      '<button data-action="settings">' + UI.icon('settings') + '<span>Einstellungen</span></button></div>' +
      '</aside>' +
      '<div class="main">' +
      '<header class="topbar"><button class="btn ghost icon menu-btn" data-action="toggleNav" aria-label="Menü">' + UI.icon('menu') + '</button>' +
      '<div><div class="title" id="view-title"></div></div>' +
      '<div class="spacer"></div>' +
      '<div class="date"><span class="wd">' + FM.date.weekdayName(st.date) + ',</span> ' + FM.date.fmt(st.date) + '</div>' +
      '<div class="money-wrap"><span class="tag ' + (club.money < 0 ? 'bad' : '') + ' money" title="Kontostand">' + FM.fmtMoney(club.money) + '</span></div>' +
      '<button class="btn primary btn-continue" id="btn-continue" data-action="continue">' + continueLabel() + '</button>' +
      '</header>' +
      '<main class="content" id="view"></main>' +
      '</div>' +
      '<nav class="mobile-nav">' + mob + '</nav>' +
      '</div>';
  };

  function continueLabel() {
    var st = FM.state;
    if (FM.userFixture(st)) return UI.icon('whistle') + ' Zum Spiel';
    return 'Weiter ' + UI.icon('next');
  }

  UI.go = function (view, params, keepScroll) {
    if (!FM.state) return;
    UI.view = view;
    UI.params = params || {};
    UI.render(keepScroll);
  };

  UI.render = function (keepScroll) {
    var y = window.scrollY;
    UI.renderShell();
    var v = UI.views[UI.view] || UI.views.dashboard;
    var el = document.getElementById('view');
    document.getElementById('view-title').textContent = typeof v.title === 'function' ? v.title(UI.params) : v.title;
    el.innerHTML = v.render(UI.params);
    if (v.mount) v.mount(el, UI.params);
    document.title = (typeof v.title === 'function' ? v.title(UI.params) : v.title) + ' · Matchplan';
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  };
  UI.refresh = function () { if (!FM.state) { UI.renderStart(); return; } UI.render(true); };

  /* ---------- Aktionen (delegiert) ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var name = el.getAttribute('data-action');
    var fn = UI.actions[name];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && UI.modalOpen) UI.closeModal();
  });

  UI.actions.go = function (el) {
    var shell = document.getElementById('shell');
    if (shell) shell.classList.remove('nav-open');
    if (UI.modalOpen) UI.closeModal();
    UI.go(el.getAttribute('data-view'), JSON.parse(el.getAttribute('data-params') || '{}'));
  };
  UI.actions.closeModal = function () { UI.closeModal(); };
  UI.actions.toggleNav = function () { document.getElementById('shell').classList.toggle('nav-open'); };
  UI.actions.saveGame = function () {
    if (FM.save(UI.slot || 1)) UI.toast('Spielstand gespeichert.', 'good');
    else UI.toast('Speichern nicht möglich (Browser-Speicher voll oder gesperrt).', 'bad');
  };
  UI.actions.setUi = function (el) {
    var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
    var view = el.getAttribute('data-scope') || UI.view;
    UI.s[view] = UI.s[view] || {};
    UI.s[view][k] = v === 'true' ? true : v === 'false' ? false : (v !== '' && !isNaN(+v) && k !== 'q' ? +v : v);
    if (k !== 'page') UI.s[view].page = 0;
    UI.refresh();
  };
  UI.vs = function (view, defaults) {
    UI.s[view] = UI.s[view] || {};
    Object.keys(defaults || {}).forEach(function (k) { if (UI.s[view][k] === undefined) UI.s[view][k] = defaults[k]; });
    return UI.s[view];
  };

  UI.seg = function (k, options, cur, scope) {
    return '<div class="seg" role="group">' + options.map(function (o) {
      return '<button data-action="setUi" data-k="' + k + '" data-v="' + o[0] + '"' + (scope ? ' data-scope="' + scope + '"' : '') + ' class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  };

  UI.sortTh = function (scope, key, label, cur, dir, cls) {
    var on = cur === key;
    return '<th class="sortable ' + (on ? 'sorted ' : '') + (cls || '') + '" data-action="sort" data-scope="' + scope + '" data-key="' + key + '">' + label + (on ? (dir < 0 ? ' ↓' : ' ↑') : '') + '</th>';
  };
  UI.actions.sort = function (el) {
    var scope = el.getAttribute('data-scope'), key = el.getAttribute('data-key');
    var s = UI.vs(scope);
    if (s.sort === key) s.dir = -(s.dir || -1); else { s.sort = key; s.dir = -1; }
    UI.refresh();
  };

  UI.theme = function (t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('matchplan.theme', t || 'auto'); } catch (e) { /* egal */ }
  };
})();
