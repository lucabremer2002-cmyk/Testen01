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

Das Movement ist auf Direktheit ausgelegt - erst danach auf Tempo:

* **Sofortige Reaktion.** Aus dem Stand auf Sprinttempo in knapp 0,09 s
  (Beschleunigung 240/s). Loslassen bremst mit 190/s, aus vollem Sprint
  steht die Figur in gut einer Zehntelsekunde. Kein Nachrutschen.
* **Boden 100 %, Luft 44 %.** Am Boden wird der Seitwaertsanteil der
  Geschwindigkeit mit 26/s weggedaempft - ein Richtungswechsel sitzt
  sofort. In der Luft nur mit 5/s, dort bleibt Schwung erhalten. Die
  Luftbeschleunigung liegt bei 105 gegen 240 am Boden.
* **Straffer Sprung.** 3,0 m hoch, 0,68 s Flugzeit. Wird die Taste sofort
  losgelassen, greift eine fast doppelt so starke Steigfluggravitation
  (78 statt 42) - der Sprung bleibt dann bei 1,6 m. Fallen mit 62,
  Endgeschwindigkeit 62.
* **Doppelsprung** setzt die Richtung neu und traegt 2,3 m weiter hoch.
* **Dash** ist ein harter Schub auf 40 fuer 0,15 s, nicht bloss mehr Tempo.
  Waagerecht, ohne Absacken, mit Blickfeldstoss und Wischspur. 0,4 s
  Abklingzeit, in der Luft eine Ladung pro Sprung. Ein Sprung bricht den
  Dash ab und nimmt den Schwung mit - der Dash-Sprung traegt 24 m.
* **Coyote-Zeit** (0,10 s) und **gepufferter Sprung** (0,12 s) verzeihen
  ein paar Frames zu frueh oder zu spaet.
* **Stufenhilfe:** Kanten bis 0,62 m werden ueberstiegen statt zu
  blockieren. Ohne das bleibt die Figur schon an einer 40-cm-Stufe
  haengen, weil die Kollisionskapsel nur 42 cm Radius hat.
* Bewegliche Plattformen nehmen die Figur mit, ihr Schwung wird beim
  Absprung uebernommen.

Die Physik laeuft mit festen 120 Schritten pro Sekunde, unabhaengig von der
Bildrate - sonst waeren Zeiten nicht vergleichbar.

## Kamera

Third-Person, folgt automatisch hinter die Figur, sobald man laeuft, und
laesst sich jederzeit mit Maus oder Pfeiltasten uebersteuern (danach
uebernimmt sie nach kurzer Pause wieder).

* Bei Tempo geht sie bis zu 2,6 Einheiten weiter zurueck.
* Das Blickfeld oeffnet sich beim Sprint leicht (+0,085 rad) und beim Dash
  deutlich (+0,20 als kurzer Stoss).
* Beim Springen folgt sie vertikal traeger (6/s statt 12/s), damit das Bild
  nicht mithuepft; beim Fallen hebt sie sich an und kippt nach unten.
* Harte Landungen federn die Kamera kurz ein.
* Felswaende schieben sie naeher heran statt die Sicht zu blockieren.
* Der **Schattenfleck** unter der Figur zeigt beim Sprung, wo man aufkommt.

## Das Level

Fuenf Abschnitte mit eigener Farbwelt, eigenem Material und eigenem
Spielgefuehl. Nebel, Himmelsfarbe und Umgebungslicht werden beim
Uebergang weich ineinander geblendet, jeder Bereich hat eigene
Umgebungspartikel.

| # | Bereich | Was ihn ausmacht |
| --- | --- | --- |
| 1 | **Almwiese** | Sattes Gruen, Blumen, Zaeune, zwei Huetten, Bach mit Holzbruecke. Pollen in der Luft. Das Huettendach ist eine Abkuerzung, die Trittsteine neben der Bruecke die schnellere Linie. |
| 2 | **Wald** | Dichter, kuehler Nadelwald, starker Nebel, Lichtbalken zwischen den Staemmen, Pilze und ein querliegender Stamm als Huerde. Fallende Blaetter. Setpiece: der **Riesenbaum** mit neun Astplattformen als Spirale und einem Baumhaus obendrauf. |
| 3 | **Bergschlucht** | Grauer Fels, schmaler Sims unter Steinschlag, Fluss tief unten. Setpieces: die **Haengebruecke** (44 m, mit drehendem Balken) und der **Wasserfall** mit Durchgang dahinter in eine Kristallhoehle. Wassergischt in der Luft. |
| 4 | **Ruinen** | Warmer Sandstein, grosse Freitreppe, Saeulenhallen, Dornenrinne, Pendel, broeckelnde Bodenplatten, kreisende Plattform, eingestuerzter Turm. Staub in der Luft. |
| 5 | **Gipfel** | Schnee und Eis, Tempofeld auf dem Grat, Sprungfolge ueber Wolken, Schneepilz als Absprung auf das Gipfelplateau mit dem Ziel. Schneefall. |

Die Umgebung ist nicht nur Deko: der Stamm ist Huerde und Plattform, das
Huettendach eine Abkuerzung, der Wasserfall ein Durchgang, die Saeulen sind
Trittsteine, die Pilze ein Aufstieg, die Hoehle ein zweiter Weg.

Zwoelf Checkpoints liegen jeweils direkt vor den groesseren Passagen. Nach
einem Sturz geht es in gut einer Drittelsekunde weiter - **die Uhr laeuft
weiter**.

## Time Trial

Der Timer startet nach `BEREIT? 3 2 1 LOS!` und laeuft bis ins Ziel. An
jedem Checkpoint wird die Zwischenzeit mit dem eigenen Rekordlauf
verglichen und als `+0,42` bzw. `-1,13` eingeblendet.

Die Medaillenzeiten leiten sich aus der tatsaechlichen Streckenlaenge ab
(siehe `build()` in `src/level.js`), aktuell etwa:

| Medaille | Zeit | gedacht fuer |
| --- | --- | --- |
| Platin | 0:56.3 | nahezu perfekte Linie, Dash und Tempofeld voll genutzt |
| Gold | 1:07.0 | sicherer Lauf ohne Sturz |
| Silber | 1:21.6 | ein paar Stuerze |
| Bronze | 1:47.0 | erstes Durchkommen |

Die Strecke ist rund 960 Einheiten lang; die Figur laeuft 15 und sprintet 21
Einheiten pro Sekunde. Ein automatisierter Testlauf ohne jede Optimierung
braucht 48 s bei drei Stuerzen - ein sauberer Lauf liegt also gut im
Platinbereich, ein normaler Lauf bei anderthalb bis zwei Minuten.

Bestzeit, Zwischenzeiten, Kristalle und Stuerze liegen im `localStorage`
(`gipfelsprint.record.v1`).

## Kristalle

19 Stueck sind verteilt: ein Teil liegt auf der Strecke, der Rest auf einem
Huettendach, auf Trittsteinen neben der Bruecke, am versteckten Waldpfad, in
der Astspirale, auf Flussfelsen unter der Haengebruecke, hinter dem
Wasserfall, in der Kristallhoehle, auf der Tempelgalerie und frei in der
Luft ueber den Wolken. Sie sind optional - wer alle mitnimmt, verliert Zeit.

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

* **Rendering**: alle Objekte sind Instanzen von zehn Grundkoerpern
  (Quader, Kugel, grobe Kugel, Zylinder, Kegel, Saeule, Prisma, Kristall,
  Torus, Flaeche). Ein Draw-Call pro Koerperform und Stapel - die rund
  3000 statischen Objekte der Welt kosten also etwa zehn Aufrufe.
  Statische Geometrie wird einmal hochgeladen, bewegliche pro Frame.
* **Zonen**: jeder Abschnitt meldet Nebelfarbe, Nebeldichte, Himmels- und
  Umgebungslicht an. Die Werte werden nach Abstand gewichtet gemischt und
  pro Frame weich nachgezogen, dazu passende Umgebungspartikel.
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

| Manoever | Weite | Hoehe | Flugzeit |
| --- | --- | --- | --- |
| Laufsprung | 10,4 m | 3,0 m | 0,68 s |
| Sprintsprung | 14,5 m | 3,0 m | 0,68 s |
| kurz angetippt | 9,1 m | 1,6 m | 0,42 s |
| Sprint + Doppelsprung | 23,6 m | 5,3 m | 1,12 s |
| Dash + Sprung | 23,9 m | 3,0 m | 0,68 s |
| Dash + Sprung + Doppelsprung | 35,0 m | 5,3 m | 1,12 s |

Daraus folgt die Faustregel im Level: Landeflaechen sind mindestens 10
Einheiten tief, Luecken bis 8 sind Tempo-Huepfer, 9 bis 13 verlangen Sprint,
ab 16 braucht es den Doppelsprung. Waeren die Luecken kleiner, wuerde man bei
vollem Tempo ueber die Plattformen hinwegfliegen.

Geprueft wird das automatisiert: ein Testpilot simuliert die Physik ohne
Rendering und faehrt jeden Streckenabschnitt einzeln ab (`segments.js`-Muster
im Entwicklungsverlauf). Aktuell schafft er 47 von 48 Uebergaengen allein -
der eine Ausnahmefall ist der querliegende Baumstamm, ueber den er nicht
springt, weil er nur an Luecken springt.
