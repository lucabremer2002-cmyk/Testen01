/*
 * Eingaben: Tastatur, Maus (Pointer-Lock) und Gamepad.
 * Der Rest des Spiels fragt nur noch logische Aktionen ab.
 */
(function (root) {
  'use strict';

  /* Ein Notebook mit Touchscreen soll nicht die Handy-Bedienung bekommen:
     es zaehlt der grobe Zeiger, nicht die blosse Faehigkeit. */
  var hasTouchEvents = ('ontouchstart' in root) || (root.navigator && root.navigator.maxTouchPoints > 0);
  var coarse = !!(root.matchMedia && (root.matchMedia('(pointer: coarse)').matches ||
                                      root.matchMedia('(hover: none)').matches));
  var isTouch = hasTouchEvents && coarse;

  function create(canvas) {
    var keys = Object.create(null);
    var pressed = Object.create(null);   /* seit dem letzten Frame neu gedrueckt */
    var mouse = { dx: 0, dy: 0, locked: false, sensitivity: 0.0014 };
    var listeners = [];

    /* Beruehrung: linke Bildhaelfte ist der Schiebeknopf, rechte dreht die
       Kamera. Die Schaltflaechen liegen als eigene Elemente darueber und
       bekommen ihre Ereignisse direkt. */
    var STICK_RADIUS = 58;
    var TOUCH_LOOK = 0.0023;   /* Wischen war zu zuckig - deutlich ruhiger */
    var stick = {
      moveId: null, ox: 0, oy: 0, mx: 0, my: 0,
      lookId: null, lx: 0, ly: 0, dx: 0, dy: 0
    };
    var virt = { jump: false, jet: false, jumpPressed: false, jetPressed: false };

    var MAP = {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA'],
      right: ['KeyD'],
      jump: ['Space'],
      jet: ['ControlLeft', 'ControlRight', 'KeyE', 'KeyJ'],
      sprint: ['ShiftLeft', 'ShiftRight'],
      camLeft: ['ArrowLeft', 'KeyQ'],
      camRight: ['ArrowRight'],
      restart: ['KeyR'],
      checkpoint: ['KeyK'],
      pause: ['Escape', 'KeyP'],
      mute: ['KeyM'],
      confirm: ['Enter', 'NumpadEnter']
    };

    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push([target, type, fn]);
    }

    on(root, 'keydown', function (e) {
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0 || e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      keys[e.code] = true;
      pressed[e.code] = true;
      if (typeof api.onKey === 'function') api.onKey(e.code, e);
    });

    on(root, 'keyup', function (e) { keys[e.code] = false; });
    on(root, 'blur', function () { for (var k in keys) keys[k] = false; });

    /* Ziehen mit gedrueckter Maustaste als Ersatz, wenn der Mauszeiger nicht
       eingefangen werden darf - etwa in einer eingebetteten Seite. */
    var drag = { on: false, x: 0, y: 0 };

    on(canvas, 'mousedown', function (e) {
      if (e.button === 0 && !mouse.locked && api.wantPointerLock) api.grabPointer();
      if (e.button === 0 || e.button === 2) {
        drag.on = true;
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
      if (e.button === 0) { keys.Mouse0 = true; pressed.Mouse0 = true; }
      if (e.button === 2) { keys.Mouse2 = true; pressed.Mouse2 = true; }
    });
    on(root, 'mouseup', function (e) {
      if (e.button === 0) keys.Mouse0 = false;
      if (e.button === 2) keys.Mouse2 = false;
      drag.on = false;
    });
    on(canvas, 'contextmenu', function (e) { e.preventDefault(); });

    on(root, 'mousemove', function (e) {
      if (mouse.locked) {
        mouse.dx += e.movementX || 0;
        mouse.dy += e.movementY || 0;
        return;
      }
      if (!drag.on) return;
      mouse.dx += (typeof e.movementX === 'number' ? e.movementX : e.clientX - drag.x);
      mouse.dy += (typeof e.movementY === 'number' ? e.movementY : e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
    });

    on(document, 'pointerlockchange', function () {
      mouse.locked = document.pointerLockElement === canvas;
      canvas.classList.toggle('locked', mouse.locked);
      if (typeof api.onPointerLock === 'function') api.onPointerLock(mouse.locked);
    });

    if (hasTouchEvents) {
      on(canvas, 'touchstart', function (e) {
        if (!api.isTouch && api.onFirstTouch) { api.isTouch = true; api.onFirstTouch(); }
        e.preventDefault();
        var half = root.innerWidth * 0.46;
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.clientX < half && stick.moveId === null) {
            stick.moveId = t.identifier;
            stick.ox = stick.mx = t.clientX;
            stick.oy = stick.my = t.clientY;
            if (api.onStick) api.onStick(true, stick.ox, stick.oy, 0, 0);
          } else if (stick.lookId === null) {
            stick.lookId = t.identifier;
            stick.lx = t.clientX;
            stick.ly = t.clientY;
          }
        }
      }, { passive: false });

      on(canvas, 'touchmove', function (e) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === stick.moveId) {
            stick.mx = t.clientX;
            stick.my = t.clientY;
            /* Zieht man weit, wandert der Mittelpunkt mit - so bleibt der
               Knopf unter dem Daumen. */
            var dx = stick.mx - stick.ox, dy = stick.my - stick.oy;
            var len = Math.hypot(dx, dy);
            if (len > STICK_RADIUS) {
              stick.ox += dx * (1 - STICK_RADIUS / len);
              stick.oy += dy * (1 - STICK_RADIUS / len);
            }
            if (api.onStick) {
              api.onStick(true, stick.ox, stick.oy, stick.mx - stick.ox, stick.my - stick.oy);
            }
          } else if (t.identifier === stick.lookId) {
            stick.dx += t.clientX - stick.lx;
            stick.dy += t.clientY - stick.ly;
            stick.lx = t.clientX;
            stick.ly = t.clientY;
          }
        }
      }, { passive: false });

      var endTouch = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === stick.moveId) {
            stick.moveId = null;
            if (api.onStick) api.onStick(false, 0, 0, 0, 0);
          } else if (t.identifier === stick.lookId) {
            stick.lookId = null;
          }
        }
      };
      on(canvas, 'touchend', endTouch);
      on(canvas, 'touchcancel', endTouch);
    }

    function anyOf(list) {
      for (var i = 0; i < list.length; i++) if (keys[list[i]]) return true;
      return false;
    }

    var pad = { axes: [0, 0, 0, 0], buttons: [] };

    function pollPad() {
      if (!navigator.getGamepads) return null;
      var pads = navigator.getGamepads();
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
      return null;
    }

    var padPrev = [];

    var api = {
      wantPointerLock: !isTouch,
      onStick: null,
      onFirstTouch: null,
      onKey: null,
      onPointerLock: null,
      mouse: mouse,

      /* Bewegungsachsen aus Tastatur, Gamepad und Schiebeknopf. */
      axis: function () {
        var x = 0, y = 0, fromTouch = false;
        if (anyOf(MAP.right)) x += 1;
        if (anyOf(MAP.left)) x -= 1;
        if (anyOf(MAP.forward)) y += 1;
        if (anyOf(MAP.back)) y -= 1;
        var gp = pollPad();
        if (gp) {
          var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
          if (Math.abs(ax) > 0.18) x += ax;
          if (Math.abs(ay) > 0.18) y -= ay;
        }
        if (stick.moveId !== null) {
          var tx = (stick.mx - stick.ox) / STICK_RADIUS;
          var ty = -(stick.my - stick.oy) / STICK_RADIUS;
          var tl = Math.hypot(tx, ty);
          if (tl > 1) { tx /= tl; ty /= tl; }
          if (tl > 0.12) { x += tx; y += ty; fromTouch = true; }
        }
        var l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        return { x: x, y: y, len: Math.min(1, l), fromTouch: fromTouch };
      },

      /* Kamerabewegung: Maus im Pointer-Lock oder Wischen auf der rechten
         Bildhaelfte, bereits in Bogenmass. */
      lookDelta: function () {
        var x = 0, y = 0;
        /* mouse.dx wird nur gefuellt, wenn der Zeiger eingefangen ist oder
           gerade gezogen wird - beides darf die Kamera drehen. */
        x += mouse.dx * mouse.sensitivity;
        y += mouse.dy * mouse.sensitivity;
        x += stick.dx * TOUCH_LOOK;
        y += stick.dy * TOUCH_LOOK;
        return { x: x, y: y };
      },

      /* Von den Bildschirmknoepfen gesetzt. */
      setVirtual: function (action, down) {
        if (down && !virt[action]) virt[action + 'Pressed'] = true;
        virt[action] = down;
      },
      isTouch: isTouch,

      camAxis: function () {
        var x = 0, y = 0;
        if (keys.ArrowRight) x += 1;
        if (keys.ArrowLeft) x -= 1;
        if (keys.KeyQ) x -= 1;
        var gp = pollPad();
        if (gp) {
          var ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
          if (Math.abs(ax) > 0.18) x += ax;
          if (Math.abs(ay) > 0.18) y += ay;
        }
        return { x: x, y: y };
      },

      down: function (action) {
        if (virt[action]) return true;
        if (MAP[action] && anyOf(MAP[action])) return true;
        var gp = pollPad();
        if (gp) {
          if (action === 'jump' && gp.buttons[0] && gp.buttons[0].pressed) return true;
          if (action === 'jet' && ((gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[7] && gp.buttons[7].pressed))) return true;
          if (action === 'sprint' && gp.buttons[6] && gp.buttons[6].pressed) return true;
        }
        if (action === 'jet' && keys.Mouse0 && mouse.locked) return true;
        return false;
      },

      /* Einmalig true direkt nach dem Druecken. */
      hit: function (action) {
        if (virt[action + 'Pressed']) return true;
        var list = MAP[action] || [];
        for (var i = 0; i < list.length; i++) if (pressed[list[i]]) return true;
        if (action === 'jet' && pressed.Mouse0 && mouse.locked) return true;
        var gp = pollPad();
        if (gp) {
          var idx = action === 'jump' ? 0 : (action === 'jet' ? 2 : -1);
          if (idx >= 0 && gp.buttons[idx] && gp.buttons[idx].pressed && !padPrev[idx]) return true;
        }
        return false;
      },

      /* Am Ende jedes Frames aufrufen. */
      endFrame: function () {
        for (var k in pressed) pressed[k] = false;
        virt.jumpPressed = false;
        virt.jetPressed = false;
        mouse.dx = 0;
        mouse.dy = 0;
        stick.dx = 0;
        stick.dy = 0;
        var gp = pollPad();
        padPrev = [];
        if (gp) for (var i = 0; i < gp.buttons.length; i++) padPrev[i] = gp.buttons[i].pressed;
      },

      /* Wird der Zeiger nicht eingefangen (eingebettete Seite), bleibt es beim
         Ziehen mit der Maus - dann wird es auch nicht erneut versucht. */
      grabPointer: function () {
        if (!api.wantPointerLock || mouse.locked || !canvas.requestPointerLock) return;
        try {
          var pr = canvas.requestPointerLock();
          if (pr && pr.catch) pr.catch(function () { api.wantPointerLock = false; });
        } catch (err) {
          api.wantPointerLock = false;
        }
      },

      releasePointer: function () {
        if (document.pointerLockElement) document.exitPointerLock();
      },

      dispose: function () {
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
        listeners.length = 0;
      }
    };

    return api;
  }

  root.MR = root.MR || {};
  root.MR.input = { create: create };
})(window);
