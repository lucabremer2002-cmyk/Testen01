# Gipfelsprint

Ein Time-Trial-Platformer: **ein Lauf vom Start ins Ziel, keine
Checkpoints**. Wer stuerzt, faengt sofort wieder vorne an - ohne Menue,
ohne Ladezeit. An drei Stellen teilt sich die Strecke in drei Wege, und der
schnellste ist immer der schwerste.

Alles eigenentwickelt und ohne Abhaengigkeiten: eigener WebGL2-Renderer,
eigene Kollisionsabfrage, prozeduraler Klang. Kein Framework, kein
Build-Schritt, keine Fremd-Assets.

## Spielen

`index.html` im Browser oeffnen. Wer lieber einen Server nutzt:

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
| `Strg` / `E` / linke Maustaste | Dash - kurzer harter Schub |
| Maus (nach Klick) / `←` `→` | Kamera drehen |
| `R` | Sofort neu starten |
| `G` | Geist ein/aus &nbsp; `M` Ton &nbsp; `P` / `Esc` Pause |

Ein Gamepad wird erkannt (linker Stick laufen, rechter Stick Kamera,
A springen, X/RT Dash).

## Der Kreislauf

Ein Lauf endet nur auf zwei Arten: im Ziel oder mit einem Sturz. Es gibt
keine Zwischenstaende. Nach einem Sturz blitzt das Bild kurz auf, und
keine drei Zehntelsekunden spaeter steht die Figur wieder am Start - der
Timer bei null, alle Kristalle zurueck, sofort steuerbar. Genau dieser
kurze Weg zurueck soll den Gedanken *nochmal* erzeugen.

Die **Zeittore** an den Abschnittsgrenzen sind keine Checkpoints: sie
nehmen nur die Zwischenzeit und zeigen sofort, ob man vor oder hinter dem
eigenen Rekord liegt.

## Drei Wege pro Abzweig

An jedem Abzweig stehen drei Wegweiser nebeneinander, farblich sortiert
und schon aus der Ferne zu sehen:

| | Farbe | Charakter |
| --- | --- | --- |
| **Sicher** | gruen | Breiter Umweg. Kaum Absturzgefahr, aber Sperrbalken und Pendel kosten Takt. |
| **Schnell** | gold | Kette aus Felspfeilern bzw. Saeulenkoepfen. Jeder Sprung muss sitzen, dafuer die direkte Linie. |
| **Irre** | rot | Luecken jenseits des Sprintsprungs. Nur mit Doppelsprung oder Dash-Sprung, dafuer traegt der Dash mit 40 Einheiten pro Sekunde. |

Die Abzweige liegen im **Canyon**, am **Wasserfall** und im **Tempel**.
Nach jedem Abzweig laufen alle drei Wege wieder zusammen, sodass man pro
Lauf drei unabhaengige Entscheidungen trifft - `Sicher / Irre / Schnell`
ist eine andere Route als `Schnell / Schnell / Irre`, und das Ergebnis
zeigt, welche man genommen hat.

Auf den riskanten Wegen liegen mehr Kristalle, einige davon frei in der
Luft mitten im Sprungbogen.

## Belohnung und Flow

Jede saubere Aktion gibt sofort Rueckmeldung - Ton, Partikel, kurze
Einblendung und ein Ausschlag im Flow-Balken:

| Meldung | wofuer |
| --- | --- |
| **Perfekter Absprung** | innerhalb von 0,14 s nach der Landung wieder abgesprungen |
| **Luftkombo** | Sprung, Doppelsprung und Dash in einem Flug |
| **Knapp** | an einer Kante gelandet, unter der nichts mehr ist |
| **Kette xN** | Kristalle im Abstand von hoechstens 2,6 s |
| **Vollgas** | ueber 3,2 s durchgehend schneller als 24 |
| **Irre Route** | den roten Weg genommen |

Der **Flow-Balken** steigt mit jeder Aktion und mit hohem Tempo, faellt
beim Stehenbleiben. Vier Stufen (Flow, Flow II, Flow III, Im Rausch)
erhoehen den Punktefaktor bis x2,5, faerben den Laufstaub und schalten ab
Stufe 3 Tempolinien frei. Der Timer bleibt trotzdem das Mass der Dinge -
Flow ist die Kuer.

## Zeitnahme, Geist und Fortschritt

Oben laufen die aktuelle Zeit und die Bestzeit mit. Sobald ein Rekordlauf
existiert, zeigt der **Geist** ihn als durchscheinende Figur, und die
Anzeige nennt laufend den Rueckstand bzw. Vorsprung (`-01,42`) - berechnet
aus der Position, nicht aus der Zeit, sodass man genau sieht, an welcher
Stelle man verliert. Der Bestlauf wird mit 20 Bildern pro Sekunde
aufgezeichnet.

Nach dem Ziel: Zeit, Differenz zur Bestzeit, Kristalle, gewaehlte Route,
Flow-Punkte und die Zwischenzeiten je Abschnitt mit ihrer Abweichung.

Dauerhaft gespeichert werden (`localStorage`, Schluessel
`gipfelsprint.record.v3`): Bestzeit samt Geist und Route, beste
Zwischenzeiten, meiste Kristalle, laengste Kristallkette, laengster Lauf,
Flow-Rekord, Anzahl der Laeufe und der Zieleinlaeufe.

### Medaillen

| Medaille | Zeit |
| --- | --- |
| Platin | 0:56.7 |
| Gold | 1:07.4 |
| Silber | 1:22.2 |
| Bronze | 1:47.6 |

Die Zeiten leiten sich aus der Streckenlaenge ab (`build()` in
`src/level.js`). Ein automatisierter Testlauf ohne Optimierung braucht
rund 50 s auf der schnellen Route.

## Bewegung

Unveraendert direkt - das war die Grundlage fuer alles andere:

* Aus dem Stand auf Sprinttempo (21) in knapp 0,09 s, Vollstopp in 0,11 s.
* Boden 100 %, Luft 44 % - Richtungswechsel sitzen am Boden sofort, in der
  Luft bleibt Schwung erhalten.
* Sprung 3,0 m hoch, 0,68 s Flugzeit; kurz angetippt nur 1,6 m.
* Dash: 0,15 s auf 40, waagerecht, mit Blickfeldstoss. Ein Sprung bricht
  den Dash ab und nimmt den Schwung mit.
* Coyote-Zeit 0,10 s, Sprungpuffer 0,12 s, Stufenhilfe bis 0,62 m.

Reichweiten (gemessen): Laufsprung 10,4 m | Sprintsprung 14,5 m | kurz
getippt 9,1 m | Doppelsprung 23,6 m | Dash-Sprung 23,9 m | Dash +
Doppelsprung 35 m.

Daraus folgt das Abstandsfenster im Level: Landeflaechen sind 7 bis 9
Einheiten tief, Luecken auf der schnellen Route 8 bis 10 (bei Tempo 15 bis
21 erreichbar, ohne bei Vollgas darueber hinauszuschiessen), auf der irren
Route 15 bis 16 (Sprintsprung reicht nicht mehr).

## Die Strecke

Sieben Bereiche mit eigener Farbwelt, eigenem Nebel und eigenen
Umgebungspartikeln, die beim Uebergang weich ineinander geblendet werden:

**Startwiese** &rarr; **Roter Canyon** (Abzweig 1) &rarr; **Tempo-Abfahrt**
&rarr; **Wasserfall und Fluss** (Abzweig 2) &rarr; **Kristallhoehle**
&rarr; **Tempelruinen** (Abzweig 3) &rarr; **Gipfel mit Schlusssprung**

Setpieces: die Pfeilerkette ueber dem Canyon, der Sprung durch den
Wasserfall in den Kristalltunnel, die enge S-Kurve durch die Hoehle, das
Aquaedukt hoch ueber dem Tempelhof und der Schlusssprung durch drei Ringe
auf das Gipfelplateau.

## Aufbau

```
index.html      Seite, HUD und Bildschirme
style.css       HUD, Menue, Ergebnis
src/math.js     Vektoren, 4x4-Matrizen, Zufall mit festem Startwert
src/render.js   WebGL2: Instanz-Shader, Himmel, Bloom
src/audio.js    Klangsynthese (Effekte und Begleitung)
src/input.js    Tastatur, Maus mit Pointer-Lock, Gamepad
src/physics.js  Kollisionswelt: Kapsel gegen gedrehte Quader, Stufenhilfe
src/ghost.js    Aufzeichnung und Wiedergabe des Bestlaufs
src/level.js    Streckenbaukasten, Abzweige, Requisiten, Zonen
src/player.js   Figur, Bewegungsmodell, Verfolgerkamera
src/game.js     Zustaende, feste 120-Hz-Simulation, Flow, HUD, Bestzeiten
```

### Technische Notizen

* **Rendering**: alle Objekte sind Instanzen von zehn Grundkoerpern. Ein
  Draw-Call pro Koerperform und Stapel - die rund 3000 statischen Objekte
  kosten etwa zehn Aufrufe.
* **Kollision**: stehende Kapsel, geprueft als drei Kugeln gegen
  achsparallele, um Y gedrehte Quader; Gitter-Breitphase; Bewegung in
  Teilschritten von hoechstens 0,3 Einheiten.
* **Routenerkennung**: unsichtbare Melder am Anfang jedes Astes; sie
  setzen die Routenanzeige und landen im Ergebnis.
* **Absturzgrenze**: 24 Einheiten unter dem naechstgelegenen Streckenpunkt,
  nicht eine feste Hoehe - so bleibt die Grenze ueberall passend.
* **Zeitnahme**: feste 120 Schritte pro Sekunde, unabhaengig von der
  Bildrate, sonst waeren Zeiten nicht vergleichbar.

### Was automatisiert geprueft wird

Ein Testpilot simuliert die Physik ohne Rendering und faehrt die Strecke
ab. Damit laesst sich pruefen, ob jeder Uebergang machbar ist, ob alle drei
Aeste jedes Abzweigs durchlaufbar sind und ob Sturz, Sofortneustart, Ziel,
Bestzeit und Geist funktionieren.

Was der Testpilot **nicht** kann: optimal fahren. Er bremst vor jedem
Zielpunkt ab, nimmt keine Abkuerzungen und setzt den Dash nur als
Notbremse ein. Seine Rundenzeiten sind deshalb eine Untergrenze fuer
Machbarkeit, kein Massstab dafuer, welche Route wirklich die schnellste
ist.
