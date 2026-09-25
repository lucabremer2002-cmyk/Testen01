/* Der Testpilot - EINMAL, fuer alle Werkzeuge.
 *
 * Vorher stand diese Logik funf Mal kopiert in selftest, routen-alle,
 * gabel-pruefen, spielgefuehl, abschnitt-profil und bestzeit. Jede
 * Aenderung am Movement musste an funf Stellen nachgezogen werden, und
 * genau dieses Auseinanderlaufen hat schon einmal dafuer gesorgt, dass
 * ein Werkzeug still das falsche Level gemessen hat. Jetzt gibt es eine
 * Quelle; wer sie aendert, aendert alle Messungen zugleich.
 *
 * Eingespielt wird die Datei mit page.addScriptTag, weil der Pilot im
 * Browser neben dem Spiel laufen muss und nicht in Node.
 *
 * Er ist bewusst KEIN guter Spieler. Er ist ein gleichmaessiger Spieler:
 * dieselbe Strecke ergibt dieselbe Zeit. Das macht Vergleiche erst
 * moeglich - "Route A ist 1,2 s schneller als B" ist nur dann eine
 * Aussage, wenn nicht die Tagesform des Piloten dazwischenfunkt.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var hit = { t: 0, nx: 0, ny: 0, nz: 0 };

  /* opts.bremse macht den Piloten absichtlich langsamer: kuerzere
     Spruenge, kein Jet. Das braucht bestzeit.js, um einen Rueckstand
     gegen den Geist zu ERZWINGEN - ein Wert nahe null sagt sonst nicht,
     ob die Messung stimmt oder ob nur nichts passiert ist. */
  function neu(g, opts) {
    return {
      bremse: !!(opts && opts.bremse),
      wi: 1, tode: 0, stuck: 0, lastZ: g.player.z, fest: false, steigt: false,
      cmd: { wishX: 0, wishZ: 0, slide: false, jet: false,
             jumpPressed: false, jumpHeld: false }
    };
  }

  /* Ein Simulationsschritt. wps ist die Liste der Wegpunkte. */
  function schritt(g, st, wps) {
    var cmd = st.cmd;
    var P = root.MR.physics, lvl = g.level, p = g.player, c = st.cmd;
    var tgt = wps[Math.min(st.wi, wps.length - 1)];
    var dx = tgt[0] - p.x, dz = tgt[2] - p.z, d2 = Math.hypot(dx, dz);
    var hoch = tgt[1] - p.y;
    /* Ein Wegpunkt gilt erst als erreicht, wenn die Figur auch OBEN ist.
       Die alte Schranke liess sieben Meter Abweichung nach beiden Seiten
       zu - in einem waagerechten Level unwichtig, in einem senkrechten
       verheerend: der Pilot haekelte Stufen ab, die er drei Meter unter
       der Kante passiert hatte, und fiel zwei Wegpunkte spaeter. Der
       Fehler stand dann an der falschen Stelle. Nach unten bleibt es
       grosszuegig - fallen soll er duerfen. */
    if (d2 < 5 && hoch < 2.5 && hoch > -9) { if (st.wi < wps.length - 1) st.wi++; }

    /* Seitliche Drift ausgleichen statt stur auf den Punkt zuzuhalten -
       sonst kreist der Pilot bei Tempo um jedes Ziel herum. */
    var ux = dx / (d2 || 1), uz = dz / (d2 || 1);
    var along = p.vx * ux + p.vz * uz;
    var latX = p.vx - ux * along, latZ = p.vz - uz * along;
    var lead = p.grounded ? 0.10 : 0.32;
    var aX = dx - latX * lead, aZ = dz - latZ * lead, aL = Math.hypot(aX, aZ) || 1;
    c.wishX = aX / aL; c.wishZ = aZ / aL;

    var ahead = P.raycast(lvl.world, p.x + c.wishX * 2.4, p.y - 0.4, p.z + c.wishZ * 2.4, 0, -1, 0, 3.2, hit);
    var below = P.raycast(lvl.world, p.x, p.y - 0.4, p.z, 0, -1, 0, 4.0, hit);

    c.slide = (!p.grounded && p.vy < -4) || (p.grounded && p.speed > 19);
    c.jumpPressed = false;
    c.jumpHeld = d2 > p.speed * (st.bremse ? 0.80 : 0.52);

    /* Wie viel Tank die naechste Stufe braucht. Gemessen steigt der Jet
       ohne Steuerkreuz 27,1 m mit vollem Tank, also rund 43 m je Anteil.
       Ein Viertel Reserve, weil der Sprung selbst schon etwas mitbringt
       und die Landung Spielraum braucht. */
    /* 43 m je Tank gilt fuer reines Steigen. Wer dabei auch nach vorn
       muss - und das ist auf schraegen Stufen der Normalfall - bekommt
       gemessen nur 17,1 m Hoehe aus derselben Fuellung. Der Ansatz liegt
       deshalb bei 20, nicht bei 43: ein Pilot, der mit einem Drittel Tank
       in eine Stufe startet, die den ganzen braucht, faellt. */
    var brauchtTank = M.clamp((hoch - 4.5) / 20 * 1.15, 0, 1);
    /* Auf dem Boden vor einer hohen Stufe WARTEN, bis genug im Tank ist.
       Ohne das zuendete der Pilot mit 13 Prozent in eine 24-m-Stufe, kam
       sechzehn Meter hoch und fiel - siebenmal hintereinander. Ein
       Mensch, der die Stufe sieht, wartet die knappe Sekunde ab; sie ist
       Teil des Rhythmus, nicht verlorene Zeit. */
    /* Die Schranke lag zuerst bei hoch*1,8 - also 28 m bei einer 16-m-
       Stufe. Schraege Stufen sind aber gerade die WEITEN: die erste Stufe
       des irren Weges misst 40 m bei 16 m Hoehe. Der Pilot sah sie damit
       nicht als Steigstufe an, zuendete mit halbem Tank und fiel. */
    var wartet = p.grounded && hoch > 6 && d2 < 70 &&
                 p.tank < Math.min(0.98, brauchtTank);
    if (wartet) { c.wishX = 0; c.wishZ = 0; c.slide = false; st.i = (st.i || 0) + 1; return c; }

    if (p.grounded && (!ahead || (hoch > 1.5 && d2 < 10) || (p.speed < 5 && st.i > 60))) {
      c.jumpPressed = true;
    } else if (!p.grounded && p.coyote <= 0 && p.wallCoyote > 0 && !below) {
      /* --------------------------------------------------- Wandsprung
         Die Figur beruehrt eine Wand und ist in der Luft. Der Wandsprung
         hat im Spieler Vorrang vor dem Doppelsprung, es genuegt also, im
         Nachfristfenster zu druecken. Ohne diesen Zweig presste der Pilot
         beim Aufsteigen an der Wand nie Sprung - die Bedingung darunter
         verlangt vy < -1 - und die Wandschlucht war fuer ihn
         unpassierbar. */
      c.jumpPressed = true;
    } else if (!p.grounded && p.vy < -1 && !below && p.jumps > 0 && tgt[1] > p.y - 3) {
      /* Der Doppelsprung wird nur genommen, wenn das Ziel nicht deutlich
         tiefer liegt. Vorher sprang der Pilot ueber jeder Luecke nach,
         auch wenn er fallen sollte - er segelte dann fuenfzehn Meter ueber
         dem Zusammenfluss hinweg und holte sich das Tempo aus der Landung
         nie ab. Ein Spieler tut das nicht. */
      c.jumpPressed = true;
    }

    /* ------------------------------------------------------------ Jet
       Der Jet wird GEHALTEN, nicht angetippt - der Pilot muss also nicht
       den richtigen Moment treffen, sondern die richtige DAUER und die
       richtige RICHTUNG. Beides folgt derselben Aufteilung wie beim
       Menschen:

         Ziel liegt deutlich hoeher  -> Steuerkreuz LOS, er steigt
         Weite fehlt                 -> Steuerkreuz HALTEN, er schiebt

       Gezuendet wird nur in der Luft und nur, wenn es ohne nicht reicht.
       Ohne diese Bedingung brennt der Tank dauernd und der Pilot fliegt
       die Strecke ab, statt sie zu spielen - dann misst das Werkzeug den
       Jet und nicht das Level. */
    c.jet = false;

    /* ------------------------------------------------ Die Entscheidung

       Frueher stand hier eine Scheitelpunkt-Rechnung: "wie hoch komme
       ich noch, wenn ich jetzt aufhoere zu schieben". Sie war viermal
       hintereinander falsch - mal mit der falschen Schwerkraft, mal ohne
       die Steiggrenze, mal ohne den Tempoverlust der Querbremse - und
       jedes Mal blieb der Pilot systematisch drei Meter unter der Kante,
       waehrend ich das Level dafuer verantwortlich machte und Stufen von
       17 auf 15 auf 12 auf 9 Meter schrumpfte, die alle in Ordnung waren.

       Die Regel heisst jetzt: schieben, solange man UNTER der Kante ist.
       Sie kann sich nicht verschaetzen, weil sie nichts vorhersagt. Sie
       verbraucht etwas mehr Tank als noetig - das ist der Preis, und er
       ist bezahlbar: der Pilot ist ein Messgeraet, kein Rekordhalter.
       Wichtig ist, dass er gleichmaessig faehrt, nicht dass er optimal
       faehrt. */
    /* Grobe Wurfweite beim aktuellen Tempo: solange sie reicht, ist
       kein Vortrieb noetig und der Tank bleibt fuer die Hoehe. */
    var flugRest = p.vy > 0
      ? (p.vy / 64 + Math.sqrt(Math.max(0, p.y - tgt[1] + p.vy * p.vy / 128) / 32))
      : Math.sqrt(Math.max(0, p.y - tgt[1]) / 32);
    /* "Unter der Kante" heisst: ich komme mit dem, was ich habe, nicht
       hinauf. Der reine Hoehenvergleich genuegt dafuer nicht - eine
       Sprungfeder schleudert die Figur mit Tempo 30 los, und wer dann
       trotzdem zuendet, verbrennt einen Tank fuer Hoehe, die er schon
       hat. Auf dem sicheren Weg, der ohne Treibstoff auskommen SOLL,
       stand der Pilot damit nach elf von einundzwanzig Stufen mit neun
       Prozent da.

       Die Scheitelrechnung darf den Schub aber NUR im Federfall
       unterdruecken, nirgends sonst. Als sie allgemein galt, hoerte der
       Pilot ueberall zu frueh auf und blieb unter jeder Kante - das war
       vier Anlaeufe lang der Fehler. Im Schwebezustand ist sie
       verlaesslich, weil dort die schwache Schwerkraft (42) gilt und
       dieser Zustand der Figur gehoert, nicht der Steuerung. */
    var T2 = root.MR.player.TUNING;
    var federTraegt = p.floatUp && p.vy > 0 &&
                      p.y + p.vy * p.vy / (2 * T2.GRAV_HOLD) >= tgt[1] + 1.0;
    var unterKante = p.y < tgt[1] + 1.5 && !federTraegt;
    var weitGenug = d2 <= p.speed * flugRest + 2;

    if (!p.grounded && !below && !st.bremse) {
      var tankDa = p.tank > 0.1;
      if (unterKante) {
        if (p.jumps > 0 && p.vy < 2 && tgt[1] - p.y <= 4.0) {
          /* Der Doppelsprung traegt 4,91 m und kostet nichts. */
          c.jumpPressed = true;
        } else if (tankDa) {
          c.jet = true;
          /* Das Steuerkreuz wird nur fuer die GROSSEN Stufen losgelassen.
             Gemessen steigt der Jet auch mit gehaltenem Steuerkreuz noch
             18,2 m und bremst dabei nicht quer; loslassen bringt 26,7 m,
             kostet aber zwei Drittel des Tempos. Ueber 15 m lohnt sich
             der Tausch, darunter nicht. Einmal begonnen, wird der
             Steigflug zu Ende geflogen - ohne diese Rastung liess der
             Pilot fuer genau ein Bild los und griff wieder zu. */
          if (tgt[1] - p.y > 15) st.steigt = true;
          if (st.steigt) { c.wishX = 0; c.wishZ = 0; }
        }
      } else {
        st.steigt = false;
        if (!weitGenug) {
          if (p.jumps > 0 && p.vy < 2) c.jumpPressed = true;
          else if (tankDa) c.jet = true;     /* Richtung bleibt stehen */
        }
      }
    }
    if (p.grounded) st.steigt = false;

    st.i = (st.i || 0) + 1;
    return c;
  }

  /* Nach dem Schritt: Tode zaehlen und Feststecken erkennen. */
  function nachlauf(g, st, F) {
    if (g.state === 'finish') return 'fertig';
    if (g.state !== 'run') {
      st.tode++;
      if (st.tode > 6) return 'tot';
      g.startRun(true); g.state = 'run'; st.wi = 1;
      return 'sturz';
    }
    if (Math.abs(g.player.z - st.lastZ) < 0.05) st.stuck++;
    else { st.stuck = 0; st.lastZ = g.player.z; }
    if (st.stuck > 120 * 10) return 'fest';
    return 'laeuft';
  }

  root.PILOT = { neu: neu, schritt: schritt, nachlauf: nachlauf };
})(window);
