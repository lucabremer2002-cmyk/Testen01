# Tetris

Ein vollstaendiges Tetris fuer den Browser – reines HTML, CSS und JavaScript,
ohne Framework, ohne Build-Schritt und ohne Abhaengigkeiten.

## Spielen

`index.html` im Browser oeffnen. Das war's.

Alternativ ueber einen lokalen Server:

```bash
python3 -m http.server 8000
# danach http://localhost:8000 aufrufen
```

## Steuerung

| Taste | Wirkung |
| --- | --- |
| `←` `→` (oder `A` `D`) | Stein bewegen |
| `↓` (oder `S`) | Sanft fallen lassen (+1 Punkt pro Reihe) |
| `Leertaste` | Hart fallen lassen (+2 Punkte pro Reihe) |
| `↑` / `X` / `W` | Im Uhrzeigersinn drehen |
| `Strg` / `Y` / `Z` | Gegen den Uhrzeigersinn drehen |
| `C` / `Shift` | Stein halten (einmal pro Stein) |
| `P` / `Esc` | Pause |
| `R` | Neustart |
| `M` | Ton an/aus |
| `Enter` | Starten bzw. Pause aufheben |

Auf Touchgeraeten gibt es zusaetzlich eine Schaltflaechenleiste. Auf dem
Spielfeld funktionieren ausserdem Gesten: wischen bewegt, tippen dreht,
schnelles Wischen nach unten laesst den Stein hart fallen.

## Umgesetzte Regeln

* **7-Bag-Zufall** – jeder der sieben Steine kommt genau einmal pro Runde,
  daher keine langen Durststrecken ohne I-Stein.
* **SRS-Drehung mit Wallkicks** – die Standard-Kicktabellen fuer I und
  J/L/S/T/Z, damit auch enge Drehungen an Wand und Boden funktionieren.
* **Hold-Slot** – einmal pro Stein, der gehaltene Stein wird ausgegraut
  dargestellt, solange er gesperrt ist.
* **Vorschau auf fuenf Steine** und **Geisterstein** als Landehilfe.
* **Lock Delay** – 500 ms Zeit nach dem Aufsetzen, durch Bewegen oder Drehen
  bis zu 15-mal verlaengerbar.
* **DAS/ARR** – 150 ms bis zur Tastenwiederholung, danach alle 35 ms.
* **Schwerkraft nach Level** gemaess der ueblichen Formel
  `(0.8 − (Level−1) × 0.007)^(Level−1)` Sekunden pro Reihe.
* **T-Spin-Erkennung** ueber die drei belegten Ecken um das Steinzentrum,
  inklusive Unterscheidung zwischen vollem T-Spin und Mini.
* **Bestwert** wird im `localStorage` gesichert.

## Wertung

| Aktion | Punkte (× Level) |
| --- | --- |
| Single / Double / Triple / Tetris | 100 / 300 / 500 / 800 |
| T-Spin ohne Reihe / Single / Double / Triple | 400 / 800 / 1200 / 1600 |
| T-Spin Mini ohne Reihe / Single / Double | 100 / 200 / 400 |
| Back-to-Back (Tetris oder T-Spin in Folge) | × 1,5 auf die Grundwertung |
| Combo (n-te Reihe in Folge) | 50 × n |
| Perfect Clear (1 / 2 / 3 / 4 Reihen) | 800 / 1200 / 1800 / 2000 |
| Sanft fallen / hart fallen | 1 bzw. 2 pro Reihe (ohne Levelfaktor) |

Alle zehn geloeschten Reihen steigt das Level um eins, und die Steine fallen
entsprechend schneller.

## Dateien

```
index.html   Aufbau der Seite
style.css    Darstellung, Layout und Responsive-Verhalten
game.js      Spiellogik und Rendering auf dem Canvas
```

## Weiteres Spiel im Projekt

Neben Tetris liegt hier ein zweites eigenstaendiges Browser-Spiel:

* **[Neon Dash](runner/)** (`runner/index.html`) – ein 2D-Endlosrunner mit
  Doppelsprung, Rutschen, Dash, Power-ups, Hyper-Modus und sieben Farbzonen.
