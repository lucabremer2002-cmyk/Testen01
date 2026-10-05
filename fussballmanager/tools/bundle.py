#!/usr/bin/env python3
"""Buendelt Matchplan zu einer einzigen HTML-Seite (alle Skripte und Styles inline).

Aufruf:  python3 tools/bundle.py ZIELDATEI.html
Die Seite enthaelt keine eigenen <html>/<head>/<body>-Tags und eignet sich zum
Veroeffentlichen als Artifact; im Browser laesst sie sich ebenfalls direkt oeffnen.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def inline_js(src):
    code = (ROOT / src).read_text(encoding='utf-8')
    return code.replace('</script', '<\\/script')


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'dist' / 'matchplan.html')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)">', html).group(1)
    css = (ROOT / 'css' / 'style.css').read_text(encoding='utf-8')
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    parts = [
        '<title>Matchplan</title>',
        '<meta name="description" content="Fußballmanager für Bundesliga, 2. Bundesliga, 3. Liga sowie die Regionalligen West und Südwest mit den Kadern 2026/27.">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link rel="stylesheet" href="' + fonts + '">',
        '<style>\n' + css + '\n</style>',
        '<div id="app"><div style="padding:40px;text-align:center">Lädt …</div></div>',
        '<div class="modal-root" id="modal"></div>',
        '<div class="toasts" id="toasts" aria-live="polite"></div>',
        '<script>window.FM_ARTIFACT = true;</script>',
    ]
    for src in scripts:
        parts.append('<script>/* ' + src + ' */\n' + inline_js(src) + '\n</script>')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('\n'.join(parts) + '\n', encoding='utf-8')
    print(out, round(out.stat().st_size / 1024), 'KB')


if __name__ == '__main__':
    main()
