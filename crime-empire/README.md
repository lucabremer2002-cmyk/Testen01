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

### Rivalen und Diplomatie

Vier Organisationen handeln jede Woche fuer sich: expandieren,
investieren, anwerben, oder gegen den Spieler vorgehen. Ihre
Stammgebiete wachsen nach, damit sie sich von einem Rueckschlag erholen
koennen. Die ersten vier Wochen gelten als Schonfrist.

Jeder Rivale verfolgt ein sichtbares Ziel ueber mehrere Wochen, das auf
seiner Karte steht: einen Bezirk nehmen, den Spieler ueberholen, sich
sammeln - oder einen *anderen Rivalen* angreifen. Die Stadt kaempft
auch ohne den Spieler.

Diplomatie hat zwei Stufen: **Tribut** ist klein, billig und jederzeit
moeglich, wirkt aber umso weniger, je freundlicher jemand schon ist.
**Verhandeln** ist das grosse Treffen mit Waffenstillstand. Ab 42
Punkten Beziehung laesst sich ein **Buendnis** schliessen: der
Verbuendete raeumt die eigenen Bezirke, hoert auf, um Einfluss zu
streiten, und zahlt eine woechentliche Beteiligung, die mit seinem
Gebiet waechst. Gegen ihn gerichtete Auftraege kosten Beziehung - man
kann nicht mit allen vier gleichzeitig befreundet sein.

### Ereignisse

Vierzehn Entscheidungen, alle an den tatsaechlichen Spielstand
gebunden: ohne Mannschaft keine Gehaltsforderung, ohne Rivalitaet kein
Gebietsstreit. Manche Antworten wirken erst Wochen spaeter. Ein
Ereignis haelt die Zeit an — es gibt keinen Zeitdruck beim Entscheiden.

### Schulden

Bargeld darf ins Minus, aber nie stillschweigend: 6 % Zinsen je Woche,
und wenn die Schuld das halbe Anlagevermoegen ueberschreitet, verkaufen
die Glaeubiger den guenstigsten Betrieb zum halben Wert. Mit Ansage.

### Furcht und Seriositaet

Zwei Bahnen, die sich gegenseitig ausschliessen.

**Furcht** entsteht nur aus bewussten Taten: Druck auf Rivalen, ein
erzwungener Einmarsch, eine Uebernahme, eine Schutzgeldforderung. Sie
gibt keine besseren Werte, sie oeffnet andere Handlungen:

| ab | was moeglich wird |
| --- | --- |
| 18 | **Schutzgeld** von unterlegenen Rivalen fordern - eine Wocheneinnahme, die an der Geldwaesche vorbeilaeuft, weil niemand meldet, was er aus Angst zahlt |
| 38 | **Bezirk erzwingen** statt Eintritt zahlen - gemessen 0 statt 80.207 Dollar fuer Downtown, dafuer 12 Hitze, 4 Ansehen und ein Bezirk, der umkaempft startet |
| 55 | **Betrieb uebernehmen** statt kaufen - 0 statt 13.775 bis 174.000 Dollar, dafuer 45 % Schaden und ein dauerhafter Feind |

Und sie kostet, was sich nicht zurueckkaufen laesst: ueber 45 unter-
schreibt keine Lizenzbehoerde mehr fuer Casino oder Hotel, ab 30 bewerben
sich nur noch die, die sonst niemand nimmt, und die Furcht selbst
zerfaellt oben schneller als unten - ein Schrecken auf Dauer ist teurer
als einer auf Zeit.

**Seriositaet** ist der Gegenentwurf und nicht erzwingbar: sie verlangt
55 Ansehen *und* Furcht unter 20. Dafuer 5 % weniger laufende Kosten,
12.000 Dollar mehr Waeschekapazitaet je Woche und die grossen legalen
Haeuser. Ein gefuerchteter Spieler kann das nicht nachbauen, solange er
gefuerchtet bleibt.

Den Sieg gibt es auf beiden Wegen: sechs Bezirke halten und *entweder*
das Bundesverfahren unter 60 *oder* Furcht ab 65. Kontrolle durch
Bestand oder Kontrolle durch Schrecken.

## Drei Spielweisen im Vergleich

`tools/szenarien.js` laesst dieselbe Partie von drei Spielern spielen:
vorsichtig (wenig Hitze, legal, frueh verteidigt), aggressiv (Untergrund,
jeder Auftrag, Hitze egal) und schlampig (gibt aus was da ist, ohne
Ruecklage). Gemessener Stand:

Gemessen ueber 115 Wochen, derselbe Seed:

| | Vorsichtig | Aggressiv | Ausgewogen |
| --- | --- | --- | --- |
| Vermoegen | 10,8 Mio. | 5,1 Mio. | 5,9 Mio. |
| **Stadt erobert in Woche** | 63 | **50** | 66 |
| **Wochen mit Kontrolle** | 54 | **67** | 51 |
| Furcht / Seriositaet | 22 / Tolerated | 90 / Notorious | 80 / Notorious |
| Bezirke erzwungen | 0 | **3** | 0 |
| Betriebe uebernommen | 0 | **34** | 0 |
| zahlen Schutzgeld | 0 | **4** | **4** |
| Unruhe in den Bezirken | 0 | **58** | 0 |
| Hitze im Schnitt | 34 | 62 | 52 |
| Wochen mit Ausnahmezustand | 0 | 41 | 28 |

Aggression nimmt die Stadt dreizehn Wochen frueher und haelt sie
laenger - mit vierunddreissig Betrieben, fuer die sie nichts bezahlt
hat, und drei Bezirken ohne Eintrittsgeld. Sie endet mit der Haelfte
des Vermoegens, einem aufruehrerischen Bezirk und einem Verfahren bei
78. Keine der drei Weisen ist in jeder Spalte vorn.

## Werkzeuge

Alle laufen ohne Browser, bis auf die beiden, die Playwright brauchen.

```bash
node tools/anfang.js [seed]          # die ersten zwoelf Wochen, prueft den Einstieg
node tools/simulation.js [wochen] [seed]   # ganze Partie in Node, Fortschrittskurve
python3 -m http.server 8231 &
node tools/selftest.js               # Browsertest: Buchhaltung, Speichern, tote Knoepfe
node tools/durchlauf.js              # klickt sich wie ein Mensch durch das Spiel
node tools/partie.js [wochen] [ordner]     # ganze Partie im Browser, mit Bildern
node tools/szenarien.js [wochen] [seed]    # drei Spielweisen nebeneinander
node tools/ansicht.js                # Bildschirmfotos aller Ansichten
```

`partie.js` ist das Werkzeug, das die Frage "macht das ueber Stunden
Spass?" beantwortet. Es spielt eine volle Kampagne im echten Browser
ueber dieselben Klick-Behandlungen wie ein Mensch, mit einer Spielweise,
die Erwartungswerte rechnet statt zu wuerfeln, und haelt an vier
Meilensteinen fuer Bildschirmfotos an. Nebenbei prueft es jede Woche die
Buchhaltung, speichert und laedt zwischendurch und protokolliert jede
Entscheidung. Genau dieser Lauf hat die Befunde geliefert, die unten
stehen.

`selftest.js` prueft unter anderem die wichtigste Zusage des Spiels:
**Bargeld vorher plus Summe der Buchungszeilen ergibt Bargeld nachher.**
Wer Geld verliert, findet die Zeile, die sagt warum. Ausserdem: dass
jedes Ereignis mindestens eine offene Antwort hat (sonst stuende die
Zeit fuer immer still), dass jedes Ereignis ueberhaupt erreichbar ist,
und dass hinter jedem Knopf eine Behandlung steht.

## Was ein voller Durchlauf gezeigt hat

Eine komplette Kampagne (rund 100 Wochen, Sieg erreicht) brachte vier
Dinge ans Licht, die kein Einzeltest gefunden hatte:

* **Buendnisse waren unerreichbar.** Beziehungen zerfielen symmetrisch
  gegen null, waehrend jede Expansion sie senkte. Nach 95 Wochen
  aktiven Verhandelns stand kein einziger Rivale ueber 35 von noetigen
  55 Punkten - das ganze System war toter Inhalt.
* **Ein voll kontrollierter Bezirk war fertig.** Einfluss endet bei 100,
  und damit endete auch die Betriebskapazitaet. Dreizehn Wochen lang
  liess sich nur noch Geld ansammeln.
* **Die Mannschaftsgrenze lag bei 13** - fuer ein Imperium mit ueber
  zwanzig Standorten und sechzig Arbeitsplaetzen.
* **Ein Absturz**, wenn jemand die Organisation verlaesst, waehrend er
  auf einem Auftrag ist. Die Abrechnung suchte dann einen Menschen, den
  es nicht mehr gab.

Alle vier sind behoben; drei davon haben eigene Regressionstests im
Selbsttest.

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

tools/          Test- und Durchspielwerkzeuge (siehe oben)
```

Die Logikdateien (bis `sim.js`) kommen ohne DOM aus. Deshalb koennen
`anfang.js` und `simulation.js` ganze Partien in Node durchspielen,
ohne einen Browser zu starten.

## Zum Inhalt

Blackhaven, seine Bezirke, die vier Familien und alle Personen darin
sind erfunden. Die Untergrundtaetigkeiten sind abstrakte
Verwaltungsmechaniken — Kaufpreis, Wochenertrag, Risikowert. Nichts
darin beschreibt, wie irgendetwas tatsaechlich getan wird.
