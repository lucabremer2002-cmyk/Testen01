#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fasst das Spiel zu einer einzelnen HTML-Datei zusammen.

Das Spiel selbst braucht keinen Bauschritt - index.html laesst sich direkt
oeffnen. Dieses Werkzeug ist nur fuer Umgebungen gedacht, die genau eine
Datei entgegennehmen, etwa beim Veroeffentlichen als Webseite.

    python3 werkzeug/einzeldatei.py [zieldatei]

Mit --einbettung wird ein kleiner Zusatz angehaengt, der den Dateiexport
ueber den Dialog der Umgebung leitet, falls die Seite in einem Rahmen
laeuft, der keine gewoehnlichen Downloads erlaubt.
"""

import io
import os
import re
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RAHMEN_CSS = """
/* ---------- Anpassung an einen fremden Seitenrahmen ---------- */
html { background: var(--bg); color-scheme: dark; }
"""

RAHMEN_JS = """<script>
/* ---------- Randbereiche des Geraets ---------- */
(function () {
  var m = document.querySelector('meta[name="viewport"]');
  if (m && m.content.indexOf('viewport-fit') < 0) m.content += ', viewport-fit=cover';
})();
</script>
"""

EINBETTUNG_JS = """<script>
/* ---------- Dateiexport ueber den Dialog der Umgebung ---------- */
(function () {
  var FM = window.FM;
  if (!FM || !FM.save || !FM.save.setzeExportWeg) return;
  var claude = window.claude;
  if (!claude || typeof claude.use !== 'function') return;  // offline: Browser-Download

  var wartet = claude.use('downloads');
  FM.save.setzeExportWeg(function (name, text, fertig) {
    Promise.resolve(wartet).then(function (downloads) {
      if (!downloads) {
        fertig('Das Sichern von Dateien ist hier nicht freigegeben.');
        return;
      }
      return downloads.save({ filename: name, data: text }).then(function () {
        fertig(null, 'gespeichert');
      }, function (e) {
        if (e && e.code === 'declined') fertig(null, 'abgebrochen');
        else fertig((e && e.message) || 'unbekannter Fehler');
      });
    }, function (e) {
      fertig((e && e.message) || 'unbekannter Fehler');
    });
  });
})();
</script>
"""


def lies(pfad):
    return io.open(os.path.join(WURZEL, pfad), encoding='utf-8').read()


def baue(einbettung=False):
    html = lies('index.html')
    koerper = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
    css_dateien = re.findall(r'<link rel="stylesheet" href="([^"]+)"', html)
    js_dateien = re.findall(r'<script src="([^"]+)"></script>', html)
    koerper = re.sub(r'\s*<script src="[^"]+"></script>', '', koerper)

    teile = ['<title>Bundesliga Manager</title>\n<style>\n']
    for f in css_dateien:
        teile.append('/* ---------- %s ---------- */\n' % f)
        teile.append(lies(f))
        teile.append('\n')
    teile.append(RAHMEN_CSS)
    teile.append('</style>\n')
    teile.append(koerper.strip())
    teile.append('\n\n')
    teile.append(RAHMEN_JS)
    for f in js_dateien:
        teile.append('<script>\n/* ---------- %s ---------- */\n' % f)
        teile.append(lies(f))
        teile.append('\n</script>\n')
    if einbettung:
        teile.append(EINBETTUNG_JS)
    return ''.join(teile)


def main():
    argumente = [a for a in sys.argv[1:] if a != '--einbettung']
    einbettung = '--einbettung' in sys.argv[1:]
    ziel = argumente[0] if argumente else os.path.join(WURZEL, 'bundesliga-manager.html')
    text = baue(einbettung)
    io.open(ziel, 'w', encoding='utf-8').write(text)
    print('%s geschrieben (%d KB)' % (ziel, round(len(text.encode('utf-8')) / 1024)))


if __name__ == '__main__':
    main()
