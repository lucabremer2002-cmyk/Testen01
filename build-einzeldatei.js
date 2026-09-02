#!/usr/bin/env node
/* build-einzeldatei.js
 *
 * Baut aus index.html, css/style.css und den Dateien in js/ eine einzige
 * HTML-Datei ohne externe Verweise. Nuetzlich zum Verschicken, Hochladen
 * oder Spielen ohne lokalen Server.
 *
 *   node build-einzeldatei.js                -> fussballmanager.html
 *   node build-einzeldatei.js --rumpflos     -> ohne <html>/<head>/<body>
 *
 * Die Variante --rumpflos ist fuer Umgebungen gedacht, die den Seitenrumpf
 * selbst mitbringen und nur den Inhalt einbetten.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const wurzel = __dirname;
const rumpflos = process.argv.includes('--rumpflos');
const ziel = path.join(wurzel, process.env.ZIEL || (rumpflos ? 'fussballmanager-eingebettet.html' : 'fussballmanager.html'));

const html = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');

/* Reihenfolge der Skripte aus index.html uebernehmen - sie ist bedeutsam. */
const skripte = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!skripte.length) throw new Error('In index.html wurden keine Skripte gefunden.');

const stil = fs.readFileSync(path.join(wurzel, 'css', 'style.css'), 'utf8');

const code = skripte.map(datei => {
  const inhalt = fs.readFileSync(path.join(wurzel, datei), 'utf8');
  return '/* ===== ' + datei + ' ===== */\n' + inhalt;
}).join('\n');

/* Inhalt zwischen <body> und </body> herausloesen. */
const koerper = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/\n?\s*<script src="[^"]+"><\/script>/g, '');

const titel = 'Fußballmanager Aufstiegskampf';
const stilBlock = '<style>\n' + stil + '\n</style>';
const skriptBlock = '<script>\n' + code + '\n</script>';

let ausgabe;
if (rumpflos) {
  ausgabe = '<title>' + titel + '</title>\n' + stilBlock + '\n' + koerper.trim() + '\n' + skriptBlock + '\n';
} else {
  const kopf = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
    .replace(/\n?\s*<link rel="stylesheet"[^>]*>/g, '');
  ausgabe = '<!DOCTYPE html>\n<html lang="de">\n<head>' + kopf + stilBlock +
    '\n</head>\n<body>\n' + koerper.trim() + '\n' + skriptBlock + '\n</body>\n</html>\n';
}

fs.writeFileSync(ziel, ausgabe);
const kb = (Buffer.byteLength(ausgabe) / 1024).toFixed(0);
console.log('Geschrieben: ' + path.basename(ziel) + ' (' + kb + ' KB, ' + skripte.length + ' Skripte eingebettet)');
