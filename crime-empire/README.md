# Crime Empire

Ein Aufbauspiel ueber eine kriminelle Organisation in der erfundenen
Stadt **Blackhaven**. Man beginnt mit 3.500 Dollar, einem Zimmer ueber
einem Waschsalon und niemandem, der einem etwas schuldet, und arbeitet
sich ueber sechs Raenge bis zur stadtweiten Kontrolle hoch.

Reines HTML, CSS und JavaScript. Kein Framework, kein Build-Schritt,
keine Abhaengigkeiten, keine Fremd-Assets: Grafik, Portraits, Karte,
Diagramme und Klang entstehen im Code.

## Spielen

`index.html` im Browser oeffnen. Das war's.

Alternativ ueber einen lokalen Server:

```bash
python3 -m http.server 8000
# danach http://localhost:8000/crime-empire/ aufrufen
```

## Steuerung

| Taste | Wirkung |
| --- | --- |
| `Leertaste` | Pause / weiter |
| `1` `2` `3` | Geschwindigkeit |
| `N` | Einen Tag weiter |
| `1`–`9` | Antwort in einem Entscheidungsfenster |
| `Esc` | Fenster schliessen |

## Die Systeme

### Der Kreislauf

Auftraege bringen das erste Geld, Betriebe bringen dauerhaftes
Einkommen, Einfluss macht Platz fuer mehr Betriebe, und Rivalen nehmen
sich zurueck, was man nicht verteidigt. Jede Woche wird abgerechnet.

### Geld und Geldwaesche

Legale Betriebe verdienen wenig, waschen aber Geld. Untergrundbetriebe
verdienen das Zwei- bis Dreifache, erzeugen aber Hitze — und jeder
Dollar schmutziger Einnahmen **ueber** der Waschkapazitaet verliert
42 %. Das zwingt zu gemischten Portfolios, statt nur das
Profitabelste zu stapeln.

### Hitze

Hitze steigt durch Untergrundbetriebe und riskante Entscheidungen und
faellt durch Anwaelte, Ruhephasen und Schmiergeld. Ab 40 kostet sie
Einnahmen, ab 70 drohen Razzien. Jede Aenderung steht mit Begruendung
in der Wochenabrechnung.

### Mannschaft

Acht Rollen, jede mit eigener Wirkung. Jeder Mensch hat Faehigkeit,
Potenzial, Loyalitaet, Gehaltsvorstellung und Eigenschaften, die
zueinander passen muessen. Loyalitaet faellt bei Unterbezahlung,
Leerlauf und hoher Hitze — wer sie ignoriert, verliert Leute, und
manche reden danach.

Der Spieler selbst steht in der Mannschaft: ohne Gehalt, unkuendbar,
und in der ersten Woche der einzige, den man auf einen Auftrag
schicken kann.

### Einfluss und Bezirke

Sechs Bezirke mit eigener Wirtschaftskraft und Polizeipraesenz. Ein
Bezirk traegt zwei Betriebe ohne Rueckhalt und sechs bei voller
Kontrolle — Einfluss ist damit keine Zierde, sondern die Voraussetzung
fuer Wachstum.

### Rivalen

Vier Organisationen handeln jede Woche fuer sich: expandieren,
investieren, anwerben, oder gegen den Spieler vorgehen. Ihre
Stammgebiete wachsen nach, damit sie sich von einem Rueckschlag erholen
koennen. Die ersten vier Wochen gelten als Schonfrist.

### Ereignisse

Vierzehn Entscheidungen, alle an den tatsaechlichen Spielstand
gebunden: ohne Mannschaft keine Gehaltsforderung, ohne Rivalitaet kein
Gebietsstreit. Manche Antworten wirken erst Wochen spaeter. Ein
Ereignis haelt die Zeit an — es gibt keinen Zeitdruck beim Entscheiden.

### Schulden

Bargeld darf ins Minus, aber nie stillschweigend: 6 % Zinsen je Woche,
und wenn die Schuld das halbe Anlagevermoegen ueberschreitet, verkaufen
die Glaeubiger den guenstigsten Betrieb zum halben Wert. Mit Ansage.

## Werkzeuge

Alle laufen ohne Browser, bis auf die beiden, die Playwright brauchen.

```bash
node tools/anfang.js [seed]          # die ersten zwoelf Wochen, prueft den Einstieg
node tools/simulation.js [wochen] [seed]   # ganze Partie, zeigt die Fortschrittskurve
python3 -m http.server 8231 &
node tools/selftest.js               # Browsertest: Buchhaltung, Speichern, tote Knoepfe
node tools/ansicht.js                # Bildschirmfotos aller Ansichten
```

`selftest.js` prueft unter anderem die wichtigste Zusage des Spiels:
**Bargeld vorher plus Summe der Buchungszeilen ergibt Bargeld nachher.**
Wer Geld verliert, findet die Zeile, die sagt warum. Ausserdem: dass
jedes Ereignis mindestens eine offene Antwort hat (sonst stuende die
Zeit fuer immer still), dass jedes Ereignis ueberhaupt erreichbar ist,
und dass hinter jedem Knopf eine Behandlung steht.

## Dateien

```
index.html      Aufbau der Seite
style.css       Gestaltungssystem

src/util.js     Zufall (seedbar), Formate, Helfer
src/data.js     Alle Inhalte: Bezirke, Betriebe, Rollen, Rivalen, Erfolge
src/state.js    Spielstand und abgeleitete Werte - jede Zahl genau einmal
src/crew.js     Bewerber, Einstellung, Loyalitaet, Erfahrung
src/ops.js      Auftraege: Angebote, Aussichten, Abrechnung
src/empire.js   Kaufen, Ausbauen, Bezirke, Organisation, Hitze
src/economy.js  Wochenabrechnung und Buchhaltung
src/rivals.js   Rivalen-KI und Verhandlungen
src/events.js   Ereigniskatalog und Nachwirkungen
src/progress.js Erfolge, Raenge, Sieg
src/save.js     Vier Speicherplaetze, Wanderung alter Staende
src/sim.js      Taktgeber - die einzige Stelle, an der Zeit vergeht
src/audio.js    Klang aus Oszillatoren
src/art.js      Symbole und Portraits als SVG
src/charts.js   Diagramme auf Canvas
src/skyline.js  Die Stadt bei Nacht im Hauptmenue
src/ui.js       Neun Bildschirme
src/game.js     Steuerung: Zeit, Klicks, Fenster, Spielstaende

tools/          Testwerkzeuge (siehe oben)
```

Die Logikdateien (bis `sim.js`) kommen ohne DOM aus. Deshalb koennen
`anfang.js` und `simulation.js` ganze Partien in Node durchspielen,
ohne einen Browser zu starten.

## Zum Inhalt

Blackhaven, seine Bezirke, die vier Familien und alle Personen darin
sind erfunden. Die Untergrundtaetigkeiten sind abstrakte
Verwaltungsmechaniken — Kaufpreis, Wochenertrag, Risikowert. Nichts
darin beschreibt, wie irgendetwas tatsaechlich getan wird.
