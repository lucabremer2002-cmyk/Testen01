# Drucklauf

Ein 2D-Endlosrunner fuer den Browser – reines HTML, CSS und JavaScript, ohne
Framework, ohne Build-Schritt und ohne Abhaengigkeiten. Die beiden Schriften
kommen von Google Fonts; ohne Netzverbindung greifen Systemschriften, das
Layout bleibt gleich.

Das Spiel sieht aus wie ein Risographie-Druck: Der Bildschirm ist ein
Andruckbogen, auf dem die Welt in zwei Schmuckfarben gedruckt wurde. Der Name
ist doppeldeutig – ein Druckgang ist auch ein Lauf.

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
| `S` / `↓` | Rutschen, solange gehalten; in der Luft schneller fallen |
| `A` `D` / `←` `→` | Zuruecknehmen und vorpreschen (siehe unten) |
| `Shift` / `X` | Dash – kurzer Vorwaertsschub, zerlegt Kisten und macht kurz unverwundbar |
| `E` / `Q` | Hyper-Modus zuenden, sobald die Leiste voll ist |
| `P` / `Esc` | Pause |
| `R` | Neustart |
| `M` | Ton an/aus |
| `Enter` | Starten bzw. Pause aufheben |

**Gamepad** wird automatisch erkannt: A oder Steuerkreuz oben springt, X oder
Steuerkreuz unten rutscht, B und die Schultertasten sind der Dash, Y zuendet
den Hyper-Modus, der linke Stick und das Steuerkreuz lenken, Start pausiert.

**Beruehrung**: Die gesamte Spielflaeche ist die Sprungtaste – der Sprung
loest beim Aufsetzen des Fingers aus, laenger halten springt hoeher. Dazu
kommt eine Knopfreihe fuer Lenken, Rutschen, Dash und Hyper. Wischgesten auf
der Flaeche gehen ebenfalls: nach unten rutscht, nach rechts loest den Dash
aus, nach oben zuendet den Hyper-Modus.

## Auf dem Telefon

Das Spiel ist fuer Querformat gebaut – ein Endlosrunner braucht Blick nach
vorn, im Hochformat bleibt davon ein schmaler Streifen uebrig.

* **Quer halten.** Dann fuellt das Bild den Schirm randlos: keine Raender,
  keine Registermarken, keine Fusszeile. Gemessen auf einem 844 × 390
  grossen Schirm: 100 Prozent der Hoehe statt 25 Prozent im Hochformat.
* **Daumenzonen.** Im Querformat liegen die Lenkknoepfe unten links und
  Rutschen, Dash, Hyper und Springen unten rechts, halbdurchsichtig ueber dem
  Bild.
* **Vollbild.** Auf dem Startschirm gibt es einen Knopf, der ins Vollbild
  wechselt und dabei versucht, das Querformat festzuhalten. Wo der Browser
  das nicht erlaubt – etwa in einem eingebetteten Rahmen oder auf iPhones –
  verschwindet der Knopf von selbst.
* **Sparmodus.** Bleiben mehr als 40 Bilder in Folge unter 33 Millisekunden
  zurueck, fallen Wolken, Voegel, Baeume, Grasbueschel, Tempostriche und der
  groesste Teil der Nachziehspur weg, bis es wieder rund laeuft.
* Die Aufloesung der Zeichenflaeche ist auf Beruehrungsgeraeten auf das
  1,25-fache begrenzt; mehr bringt bei 960 Punkten Breite nichts und kostet
  nur Tempo.

### Zuruecknehmen und vorpreschen

Die Figur steht nicht starr auf einer Stelle. Mit `A` und `D` (oder dem Stick)
laesst sie sich zwischen 115 und 415 Pixeln Bildschirmposition verschieben:
zurueckgenommen sieht man mehr von der Strecke und hat mehr Zeit zum
Reagieren, vorgeschoben erreicht man eine Muenzreihe oder die andere Seite
einer Grube frueher. Ohne Eingabe gleitet die Figur langsam auf ihre
Grundposition zurueck.

### Wie sich die Steuerung verhaelt

Alle Eingabequellen – Tastatur, Finger, Gamepad – melden dieselben Aktionen an
dieselbe Schicht. Damit verhaelt sich jeder Sprung ueberall gleich:

* **Eingabepuffer (150 ms)** – wer kurz vor der Landung springt, springt bei
  der Landung. Auch ein zu frueh gedrueckter Dash wird nachgeholt.
* **Coyote-Time (120 ms)** – nach dem Verlassen einer Kante bleibt der Sprung
  noch kurz moeglich.
* **Mindesthaltezeit (55 ms)** – vorher wird ein Sprung nie gekappt. Ein
  kurzer Tipp ergibt darum immer denselben sichtbaren Huepfer (66 px), ein
  gehaltener Knopf den vollen Sprung (148 px).
* **Laengerer Scheitelpunkt** – nahe dem hoechsten Punkt wirkt nur 62 Prozent
  der Schwerkraft, beim Fallen dagegen 125 Prozent. Das gibt oben Zeit zum
  Zielen und unten einen zackigen Fall.
* **Kopffreiheit** – wer die Rutschtaste unter einer Drohne loslaesst, bleibt
  unten, bis wieder Platz ist, statt in das Hindernis aufzustehen.
* **Zeiger wird festgehalten** – rutscht der Finger vom Knopf, bleibt die
  Taste gedrueckt, statt den Sprung mitten im Flug abzuschneiden.
* Beim Fensterwechsel werden alle Tasten geloest, es klemmt nichts.

## Features

* **Endlose Strecke** aus neun Bausteintypen – flache Passagen, Gruben,
  Treppen aus Schwebeplattformen, Drohnenreihen, Saegen, Kistenwaende,
  Sprungfedern, Schatzabschnitte und ab mittlerer Schwierigkeit ein gemischter
  Abschnitt, der alle Hindernisarten hintereinander stellt. Jeder Baustein
  streut zusaetzliche Stacheln in seine freien Luecken.
* **Sieben Druckgaenge** mit je eigenem Farbpaar, die alle 650 Meter wechseln
  und ineinander ueberblenden: Weideland, Steinbruch, Nebeltal, Duenenzug,
  Hochmoor, Salzsee, Aschefeld.
* **Sprunggefuehl** mit variabler Sprunghoehe, Doppelsprung, Coyote-Time,
  Eingabepuffer und laengerem Scheitelpunkt – Eingaben gehen praktisch nie
  verloren, und jede Eingabequelle fuehlt sich gleich an.
* **Lenken** zwischen 115 und 415 Pixeln Bildschirmposition, um sich mehr Zeit
  zu verschaffen oder frueher am Ziel zu sein.
* **Gamepad-Unterstuetzung** ueber die Gamepad-API, ohne Einrichtung.
* **Sprungfedern** schleudern die Figur rund 300 Pixel hoch zu den hohen
  Muenzreihen und sind nie toedlich.
* **Broeckelnde Absaetze** tragen nach der Landung noch 450 Millisekunden.
* **Vier Power-ups**: Schild (faengt einen Treffer ab), Magnet (zieht Muenzen
  an), doppelte Punkte und Zeitlupe.
* **Hyper-Modus**: Muenzen und knappe Ausweichmanoever fuellen die Leiste. Ist
  sie voll, fliegt die Figur sieben Sekunden lang unverwundbar durch alles
  hindurch und kassiert dreifache Punkte.
* **Kombo-System**: Jede Muenze ohne Unterbrechung erhoeht den Multiplikator
  (bis x8), nach 2,6 Sekunden ohne Muenze faellt er zurueck.
* **Beinahe-Treffer**: Wer weniger als 26 Pixel an einem Hindernis
  vorbeikommt, bekommt Bonuspunkte, eine kurze Zeitlupe und Extraladung.
* **Prozeduraler Ton** ueber WebAudio – Effekte und ein Basslauf, dessen Tempo
  mit der Geschwindigkeit steigt. Kein Audiomaterial noetig.
* **Bestwert, weiteste Strecke und gesammelte Muenzen** werden im
  `localStorage` gesichert.

## Das Aussehen

Statt des ueblichen Neon-Looks ist die Darstellung als Risographie-Druck
gebaut – ein Vervielfaeltigungsverfahren, das mit wenigen, sehr kraeftigen
Schmuckfarben auf getoentem Papier arbeitet:

* **Papier statt Schwarz.** Der Grund ist warmes Papier, die dunkelste Farbe
  ist eine braunschwarze Tinte, nie reines Schwarz.
* **Zwei Schmuckfarben je Druckgang.** Sieben Tinten (Fluor-Pink, Orange,
  Gelb, Gruen, Aqua, Kobalt, Violett) ergeben sieben Farbpaare. Die Welt –
  Himmel, Huegel, Baeume, Erde – wechselt mit dem Druckgang die Farbe.
* **Die Akteure bleiben konstant.** Damit man sie ueberall erkennt: Gefahren
  sind immer Fluor-Pink, Muenzen immer Gelb, die Figur immer Kobaltblau,
  Sprungfedern immer Gruen. Bedeutung haengt nie von der Zone ab.
* **Tinten mischen sich.** Alles wird im Multiplikationsmodus gezeichnet,
  Ueberlagerungen ergeben echte Mischfarben. Vordergrundfiguren sparen vorher
  Papier aus, damit sie nicht mit dem Hintergrund nachdunkeln.
* **Fehlregister.** Die zweite Druckplatte liegt zwei bis drei Pixel versetzt
  und verrutscht bei jedem Zonenwechsel neu – auch in der Anzeige.
* **Rasterpunkte statt Verlaeufe** und **Papierkorn** ueber allem. Leuchten
  gibt es nirgends: Tinte leuchtet nicht.
* **Die Seite ist ein Andruckbogen** mit Registermarken in den Ecken und einem
  Farbkontrollstreifen unter dem Bild.
* **Schrift**: Anton als Plakatschrift fuer Titel und Einblendungen,
  Azeret Mono fuer alle Zahlen und Beschriftungen.

## Wertung

| Aktion | Punkte |
| --- | --- |
| Zurueckgelegte Strecke | 1 pro Meter |
| Muenze | 10 × Multiplikator |
| Power-up eingesammelt | 120 × Multiplikator |
| Knapp an einem Hindernis vorbei | 75 × Multiplikator |
| Kiste per Dash zerlegt | 40 × Multiplikator |
| Sprungfeder ausgeloest | 25 × Multiplikator |
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
  einzelnen Sprungs – gemessen ueber 669 erzeugte Gruben braucht die breiteste
  57 Prozent der Reichweite, jede Luecke ist ohne Doppelsprung ueberwindbar.
* Eine Platzierungspruefung haelt zwei Hindernisse mindestens 86 Pixel
  auseinander, und die ersten 120 Pixel einer Insel hinter einer Grube bleiben
  frei. Dichte gemessen: ein Hindernis alle 29 Meter in der Erzeugung, eine
  Muenze alle vier Meter.
* Objekte hinter der Kamera werden jeden Frame verworfen, die Partikelzahl ist
  auf 420 begrenzt.
* Der Hintergrund rechnet die Tintenmischung vorweg aus und zeichnet deckend,
  statt pro Form den Mischmodus zu wechseln; Wolken, Baeume, Voegel und
  Grasbueschel liegen in je einem gebuendelten Pfad, und die Rasterpunkte sind
  ein zwischengespeichertes Muster statt einer Flaechenueberlagerung.
  Papierkorn und Plattenkante liegen als CSS-Ebene ueber der Flaeche.
  Gemessen bei vierfach gedrosselter Rechenleistung: 37 statt 6 Bilder je
  Sekunde.
