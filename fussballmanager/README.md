# Matchplan – Fußballmanager 1. bis 3. Liga und Regionalliga West

Ein Fußballmanager für den Browser mit **Bundesliga, 2. Bundesliga, 3. Liga und
Regionalliga West**
in der Zusammensetzung der Saison **2026/27**, mit den **echten Kadern** und den
Spielerwerten aus **EA SPORTS FC 27**. Reines HTML, CSS und JavaScript – ohne
Build-Schritt, ohne Server.

## Starten

`fussballmanager/index.html` im Browser öffnen. Fertig.

Alternativ über einen lokalen Server (z. B. für Mobilgeräte im WLAN):

```bash
cd fussballmanager
python3 -m http.server 8000
# danach http://localhost:8000 aufrufen
```

Der Spielstand wird automatisch nach jedem Spieltag im Browser gespeichert
(3 Slots, komprimiert). Über *Einstellungen* lässt er sich als Datei
exportieren und wieder importieren. Ältere Spielstände werden beim Laden
automatisch um Budget- und Infrastrukturdaten ergänzt.

Eine einzelne, eigenständige HTML-Datei (z. B. zum Weitergeben) erzeugt:

```bash
cd fussballmanager
python3 tools/bundle.py dist/matchplan.html
```

## Was drin ist

**Ligen & Wettbewerbe**
- 18 Bundesligisten, 18 Zweitligisten, 20 Drittligisten (Stand 2026/27,
  z. B. Elversberg und Paderborn in der Bundesliga, Wolfsburg, Heidenheim und
  St. Pauli in der 2. Liga, Fortuna Düsseldorf und Preußen Münster in der 3. Liga)
- Echte Spielpläne mit Hin- und Rückrunde, Winterpause und englischen Wochen
- **DFB-Pokal** mit Auslosung, Heimrecht für den Unterklassigen,
  Verlängerung, Elfmeterschießen und Finale in Berlin
- **Relegation** (Hin- und Rückspiel) zwischen 1./2. und 2./3. Liga
- Auf- und Abstieg; Reserveteams dürfen nicht aufsteigen; Absteiger aus der
  3. Liga wechseln in einen Regionalliga-Pool (1860, Aue, Ulm, Schweinfurt …)
- Europapokal-Plätze mit Prämien, Torschützenlisten, Meister, Pokalsieger

**Spieltag**
- Minutengenaue Match-Engine: Ballbesitz, Torschüsse, Expected Goals,
  Großchancen, Elfmeter, Eigentore, Karten, Verletzungen, Ermüdung
- Live-Ticker mit vier Geschwindigkeiten, Halbzeitpause, **Konferenz**
  mit allen Parallelspielen
- Wechsel (5), Mentalität, Pressing und Tempo während des Spiels änderbar
- Noten nach Kicker-Skala (1,0 bis 6,0), Spieler des Spiels, Spielbericht
- Kalibriert auf realistische Werte: ca. 2,9 Tore und 25 Schüsse pro Spiel,
  Heim/Remis/Auswärts ≈ 40/27/33 % bei gleich starken Teams

**Management**
- Kader mit Stärke, Potenzial, Form, Fitness, Moral, Vertrag, Marktwert
- Aufstellung auf dem Spielfeld per Antippen und Tauschen, 8 Formationen,
  Positionseignung, automatische „Beste Elf“
- Training: Schwerpunkt (Ausgewogen, Kondition, Taktik, Technik, Regeneration)
  und Intensität – wirkt auf Erholung, Form, Verletzungsrisiko und Entwicklung
- Spielerentwicklung nach Alter, Potenzial, Spielzeit und Training;
  ältere Spieler bauen ab, Karriereende, jährlicher Akademie-Nachwuchs
- **Transfermarkt** mit Filtern über alle 1.400+ Spieler, Ablöseforderungen,
  Wechselbereitschaft, Gehaltsverhandlung, Gegenangebote, Vereinslose
- Angebote anderer Vereine für deine Spieler, Transferliste,
  Vertragsverlängerung, Vertragsauflösung mit Abfindung
- KI-Vereine kaufen und verkaufen selbst (Transferticker)
- **Finanzen**: TV-Gelder, Sponsoring, Zuschauer, Prämien, Gehälter,
  Betriebskosten, Berater und Handgelder, Infrastruktur, Saisonprognose,
  Kontostand-Verlauf
- **Vorstand** mit Saisonziel nach Kaderstärke, Vertrauensbarometer,
  Entlassung und Jobangeboten anderer Vereine
- Posteingang, Statistiken (Torjäger, Vorlagen, Noten, weiße Westen, Karten),
  Vereinsprofile aller Klubs
- Helles und dunkles Design, läuft auf Desktop und Smartphone

**Design**
- Die Oberfläche trägt die Farben des eigenen Vereins: Die Seitenleiste ist ein
  Fanschal mit Strickrippen und Fransen, Buttons und Hervorhebungen folgen der
  Vereinsfarbe (zu helle oder zu dunkle Farben weichen automatisch der
  Zweitfarbe, Texte werden auf Lesbarkeit geprüft)
- Spielansetzung, Live-Spiel und Startbildschirm als Stadion-Anzeigetafel
  mit Flutlicht
- Spielerwerte in den FC-Kartenstufen Bronze (bis 64), Silber (65–74),
  Gold (ab 75) und seltenes Gold (ab 85); Taktiktafel mit Trikots in
  Vereinsfarben

## Regionalliga West

Als Bonus ist die **Regionalliga West 2026/27** komplett simuliert: 18 Vereine
mit echten Kadern (465 Spieler), u. a. Rot-Weiß Oberhausen, FC Gütersloh,
Sportfreunde Siegen, 1. FC Bocholt, Bonner SC, die Zweitvertretungen von Dortmund,
Schalke, Köln, Gladbach, Bochum und Paderborn sowie die Aufsteiger Westfalia Rhynern,
SG Wattenscheid, SV Bergisch Gladbach und VfB 03 Hilden.

- **Kader**: recherchiert über sport.de, kicker und Vereinsmeldungen, Stand
  Saisonbeginn 2026/27. Wo nur der Kader 2025/26 auffindbar war, sind die bekannten
  Zu- und Abgänge eingearbeitet. EA SPORTS FC führt keine Regionalliga, die
  Stärkewerte sind deshalb geschätzt (≈) und so kalibriert, dass die Spitzenteams
  knapp unter den schwächsten Drittligisten liegen. Kleine Lücken füllt die Akademie
  mit fiktiven Talenten auf.
- **Wirtschaft**: Halbprofis mit niedrigeren Gehältern (Mindestgehalt 12.000 €),
  Zuschauerschnitte wie in der Realität (Oberhausen ≈ 4.300, Wattenscheid ≈ 2.800,
  Hilden ≈ 550), kleine fiktive Kassen.
- **Sponsorentopf**: Jeder Regionalligist bekommt pro Saison einen fiktiven,
  zweckgebundenen Topf vom Hauptsponsor bzw. Förderkreis (70.000 € bei Hilden bis
  350.000 € bei Rödinghausen, Zweitvertretungen 120.000 € von den Profis). Der
  Sponsor zahlt erst, wenn das Geld für Ablösen, Handgelder oder Gehaltsspielraum
  genutzt wird; Reste verfallen am Saisonende. So bleibt der Markt lebendig, ohne
  dass sich Geld anhäuft. Startbudgets: rund 170.000 € bis 780.000 €.
- **Auf- und Abstieg**: Der Meister steigt direkt in die 3. Liga auf (Reserveteams
  nur, wenn die Profis höher als in der 3. Liga spielen). Westvereine, die aus der
  3. Liga absteigen, kommen in die Regionalliga West, alle anderen in die übrigen
  Regionalligen. Zwei Oberliga-Meister steigen auf; wie viele in die Oberliga
  absteigen, ergibt sich daraus (die Liga bleibt bei 18 Vereinen). Der Oberliga-Pool
  (Wuppertaler SV, KFC Uerdingen, Fortuna Düsseldorf II, Rot Weiss Ahlen) wird nicht
  simuliert; seine Kader sind fiktiv.
- **DFB-Pokal**: Die freien Plätze im 64er-Feld gehen an die bestplatzierten
  Westvereine der Vorsaison (stellvertretend für die Landespokalsieger). Unterklassige
  haben Heimrecht, gegen Klubs aus höheren Ligen strömen deutlich mehr Zuschauer.
- **Karriere von unten**: Wer im Westen startet, beginnt mit kleinem Etat, sucht
  Schnäppchen unter den Vereinslosen und kann sich bis in die Bundesliga hocharbeiten.

## Budget des Vorstands

Der Kontostand ist nicht mehr frei verfügbar. Der Vorstand legt zum
Saisonstart (und neu zum Wintertransferfenster) zwei Budgets fest und zeigt
unter *Finanzen & Budget* den Rechenweg:

1. **Liquiditätsreserve**: Drei Monate Fixkosten (Gehälter, Betrieb,
   Unterhalt) bleiben immer auf dem Konto.
2. **Freie Mittel** = Kontostand − Reserve + die Hälfte des erwarteten
   Überschusses (ein erwarteter Fehlbetrag wird voll abgezogen).
3. **Transferbudget** = freie Mittel × Freigabequote. Die Quote hängt am
   Vertrauen des Vorstands (35 bis 75 %). Weil der Überschuss erst im
   Saisonverlauf hereinkommt, ist das Budget zusätzlich auf den Kontostand
   minus halbe Reserve begrenzt.
4. **Gehaltsbudget** = aktuelle Gehälter + 3 %, oder mehr, wenn das unter
   der ligaüblichen Quote der Einnahmen bleibt (Bundesliga 58 %, 2. Liga
   62 %, 3. Liga 66 %). Bei erwartetem Fehlbetrag gibt es keine Erhöhung.

Regeln im Spiel:
- Jede Ablöse kostet zusätzlich ein **Beraterhonorar** (4–12 %, je nach
  Scouting-Abteilung), Vereinslose ein **Handgeld** von 25 % eines
  Jahresgehalts. Beides geht vom Transferbudget ab.
- Neue Verträge und Gehaltserhöhungen müssen in den **Gehaltsspielraum**
  passen.
- **Umschichten**: 2 € Transferbudget ergeben 1 € Gehaltsspielraum pro Jahr
  (Verträge laufen mehrere Jahre). Umgekehrt wird ungenutzter
  Gehaltsspielraum nur anteilig für den Rest der Saison frei. Im
  Angebotsdialog lässt sich fehlender Spielraum mit einem Klick umschichten.
- **Verkäufe**: 45–75 % des Erlöses fließen zurück ins Transferbudget, je
  nach Vertrauen.
- **Nachschlag**: einmal pro Halbserie beantragbar. Bewilligt nur bei
  ausreichendem Vertrauen, erreichbarem Saisonziel und freiem Geld über dem
  Budget; er kostet Vertrauen.
- **Sparkurs**: Steht das Konto am Monatsanfang im Minus, friert der Vorstand
  das Budget ein, sperrt Investitionen und lässt nur ein Viertel der
  Verkaufserlöse ins Budget fließen.
- Auf- und Abstieg wirken über TV-Gelder, Vermarktung und Prognose direkt
  auf beide Budgets.

## Infrastruktur

Sechs Bereiche lassen sich ausbauen. Stufe 3 entspricht dem Ligadurchschnitt;
Vereine starten je nach Reputation auf Stufe 1 bis 5. Die Effekte gelten für
alle Vereine, auch die KI investiert in der Sommerpause.

| Bereich | Wirkung je Stufe |
| --- | --- |
| Stadion | +10 % Plätze pro Ausbau (max. 85.000), 6 % weniger Plätze während der Bauzeit |
| Trainingszentrum | Spielerentwicklung ±8 %, Trainingsverletzungen ∓10 % |
| Nachwuchsleistungszentrum | Talente +1 Stärke und +2 Potenzial, ab Stufe 4 ein Talent mehr pro Jahrgang |
| Medizinische Abteilung | Ausfallzeiten ∓8 %, Regeneration ±3 % |
| Scouting-Abteilung | Beraterhonorar −2 Prozentpunkte, genauere Potenzial-Schätzung |
| Marketing & Fanshop | Sponsoring und Merchandising +8 % |

Zuschauer folgen einem **Nachfragemodell**: Die Nachfrage hängt an
Fanbasis, Reputation, Liga und Gegner; die Zuschauerzahl ist das Minimum aus
Nachfrage und Kapazität. Ein Stadionausbau lohnt sich daher nur, wenn das
Stadion regelmäßig ausverkauft ist. Die Stadionkarte zeigt Auslastung,
Nachfrage, Mehreinnahmen und Amortisationszeit. Bauten werden sofort bezahlt;
wer über das nicht verplante Geld hinaus investiert, kürzt das
Transferbudget. Jede Stufe über dem Ausgangsniveau kostet Unterhalt.

## Datenquellen und Datenqualität

Die Spielerwerte stammen aus **EA SPORTS FC 27** (Launch-Ratings, September
2026). Recherchiert wurde über die Datenbank *fcratings.com*, ergänzt um
Angaben von EA und FUTBIN; die Kader 2026/27 zusätzlich über das
DFB-Datencenter, kicker und weitere Kaderlisten. Weil die Recherche nur über
Suchergebnisse möglich war, ist die Datenlage nicht bei jedem Verein gleich gut.
Jeder Spieler trägt deshalb eine Herkunftskennung, die im Spiel sichtbar ist:

| Kennung | Bedeutung | Spieler |
| --- | --- | ---: |
| – | FC 27: Gesamtwert **und** alle sechs Kartenwerte | 759 |
| – | FC 27: Gesamtwert, Kartenwerte aus der Position abgeleitet | 90 |
| ²⁶ | Letzter verfügbarer FC-26-Datenstand (Freiburg, Stuttgart, Hoffenheim, Wolfsburg; bekannte FC-27-Änderungen eingearbeitet) | 98 |
| ≈ | Echter Spieler im Kader 2026/27, Wert geschätzt | 507 |
| Akademie | Fiktive Nachwuchsspieler aus der Vereinsakademie | – |

Nach Ligen: In der **Bundesliga** sind 405 von 492 Spielern direkt aus FC 27
belegt (dazu 72 FC-26-Werte), in der 2. Bundesliga 242 von 432, in der
3. Liga 202 von 465. Nahezu vollständig mit FC-27-Kartenwerten sind u. a.
Bayern, Dortmund, Leverkusen, Leipzig, Frankfurt, Bremen, Augsburg, Union,
Gladbach, Köln, HSV, Schalke, Elversberg, Paderborn, St. Pauli, Hannover,
Bochum, Dresden, Kiel, Braunschweig, Cottbus, Duisburg, Viktoria Köln,
Rostock, Mannheim, Düsseldorf, Verl und Regensburg.
Das Alter stammt überwiegend aus Kaderlisten und Geburtsdaten; wo es fehlte, ist es geschätzt (≈ im Profil).

Daten verbessern: Die Rohdaten liegen in `data-src/raw/*.md` (eine Datei pro
Verein, Format in `data-src/build_data.py` beschrieben). Nach einer Änderung:

```bash
cd fussballmanager/data-src
python3 build_data.py      # erzeugt js/data.js neu
```

## Rechtliches

Inoffizielles, nicht-kommerzielles Fanprojekt. Vereins- und Spielernamen
werden nur beschreibend verwendet; es gibt **keine Vereinswappen** – die
Schilde zeigen lediglich Vereinsfarben und Kürzel. „EA SPORTS FC“,
„Bundesliga“, „DFB-Pokal“ und alle Vereinsnamen sind Marken ihrer Inhaber.
Wer das Spiel öffentlich verbreiten möchte, sollte die Spielernamen und
Werte vorher rechtlich prüfen lassen.

Enthaltene Fremdsoftware: [lz-string](https://github.com/pieroxy/lz-string)
1.5.0 (MIT-Lizenz) zur Komprimierung der Spielstände.

## Aufbau

```
index.html              Einstiegsseite
css/style.css           Design-System (hell/dunkel, responsiv)
js/data.js              Ligen, Vereine, Spieler (generiert)
js/util.js, names.js    Zufall, Formatierung, Namen für Nachwuchsspieler
js/core/                Spiellogik ohne Oberfläche
  tactics.js            Positionen, Formationen, Positionseignung
  players.js            Spielermodell, Marktwert, Gehalt, Entwicklung
  match.js              Match-Engine
  ai.js                 Aufstellungs-KI
  schedule.js           Spielpläne, Pokal, Relegation
  state.js              Neues Spiel, Speichern/Laden
  economy.js            Finanzen, Vorstand, Nachrichten, Transfers
  club.js               Vorstandsbudgets und Infrastruktur
  season.js             Spieltage, Tabellen, Saisonende
js/ui/                  Oberfläche (Übersicht, Kader, Taktik, Spieltag,
                        Finanzen & Budget, Infrastruktur …)
js/vendor/              lz-string
data-src/               Rohdaten und Build-Skript für js/data.js
tools/bundle.py         Bündelt alles zu einer einzigen HTML-Datei
data-src/rlw_squads.py  Kader der Regionalliga West (erzeugt raw/rlw_*.md)
```
