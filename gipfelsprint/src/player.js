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
    /* Gedeckelt auf 46. Bei 58 (209 km/h) blieben auf 24 m Plattformabstand
       vier Zehntelsekunden je Plattform - schneller, als man im Rutschen
       lenken kann, und der Testpilot verfehlte reihenweise Landungen. Die
       Geometrie des Levels ist auf 25 bis 40 ausgelegt; 46 ist die Spitze,
       die man sich fuer einen grossen Sturz holt, nicht der Normalfall. */
    SLIDE_LAND_MAX: 46,
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
    DASH_SPEED: 38,
    DASH_TIME: 0.16,
    DASH_MAX: 3,

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
      dashCharge: 1,
      dashTimer: 0,
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
      this.dashCharge = 1;
      this.dashTimer = 0;
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

      /* ------------------------------------------------------------ Dash */
      if (cmd.dash && this.dashTimer <= 0 && this.dashCharge > 0) {
        var dx2 = wishLen > 0.05 ? wishX / wishLen : Math.sin(this.yaw);
        var dz2 = wishLen > 0.05 ? wishZ / wishLen : Math.cos(this.yaw);
        this.dashDirX = dx2;
        this.dashDirZ = dz2;
        this.dashTimer = P.DASH_TIME;
        this.dashCharge--;
        this.vy = Math.max(this.vy, 0);
        this.yaw = Math.atan2(dx2, dz2);
        ev.push('dash');
      }

      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        this.vx = this.dashDirX * P.DASH_SPEED;
        this.vz = this.dashDirZ * P.DASH_SPEED;
        this.vy = 0;                 /* waagerechter Schub, kein Absacken */
      } else {
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
          this.dashTimer = 0;
          this.wallCoyote = 0;
          this.buffer = 0;
          this.jumps = 1;
          this.squash = 1.32;
          ev.push('walljump');
        } else if (this.grounded || this.coyote > 0) {
          this.dashTimer = 0;          /* Sprung bricht den Dash ab, Tempo bleibt */
          this.vy = P.JUMP_V;
          this.vx += this.platVX * 0.85;
          this.vz += this.platVZ * 0.85;
          this.grounded = false;
          this.groundCollider = null;
          this.coyote = 0;
          this.buffer = 0;
          this.jumps = 1;
          this.squash = 1.35;
          /* Absprung aus dem Rutschen traegt etwas weiter - Rutschen ist
             damit nicht nur Tempo halten, sondern auch der bessere Absprung. */
          if (this.sliding) {
            this.vx *= P.SLIDE_JUMP_KEEP;
            this.vz *= P.SLIDE_JUMP_KEEP;
            ev.push('slidejump');
          }
          ev.push('jump');
        } else if (this.jumps > 0) {
          this.dashTimer = 0;
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

      /* -------------------------------------------------------- Schwerkraft */
      if (this.dashTimer <= 0) {
        var grav;
        if (this.vy > 0) grav = (cmd.jumpHeld || this.floatUp) ? P.GRAV_HOLD : P.GRAV_UP;
        else { grav = P.GRAV_DOWN; this.floatUp = false; }
        this.vy -= grav * dt;
        if (this.vy < -P.MAX_FALL) this.vy = -P.MAX_FALL;
      }

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
            this.dashCharge = 1;
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
        if (this.dashCharge < 1) this.dashCharge = 1;
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
            var want = Math.min(P.SLIDE_LAND_MAX, spL + landing * P.SLIDE_LAND_GAIN);
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

    /* Ein Kristall gibt eine Dash-Ladung. Damit sind Kristalle keine Zahl
       mehr, sondern der Treibstoff fuer die Abkuerzungen. */
    p.giveDash = function (n) {
      this.dashCharge = Math.min(P.DASH_MAX, this.dashCharge + (n || 1));
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
      var dashing = this.dashTimer > 0 ? 1 : 0;
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
      fovPunch: 0,          /* kurzer Stoss beim Dash */
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
      var fast = M.clamp((speed - P.RUN * 0.9) / (P.DASH_SPEED - P.RUN), 0, 1);
      var wantDist = this.dist + fast * 2.6 + fall * 1.4;
      this.distNow = instant ? wantDist : M.damp(this.distNow, wantDist, 5, dt);

      /* Blickfeld: leicht weiter beim Sprint, deutlich beim Dash. */
      /* Tempo weitet das Sichtfeld: die Umgebung zieht sichtbar schneller
         vorbei, ohne dass die Figur kleiner wird. Der Stoss beim Dash klingt
         langsamer ab als vorher - bei 7 war er vorbei, bevor man ihn
         bemerkt hat. */
      var wantFov = this.fovBase + fast * 0.13;
      this.fovNow = instant ? wantFov : M.damp(this.fovNow, wantFov, 6, dt);
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
      var ty = player.y + 0.75 + fall * 1.15 - this.landPunch * 0.7;
      var tz = player.z + M.clamp(player.vz * 0.05, -1.2, 1.2);
      var k = instant ? 1 : 1 - Math.exp(-18 * dt);
      /* Senkrecht wird in der Luft traeger gefolgt, damit die Kamera nicht
         mithuepft - bei 6 blieb sie bei hohen Doppelspruengen aber so weit
         zurueck, dass die Figur an den Bildrand geriet. */
      var ky = instant ? 1 : 1 - Math.exp(-(player.grounded ? 12 : 8.5) * dt);
      this.target[0] += (tx - this.target[0]) * k;
      this.target[1] += (ty - this.target[1]) * ky;
      this.target[2] += (tz - this.target[2]) * k;

      var pitch = this.pitch + fall * 0.12;
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
