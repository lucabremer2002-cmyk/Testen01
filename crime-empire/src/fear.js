/* ---------------------------------------------------------------------
   Furcht - die Waehrung des aggressiven Spiels.

   Der Messwert, der dieses System ausgeloest hat: ein Imperium aus
   Untergrundbetrieben verdient 26 % mehr brutto als ein legales, netto
   aber genau dasselbe. Die Waesche frisst 114.000 Dollar je Woche, die
   Hitzestrafe noch einmal 49.000, und der Bundesfall waechst viermal so
   schnell. Es gab schlicht keinen Grund, aggressiv zu spielen.

   Die falsche Antwort waere gewesen, Untergrundbetriebe eintraeglicher
   zu machen. Dann haette man dieselbe Strategie mit anderen Zahlen.
   Stattdessen bekommt Aggression eine eigene Waehrung, die vorsichtiges
   Spiel gar nicht erzeugen kann, und die *andere Handlungen* aufschliesst
   statt bessere Werte zu geben:

     ab 25  Schutzgeld von unterlegenen Rivalen fordern - eine Einnahme,
            die niemand wascht, weil niemand sie meldet
     ab 40  sich in einen Bezirk hineinzwingen, statt Eintritt zu zahlen
     ab 55  einen Betrieb eines Rivalen uebernehmen, statt einen zu kaufen

   Und sie kostet etwas, das sich nicht zurueckkaufen laesst: wer
   gefuerchtet wird, bekommt keine guten Bewerber mehr, keine Lizenz fuer
   die grossen legalen Betriebe, und die Kommission behandelt ihn als
   Gewalttaeter - sie setzt dann Zeugen und Spitzel statt Wanzen, und die
   sind teurer loszuwerden.

   Umgekehrt hat vorsichtiges Spiel etwas, das ein gefuerchteter Spieler
   nicht nachbauen kann: Seriositaet. Siehe legitimacy() weiter unten.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  var STUFEN = [
    { at: 0,  name: 'Unbekannt',    desc: 'Niemand wechselt die Straßenseite, wenn er dich sieht.' },
    { at: 15, name: 'Stadtgespräch', desc: 'Die Leute haben die eine oder andere Geschichte gehört.' },
    { at: 30, name: 'Gefürchtet',     desc: 'Räume werden still. Manche Türen öffnen sich, andere schließen sich.' },
    { at: 50, name: 'Gefürchtet und gemieden',    desc: 'Rivalen ziehen ihre Leute ab, statt dich zu testen.' },
    { at: 72, name: 'Schrecken',     desc: 'Niemand bei Verstand arbeitet für dich, und niemand bei Verstand legt sich mit dir an.' }
  ];

  /* Was die Furcht aufschliesst. Jede Zeile ist eine Handlung, keine
     Zahl - das ist der Unterschied zu einem Multiplikator. */
  var TORE = {
    tribute: 18,      /* Schutzgeld fordern - das erste erreichbare Tor */
    muscle: 38,       /* Bezirk erzwingen */
    seize: 55         /* Betrieb uebernehmen */
  };

  function level(s) {
    var f = s.fear || 0;
    var st = STUFEN[0];
    for (var i = STUFEN.length - 1; i >= 0; i--) if (f >= STUFEN[i].at) { st = STUFEN[i]; break; }
    return st;
  }

  function add(s, n, grund) {
    s.fear = U.clamp((s.fear || 0) + n, 0, 100);
    if (grund) s.fearLast = grund;
    return s.fear;
  }

  /* Seriositaet: der Gegenentwurf. Sie laesst sich nicht erzwingen und
     nicht kaufen - man muss sie sich verdient und die Finger von den
     Mitteln gelassen haben, die Furcht erzeugen. */
  function legitimacy(s) {
    var f = s.fear || 0;
    if (s.rep >= 55 && f <= 20) return 2;      /* voll */
    if (s.rep >= 35 && f <= 35) return 1;      /* teilweise */
    return 0;
  }

  function legitimacyLabel(n) {
    return n >= 2 ? 'Angesehen' : (n === 1 ? 'Geduldet' : 'Berüchtigt');
  }

  /* Woechentlich. Furcht verblasst, wenn man sie nicht naehrt - Angst
     hat ein kurzes Gedaechtnis. Ein guter Ruf bremst sie zusaetzlich. */
  function weekly(s, rng, d, report) {
    if (s.fear === undefined) s.fear = 0;
    /* Der Zerfall waechst mit der Furcht selbst.

       Vorher war er flach bei rund 1,65 je Woche - und damit hoeher als
       alles, was ein Spieler frueh aufbauen konnte. Im Testlauf stand
       die Furcht in Woche 40 bei 5 und in Woche 60 bei 3; die ganze
       aggressive Spielweise oeffnete sich erst in Woche 63, wenn die
       Partie schon entschieden ist. Ein erster Ruf haelt sich leicht,
       ein Schrecken auf Dauer nicht: unten klebt sie, oben zerrinnt
       sie. Damit liegt die Staerke der Aggression im Mittelspiel, wo
       sie hingehoert. */
    var zerfall = 0.35 + (s.fear || 0) * 0.022 + (s.rep / 100) * 0.8;
    if (s.fear > 70) zerfall += (s.fear - 70) * 0.075;
    /* Wer Schutzgeld nimmt, haelt die Furcht von selbst wach. */
    var tribute = (s.tributes || []).length;
    if (tribute) zerfall *= 0.45;
    var vor = s.fear;
    s.fear = U.clamp(s.fear - zerfall, 0, 100);

    var altStufe = level({ fear: vor }).name, neuStufe = level(s).name;
    if (altStufe !== neuStufe && Math.abs(vor - s.fear) > 0.01) {
      report.push({ t: 'neutral', text: 'Dein Name wiegt weniger als vorher. Jetzt: ' + neuStufe + '.' });
    }

    /* Schutzgeld einsammeln. Es braucht keine Waesche - niemand meldet,
       was er aus Angst zahlt. Das ist der wirtschaftliche Kern der
       aggressiven Spielweise. */
    einsammeln(s, rng, d, report);
  }

  function einsammeln(s, rng, d, report) {
    if (!s.tributes) s.tributes = [];
    for (var i = s.tributes.length - 1; i >= 0; i--) {
      var t = s.tributes[i];
      var r = U.byId(s.rivals, t.rival);
      var rd = r ? D.byId(D.RIVALS, r.id) : null;
      if (!r || !rd) { s.tributes.splice(i, 1); continue; }

      /* Wer nicht mehr gefuerchtet wird, bekommt nichts mehr. */
      var haelt = (s.fear || 0) >= TORE.tribute - 8 &&
                  d.strength > r.strength * 0.75 && !r.allied;
      if (!haelt) {
        s.tributes.splice(i, 1);
        r.relation = U.clamp(r.relation + 6, -100, 100);
        report.push({ t: 'warn', text: rd.name + ' zahlt nicht mehr. Man hat sich deine Zahlen angesehen ' +
          'und entschieden, dass du nichts erzwingen kannst.' });
        continue;
      }
      t.weeks = (t.weeks || 0) + 1;
      r.relation = U.clamp(r.relation - 1.2, -100, 100);
    }
  }

  /* Was das Schutzgeld einbringt - wird von economy.js als eigene
     Buchungszeile gefuehrt, damit man sieht, woher es kommt. */
  function tributeIncome(s, d) {
    var summe = 0, zeilen = [];
    var liste = s.tributes || [];
    for (var i = 0; i < liste.length; i++) {
      var r = U.byId(s.rivals, liste[i].rival);
      if (!r) continue;
      var infl = 0;
      for (var k in r.infl) infl += r.infl[k];
      /* Was ein Rivale zahlt, haengt an seiner Groesse und daran, wie
         sehr man ihn ueberragt. */
      var uebermacht = U.clamp(d.strength / Math.max(20, r.strength), 0.8, 2.4);
      var betrag = Math.round(infl * 72 * uebermacht * (0.6 + (s.fear || 0) / 140));
      summe += betrag;
      zeilen.push({ rival: r.id, name: D.byId(D.RIVALS, r.id).name, amount: betrag });
    }
    return { total: summe, zeilen: zeilen };
  }

  CE.fear = {
    STUFEN: STUFEN, TORE: TORE, level: level, add: add, weekly: weekly,
    legitimacy: legitimacy, legitimacyLabel: legitimacyLabel,
    tributeIncome: tributeIncome
  };
})(typeof window !== 'undefined' ? window : globalThis);
