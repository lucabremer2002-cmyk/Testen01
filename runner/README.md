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

**Beruehrung**: Die Spielflaeche ist in zwei Zonen geteilt – **linke Haelfte
rutschen, rechte Haelfte springen**. Beide loesen beim Aufsetzen des Fingers
aus, halten laesst hoeher springen beziehungsweise laenger rutschen, und beide
Daumen duerfen gleichzeitig liegen. Uebrig bleiben vier kleine Knoepfe: Lenken
unten links, Dash und Hyper unten rechts. Wischgesten gehen zusaetzlich: nach
rechts loest den Dash aus, nach oben den Hyper-Modus, nach unten wechselt vom
Sprung aufs Rutschen.

## Auf dem Telefon

Das Spiel ist fuer Querformat gebaut – ein Endlosrunner braucht Blick nach
vorn, im Hochformat bleibt davon ein schmaler Streifen uebrig.

**Am besten zum Startbildschirm hinzufuegen.** Dann startet es ueber die
Manifestdatei direkt im Vollbild und im Querformat, ohne Browserleiste und
ohne Vollbildknopf – das ist die groesste Spielflaeche, die geht. Auf dem
Startbildschirm steht das Symbol des Spiels: zwei versetzt gedruckte
Schmuckfarben, deren Ueberlappung die ausgerechnete Mischfarbe traegt
(`multiply(#ff4f9a, #00a6a0) = #003360`) – dasselbe Fehlregister, das die
Figur und die Anzeige im Spiel zeigen.

* **Quer halten.** Dann fuellt das Bild den Schirm randlos: keine Raender,
  keine Registermarken, keine Fusszeile. Gemessen auf einem 844 × 390
  grossen Schirm: 100 Prozent der Hoehe statt 25 Prozent im Hochformat.
* **Zwei Zonen statt vieler Knoepfe.** Die beiden Bewegungen, die im Takt
  sitzen muessen, bekommen je eine Bildschirmhaelfte: die groesstmoegliche
  Trefferflaeche, kein Zielen noetig, keine Verzoegerung durch
  Gestenerkennung, und beide Daumen duerfen gleichzeitig liegen. Nur die
  selteneren Befehle sind Knoepfe – und der Hyper-Knopf bleibt gedaempft, bis
  die Leiste voll ist.
* **Kurzes Ruetteln** ueber die Vibration-API bei den wenigen Momenten, die es
  tragen: Tod, Hyper-Modus, erfuellter Auftrag, passierte Bestmarke. Nicht bei
  jedem Sprung, und aus, wenn der Ton aus ist.
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

### Die Strecke waechst mit

Jede Hindernisart wird einzeln eingefuehrt, einmal erklaert und mischt sich
erst danach unter die anderen. Der Anfang ist dadurch ruhig, und die Strecke
wird ueber die ersten drei Kilometer stetig voller:

| ab | neu | Loesung |
| --- | --- | --- |
| 0 m | nur Boden und Muenzen | – |
| 120 m | Stacheln | drueberspringen |
| 280 m | Gruben | Taste halten springt weiter |
| 460 m | Kisten | Dash zerlegt sie |
| 680 m | Drohnen | drunter durchrutschen |
| 950 m | Sprungfedern | hoch zu den Muenzen |
| 1250 m | Saegen | den richtigen Moment abwarten |
| 1600 m | Tore | durch die Luecke oder durchdashen |
| 2000 m | Hebebuehnen | mitfahren |
| 2450 m | muerbe Absaetze | nicht stehenbleiben |
| 3000 m | alles gemischt | viel Glueck |

Gemessen ueber die erzeugte Strecke: 0 Hindernisse je 100 Meter auf den ersten
200 Metern, dann 2,0 – 2,9 – 3,1 – 4,0 – 4,4. Die Geschwindigkeit steigt von
310 auf 980 Pixel je Sekunde und braucht dafuer knapp drei Kilometer.

### Auftraege und Rang

Drei Auftraege laufen immer mit, ueberdauern den Tod und werden nach
Erfuellung durch etwas groessere ersetzt. Auch ein missratener Lauf bringt
einen davon ein Stueck weiter – es gibt also immer einen Grund fuer den
naechsten Versuch, nicht nur die Punktzahl.

* Zehn Auftragsarten, teils fuer einen einzelnen Lauf (Muenzen, Strecke,
  Kombo, knappe Ausweichmanoever, Sprungfedern, Dash-Treffer, Punkte,
  Hyper-Modi), teils ueber alle Laeufe hinweg (Muenzen gesamt, Meter gesamt).
* Jeder erfuellte Auftrag zaehlt fuer den **Rang**: Anleger, Setzer, Drucker,
  Farbmischer, Andruckmeister, Druckmeister, Schwarzkuenstler.
* Mit jedem Rang bekommt die Figur eine **neue Tinte** – sichtbarer
  Fortschritt, der ueber Laeufe hinweg bleibt.

### Druckfarben sammeln

Zwoelf **Druckarten** – die Figur wird nicht umgezogen, sondern anders
gedruckt. Der Trefferkoerper bleibt immer gleich, eine Druckart ist nie ein
Vorteil, nur ein Anblick. Freigeschaltet wird auf drei Wegen:

| Druckart | Aussehen | Freischaltung |
| --- | --- | --- |
| Kobalt | volle Tinte | von Anfang an |
| Zinnober / Laub / Veilchen | volle Tinte | 150 / 400 / 800 Muenzen |
| Raster | gerasterte Flaeche | 1400 Muenzen |
| Duplex | zweifarbig geteilt | 2400 Muenzen |
| Goldschnitt | Gold mit Glanzstreifen | 4000 Muenzen |
| Umriss | nur Kontur auf Papier | 6 erfuellte Auftraege |
| Negativ | volle dunkle Tinte | 1500 m in einem Lauf |
| Fehldruck | drei versetzte Platten | 3 Druckplatten |
| Schablone | gestreifte Aussparung | 7 Druckplatten |
| Regenbogen | alle Tinten in Bewegung | 12 Druckplatten |

Muenzen sind damit eine Waehrung mit Verwendung: was man einsammelt, laesst
sich ausgeben. Gekaufte und verdiente Druckarten stehen im selben Raster,
umschalten geht jederzeit auf dem Startschirm.

### Druckplatten

Seltene Sammelstuecke, die nur auf langen Laeufen auftauchen: fruehestens ab
600 Metern, hoechstens eine je Lauf, und die Wahrscheinlichkeit steigt mit der
Strecke. Gemessen ueber je 40 Laeufe fand eine Platte in

* 0 % der Laeufe bis 400 m,
* 8 % bis 900 m,
* 43 % bis 1600 m,
* 75 % bis 2600 m.

Wer die letzte Druckart will, muss also wirklich weit kommen – nicht oft
starten.

### Farbrausch

Alle zwanzig Muenzen in ununterbrochener Folge druckt die Welt fuenf Sekunden
lang in wechselnden Farben, und jede Muenze zaehlt doppelt. Der Rausch haengt
allein an der Kombo: er ist verdient, nicht zufaellig.

### Bestmarke

Dort, wo der bisher weiteste Lauf endete, steht eine Fahne auf der Strecke.
Eine Leiste unter der Streckenanzeige zeigt, wie weit man im Vergleich dazu
ist. Wer die Marke passiert, bekommt Punkte, einen Farbblitz und die Meldung
„ab hier ist alles neu".

### Weitere Bausteine und Elemente

* **Neun Bausteintypen**: flache Passagen, Taktabschnitte mit gleichmaessig
  gesetzten Stacheln, Gruben, Treppen, Drohnenreihen, Saegen, Kistenwaende,
  Sprungfedern, Tore, Hebebuehnen, Schatzabschnitte, Muenzregen und ein
  gemischter Abschnitt. Nie kommt derselbe Typ zweimal hintereinander.
* **Tore** aus einem Bodenriegel und einem Sturz mit einer Luecke dazwischen –
  entweder mit der richtigen Sprunghoehe treffen oder durchdashen.
* **Hebebuehnen**, die ueber einer breiten Kluft auf und ab fahren.
* **Sprungfedern** schleudern die Figur rund 300 Pixel hoch und sind nie
  toedlich. **Broeckelnde Absaetze** tragen nach der Landung noch 450 ms.
* **Muenzregen**: alle paar Bausteine eine kurze, randvolle Belohnungsstrecke.
* **Meilensteine** alle 250 Meter mit Punktebonus.
* **Sieben Druckgaenge** mit je eigenem Farbpaar, die alle 650 Meter wechseln.

### Steuerung und Belohnung

* **Sprunggefuehl** mit variabler Sprunghoehe, Doppelsprung, Coyote-Time,
  Eingabepuffer und laengerem Scheitelpunkt.
* **Lenken** zwischen 115 und 415 Pixeln Bildschirmposition.
* **Gamepad-Unterstuetzung** ueber die Gamepad-API, ohne Einrichtung.
* **Vier Power-ups**: Schild, Magnet, doppelte Punkte, Zeitlupe.
* **Hyper-Modus**: Muenzen und knappe Ausweichmanoever fuellen die Leiste,
  dann sieben Sekunden unverwundbar durch alles hindurch, dreifache Punkte.
* **Kombo-System** bis x8 und **Beinahe-Treffer** mit Bonus und Zeitlupe.
* **Prozeduraler Ton** ueber WebAudio, Tempo steigt mit der Geschwindigkeit.
* **Bestwert, weiteste Strecke, Muenzen, Guthaben, Druckplatten, Rang,
  Auftraege und die gewaehlte Druckart** liegen im `localStorage`.

## Wie sich die Physik verhaelt

Die Werte folgen den ueblichen Kniffen aus dem Plattformer-Handwerk. Wichtig
war dabei, immer nur eine Familie von Werten zu aendern und danach neu zu
messen, statt an mehreren Schrauben gleichzeitig zu drehen.

* **Weiche Schwerkraft beim Steigen, harte beim Fallen.** Nahe dem
  Scheitelpunkt (unter 190 px/s) wirken nur 62 Prozent der Schwerkraft, beim
  Fallen 125 Prozent. Oben bleibt Zeit zum Zielen, unten wird die Landung
  knackig.
* **Endgeschwindigkeit im Fall: 1350 px/s.** Ohne diese Grenze wird ein Sturz
  aus grosser Hoehe so schnell, dass er nicht mehr zu steuern ist.
* **Nachsichtiger Trefferkoerper.** Fuer Hindernisse wird die Figur um 5 px an
  den Seiten und 4 px oben und unten kleiner geprueft, als sie gezeichnet ist.
  Was nur die Ecke streift, toetet nicht mehr – der haeufigste Grund fuer ein
  „das war doch gar nicht getroffen".
* **Schnellfall nur auf frischen Druck.** Die Rutschtaste zieht die Figur in
  der Luft nur dann nach unten, wenn sie dort frisch gedrueckt wurde. Ein
  Daumen, der auf der Rutschzone liegen bleibt, wuerde sonst jeden Sprung
  sofort wieder abwuergen.
* **Rutschen schiebt an** (+140 px/s) und ist damit mehr als nur Ausweichen –
  dafuer ist es nach 1,2 Sekunden vorbei.
* **Stauchen und Strecken.** Beim Absprung streckt sich die Figur, bei der
  Landung staucht sie sich – umso staerker, je haerter der Aufprall. Die
  Fuesse bleiben dabei stehen.
* **Fester Zeitschritt von 1/120 s**, hoechstens zehn pro Bild: die Physik
  bleibt unabhaengig von der Bildrate gleich.

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
| Meilenstein alle 250 m | 50 × Multiplikator |
| Bestmarke passiert | 300 × Multiplikator |
| Auftrag erfuellt | 400 × Multiplikator |
| Druckplatte gefunden | 500 × Multiplikator |
| Muenze im Farbrausch | doppelt |
| Hindernis im Hyper-Modus zerlegt | 60 × Multiplikator |

Der Multiplikator ist `1 + Kombo / 8` (hoechstens x8), verdoppelt sich mit dem
Power-up „doppelte Punkte" und verdreifacht sich im Hyper-Modus.

## Dateien

```
index.html            Aufbau der Seite und Anzeige
style.css             Darstellung, Layout und Verhalten auf Telefonen
game.js               Spiellogik, Streckenerzeugung, Ton und Rendering
manifest.webmanifest  Startbildschirm: Vollbild, Querformat, Symbole
icon.svg              Symbol als Vektor
icon-180/192/512.png  Symbol fuer Startbildschirm und Browserleiste
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
