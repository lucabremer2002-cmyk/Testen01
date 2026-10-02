/* ---------------------------------------------------------------------
   Diagramme auf Canvas. Keine Bibliothek, drei Typen, mehr braucht das
   Spiel nicht: Verlauf, Balken, Ring.

   Alle zeichnen scharf auf hochaufloesenden Bildschirmen (devicePixel-
   Ratio) und gehen mit leeren Daten um, ohne zu stuerzen.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  function setup(canvas, h) {
    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 600;
    h = h || canvas.clientHeight || 160;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g: g, w: w, h: h };
  }

  function fmt(v) { return CE.util.money(v); }

  /* Verlauf mehrerer Reihen. series: [{name, color, values:[]}] */
  function line(canvas, series, opts) {
    opts = opts || {};
    var c = setup(canvas, opts.height || 170), g = c.g, w = c.w, h = c.h;
    var padL = 56, padR = 10, padT = 12, padB = 22;
    var iw = w - padL - padR, ih = h - padT - padB;

    var n = 0, i, j;
    for (i = 0; i < series.length; i++) n = Math.max(n, series[i].values.length);
    if (n < 2) {
      g.fillStyle = '#6d7280'; g.font = '12px system-ui'; g.textAlign = 'center';
      g.fillText('Noch nicht genug Wochen', w / 2, h / 2);
      return;
    }

    var min = opts.min !== undefined ? opts.min : Infinity, max = -Infinity;
    for (i = 0; i < series.length; i++) {
      for (j = 0; j < series[i].values.length; j++) {
        var v = series[i].values[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === max) { max = min + 1; }
    if (opts.zero && min > 0) min = 0;
    var pad = (max - min) * 0.12;
    max += pad; min -= pad;

    function X(k) { return padL + (k / (n - 1)) * iw; }
    function Y(v) { return padT + ih - ((v - min) / (max - min)) * ih; }

    /* Gitter */
    g.strokeStyle = 'rgba(255,255,255,.055)'; g.lineWidth = 1;
    g.fillStyle = '#6d7280'; g.font = '10px system-ui'; g.textAlign = 'right';
    for (i = 0; i <= 4; i++) {
      var yv = min + (max - min) * (i / 4);
      var y = Math.round(Y(yv)) + 0.5;
      g.beginPath(); g.moveTo(padL, y); g.lineTo(w - padR, y); g.stroke();
      g.fillText(opts.fmt ? opts.fmt(yv) : fmt(yv), padL - 7, y + 3);
    }
    /* Nulllinie hervorheben */
    if (min < 0 && max > 0) {
      g.strokeStyle = 'rgba(224,65,65,.35)';
      var y0 = Math.round(Y(0)) + 0.5;
      g.beginPath(); g.moveTo(padL, y0); g.lineTo(w - padR, y0); g.stroke();
    }

    for (i = 0; i < series.length; i++) {
      var s = series[i], vals = s.values;
      if (vals.length < 2) continue;
      var off = n - vals.length;

      if (s.fill !== false) {
        var grad = g.createLinearGradient(0, padT, 0, padT + ih);
        grad.addColorStop(0, s.color + '38');
        grad.addColorStop(1, s.color + '00');
        g.beginPath();
        g.moveTo(X(off), Y(vals[0]));
        for (j = 1; j < vals.length; j++) g.lineTo(X(off + j), Y(vals[j]));
        g.lineTo(X(n - 1), padT + ih); g.lineTo(X(off), padT + ih); g.closePath();
        g.fillStyle = grad; g.fill();
      }
      g.beginPath();
      g.moveTo(X(off), Y(vals[0]));
      for (j = 1; j < vals.length; j++) g.lineTo(X(off + j), Y(vals[j]));
      g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();

      /* Letzter Punkt bekommt einen Marker. */
      var lx = X(n - 1), ly = Y(vals[vals.length - 1]);
      g.beginPath(); g.arc(lx, ly, 3, 0, 6.2832);
      g.fillStyle = s.color; g.fill();
      g.beginPath(); g.arc(lx, ly, 6, 0, 6.2832);
      g.strokeStyle = s.color + '55'; g.lineWidth = 1; g.stroke();
    }

    g.fillStyle = '#6d7280'; g.font = '10px system-ui'; g.textAlign = 'left';
    g.fillText(opts.xFirst || 'Woche 1', padL, h - 6);
    g.textAlign = 'right';
    g.fillText(opts.xLast || ('Woche ' + n), w - padR, h - 6);
  }

  /* Waagerechte Balken. rows: [{label, value, color}] */
  function bars(canvas, rows, opts) {
    opts = opts || {};
    var rowH = 26;
    var c = setup(canvas, Math.max(40, rows.length * rowH + 8)), g = c.g, w = c.w;
    if (!rows.length) {
      g.fillStyle = '#6d7280'; g.font = '12px system-ui'; g.textAlign = 'center';
      g.fillText(opts.empty || 'Nichts zu zeigen', w / 2, 24);
      return;
    }
    var labelW = 112, valW = 78;
    var max = 0;
    for (var i = 0; i < rows.length; i++) max = Math.max(max, Math.abs(rows[i].value));
    if (max <= 0) max = 1;
    var bw = w - labelW - valW;

    for (i = 0; i < rows.length; i++) {
      var r = rows[i], y = 4 + i * rowH;
      g.fillStyle = '#a3a7b4'; g.font = '12px system-ui'; g.textAlign = 'left';
      g.fillText(clip(g, r.label, labelW - 10), 0, y + 15);

      var bwidth = Math.max(2, (Math.abs(r.value) / max) * bw);
      g.fillStyle = 'rgba(255,255,255,.05)';
      round(g, labelW, y + 5, bw, 13, 3); g.fill();
      var grad = g.createLinearGradient(labelW, 0, labelW + bwidth, 0);
      grad.addColorStop(0, (r.color || '#d4af5a') + '66');
      grad.addColorStop(1, r.color || '#d4af5a');
      g.fillStyle = grad;
      round(g, labelW, y + 5, bwidth, 13, 3); g.fill();

      g.fillStyle = '#e8e9ee'; g.textAlign = 'right'; g.font = '600 12px system-ui';
      g.fillText(opts.fmt ? opts.fmt(r.value) : fmt(r.value), w, y + 15);
    }
  }

  function clip(g, text, max) {
    if (g.measureText(text).width <= max) return text;
    var t = text;
    while (t.length > 2 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }

  function round(g, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* Ring fuer Anteile. parts: [{value, color, label}] */
  function donut(canvas, parts, opts) {
    opts = opts || {};
    var c = setup(canvas, opts.height || 150), g = c.g, w = c.w, h = c.h;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6, r = R * 0.62;
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += Math.max(0, parts[i].value);

    g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.arc(cx, cy, r, 0, 6.2832, true);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fill();

    if (total > 0) {
      var a = -Math.PI / 2;
      for (i = 0; i < parts.length; i++) {
        var v = Math.max(0, parts[i].value);
        if (!v) continue;
        var a2 = a + (v / total) * 6.2832;
        g.beginPath();
        g.arc(cx, cy, R, a, a2); g.arc(cx, cy, r, a2, a, true); g.closePath();
        g.fillStyle = parts[i].color; g.fill();
        a = a2;
      }
    }
    if (opts.center) {
      g.fillStyle = '#e8e9ee'; g.textAlign = 'center'; g.font = '600 15px system-ui';
      g.fillText(opts.center, cx, cy + 2);
      if (opts.sub) { g.fillStyle = '#6d7280'; g.font = '10px system-ui'; g.fillText(opts.sub, cx, cy + 16); }
    }
  }

  CE.charts = { line: line, bars: bars, donut: donut };
})(typeof window !== 'undefined' ? window : globalThis);
