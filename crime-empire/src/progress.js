/* ---------------------------------------------------------------------
   Fortschritt: Erfolge pruefen und Rangaufstiege melden.

   Beides laeuft ueber denselben Weg - check() gibt zurueck, was neu ist,
   und das Spiel zeigt es an. Der Zustand merkt sich, was schon gefeiert
   wurde, damit ein Ladevorgang nicht dieselbe Meldung nochmal bringt.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, St = CE.state;

  function check(s) {
    var d = St.derive(s);
    var out = { achievements: [], rank: null };

    for (var i = 0; i < D.ACHIEVEMENTS.length; i++) {
      var a = D.ACHIEVEMENTS[i];
      if (s.achievements[a.id]) continue;
      var got = false;
      try { got = !!a.check(s, d); } catch (e) { got = false; }
      if (got) {
        s.achievements[a.id] = s.day;
        out.achievements.push(a);
      }
    }

    if (d.rank > (s.rankSeen || 0)) {
      s.rankSeen = d.rank;
      out.rank = D.RANKS[d.rank];
    }

    /* Sieg: die ganze Stadt, nicht nur viel Geld. Danach laeuft das Spiel
       weiter - es gibt keinen Abspann, der einem den Spielstand wegnimmt. */
    if (!s.flags.won && d.rank >= 5 && victory(s)) {
      s.flags.won = s.day;
      out.victory = true;
    }
    return out;
  }

  /* Stadtweite Kontrolle: alle sechs Bezirke offen und in jedem die
     Mehrheit. Absichtlich nicht 100% - ein Rest Widerstand bleibt immer. */
  function victory(s) {
    var n = 0;
    for (var k in s.districts) {
      var dd = s.districts[k];
      if (!dd.open || dd.mine < 60) return false;
      n++;
    }
    return n >= D.DISTRICTS.length;
  }

  /* Wie weit ist die Stadt erobert - fuer die Anzeige. */
  function cityProgress(s) {
    var held = 0, total = D.DISTRICTS.length;
    for (var k in s.districts) {
      var dd = s.districts[k];
      if (dd.open && dd.mine >= 60) held++;
    }
    return { held: held, total: total };
  }

  function earned(s) {
    return D.ACHIEVEMENTS.filter(function (a) { return !!s.achievements[a.id]; });
  }

  CE.progress = { check: check, earned: earned, victory: victory, cityProgress: cityProgress };
})(typeof window !== 'undefined' ? window : globalThis);
