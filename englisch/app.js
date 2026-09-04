/*
 * Englisch Trainer - Vokabeltrainer fuer den Browser, ohne Abhaengigkeiten.
 *
 * Kern ist ein Leitner-System mit fuenf Faechern: eine richtige Antwort
 * schiebt die Karte ein Fach weiter (und damit weiter in die Zukunft), eine
 * falsche wirft sie zurueck in Fach 1. Faellige Karten werden bevorzugt
 * abgefragt, neue Karten kommen nur bis zu einem Tageslimit dazu.
 *
 * Der gesamte Lernstand liegt im localStorage; es gibt kein Backend.
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

  var RING_LEN = 2 * Math.PI * 52;
  var SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4 4 0 0 0-2.3-3.6v7.2A4 4 0 0 0 15.5 12z' +
    'm-2.3-7.9v2.1a6 6 0 0 1 0 11.6v2.1a8 8 0 0 0 0-15.8z"/></svg>';

  var MODE_LABEL = {
    mixed: 'Gemischt', choice: 'Multiple Choice', type: 'Tippen',
    flip: 'Karteikarte', listen: 'Hoeren'
  };

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

  // ------------------------------------------------------------ Lerninhalte

  var DECKS = (window.VOCAB_DATA && window.VOCAB_DATA.decks) || [];
  var CARDS = [];

  DECKS.forEach(function (deck) {
    deck.cards = deck.words.map(function (row) {
      var card = {
        key: deck.id + '|' + row[0],
        deck: deck,
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
      version: 1,
      settings: {
        mode: 'mixed', direction: 'de-en', length: 20,
        goal: 30, newPerDay: 10, sound: true, autoSpeak: true
      },
      decks: ['basics'],
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
      if (saved.settings) {
        Object.keys(state.settings).forEach(function (key) {
          if (saved.settings[key] !== undefined) state.settings[key] = saved.settings[key];
        });
      }
      if (Array.isArray(saved.decks)) state.decks = saved.decks;
      if (saved.progress) state.progress = saved.progress;
      if (saved.days) state.days = saved.days;
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

  // ------------------------------------------------------------------- Ton

  var audioCtx = null;

  function beep(ok) {
    if (!state.settings.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      var t = audioCtx.currentTime;
      osc.type = ok ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(ok ? 660 : 200, t);
      osc.frequency.exponentialRampToValueAtTime(ok ? 990 : 150, t + 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    } catch (err) { /* Ton ist nur Beiwerk */ }
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

  // ------------------------------------------------------------------ Toast

  var toastTimer = null;

  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2200);
  }

  // ------------------------------------------------------------------ Views

  var currentView = 'home';

  function showView(name) {
    currentView = name;
    ['home', 'session', 'summary', 'list', 'stats'].forEach(function (id) {
      $('view-' + id).classList.toggle('is-active', id === name);
    });
    var tabFor = name === 'summary' ? 'home' : name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.classList.toggle('is-active', tab.dataset.view === tabFor);
    });
    window.scrollTo(0, 0);
  }

  function setRing(id, ratio) {
    $(id).style.strokeDashoffset = String(RING_LEN * (1 - clamp(ratio, 0, 1)));
  }

  // ------------------------------------------------------------- Startseite

  function setOptions(containerId, value) {
    Array.prototype.forEach.call($(containerId).children, function (btn) {
      btn.classList.toggle('is-active', btn.dataset.value === String(value));
    });
  }

  function renderHome() {
    var now = Date.now();
    var day = today();
    var goal = state.settings.goal;

    $('goal-done').textContent = day.answered;
    $('goal-total').textContent = goal;
    setRing('goal-arc', goal ? day.answered / goal : 0);

    var pool = poolCards();
    var due = pool.filter(function (c) { return isDue(c, now); }).length;
    var known = CARDS.filter(function (c) { return cardState(c) === 'known'; }).length;
    var sum = totals();

    $('fact-streak').textContent = streak();
    $('fact-due').textContent = due;
    $('fact-known').textContent = known;
    $('fact-acc').textContent = sum.answered
      ? Math.round(sum.correct / sum.answered * 100) + '%'
      : '–';

    setOptions('opt-mode', state.settings.mode);
    setOptions('opt-dir', state.settings.direction);
    setOptions('opt-len', state.settings.length);

    renderDecks(now);

    var fresh = pool.filter(function (c) { return !progressOf(c); }).length;
    var budget = Math.max(0, state.settings.newPerDay - day.fresh);
    var planned = Math.min(fresh, budget);
    var hint;
    if (!state.decks.length) {
      hint = 'Kein Thema gewählt';
    } else if (due + planned === 0) {
      hint = fresh
        ? 'Heutiges Limit für neue Karten erreicht – du kannst trotzdem weiterüben.'
        : 'Alles wiederholt. Weiterüben geht jederzeit.';
    } else {
      hint = plural(due, 'fällige Karte', 'fällige Karten') + ' · ' +
        plural(planned, 'neue Karte', 'neue Karten');
    }
    $('start-hint').textContent = hint;
  }

  function renderDecks(now) {
    var box = $('decks');
    box.innerHTML = '';
    DECKS.forEach(function (deck) {
      var known = 0;
      var due = 0;
      var seen = 0;
      deck.cards.forEach(function (card) {
        var status = cardState(card);
        if (status === 'known') known++;
        if (status !== 'new') seen++;
        if (isDue(card, now)) due++;
      });

      var btn = make('button', 'deck');
      btn.type = 'button';
      btn.classList.toggle('is-active', state.decks.indexOf(deck.id) >= 0);
      btn.setAttribute('aria-pressed', String(state.decks.indexOf(deck.id) >= 0));

      var row = make('span', 'deck__row');
      row.appendChild(make('span', 'deck__title', deck.title));
      row.appendChild(make('span', 'deck__level', deck.level));
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

  function startSession(queue) {
    if (!queue.length) {
      toast(state.decks.length
        ? 'Nichts fällig. Wähle eine feste Rundenlänge, um trotzdem zu üben.'
        : 'Bitte mindestens ein Thema wählen.');
      return;
    }
    session = {
      queue: queue,
      index: 0,
      right: 0,
      wrong: 0,
      missed: [],
      started: Date.now(),
      answered: false,
      secondTry: false
    };
    showView('session');
    renderQuestion();
  }

  function currentItem() { return session.queue[session.index]; }

  function promptText(item) {
    return item.direction === 'en-de' ? item.card.de : item.card.en;
  }

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

    $('sess-pos').textContent = session.index + 1;
    $('sess-total').textContent = session.queue.length;
    $('sess-bar').style.width = (session.index / session.queue.length * 100) + '%';
    $('sess-score').textContent = session.right + ' richtig · ' + session.wrong + ' falsch';

    $('qcard').className = 'qcard';
    $('q-deck').textContent = card.deck.title;
    $('q-dir').textContent = item.direction === 'listen'
      ? 'Hören'
      : (item.direction === 'de-en' ? 'Deutsch → Englisch' : 'Englisch → Deutsch');

    var question = questionText(item);
    $('q-prompt').textContent = question || 'Hör zu und schreibe mit';

    var speakBtn = $('q-speak');
    speakBtn.innerHTML = SPEAKER;
    var spoken = item.direction === 'listen' ? card.en : (question && item.direction === 'en-de' ? card.en : null);
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

    record(item.card, ok);
    beep(ok);
    $('qcard').classList.add(ok ? 'is-good' : 'is-bad');

    if (ok) session.right++;
    else {
      session.wrong++;
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

    showFeedback(ok ? 'good' : 'bad', headline, answerText(item), true);

    if (state.settings.autoSpeak && speechOn && item.direction !== 'en-de') {
      setTimeout(function () { speak(item.card.en); }, ok ? 120 : 260);
    }

    $('next-btn').hidden = false;
    $('next-btn').textContent = session.index + 1 >= session.queue.length ? 'Auswertung' : 'Weiter';
    $('sess-score').textContent = session.right + ' richtig · ' + session.wrong + ' falsch';
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
    session.index++;
    if (session.index >= session.queue.length) finishSession();
    else renderQuestion();
  }

  function finishSession() {
    var total = session.right + session.wrong;
    var ratio = total ? session.right / total : 0;

    $('sum-pct').textContent = Math.round(ratio * 100) + '%';
    setRing('sum-arc', ratio);
    $('sum-arc').style.stroke = ratio >= 0.8 ? 'var(--good)' : ratio >= 0.5 ? 'var(--warn)' : 'var(--bad)';

    $('sum-title').textContent = ratio >= 0.9 ? 'Stark!' : ratio >= 0.6 ? 'Gut gemacht' : 'Weiter üben';
    $('sum-sub').textContent = session.missed.length
      ? plural(session.missed.length, 'Karte sitzt noch nicht', 'Karten sitzen noch nicht')
      : 'Alles richtig – nichts zum Nacharbeiten.';

    $('sum-ok').textContent = session.right;
    $('sum-bad').textContent = session.wrong;
    $('sum-time').textContent = formatTime(Date.now() - session.started);

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
    renderHome();
    renderStats();
  }

  function quitSession() {
    if (!session) { showView('home'); return; }
    if (session.right + session.wrong > 0) finishSession();
    else { session = null; showView('home'); renderHome(); }
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

    $('list-count').textContent = rows.length
      ? plural(rows.length, 'Eintrag', 'Einträge')
      : '';

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
      ['Antworten', sum.answered, 'seit dem Start'],
      ['Trefferquote', sum.answered ? Math.round(sum.correct / sum.answered * 100) + '%' : '–', 'alle Runden'],
      ['Serie', plural(streak(), 'Tag', 'Tage'), 'in Folge geübt'],
      ['Heute', today().answered, 'von ' + state.settings.goal + ' Karten']
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

    renderChart();
    renderDeckStats();

    $('set-goal').value = state.settings.goal;
    $('set-new').value = state.settings.newPerDay;
    $('set-sound').checked = !!state.settings.sound;
    $('set-speak').checked = !!state.settings.autoSpeak;
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
      if (session && currentView === 'session') session = null;
      if (view === 'home') renderHome();
      if (view === 'list') renderList();
      if (view === 'stats') renderStats();
      showView(view);
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

    $('quit').addEventListener('click', quitSession);
    $('next-btn').addEventListener('click', nextQuestion);
    $('a-type').addEventListener('submit', submitTyping);
    $('flip-reveal').addEventListener('click', revealFlip);

    $('flip-actions').addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-ok]');
      if (!btn || session.answered) return;
      finishAnswer(btn.dataset.ok === '1', btn.dataset.ok === '1' ? 'Gut!' : 'Kommt gleich noch mal.');
    });

    $('sum-again').addEventListener('click', function () {
      var missed = session ? session.missed.slice() : [];
      if (!missed.length) return;
      startSession(shuffle(missed).map(function (card) {
        return { card: card, mode: resolveMode(), direction: resolveDirection(), retried: false };
      }));
    });

    $('sum-new').addEventListener('click', function () { startSession(buildQueue()); });

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

    $('set-sound').addEventListener('change', function () {
      state.settings.sound = this.checked;
      save();
    });

    $('set-speak').addEventListener('change', function () {
      state.settings.autoSpeak = this.checked;
      save();
    });

    $('reset').addEventListener('click', function () {
      if (!window.confirm('Wirklich den gesamten Lernfortschritt löschen?')) return;
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
    if (currentView !== 'session' || !session) return;
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';

    if (event.key === 'Escape') { quitSession(); return; }

    if (session.answered && (event.key === 'Enter' || event.key === ' ')) {
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
    bind();
    renderHome();
    renderStats();
    renderList();
  }

  init();
}());
