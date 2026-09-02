# Neon Dash

Ein 2D-Endlosrunner fuer den Browser – reines HTML, CSS und JavaScript, ohne
Framework, ohne Build-Schritt und ohne Abhaengigkeiten.

## Spielen

`runner/index.html` im Browser oeffnen. Das war's.

Alternativ ueber einen lokalen Server (aus dem Projektwurzelverzeichnis):

```bash
python3 -m http.server 8000
# danach http://localhost:8000/runner/ aufrufen
```

## Steuerung

| Taste | Wirkung |
| --- | --- |
| `Leertaste` / `W` / `↑` | Springen – laenger gedrueckt springt hoeher, ein zweiter Druck in der Luft ist der Doppelsprung |
| `S` / `↓` | Am Boden rutschen, in der Luft schneller fallen |
| `Shift` / `X` | Dash – kurzer Vorwaertsschub, zerlegt Kisten und macht kurz unverwundbar |
| `E` / `Q` | Hyper-Modus zuenden, sobald die Leiste voll ist |
| `P` / `Esc` | Pause |
| `R` | Neustart |
| `M` | Ton an/aus |
| `Enter` | Starten bzw. Pause aufheben |

Auf Touchgeraeten gibt es eine Schaltflaechenleiste. Zusaetzlich funktionieren
Gesten auf der Spielflaeche: tippen springt, nach unten wischen rutscht, nach
rechts wischen loest den Dash aus, nach oben wischen zuendet den Hyper-Modus.

## Features

* **Endlose Strecke** aus sieben Bausteintypen – flache Passagen, Gruben,
  Treppen aus Schwebeplattformen, Drohnenreihen, Saegen, Kistenwaende und
  Schatzabschnitte. Die Schwierigkeit steigt mit der zurueckgelegten Strecke.
* **Sieben Zonen** mit komplett eigener Farbwelt, die alle 650 Meter wechseln
  und ineinander ueberblenden: Neonstadt, Kristalltal, Lavafeld,
  Giftdschungel, Tiefsee, Sonnensturm, Magentawueste.
* **Sprunggefuehl** mit variabler Sprunghoehe, Doppelsprung, Coyote-Time
  (100 ms Gnadenfrist nach der Kante) und Sprungpuffer (120 ms vor der
  Landung) – Eingaben gehen dadurch praktisch nie verloren.
* **Vier Power-ups**: Schild (faengt einen Treffer ab), Magnet (zieht Muenzen
  an), doppelte Punkte und Zeitlupe.
* **Hyper-Modus**: Muenzen und knappe Ausweichmanoever fuellen die Leiste. Ist
  sie voll, fliegt die Figur sieben Sekunden lang als unverwundbarer
  Regenbogenkomet, zerlegt jedes Hindernis und kassiert dreifache Punkte.
* **Kombo-System**: Jede Muenze ohne Unterbrechung erhoeht den Multiplikator
  (bis x8), nach 2,6 Sekunden ohne Muenze faellt er zurueck.
* **Beinahe-Treffer**: Wer weniger als 26 Pixel an einem Hindernis
  vorbeikommt, bekommt Bonuspunkte, eine kurze Zeitlupe und Extraladung.
* **Effekte**: Partikel, Bildschirmwackeln, Farbblitze, Geschwindigkeitslinien,
  Nachziehspur, drei Parallaxebenen und ein Neonboden.
* **Prozeduraler Ton** ueber WebAudio – Effekte und ein Basslauf, dessen Tempo
  mit der Geschwindigkeit steigt. Kein Audiomaterial noetig.
* **Bestwert, weiteste Strecke und gesammelte Muenzen** werden im
  `localStorage` gesichert.

## Wertung

| Aktion | Punkte |
| --- | --- |
| Zurueckgelegte Strecke | 1 pro Meter |
| Muenze | 10 × Multiplikator |
| Power-up eingesammelt | 120 × Multiplikator |
| Knapp an einem Hindernis vorbei | 75 × Multiplikator |
| Kiste per Dash zerlegt | 40 × Multiplikator |
| Hindernis im Hyper-Modus zerlegt | 60 × Multiplikator |

Der Multiplikator ist `1 + Kombo / 8` (hoechstens x8), verdoppelt sich mit dem
Power-up „doppelte Punkte" und verdreifacht sich im Hyper-Modus.

## Dateien

```
index.html   Aufbau der Seite und Anzeige
style.css    Darstellung, Layout und Verhalten auf Telefonen
game.js      Spiellogik, Streckenerzeugung, Ton und Rendering
```

## Technische Notizen

* Feste Zeitschritte von 1/120 s fuer die Physik, davon hoechstens zehn pro
  Bild – die Simulation bleibt damit unabhaengig von der Bildrate stabil.
* Die Zeichenflaeche rechnet intern immer mit 960 × 540 Pixeln und wird per
  CSS skaliert; die Aufloesung folgt `devicePixelRatio` (hoechstens 2×).
* Grubenweiten werden aus der aktuellen Geschwindigkeit abgeleitet
  (`min(330, Tempo × 0,44)`) und liegen damit stets unter der Reichweite eines
  einzelnen Sprungs – jede Luecke ist ohne Doppelsprung ueberwindbar.
* Objekte hinter der Kamera werden jeden Frame verworfen, die Partikelzahl ist
  auf 420 begrenzt.
