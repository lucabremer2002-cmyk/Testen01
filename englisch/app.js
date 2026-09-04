/*
 * Englisch Trainer - Vokabeltrainer fuer den Browser, ohne Abhaengigkeiten.
 *
 * Lernkern ist ein Leitner-System mit fuenf Faechern: eine richtige Antwort
 * schiebt die Karte ein Fach weiter (und damit weiter in die Zukunft), eine
 * falsche wirft sie zurueck in Fach 1. Faellige Karten werden bevorzugt
 * abgefragt, neue Karten kommen nur bis zu einem Tageslimit dazu.
 *
 * Darum herum liegt die spielerische Schicht: ein Einstufungstest bestimmt
 * das Englischniveau (A1 bis B2), das mit den gelernten Karten aufsteigt.
 * Antworten geben XP, Serien geben Multiplikatoren, Abzeichen belohnen
 * Meilensteine und die Blitzrunde ist ein Minispiel gegen die Uhr.
 *
 * Der gesamte Stand liegt im localStorage; es gibt kein Backend.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Konstanten

  var STORE_KEY = 'englisch-trainer-v1';
  var DAY = 86400000;

  // Wartezeit in Tagen, bis eine Karte aus Fach n wieder abgefragt wird.
  var BOX_DAYS = [0, 0, 1, 3, 7, 21];
  var MAX_BOX = 5;
  var KNOWN_BOX = 4;              // ab diesem Fach gilt eine Karte als gelernt

  var LEVELS = ['A1', 'A2', 'B1', 'B2'];
  var LEVEL_TEXT = {
    A1: 'Du erkennst einzelne Wörter und einfache Sätze. Wir bauen zuerst den Grundwortschatz aus.',
    A2: 'Alltagssituationen bekommst du hin. Als Nächstes kommen Reisen, Gesundheit und die unregelmäßigen Verben.',
    B1: 'Du kommst im Alltag gut zurecht. Jetzt lohnen sich Arbeit, Gefühle und Phrasal Verbs.',
    B2: 'Starkes Niveau. Feinheiten wie False Friends bringen dich jetzt am weitesten.'
  };
  var PROMOTE_AT = 0.8;           // Anteil gelernter Karten fuer den Aufstieg

  var XP_BASE = 10;               // XP pro richtiger Karte, vor dem Serien-Bonus
  var XP_SECOND_TRY = 5;
  var XP_PERFECT = 50;
  var XP_GOAL = 100;
  var XP_STEP = 80;               // Level n verlangt XP_STEP * (n-1) * n / 2 XP

  var RANKS = [
    'Neuling', 'Anfänger', 'Wortsammler', 'Satzbauer', 'Vielredner',
    'Sprachfuchs', 'Wortakrobat', 'Feinschliffer', 'Sprachtalent', 'Sprachmeister'
  ];

  var BLITZ_SECONDS = 60;
  var BLITZ_PACE = 700;           // ms bis zur naechsten Karte

  var BADGES = [
    { id: 'placed', icon: '🎯', title: 'Eingestuft', text: 'Einstufungstest gemacht' },
    { id: 'first', icon: '🌱', title: 'Erste Schritte', text: 'Erste Runde beendet' },
    { id: 'streak3', icon: '🔥', title: 'Dranbleiber', text: '3 Tage in Folge geübt' },
    { id: 'streak7', icon: '🏆', title: 'Wochenheld', text: '7 Tage in Folge geübt' },
    { id: 'known100', icon: '💯', title: 'Hundert', text: '100 Karten sicher gelernt' },
    { id: 'blitz20', icon: '⚡', title: 'Blitzschnell', text: '20 Punkte in der Blitzrunde' },
    { id: 'combo10', icon: '🎢', title: 'Combo-Meister', text: '10 richtige Antworten am Stück' },
    { id: 'perfect', icon: '✨', title: 'Makellos', text: 'Eine Runde ohne einen Fehler' },
    { id: 'explorer', icon: '🧭', title: 'Entdecker', text: 'Karten aus 5 Themen berührt' },
    { id: 'promoted', icon: '📈', title: 'Aufgestiegen', text: 'Ein Niveau abgeschlossen' },
    { id: 'ears', icon: '🎧', title: 'Ohrwurm', text: '25 Antworten im Hören-Modus' },
    { id: 'owl', icon: '🦉', title: 'Nachteule', text: 'Nach 22 Uhr geübt' },
    { id: 'early', icon: '🐓', title: 'Früh dran', text: 'Vor 7 Uhr geübt' },
    { id: 'marathon', icon: '📚', title: 'Bücherwurm', text: '500 Antworten insgesamt' }
  ];

  var RING_LEN = 2 * Math.PI * 52;
  var SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4 4 0 0 0-2.3-3.6v7.2A4 4 0 0 0 15.5 12z' +
    'm-2.3-7.9v2.1a6 6 0 0 1 0 11.6v2.1a8 8 0 0 0 0-15.8z"/></svg>';

  var CONFETTI_COLORS = ['#34d399', '#22d3ee', '#facc15', '#f87171', '#c084fc', '#ffffff'];

  var CONTRACTIONS = [
    [/\bi'm\b/g, 'i am'], [/\bcan't\b/g, 'can not'], [/\bwon't\b/g, 'will not'],
    [/\bdon't\b/g, 'do not'], [/\bdoesn't\b/g, 'does not'], [/\bdidn't\b/g, 'did not'],
    [/\bisn't\b/g, 'is not'], [/\baren't\b/g, 'are not'], [/\bwasn't\b/g, 'was not'],
    [/\bhaven't\b/g, 'have not'], [/\bhasn't\b/g, 'has not'], [/\bwouldn't\b/g, 'would not'],
    [/\bcouldn't\b/g, 'could not'], [/\bshouldn't\b/g, 'should not'],
    [/\b(\w+)'re\b/g, '$1 are'], [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'ll\b/g, '$1 will'],
    [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'], [/\bwhat's\b/g, 'what is'],
    [/\bhe's\b/g, 'he is'], [/\bshe's\b/g, 'she is'], [/\bthere's\b/g, 'there is']
  ];

  var ARTICLES = /^(the|a|an|to|der|die|das|den|dem|ein|eine|einen|einem|sich|etwas|jemanden|jemandem)\s+/;

  // ------------------------------------------------------------------- Helfer

  function $(id) { return document.getElementById(id); }

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function dayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function formatTime(ms) {
    var total = Math.round(ms / 1000);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ------------------------------------------------------------ Lerninhalte

  var DECKS = (window.VOCAB_DATA && window.VOCAB_DATA.decks) || [];
  var CARDS = [];

  DECKS.forEach(function (deck) {
    deck.cards = deck.words.map(function (row) {
      var card = {
        key: deck.id + '|' + row[0],
        deck: deck,
        level: deck.level,
        en: row[0],
        de: row[1],
        example: row[2] || ''
      };
      CARDS.push(card);
      return card;
    });
  });

  // ------------------------------------------------------- Antwortvergleich

  function normalize(text) {
    var s = String(text).toLowerCase().trim();
    CONTRACTIONS.forEach(function (rule) { s = s.replace(rule[0], rule[1]); });
    s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe')
         .replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    while (ARTICLES.test(s)) s = s.replace(ARTICLES, '');
    return s.replace(/\s+/g, ' ').trim();
  }

  // Alle Schreibweisen, die als richtig durchgehen: einzelne Alternativen,
  // die vollstaendige Angabe und jeweils die Variante ohne Klammerzusatz.
  function variants(answer) {
    var raw = [answer, answer.replace(/\([^)]*\)/g, ' ')];
    answer.split('/').forEach(function (part) {
      raw.push(part, part.replace(/\([^)]*\)/g, ' '));
    });
    var seen = {};
    var out = [];
    raw.forEach(function (item) {
      var n = normalize(item);
      if (n && !seen[n]) { seen[n] = true; out.push(n); }
    });
    return out;
  }

  function distance(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var current = [i];
      for (var k = 1; k <= b.length; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        current[k] = Math.min(prev[k] + 1, current[k - 1] + 1, prev[k - 1] + cost);
      }
      prev = current;
    }
    return prev[b.length];
  }

  // 'right' | 'close' (Tippfehler) | 'wrong' | 'empty'
  function grade(input, answer) {
    var given = normalize(input);
    if (!given) return 'empty';
    var options = variants(answer);
    if (options.indexOf(given) >= 0) return 'right';
    for (var i = 0; i < options.length; i++) {
      var tolerance = options[i].length > 8 ? 2 : 1;
      if (distance(given, options[i]) <= tolerance) return 'close';
    }
    return 'wrong';
  }

  // --------------------------------------------------------------- Zustand

  function defaults() {
    return {
      version: 2,
      settings: {
        mode: 'mixed', direction: 'de-en', length: 20,
        goal: 30, newPerDay: 10, sound: true, autoSpeak: true, fx: true
      },
      decks: ['basics'],
      player: {
        xp: 0, level: 1, cefr: null, promotions: 0,
        badges: {}, blitzBest: 0, comboBest: 0,
        rounds: 0, perfect: 0, listen: 0
      },
      progress: {},
      days: {}
    };
  }

  var state = defaults();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      ['settings', 'player'].forEach(function (group) {
        if (!saved[group]) return;
        Object.keys(state[group]).forEach(function (key) {
          if (saved[group][key] !== undefined) state[group][key] = saved[group][key];
        });
      });
      if (Array.isArray(saved.decks)) state.decks = saved.decks;
      if (saved.progress) state.progress = saved.progress;
      if (saved.days) state.days = saved.days;
      state.player.level = levelFromXp(state.player.xp);
    } catch (err) {
      /* defekter oder gesperrter Speicher: wir starten einfach bei null */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) { /* privater Modus o. ae.: Fortschritt bleibt fluechtig */ }
  }

  function progressOf(card) { return state.progress[card.key] || null; }

  function today() {
    var key = dayKey();
    if (!state.days[key]) state.days[key] = { answered: 0, correct: 0, fresh: 0 };
    return state.days[key];
  }

  function isDue(card, now) {
    var p = progressOf(card);
    return !!p && p.due <= now;
  }

  function cardState(card) {
    var p = progressOf(card);
    if (!p) return 'new';
    if (p.wrong > p.right && p.wrong >= 2) return 'hard';
    if (p.box >= KNOWN_BOX) return 'known';
    return 'learning';
  }

  function selectedDecks() {
    var chosen = DECKS.filter(function (d) { return state.decks.indexOf(d.id) >= 0; });
    return chosen.length ? chosen : DECKS;
  }

  function poolCards() {
    var out = [];
    selectedDecks().forEach(function (deck) { out = out.concat(deck.cards); });
    return out;
  }

  function streak() {
    var count = 0;
    var cursor = startOfDay(Date.now());
    var todayEntry = state.days[dayKey(new Date(cursor))];
    if (!todayEntry || !todayEntry.answered) cursor -= DAY;
    while (true) {
      var entry = state.days[dayKey(new Date(cursor))];
      if (!entry || !entry.answered) break;
      count++;
      cursor -= DAY;
    }
    return count;
  }

  function totals() {
    var sum = { answered: 0, correct: 0 };
    Object.keys(state.days).forEach(function (key) {
      sum.answered += state.days[key].answered || 0;
      sum.correct += state.days[key].correct || 0;
    });
    return sum;
  }

  function knownCount(cards) {
    return (cards || CARDS).filter(function (c) { return cardState(c) === 'known'; }).length;
  }

  // ----------------------------------------------------------- XP und Level

  function xpForLevel(n) { return XP_STEP * (n - 1) * n / 2; }

  function levelFromXp(xp) {
    var n = 1;
    while (xp >= xpForLevel(n + 1)) n++;
    return n;
  }

  function rankName(level) { return RANKS[Math.min(level, RANKS.length) - 1]; }

  function awardXp(amount) {
    if (amount <= 0) return;
    state.player.xp += amount;
    var next = levelFromXp(state.player.xp);
    if (next > state.player.level) {
      state.player.level = next;
      celebrate('⭐', 'Level ' + next, rankName(next));
      confetti(90);
      jingle();
    }
    renderHud();
  }

  function comboMultiplier(combo) {
    return 1 + Math.min(combo, 10) * 0.1;   // bis x2 bei zehn richtigen am Stueck
  }

  // ----------------------------------------------------------- Englischniveau

  function levelProgress(level) {
    var cards = CARDS.filter(function (c) { return c.level === level; });
    return { total: cards.length, known: knownCount(cards) };
  }

  function checkPromotion() {
    var current = state.player.cefr;
    if (!current) return null;
    var index = LEVELS.indexOf(current);
    if (index < 0 || index >= LEVELS.length - 1) return null;
    var stats = levelProgress(current);
    if (!stats.total || stats.known / stats.total < PROMOTE_AT) return null;
    state.player.cefr = LEVELS[index + 1];
    state.player.promotions++;
    save();
    return state.player.cefr;
  }

  function decksOfLevel(level) {
    return DECKS.filter(function (d) { return d.level === level; });
  }

  // Fuer die Empfehlung nach dem Test: eine duenn besetzte Stufe (B2 hat nur
  // ein Thema) wird um die Stufe darunter ergaenzt, damit genug zu ueben ist.
  function recommendedDecks(level) {
    var decks = decksOfLevel(level);
    var count = decks.reduce(function (sum, d) { return sum + d.cards.length; }, 0);
    var below = LEVELS[LEVELS.indexOf(level) - 1];
    if (count < 60 && below) decks = decksOfLevel(below).concat(decks);
    return decks;
  }

  // ------------------------------------------------------------------- Ton

  var audioCtx = null;

  function tone(frequency, start, length, type, volume) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.09, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  function withAudio(fn) {
    if (!state.settings.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      fn();
    } catch (err) { /* Ton ist nur Beiwerk */ }
  }

  // Richtige Antworten klingen mit jeder Serie eine Stufe hoeher.
  function beep(ok, combo) {
    withAudio(function () {
      var t = audioCtx.currentTime;
      if (!ok) { tone(200, t, 0.2, 'triangle'); return; }
      var step = Math.min(combo || 0, 8);
      tone(520 * Math.pow(2, step / 12), t, 0.13);
      tone(780 * Math.pow(2, step / 12), t + 0.06, 0.12, 'sine', 0.06);
    });
  }

  function jingle() {
    withAudio(function () {
      var t = audioCtx.currentTime;
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.09, 0.16); });
    });
  }

  // ---------------------------------------------------------------- Sprache

  var speechOn = 'speechSynthesis' in window;
  var voice = null;

  function chooseVoice() {
    if (!speechOn) return;
    var all = window.speechSynthesis.getVoices() || [];
    var english = all.filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    if (!english.length) return;
    voice = english.filter(function (v) { return /GB|UK/i.test(v.lang); })[0] || english[0];
  }

  if (speechOn) {
    chooseVoice();
    window.speechSynthesis.onvoiceschanged = chooseVoice;
  }

  function speak(text, button) {
    if (!speechOn || !text) return;
    var clean = text.replace(/\([^)]*\)/g, ' ').replace(/\s*\/\s*/g, ', ').replace(/\s+-\s+/g, ', ');
    try {
      var utter = new SpeechSynthesisUtterance(clean);
      utter.lang = voice ? voice.lang : 'en-GB';
      if (voice) utter.voice = voice;
      utter.rate = 0.92;
      if (button) {
        button.classList.add('is-playing');
        utter.onend = utter.onerror = function () { button.classList.remove('is-playing'); };
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (err) { /* Sprachausgabe ist optional */ }
  }

  function speakButton(text) {
    var btn = make('button', 'speak');
    btn.type = 'button';
    btn.title = 'Vorlesen';
    btn.setAttribute('aria-label', 'Vorlesen: ' + text);
    btn.innerHTML = SPEAKER;
    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      speak(text, btn);
    });
    return btn;
  }

  // ------------------------------------------------------------------ Effekte

  var toastTimer = null;
  var celebrateTimer = null;

  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2400);
  }

  function celebrate(icon, title, text) {
    var box = $('celebrate');
    $('celebrate-icon').textContent = icon;
    $('celebrate-title').textContent = title;
    $('celebrate-text').textContent = text || '';
    box.hidden = false;
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(function () {
      box.classList.remove('show');
      setTimeout(function () { box.hidden = true; }, 320);
    }, 2200);
  }

  function confetti(count) {
    if (!state.settings.fx || reducedMotion()) return;
    var box = $('confetti');
    for (var i = 0; i < count; i++) {
      var piece = document.createElement('i');
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = pick(CONFETTI_COLORS);
      piece.style.animationDelay = (Math.random() * 0.35) + 's';
      piece.style.animationDuration = (1.5 + Math.random() * 1.3) + 's';
      piece.style.width = piece.style.height = (5 + Math.random() * 6) + 'px';
      if (Math.random() < 0.4) piece.style.borderRadius = '50%';
      box.appendChild(piece);
      window.setTimeout(function (node) {
        return function () { if (node.parentNode) node.parentNode.removeChild(node); };
      }(piece), 3400);
    }
  }

  function xpFloat(text, bad) {
    if (reducedMotion()) return;
    var node = $('xpfloat');
    node.textContent = text;
    node.className = 'xpfloat' + (bad ? ' is-bad' : '');
    node.hidden = false;
    void node.offsetWidth;
    node.classList.add('show');
  }

  // ------------------------------------------------------------------ Views

  var currentView = 'home';

  function showView(name) {
    currentView = name;
    ['home', 'test', 'session', 'summary', 'list', 'stats'].forEach(function (id) {
      $('view-' + id).classList.toggle('is-active', id === name);
    });
    var tabFor = (name === 'summary' || name === 'session' || name === 'test') ? 'home' : name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.classList.toggle('is-active', tab.dataset.view === tabFor);
    });
    window.scrollTo(0, 0);
  }

  function setRing(id, ratio) {
    $(id).style.strokeDashoffset = String(RING_LEN * (1 - clamp(ratio, 0, 1)));
  }

  function setOptions(containerId, value) {
    Array.prototype.forEach.call($(containerId).children, function (btn) {
      btn.classList.toggle('is-active', btn.dataset.value === String(value));
    });
  }

  // --------------------------------------------------------------------- HUD

  function renderHud() {
    var player = state.player;
    var level = player.level;
    var base = xpForLevel(level);
    var next = xpForLevel(level + 1);
    var ratio = (player.xp - base) / (next - base);

    $('hud-cefr').textContent = player.cefr || '?';
    $('hud-level').textContent = level;
    $('hud-rank').textContent = rankName(level);
    $('hud-xp').style.width = clamp(ratio, 0, 1) * 100 + '%';
    $('hud-xptext').textContent = (player.xp - base) + ' / ' + (next - base) + ' XP';
    $('hud-streak').textContent = streak();
  }

  // ------------------------------------------------------------- Startseite

  var deckFilter = 'all';

  function renderHome() {
    var now = Date.now();
    var day = today();
    var goal = state.settings.goal;

    $('goal-done').textContent = day.answered;
    $('goal-total').textContent = goal;
    setRing('goal-arc', goal ? day.answered / goal : 0);

    var pool = poolCards();
    var due = pool.filter(function (c) { return isDue(c, now); }).length;
    var sum = totals();

    $('fact-due').textContent = due;
    $('fact-known').textContent = knownCount();
    $('fact-acc').textContent = sum.answered
      ? Math.round(sum.correct / sum.answered * 100) + '%'
      : '–';
    $('fact-badges').textContent = Object.keys(state.player.badges).length;
    $('fact-badges-max').textContent = BADGES.length;
    $('blitz-best').textContent = state.player.blitzBest;

    setOptions('opt-mode', state.settings.mode);
    setOptions('opt-dir', state.settings.direction);
    setOptions('opt-len', state.settings.length);
    setOptions('deck-level', deckFilter);

    renderLevelCard();
    renderDecks(now);
    renderHud();

    var fresh = pool.filter(function (c) { return !progressOf(c); }).length;
    var budget = Math.max(0, state.settings.newPerDay - day.fresh);
    var planned = Math.min(fresh, budget);
    var hint;
    if (!state.decks.length) {
      hint = 'Kein Thema gewählt';
    } else if (due + planned === 0) {
      hint = fresh
        ? 'Heutiges Limit für neue Karten erreicht – Weiterüben geht trotzdem.'
        : 'Alles wiederholt. Weiterüben geht jederzeit.';
    } else {
      hint = plural(due, 'fällige Karte', 'fällige Karten') + ' · ' +
        plural(planned, 'neue Karte', 'neue Karten');
    }
    $('start-hint').textContent = hint;
  }

  function renderLevelCard() {
    var box = $('level-card');
    box.innerHTML = '';
    var cefr = state.player.cefr;

    if (!cefr) {
      box.className = 'level-card level-card--invite';
      var text = make('div');
      text.appendChild(make('h2', null, 'Wo stehst du gerade?'));
      text.appendChild(make('p', 'muted',
        'Zwölf kurze Fragen, keine zwei Minuten – danach kenne ich dein Englischniveau ' +
        'und schlage dir die passenden Themen vor.'));
      box.appendChild(text);
      var go = make('button', 'primary', 'Einstufungstest starten');
      go.type = 'button';
      go.addEventListener('click', startTest);
      box.appendChild(go);
      return;
    }

    box.className = 'level-card';
    var stats = levelProgress(cefr);
    var ratio = stats.total ? stats.known / stats.total : 0;
    var index = LEVELS.indexOf(cefr);
    var next = LEVELS[index + 1];

    var badge = make('div', 'badge-big', cefr);
    box.appendChild(badge);

    var body = make('div', 'level-card__body');
    body.appendChild(make('h2', null, 'Dein Englischniveau: ' + cefr));
    body.appendChild(make('p', 'muted', next
      ? stats.known + ' von ' + stats.total + ' ' + cefr + '-Karten sitzen. Ab ' +
        Math.round(PROMOTE_AT * 100) + ' % geht es hoch auf ' + next + '.'
      : stats.known + ' von ' + stats.total + ' ' + cefr + '-Karten sitzen. Höher geht es hier nicht mehr.'));

    var bar = make('div', 'level-card__bar');
    var fill = make('i');
    fill.style.width = Math.round(ratio * 100) + '%';
    bar.appendChild(fill);
    if (next) {
      var mark = make('u');
      mark.style.left = (PROMOTE_AT * 100) + '%';
      bar.appendChild(mark);
    }
    body.appendChild(bar);
    box.appendChild(body);

    var again = make('button', 'ghost', 'Neu einstufen');
    again.type = 'button';
    again.addEventListener('click', startTest);
    box.appendChild(again);
  }

  function renderDecks(now) {
    var box = $('decks');
    box.innerHTML = '';

    var visible = DECKS.filter(function (deck) {
      if (deckFilter === 'all') return true;
      if (deckFilter === 'mine') return recommendedDecks(state.player.cefr || 'A1').indexOf(deck) >= 0;
      return deck.level === deckFilter;
    });

    if (!visible.length) {
      box.appendChild(make('p', 'empty', 'Für diese Stufe gibt es hier noch keine Themen.'));
      return;
    }

    visible.forEach(function (deck) {
      var known = 0;
      var due = 0;
      deck.cards.forEach(function (card) {
        if (cardState(card) === 'known') known++;
        if (isDue(card, now)) due++;
      });

      var active = state.decks.indexOf(deck.id) >= 0;
      var btn = make('button', 'deck');
      btn.type = 'button';
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));

      var row = make('span', 'deck__row');
      row.appendChild(make('span', 'deck__title', deck.title));
      if (state.player.cefr === deck.level) {
        row.appendChild(make('span', 'deck__level deck__level--mine', deck.level));
      } else {
        row.appendChild(make('span', 'deck__level', deck.level));
      }
      btn.appendChild(row);

      var meta = deck.cards.length + ' Karten · ' + known + ' gelernt';
      if (due) meta += ' · ' + due + ' fällig';
      btn.appendChild(make('span', 'deck__meta', meta));

      var bar = make('span', 'deck__bar');
      var fill = make('i');
      fill.style.width = Math.round((known / deck.cards.length) * 100) + '%';
      bar.appendChild(fill);
      btn.appendChild(bar);

      btn.addEventListener('click', function () {
        var index = state.decks.indexOf(deck.id);
        if (index >= 0) state.decks.splice(index, 1);
        else state.decks.push(deck.id);
        save();
        renderHome();
      });

      box.appendChild(btn);
    });
  }

  // -------------------------------------------------------- Einstufungstest

  var test = null;

  function startTest() {
    var questions = [];
    LEVELS.forEach(function (level) {
      var pool = shuffle(CARDS.filter(function (c) { return c.level === level; }));
      pool.slice(0, 3).forEach(function (card) { questions.push({ card: card, level: level }); });
    });
    test = { questions: questions, index: 0, blockRight: 0, marks: [], busy: false };
    $('test-run').hidden = false;
    $('test-result').hidden = true;
    showView('test');
    renderTestQuestion();
  }

  function renderTestQuestion() {
    var item = test.questions[test.index];
    $('test-level').textContent = item.level;
    $('test-prompt').textContent = item.card.en;

    var dots = $('test-dots');
    dots.innerHTML = '';
    test.questions.forEach(function (q, i) {
      var dot = make('span', 'dot' + (test.marks[i] ? ' dot--' + test.marks[i] : ''));
      dots.appendChild(dot);
    });

    var box = $('test-choices');
    box.innerHTML = '';
    var right = item.card.de;
    var seen = {};
    seen[normalize(right)] = true;
    var options = [right];
    var pool = CARDS.filter(function (c) { return c.level === item.level; });
    var guard = 0;
    while (options.length < 4 && guard++ < 300) {
      var other = pick(pool);
      var norm = normalize(other.de);
      if (seen[norm]) continue;
      seen[norm] = true;
      options.push(other.de);
    }

    shuffle(options).forEach(function (text, i) {
      var btn = make('button');
      btn.type = 'button';
      btn.appendChild(make('b', null, String(i + 1)));
      btn.appendChild(make('span', null, text));
      btn.addEventListener('click', function () {
        if (test.busy) return;
        test.busy = true;
        var ok = normalize(text) === normalize(right);
        Array.prototype.forEach.call(box.children, function (node) { node.disabled = true; });
        btn.classList.add(ok ? 'is-right' : 'is-wrong');
        beep(ok, 0);
        test.marks[test.index] = ok ? 'right' : 'wrong';
        setTimeout(function () { test.busy = false; testAdvance(ok); }, 520);
      });
      box.appendChild(btn);
    });
  }

  function testAdvance(ok) {
    if (ok) test.blockRight++;
    test.index++;

    if (test.index % 3 === 0) {
      var block = test.index / 3 - 1;          // 0 = A1, 1 = A2, ...
      if (test.blockRight < 2) {
        finishTest(LEVELS[Math.max(0, block - 1)]);
        return;
      }
      test.blockRight = 0;
      if (test.index >= test.questions.length) {
        finishTest(LEVELS[LEVELS.length - 1]);
        return;
      }
    }
    renderTestQuestion();
  }

  function finishTest(level) {
    state.player.cefr = level;
    save();

    $('test-run').hidden = true;
    $('test-result').hidden = false;
    $('test-badge').textContent = level;
    $('test-title').textContent = 'Dein Englischniveau: ' + level;
    $('test-text').textContent = LEVEL_TEXT[level];

    var box = $('test-decks');
    box.innerHTML = '';
    recommendedDecks(level).forEach(function (deck) {
      var chip = make('span', 'chip', deck.title + ' · ' + deck.cards.length);
      box.appendChild(chip);
    });

    confetti(70);
    jingle();
    showBadges(checkBadges({}));
    renderHud();
  }

  // ------------------------------------------------------------ Runde bauen

  function resolveDirection() {
    if (state.settings.mode === 'listen') return 'listen';
    if (state.settings.direction === 'both') return Math.random() < 0.5 ? 'de-en' : 'en-de';
    return state.settings.direction;
  }

  function resolveMode() {
    if (state.settings.mode !== 'mixed') return state.settings.mode;
    var roll = Math.random();
    if (roll < 0.4) return 'choice';
    if (roll < 0.8) return 'type';
    return 'flip';
  }

  function buildQueue() {
    var now = Date.now();
    var pool = poolCards();
    var length = state.settings.length;

    var due = shuffle(pool.filter(function (c) { return isDue(c, now); }));
    var fresh = shuffle(pool.filter(function (c) { return !progressOf(c); }));
    var later = pool.filter(function (c) {
      var p = progressOf(c);
      return p && p.due > now;
    }).sort(function (a, b) { return progressOf(a).due - progressOf(b).due; });

    var budget = Math.max(0, state.settings.newPerDay - today().fresh);
    var chosen = due.concat(fresh.slice(0, budget));

    if (length > 0) {
      chosen = chosen.slice(0, length);
      // Zu wenig faellige Karten? Dann wird eben vorgezogen wiederholt.
      if (chosen.length < length) {
        chosen = chosen.concat(later.slice(0, length - chosen.length));
      }
      if (chosen.length < length) {
        var used = {};
        chosen.forEach(function (c) { used[c.key] = true; });
        var rest = shuffle(pool.filter(function (c) { return !used[c.key]; }));
        chosen = chosen.concat(rest.slice(0, length - chosen.length));
      }
    }

    return shuffle(chosen).map(function (card) {
      return { card: card, mode: resolveMode(), direction: resolveDirection(), retried: false };
    });
  }

  // ----------------------------------------------------------------- Runde

  var session = null;
  var blitzTimer = null;
  var paceTimer = null;

  function newSession(queue, blitz) {
    return {
      queue: queue, index: 0, right: 0, wrong: 0, missed: [], badges: [],
      combo: 0, bestCombo: 0, xp: 0, started: Date.now(),
      answered: false, secondTry: false, blitz: !!blitz,
      endsAt: blitz ? Date.now() + BLITZ_SECONDS * 1000 : 0
    };
  }

  function startSession(queue) {
    if (!queue.length) {
      toast(state.decks.length
        ? 'Nichts fällig. Wähle eine feste Rundenlänge, um trotzdem zu üben.'
        : 'Bitte mindestens ein Thema wählen.');
      return;
    }
    stopTimers();
    session = newSession(queue, false);
    $('sess-of').hidden = false;
    showView('session');
    renderQuestion();
  }

  function startBlitz() {
    var pool = poolCards();
    if (pool.length < 8) { toast('Bitte mehr Themen auswählen.'); return; }
    var direction = state.settings.direction === 'both' || state.settings.mode === 'listen'
      ? 'both' : state.settings.direction;
    var queue = shuffle(pool).slice(0, 240).map(function (card) {
      return {
        card: card, mode: 'choice', retried: true,
        direction: direction === 'both' ? (Math.random() < 0.5 ? 'de-en' : 'en-de') : direction
      };
    });

    stopTimers();
    session = newSession(queue, true);
    $('sess-of').hidden = true;
    showView('session');
    renderQuestion();
    blitzTimer = setInterval(tickBlitz, 100);
  }

  function tickBlitz() {
    if (!session || !session.blitz) { stopTimers(); return; }
    var left = Math.max(0, session.endsAt - Date.now());
    $('sess-bar').style.width = (left / (BLITZ_SECONDS * 1000) * 100) + '%';
    $('sess-pos').textContent = session.right;
    $('sess-score').textContent = Math.ceil(left / 1000) + ' Sekunden übrig';
    if (left <= 0) finishSession();
  }

  function stopTimers() {
    clearInterval(blitzTimer);
    clearTimeout(paceTimer);
    blitzTimer = null;
    paceTimer = null;
  }

  function currentItem() { return session.queue[session.index]; }

  function answerText(item) {
    if (item.direction === 'listen') return item.card.en;
    return item.direction === 'de-en' ? item.card.en : item.card.de;
  }

  function questionText(item) {
    if (item.direction === 'listen') return null;
    return item.direction === 'de-en' ? item.card.de : item.card.en;
  }

  function renderQuestion() {
    var item = currentItem();
    var card = item.card;
    session.answered = false;
    session.secondTry = false;

    if (session.blitz) {
      $('sess-pos').textContent = session.right;
    } else {
      $('sess-pos').textContent = session.index + 1;
      $('sess-total').textContent = session.queue.length;
      $('sess-bar').style.width = (session.index / session.queue.length * 100) + '%';
      $('sess-score').textContent = session.right + ' richtig · ' + session.wrong + ' falsch';
    }

    renderCombo();
    $('qcard').className = 'qcard';
    $('xpfloat').hidden = true;
    $('q-deck').textContent = card.deck.title + ' · ' + card.level;
    $('q-dir').textContent = item.direction === 'listen'
      ? 'Hören'
      : (item.direction === 'de-en' ? 'Deutsch → Englisch' : 'Englisch → Deutsch');

    var question = questionText(item);
    $('q-prompt').textContent = question || 'Hör zu und schreibe mit';

    var speakBtn = $('q-speak');
    speakBtn.innerHTML = SPEAKER;
    var spoken = item.direction === 'listen' ? card.en : (item.direction === 'en-de' ? card.en : null);
    speakBtn.hidden = !speechOn || !spoken;
    speakBtn.onclick = spoken ? function () { speak(spoken, speakBtn); } : null;

    $('q-hint').textContent = hintFor(item);

    $('feedback').hidden = true;
    $('next-btn').hidden = true;
    $('a-choice').hidden = true;
    $('a-type').hidden = true;
    $('a-flip').hidden = true;
    $('flip-actions').hidden = true;
    $('flip-reveal').hidden = false;

    if (item.mode === 'choice') renderChoices(item);
    else if (item.mode === 'flip') $('a-flip').hidden = false;
    else renderTyping(item);

    if (item.direction === 'listen') setTimeout(function () { speak(card.en, speakBtn); }, 250);
  }

  function renderCombo() {
    var box = $('combo');
    if (session.combo < 2) { box.hidden = true; return; }
    box.hidden = false;
    $('combo-count').textContent = session.combo;
    $('combo-mult').textContent = '×' + comboMultiplier(session.combo).toFixed(1);
  }

  function hintFor(item) {
    if (item.card.deck.type === 'forms' && item.direction !== 'en-de') {
      return 'Drei Formen: Grundform, Simple Past, Past Participle';
    }
    if (item.mode === 'choice') return 'Tasten 1 bis 4 gehen auch';
    if (item.mode === 'flip') return 'Erst überlegen, dann aufdecken';
    if (item.direction === 'listen') return 'Schreibe, was du hörst';
    return item.direction === 'de-en' ? 'Auf Englisch, bitte' : 'Auf Deutsch, bitte';
  }

  function renderChoices(item) {
    var box = $('a-choice');
    box.hidden = false;
    box.innerHTML = '';

    var right = answerText(item);
    var siblings = item.card.deck.cards.length >= 6 ? item.card.deck.cards : CARDS;
    var seen = {};
    seen[normalize(right)] = true;

    var options = [right];
    var guard = 0;
    while (options.length < 4 && guard++ < 400) {
      var other = pick(siblings);
      if (other.key === item.card.key) continue;
      var text = item.direction === 'de-en' ? other.en : other.de;
      var norm = normalize(text);
      if (seen[norm]) continue;
      seen[norm] = true;
      options.push(text);
    }

    shuffle(options).forEach(function (text, i) {
      var btn = make('button');
      btn.type = 'button';
      btn.appendChild(make('b', null, String(i + 1)));
      btn.appendChild(make('span', null, text));
      btn.dataset.answer = text;
      btn.addEventListener('click', function () {
        if (session.answered) return;
        var correct = normalize(text) === normalize(right);
        Array.prototype.forEach.call(box.children, function (other) {
          other.disabled = true;
          if (normalize(other.dataset.answer) === normalize(right)) other.classList.add('is-right');
          else if (other === btn) other.classList.add('is-wrong');
        });
        finishAnswer(correct, correct ? 'Richtig!' : 'Leider nicht.');
      });
      box.appendChild(btn);
    });
  }

  function renderTyping(item) {
    var form = $('a-type');
    form.hidden = false;
    var input = $('type-input');
    input.value = '';
    input.disabled = false;
    input.placeholder = item.direction === 'en-de' ? 'Deutsche Übersetzung' : 'English word';
    setTimeout(function () { input.focus(); }, 30);
  }

  function submitTyping(event) {
    if (event) event.preventDefault();
    if (!session || session.answered) return;
    var item = currentItem();
    if (item.mode !== 'type' && item.direction !== 'listen') return;

    var input = $('type-input');
    var result = grade(input.value, answerText(item));
    if (result === 'empty') { input.focus(); return; }

    if (result === 'close' && !session.secondTry) {
      session.secondTry = true;
      showFeedback('warn', 'Fast – achte auf die Schreibweise.', null, false);
      input.select();
      return;
    }

    input.disabled = true;
    var ok = result === 'right' || result === 'close';
    finishAnswer(ok, ok
      ? (session.secondTry ? 'Richtig, beim zweiten Versuch.' : 'Richtig!')
      : 'Leider nicht.');
  }

  function revealFlip() {
    if (!session || session.answered) return;
    var item = currentItem();
    $('flip-reveal').hidden = true;
    $('flip-actions').hidden = false;
    showFeedback(null, 'Lösung', answerText(item), true);
    if (state.settings.autoSpeak) speak(item.card.en);
  }

  function showFeedback(tone, head, solution, withExample) {
    var box = $('feedback');
    box.hidden = false;
    var headNode = $('fb-head');
    headNode.textContent = head;
    headNode.className = 'feedback__head' + (tone ? ' is-' + tone : '');

    var solNode = $('fb-sol');
    solNode.innerHTML = '';
    if (solution) {
      solNode.appendChild(document.createTextNode(solution));
      var item = currentItem();
      if (speechOn && item.direction !== 'en-de') solNode.appendChild(speakButton(item.card.en));
    }

    var exNode = $('fb-ex');
    exNode.textContent = withExample && currentItem().card.example ? currentItem().card.example : '';
  }

  function finishAnswer(ok, headline) {
    var item = currentItem();
    session.answered = true;

    if (ok) {
      session.combo++;
      session.bestCombo = Math.max(session.bestCombo, session.combo);
      if (session.combo > state.player.comboBest) state.player.comboBest = session.combo;
      session.right++;
      var gained = Math.round((session.secondTry ? XP_SECOND_TRY : XP_BASE) * comboMultiplier(session.combo));
      session.xp += gained;
      awardXp(gained);
      xpFloat('+' + gained + ' XP');
      if (session.combo === 5 || session.combo === 10 || session.combo === 20) {
        celebrate('🔥', session.combo + 'er-Serie!', 'Multiplikator ×' + comboMultiplier(session.combo).toFixed(1));
      }
    } else {
      session.combo = 0;
      session.wrong++;
      xpFloat('Serie weg', true);
      if (!session.missed.some(function (c) { return c.key === item.card.key; })) {
        session.missed.push(item.card);
      }
      // Falsche Karten kommen am Ende der Runde noch einmal dran.
      if (!item.retried && session.queue.length < 80) {
        session.queue.push({
          card: item.card, mode: item.mode, direction: item.direction, retried: true
        });
        $('sess-total').textContent = session.queue.length;
      }
    }

    record(item.card, ok);
    if (item.direction === 'listen') state.player.listen++;
    beep(ok, session.combo);
    $('qcard').classList.add(ok ? 'is-good' : 'is-bad');
    renderCombo();
    showFeedback(ok ? 'good' : 'bad', headline, answerText(item), true);

    if (state.settings.autoSpeak && speechOn && item.direction !== 'en-de' && !session.blitz) {
      setTimeout(function () { speak(item.card.en); }, ok ? 120 : 260);
    }

    var fresh = checkBadges({ answered: true });
    if (fresh.length) session.badges = session.badges.concat(fresh);

    if (session.blitz) {
      paceTimer = setTimeout(nextQuestion, BLITZ_PACE);
    } else {
      $('next-btn').hidden = false;
      $('next-btn').textContent = session.index + 1 >= session.queue.length ? 'Auswertung' : 'Weiter';
      $('sess-score').textContent = session.right + ' richtig · ' + session.wrong + ' falsch';
    }
  }

  function record(card, ok) {
    var entry = state.progress[card.key];
    var day = today();
    if (!entry) {
      entry = { box: 1, due: 0, seen: 0, right: 0, wrong: 0 };
      state.progress[card.key] = entry;
      day.fresh++;
    }
    entry.seen++;
    if (ok) { entry.right++; entry.box = Math.min(MAX_BOX, entry.box + 1); }
    else { entry.wrong++; entry.box = 1; }
    entry.due = Date.now() + BOX_DAYS[entry.box] * DAY;
    entry.last = Date.now();

    day.answered++;
    if (ok) day.correct++;
    save();
  }

  function nextQuestion() {
    if (!session) return;
    clearTimeout(paceTimer);
    session.index++;
    if (session.index >= session.queue.length) finishSession();
    else renderQuestion();
  }

  // ------------------------------------------------------------ Abzeichen

  function checkBadges(context) {
    var ctx = context || {};
    var player = state.player;
    var sum = totals();
    var touched = DECKS.filter(function (deck) {
      return deck.cards.some(function (card) { return !!progressOf(card); });
    }).length;
    var hour = new Date().getHours();

    var passed = {
      placed: !!player.cefr,
      first: player.rounds >= 1,
      streak3: streak() >= 3,
      streak7: streak() >= 7,
      known100: knownCount() >= 100,
      blitz20: player.blitzBest >= 20,
      combo10: player.comboBest >= 10,
      perfect: player.perfect >= 1,
      explorer: touched >= 5,
      promoted: player.promotions >= 1,
      ears: player.listen >= 25,
      owl: !!ctx.answered && hour >= 22,
      early: !!ctx.answered && hour < 7,
      marathon: sum.answered >= 500
    };

    var unlocked = [];
    BADGES.forEach(function (badge) {
      if (!player.badges[badge.id] && passed[badge.id]) {
        player.badges[badge.id] = Date.now();
        unlocked.push(badge);
      }
    });
    if (unlocked.length) save();
    return unlocked;
  }

  function showBadges(list) {
    if (!list.length) return;
    var badge = list[0];
    celebrate(badge.icon, 'Abzeichen: ' + badge.title, badge.text);
    confetti(60);
  }

  // -------------------------------------------------------------- Abschluss

  function finishSession() {
    stopTimers();
    var total = session.right + session.wrong;
    var ratio = total ? session.right / total : 0;
    var blitz = session.blitz;

    var previousBest = state.player.blitzBest;
    state.player.rounds++;
    if (!blitz && !session.wrong && total >= 5) state.player.perfect++;
    if (blitz && session.right > state.player.blitzBest) state.player.blitzBest = session.right;

    // Bonus-XP erst am Rundenende, damit sie in der Auswertung auftauchen.
    var bonus = [];
    if (!blitz && !session.wrong && total >= 5) bonus.push(['Fehlerfreie Runde', XP_PERFECT]);
    var day = today();
    if (day.answered >= state.settings.goal && !day.goalPaid) {
      day.goalPaid = true;
      bonus.push(['Tagesziel geschafft', XP_GOAL]);
    }
    bonus.forEach(function (entry) { session.xp += entry[1]; awardXp(entry[1]); });

    var promoted = checkPromotion();
    session.badges = session.badges.concat(checkBadges({}));
    save();

    $('sum-pct').textContent = blitz ? String(session.right) : Math.round(ratio * 100) + '%';
    $('sum-pct-label').textContent = blitz ? 'Punkte' : 'richtig';
    setRing('sum-arc', blitz ? clamp(session.right / 30, 0, 1) : ratio);
    $('sum-arc').style.stroke = ratio >= 0.8 ? 'var(--good)' : ratio >= 0.5 ? 'var(--warn)' : 'var(--bad)';

    if (blitz) {
      var best = session.right > previousBest;
      $('sum-title').textContent = best ? 'Neuer Bestwert!' : 'Zeit ist um';
      $('sum-sub').textContent = 'Bestwert: ' + state.player.blitzBest +
        ' · längste Serie: ' + session.bestCombo;
      $('sum-third-label').textContent = 'Beste Serie';
      $('sum-time').textContent = session.bestCombo;
    } else {
      $('sum-title').textContent = ratio >= 0.9 ? 'Stark!' : ratio >= 0.6 ? 'Gut gemacht' : 'Weiter üben';
      $('sum-sub').textContent = session.missed.length
        ? plural(session.missed.length, 'Karte sitzt noch nicht', 'Karten sitzen noch nicht')
        : 'Alles richtig – nichts zum Nacharbeiten.';
      $('sum-third-label').textContent = 'Dauer';
      $('sum-time').textContent = formatTime(Date.now() - session.started);
    }

    $('sum-ok').textContent = session.right;
    $('sum-bad').textContent = session.wrong;

    var gain = $('xp-gain');
    gain.innerHTML = '';
    var head = make('div', 'xp-gain__head');
    head.appendChild(make('b', null, '+' + session.xp + ' XP'));
    head.appendChild(make('span', null, 'Level ' + state.player.level + ' · ' + rankName(state.player.level)));
    gain.appendChild(head);
    if (session.bestCombo >= 2) {
      gain.appendChild(make('span', 'xp-gain__row', 'Längste Serie: ' + session.bestCombo + ' am Stück'));
    }
    bonus.forEach(function (entry) {
      gain.appendChild(make('span', 'xp-gain__row', entry[0] + ': +' + entry[1] + ' XP'));
    });

    var badgeBox = $('sum-badges');
    badgeBox.innerHTML = '';
    session.badges.forEach(function (badge) {
      var node = make('div', 'badge badge--new');
      node.appendChild(make('span', 'badge__icon', badge.icon));
      node.appendChild(make('b', null, badge.title));
      node.appendChild(make('i', null, badge.text));
      badgeBox.appendChild(node);
    });

    var list = $('sum-list');
    list.innerHTML = '';
    session.missed.forEach(function (card) {
      var row = make('div', 'sum-list__row');
      row.appendChild(make('b', null, card.en));
      row.appendChild(make('span', null, card.de));
      if (speechOn) row.appendChild(speakButton(card.en));
      list.appendChild(row);
    });

    $('sum-again').hidden = !session.missed.length;
    showView('summary');

    if (promoted) {
      celebrate('📈', 'Niveau ' + promoted + '!', 'Dein Englisch ist eine Stufe weiter.');
      confetti(120);
      jingle();
    } else if (session.badges.length) {
      showBadges(session.badges);
    } else if (!blitz && ratio >= 0.9 && total >= 5) {
      confetti(70);
    } else if (blitz && session.right >= 15) {
      confetti(70);
    }

    renderHome();
    renderStats();
  }

  function quitSession() {
    stopTimers();
    if (!session) { showView('home'); return; }
    if (session.right + session.wrong > 0) finishSession();
    else { session = null; renderHome(); showView('home'); }
  }

  // ------------------------------------------------------------ Wortschatz

  var listFilter = 'all';

  function renderListControls() {
    var select = $('list-deck');
    if (select.children.length) return;
    var all = make('option', null, 'Alle Themen');
    all.value = 'all';
    select.appendChild(all);
    DECKS.forEach(function (deck) {
      var option = make('option', null, deck.title + ' (' + deck.level + ')');
      option.value = deck.id;
      select.appendChild(option);
    });
    setOptions('list-filter', listFilter);
  }

  function renderList() {
    renderListControls();
    var deckId = $('list-deck').value || 'all';
    var query = normalize($('list-search').value);
    var box = $('wordlist');
    box.innerHTML = '';

    var rows = CARDS.filter(function (card) {
      if (deckId !== 'all' && card.deck.id !== deckId) return false;
      if (listFilter !== 'all' && cardState(card) !== listFilter) return false;
      if (query && normalize(card.en + ' ' + card.de).indexOf(query) < 0) return false;
      return true;
    });

    $('list-count').textContent = rows.length ? plural(rows.length, 'Eintrag', 'Einträge') : '';

    if (!rows.length) {
      box.appendChild(make('p', 'empty', 'Nichts gefunden.'));
      return;
    }

    var fragment = document.createDocumentFragment();
    rows.forEach(function (card) {
      var status = cardState(card);
      var row = make('div', 'word');
      row.appendChild(make('span', 'word__state word__state--' + status));

      var middle = make('div');
      var line = make('div');
      line.appendChild(make('span', 'word__en', card.en));
      line.appendChild(make('span', 'word__de', '  –  ' + card.de));
      middle.appendChild(line);
      if (card.example) middle.appendChild(make('div', 'word__ex', card.example));
      row.appendChild(middle);

      row.appendChild(speechOn ? speakButton(card.en) : make('span'));
      fragment.appendChild(row);
    });
    box.appendChild(fragment);
  }

  // ----------------------------------------------------------- Fortschritt

  function renderStats() {
    var sum = totals();
    var counts = { new: 0, learning: 0, known: 0, hard: 0 };
    CARDS.forEach(function (card) { counts[cardState(card)]++; });

    var tiles = [
      ['Karten gesamt', CARDS.length, DECKS.length + ' Themen'],
      ['Gelernt', counts.known, 'Fach 4 oder 5'],
      ['In Arbeit', counts.learning + counts.hard, counts.hard + ' davon schwierig'],
      ['Noch neu', counts.new, 'nie abgefragt'],
      ['XP gesamt', state.player.xp, 'Level ' + state.player.level + ' · ' + rankName(state.player.level)],
      ['Trefferquote', sum.answered ? Math.round(sum.correct / sum.answered * 100) + '%' : '–', sum.answered + ' Antworten'],
      ['Serie', plural(streak(), 'Tag', 'Tage'), 'in Folge geübt'],
      ['Blitz-Bestwert', state.player.blitzBest, 'längste Serie: ' + state.player.comboBest]
    ];

    var box = $('stat-tiles');
    box.innerHTML = '';
    tiles.forEach(function (tile) {
      var node = make('div', 'fact');
      node.appendChild(make('span', null, tile[0]));
      node.appendChild(make('b', null, String(tile[1])));
      node.appendChild(make('i', null, tile[2]));
      box.appendChild(node);
    });

    renderLevels();
    renderBadges();
    renderChart();
    renderDeckStats();

    $('set-goal').value = state.settings.goal;
    $('set-new').value = state.settings.newPerDay;
    $('set-sound').checked = !!state.settings.sound;
    $('set-speak').checked = !!state.settings.autoSpeak;
    $('set-fx').checked = !!state.settings.fx;
  }

  function renderLevels() {
    var box = $('levels');
    box.innerHTML = '';
    LEVELS.forEach(function (level) {
      var stats = levelProgress(level);
      var ratio = stats.total ? stats.known / stats.total : 0;
      var row = make('div', 'level-row' + (state.player.cefr === level ? ' is-current' : ''));

      var tag = make('span', 'level-row__tag', level);
      row.appendChild(tag);

      var body = make('div', 'level-row__body');
      var head = make('div', 'dstat__row');
      head.appendChild(make('b', null, decksOfLevel(level).map(function (d) { return d.title; }).join(' · ')));
      head.appendChild(make('span', null, stats.known + ' / ' + stats.total));
      body.appendChild(head);

      var bar = make('div', 'dstat__bar');
      var fill = make('i', 'known');
      fill.style.width = (ratio * 100) + '%';
      bar.appendChild(fill);
      body.appendChild(bar);
      row.appendChild(body);

      if (state.player.cefr === level) row.appendChild(make('span', 'chip', 'Dein Niveau'));
      box.appendChild(row);
    });
  }

  function renderBadges() {
    var box = $('badges');
    box.innerHTML = '';
    BADGES.forEach(function (badge) {
      var owned = !!state.player.badges[badge.id];
      var node = make('div', 'badge' + (owned ? ' is-owned' : ''));
      node.appendChild(make('span', 'badge__icon', badge.icon));
      node.appendChild(make('b', null, badge.title));
      node.appendChild(make('i', null, badge.text));
      box.appendChild(node);
    });
  }

  function renderChart() {
    var chart = $('chart');
    chart.innerHTML = '';
    var days = [];
    var max = 1;
    for (var i = 13; i >= 0; i--) {
      var date = new Date(startOfDay(Date.now()) - i * DAY);
      var entry = state.days[dayKey(date)] || { answered: 0 };
      max = Math.max(max, entry.answered);
      days.push({ date: date, value: entry.answered });
    }
    days.forEach(function (day) {
      var col = make('div', 'chart__col');
      var bar = make('div', 'chart__bar' + (day.value ? '' : ' chart__bar--empty'));
      bar.style.height = Math.max(3, Math.round(day.value / max * 100)) + '%';
      bar.title = day.date.toLocaleDateString('de-DE') + ': ' + day.value;
      col.appendChild(bar);
      col.appendChild(make('span', 'chart__day', String(day.date.getDate())));
      chart.appendChild(col);
    });
  }

  function renderDeckStats() {
    var box = $('deckstats');
    box.innerHTML = '';
    DECKS.forEach(function (deck) {
      var known = 0;
      var learning = 0;
      deck.cards.forEach(function (card) {
        var status = cardState(card);
        if (status === 'known') known++;
        else if (status !== 'new') learning++;
      });

      var wrap = make('div');
      var row = make('div', 'dstat__row');
      row.appendChild(make('b', null, deck.title));
      row.appendChild(make('span', null, known + ' / ' + deck.cards.length + ' gelernt'));
      wrap.appendChild(row);

      var bar = make('div', 'dstat__bar');
      var a = make('i', 'known');
      a.style.width = (known / deck.cards.length * 100) + '%';
      var b = make('i', 'learning');
      b.style.width = (learning / deck.cards.length * 100) + '%';
      bar.appendChild(a);
      bar.appendChild(b);
      wrap.appendChild(bar);
      box.appendChild(wrap);
    });
  }

  // ------------------------------------------------------------- Ereignisse

  function optionHandler(containerId, apply) {
    $(containerId).addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-value]');
      if (!btn || btn.disabled) return;
      apply(btn.dataset.value);
      save();
    });
  }

  function bind() {
    $('tabs').addEventListener('click', function (event) {
      var tab = event.target.closest('.tab');
      if (!tab) return;
      var view = tab.dataset.view;
      if (session && currentView === 'session') { stopTimers(); session = null; }
      if (view === 'home') renderHome();
      if (view === 'list') renderList();
      if (view === 'stats') renderStats();
      showView(view);
    });

    $('hud-cefr-cell').addEventListener('click', function () {
      if (state.player.cefr) { renderStats(); showView('stats'); }
      else startTest();
    });

    optionHandler('opt-mode', function (value) {
      state.settings.mode = value;
      setOptions('opt-mode', value);
      var listenOnly = value === 'listen';
      Array.prototype.forEach.call($('opt-dir').children, function (btn) { btn.disabled = listenOnly; });
    });

    optionHandler('opt-dir', function (value) {
      state.settings.direction = value;
      setOptions('opt-dir', value);
    });

    optionHandler('opt-len', function (value) {
      state.settings.length = parseInt(value, 10);
      setOptions('opt-len', value);
      renderHome();
    });

    optionHandler('deck-level', function (value) {
      deckFilter = value;
      renderHome();
    });

    $('sel-all').addEventListener('click', function () {
      state.decks = DECKS.map(function (d) { return d.id; });
      save(); renderHome();
    });

    $('sel-none').addEventListener('click', function () {
      state.decks = [];
      save(); renderHome();
    });

    $('sel-due').addEventListener('click', function () {
      var now = Date.now();
      var ids = DECKS.filter(function (deck) {
        return deck.cards.some(function (card) { return isDue(card, now); });
      }).map(function (d) { return d.id; });
      if (!ids.length) { toast('Gerade ist nichts fällig.'); return; }
      state.decks = ids;
      save(); renderHome();
    });

    $('start').addEventListener('click', function () {
      if (!state.decks.length) { toast('Bitte mindestens ein Thema wählen.'); return; }
      startSession(buildQueue());
    });

    $('start-blitz').addEventListener('click', startBlitz);

    $('quit').addEventListener('click', quitSession);
    $('next-btn').addEventListener('click', nextQuestion);
    $('a-type').addEventListener('submit', submitTyping);
    $('flip-reveal').addEventListener('click', revealFlip);

    $('flip-actions').addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-ok]');
      if (!btn || session.answered) return;
      finishAnswer(btn.dataset.ok === '1', btn.dataset.ok === '1' ? 'Gut!' : 'Kommt gleich noch mal.');
    });

    $('test-quit').addEventListener('click', function () {
      test = null;
      renderHome();
      showView('home');
    });

    $('test-apply').addEventListener('click', function () {
      var decks = recommendedDecks(state.player.cefr);
      if (decks.length) state.decks = decks.map(function (d) { return d.id; });
      save();
      deckFilter = 'mine';
      renderHome();
      showView('home');
      toast('Themen für ' + state.player.cefr + ' übernommen.');
    });

    $('test-skip').addEventListener('click', function () {
      renderHome();
      showView('home');
    });

    $('sum-again').addEventListener('click', function () {
      var missed = session ? session.missed.slice() : [];
      if (!missed.length) return;
      startSession(shuffle(missed).map(function (card) {
        return { card: card, mode: resolveMode(), direction: resolveDirection(), retried: false };
      }));
    });

    $('sum-new').addEventListener('click', function () {
      if (session && session.blitz) startBlitz();
      else startSession(buildQueue());
    });

    $('sum-home').addEventListener('click', function () {
      session = null;
      renderHome();
      showView('home');
    });

    $('list-deck').addEventListener('change', renderList);
    $('list-search').addEventListener('input', renderList);
    optionHandler('list-filter', function (value) {
      listFilter = value;
      setOptions('list-filter', value);
      renderList();
    });

    $('set-goal').addEventListener('change', function () {
      state.settings.goal = clamp(parseInt(this.value, 10) || 30, 5, 300);
      this.value = state.settings.goal;
      save(); renderStats(); renderHome();
    });

    $('set-new').addEventListener('change', function () {
      state.settings.newPerDay = clamp(parseInt(this.value, 10) || 0, 0, 100);
      this.value = state.settings.newPerDay;
      save(); renderStats(); renderHome();
    });

    $('set-sound').addEventListener('change', function () { state.settings.sound = this.checked; save(); });
    $('set-speak').addEventListener('change', function () { state.settings.autoSpeak = this.checked; save(); });
    $('set-fx').addEventListener('change', function () { state.settings.fx = this.checked; save(); });

    $('retest').addEventListener('click', startTest);

    $('reset').addEventListener('click', function () {
      if (!window.confirm('Wirklich den gesamten Fortschritt löschen? XP, Abzeichen und Niveau sind dann weg.')) return;
      var decks = state.decks;
      var settings = state.settings;
      state = defaults();
      state.decks = decks;
      state.settings = settings;
      save();
      renderHome(); renderStats(); renderList();
      toast('Fortschritt zurückgesetzt.');
    });

    document.addEventListener('keydown', onKey);
  }

  function onKey(event) {
    if (currentView === 'test' && test && !test.busy && /^[1-4]$/.test(event.key)) {
      var choice = $('test-choices').children[parseInt(event.key, 10) - 1];
      if (choice && !choice.disabled) choice.click();
      return;
    }

    if (currentView !== 'session' || !session) return;
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';

    if (event.key === 'Escape') { quitSession(); return; }

    if (session.answered && !session.blitz && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      nextQuestion();
      return;
    }

    if (typing) return;

    var item = currentItem();
    if (item.mode === 'choice' && /^[1-4]$/.test(event.key)) {
      var btn = $('a-choice').children[parseInt(event.key, 10) - 1];
      if (btn && !btn.disabled) btn.click();
      return;
    }

    if (item.mode === 'flip') {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if ($('flip-reveal').hidden) return;
        revealFlip();
      } else if (!$('flip-actions').hidden && (event.key === 'j' || event.key === '1')) {
        finishAnswer(true, 'Gut!');
      } else if (!$('flip-actions').hidden && (event.key === 'n' || event.key === '2')) {
        finishAnswer(false, 'Kommt gleich noch mal.');
      }
    }
  }

  // ------------------------------------------------------------------ Start

  function init() {
    if (!DECKS.length) {
      document.body.innerHTML = '<p class="empty">Lerninhalte konnten nicht geladen werden.</p>';
      return;
    }
    load();
    if (!speechOn) {
      var listenBtn = $('mode-listen');
      listenBtn.disabled = true;
      listenBtn.title = 'Dieser Browser kann keine Sprachausgabe';
      if (state.settings.mode === 'listen') state.settings.mode = 'mixed';
    }
    if (state.settings.mode === 'listen') {
      Array.prototype.forEach.call($('opt-dir').children, function (btn) { btn.disabled = true; });
    }
    if (state.player.cefr) deckFilter = 'all';
    bind();
    renderHome();
    renderStats();
    renderList();
  }

  init();
}());
