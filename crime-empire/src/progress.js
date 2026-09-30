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
     Mehrheit. Absichtlich nicht 100% - ein Rest Widerstand bleibt immer.

     Dazu ein Bundesverfahren, das man im Griff hat. Ohne diese Bedingung
     gewann im Szenarienvergleich auch der schlampige Spieler die Stadt -
     mit dreizehn Razzien, einem Fall bei 99 und einer Anklage in
     Vorbereitung. Wer kurz davor steht, alles verzollt zu bekommen,
     kontrolliert nichts. Die Bedingung ist erfuellbar, nicht streng:
     unter 60 heisst "keine Anklagekammer", nicht "makellos". */
  function victory(s) {
    var n = 0;
    for (var k in s.districts) {
      var dd = s.districts[k];
      if (!dd.open || dd.mine < 60) return false;
      n++;
    }
    if (n < D.DISTRICTS.length) return false;

    /* Zwei Wege, die Stadt zu halten - und man braucht nur einen.

       Entweder man haelt das Bundesverfahren klein: dann kontrolliert
       man durch Bestand. Oder man wird so gefuerchtet, dass niemand
       mehr antritt: dann kontrolliert man durch Schrecken, auch waehrend
       die Anklagekammer tagt.

       Ohne diesen zweiten Weg konnte ein aggressiver Spieler den Sieg
       zwar beruehren, aber nie halten - sein Verfahren lag im Testlauf
       dauerhaft zwischen 76 und 99. Aggression waere damit eine
       Sackgasse gewesen, egal wie gut man sie spielt. */
    var fallImGriff = !(s.commission && s.commission.open && s.commission.strength >= 60);
    var gefuerchtetGenug = (s.fear || 0) >= 65;
    if (!fallImGriff && !gefuerchtetGenug) return false;
    return true;
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
