/*
 * Spielfigur und Verfolgerkamera.
 *
 * Bewegungsgefuehl ist hier wichtiger als alles andere:
 *   - hohe Beschleunigung, klare Hoechstgeschwindigkeit
 *   - Schwung aus Dash und Tempofeld bleibt erhalten (weicher Abbau)
 *   - Coyote-Zeit und gepufferter Sprung verzeihen ein paar Frames
 *   - Doppelsprung und Dash als Mobilitaet in der Luft
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var Physics = root.MR.physics;
  var MAT = root.MR.level.MAT;

  /* -------------------------------------------------------------------
     Bewegung der Figur.

     Der Unterschied zum alten Modell steckt in einer einzigen Zahl:
     OVER_DECAY. Dort baute sich jedes Tempo oberhalb der Laufgeschwindigkeit
     mit 46 Einheiten pro Sekunde ab - ein Dash auf 40 war nach 0,4 s
     wieder bei 21. Tempo war damit nichts, was man sich erarbeitet, sondern
     ein kurzer Ausschlag. Hier zerfaellt Ueberschusstempo mit 7 am Boden,
     2,5 in der Luft und 0,8 im Rutschen: wer schnell ist, bleibt schnell,
     solange er keinen Fehler macht.

     Tempo entsteht aus Hoehe. Der Motor kennt nur achsparallele Kaesten,
     also gibt es keine Rampen zum Hinunterrutschen - stattdessen wird beim
     Landen mit gedrueckter Rutschtaste Fallgeschwindigkeit in Vortrieb
     umgerechnet. Hoch gehen kostet Zeit und bringt Tempo. Das ist die
     zentrale Entscheidung des Spiels.
     ------------------------------------------------------------------- */
  var P = {
    RADIUS: 0.42,
    HEIGHT: 1.7,

    /* Kamera. Ohne diese beiden wurde der Blickwinkel NaN und es war
       ueberhaupt nichts mehr zu sehen - nur Himmel. */
    LOOK_PITCH: 0.72,
    LOOK_SMOOTH: 20,

    /* Grundtempo. Es gibt keine Sprinttaste mehr - die Figur laeuft immer
       so schnell sie kann, die Taste ist zum Rutschen da. */
    RUN: 17.0,

    ACCEL_GROUND: 200,
    ACCEL_AIR: 88,
    ACCEL_SLIDE: 26,          /* im Rutschen kaum noch antreiben */

    TURN_DAMP_GROUND: 22,
    TURN_DAMP_AIR: 2.6,
    TURN_DAMP_SLIDE: 1.1,     /* im Rutschen laesst sich kaum lenken */

    FRICTION_GROUND: 170,
    FRICTION_SLIDE: 5,
    FRICTION_AIR: 1.2,

    /* Der Kern: Schwung vergeht langsam. */
    OVER_DECAY_GROUND: 7,
    OVER_DECAY_AIR: 2.5,

    /* Rutschen war zu gut: es hielt Tempo fast verlustfrei und kostete auf
       einer geraden Strecke gar nichts. Gemessen hielt der Testpilot
       sieben Sekunden am Stueck exakt Tempo 40 - ein Plateau, kein Spiel.
       Jetzt ermuedet das Rutschen: der Verlust waechst mit jeder Sekunde,
       nach anderthalb Sekunden ist er groesser als beim Laufen.

       Frisch wird es nur durch eine Rutschlandung. Damit haengen die
       beiden Mechaniken zusammen: aus der Hoehe Tempo holen, es knapp zwei
       Sekunden tragen, und vorher die naechste Hoehe finden. Das ist der
       Takt, in dem das Level gebaut ist. */
    OVER_DECAY_SLIDE: 0.8,
    SLIDE_FADE: 7.0,
    SLIDE_RECOVER: 0.4,       /* so schnell erholt sich das Rutschen im Stehen */

    GRAV_HOLD: 42,
    GRAV_UP: 78,
    GRAV_DOWN: 64,
    MAX_FALL: 64,
    JUMP_V: 15.5,
    DJUMP_V: 13.5,

    /* Rutschlandung: Anteil der Fallgeschwindigkeit, der in Vortrieb
       umschlaegt, und die Obergrenze dafuer. 46 ist schnell genug, dass ein
       hoher Weg sich lohnt, und langsam genug, dass er kein Freifahrtschein
       ist. */
    /* Gemessen: mit 0,78 und Deckel 46 war ab 14 m Fallhoehe Schluss - ein
       Umweg auf 24 m brachte exakt so viel wie einer auf 14. Damit war die
       Frage "wie hoch lohnt sich" beantwortet, bevor sie gestellt war.
       Flacher und hoeher gedeckelt skaliert sie weiter: 6 m -> 31,
       10 m -> 36, 16 m -> 42, 24 m -> 48, ganz hoch -> 54. */
    SLIDE_LAND_GAIN: 0.62,
    /* Hoechstgeschwindigkeit des Spiels - eine Zahl, eine Bedeutung. Hier
       enden sowohl die Rutschlandung als auch der Absprung aus dem
       Rutschen. Bei 58 (209 km/h) blieben auf 24 m Plattformabstand vier
       Zehntelsekunden je Plattform, schneller als man im Rutschen lenken
       kann; der Testpilot verfehlte reihenweise Landungen. Die Geometrie
       ist auf 25 bis 40 ausgelegt, 46 ist die Spitze fuer einen grossen
       Sturz - nicht der Normalfall. */
    SPEED_CAP: 46,
    /* Kurzzeitige Rauschgrenze nach einem grossen Sturz - siehe die
       Rutschlandung weiter unten. Aufprall 36 entspricht rund zehn
       Metern Fall; darunter bleibt alles beim Alten. */
    RAUSCH_MIN: 36,
    RAUSCH_CAP: 56,
    RAUSCH_ZEIT: 1.6,
    /* Erst ab dieser Aufprallgeschwindigkeit zaehlt es als Sturz - 30
       entspricht rund sieben Metern Fall.

       Die Schwelle muss deutlich ueber dem liegen, was ein gewoehnlicher
       Sprung erzeugt: ein gehaltener Sprung steigt 2,8 m und kommt mit 19
       wieder auf. Bei einer Schwelle von 17 loeste jeder einzelne Huepfer
       die Rutschlandung aus, und der Testpilot hing sieben Sekunden am
       Stueck auf Tempo 40 - ein Plateau statt eines Spiels. Bei 6, wie
       ganz am Anfang, reichte schon eine Stufe von dreissig Zentimetern.
       Hoehe muss man sich holen, nicht im Vorbeigehen mitnehmen. */
    SLIDE_LAND_MIN: 30,
    SLIDE_MIN_SPEED: 5,       /* darunter steht man auf statt zu rutschen */
    SLIDE_JUMP_KEEP: 1.06,    /* Absprung aus dem Rutschen traegt etwas weiter */

    /* Dash ist keine Faehigkeit mit Abklingzeit mehr, sondern ein Vorrat.
       Landen gibt eine Ladung zurueck, jeder Kristall gibt eine dazu. Damit
       sind Kristalle zum ersten Mal ein Teil des Spiels und nicht nur eine
       Zahl in der Anzeige. */
    /* =================================================== JET-SCHUB
       Der Dash war ein Impuls: 0,16 s lang Tempo 38, drei Ladungen, und
       danach war er weg. Ein Jet ist etwas anderes - man haelt ihn, er
       schiebt, solange Treibstoff da ist, und er hebt.

       Der Vertikalanteil ist der eigentliche Punkt. Ein waagerechter
       Schub haette nur den Dash verlaengert; erst der Auftrieb macht aus
       der Faehigkeit ein Werkzeug fuer HOEHE, und darauf ist das
       vertikale Level gebaut.

       JET_SCHUB_V liegt ueber der Fallbeschleunigung (GRAV_DOWN 64), also
       bleibt netto Auftrieb. JET_STEIG_MAX deckelt ihn: ohne Deckel waere
       es Fliegen, mit Deckel ist es ein Sprung, den man verlaengern kann.

       Die Zahlen sind gemessen, nicht geraten - siehe tools/jet.js. */
    JET_SCHUB_H: 95,          /* waagerechter Schub, m/s^2 */
    /* Schub und Tank haengen zusammen und sind gemeinsam gemessen. Mit
       dem grossen Tank und dem alten Schub von 142 stieg der Jet 40,9 m
       und flog 127 - damit ist jede Stufengeometrie belanglos, man
       kommt ueberall hin. Bei 112 sind es 27,9 m und 99, und das passt
       zu Stufen von 9 bis 16 Metern: genug Reserve, dass sie gelingen,
       zu wenig, dass man sie ueberfliegen koennte. */
    JET_SCHUB_V: 108,         /* senkrechter Schub - netto +48 gegen 64 Fall */
    JET_MAX: 52,              /* Hoechsttempo unter Schub, ueber SPEED_CAP 46 */
    JET_STEIG_MAX: 22,        /* so schnell steigt man hoechstens */
    JET_V_NEIGUNG: 0.10,      /* wie stark volles Steuerkreuz den Auftrieb nimmt */
    JET_QUERBREMSE: 1.4,      /* Tempoverlust je Sekunde, wenn man nicht lenkt */
    JET_ABHEBEN: 7.0,         /* Stoss beim Zuenden am Boden */
    /* Der Tank reicht 1,05 s. Gemessen, nicht gesetzt: mit 0,63 s war
       das senkrechte Level auf jeder Stufe auf Messers Schneide - der
       Testpilot stand mit neun Prozent vor Stufen, die die Haelfte
       brauchten, und stuerzte auf allen drei Wegen. Mit 1,05 s faehrt
       der irre Weg sturzfrei durch. Die Sperre und das Nachfuellen sind
       mitgewachsen, der Rhythmus bleibt also derselbe: schieben,
       aufsetzen, laufen, wieder schieben. */
    TANK_VERBRAUCH: 0.95,     /* Anteil je Sekunde - voller Tank = 1,05 s */
    TANK_NACHFUELL: 0.72,     /* Anteil je Sekunde - voll nach 1,39 s */
    TANK_VERZUG: 0.30,        /* so lange nach dem Loslassen passiert nichts */
    TANK_MIN_START: 0.12,     /* darunter startet der Jet nicht neu */
    TANK_KRISTALL: 0.34,      /* soviel Tank gibt ein Kristall */

    /* Wandsprung: haelt das Tempo und lenkt es um, statt es zu stoppen. */
    WALL_JUMP_V: 14.5,
    WALL_PUSH: 13,
    WALL_KEEP: 0.86,
    WALL_COYOTE: 0.14,
    WALL_MIN_SPEED: 7,

    COYOTE: 0.10,
    BUFFER: 0.12,
    TURN_RATE: 16
  };

  /* Farbaufbau der Figur: kraeftiges Blau als Grundton, Gold als Akzent,
     ein dunkler Helmvisier-Block als Kontrast. Wenige, klar getrennte
     Farbflaechen lesen sich bei Tempo besser als viele kleine. */
  var MAT_BODY = root.MR.level.mat([0.07, 0.33, 0.72], [0.28, 0.66, 1.0], { emissive: 0.04 });
  var MAT_BODY2 = root.MR.level.mat([0.05, 0.22, 0.52], [0.16, 0.46, 0.84]);
  var MAT_TRIM = root.MR.level.mat([1.0, 0.76, 0.10], [1.0, 0.96, 0.58], { emissive: 0.22 });
  var MAT_SKIN = root.MR.level.mat([0.98, 0.80, 0.66], [1.0, 0.90, 0.78]);
  var MAT_HELM = root.MR.level.mat([0.90, 0.93, 1.0], [1.0, 1.0, 1.0], { emissive: 0.06 });
  var MAT_VISOR = root.MR.level.mat([0.03, 0.10, 0.22], [0.10, 0.42, 0.72], { emissive: 0.18 });
  var MAT_EYE = root.MR.level.mat([0.40, 0.95, 1.0], [0.85, 1.0, 1.0], { emissive: 1.0 });
  var MAT_PUPIL = root.MR.level.mat([0.05, 0.06, 0.12], [0.05, 0.06, 0.12]);
  var MAT_SCARF = root.MR.level.mat([0.92, 0.12, 0.30], [1.0, 0.46, 0.44], { emissive: 0.14 });
  var MAT_SHOE = root.MR.level.mat([0.10, 0.11, 0.18], [0.22, 0.24, 0.34]);
  var MAT_GLOW = root.MR.level.mat([1.0, 0.85, 0.20], [1.0, 1.0, 0.80], { emissive: 1.2 });

  /* Gemeinsamer Matrix-Kratzblock fuers Zeichnen der Figur. */
  var SCRATCH_M = new Float32Array(16);

  function create(level) {
    var p = {
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      radius: P.RADIUS,
      height: P.HEIGHT,
      yaw: 0,
      grounded: false,
      groundCollider: null,
      coyote: 0,
      buffer: 0,
      jumps: 2,
      tank: 1,                  /* Treibstoff, 0 bis 1 */
      tankVerzug: 0,            /* Wartezeit bis zum Nachfuellen */
      jetAn: false,             /* lief der Jet im letzten Schritt? */
      jetZeit: 0,               /* wie lange am Stueck - fuer Effekte */
      dashCooldown: 0,
      sliding: false,
      slideTime: 0,
      wallCoyote: 0,
      wallNX: 0,
      wallNZ: 0,
      lastGroundX: 0, lastGroundY: 0, lastGroundZ: 0,
      topSpeed: 0,
      dashDirX: 0,
      dashDirZ: 1,
      boostTimer: 0,
      boostCap: 0,
      squash: 1,
      lean: 0,
      runCycle: 0,
      airTime: 0,
      alive: true,
      speed: 0,
      platVX: 0,
      platVZ: 0,
      contact: Physics.makeContact(),
      events: []
    };

    var hit = Physics.makeHit();

    p.spawnAt = function (cp) {
      this.x = cp.x;
      this.y = cp.y + this.height * 0.5 + 0.05;
      this.z = cp.z;
      this.vx = this.vy = this.vz = 0;
      this.yaw = cp.yaw || 0;
      this.grounded = false;
      this.groundCollider = null;
      this.coyote = 0;
      this.buffer = 0;
      this.jumps = 2;
      this.tank = 1;
      this.tankVerzug = 0;
      this.jetAn = false;
      this.jetZeit = 0;
      this.dashCooldown = 0;
      this.sliding = false;
      this.slideTime = 0;
      this.wallCoyote = 0;
      this.topSpeed = 0;
      this.lastGroundX = this.x; this.lastGroundY = this.y; this.lastGroundZ = this.z;
      this.boostTimer = 0;
      this.squash = 1;
      this.lean = 0;
      this.airTime = 0;
      this.alive = true;
      this.floatUp = false;
      this.speed = 0;
    };

    /* Ein fester Simulationsschritt. wish = Wunschrichtung in Weltkoordinaten. */
    p.step = function (dt, cmd) {
      var ev = this.events;

      /* Mitnahme durch bewegliche Plattformen */
      var g = this.groundCollider;
      if (g && g.dynamic) {
        var dx = g.x - g.px, dy = g.y - g.py, dz = g.z - g.pz;
        var dyaw = g.yaw - g.pyaw;
        if (Math.abs(dyaw) > 1e-6) {
          var rx = this.x - g.px, rz = this.z - g.pz;
          var c2 = Math.cos(dyaw), s2 = Math.sin(dyaw);
          this.x = g.x + (c2 * rx + s2 * rz) - dx;
          this.z = g.z + (-s2 * rx + c2 * rz) - dz;
          var nvx = c2 * this.vx + s2 * this.vz;
          this.vz = -s2 * this.vx + c2 * this.vz;
          this.vx = nvx;
          this.yaw += dyaw;
        }
        this.x += dx; this.y += dy; this.z += dz;
        this.platVX = dt > 0 ? dx / dt : 0;
        this.platVZ = dt > 0 ? dz / dt : 0;
      } else {
        this.platVX *= 0.85;
        this.platVZ *= 0.85;
      }

      if (this.wallCoyote > 0) this.wallCoyote -= dt;
      if (this.boostTimer > 0) this.boostTimer -= dt;
      if (this.coyote > 0) this.coyote -= dt;
      if (this.buffer > 0) this.buffer -= dt;

      var wishX = cmd.wishX, wishZ = cmd.wishZ;
      var wishLen = Math.hypot(wishX, wishZ);
      var spNow = Math.hypot(this.vx, this.vz);

      /* Rutschen: nur am Boden und nur mit Tempo. Wer steht, rutscht nicht -
         sonst waere die Taste ein Dauerzustand ohne Entscheidung. */
      var wantSlide = !!cmd.slide;
      this.sliding = wantSlide && this.grounded && spNow > P.SLIDE_MIN_SPEED;
      /* Die Ermuedung baut sich im Rutschen auf und nur langsam wieder ab -
         sonst koennte man sie mit kurzem Loslassen zuruecksetzen. */
      if (this.sliding) this.slideTime += dt;
      else this.slideTime = Math.max(0, this.slideTime - dt * P.SLIDE_RECOVER);

      var targetSpeed = P.RUN * (wishLen > 0.01 ? Math.min(1, wishLen) : 0);

      /* ======================================================= JET-SCHUB
         Gehalten, nicht gedrueckt. `cmd.jet` ist ein Zustand, kein
         Ereignis - das ist der ganze Unterschied zum alten Dash.

         TANK_MIN_START verhindert das Stottern: mit einem fast leeren
         Tank laesst sich der Jet nicht neu zuenden, ein laufender Schub
         darf ihn aber bis auf null aufbrauchen. Ohne diese Schwelle
         konnte man durch Klopfen auf die Taste endlos kleine Schuebe
         herausholen, und der Tank waere bedeutungslos gewesen. */
      var jetWunsch = !!(cmd.jet !== undefined ? cmd.jet : cmd.dash);
      var jetLaeuft = jetWunsch && this.tank > (this.jetAn ? 0 : P.TANK_MIN_START);

      if (jetLaeuft) {
        if (!this.jetAn) {
          this.jetAn = true; this.jetZeit = 0;
          /* Abhebestoss. Ohne ihn hob der Jet vom Boden ueberhaupt nicht
             ab: der Schub baut je Schritt nur 0,9 m/s Steigen auf, das
             bleibt innerhalb der Bodentoleranz und wird wieder auf null
             gesetzt - gemessene Steighoehe 0,5 m, obwohl rechnerisch
             viereinhalb Meter drinstecken. Ein Sprung funktioniert, weil
             er 15,5 in einem Schlag setzt. Der Jet bekommt denselben
             Kniff, nur kleiner: gerade genug, um den Boden zu verlassen,
             danach traegt der Dauerschub. */
          if (this.grounded || this.coyote > 0) {
            this.vy = Math.max(this.vy, P.JET_ABHEBEN);
            this.coyote = 0;
          }
          ev.push('jetstart');
        }
        this.jetZeit += dt;
        this.tank = Math.max(0, this.tank - P.TANK_VERBRAUCH * dt);
        this.tankVerzug = P.TANK_VERZUG;

        /* Waagerecht: beschleunigen, nicht setzen. Ein gesetztes Tempo
           faehlt sich nach Teleport an; eine Beschleunigung laesst sich
           lenken, und genau das war die Vorgabe. */
        /* Waagerechter Schub NUR bei Richtungseingabe. Vorher schob der
           Jet immer in Blickrichtung, auch mit losgelassenem Steuerkreuz -
           damit war "nur steigen" unmoeglich, und ein Steigtest mass in
           Wahrheit einen Vorwaertsschub ueber flachen Boden (gemessene
           Steighoehe 0,5 m).

           Jetzt entscheidet die Hand: Steuerkreuz los = reiner Auftrieb,
           Steuerkreuz gedrueckt = Vortrieb in diese Richtung. Das ist die
           Trennung, auf der das vertikale Level steht. */
        var schubH = M.clamp(wishLen, 0, 1);

        /* Wer nicht lenkt, verliert Tempo.

           Ohne diese Zeilen war halbes Steuerkreuz die beste Strategie:
           gemessen 95 m Weite gegen 34 m bei vollem Schub, weil viel
           Auftrieb lange Flugzeit bedeutet und das Anlauftempo in der
           Luft fast nicht verfaellt. Man sammelte Hoehe, ohne fuer das
           Tempo zu bezahlen. Am Keyboard gibt es aber nur 0 oder 1 - der
           Trick waere also ein reiner Gamepad-Vorteil gewesen, und das
           ist kein Koennen.

           Jetzt bremst die Duese quer zu ihrer Richtung: zeigt sie nach
           unten, schiebt nichts mehr nach vorn und das Tempo faellt. Man
           kann Hoehe oder Weite kaufen, nie beides mit derselben
           Tankfuellung.

           Die Staerke ist gemessen und nicht gewaehlt. Bei 4,4 je Sekunde
           blieben nach einem vollen Steigflug 6 Prozent des Anlauftempos
           uebrig - in einem senkrechten Level, in dem man staendig
           steigt, lief man damit die ganze Strecke im Schritt. Bei 1,4
           sind es 41 Prozent, und der Trick, gegen den die Bremse
           ueberhaupt da ist, bringt immer noch nichts: erst vor, dann
           hoch kommt auf 59 m, reiner Vortrieb auf 58.

           Die Neigung ist mit 0,10 nur noch ein Wink, kein Riegel. Zwei Gruende, beide gemessen.

           Erstens die Fairness: bei 0,58 war halbes Steuerkreuz 23
           Prozent weiter als volles - ein Vorteil, den es nur am Gamepad
           gibt, denn die Tastatur kennt nur 0 und 1. Bei 0,28 ist der
           Unterschied ein Prozent, also Rauschen.

           Zweitens, und wichtiger: eine starke Neigung deckelt das
           Steigen mit gehaltenem Steuerkreuz auf 20,4 m/s. Damit wird
           SCHRAEGES Fliegen - Hoehe und Weite zugleich - praktisch
           unmoeglich, und genau darauf beruht ein senkrechtes Level. Der
           Testpilot blieb an jeder schraegen Stufe drei Meter unter der
           Kante, gleich ob sie neun oder siebzehn Meter mass.

           Der Rest der Begruendung ist Rechnung: bei einer Neigung von
           0,28 blieben mit gehaltenem Steuerkreuz netto 2,6 m/s^2
           Steigbeschleunigung uebrig (112 mal 0,72 gegen 78 Schwerkraft).
           Damit steigt nichts mehr in der kurzen Zeit, die ein Sprung
           dauert, und jede schraege Stufe wurde unpassierbar. Bei 0,10
           sind es 19 m/s^2 - der Jet hebt, egal wohin man lenkt.

           Begrenzt wird er deshalb durch den TANK und nur durch ihn:
           eine Sekunde Schub, dann ist Schluss. Eine Ressource, die der
           Spieler frei einteilt, ist eine Entscheidung; zwei, die sich
           gegenseitig zuschnueren, sind nur eine Bevormundung. */
        var quer = Math.exp(-P.JET_QUERBREMSE * (1 - schubH) * dt);
        this.vx *= quer; this.vz *= quer;

        if (schubH > 0.05) {
          var jx = wishX / wishLen, jz = wishZ / wishLen;
          this.vx += jx * P.JET_SCHUB_H * schubH * dt;
          this.vz += jz * P.JET_SCHUB_H * schubH * dt;
          this.yaw = Math.atan2(jx, jz);
        }
        var jsp = Math.hypot(this.vx, this.vz);
        if (jsp > P.JET_MAX) { this.vx *= P.JET_MAX / jsp; this.vz *= P.JET_MAX / jsp; }

        /* Senkrecht - und hier steckt die eigentliche Entscheidung.

           Der erste Ansatz liess den Auftrieb mit der ZEIT abklingen.
           Gemessen fuehrte das in eine Sackgasse: mit starker Kippkurve
           blieben 3,2 m Steighoehe (unbrauchbar fuer ein vertikales
           Level), ohne sie 28 m Steigen, aber 133 m Sprungweite (die
           groesste Luecke im Spiel misst 48). Reichweite und Hoehe hingen
           beide am selben Regler, weil man mit gedruecktem Steuerkreuz
           BEIDES voll bekam.

           Jetzt teilt die RICHTUNG den Schub auf, nicht die Uhr:

             Steuerkreuz los      -> voller Auftrieb, man steigt
             Steuerkreuz halb     -> Schraege, beides zur Haelfte
             Steuerkreuz voll     -> Vortrieb, kaum Auftrieb

           Der Spieler zielt den Jet also selbst, und er kann Hoehe und
           Weite nicht gleichzeitig maximal haben. Das ist die
           Entscheidung, die das Koennen ausmacht - und sie liegt in der
           Hand, nicht in einem Zeitgeber. */
        var vertAnteil = 1 - P.JET_V_NEIGUNG * schubH;
        if (this.vy < P.JET_STEIG_MAX * vertAnteil) {
          this.vy = Math.min(P.JET_STEIG_MAX * vertAnteil,
                             this.vy + P.JET_SCHUB_V * vertAnteil * dt);
        }

        /* Der Zerfall weiter unten zieht alles ueber RUN herunter. Ohne
           diese Ausnahme arbeitete er gegen den eigenen Schub. */
        this.boostCap = P.JET_MAX;
        this.boostTimer = Math.max(this.boostTimer, 0.08);
        /* Kein Ereignis je Schritt. Die Simulation laeuft mit 120 Hz, das
           waeren 120 Meldungen je Sekunde fuer einen Zustand, der ohnehin
           in jetAn steht - und bis zu acht Flammenstoesse in einem
           einzigen Bild. Was dauernd brennt, liest die Anzeige direkt aus
           jetAn ab; gemeldet werden nur Zuenden und Verloeschen. */
        if (this.tank <= 0) { ev.push('tankleer'); }
      } else {
        if (this.jetAn) { this.jetAn = false; ev.push('jetstop'); }
        if (this.tankVerzug > 0) this.tankVerzug -= dt;
        else if (this.tank < 1) this.tank = Math.min(1, this.tank + P.TANK_NACHFUELL * dt);
      }

      /* Der Laufcode stand frueher im else-Zweig des Dash. Der Jet
         ersetzt den Dash nicht, er laeuft ZUSAETZLICH - man kann
         waehrend des Schubs weiter lenken. Deshalb hier nur noch ein
         Block ohne Bedingung. */
      {
        /* ------------------------------------------------- Laufen / Lenken */
        var accel = this.sliding ? P.ACCEL_SLIDE : (this.grounded ? P.ACCEL_GROUND : P.ACCEL_AIR);
        if (wishLen > 0.01) {
          /* Beschleunigt wird nur bis zur Wunschgeschwindigkeit in
             Laufrichtung: so bleibt Schwung aus Dash oder Tempofeld erhalten,
             statt sich aufzuschaukeln. */
          var dirX = wishX / wishLen, dirZ = wishZ / wishLen;
          var cur = this.vx * dirX + this.vz * dirZ;
          var add = targetSpeed - cur;
          if (add > 0) {
            var acc = Math.min(accel * dt, add);
            this.vx += dirX * acc;
            this.vz += dirZ * acc;
          }
          /* Quer zur Laufrichtung wird abgebaut - am Boden hart (der Wechsel
             sitzt sofort), in der Luft sanft (Schwung bleibt). */
          var damp = this.sliding ? P.TURN_DAMP_SLIDE : (this.grounded ? P.TURN_DAMP_GROUND : P.TURN_DAMP_AIR);
          var k = 1 - Math.exp(-damp * dt);
          this.vx -= (this.vx - dirX * cur) * k;
          this.vz -= (this.vz - dirZ * cur) * k;
        } else {
          /* Nichts gedrueckt: am Boden zackig stehenbleiben. */
          var sp0 = Math.hypot(this.vx, this.vz);
          if (sp0 > 0.001) {
            var fr = this.sliding ? P.FRICTION_SLIDE : (this.grounded ? P.FRICTION_GROUND : P.FRICTION_AIR);
            var drop = Math.min(sp0, fr * dt);
            this.vx -= this.vx / sp0 * drop;
            this.vz -= this.vz / sp0 * drop;
          }
        }

        /* Hoechstgeschwindigkeit: Schwung darueber baut sich nur langsam ab. */
        var sp = Math.hypot(this.vx, this.vz);
        var cap = Math.max(targetSpeed, this.boostTimer > 0 ? this.boostCap : 0);
        if (sp > cap && sp > 0.001) {
          var decay = (this.sliding ? (P.OVER_DECAY_SLIDE + this.slideTime * P.SLIDE_FADE)
                       : (this.grounded ? P.OVER_DECAY_GROUND : P.OVER_DECAY_AIR)) * dt;
          var target = Math.max(cap, sp - decay);
          this.vx *= target / sp;
          this.vz *= target / sp;
        }
      }

      /* ---------------------------------------------------------- Sprung */
      if (cmd.jumpPressed) this.buffer = P.BUFFER;
      if (this.buffer > 0) {
        if (!this.grounded && this.coyote <= 0 && this.wallCoyote > 0) {
          /* ---------------------------------------------------- Wandsprung
             Die Wand nimmt nur den Anteil weg, der in sie hineingeht. Was
             an ihr entlanglaeuft, bleibt erhalten - deshalb ist eine Wand
             hier kein Hindernis, sondern eine Kurve, die man mit Tempo
             nimmt. */
          var wnx = this.wallNX, wnz = this.wallNZ;
          var into = this.vx * wnx + this.vz * wnz;
          var tvx = this.vx - wnx * into, tvz = this.vz - wnz * into;
          this.vx = tvx * P.WALL_KEEP + wnx * P.WALL_PUSH;
          this.vz = tvz * P.WALL_KEEP + wnz * P.WALL_PUSH;
          if (wishLen > 0.05) {
            /* Die Eingabe zieht die neue Richtung, ohne das Tempo zu aendern. */
            var wsp = Math.hypot(this.vx, this.vz);
            var mx = this.vx / (wsp || 1) * 0.62 + wishX / wishLen * 0.38;
            var mz = this.vz / (wsp || 1) * 0.62 + wishZ / wishLen * 0.38;
            var ml = Math.hypot(mx, mz) || 1;
            this.vx = mx / ml * wsp;
            this.vz = mz / ml * wsp;
          }
          this.vy = P.WALL_JUMP_V;
          this.wallCoyote = 0;
          this.buffer = 0;
          this.jumps = 1;
          this.squash = 1.32;
          ev.push('walljump');
        } else if (this.grounded || this.coyote > 0) {
          this.vy = P.JUMP_V;
          this.vx += this.platVX * 0.85;
          this.vz += this.platVZ * 0.85;
          this.grounded = false;
          this.groundCollider = null;
          this.coyote = 0;
          this.buffer = 0;
          this.jumps = 1;
          this.squash = 1.35;
          /* Absprung aus dem Rutschen traegt weiter - aber nur bis zur
             Hoechstgeschwindigkeit. Ohne diese Grenze multiplizierte jeder
             Absprung das Tempo mit 1,06, und das kettete sich auf: gemessen
             auf ebenem Boden von 40 auf 52 in acht Sekunden, ohne Ende und
             ohne dass die Strecke etwas beitrug. Damit waere jede
             Routenentscheidung wirkungslos - wer einmal schnell ist, wird
             ueberall schneller. Unterhalb der Grenze bleibt der Bonus: er
             belohnt, Tempo zu HALTEN, nicht, es aus dem Nichts zu machen. */
          if (this.sliding) {
            var spJump = Math.hypot(this.vx, this.vz);
            if (spJump > 0.01 && spJump < P.SPEED_CAP) {
              var zielJump = Math.min(P.SPEED_CAP, spJump * P.SLIDE_JUMP_KEEP);
              this.vx *= zielJump / spJump;
              this.vz *= zielJump / spJump;
              ev.push('slidejump');
            }
          }
          ev.push('jump');
        } else if (this.jumps > 0) {
          this.vy = P.DJUMP_V;
          this.jumps = 0;
          this.buffer = 0;
          this.squash = 1.3;
          if (wishLen > 0.05) {
            var sp2 = Math.max(Math.hypot(this.vx, this.vz), P.RUN * 0.8);
            this.vx = wishX / wishLen * sp2;
            this.vz = wishZ / wishLen * sp2;
          }
          ev.push('doublejump');
        }
      }

      /* -------------------------------------------------------- Schwerkraft

         Sie wirkt auch unter Schub. Der Dash setzte sie frueher aus, der
         Jet nicht: JET_SCHUB_V ist mit 142 gegen die 64 der Schwerkraft
         gerechnet, netto also +78. Wer die Duese aussetzen laesst, nimmt
         dem Fallen sein Gewicht - und ohne Gewicht fuehlt sich kein
         Steigen nach Leistung an. */
      var grav;
      if (this.vy > 0) grav = (cmd.jumpHeld || this.floatUp) ? P.GRAV_HOLD : P.GRAV_UP;
      else { grav = P.GRAV_DOWN; this.floatUp = false; }
      this.vy -= grav * dt;
      if (this.vy < -P.MAX_FALL) this.vy = -P.MAX_FALL;

      /* ------------------------------------------------ Bewegung + Kollision */
      var wasGrounded = this.grounded;
      var moveX = this.vx * dt, moveY = this.vy * dt, moveZ = this.vz * dt;
      var dist = Math.hypot(moveX, moveY, moveZ);
      var steps = Math.max(1, Math.ceil(dist / 0.3));
      var contact = this.contact;
      var grounded = false;
      var ground = null;
      var landing = 0;

      for (var s = 0; s < steps; s++) {
        this.x += moveX / steps;
        this.y += moveY / steps;
        this.z += moveZ / steps;
        Physics.resolveCapsule(level.world, this, contact);
        if (contact.grounded) { grounded = true; ground = contact.ground; }
        if (contact.landingImpact > landing) landing = contact.landingImpact;
        for (var h = 0; h < contact.hits.length; h++) {
          var c = contact.hits[h];
          if (c.tag === 'hazard') { ev.push('hazard'); }
          else if (c.tag === 'bounce' && this.vy <= 0.5) {
            this.vy = c.power;
            this.floatUp = true;   /* volle Hoehe, auch ohne gehaltene Taste */
            this.jumps = 1;
            this.tank = Math.max(this.tank, 0.5);
            this.squash = 1.5;
            grounded = false;
            ground = null;
            ev.push('bounce');
          } else if (c.tag === 'boost' && contact.grounded) {
            var cur = this.vx * c.boostDirX + this.vz * c.boostDirZ;
            if (cur < c.boostSpeed) {
              this.vx = c.boostDirX * c.boostSpeed;
              this.vz = c.boostDirZ * c.boostSpeed;
              this.boostCap = c.boostSpeed;
              this.boostTimer = 0.8;
              if (this.boostFlash === undefined || root.performance.now() - this.boostFlash > 400) {
                this.boostFlash = root.performance.now();
                ev.push('boost');
              }
            }
          }
        }
      }

      /* Wandkontakt fuer den Wandsprung merken, mit kurzer Nachfrist. */
      if (!grounded && contact.wall && Math.hypot(this.vx, this.vz) > P.WALL_MIN_SPEED) {
        this.wallNX = contact.wallNx;
        this.wallNZ = contact.wallNz;
        this.wallCoyote = P.WALL_COYOTE;
      }

      this.grounded = grounded;
      this.groundCollider = ground;

      if (grounded) {
        this.coyote = P.COYOTE;
        this.jumps = 2;
        this.wallCoyote = 0;
        if (!wasGrounded) {
          this.squash = Math.max(0.55, 1 - Math.min(0.45, landing / 60));
          /* ------------------------------------------- Hoehe wird Tempo
             Wer mit gedrueckter Rutschtaste aufkommt, rechnet einen Teil
             seiner Fallgeschwindigkeit in Vortrieb um. Damit zahlt jeder
             Meter Hoehe spaeter Tempo aus, und der hohe Weg lohnt sich aus
             sich selbst heraus - ohne dass irgendwo eine Punktzahl
             hochzaehlt. Ohne Rutschtaste verpufft der Schwung wie vorher. */
          if (wantSlide && landing > P.SLIDE_LAND_MIN) {
            var spL = Math.hypot(this.vx, this.vz);
            /* ---------------------------------------------- Rauschgrenze
               Ein grosser Sturz darf kurz ueber die Hoechstgeschwindigkeit
               hinaus. Der Grund ist gemessen: im ganzen Lauf lag das Tempo
               bei 36 bis 40 und beruehrte den Deckel von 46 genau zweimal
               - der Lauf war durchgehend schnell und deshalb ohne jede
               Dynamik. Eine Belohnung, die man nicht sieht, ist keine.

               Ab Aufprall 36 (also rund zehn Metern Fall) steigt die
               Grenze fuer 1,6 s auf RAUSCH_CAP. Sie ist ausschliesslich
               durch Koennen zu bekommen: man muss hoch gewesen sein UND
               die Rutschtaste im richtigen Moment halten. Das ist kein
               Tempofeld, das ist die Kernmechanik mit sichtbarem Ertrag.

               Danach faellt das Tempo mit dem normalen Zerfall auf 46
               zurueck - der Rausch verpufft, wenn man ihn nicht in
               Strecke umsetzt. */
            var gross = landing > P.RAUSCH_MIN;
            if (gross) {
              this.boostCap = P.RAUSCH_CAP;
              this.boostTimer = P.RAUSCH_ZEIT;
            }
            var deckel = gross ? P.RAUSCH_CAP : P.SPEED_CAP;
            var want = Math.min(deckel, spL + landing * P.SLIDE_LAND_GAIN);
            if (want > spL) {
              if (spL > 0.5) {
                this.vx *= want / spL;
                this.vz *= want / spL;
              } else {
                this.vx = Math.sin(this.yaw) * want;
                this.vz = Math.cos(this.yaw) * want;
              }
              this.sliding = true;
              /* Der Sturz macht das Rutschen wieder frisch. */
              this.slideTime = 0;
              ev.push('slideland');
            }
          }
          if (landing > 8) ev.push(landing > 26 ? 'land_hard' : 'land');
          this.airTime = 0;
        }
        this.lastGroundX = this.x; this.lastGroundY = this.y; this.lastGroundZ = this.z;
      } else {
        this.airTime += dt;
      }

      /* Ausrichtung, Neigung und Squash rein optisch */
      this.speed = Math.hypot(this.vx, this.vz);
      if (this.speed > this.topSpeed) this.topSpeed = this.speed;
      if (this.speed > 0.6) {
        this.yaw = M.angleToward(this.yaw, Math.atan2(this.vx, this.vz), P.TURN_RATE * dt);
      }
      var leanTarget = Math.min(0.32, this.speed / 26 * 0.22) * (this.grounded ? 1 : 0.4);
      this.lean = M.damp(this.lean, leanTarget, 9, dt);
      this.squash = M.damp(this.squash, 1, 11, dt);
      if (this.grounded) this.runCycle += this.speed * dt * 1.5;
      else this.runCycle += dt * 3;
      return ev;
    };

    /* Ein Kristall ist Treibstoff. Damit sind Kristalle keine Zahl mehr,
       sondern das, was die Abkuerzung ueberhaupt bezahlt: wer sie
       mitnimmt, kann frueher wieder zuenden. Ein Kristall fuellt einen
       Drittel-Tank und setzt die Sperrzeit zurueck, sonst laege die
       Belohnung 0,3 s in der Zukunft und waere im Flug nicht zu spueren. */
    p.tankFuellen = function (anteil) {
      this.tank = Math.min(1, this.tank + (anteil || P.TANK_KRISTALL));
      this.tankVerzug = 0;
    };

    /* Figur zeichnen: ein paar Grundkoerper mit Lauf- und Sprungpose.

       Die Matrix ist ein Kratzblock auf Modulebene, kein neues Array je
       Aufruf. Gezeichnet wird pro Bild zweimal (Figur und Geist), das
       waren 2 x 64 Byte je Bild fuer nichts. Ein gemeinsamer Block ist
       hier gefahrlos: es wird in einem Faden gezeichnet und render ruft
       sich nicht selbst auf. */
    p.render = function (batch, glass, t, opts) {
      var m = SCRATCH_M;
      var sq = this.squash;
      var st = 1 / Math.max(0.35, sq);
      var bx = this.x, bz = this.z;
      var footY = this.y - this.height * 0.5;
      var yaw = this.yaw;
      var lean = this.lean;
      var run = this.grounded ? Math.sin(this.runCycle * 2.4) : 0.4;
      var runB = this.grounded ? Math.cos(this.runCycle * 2.4) : -0.2;
      var fx = Math.sin(yaw), fz = Math.cos(yaw);
      var rx = Math.cos(yaw), rz = -Math.sin(yaw);
      var alpha = opts && opts.alpha !== undefined ? opts.alpha : 1;
      var body = opts && opts.mat ? opts.mat : MAT_BODY;

      function put(mesh, ox, oy, oz, sx, sy, sz, material, pitch, roll) {
        var wx = bx + rx * ox + fx * oz;
        var wz = bz + rz * ox + fz * oz;
        m4.compose(m, wx, footY + oy, wz, (pitch || 0) + lean, yaw, roll || 0, sx, sy, sz);
        if (alpha < 1) {
          glass.add(mesh, m, {
            color: material.color, accent: material.accent, emissive: material.emissive,
            pattern: 0, patternScale: 1, alpha: alpha
          });
        } else {
          batch.add(mesh, m, material);
        }
      }

      /* ------------------------------------------------- Haltung nach Lage
         Statt einer Laufschleife fuer alles bekommt jede Lage eine eigene
         Haltung, zwischen denen weich geblendet wird: stehen, laufen,
         steigen, fallen, Dash. Ohne das sieht jede Lage gleich aus und die
         Figur wirkt wie eine Puppe an einem Faden. */
      var sp01 = Math.min(1, this.speed / 30);          /* 0 .. 1 Tempo */
      var dashing = this.jetAn ? 1 : 0;
      var rising = !this.grounded && this.vy > 1 ? 1 : 0;
      var falling = !this.grounded && this.vy < -1 ? Math.min(1, -this.vy / 22) : 0;
      var idle = this.grounded ? 1 - Math.min(1, this.speed / 3.5) : 0;
      var breath = Math.sin(t * 2.2) * 0.02 * idle;           /* Atmen im Stand */
      var bob = this.grounded ? Math.abs(Math.sin(this.runCycle * 2.4)) * 0.07 * sp01 : 0;
      var gait = this.grounded ? sp01 : 0;

      /* Arm- und Beinwinkel je Lage */
      var legF = run * (0.5 + gait * 0.9);                    /* Schrittweite */
      var armF = runB * (0.5 + gait * 1.0);
      if (rising) { legF = -0.5; armF = -1.0; }               /* Beine an, Arme hoch */
      if (falling) { legF = 0.35 * falling; armF = 0.85 * falling; }
      if (dashing) { legF = -0.8; armF = 1.5; }               /* gestreckt nach hinten */

      var tilt = lean;                                         /* wird von put() addiert */

      /* -------------------------------------------------------- Beine */
      put('blob', -0.21, 0.09 * sq, legF * 0.32, 0.32, 0.22, 0.44, MAT_SHOE, -legF * 0.5);
      put('blob', 0.21, 0.09 * sq, -legF * 0.32, 0.32, 0.22, 0.44, MAT_SHOE, legF * 0.5);
      put('pillar', -0.21, 0.40 * sq, legF * 0.18, 0.28, 0.66 * sq, 0.28, MAT_BODY2, -legF * 0.9);
      put('pillar', 0.21, 0.40 * sq, -legF * 0.18, 0.28, 0.66 * sq, 0.28, MAT_BODY2, legF * 0.9);

      /* -------------------------------------------------------- Rumpf */
      var torso = (0.98 + breath) * sq;
      put('blob', 0, (1.02 + bob) * sq, 0, 0.84 * st, 0.98 * torso, 0.70 * st, body);
      /* Brustplatte und Guertel geben der Silhouette eine klare Mitte. */
      put('blob', 0, (1.22 + bob) * sq, 0.24, 0.40 * st, 0.30 * sq, 0.22 * st, MAT_TRIM);
      put('blob', 0, (0.70 + bob) * sq, 0, 0.78 * st, 0.20 * sq, 0.64 * st, MAT_BODY2);
      /* Ruecken-Modul: gibt der Figur von hinten - der Standardsicht -
         ueberhaupt eine Form. */
      put('blob', 0, (1.12 + bob) * sq, -0.32, 0.54 * st, 0.58 * sq, 0.28 * st, MAT_BODY2);
      put('sphere', -0.16, (1.12 + bob) * sq, -0.42, 0.14, 0.14, 0.14, MAT_GLOW);
      put('sphere', 0.16, (1.12 + bob) * sq, -0.42, 0.14, 0.14, 0.14, MAT_GLOW);

      /* --------------------------------------------------------- Arme */
      put('blob', -0.48 * st, (1.34 + bob) * sq, 0, 0.30, 0.30, 0.30, body);
      put('blob', 0.48 * st, (1.34 + bob) * sq, 0, 0.30, 0.30, 0.30, body);
      put('pillar', -0.50 * st, (1.04 + bob) * sq, -armF * 0.28, 0.22, 0.62, 0.24, MAT_BODY2, armF * 1.1);
      put('pillar', 0.50 * st, (1.04 + bob) * sq, armF * 0.28, 0.22, 0.62, 0.24, MAT_BODY2, -armF * 1.1);
      put('blob', -0.52 * st, (0.74 + bob) * sq, -armF * 0.52, 0.23, 0.22, 0.23, MAT_HELM, armF * 1.1);
      put('blob', 0.52 * st, (0.74 + bob) * sq, armF * 0.52, 0.23, 0.22, 0.23, MAT_HELM, -armF * 1.1);

      /* --------------------------------------------------------- Kopf
         Helm statt nacktem Kopf: eine geschlossene helle Kugel mit dunklem
         Visier. Das gibt eine eindeutige Silhouette und eine Blickrichtung,
         die man auch von hinten erkennt. */
      var headY = (1.74 + bob + breath * 2) * sq;
      var headTilt = falling * 0.25 - rising * 0.2 - dashing * 0.3;
      put('sphere', 0, headY, 0.01, 0.66 * st, 0.64 * sq, 0.64 * st, MAT_HELM, headTilt);
      put('blob', 0, headY + 0.02, 0.26, 0.54 * st, 0.34 * sq, 0.26 * st, MAT_VISOR, headTilt);
      put('sphere', -0.13, headY + 0.03, 0.34, 0.15, 0.17, 0.10, MAT_EYE, headTilt);
      put('sphere', 0.13, headY + 0.03, 0.34, 0.15, 0.17, 0.10, MAT_EYE, headTilt);
      /* Helmkamm in Akzentfarbe */
      put('prism', 0, headY + 0.28, -0.04, 0.15, 0.17, 0.52, MAT_TRIM, headTilt);
      /* Antenne mit leuchtender Kugel - kleines bewegtes Detail */
      var ant = Math.sin(t * 6 + this.speed * 0.3) * (0.08 + sp01 * 0.22);
      put('cylinder', 0.21, headY + 0.30, -0.16, 0.045, 0.30, 0.045, MAT_BODY2, ant * 0.6);
      put('sphere', 0.21 + ant * 0.16, headY + 0.47, -0.17, 0.13, 0.13, 0.13, MAT_GLOW);

      /* Schal weht mit dem Tempo */
      var flap = Math.sin(t * 14) * 0.1 + Math.min(0.9, this.speed / 30);
      put('blob', 0, (1.44 + bob) * sq, 0.02, 0.70 * st, 0.24, 0.58 * st, MAT_SCARF);
      put('box', 0, (1.30 + bob) * sq, -0.36 - flap * 0.45, 0.26, 0.16, 0.55 + flap * 1.3, MAT_SCARF, -0.7 - flap * 0.5);
      put('box', -0.16, (1.26 + bob) * sq, -0.30 - flap * 0.3, 0.18, 0.13, 0.40 + flap * 0.9, MAT_SCARF, -0.6 - flap * 0.4);

      /* Landering: seit es echten Sonnenschatten gibt, ist der Fleck unter
         der Figur kein Schatten mehr, sondern nur noch die Anzeige, wo man
         aufkommt - der Sonnenschatten liegt schraeg und beantwortet das
         nicht. Deshalb klein, blass und nur in der Luft deutlich. */
      if (opts && opts.shadow === false) return;
      if (Physics.raycast(level.world, this.x, this.y - this.height * 0.5 + 0.1, this.z, 0, -1, 0, 26, hit)) {
        var d = hit.t;
        var air = Math.min(1, Math.max(0, d - 0.6) / 3.0);
        if (air > 0.02) {
          var sc = 1.9 * (1 - Math.min(0.6, d / 26));
          m4.composeYaw(m, this.x, this.y - this.height * 0.5 + 0.1 - d + 0.06, this.z, 0, sc, 1, sc);
          glass.add('quad', m, {
            color: MAT.shadow.color, accent: MAT.shadow.color, emissive: 0,
            pattern: 7, patternScale: 1, alpha: 0.30 * air * (1 - Math.min(0.75, d / 26)) * alpha
          });
        }
      }
    };

    return p;
  }

  /* ------------------------------------------------------------- Kamera */

  function createCamera() {
    var cam = {
      yaw: 0,
      pitch: 0.22,
      dist: 8.2,
      distNow: 8.2,
      /* 72 Grad senkrecht. Bei 64 war der Ausschnitt so eng, dass
         Landepunkte schraeg unterhalb ausserhalb des Bildes lagen. */
      fov: 1.26,
      fovBase: 1.26,
      fovNow: 1.26,
      fovPunch: 0,          /* kurzer Stoss beim Zuenden */
      landPunch: 0,         /* kurzes Einfedern bei harter Landung */
      pos: new Float32Array(3),
      look: new Float32Array(3),
      target: new Float32Array(3),
      manualTimer: 0,
      leadX: 0,
      leadZ: 0,
      lookQX: 0,            /* noch nicht ausgegebene Umschau-Eingabe */
      lookQY: 0,
      shake: 0,
      view: m4.make(),
      proj: m4.make(),
      viewProj: m4.make(),
      invViewProj: m4.make()
    };
    var hit = Physics.makeHit();

    cam.snap = function (player) {
      this.yaw = player.yaw;
      this.target[0] = player.x;
      this.target[1] = player.y + 0.7;
      this.target[2] = player.z;
      this.distNow = this.dist;
      this.update(0.016, player, null, null, true);
    };

    cam.update = function (dt, player, input, world, instant) {
      /* Manuelle Steuerung hat Vorrang, danach richtet sich die Kamera
         langsam wieder hinter die Figur aus. */
      if (input) {
        var look = input.lookDelta();
        var ca = input.camAxis();
        var kx = ca.x * 2.6 * dt, ky = ca.y * 1.4 * dt;
        if (look.x || look.y || kx || ky) this.manualTimer = 0.9;
        this.lookQX += look.x + kx;
        this.lookQY += (look.y + ky) * P.LOOK_PITCH;
      }
      /* Aufgelaufene Eingabe anteilig abgeben statt in einem Ruck. */
      var take = Math.min(1, P.LOOK_SMOOTH * dt);
      var takeX = this.lookQX * take, takeY = this.lookQY * take;
      this.lookQX -= takeX;
      this.lookQY -= takeY;
      this.yaw += takeX;
      this.pitch += takeY;
      this.pitch = M.clamp(this.pitch, -0.55, 0.95);
      if (this.manualTimer > 0) this.manualTimer -= dt;

      var speed = Math.hypot(player.vx, player.vz);
      if (this.manualTimer <= 0 && speed > 5.5) {
        var want = Math.atan2(player.vx, player.vz);
        /* Bei Tempofeld oder Dash aendert sich die Richtung schlagartig.
           Mit der alten Deckelung auf 4,2 brauchte die Kamera dreiviertel
           Sekunden fuer eine Kehrtwende - solange lief die Figur aus dem
           Bild. */
        var rate = Math.min(speed > 24 ? 9.0 : 4.2, 0.9 + speed * 0.22);
        this.yaw = this.yaw + M.wrapAngle(want - this.yaw) * Math.min(1, rate * dt);
      }

      /* Bei Tempo etwas weiter weg, beim Fallen hoeher und mit Blick nach unten. */
      var fall = M.clamp(-player.vy / 26, 0, 1);
      /* Frueher stand hier DASH_SPEED. Die Konstante gibt es nicht mehr,
         seit der Dash weg ist - die Rechnung waere NaN geworden und haette
         das ganze Blickfeld mitgerissen. Bezug ist jetzt die normale
         Hoechstgeschwindigkeit; was der Jet darueber hinaus gibt, kommt
         als eigener Anteil dazu und ist damit als EXTRA zu sehen statt im
         Tempo unterzugehen. */
      var fast = M.clamp((speed - P.RUN * 0.9) / (P.SPEED_CAP - P.RUN), 0, 1);
      var schub = M.clamp((speed - P.SPEED_CAP) / (P.JET_MAX - P.SPEED_CAP), 0, 1);
      /* Steigen und Fallen sind in einem senkrechten Level der halbe
         Inhalt. Die Kamera muss deshalb mitteilen, wohin es geht: beim
         Steigen rueckt der Blick nach oben, beim Fallen nach unten. Der
         Anteil ist bewusst klein und traege - eine Kamera, die dem
         Steigen voll folgt, ist genau die Sorte, von der schlecht wird. */
      var steigen = M.clamp(player.vy / 26, 0, 1);
      var wantDist = this.dist + fast * 2.6 + fall * 1.4 + schub * 1.2;
      this.distNow = instant ? wantDist : M.damp(this.distNow, wantDist, 5, dt);

      /* Blickfeld: leicht weiter beim Sprint, deutlich beim Dash. */
      /* Tempo weitet das Sichtfeld: die Umgebung zieht sichtbar schneller
         vorbei, ohne dass die Figur kleiner wird. Der Stoss beim Dash klingt
         langsamer ab als vorher - bei 7 war er vorbei, bevor man ihn
         bemerkt hat. */
      var wantFov = this.fovBase + fast * 0.13 + (player.jetAn ? 0.11 : 0) + schub * 0.06;
      /* Beim Zuenden weitet sich das Bild schnell, beim Loslassen zieht es
         sich langsamer zusammen. Symmetrisch gedaempft fuehlte sich das
         Nachlassen wie ein zweiter Stoss an. */
      var fovRate = wantFov > this.fovNow ? 9 : 4.5;
      this.fovNow = instant ? wantFov : M.damp(this.fovNow, wantFov, fovRate, dt);
      this.fovPunch = M.damp(this.fovPunch, 0, 5.2, dt);
      this.fov = this.fovNow + this.fovPunch;
      this.landPunch = M.damp(this.landPunch, 0, 11, dt);

      /* Die Kamera bleibt beim Springen auf Kopfhoehe statt mitzuhuepfen:
         vertikal wird traeger gefolgt, solange die Figur in der Luft ist. */
      /* Vorausschau: bei Tempo rueckt der Blickpunkt in Bewegungsrichtung,
         damit man Hindernisse und Abzweige frueher sieht statt sie erst zu
         bemerken, wenn sie unter einem sind. Vorher waren es feste 0,09
         Sekunden Vorlauf - bei Sprinttempo knapp zwei Meter und damit
         praktisch nicht wahrnehmbar. */
      /* Vorausschau wirkt auf den BLICKpunkt, nicht auf den Umlaufpunkt.
         Wird der Umlaufpunkt vorgeschoben, rutscht die Figur nach hinten
         aus dem Bild - gemessen bei Tempofeldern, wo das Tempo schlagartig
         auf 36 springt. So bleibt sie im Bild und man sieht trotzdem
         frueher, was kommt. */
      var leadX = M.clamp(player.vx * (0.10 + fast * 0.16), -7.0, 7.0);
      var leadZ = M.clamp(player.vz * (0.10 + fast * 0.16), -7.0, 7.0);
      var tx = player.x + M.clamp(player.vx * 0.05, -1.2, 1.2);
      var ty = player.y + 0.75 + fall * 1.15 + steigen * 0.9 - this.landPunch * 0.7;
      var tz = player.z + M.clamp(player.vz * 0.05, -1.2, 1.2);
      var k = instant ? 1 : 1 - Math.exp(-18 * dt);
      /* Senkrecht wird in der Luft traeger gefolgt, damit die Kamera nicht
         mithuepft - bei 6 blieb sie bei hohen Doppelspruengen aber so weit
         zurueck, dass die Figur an den Bildrand geriet. */
      var ky = instant ? 1 : 1 - Math.exp(-(player.grounded ? 12 : 8.5) * dt);
      this.target[0] += (tx - this.target[0]) * k;
      this.target[1] += (ty - this.target[1]) * ky;
      this.target[2] += (tz - this.target[2]) * k;

      var pitch = this.pitch + fall * 0.12 - steigen * 0.16;
      var cp = Math.cos(pitch), sp = Math.sin(pitch);
      var dirX = Math.sin(this.yaw) * cp, dirZ = Math.cos(this.yaw) * cp, dirY = -sp;

      var dist = this.distNow;
      if (world) {
        /* Kamera nicht in den Fels schieben lassen. Naeher heran geht
           sofort, sonst steckt sie einen Moment in der Wand; wieder weg
           nur langsam. Wurde der Abstand in beide Richtungen hart gesetzt,
           sprang die Kamera um bis zu acht Meter, sobald der Strahl eine
           Kante nur streifte - das war das auffaelligste Rucken. */
        var ox = this.target[0], oy = this.target[1], oz = this.target[2];
        var h = Physics.raycast(world, ox, oy, oz, -dirX, -dirY, -dirZ, dist + 0.6, hit);
        var wantColl = h ? Math.max(2.0, h.t - 0.55) : dist;
        if (this.collDist === undefined || instant) this.collDist = wantColl;
        else if (wantColl < this.collDist) this.collDist = wantColl;
        else this.collDist = M.damp(this.collDist, wantColl, 4.0, dt);
        dist = Math.min(dist, this.collDist);
      }

      var shake = this.shake > 0 ? this.shake : 0;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.4);

      this.pos[0] = this.target[0] - dirX * dist + (Math.random() - 0.5) * shake;
      this.pos[1] = this.target[1] - dirY * dist + (Math.random() - 0.5) * shake;
      this.pos[2] = this.target[2] - dirZ * dist + (Math.random() - 0.5) * shake;
      /* Der Blickpunkt wandert weich nach vorn, sonst zuckt er bei jedem
         Tempowechsel. */
      var lk = instant ? 1 : 1 - Math.exp(-7 * dt);
      this.leadX += (leadX - this.leadX) * lk;
      this.leadZ += (leadZ - this.leadZ) * lk;
      /* Muss die Kamera wegen einer Wand dicht heran, schrumpft die
         Vorausschau mit. Aus zwei Metern Abstand wirft schon ein kleiner
         Versatz des Blickpunkts die Figur aus dem Bild - gemessen im engen
         Hoehlentunnel. */
      var tight = M.clamp(dist / Math.max(0.001, this.distNow), 0, 1);
      this.look[0] = this.target[0] + this.leadX * tight;
      this.look[1] = this.target[1] + 0.35 - fall * 0.5;
      this.look[2] = this.target[2] + this.leadZ * tight;
    };

    cam.buildMatrices = function (aspect) {
      /* Im Hochformat bleibt sonst nur ein schmaler Streifen Welt uebrig:
         dort wird das senkrechte Sichtfeld so geweitet, dass waagerecht
         genug zu sehen bleibt. */
      var fovy = this.fov;
      if (aspect < 1.4) {
        fovy = Math.max(fovy, Math.min(1.55, 2 * Math.atan(Math.tan(0.52) / Math.max(aspect, 0.42))));
      }
      m4.perspective(this.proj, fovy, aspect, 0.15, 900);
      m4.lookAt(this.view, this.pos, this.look, [0, 1, 0]);
      m4.multiply(this.viewProj, this.proj, this.view);
      m4.invert(this.invViewProj, this.viewProj);
      return this.viewProj;
    };

    /* Bewegungsrichtung aus Kamerawinkel und Eingabe. */
    cam.wish = function (ax, ay, out) {
      var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      out[0] = -Math.cos(this.yaw) * ax + fx * ay;
      out[1] = Math.sin(this.yaw) * ax + fz * ay;
      return out;
    };

    return cam;
  }

  root.MR = root.MR || {};
  root.MR.player = { create: create, createCamera: createCamera, TUNING: P };
})(window);
