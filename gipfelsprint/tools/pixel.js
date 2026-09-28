/* Farbwerte aus einem Bild lesen.
 *
 * Grafikaenderungen lassen sich nicht mit dem Auge vergleichen - "wirkt
 * dunkler" ist keine Messung. Dieses Werkzeug liest die Farbe an
 * genannten Stellen und an einem Raster, damit sich zwei Bilder in
 * Zahlen vergleichen lassen.
 *
 * Aufruf:  node tools/pixel.js bild.png x,y [x,y ...]
 *          node tools/pixel.js bild.png --raster 8
 *          node tools/pixel.js a.png b.png --diff
 *          node tools/pixel.js bild.png --crop x,y,w,h,zoom ziel.png
 */
const fs = require('fs');
const zlib = require('zlib');

function ladePng(pfad) {
  const buf = fs.readFileSync(pfad);
  let p = 8, w = 0, h = 0, tiefe = 0, art = 0;
  const teile = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const typ = buf.toString('ascii', p + 4, p + 8);
    const daten = buf.slice(p + 8, p + 8 + len);
    if (typ === 'IHDR') {
      w = daten.readUInt32BE(0); h = daten.readUInt32BE(4);
      tiefe = daten[8]; art = daten[9];
    } else if (typ === 'IDAT') teile.push(daten);
    else if (typ === 'IEND') break;
    p += 12 + len;
  }
  if (tiefe !== 8) throw new Error('nur 8 Bit je Kanal');
  const kanaele = art === 6 ? 4 : art === 2 ? 3 : 0;
  if (!kanaele) throw new Error('nur RGB/RGBA');
  const roh = zlib.inflateSync(Buffer.concat(teile));
  const zeile = w * kanaele;
  const px = Buffer.alloc(h * zeile);
  let vor = Buffer.alloc(zeile);
  for (let y = 0; y < h; y++) {
    const f = roh[y * (zeile + 1)];
    const q = roh.slice(y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile);
    const z = px.slice(y * zeile, (y + 1) * zeile);
    for (let i = 0; i < zeile; i++) {
      const a = i >= kanaele ? z[i - kanaele] : 0;
      const b = vor[i];
      const c = i >= kanaele ? vor[i - kanaele] : 0;
      let v = q[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      z[i] = v & 255;
    }
    vor = z;
  }
  return { w: w, h: h, k: kanaele, px: px };
}

function farbe(im, x, y) {
  const i = (y * im.w + x) * im.k;
  return [im.px[i], im.px[i + 1], im.px[i + 2]];
}
function luma(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

function schreibePng(pfad, w, h, px) {
  const zeile = w * 3;
  const roh = Buffer.alloc(h * (zeile + 1));
  for (let y = 0; y < h; y++) {
    roh[y * (zeile + 1)] = 0;
    px.copy(roh, y * (zeile + 1) + 1, y * zeile, (y + 1) * zeile);
  }
  const idat = zlib.deflateSync(roh);
  function stueck(typ, daten) {
    const b = Buffer.alloc(8 + daten.length + 4);
    b.writeUInt32BE(daten.length, 0);
    b.write(typ, 4, 'ascii');
    daten.copy(b, 8);
    b.writeInt32BE(crc(Buffer.concat([Buffer.from(typ, 'ascii'), daten])) | 0, 8 + daten.length);
    return b;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(pfad, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    stueck('IHDR', ihdr), stueck('IDAT', idat), stueck('IEND', Buffer.alloc(0))]));
}
let TAB = null;
function crc(buf) {
  if (!TAB) {
    TAB = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      TAB[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const args = process.argv.slice(2);
if (args.includes('--crop')) {
  const im = ladePng(args[0]);
  const [x0, y0, cw, ch, z] = args[args.indexOf('--crop') + 1].split(',').map(Number);
  const ziel = args[args.indexOf('--crop') + 2];
  const w = cw * z, h = ch * z;
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = farbe(im, Math.min(im.w - 1, x0 + Math.floor(x / z)), Math.min(im.h - 1, y0 + Math.floor(y / z)));
      const i = (y * w + x) * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }
  schreibePng(ziel, w, h, px);
  console.log(ziel + '  ' + w + 'x' + h);
} else if (args.includes('--diff')) {
  const a = ladePng(args[0]), b = ladePng(args[1]);
  const n = Number(args[args.indexOf('--diff') + 1]) || 12;
  console.log('Raster ' + n + 'x' + n + ':  links=' + args[0] + '  rechts=' + args[1]);
  for (let gy = 0; gy < n; gy++) {
    let z = '';
    for (let gx = 0; gx < n; gx++) {
      const x = Math.floor((gx + 0.5) * a.w / n), y = Math.floor((gy + 0.5) * a.h / n);
      const d = Math.round(luma(farbe(b, x, y)) - luma(farbe(a, x, y)));
      z += String(d).padStart(5);
    }
    console.log(z);
  }
} else if (args.includes('--raster')) {
  const im = ladePng(args[0]);
  const n = Number(args[args.indexOf('--raster') + 1]) || 8;
  for (let gy = 0; gy < n; gy++) {
    let z = '';
    for (let gx = 0; gx < n; gx++) {
      const x = Math.floor((gx + 0.5) * im.w / n), y = Math.floor((gy + 0.5) * im.h / n);
      const c = farbe(im, x, y);
      z += ' ' + c.map(v => String(v).padStart(3)).join(',');
    }
    console.log(z);
  }
} else {
  const im = ladePng(args[0]);
  for (const a of args.slice(1)) {
    const [x, y] = a.split(',').map(Number);
    const c = farbe(im, x, y);
    console.log(x + ',' + y + '  rgb ' + c.join(' ') + '   Luma ' + luma(c).toFixed(1));
  }
}
