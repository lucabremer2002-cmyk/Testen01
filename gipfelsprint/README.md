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
| Maus (ziehen oder nach Klick) / `←` `→` | Kamera drehen |
| `R` | Sofort neu starten |
| `G` | Geist ein/aus &nbsp; `M` Ton &nbsp; `P` / `Esc` Pause |

Ein Gamepad wird erkannt (linker Stick laufen, rechter Stick Kamera,
A springen, X/RT Dash).

### Am Handy

Beruehrung wird automatisch erkannt; dann erscheint die Bildschirm-
steuerung und die Tastenhilfe verschwindet.

| Geste | Wirkung |
| --- | --- |
| Linke Bildhaelfte ziehen | Schiebeknopf. Er erscheint unter dem Daumen und wandert mit, wenn man weit zieht. |
| Ganz durchgedrueckt | Sprint - eine eigene Taste gibt es nicht |
| Rechte Bildhaelfte wischen | Kamera drehen |
| Knopf unten rechts | Sprung; halten macht den Sprung hoeher, nochmal tippen ist der Doppelsprung |
| Knopf daneben | Dash |
| Knoepfe oben rechts | Neu starten, Pause |

Die Knoepfe leuchten, solange Sprung bzw. Dash bereit sind. Quer ist
angenehmer, noetig ist es nicht: im Hochformat weitet sich das Sichtfeld,
das HUD rutscht untereinander und der Hinweis oben laesst sich wegtippen.
Ueber **Vollbild** im Menue verschwindet die Browserleiste (klappt nicht in
jedem eingebetteten Rahmen und nicht auf iPhones).

Auf Beruehrungsgeraeten wird die Renderaufloesung auf das 1,2-fache der
CSS-Pixel gedeckelt - dreifache Pixeldichte kostet dort mehr Leistung als
sie bringt. Faellt die Bildrate laenger unter 40, schaltet sich zusaetzlich
Bloom ab.

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

| | Farbe | Charakter | gemessen |
| --- | --- | --- | --- |
| **Sicher** | gruen | Breiter Umweg, durchgehender Boden. Kaum Absturzgefahr, aber Sperrbalken und Pendel kosten Takt. Ohne Dash fahrbar. | 8,1 - 8,9 s |
| **Schnell** | gold | Kette in der Hoehe: Hochplateaus, Aquaedukt, Wasserfalltunnel. Luecken um 26 bis 32 m, jede braucht den Dash. | 6,9 - 7,7 s |
| **Irre** | rot | Wenige lange Anlaufflaechen, dazwischen Saetze von 25 m Kante zu Kante. Schnellster Weg, kleinster Fehlerspielraum. | 6,4 - 6,8 s |

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
Anzeige nennt laufend den Rueckstand bzw. Vorsprung (`-00:01.420`, im
selben Format wie die Uhr) - berechnet aus der Position, nicht aus der
Zeit, sodass man genau sieht, an welcher Stelle man verliert. Der Bestlauf
wird mit 20 Bildern pro Sekunde aufgezeichnet.

Nach dem Ziel: Zeit, Differenz zur Bestzeit, Kristalle, gewaehlte Route,
Flow-Punkte und die Zwischenzeiten je Abschnitt mit ihrer Abweichung. Es
gibt eine Zeile je Tor **plus eine fuer das Stueck vom letzten Tor ins
Ziel** - erst damit ergeben die Abschnitte zusammen die Gesamtzeit und die
Abweichungen zusammen den Gesamtrueckstand. Verglichen wird immer gegen
den **vorherigen** Rekord: vorher verglich sich ausgerechnet der beste
Lauf mit sich selbst und zeigte als einziger gar keine Vergleichswerte.

### Gemessen

| | |
| --- | --- |
| Uhr gegen echte Zeit seit dem Startsignal | Abweichung hoechstens 8,3 ms (ein Simulationsschritt), bei 30 wie bei 165 Hz |
| Uhr ueber 240 Schritte | 2,000 s |
| Sturz bis wieder steuerbar | 183 ms |
| Versteckte Zeit vor dem Signal oder nach dem Ziel | keine |

Der Countdown laeuft in echter Bildzeit und endet deshalb mitten in einem
Bild. Vorher zaehlte das ganze Bild als Laufzeit - bei 60 Hz bis zu 17 ms,
bei 30 Hz bis zu 33 ms, die niemand spielen konnte. Der Fehler war damit
**bildratenabhaengig**: ein 30-Hz-Spieler bekam bis zu 33 ms mehr auf die
Uhr als ein 120-Hz-Spieler. Jetzt wird der Zaehler beim Signal um genau
den Ueberhang vorgezogen, und die Abweichung liegt bei jeder Bildrate
unter einem Simulationsschritt.

Dauerhaft gespeichert werden (`localStorage`, Schluessel
`gipfelsprint.record.v3`): Bestzeit samt Geist und Route, beste
Zwischenzeiten, meiste Kristalle, laengste Kristallkette, laengster Lauf,
Flow-Rekord, Anzahl der Laeufe und der Zieleinlaeufe.

### Medaillen

| Medaille | Zeit |
| --- | --- |
| Platin | 0:41.4 |
| Gold | 0:49.3 |
| Silber | 1:00.1 |
| Bronze | 1:18.7 |

Die Zeiten leiten sich aus der Streckenlaenge ab (`build()` in
`src/level.js`) und sind am gemessenen Bestlauf geeicht: der Testpilot
faehrt die Strecke ueber die drei irren Aeste sturzfrei in **37,0 s**.
Platin liegt knapp darueber, wer einmal haengenbleibt faellt auf Gold.

Vorher lagen die Grenzen bei 0:56.7 bis 1:47.6 - aus einer Zeit, in der
derselbe Lauf 51 s mit dreizehn Stuerzen brauchte, weil die riskanten Wege
langsamer waren als der sichere.

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

Daraus folgt das Abstandsfenster im Level - und zwar anders, als es
zunaechst aussieht. Entscheidend ist nicht die Sprungweite, sondern der
Takt des Dashs: er klingt nach 0,7 s wieder auf und traegt dabei rund 22 m.

* **bis 16 m Kante zu Kante**: man springt ohne Dash und bleibt bei 21
  Einheiten pro Sekunde. Alle 0,8 s eine Landung, jede kostet Tempo - das
  ist der langsamste Bauzustand ueberhaupt, langsamer als einfach laufen.
* **18 bis 22 m**: jede Luecke braucht den Dash, ohne Reserve. Wer ihn
  einmal in der Luft zur Rettung verbraucht, faellt am naechsten Absprung.
  Dieses Band wird im Level gemieden.
* **ab 25 m mit Anlauf**: der Dash-Sprung ist der gemeinte Weg hinueber
  und traegt 38 statt 21 Einheiten pro Sekunde. Das ist der schnellste
  Bauzustand.
* **ueber 40 m**: nicht mehr erreichbar; nur als Schlussgleitflug mit
  deutlichem Hoehenverlust auf eine breite Flaeche.

Schwierigkeit kommt deshalb aus schmalen Landeflaechen und Hoehe, nicht
aus weiten Luecken. Weite ueber dem Dash-Takt kostet nur Zeit, weil das
Tempo ueber dem Limit zerfaellt, waehrend man fliegt.

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
src/input.js    Tastatur, Maus (Pointer-Lock oder Ziehen), Gamepad
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
* **Kamera ohne Pointer-Lock**: in einer eingebetteten Seite darf der
  Mauszeiger oft nicht eingefangen werden. Schlaegt es fehl, wird es nicht
  erneut versucht - stattdessen dreht Ziehen mit gedrueckter Maustaste die
  Kamera, und die Pfeiltasten tun es weiterhin auch.
* **Lesbare Lauflaechen**: im Canyon waren Wand und Weg beide warmrot -
  bei Tempo sah man nicht, worauf man treten kann. Begehbare Flaechen
  haben dort jetzt eine helle, sandfarbene Oberseite bei gleichbleibend
  roter Seite.
* **Fuelllicht gegen die Eigenfarbe**: roter Fels unter rotem Licht ergibt
  ein einfarbiges Bild. Im Canyon kommt das Licht von oben deshalb vom
  kuehlen Himmel, waehrend die Ruecklichtfarbe von unten warm bleibt -
  Schatten gehen ins Blaue, beleuchtete Flaechen ins Warme.
* **Bildschirmgroessen**: die Schriftgroessen im Ergebnis hingen nur an
  der Fensterbreite. Auf einem breiten, niedrigen Fenster liefen sie ins
  Maximum und die untere Haelfte lag unter dem Rand. Sie sind jetzt an
  beide Achsen gekoppelt (`min(vw, vh)`), dazu ein eigener Satz Werte
  unter 760 px Hoehe.
* **Figur**: gebaut aus wenigen, klar getrennten Farbflaechen - heller
  Helm mit dunklem Visier, blauer Koerper, Gold als Akzent, roter Schal.
  Viele kleine Farbflecken zerfallen bei Tempo. Statt einer Laufschleife
  fuer alles bekommt jede Lage eine eigene Haltung (stehen, laufen,
  steigen, fallen, Dash), zwischen denen geblendet wird; das Ruecken-Modul
  gibt ihr auch von hinten - der Standardsicht - eine Form.
* **Wasserfall**: mehrere unterschiedlich breite Straenge statt eines
  Vorhangs, ueberkippende Lippe, Gischt und Nebel am Fuss. Die Flaeche
  liegt in der x-y-Ebene und wird von -z gesehen; eine Rueckwand gehoert
  deshalb auf die +z-Seite und wird vom Aufrufer gesetzt (`backWall`),
  nicht mitgebaut - mitgebaut waere sie nur richtig, solange niemand den
  Fall dreht.
* **Plattformkanten**: eine Plattform endete als sauberer Quader - die
  auffaelligste Prototyp-Spur. Feste Plattformen ab 5 Einheiten
  Kantenlaenge bekommen jetzt eine ueberstehende Grasnarbe und einen Saum
  aus Brocken. Das ist reine Deko: der Koerper fuer die Physik bleibt der
  Quader darunter, sonst gingen Spruenge anders aus als vermessen.
  Bewegliche Plattformen bekommen nichts, ihre Deko bliebe stehen.
* **Felder und Verwerfen**: die Strecke ist ein langes Band und wurde als
  ein Stapel jedes Bild komplett gezeichnet, auch hinter dem Ruecken. Sie
  ist jetzt in Felder von 300 Einheiten zerlegt, jedes mit Huellkugel.
  Ein Feld faellt weg, wenn es weder in der Kamerapyramide noch im
  Schattenkasten liegt. Die Feldgroesse ist ein Kompromiss: kleinere
  Felder verwerfen genauer, kosten aber mehr Zeichenaufrufe - mit 110
  waren es 106 Felder und bis zu 850 Aufrufe, schlechter als vorher.
  Die Kugelpruefung fuer den Schattenkasten muss dessen Raumdiagonale
  abdecken, nicht nur die Breite: der Kasten reicht laengs der
  Sonnenrichtung weit hinter die Szene, sonst fehlen die Schatten hoher
  Koerper.
* **Schattenkarte**: ein eigener Zeichendurchgang schreibt die Tiefe aus
  Sicht der Sonne (2048, auf Beruehrungsgeraeten 1024). Der Kasten folgt
  dem Spieler, gerastert auf Texelschritte - sonst flimmern die Raender.
  Der Versatz gegen Selbstschatten laeuft ueber die Normale, nicht ueber
  die Tiefe; eine Tiefenverschiebung loest den Schatten sichtbar vom Fuss.
  Wolken und Fernberge werfen bewusst keinen Schatten.
* **Wind**: Muster 10 kennzeichnet schwingende Koerper (Grasbuechel). Der
  Ausschlag haengt an der echten Hoehe des Punktes, die Phase an seiner
  Weltposition - dadurch laufen Boeen ueber die Flaeche, statt dass alles
  im Gleichtakt wackelt. Der Schattendurchgang rechnet dieselbe Bewegung,
  sonst steht der Schatten still.
* **Gras**: Wiesen- und Waldplattformen bekommen ihre Halme automatisch
  ueber das Material. Haendisch gesetzt wurde es vergessen, sobald eine
  Plattform dazukam.
* **Farbaufbau**: jedes Material hat zwei Farben - `color` faerbt die
  Seitenflaechen, `accent` die nach oben zeigenden. Der Kontrast zwischen
  beiden macht Kanten sichtbar; sind sie zu aehnlich, wird eine Plattform
  zur flachen Flaeche. Deshalb ist die Seite immer dunkler und oft in
  anderem Farbton als die Oberseite (Erdkante zu Grasnarbe).
* **Umgebungslicht**: wird zur Haelfte entfaerbt und nur mit 0,44
  gewichtet, die Sonne dafuer mit 1,22. Kraeftig eingefaerbtes Fuelllicht
  zieht sonst jeder Flaeche ihre eigene Farbe weg und alles wird pastellig.
  Die Farbkraft kommt danach aus dem Nachbearbeitungsschritt: blasse
  Stellen werden stark angehoben, ohnehin kraeftige nur wenig, damit die
  Neonfarben nicht ins Weisse laufen.
* **Klassennamen am body**: auf Beruehrungsgeraeten bekommt `body` die
  Klasse `touch`. Regeln fuer das Steuerungs-Overlay muessen deshalb
  `#touchUI` ansprechen - ein blosses `.touch` traefe auch den body, und
  `pointer-events: none` wuerde sich auf die gesamte Oberflaeche vererben.
* **Beruehrung**: die linke Bildhaelfte liefert ueber einen nachziehenden
  Schiebeknopf dieselben Achsen wie Tastatur oder Stick, die rechte
  dieselben Kamerawinkel wie die Maus im Pointer-Lock. Die Knoepfe liegen
  als eigene Elemente darueber und stoppen ihre Ereignisse, damit die
  Flaeche darunter nichts davon mitbekommt.

### Bewegung: gemessen, nicht geschaetzt

Fuer das Bewegungsgefuehl gibt es einen eigenen Messstand. Er treibt
`game.frame()` mit kuenstlichen Zeitstempeln und gescripteter Eingabe und
misst damit die ganze Kette Eingabe -> fester Schritt, nicht nur die
Physik fuer sich. Aktuelle Werte:

| Groesse | Wert |
| --- | --- |
| Verschluckte Sprungbefehle (60/120/144/165 Hz) | 0 von 40 je Bildrate |
| Reaktion Tastendruck bis Steigen | 1 Schritt, 8,3 ms |
| Beschleunigen auf Sprinttempo | 0,12 s |
| Stehenbleiben aus Sprint | 0,09 s |
| Wenden um 90 / 135 / 180 Grad | 0,10 / 0,18 / 0,21 s |
| Coyote-Zeit | rund 100 ms |
| Sprungpuffer | rund 120 ms |
| Sprung: Hoehe / Scheitel / Flugzeit | 2,98 m / 0,38 s / 0,68 s |
| Luft, 0,3 s voll quer: Quertempo / Schwung erhalten | 100 % / 38 % |
| Dash am Boden je 3 s | 5 |

* **Eingaben werden gemerkt, bis ein Schritt sie verbraucht.** Die
  Simulation laeuft mit festen 120 Schritten je Sekunde. Auf einem
  schnelleren Bildschirm gibt es Bilder, in denen kein Schritt faellt -
  wurde der Tastendruck dort direkt in den Befehl geschrieben, war er weg,
  bevor ihn jemand gelesen hat. Gemessen: jeder sechste Sprung bei 144 Hz,
  jeder vierte bei 165 Hz.
* **Luftwerte und Leveldesign haengen zusammen.** Die schweren Aeste waren
  gegen sehr hohe Luftkontrolle gebaut. Wer die Kontrolle senkt, muss sie
  mitziehen - sonst sind sie nicht mehr befahrbar.
* **Der Testpilot haelt Drift vor**, zieht also die Querkomponente seiner
  Geschwindigkeit vom Zielpunkt ab. Ohne das schiesst er ueber jede
  Plattform hinaus und der Test misst den Piloten statt das Level.

### Kamera: ebenfalls gemessen

Ein zweiter Messstand laesst den Testpiloten die Strecke fahren und
protokolliert dabei jedes Bild die Kamera. Bilder waehrend eines
Todessturzes zaehlen nicht mit - dort ist der Lauf ohnehin vorbei.

| Groesse | vorher | jetzt |
| --- | --- | --- |
| Figur ausserhalb des Bildes | 1,99 % der Bilder | 0 % |
| Groesster Abstandssprung je Bild | 8,13 m | 3,71 m (1 Bild von 8155) |
| Zittern (mittlere Bildbeschleunigung) | 0,040 | 0,025 |
| Kamera in Geometrie | 0 % | 0 % |
| Sichtfeld senkrecht | 64,2 Grad | 72,2 / 74,4 / 78,1 Grad (Stand / Sprint / Dash) |
| Vorausschau | rund 1,9 m | 0 / 3,1 / 6,3 m |

* **Vorausschau gehoert an den Blickpunkt, nicht an den Umlaufpunkt.**
  Wird der Punkt vorgeschoben, um den die Kamera kreist, rutscht die Figur
  nach hinten aus dem Bild - gemessen an Tempofeldern, wo das Tempo
  schlagartig auf 36 springt. Am Blickpunkt bleibt sie im Bild und man
  sieht trotzdem frueher, was kommt.
* **Ausrichten bei Richtungswechsel**: die Rate war auf 4,2 gedeckelt, eine
  Kehrtwende dauerte damit dreiviertel Sekunden. Oberhalb Sprinttempo sind
  es jetzt bis 9,0.
* **Kollisionsabstand**: naeher heran sofort, wieder weg nur langsam. In
  beide Richtungen hart gesetzt sprang die Kamera um bis zu acht Meter,
  sobald der Strahl eine Kante streifte. Das harte Heranziehen bleibt
  bewusst - eine Kamera, die kurz im Fels steckt, ist schlimmer als ein
  einzelner Ruck, und uebrig ist genau ein Bild von 8155.

### Levelfluss: Leerlauf gemessen

Leerlauf heisst hier: die Figur laeuft am Boden geradeaus, ohne Sprung,
Dash, Luftphase, Kristall oder Tempofeld. Gemessen auf einem Lauf, der
wirklich ins Ziel kommt - mit einem Piloten, der auf halber Strecke
stirbt, misst man nur die Startwiese nach Neustarts.

| | vorher | jetzt |
| --- | --- | --- |
| Leerlauf gesamt | 9,3 s von 50,7 s (18 %) | 5,4 s von 51,0 s (10,6 %) |
| Laengste Strecke am Stueck | 37,6 m | 15,8 m (im Tempoabschnitt) |
| Startanlauf bis zur ersten Aktion | 25 m | 8,9 m |

* **Die toten Strecken lagen an den Zusammenfuehrungen.** Die grosse,
  bewusst sichere Landeflaeche nach einem Abzweig stiess unmittelbar an
  die Einstiegsflaeche des naechsten Abschnitts - zusammen ueber 40 m
  durchgehender Boden. Die Landung bleibt sicher, aber der Einstieg in den
  naechsten Abschnitt ist jetzt ein Sprung.
* **Der Tempoabschnitt bleibt absichtlich ruhig.** Die drei Strecken von
  13 bis 16 m dort liegen zwischen Tempofeldern; dort ist Geradeauslaufen
  der Inhalt, nicht der Mangel.
* **Nach Koordinaten suchen, nicht nach Namen.** Der erste Durchgang
  ordnete die Strecken ueber die naechstgelegene Zone zu. Das lag daneben,
  und die Korrekturen landeten an Stellen, die gar kein Problem hatten -
  sichtbar daran, dass sich nichts verbesserte.

### Messfallen, in die ich gelaufen bin

Zwei Tests haben mir gruenes Licht gegeben, das nichts wert war - beide
Male, weil die Messung am eigentlichen Vorgang vorbeiging:

* **Knopfdruck per JavaScript**: `element.click()` umgeht die
  Trefferpruefung des Browsers. Ein Knopf "funktioniert" damit auch dann,
  wenn ein Finger ihn nie erreichen koennte. Tests tippen deshalb wirklich
  (`page.tap`).
* **Bildvergleich ohne stehendes Bild**: zwei aufeinanderfolgende Bilder
  unterscheiden sich schon durch Wind, Kristalle, Tore und die
  nachlaufende Kamera - gemessen wurden bis zu 99 Prozent abweichende
  Pixel voellig ohne Aenderung. Ein Vergleich muss die Zeit einfrieren und
  warten, bis zwei Bilder hintereinander gleich sind; erst dann sagt die
  Abweichung etwas ueber die Aenderung aus.

### Warum sich die riskanten Wege lohnen

Sie taten es lange nicht. Gemessen war die riskante Linie an der ersten
Gabel 2,4 s **langsamer** als die sichere. Die Ursache war strukturell und
in einer Tabelle sofort zu sehen: jedes Astpaar hatte dieselbe Laenge und
denselben Netto-Hoehenverlust. Die riskanten Wege stiegen nur mehr und
fielen dafuer mehr - und das ist ein garantierter Verlust, weil Steigen
Tempo kostet, der Sturz davon 62 Prozent zurueckgibt und bei 46 gedeckelt
ist. Der schlimmste Fall stieg 27 m und fiel 27 m.

Daraus die Regel, nach der jetzt jede Gabel gebaut ist:

* **Sicher** geht weit aussen herum und baut die Hoehe in Stufen von drei
  Metern ab. Ein gehaltener Sprung steigt 2,8 m, man kommt also mit
  Aufprall 27 auf - die Rutschlandung braucht 30. Es gibt kein Tempo
  zurueck, nur einen ruhigen Weg.
* **Riskant** steigt nirgends, bleibt gerade und oben, und gibt die
  gesamte Hoehe am Ende in einem Sturz ab. Aufprall ueber 35, also rund
  22 Einheiten Tempo - und zwar genau vor dem naechsten Abschnitt, wo sie
  noch einmal Zeit sparen.

Beide verlieren dieselbe Hoehe. Der Unterschied ist, ob sie verteilt oder
gebuendelt abgegeben wird.

| Gabel | sicher | schnell | irre |
| --- | --- | --- | --- |
| Auftakt | 4,67 s / Tempo 26 | &ndash; | **3,72 s / Tempo 38** / 6 Kristalle |
| Sprungkette | 7,88 s / Tempo 39 | 7,91 s / Tempo 39 / 7 Kristalle | &ndash; |
| Grosse Gabel | 10,71 s / Tempo 17 | **7,77 s / Tempo 46** / 5 Kristalle | **7,76 s** / 14 Kristalle |
| Wasserfall | 7,19 s / Tempo 35 | &ndash; | **6,47 s / Tempo 38** / 3 Kristalle |
| Ruinen | 5,86 s / Tempo 38 | &ndash; | 5,95 s / 11 Kristalle |

Ueber den ganzen Lauf, mit demselben Testpiloten:

| Routenwahl | Zeit | Kristalle |
| --- | --- | --- |
| alles sicher | 56,82 s | 4 |
| gemischt riskant | **50,14 s** | 18 |
| alles riskant | 50,55 s | 39 |

Die Medaillen leiten sich aus der Streckenlaenge ab und passen dadurch von
selbst: Platin liegt bei 51,1 s. Ein sauberer Lauf ueber die sicheren Wege
reicht fuer Gold, Platin gibt es nur ueber die riskanten.

Zwei Dinge, die dabei nicht funktioniert haben und entfernt statt
kaschiert wurden: eine Abkuerzung auf der Tempostrecke, die sechs Meter
hinauf und wieder herunter fuehrte und gemessen 0,70 s **langsamer** war
als die Bahn selbst; und drei Sprungfelder, die Routen ueberhaupt erst
erreichbar machen sollten - wer mit Tempo ankam, flog im Bogen darueber
hinweg oder schlug seitlich gegen die Flanke der hoeheren Flaeche und
stand augenblicklich.

Offen: die Sprungkette und die Ruinen sind zeitlich ausgeglichen statt
schneller; sie zahlen nur in Kristallen. Der Ast durch die Wandschlucht
ist weiterhin ungeprueft, weil der Testpilot keine Wandspruenge kann.

### Selbsttest: die technische Basislinie

```
python3 -m http.server 8123 &
node tools/selftest.js
```

Sieben Messungen mit harten Schranken; wird eine gerissen, endet der Lauf
mit Code 1. Die Schranken stammen aus gemessenen Werten, nicht aus
Wunschdenken. Stand der Messung:

| Messung | Wert | Schranke |
| --- | --- | --- |
| Determinismus (2x 1200 Schritte, gleiche Eingabe) | **0 m** Abweichung | 0 |
| Laufuhr nach 10 s Wanduhr, 30 bis 165 Hz | Fehler **0,025 s** | 0,05 s |
| Spitzentempo, Streuung ueber die Bildraten | **0,5 %** | 6 % |
| Durchschlagene Waende (0,4-2,0 m dick, Tempo 30-70) | **0 von 25** | 0 |
| Ein Simulationsschritt | **0,023 ms** | 0,25 ms |
| Eine Anzeigenaktualisierung | **0,009 ms** | 0,10 ms |
| Heap-Zuwachs je Bild | **0 Byte** | 64 Byte |

Der Simulationsschritt kostet bei 120 Hz rund 2,8 ms pro Sekunde
Spielzeit, also knapp drei Promille einer Sekunde Rechenzeit.

### Entwicklerauskunft

**F3** blendet jeden Zustand ein, der einen Sprung entscheidet: Lage,
Tempo, Geschwindigkeitsvektor, Bodenkontakt, Luftzeit, verbleibende
Spruenge, Coyote-Zeit, Sprungpuffer, Dash-Vorrat und laufender Dash,
Rutschzustand samt Ermuedung, Wandkontakt, Kamera, Laufuhr samt Rest im
Zeitzaehler sowie Bildrate und gezeichnete Stapel.

Sie prueft zusaetzlich auf NaN in Spielerlage, Tempo, Kamera und Uhr und
schreibt einen Fund in die Konsole. Das ist kein Selbstzweck: ein NaN im
Kamerawinkel hat waehrend der Entwicklung einmal das gesamte Bild
unsichtbar gemacht, und die Ursache war ohne diese Anzeige nur ueber
Umwege zu finden.

Kosten: 0,00005 ms je Bild wenn aus, 0,018 ms wenn an. Sie liegt
ausserhalb des Simulationspfads und faengt keine Eingaben ab.

### Gemessene Zeichenlast

Bei 1280x720 an sechs Stellen der Strecke gemessen: **110 bis 195
Zeichenaufrufe** je Bild fuer **3000 bis 7600 Instanzen**, also rund 36
Instanzen je Aufruf. Die Ursache ist die Aufteilung in 80 raeumliche
Felder mal etwa neun Netztypen - jedes Paar ist ein eigener Aufruf.

Das ist keine gute Instancing-Ausnutzung. Es ist aber auch **kein
gemessenes Problem**: die Zeichenvorbereitung auf der CPU kostet 0,22 bis
1,56 ms von 16,7 ms Budget. Groessere Felder wuerden die Aufrufe senken
und das Verwerfen ungenauer machen. Solange die Zahl nicht drueckt, bleibt
sie, wie sie ist - die Zahl steht hier, damit eine spaetere Entscheidung
nicht bei null anfaengt.

### Bewusste technische Schuld

* **`src/game.js` ist mit rund 1300 Zeilen ein Monolith.** Er haelt
  Tastenbelegung, Simulationsschleife, Anzeige, Menues, Speicherstand,
  Partikel und Geist zugleich. Eine Aufteilung in eigene Einheiten waere
  sauberer, ist aber ein Umbau ohne gemessenen Nutzen - er wartet auf den
  Moment, in dem eine Aenderung daran tatsaechlich teuer wird.
* **Die Routen zahlen sich noch nicht in Zeit aus.** Gemessen ist die
  riskante Linie an der ersten Gabel 2,4 s langsamer als die sichere. Das
  ist ein offener Entwurfsfehler, kein technischer.
* **Drei Aeste sind ungeprueft**, weil der Testpilot weder Wandspruenge
  noch den Durchflug durch den Wasserfall beherrscht.

### Was automatisiert geprueft wird

Ein Testpilot simuliert die Physik ohne Rendering und faehrt die Strecke
ab. Damit laesst sich pruefen, ob jeder Uebergang machbar ist, ob alle drei
Aeste jedes Abzweigs durchlaufbar sind und ob Sturz, Sofortneustart, Ziel,
Bestzeit und Geist funktionieren.

Was der Testpilot **nicht** kann: optimal fahren. Er bremst vor jedem
Zielpunkt ab und nimmt keine Abkuerzungen. Seine Rundenzeiten sind eine
Untergrenze fuer Machbarkeit.

Zwei Fallen, in die ich dabei selbst getappt bin:

* Der Gesamtlauf-Bot hat den Dash lange **gar nicht benutzt**. Damit war
  jede Strecke, die er schaffte, zwangslaeufig eine, auf der man mit dem
  Dash auch nichts gewinnen kann - und genau das war jahrelang der Befund:
  alle riskanten Wege langsamer als der sichere.
* Der Routenpilot entschied den Dash an einer festen Meterzahl (`d2 > 18`).
  Im Band um 18 bis 22 m kippte er je nach Zufall hinein oder nicht, und
  Levelabstaende dort waren damit nicht messbar. Eine reichweitenbasierte
  Regel habe ich versucht und wieder verworfen - sie verpulverte den Dash
  auf kurzen Luecken. Die Schwelle steht wieder, und das unscharfe Band
  wird im Level gemieden.
