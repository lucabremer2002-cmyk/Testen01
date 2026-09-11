# Bundesliga Manager

Ein Fußballmanager für die 1. und 2. Bundesliga – reines HTML, CSS und
JavaScript. Kein Framework, kein Build-Schritt, keine Abhängigkeiten.

## Spielen

`fussballmanager/index.html` im Browser öffnen. Das war's.

Alternativ über einen lokalen Server:

```bash
python3 -m http.server 8000
# danach http://localhost:8000/fussballmanager/ aufrufen
```

Für Umgebungen, die genau eine Datei entgegennehmen, fasst
`werkzeug/einzeldatei.py` alles zu einer einzigen HTML-Datei zusammen –
Schriften und Programm eingebettet, weiterhin ohne Abhängigkeiten. Zum
Spielen ist das nicht nötig.

Trainernamen eingeben, einen der 36 Vereine auswählen, loslegen. Mit
**Weiter** (oder der Taste `W`) rückt der Kalender einen Tag vor. Die
Zifferntasten `1`–`9` springen zwischen den Ansichten, `S` speichert.

---

## Was das Spiel abbildet

### Spieler

Jeder Spieler trägt **32 Attribute** in vier Gruppen:

| Gruppe | Attribute |
| --- | --- |
| Technik | Ballkontrolle, Passspiel, Flanken, Abschluss, Weitschuss, Dribbling, Kopfball, Zweikampf, Standards, Elfmeter |
| Mentalität | Übersicht, Entscheidung, Stellungsspiel, Antizipation, Arbeitsrate, Aggressivität, Teamwork, Nervenstärke, Führung, Disziplin |
| Physis | Tempo, Antritt, Körperkraft, Ausdauer, Beweglichkeit, Sprungkraft, Balance |
| Torwartspiel | Reflexe, Strafraumbeherrschung, Fangsicherheit, Abschlag, Eins gegen Eins |

Daraus wird über positionsabhängige Gewichte die Spielstärke berechnet – ein
Innenverteidiger zieht seine Klasse aus Zweikampf, Stellungsspiel und
Kopfball, ein Zehner aus Übersicht, Passspiel und Technik. Wer auf einer
fremden Position spielt, verliert entsprechend.

Dazu kommen Hauptposition und Nebenpositionen, starker Fuß, Alter,
Nationalität, **Potenzial**, Form, Moral, Frische, Verletzungsanfälligkeit,
eine von zwölf **Persönlichkeiten** (vom vorbildlichen Profi bis zum
Geldorientierten) sowie Vertrag, Marktwert und Statistiken für Saison und
Karriere.

### Merkmale

Neben den Zahlenwerten hat ein Spieler bis zu drei **Merkmale** – der
Freistoßspezialist, das Kopfballungeheuer, der Elfmetertöter im Tor, der
Dauerläufer, aber auch der Hitzkopf, der zu oft einen Schritt zu weit
geht. Sie sind keine Anzeige, sondern wirken unmittelbar: Wer als
Distanzschütze gilt, sucht den Abschluss häufiger aus zwanzig Metern und
trifft dabei besser; ein Elfmetertöter senkt die Verwandlungsquote des
Gegners spürbar; ein Verletzungsanfälliger fällt tatsächlich öfter aus.

Ein Merkmal ist ein **Abstand, kein Grenzwert**: Ein Spieler fällt auf,
wenn er in einer Sache deutlich besser ist als in allem anderen. Deshalb
gibt es den Freistoßspezialisten auch in der 2. Liga – und deshalb hat
nicht jeder Bundesligaprofi eine Handvoll Sonderfähigkeiten. In der
Spitze tragen rund vier von fünf Spielern ein Merkmal, im
Bundesligadurchschnitt gut die Hälfte, weiter unten deutlich weniger.
Junge Spieler können sich im Training neue erarbeiten.

### Kaderstatus

Jeder Spieler hat einen **Kaderstatus** vom unverzichtbaren Star bis zu
„nicht im Kaderplan". Das ist ein Versprechen über seine Einsatzzeit:
Ein Stammspieler erwartet rund 65 Prozent, ein Ergänzungsspieler knapp
20. Wer sein Versprechen bricht, bekommt einen unzufriedenen Spieler –
in der Kaderliste steht die Marke dann rot. Wer mehr Einsatzzeit gibt
als zugesagt, hebt die Stimmung.

Der Status wird beim Vertragsangebot mitverhandelt (und kostet
entsprechend Gehalt), lässt sich später jederzeit im Spielerprofil
ändern – eine Herabstufung nimmt der Spieler übel – und bestimmt, wie
schnell aus Unzufriedenheit ein Wechselwunsch wird.

Alle Spieler werden prozedural erzeugt. Das Spiel bleibt damit unabhängig
von Kaderdaten, die nach wenigen Wochen ohnehin veraltet wären.

### Kader und Taktik

* **Zwölf Formationen** von 4-4-2 über 4-2-3-1 und 3-4-3 bis 5-2-3, jede
  mit eigenem Schwerpunkt in Abwehr, Mittelfeld und Angriff.
* **Rollen je Position**: Innenverteidiger als Aufbauverteidiger, Libero
  oder Abräumer; Sechser als Regista, Box-to-Box oder Anker; Stürmer als
  Zielspieler, Falsche Neun, Tiefenläufer oder Pressingspitze – insgesamt
  über 30 Rollen mit unterschiedlicher Wirkung.
* **Neun Mannschaftsanweisungen**: Mentalität, Pressinghöhe, Abwehrlinie,
  Spielaufbau, Spieltempo, Spielfeldbreite, Gegenpressing,
  Zweikampfführung und Zeitmanagement.
* **Standards** (Elfmeter, Freistöße, Ecken, Einwürfe) und Kapitän.
* **Einspielgrad**: Wer ständig rotiert, verliert Automatismen.

Die Aufstellungsansicht zeigt zu jedem Spieler auf dem Feld einen
**Frischering**, die **Rollenkurzform**, einen **Formpfeil** aus Form und
letzten Noten sowie einen **Eignungspunkt** dafür, ob er auf seiner
gelernten Position steht. Kapitänsbinde, Elfmeter- und Standardschütze
sind als Marken sichtbar, nicht einsatzbereite Spieler rot umrandet.

Dazu kommen:

* **Kennzahlen der Elf**: Stärke, Abstand zur bestmöglichen Aufstellung,
  Einspielgrad, Ø Frische, Ø Moral und Zahl der angeschlagenen Spieler.
* **Mannschaftsteile im Vergleich** – Torwart, Abwehr, Mittelfeld und
  Angriff als Balken, mit einer Marke für den Wert des nächsten Gegners.
* **Profil der Elf**: Kreativität, Kopfballstärke, Tempo, Konterwucht,
  Pressing und Spielaufbau.
* **Positionsdetail** je Slot: Rollenwahl mit ihrem Beitrag zu Abwehr,
  Mittelfeld und Angriff, den für die Rolle wichtigen Attributen und einer
  Kandidatenliste mit Eignung, Stärke auf dieser Position, Rollenpassung,
  Form, Frische und Durchschnittsnote.
* **Gegneranalyse**: erwartete Formation, stärkster und schwächster
  Mannschaftsteil, Schlüsselspieler und konkrete taktische Hinweise. Wie
  belastbar der Bericht ist, hängt an der Qualität Ihrer Spielanalysten.

### Spielsimulation

Minutenweise, mit Ballbesitzverteilung, Chancenentstehung nach Typ
(Kombination, Steilpass, Flanke, Konter, Distanzschuss, Standard, Ecke,
Alleingang, Nachschuss, Elfmeter), Abschluss gegen Torwartqualität,
Fouls, Karten, Verletzungen, Abseits und Nachspielzeit. Verlängerung und
Elfmeterschießen im Pokal.

Die Werte sind an der realen Bundesliga kalibriert. Gemessen wurde über
vier vollständig durchgespielte Spielzeiten (2448 Ligaspiele) durch die
normale Tagesschleife – also mit Training, Regeneration, Rotation,
Sperren und Verletzungen, so wie das Spiel tatsächlich läuft:

| Kennzahl | Simulation | Realität |
| --- | --- | --- |
| Tore pro Spiel | 3,13 | ~3,15 |
| Tore Heim / Auswärts | 1,76 / 1,37 | ~1,72 / 1,36 |
| Torschüsse pro Team | 13,0 | ~13,0 |
| davon aufs Tor | 4,5 | ~4,4 |
| xG pro Team | 1,60 | ~1,58 |
| Ecken pro Team | 5,2 | ~5,0 |
| Fouls pro Team | 11,2 | ~11,0 |
| Gelbe Karten pro Spiel | 3,81 | ~3,8 |
| Platzverweise pro Spiel | 0,137 | ~0,15 |
| Verletzungen pro Spiel | 0,35 | ~0,35 |
| Heimsiege / Remis / Auswärtssiege | 46 / 25 / 29 % | 44 / 24 / 32 % |

Getrennt nach Ligen: 1. Bundesliga 3,26 Tore pro Spiel, 2. Bundesliga
2,99 – die zweite Liga ist auch in Wirklichkeit torärmer und
unentschiedenlastiger.

Zwei Dinge sorgen dafür, dass die Ergebnisse richtig streuen. Erstens
eine Tagesform der Mannschaft: ohne sie fielen die Tore gleichmäßiger als
im echten Fußball, es gäbe zu wenige Kantersiege. Zweitens reagiert nur
gut die Hälfte der Bänke auf den Spielstand – würde jede Mannschaft beim
Rückstand alles nach vorn werfen, glichen sich die Ergebnisse zu stark an
und es gäbe deutlich zu viele Unentschieden.

Bei sehr ungleichen Paarungen wird das Kräfteverhältnis gestaucht: ein
Erstligist gewinnt im Pokal gegen einen Drittligisten hoch, aber nicht
zweistellig.

Im Live-Spiel lassen sich Wechsel vornehmen (5 Wechsel in 3 Fenstern),
Anweisungen ändern und in der Halbzeit fünf verschiedene Kabinenansprachen
halten. Bewertet wird nach der deutschen Notenskala von 1,0 bis 6,0.

### Wettbewerbe

* **Bundesliga und 2. Bundesliga** mit je 18 Vereinen und 34 Spieltagen,
  verteilt auf Freitag, Samstag und Sonntag samt englischer Wochen.
* **3. Liga** als Unterbau für Auf- und Abstieg.
* **DFB-Pokal** über sechs Runden mit 64 Teilnehmern; in der 1. Runde
  werden Amateure bevorzugt gegen Profivereine gelost und haben Heimrecht.
* **Europapokal**: Champions League, Europa League und Conference League
  mit Ligaphase und anschließender K.-o.-Runde gegen echte europäische
  Gegnervereine samt eigenem Kader.
* **DFL-Supercup** und **Relegation** (16. der Bundesliga gegen den 3. der
  2. Liga, entsprechend eine Etage tiefer).
* Vorbereitungsspiele im Juli.

### Transfers

Ein Transfer läuft in zwei Stufen: erst einigen sich die Vereine über die
Ablöse, danach der Spieler mit dem neuen Klub über den Vertrag. Beide
Seiten machen Gegenangebote.

* **Ablösemodelle**: Sofortzahlung, Ratenzahlung, Erfolgsboni,
  Weiterverkaufsbeteiligung, Ausstiegsklauseln.
* **Verträge**: Wochengehalt, Laufzeit, Handgeld, Einsatz-, Tor-, Sieg-
  und Zu-Null-Prämien, Rollenversprechen vom Star bis zum
  Perspektivspieler.
* **Leihen** mit Gehaltsanteil, Leihgebühr und Kaufoption.
* **Ablösefreie Spieler** und auslaufende Verträge.
* **Transferfenster** im Sommer (1. Juli bis 1. September) und Winter.
* **Scouting**: Einzelbeobachtungen und Reisen in zehn Weltregionen. Wie
  genau die Berichte sind, hängt an Chefscout, Scouts und Netzwerk. Vorher
  sieht man nur Spannen statt Werte.
* Die KI-Vereine handeln eigenständig, halten ihr Budget ein und geben
  Angebote für Ihre Spieler ab.

### Training

Ein Wochenplan aus 14 Einheiten (sieben Tage, Vormittag und Nachmittag)
mit zwölf Einheitentypen von Ausdauer über Standardsituationen bis
Videoanalyse, dazu vier Intensitätsstufen. Hartes Training entwickelt
schneller, kostet aber Frische und erhöht das Verletzungsrisiko spürbar.

Pro Spieler lässt sich ein **individueller Schwerpunkt** setzen. Die
Entwicklung hängt an Alter, Potenzial, Persönlichkeit, Trainingsqualität,
Moral und vor allem an der **Spielpraxis** – ein Talent ohne Einsatzzeit
stagniert. Ab 29 lassen die physischen Werte nach, während Erfahrung und
Führung noch wachsen.

Dazu kommen **Trainingslager** von der Sportschule bis zur Winterreise
nach Katar.

### Verletzungen und Sperren

16 Verletzungsbilder von der Prellung bis zum Kreuzbandriss, dazu
Krankheiten. Ausfallzeit und Rückschlagsrisiko hängen an der
medizinischen Abteilung, Physiotherapeuten und Mannschaftsarzt. Die fünfte
Gelbe Karte zieht eine Sperre nach sich, Gelb-Rot ein Spiel, Rot zwei bis
drei – jeweils nur im betroffenen Wettbewerb.

### Finanzen

Einnahmen aus Medienerlösen (nach Liga und Platzierung, wöchentlich
ausgezahlt), Spieltagserlösen, Sponsoring (Trikot, Ärmel, Ausrüster,
Stadionname, Premiumpartner), Merchandising, Preisgeldern und Transfers.

Ausgaben für Spieler- und Mitarbeitergehälter, Ablösen, Stadion- und
Spielbetrieb, Nachwuchszentrum, Verwaltung, Scouting und Kreditzinsen.

Der Vorstand gibt Transfer- und Gehaltsbudget vor. Beim ihm lassen sich
Budgeterhöhungen, Umwandlungen und Kredite beantragen. Wer dauerhaft im
Minus steht, bekommt Ärger mit der DFL – bis hin zum Punktabzug.
Ticketpreise und Dauerkarten steuern Einnahmen und Fanstimmung.

### Verein und Infrastruktur

Stadionkapazität, Trainingszentrum, Nachwuchsleistungszentrum,
medizinische Abteilung und Scoutingnetzwerk lassen sich ausbauen – jeweils
mit Kosten und Bauzeit. Dazu Fanstimmung, Mitgliederzahl und Tradition.

### Personal

Zehn Funktionen mit eigenen Kompetenzen: Co-Trainer, Torwarttrainer,
Athletiktrainer, Spielanalysten, Physiotherapeuten, Mannschaftsarzt,
Chefscout, Scouts, Nachwuchsleiter und Sportdirektor. Sie wirken auf
Trainingsqualität, Verletzungsvorbeugung, Reha-Tempo,
Scouting-Genauigkeit, Verhandlungsgeschick und Jahrgangsqualität. Personal
lässt sich suchen, verpflichten und entlassen.

### Nachwuchs

Jeden Sommer rückt ein Jahrgang aus der eigenen Jugend nach. Umfang und
Qualität hängen an Akademie und Nachwuchsleiter, gelegentlich schlüpft ein
echtes Ausnahmetalent durch. Der Nachwuchsleiter gibt eine Einschätzung
des Potenzials ab – je besser er ist, desto enger die Spanne.

### Medien und Kabine

* **Pressekonferenzen** vor und nach dem Spiel mit Antwortoptionen, die
  auf Mannschaftsmoral, Fanstimmung, Vorstandsvertrauen und sogar die
  Moral des Gegners wirken. Wer über Schiedsrichter schimpft, riskiert
  eine Geldstrafe.
* **Spielergespräche**: loben, kritisieren, Rückendeckung geben, Spielzeit
  versprechen, über Wechselwünsche reden, zum Kapitän machen. Ob es wirkt,
  hängt an Persönlichkeit, Leistung und Ihrer Menschenführung.
* **Postfach** mit Meldungen aus Medizin, Verband, Transfermarkt, Kabine,
  Scouting und Vorstand.
* **Vorstandsvertrauen**: Wer sein Saisonziel deutlich verfehlt, bekommt
  erst eine Verwarnung – und dann die Kündigung. Danach kann man sich bei
  anderen Vereinen bewerben.

---

## Bedienung

| Taste | Wirkung |
| --- | --- |
| `W` | Einen Tag weiter |
| `1` … `9` | Ansicht wechseln |
| `S` | Speichern |
| `Esc` | Dialog schließen |

Am Telefon wird über die Leiste am unteren Rand gewechselt, die
Tastenkürzel entfallen dort.

Gespeichert wird in der IndexedDB des Browsers. Zusätzlich lässt sich der
Spielstand über **Karriere → Spielstand exportieren** als Datei sichern und
auf dem Startbildschirm wieder importieren. Wohin diese Datei geht,
bestimmt `FM.save.setzeExportWeg` – wer das Spiel einbettet, kann den
Download durch den Dateidialog seiner Umgebung ersetzen.

---

## Gestaltung

Die Oberfläche arbeitet mit Flächen statt Rahmen: Ebenen unterscheiden sich
über Helligkeit, Linien erscheinen nur dort, wo sie wirklich trennen. Es
gibt genau eine Akzentfarbe – Grün steht für Erfolg und Handlung –, alles
Übrige bleibt neutral. Gold, Rot und Blau treten nur mit Bedeutung auf.

Zwei Schriften teilen sich die Arbeit: **Space Grotesk** für Überschriften,
Ergebnisse und Kennzahlen, **Manrope** für alles Laufende. Beide sind als
Latin-Teilmenge direkt in `css/fonts.css` eingebettet und funktionieren
deshalb auch offline und beim Öffnen per `file://`.

Rückmeldung gibt es auf jede Handlung: Ansichten laufen gestaffelt ein,
Balken und Fortschrittsringe füllen sich von null, Tore werden mit einer
Einblendung samt Konfetti gefeiert und halten dafür kurz die Uhr an, Siege,
Titel und Aufstiege lösen einen Konfettiregen aus, und Siegesserien
erscheinen als eigener Hinweis. Wer `prefers-reduced-motion` gesetzt hat,
bekommt alles ohne Bewegung.

## Am Handy

Das Spiel ist für das Telefon genauso gebaut wie für den Schreibtisch – es
gibt keine abgespeckte Fassung. Unterhalb von 820 px Breite schaltet die
Oberfläche um:

- **Leiste am unteren Rand** statt Seitennavigation: Übersicht, Kader,
  Taktik, Spiele und **Mehr**. Hinter *Mehr* öffnet sich ein Blatt von
  unten mit allen weiteren Bereichen; liegt dort etwas Neues an, trägt der
  Punkt an der Leiste den Hinweis.
- **Kennzahlen** liegen als waagerecht wischbares Band über dem Inhalt,
  statt sich zu einer langen Spalte zu stapeln.
- **Tabellen** behalten ihre erste Spalte beim seitlichen Scrollen stehen,
  damit Name oder Verein immer sichtbar bleiben.
- **Aufstellung**: Ein Tipp auf eine Position rollt das Detailfeld direkt
  ins Bild, sodass Rolle, Eignung und Alternativen ohne Suchen erreichbar
  sind.
- **Bedienflächen** sind durchgehend mindestens 44 px hoch, Eingabefelder
  und Auswahllisten 16 px groß – so zoomt iOS beim Antippen nicht hinein.
- Die Oberfläche achtet auf die **sicheren Bereiche** moderner Geräte
  (Notch, Home-Indikator) und verzichtet auf Hover-Effekte, wo es keinen
  Zeiger gibt.
- **Automatisch gesichert** wird nach jedem Spiel und spätestens alle
  vierzehn Spieltage – ein weggewischter Tab kostet keinen Fortschritt.

Querformat funktioniert ebenfalls; ab Tabletbreite erscheint wieder die
vollständige Seitennavigation.

## Aufbau des Programms

Die Spiellogik ist vollständig vom DOM getrennt und ließe sich auch außerhalb
des Browsers ausführen.

```
index.html            Aufbau der Seite
css/fonts.css         Eingebettete Schriften
css/style.css         Darstellung

js/util.js            Zufallszahlen, Kalender, Formatierung
js/data.js            Vereine, Namen, Formationen, Rollen, Einheiten
js/players.js         Spielererzeugung, Stärke, Marktwert, Entwicklung
js/tactics.js         Aufstellung, Rollen, Mannschaftsstärke
js/match.js           Spielsimulation
js/staff.js           Trainerstab und Mitarbeiter
js/finance.js         Haushalt, Sponsoring, Zuschauer
js/competitions.js    Spielpläne, Tabellen, Pokal, Europapokal
js/world.js           Weltmodell und Zugriffsmethoden
js/training.js        Wochenplan, Fitness, Verletzungen
js/youth.js           Nachwuchs
js/transfers.js       Transfermarkt, Verhandlungen, Scouting
js/media.js           Presse, Vorstand, Kabine
js/engine.js          Tagesablauf, Ergebnisverarbeitung, Saisonwechsel
js/save.js            Speichern und Laden
js/ui.js              Grundgerüst der Oberfläche
js/views.js           Übersicht, Kader, Spielerprofil, Aufstellung
js/views2.js          Training, Spielplan, Tabellen, Transfers, Finanzen
js/views3.js          Verein, Personal, Nachwuchs, Medien, Statistik
js/views4.js          Dialoge: Gespräche, Verträge, Angebote, Spielbericht
js/matchview.js       Live-Ansicht des Spieltags
js/main.js            Einstieg und Tastenkürzel
```

Die Simulation ist deterministisch: Bei gleichem Startwert entsteht
dieselbe Spielwelt. Ein kompletter Saisondurchlauf mit allen 1200 Partien
dauert rund 20 Sekunden, ein einzelnes Spiel etwa 1,5 Millisekunden.

## Hinweis zu den Daten

Vereinsnamen, Stadien und Städte entsprechen der realen Ligalandschaft der
Saison 2025/26. Alle Spieler, Mitarbeiter und Sponsoren sind frei erfunden
und werden bei jedem neuen Spiel neu erzeugt. Es besteht keine Verbindung
zu DFL, DFB oder den genannten Vereinen.
