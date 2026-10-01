/* Baut aus index.html + style.css eine einzelne Seite, die als Artifact
   veroeffentlicht werden kann.

   Der Artifact-Dienst legt selbst <!doctype>, <html>, <head> und <body> um die
   Datei. Darum darf die gebaute Seite diese Huelle nicht mitbringen - sonst
   steckt ein zweites Dokument im ersten. Das CSS wird eingebettet, die
   Skripte bleiben eigene Dateien und werden beim Veroeffentlichen daneben
   gelegt.

   Aufruf:  node tools/artifact.js [ziel]
   Standardziel: dist/index.html
*/
'use strict';
var fs = require('fs');
var path = require('path');

var wurzel = path.resolve(__dirname, '..');
var ziel = process.argv[2] ? path.resolve(process.argv[2]) : path.join(wurzel, 'dist', 'index.html');

var html = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(wurzel, 'style.css'), 'utf8');

/* Nur den Koerper behalten. */
var a = html.indexOf('<body');
a = html.indexOf('>', a) + 1;
var b = html.lastIndexOf('</body>');
if (a < 1 || b < 0) throw new Error('index.html hat keinen erkennbaren body');
var koerper = html.slice(a, b).trim();

/* Der Titel steht in den ersten 8 KB, danach sucht der Dienst nicht weiter. */
var seite = '<title>Crime Empire</title>\n'
  + '<style>\n' + css + '\n</style>\n'
  /* index.html setzt die Klasse am body; hier gehoert der body dem Dienst. */
  + '<script>document.body.classList.add(\'booting\');</script>\n\n'
  + koerper + '\n';

fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, seite);

/* Die Liste der Skripte, damit man sie beim Veroeffentlichen mitgeben kann. */
var skripte = (koerper.match(/src="(src\/[^"]+)"/g) || []).map(function (t) {
  return t.slice(5, -1);
});
console.log(ziel + '  ' + (seite.length / 1024).toFixed(0) + ' KB');
console.log(skripte.length + ' Skripte: ' + skripte.join(' '));
