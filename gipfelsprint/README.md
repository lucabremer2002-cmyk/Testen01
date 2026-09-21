# Gipfelsprint

Ein 3D-Jump-'n'-Run als Time-Trial: ein kompakter Hindernisparcours den Berg
hinauf, Bestzeit im Browser gespeichert, Medaillen fuer schnelle Laeufe.

Alles eigenentwickelt und ohne Abhaengigkeiten - eigener WebGL2-Renderer,
eigene Kollisionsabfrage, prozeduraler Klang. Kein Framework, kein
Build-Schritt, keine Fremd-Assets.

## Spielen

Wegen der ES-Modul-freien, aber dateiuebergreifenden Struktur laeuft das
Spiel direkt per Doppelklick auf `index.html`. Wer lieber einen Server
nutzt:

```bash
python3 -m http.server 8000
# danach http://localhost:8000/gipfelsprint/ aufrufen
```

Voraussetzung ist ein Browser mit **WebGL2** (Chrome, Edge, Firefox, Safari 15+).

## Steuerung

| Taste | Wirkung |
| --- | --- |
| `W` `A` `S` `D` | Laufen (relativ zur Kamera) |
| `Leertaste` | Sprung, in der Luft nochmal fuer den Doppelsprung |
| `Shift` (halten) | Sprint |
| `Strg` / `E` / linke Maustaste | Dash - kurzer Schub, in der Luft einmal pro Sprung |
| Maus (nach Klick) | Kamera drehen |
| `←` `→` | Kamera drehen ohne Maus |
| `R` | Level sofort neu starten |
| `K` | Zurueck zum letzten Checkpoint |
| `P` / `Esc` | Pause |
| `M` | Ton an/aus |

Ein Gamepad wird ebenfalls erkannt (linker Stick laufen, rechter Stick
Kamera, A springen, X/RT Dash).

## Bewegung

Das Movement ist auf Tempo und Kontrolle ausgelegt:

* **Beschleunigung nur bis zur Wunschgeschwindigkeit** - Schwung aus Dash
  oder Tempofeld bleibt erhalten und baut sich langsam ab, statt sofort
  gekappt zu werden. Wer Dash und Sprung verkettet, ist dauerhaft schneller.
* **Coyote-Zeit** (0,11 s) und **gepufferter Sprung** (0,13 s) - ein paar
  Frames zu frueh oder zu spaet gedrueckt wird trotzdem als Sprung gewertet.
* **Variable Sprunghoehe** - kurz antippen springt niedriger als halten.
* **Doppelsprung** setzt die Richtung neu, taugt also zum Korrigieren.
* **Dash** hebt die Schwerkraft kurz auf und laedt sich bei Bodenkontakt,
  auf einem Sprungpilz oder nach einem Gegnersprung wieder auf.
* Bewegliche Plattformen nehmen die Figur mit, ihr Schwung wird beim
  Absprung uebernommen.

Die Physik laeuft mit festen 120 Schritten pro Sekunde, unabhaengig von der
Bildrate - sonst waeren Zeiten nicht vergleichbar.

## Kamera

Third-Person, folgt automatisch hinter die Figur, sobald man laeuft, und
laesst sich jederzeit mit Maus oder Pfeiltasten uebersteuern (danach
uebernimmt sie nach kurzer Pause wieder). Bei hohem Tempo zoomt sie heraus,
beim Fallen hebt sie sich an und kippt nach unten, damit der Landepunkt
sichtbar bleibt. Felswaende schieben sie naeher heran statt die Sicht zu
blockieren. Der **Schattenfleck** unter der Figur zeigt beim Sprung, wo man
aufkommt.

## Das Level

Sechs Abschnitte ohne Pause hintereinander, jeder mit eigenem Charakter:

1. **Talstation** - Start, Trittsteine ueber dem Bach, Haengebruecke mit Gegner
2. **Steinstufen** - Stufen, zwei gegenlaeufige Plattformen ueber der Schlucht,
   schmaler Sims unter Steinschlag
3. **Tempo-Abfahrt** - Tempofelder, drehender Balken, Abfahrt mit Gegnern,
   Sprungpilz ueber die grosse Schlucht (oben herum gibt es eine Abkuerzung)
4. **Tropfsteinhoehle** - broeckelnde Platten, Gegner im Dunkeln, schmaler
   Grat ueber spitzen Kristallen
5. **Wasserfall** - Sprungpilz, kreisende Plattformen, Aufzug, Pendelstamm
6. **Gipfelgrat** - Pendel, Zickzack ueber dem Abgrund, grosse
   Sprungkombination, Ziel auf dem Gipfel

Dazwischen liegen zehn Checkpoints, also etwa alle 10 bis 15 Sekunden einer.
Nach einem Sturz geht es in gut einer Drittelsekunde am letzten Checkpoint
weiter - **die Uhr laeuft weiter**.

## Time Trial

Der Timer startet nach `BEREIT? 3 2 1 LOS!` und laeuft bis ins Ziel. An
jedem Checkpoint wird die Zwischenzeit mit dem eigenen Rekordlauf
verglichen und als `+0,42` bzw. `-1,13` eingeblendet.

Die Medaillenzeiten leiten sich aus der tatsaechlichen Streckenlaenge ab
(siehe `build()` in `src/level.js`), aktuell etwa:

| Medaille | Zeit | gedacht fuer |
| --- | --- | --- |
| Platin | 1:06.7 | nahezu perfekte Linie, Dash und Tempofelder voll genutzt |
| Gold | 1:18.7 | sicherer Lauf ohne Sturz |
| Silber | 1:34.7 | ein paar Stuerze |
| Bronze | 2:03.3 | erstes Durchkommen |

Die Strecke ist rund 940 Einheiten lang; die Figur laeuft 13,5 und sprintet
18 Einheiten pro Sekunde. Ein fluessiger Lauf liegt damit bei gut anderthalb
Minuten, ein geuebter bei etwas ueber einer Minute.

Bestzeit, Zwischenzeiten, Kristalle und Stuerze liegen im `localStorage`
(`gipfelsprint.record.v1`).

## Kristalle

14 Stueck sind verteilt: ein Teil liegt auf der Strecke, der Rest ueber
Abgruenden, hinter dem Wasserfall, in einer Hoehlennische, im Bogen eines
Pilzsprungs oder auf der riskanten Hochroute. Sie sind optional - wer alle
mitnimmt, verliert Zeit.

## Aufbau

```
index.html      Seite, HUD und Bildschirme
style.css       HUD, Menue, Ergebnis
src/math.js     Vektoren, 4x4-Matrizen, Zufall mit festem Startwert
src/render.js   WebGL2: Instanz-Shader, Himmel, Bloom
src/audio.js    Klangsynthese (Effekte und Begleitung)
src/input.js    Tastatur, Maus mit Pointer-Lock, Gamepad
src/physics.js  Kollisionswelt: Kapsel gegen gedrehte Quader, Strahlen
src/level.js    Levelbaukasten, Abschnitte, Gegner, Deko
src/player.js   Figur, Bewegungsmodell, Verfolgerkamera
src/game.js     Zustaende, fester Zeitschritt, HUD, Bestzeiten
```

### Technische Notizen

* **Rendering**: alle Objekte sind Instanzen von acht Grundkoerpern
  (Quader, Kugel, Zylinder, Kegel, Saeule, Kristall, Torus, Flaeche).
  Ein Draw-Call pro Koerperform und Stapel. Statische Geometrie wird
  einmal hochgeladen, bewegliche pro Frame.
* **Kollision**: die Figur ist eine stehende Kapsel, geprueft als drei
  Kugeln gegen achsparallele, um Y gedrehte Quader. Ein Gitter ueber der
  XZ-Ebene haelt die Breitphase billig. Schnelle Bewegung wird in
  Teilschritte von maximal 0,3 Einheiten zerlegt, damit nichts durch
  duenne Plattformen rutscht.
* **Levelbau**: ein Cursor mit Position und Drehung; jeder Abschnitt wird
  in lokalen Koordinaten beschrieben und danach an der Cursorposition
  eingesetzt. Dadurch laesst sich die Strecke um den Berg legen, ohne beim
  Entwerfen mit Weltkoordinaten zu rechnen.
* **Leistung**: faellt die Bildrate laenger unter 40, schaltet sich Bloom
  ab und die Aufloesung wird auf 1x gesetzt.

### Wie die Sprungweiten festgelegt wurden

Die Reichweite der Figur wurde in der laufenden Simulation gemessen und die
Strecke danach ausgelegt:

| Manoever | Weite | Hoehe |
| --- | --- | --- |
| Laufsprung | 11,7 m | 3,8 m |
| Sprintsprung | 15,6 m | 3,8 m |
| kurz angetippt | 10,8 m | 2,3 m |
| Sprint + Doppelsprung | 25,6 m | 6,7 m |
| Dash + Sprung | 24,3 m | 3,8 m |
| Dash + Sprung + Doppelsprung | 37,1 m | 6,7 m |

Daraus folgt die Faustregel im Level: Landeflaechen sind 10 bis 16 Einheiten
tief, Luecken bis 9 Einheiten sind Tempo-Huepfer, 10 bis 14 verlangen Sprint,
ab 16 braucht es den Doppelsprung. Waeren die Luecken kleiner, wuerde man bei
vollem Tempo ueber die Plattformen hinwegfliegen.
