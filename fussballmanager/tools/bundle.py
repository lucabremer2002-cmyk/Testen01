#!/usr/bin/env python3
"""Packt Matchplan in eine einzelne HTML-Datei (CSS und alle Skripte inline).

Aufruf:  python3 tools/bundle.py [ziel.html] [--fragment]

--fragment  ohne <!DOCTYPE>/<html>/<head>/<body> (für Hosts, die das Gerüst selbst setzen)
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    fragment = '--fragment' in sys.argv
    out = args[0] if args else os.path.join(ROOT, 'dist', 'matchplan.html')

    index = read('index.html')
    scripts = re.findall(r'<script src="([^"]+)"></script>', index)
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', index).group(1)
    body = re.search(r'<body>(.*?)<noscript>', index, re.S).group(1).strip()
    css = read('css/style.css')

    parts = []
    if not fragment:
        parts.append('<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
                     '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
    parts.append('<title>Matchplan</title>')
    parts.append('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
                 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                 '<link rel="stylesheet" href="%s">' % fonts)
    parts.append('<style>\n%s\n</style>' % css)
    if not fragment:
        parts.append('</head>\n<body>')
    parts.append(body)
    if fragment:
        # eingebettete Fassung: Datei-Downloads sind dort nicht moeglich
        parts.append('<script>window.FM_EMBED = true;</script>')
    for src in scripts:
        js = read(src).replace('</script', '<\\/script')
        parts.append('<script>/* %s */\n%s\n</script>' % (src, js))
    if not fragment:
        parts.append('</body>\n</html>')

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts) + '\n')
    print('%s (%d KB, %d Skripte)' % (out, os.path.getsize(out) // 1024, len(scripts)))


if __name__ == '__main__':
    main()
