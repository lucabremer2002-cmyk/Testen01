/* ---------------------------------------------------------------------
   Spielstaende.

   Vier Plaetze: drei von Hand, einer automatisch. Der Zustand ist reines
   JSON - es gibt nichts zu serialisieren, was nicht schon im Objekt
   steht. Die einzige Aufraeumarbeit ist das Entfernen der
   Zwischenspeicher, die derive() an die Betriebe haengt.

   Der Speicher wird abstrahiert, damit die Logik auch ohne Browser
   laeuft (tools/simulation.js).
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var St = CE.state, U = CE.util, D = CE.data;

  var PREFIX = 'crimeempire.slot.';
  var META = 'crimeempire.meta';
  var SLOTS = ['auto', '1', '2', '3'];

  /* Ersatzspeicher, falls localStorage fehlt oder gesperrt ist (privates
     Fenster, file:// in manchen Browsern). Das Spiel laeuft dann normal
     weiter, nur ueberlebt es den Tab nicht - und sagt das auch. */
  var memory = {};
  var available = (function () {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem('crimeempire.probe', '1');
      localStorage.removeItem('crimeempire.probe');
      return true;
    } catch (e) { return false; }
  })();

  function raw(key) {
    try { return available ? localStorage.getItem(key) : (memory[key] || null); }
    catch (e) { return memory[key] || null; }
  }
  function put(key, value) {
    try { if (available) localStorage.setItem(key, value); else memory[key] = value; }
    catch (e) { memory[key] = value; available = false; }
  }
  function drop(key) {
    try { if (available) localStorage.removeItem(key); delete memory[key]; }
    catch (e) { delete memory[key]; }
  }

  function clean(s) {
    var copy = {};
    for (var k in s) if (k !== '_ui') copy[k] = s[k];
    /* Das offene Ereignis wird NICHT gespeichert. Seine Optionen sind
       Funktionen; JSON wirft sie weg, und ein geladenes Spiel haette
       dann ein Fenster, dessen Knoepfe nichts tun - und weil ein
       Ereignis die Zeit anhaelt, waere die Partie tot. Ein neues
       Ereignis kommt innerhalb weniger Tage von selbst. */
    copy.event = null;
    copy.businesses = s.businesses.map(function (b) {
      var o = {};
      for (var kk in b) if (kk.charAt(0) !== '_') o[kk] = b[kk];
      return o;
    });
    return copy;
  }

  function save(s, slot, label) {
    slot = String(slot || 'auto');
    var payload = {
      v: St.SAVE_VERSION, saved: Date.now(), label: label || '',
      state: clean(s)
    };
    var json;
    try { json = JSON.stringify(payload); }
    catch (e) { return { ok: false, why: 'This game state could not be written.' }; }
    put(PREFIX + slot, json);
    put(META, JSON.stringify({ last: slot, at: payload.saved }));
    return { ok: true, slot: slot, bytes: json.length, stored: available };
  }

  function load(slot) {
    var json = raw(PREFIX + String(slot));
    if (!json) return { ok: false, why: 'Empty slot.' };
    var payload;
    try { payload = JSON.parse(json); } catch (e) { return { ok: false, why: 'This save is damaged.' }; }
    if (!payload.state) return { ok: false, why: 'This save is damaged.' };
    var s = migrate(payload.state, payload.v);
    return { ok: true, state: s, saved: payload.saved, label: payload.label };
  }

  /* Alte Staende anpassen. Heute gibt es nur eine Version, aber der Weg
     steht offen - fehlende Felder werden ergaenzt statt den Stand zu
     verwerfen. */
  function migrate(s, v) {
    var fresh = St.newGame({ seed: s.seed || 1 });
    for (var k in fresh) if (s[k] === undefined) s[k] = fresh[k];
    if (!s.stats) s.stats = fresh.stats;
    if (!s.mods) s.mods = fresh.mods;
    if (!s.flags) s.flags = {};
    if (!s.offers) s.offers = {};
    if (!s.pending) s.pending = [];
    /* Sicherheitsnetz fuer Staende aus aelteren Fassungen, in denen ein
       Ereignis noch mitgeschrieben wurde. */
    if (s.event && (!s.event.options || typeof (s.event.options[0] || {}).go !== 'function')) s.event = null;
    if (!s.history) s.history = [];
    if (!s.commission) s.commission = CE.commission.fresh();
    if (!s.people) s.people = {};
    for (var ri = 0; ri < s.rivals.length; ri++) {
      if (!s.rivals[ri].goal) {
        var hd = D.byId(D.RIVALS, s.rivals[ri].id);
        s.rivals[ri].goal = { kind: 'district',
          target: hd ? Object.keys(hd.home)[0] : 'oldtown', since: 0, progress: 0 };
      }
    }
    for (var dk in s.districts) if (!s.districts[dk].state) {
      s.districts[dk].state = 'stable'; s.districts[dk].stateSince = 0;
    }
    /* Bezirke oder Rivalen, die es beim Speichern noch nicht gab. */
    D.DISTRICTS.forEach(function (d) {
      if (!s.districts[d.id]) s.districts[d.id] = { id: d.id, open: false, mine: 0, unrest: 0 };
    });
    D.RIVALS.forEach(function (r) {
      if (!U.byId(s.rivals, r.id)) {
        var infl = {};
        D.DISTRICTS.forEach(function (d) { infl[d.id] = r.home[d.id] || 0; });
        s.rivals.push({ id: r.id, cash: r.cash, strength: r.strength, infl: infl,
          relation: 0, allied: false, truceUntil: -1, biz: 2, lastAct: '', heat: 0 });
      }
    });
    s.v = St.SAVE_VERSION;
    return s;
  }

  /* Uebersicht fuer das Menue: was liegt in welchem Platz? */
  function list() {
    return SLOTS.map(function (slot) {
      var json = raw(PREFIX + slot);
      if (!json) return { slot: slot, empty: true };
      try {
        var p = JSON.parse(json);
        var s = p.state;
        var d = St.derive(s);
        return {
          slot: slot, empty: false, saved: p.saved, label: p.label,
          name: s.name, day: s.day, week: U.weekOf(s.day), cash: s.cash,
          rank: d.rankName, businesses: s.businesses.length, crew: s.crew.length - 1,
          worth: d.netWorth, difficulty: s.difficulty
        };
      } catch (e) {
        return { slot: slot, empty: false, broken: true };
      }
    });
  }

  function lastSlot() {
    var m = raw(META);
    if (!m) return null;
    try { return JSON.parse(m).last; } catch (e) { return null; }
  }

  function hasAny() {
    for (var i = 0; i < SLOTS.length; i++) if (raw(PREFIX + SLOTS[i])) return true;
    return false;
  }

  function erase(slot) { drop(PREFIX + String(slot)); return { ok: true }; }

  /* Einstellungen liegen ausserhalb der Spielstaende. */
  var SET = 'crimeempire.settings';
  function settings() {
    var def = { sound: true, music: false, speedDefault: 1, autosave: true, reduceMotion: false, confirmBig: true };
    var j = raw(SET);
    if (!j) return def;
    try {
      var o = JSON.parse(j);
      for (var k in def) if (o[k] === undefined) o[k] = def[k];
      return o;
    } catch (e) { return def; }
  }
  function saveSettings(o) { put(SET, JSON.stringify(o)); }

  CE.save = {
    save: save, load: load, list: list, erase: erase, lastSlot: lastSlot, hasAny: hasAny,
    settings: settings, saveSettings: saveSettings, SLOTS: SLOTS,
    get available() { return available; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
