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

## Zwei Strecken

Im Menue laesst sich umschalten; die Wahl ueberlebt das Neuladen.

| | Kurzstrecke "Der Sturz" | Lange Strecke "Gipfelsprint" |
| --- | --- | --- |
| Dauer | 23 bis 26 s | 47 bis 69 s |
| Abschnitte | 3 | 8 |
| Abzweige | 2 | 6 |
| Vorgabe | **ja** | nein |

Die Kurzstrecke ist die Vorgabe, weil ein misslungener Lauf dort sofort
zum naechsten einlaedt. Sie ist um die eine Mechanik gebaut, die dieses
Movement von anderen unterscheidet: **Hoehe wird Tempo**. Wer mit
gedrueckter Rutschtaste aufkommt, rechnet 62 Prozent seiner
Aufprallgeschwindigkeit in Vortrieb um - ab sieben Metern Fall. Jeder
Sturz bezahlt dort den naechsten Sprung.

## Slalomstrecken: warum die sicheren Wege Tore haben

Gemessen war der sichere Weg der langen Strecke lange das schlechteste am
ganzen Projekt: **62 Prozent des Laufs ohne eine einzige Eingabe**, die
laengste tote Strecke 5,5 Sekunden am Stueck. Beide Alternativrouten lagen
bei 25 bis 27 Prozent. Und ausgerechnet den sicheren Weg nimmt ein
Anfaenger zuerst.

Die Ursache war ein Widerspruch aus der Routenarbeit: um die
Zeithierarchie zu bekommen, waren die sicheren Wege flach, lueckenlos und
gerade gebaut. Das ergibt verlaesslich langsame Wege - und damit per
Konstruktion leere Korridore.

Die Aufloesung ist **Lenken statt Springen**:

* Sprungketten heben ab, und in der Luft zerfaellt Tempo mit 2,5 statt 7
  Einheiten je Sekunde. Sie machen einen Weg also SCHNELLER.
* Lenken haelt den Laeufer am Boden. Es ist die einzige Handlung, die
  einen sicheren Weg beschaeftigt, ohne ihn schnell zu machen.

Vier Slalomstrecken (Grosse Gabel, Wandschlucht, Wasserfall, Ruinen), je
ein Tor alle 20 bis 30 Meter. Jedes Tor sperrt eine Seite des Korridors,
die offene Seite wechselt - die Linie MUSS schwingen.

| | vorher | nachher |
| --- | --- | --- |
| laengste Leere | 5,5 s | 2,0 s |
| Leerlaufanteil | 62 % | 30 % |
| sicherer Lauf | 60,7 s | 69,1 s |

Zwei Zugestaendnisse an die Fairness stecken darin: der
Kollisionskoerper ist an der Durchfahrtskante 1,2 m schmaler als die
sichtbare Mauer (derselbe Kniff wie die Nachfrist an einer
Absprungkante - was knapp aussieht, geht knapp durch), und die
Durchfahrt misst 58 statt 50 Prozent der Korridorbreite.

Vier Fehlschlaege auf dem Weg dorthin, alle im Code vermerkt: einzelne
Nadeln links und rechts liessen die MITTE frei (null Grad Kursaenderung
ueber die ganze Strecke); das Messwerkzeug zaehlte nur Spruenge und
Dashes, hielt einen Slalom bei Tempo 40 also fuer genauso leer wie einen
geraden Korridor; der Slalom stand nur in `routeMark`, der sichere Weg
folgt aber dem Spine; und ein Rechenfehler machte bei jedem ZWEITEN Tor
die Mauer so breit wie die Oeffnung sein sollte.

## Rauschgrenze: wenn ein Sturz ueber den Deckel traegt

Gemessen lag das Tempo im ganzen Lauf bei 36 bis 40 und beruehrte den
Deckel von 46 genau zweimal - durchgehend schnell und deshalb ohne jede
Dynamik. Eine Belohnung, die man nicht sieht, ist keine.

Ab Aufprall 36 (rund zehn Meter Fall) steigt die Hoechstgeschwindigkeit
fuer 1,6 s auf **56**. Sie ist ausschliesslich durch Koennen zu bekommen:
man muss hoch gewesen sein UND die Rutschtaste im richtigen Moment
halten. Danach faellt das Tempo normal zurueck - wer den Rausch nicht in
Strecke umsetzt, verliert ihn.

## Gemessene Reaktionszeiten

`node tools/reaktion.js` - ein Schritt sind 8,3 ms.

| | |
| --- | --- |
| erste Bewegung | 1 Schritt |
| Sprung setzt ein | 1 Schritt |
| Dash setzt ein | 1 Schritt |
| Wende, Richtung kippt | 13 Schritte |
| Sprungpuffer (Nachsicht) | 120 ms |
| Nachfrist Kante (Nachsicht) | 100 ms |

Die drei Kernaktionen antworten im naechsten Simulationsschritt. Puffer
und Nachfrist sind keine Verzoegerung, sondern Fenster, in denen eine zu
frueh oder zu spaet gedrueckte Taste trotzdem zaehlt - gross ist dort gut.

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

| | Farbe | Charakter | Anteil der sicheren Zeit |
| --- | --- | --- | --- |
| **Sicher** | gruen | Flach, gerade, durchgehender Boden. Keine Luecke, keine Stufe, keine Stelle, an der man faellt - und genau deshalb langsam: auf dem Boden zerfaellt Tempo dreimal schneller als in der Luft. | 100 % |
| **Schnell** | gold | Weite Luecken auf Einstiegshoehe, ein Sturz am Ende. Man ist ueberwiegend in der Luft und haelt dort sein Tempo. | 75 - 85 % |
| **Irre** | rot | Dieselbe Idee, auf die Spitze getrieben: schmale Flaechen, 24 bis 30 m Luecke, Luftanteil ueber 0,85. Kuerzeste Zeit, kleinster Fehlerspielraum. | 65 - 75 % |

Es gibt **sechs** Abzweige (Auftakt, Sprungkette, Grosse Gabel,
Wandschlucht, Wasserfall, Ruinen); die Grosse Gabel hat als einzige alle
drei Wege nebeneinander. Nach jedem Abzweig laufen sie wieder zusammen -
pro Lauf trifft man also sechs unabhaengige Entscheidungen, und die
Gesamtzeit zeigt, welche.

Gemessen ueber alle 96 gueltigen Kombinationen: **60,74 s** wer ueberall
sicher geht, **46,77 s** wer ueberall die Alternative nimmt. Die
schnellste Kombination ist genau die, die jede einzelne Abzweigung
riskiert - es gibt keine Stelle, an der sich der sichere Weg lohnt.

Auf den riskanten Wegen liegen mehr Kristalle, einige davon frei in der
Luft mitten im Sprungbogen. Sie sind Dash-Ladungen, kein Tempo: kein Weg
im Level bekommt Geschwindigkeit geschenkt.

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
| Platin | 0:51.5 |
| Gold | 0:54.1 |
| Silber | 1:02.8 |
| Bronze | 1:22.4 |

Die Zeiten leiten sich aus der Streckenlaenge ab (`build()` in
`src/level.js`) und sind an allen 96 Routenkombinationen geeicht: der
Testpilot faehrt die sichere Linie sturzfrei in **60,74 s**, die beste
Kombination in **46,77 s**.

Die Faktoren sind so gesetzt, dass die Medaille die **Routenwahl** misst
und nicht die Ausdauer. Am Testpiloten ueber alle 96 Kombinationen:

| Medaille | erreichen |
| --- | --- |
| Platin 51,5 s | 27 von 96 - das obere Drittel |
| Gold 54,1 s | 57 von 96 - gute Routenwahl, nicht perfekte |
| Silber 62,8 s | 96 von 96, auch der komplett sichere Lauf (60,74 s) |
| Bronze 82,4 s | ankommen genuegt |

Vorher schafften mit Gold bei 61,3 s **alle 96** Kombinationen mindestens
Gold, den sicheren Lauf eingeschlossen - eine Medaille, die jeder bekommt,
sagt nichts. Der Testpilot bremst zudem vor jedem Wegpunkt ab; ein Mensch,
der die Linie kennt, liegt unter diesen Zeiten.

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

Sie taten es lange nicht. Die Ursache war strukturell und in einer Tabelle
sofort zu sehen: jedes Astpaar hatte dieselbe Laenge und denselben
Netto-Hoehenverlust. Die riskanten Wege stiegen nur mehr und fielen dafuer
mehr - ein garantierter Verlust, weil Steigen Tempo kostet, der Sturz
davon 62 Prozent zurueckgibt und bei 46 gedeckelt ist.

Beim Nachmessen kam heraus, dass die Frage falsch gestellt war. Der
einzige nennenswerte Hebel ist nicht die Hoehe, sondern der **Bodenkontakt**:

* auf dem Boden zerfaellt Ueberschusstempo mit 7 Einheiten je Sekunde,
* in der Luft mit 2,5.

Gemessen ueber 240 m: durchgehender Boden ergibt Schnitt 20, eine Kette
mit 12 m Luecke ergibt 43 - **mehr als das Doppelte, bei gleicher Strecke
und gleicher Hoehe.** Daraus die Regel, nach der jetzt jede Gabel gebaut
ist:

* **Sicher** ist flach, gerade und ununterbrochen. Keine Luecke, keine
  Stufe, kein Tempofeld. Er ist langsam, weil man auf ihm laeuft.
* **Schnell und riskant** bleiben auf Einstiegshoehe, haben weite Luecken
  und geben ihre Hoehe erst am Ende in einem Stueck ab (Aufprall ueber 35,
  die Rutschlandung braucht 30).

Drei Annahmen, die dabei widerlegt wurden - alle drei hatte ich fuer
selbstverstaendlich gehalten:

1. **Kleine Stufen bremsen.** Sie tun das Gegenteil. Eine Treppe mit 3-m-
   Stufen machte den sicheren Weg durch die Wandschlucht *schneller*
   (8,58 s auf 7,13 s), weil jede Stufe den Laeufer abheben laesst.
2. **Ein weiterer Bogen macht laenger und damit langsamer.** Auch falsch:
   jeder Seitenversatz hebt an der Kante ab. Der weite Bogen in den Ruinen
   war schneller als der enge (6,58 s statt 6,93 s).
3. **Der Regler ist stufenlos.** Ist er nicht. In den Ruinen: kein Spalt
   = 10,50 s, vier Meter Spalt = 6,43 s. Dazwischen liegt nichts.

Entfernt statt kaschiert wurden dabei alle kuenstlichen Tempoquellen: die
zwei Tempofelder auf dem sicheren Weg der grossen Gabel (sie hoben ihn auf
27 und 29 an und nahmen dem roten Weg seinen Lohn) und das Sprungfeld am
Wasserfall (Kraft 44, dahinter ein Anstieg auf +8, der den Schub wieder
auffrass - die Route war damit *langsamer* als die Bruecke).

#### Gemessen, je Gabel gegen denselben sicheren Anlauf

`node tools/routen-lohnen.js`

| Gabel | sicher | Alternative | Anteil | Luftanteil sicher/alt |
| --- | --- | --- | --- | --- |
| Auftakt | 4,67 s | **3,72 s** schnell | 79,7 % | 0,52 / 0,81 |
| Sprungkette | 9,59 s | **7,90 s** schnell | 82,4 % | 0,41 / 0,80 |
| Grosse Gabel | 9,26 s | **7,59 s** schnell | 82,0 % | 0,34 / 0,84 |
| Grosse Gabel | 9,26 s | **6,81 s** irre | 73,5 % | 0,34 / 0,88 |
| Wandschlucht | 8,72 s | **7,36 s** schnell | 84,4 % | 0,22 / 0,90 |
| Wasserfall | 6,83 s | **5,61 s** schnell | 82,1 % | 0,29 / 0,66 |
| Ruinen | 8,28 s | **6,04 s** irre | 72,9 % | 0,27 / 0,76 |

Sollband: **schnell 80 bis 85 %, irre 65 bis 75 %.** Alle Gabeln liegen
darin, bis auf den Auftakt mit 79,7 % - zwei Hundertstelsekunden daneben.

Jede Gabel wird gegen denselben Anlauf gemessen: nur *eine* wird
umgestellt, alles davor und dahinter bleibt sicher. Anders ist der
Vergleich wertlos, denn ein Abschnitt, in den man mit Tempo 38 statt 26
hereinkommt, ist schon deshalb schneller.

Die Schilder sagen, was die Uhr sagt: was in 80 bis 85 % der Zeit laeuft,
steht auf Gold; 65 bis 75 % steht auf Rot. Die Wandschlucht, der
Wasserfall und der Auftakt sind deshalb von Rot auf Gold gewechselt - sie
sind schnelle Wege, keine Expertenrouten, und ein rotes Schild haette
etwas versprochen, das die Messung nicht deckt. Rot tragen nur noch zwei
Wege, und beide loesen es ein: die Dash-Kette der grossen Gabel (73,5 %)
und die obere Linie in den Ruinen (72,9 %).

#### Die grosse Gabel: drei Stufen, nicht zwei

Sie ist die einzige Gabel mit allen drei Wegen nebeneinander, und lange
war sie die schwaechste: sicher 10,62 s, schnell 8,02 s (75,5 %), irre
6,86 s (64,6 %) - die beiden Alternativen lagen 1,2 s auseinander, aber
beide im falschen Band, und der Spieler las sie als "zwei Varianten von
schnell" statt als zwei Stufen.

Zwei Versuche schlugen dabei fehl, beide lehrreich:

1. **Dem irren Weg einen Sturz schenken.** Der Zusammenfluss wurde acht
   Meter tiefer gelegt, damit nur er ueber die Schwelle von 30 faellt
   (Aufprall 35,8 gegen 27,7 und 22,6). Gemessen kehrte das die
   Reihenfolge um: schnell 6,79 s, irre 6,90 s. Grund ist `SPEED_CAP`:
   beide Alternativen haengen zu fast 90 % in der Luft und stehen dort
   ohnehin am Deckel (der schnelle Weg kam mit 45,9 heraus). Eine
   Rutschlandung kann nichts draufrechnen, was schon am Anschlag ist.
   **Ein Sturz belohnt nur einen langsamen Weg; zwischen zwei schnellen
   trennt er nicht.**
2. **Den irren Weg weiter kuerzen.** Weniger, weiter auseinander liegende
   Flaechen sparen Landungen, kosten aber mehr Flugzeit, als sie sparen -
   und ab 30 m Luecke ist der Weg unpassierbar (sieben Stuerze). Sein
   Boden liegt bei 6,81 s.

Die Loesung lag beim sicheren Weg, und dafuer brauchte es einen Regler,
den es vorher nicht gab. Die Spaltzahl ist ein Schalter (durchgehend
12,28 s, ein Spalt 10,62 s, zwei Spalte 9,04 s), die Spaltbreite wirkt gar
nicht (5, 8 und 12 m ergaben dreimal exakt 9,18 s). Stufenlos wird es
erst, wenn die **Ideallinie auf einer durchgehenden, breiten Flaeche im
Zickzack** laeuft: das verlaengert den Weg, ohne den Laeufer abheben zu
lassen.

| Amplitude | 0 m | 2 m | 3 m | 4 m | 8 m | 12 m | 16 m |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zeit | 9,04 s | 9,26 s | 9,43 s | 9,59 s | 10,57 s | 11,21 s | 12,04 s |
| Luftanteil | 0,35 | 0,34 | 0,34 | 0,34 | 0,26 | 0,24 | 0,23 |

Der Luftanteil faellt dabei, statt zu steigen - genau umgekehrt zu
versetzten Einzelflaechen, die den Laeufer an jeder Kante abheben lassen
und deshalb SCHNELLER machen. Mit zwei Metern Amplitude steht die Gabel
auf:

| Weg | Zeit | Anteil | Luftanteil |
| --- | --- | --- | --- |
| **sicher** (gruen) | 9,26 s | 100 % | 0,34 |
| **schnell** (gold) | 7,59 s | 82,0 % | 0,84 |
| **irre** (rot) | 6,81 s | 73,5 % | 0,88 |

`node tools/gabel-pruefen.js` faehrt sie unter jedem moeglichen Anlauf.
Das ist die sinnvolle Form von "mehrfach messen": die Simulation ist
deterministisch (Selbsttest, Abweichung 0 m), zweimal derselbe Lauf gibt
zweimal dieselbe Zahl - was sich wirklich aendert, ist das Eingangstempo.

| Anlauf | sicher | schnell | irre |
| --- | --- | --- | --- |
| sicher / sicher | 9,27 s | 7,59 s (81,9 %) | 6,81 s (73,5 %) |
| schnell / sicher | 9,27 s | 7,59 s (81,9 %) | 6,81 s (73,5 %) |
| sicher / schnell | 9,12 s | 7,57 s (83,0 %) | 6,72 s (73,7 %) |
| schnell / schnell | 9,12 s | 7,57 s (83,0 %) | 6,72 s (73,7 %) |

Die Reihenfolge gilt bei jedem Anlauf, sturzfrei, und die Anteile
schwanken um hoechstens 1,1 Punkte.

#### Alle 96 Kombinationen

`node tools/routen-alle.js` faehrt jede gueltige Routenwahl einmal durch.
96 von 96 kommen sturzfrei an.

| Routenwahl | Zeit |
| --- | --- |
| alles sicher | 60,74 s |
| beste Kombination | **46,77 s** |

Fuenfzehn Sekunden auf einen Lauf von einer Minute - und die schnellste
Kombination ist genau die, die ueberall die Alternative nimmt. Jede
einzelne Entscheidung zahlt sich also aus.

Dieser Test existiert, weil die Messung Gabel fuer Gabel eine Stelle
uebersehen hat: die Dash-Kette der grossen Gabel war ueber den sicheren
Anlauf passierbar und ueber den schnellen nicht. Sie verlangte vier Meter
Anstieg auf die erste Flaeche, und wer mit Tempo 45,9 statt 39,1 ankam,
verfehlte sie - sieben Stuerze, kein Durchlauf. Dieselbe Falle steckte in
der Wandschlucht (4,2 m Anstieg auf Flaechen von 6 x 11 m, bei einer
gemessenen Doppelsprunghoehe von 4,91 m; diese Route war nie passierbar)
und am Wasserfall. Daher jetzt als Regel: **riskante Wege steigen
nirgends.**

Die Medaillen sind daran geeicht: Platin liegt bei 51,5 s und ist nur
ueber die schnellen und riskanten Wege zu holen; Gold bei 61,3 s ist
knapp schneller als ein vollstaendig sicherer Durchlauf. Wer nirgends
etwas wagt, bekommt Silber.

#### Deko darf keinen Lauf beenden

Ein Lauf blieb reproduzierbar an derselben Stelle stehen: Tempo 0,
unbeweglich, ohne zu sterben, bis die Zeit ablief. Ursache war ein Block
von 3 x 3 x 1,6 m mitten auf der ersten Flaeche der oberen Linie in den
Ruinen - Streudeko, die `ruinWall` als echten Kollisionskoerper baut und
die 9 bis 16 m neben die Ideallinie gesetzt wird. Solange die obere Linie
auf x 11 lag, ging sie zufaellig daran vorbei; auf x 5 nicht mehr.

`Builder.block` kennt dafuer jetzt `ghost`: was waehrend seiner Gueltigkeit
gebaut wird, ist durchlaessig. Streudeko in Wegnaehe ist damit rein
sichtbar. Ein Level darf aussehen, wie es will - einen Lauf beenden darf
nur Geometrie, die jemand mit Absicht dorthin gesetzt hat.

### Die Pruefwerkzeuge

Alle messen ohne Rendering und sind in Sekunden durch. Ohne `MR_SATZ`
messen sie die LANGE Strecke.

| Aufruf | misst |
| --- | --- |
| `node tools/selftest.js` | Determinismus, Laufuhr, Bildratenunabhaengigkeit, Tunneln, Kosten je Bild |
| `node tools/routen-alle.js` | alle 96 Routenkombinationen auf Durchlaufbarkeit |
| `node tools/routen-lohnen.js` | Zeitvorteil je Abzweig gegen denselben Anlauf |
| `node tools/spielgefuehl.js [wahl]` | Zeitleiste: Leerlauf, Tempo, Lenkarbeit, Vollbremsungen |
| `node tools/reaktion.js` | Eingabeverzoegerung je Kernaktion |
| `node tools/bestzeit.js` | Wiederspiel-Schleife: Bestzeit, Geist, laufender Rueckstand |
| `node tools/gabel-pruefen.js` | die dreifache Gabel unter jedem Anlauf |
| `MR_SATZ=sturz node tools/...` | dasselbe auf der Kurzstrecke |

Was sie **nicht** koennen: sagen, ob das Spiel Spass macht. Der Testpilot
folgt Wegpunkten ohne Vorausschau - er weicht nicht aus, sammelt nicht und
waehlt keine Linie. Seine Lenkarbeit ist eine Untergrenze, seine
Zusammenstoesse sind kein Beweis fuer Unfairness. Ein gruener Selbsttest
heisst: die Technik funktioniert. Mehr nicht.

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
* **Der Auftakt liegt 0,3 Punkte unter seinem Band** (79,7 % statt 80 bis
  85 %). Der Unterschied betraegt zwei Hundertstelsekunden auf 4,67 s und
  ist mit den vorhandenen Reglern nicht feiner einstellbar - beide Aeste
  dort sind schon so gebaut, wie sie sein sollen.

### Was automatisiert geprueft wird

Ein Testpilot simuliert die Physik ohne Rendering und faehrt die Strecke
ab. Damit laesst sich pruefen, ob jeder Uebergang machbar ist, ob alle drei
Aeste jedes Abzweigs durchlaufbar sind und ob Sturz, Sofortneustart, Ziel,
Bestzeit und Geist funktionieren.

Er beherrscht inzwischen auch den **Wandsprung**: sobald er in der Luft
eine Wand beruehrt und die Nachfrist laeuft, drueckt er Sprung und zielt
zum naechsten Wegpunkt. Vorher war die Wandschlucht als "ungeprueft"
markiert. Das Bemerkenswerte daran: mit dieser Faehigkeit war sie
*weiterhin* nicht passierbar - die Spur zeigte, dass er die Absaetze gar
nicht erreichte, weil sie 4,2 m ueber dem Einstieg lagen. Nicht das
Koennen fehlte, sondern die Route war unmoeglich gebaut. Eine Faehigkeit
nachzuruesten hat hier also nicht die Luecke im Test geschlossen, sondern
einen Entwurfsfehler sichtbar gemacht.

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
