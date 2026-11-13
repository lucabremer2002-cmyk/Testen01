# Matchplan – Fußballmanager 1. bis 3. Liga

Ein Fußballmanager für den Browser mit **Bundesliga, 2. Bundesliga und 3. Liga**
in der Zusammensetzung der Saison **2026/27**, mit den **echten Kadern** und den
Spielerwerten aus **EA SPORTS FC 27** – dazu DFB-Pokal, **Champions League,
Europa League und Conference League**, eine Trainerkarriere mit Trainermarkt und
Entscheidungen, die jede Saison anders verlaufen lassen. Reines HTML, CSS und
JavaScript – ohne Build-Schritt, ohne Server.

## Starten

`fussballmanager/index.html` im Browser öffnen. Fertig.

Alternativ über einen lokalen Server (z. B. für Mobilgeräte im WLAN):

```bash
cd fussballmanager
python3 -m http.server 8000
# danach http://localhost:8000 aufrufen
```

Als einzelne Datei (z. B. zum Weitergeben):

```bash
python3 fussballmanager/tools/bundle.py   # erzeugt dist/matchplan.html
```

Der Spielstand wird automatisch nach jedem Spieltag im Browser gespeichert
(3 Slots, komprimiert). Über *Einstellungen* lässt er sich als Datei
exportieren und wieder importieren.

## Was drin ist

**Ligen & Wettbewerbe**
- 18 Bundesligisten, 18 Zweitligisten, 20 Drittligisten (Stand 2026/27,
  z. B. Elversberg und Paderborn in der Bundesliga, Wolfsburg, Heidenheim und
  St. Pauli in der 2. Liga, Fortuna Düsseldorf und Preußen Münster in der 3. Liga)
- Spielplan nach dem echten Rahmenterminkalender 2026/27 (Länderspielpausen,
  Winterpause, spielfreier 1. Mai, Englische Wochen)
- **DFB-Pokal** wie in echt: 64 Teams (36 Erst- und Zweitligisten, Top 4 der
  3. Liga, 24 Landespokalsieger), echte Auslosung der 1. Runde 2026/27
  (Osnabrück – Bayern, HEBC Hamburg – Dortmund, SSV Jeddeloh II – Heidenheim …),
  93 echte Amateurvereine aus allen 21 Landesverbänden, Heimrecht für Amateure,
  geteilte Zuschauereinnahmen, Verlängerung, Elfmeterschießen und Finale in Berlin
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
- Je Liga kalibriert: Bundesliga ca. 3,1 Tore pro Spiel, Heim/Remis/Auswärts
  ≈ 41/22/37 %, 2. und 3. Liga etwas torärmer mit mehr Remis und Karten

**Management**
- Kader mit Stärke, Potenzial, Form, Fitness, Moral, Vertrag, Marktwert
- Aufstellung auf dem Spielfeld per Antippen und Tauschen, 8 Formationen,
  Positionseignung, automatische „Beste Elf“
- Training: Schwerpunkt (Ausgewogen, Kondition, Taktik, Technik, Regeneration)
  und Intensität – wirkt auf Erholung, Form, Verletzungsrisiko und Entwicklung
- Spielerentwicklung nach Alter, Potenzial, Spielzeit und Training;
  ältere Spieler bauen ab, Karriereende, jährlicher Akademie-Nachwuchs
- **Transfermarkt** mit Filtern über alle 1.400+ Spieler und echten
  Verhandlungen (siehe unten): Kauf, Leihe, Ausstiegsklausel, Vorvertrag,
  Raten, Weiterverkaufsbeteiligung, Spielertausch
- Beobachtungsliste, Scout-Aufträge mit Scoutberichten, Transferbilanz
- Angebote anderer Vereine für deine Spieler mit Nachverhandeln und
  Bieterwettstreit, Transfer- und Leihliste, Vertragsauflösung mit Abfindung
- Kaderrollen mit Einsatzversprechen, unzufriedene Spieler, Wechselwünsche
- KI-Vereine kaufen, leihen, ziehen Klauseln und schließen Vorverträge
  (Transferticker)
- **Finanzen**: TV-Gelder, Sponsoring, Zuschauer (Bundesliga fast immer
  ausverkauft; in 2. und 3. Liga füllen sich große Stadien deutlich schlechter,
  zweite Mannschaften ziehen kaum Publikum), Prämien,
  Gehälter, Betriebskosten, Unterhalt der Infrastruktur, Kontostand-Verlauf
- **Vorstandsbudgets** (Transfer- und Gehaltsbudget, siehe unten)
- **Infrastruktur** mit sechs Abteilungen zum Ausbauen (siehe unten)
- **Vorstand** mit Saisonziel nach Kaderstärke, Vertrauensbarometer,
  Entlassung und Jobangeboten anderer Vereine
- **Europapokal**, **Trainerkarriere**, **Ereignisse** und **Auslandsmarkt**
  (siehe die folgenden Abschnitte)
- Posteingang, Statistiken (Torjäger, Vorlagen, Noten, weiße Westen, Karten),
  Vereinsprofile aller Klubs
- Helles und dunkles Design, läuft auf Desktop und Smartphone

## Europapokal

- **Champions League, Europa League und Conference League** im aktuellen Format:
  Ligaphase mit 36 Teams (acht bzw. sechs Spiele), Play-offs der Plätze 9–24,
  Achtelfinale bis Halbfinale mit Hin- und Rückspiel, Finale an neutralem Ort
  (2027: Madrid, Frankfurt, Istanbul).
- **2026/27 mit den echten Töpfen und den echten Gegnern der deutschen Klubs**
  (Bayern: Bodø/Glimt, Viking, Arsenal, Atlético, Lille, Slavia, Manchester
  United, Betis …). Der Rest des Spielplans ist eine regelkonforme Auslosung;
  ab der zweiten Saison wird nach UEFA-Regeln neu gelost (kein Duell innerhalb
  eines Verbands).
- **133 Auslandsvereine** mit echten Namen, Stadien und geschätzter Stärke. Die
  Stars von 23 Spitzenklubs stehen mit ihren FC-27-Werten im Spiel; der übrige
  Kader eines Gegners wird erzeugt, sobald dein Verein auf ihn trifft (fiktive
  Namen, als geschätzt markiert).
- Eigene Spiele laufen über die Match-Engine, alle anderen Partien werden
  berechnet – geeicht an der Engine, damit beide dieselben Kräfteverhältnisse
  liefern. Am Europapokalabend läuft eine Konferenz mit.
- **Prämien nach dem UEFA-Verteilerschlüssel 2024–27** (Champions League:
  18,62 Mio. Startgeld, 2,1 Mio. je Sieg, 11 Mio. fürs Achtelfinale …).
  Vereine im Europapokal planen einen Teil davon fest ein – wer die
  Qualifikation verpasst, spürt das im Budget.
- Qualifikation: Bundesliga-Plätze 1–4 Champions League, Platz 5 und
  DFB-Pokalsieger Europa League, der nächste Platz Conference League; Sieger
  von Champions und Europa League spielen im Jahr darauf Champions League.
- Vereinfachungen: keine Qualifikationsrunden, Viertel- und Halbfinale werden
  frei gelost, Gelbsperren gibt es im Europapokal nicht.

## Karriere, Trainermarkt und Ereignisse

- **Ruf als Trainer** (0–100): wächst mit übertroffenen Saisonzielen,
  Aufstiegen, Titeln und Europapokalreisen, sinkt bei Abstieg und Entlassung.
  Vom Ruf hängt ab, welche Vereine dir eine Stelle anbieten.
- **Trainermarkt**: Jeder Verein hat einen Trainer. Wer weit hinter dem
  Saisonziel liegt, wird entlassen – in der Saison und im Sommer. Passt dein
  Ruf, bekommst du die Stelle angeboten; nach starken Saisons versuchen
  größere Vereine, dich abzuwerben.
- **Karriere-Ansicht** mit Stationen, Titeln, Rekorden, 25 Meilensteinen und
  einer Ehrentafel aller Meister, Pokal- und Europapokalsieger.
- **Ereignisse mit Entscheidung** im Posteingang, etwa 15 bis 20 pro Saison:
  Pressekonferenz vor großen Spielen, Spieler fordern Einsatzzeit, Berater
  pokern, Ärger in der Kabine, Fans fordern günstigere Tickets, Sponsor bietet
  Sofortgeld oder Erfolgsprämie, Namensrechte am Stadion, Trainingslager,
  Kapitänswahl, Zusatzziel des Vorstands, Fitspritzen vor dem Topspiel,
  Geheimtipp aus dem Ausland … Ohne Antwort entscheidet nach einer Woche der
  Co-Trainer.
- **Versprechen** werden nachgehalten: Wer Einsätze zusagt und nicht liefert,
  verliert das Vertrauen des Spielers – und ein Stück weit der Kabine.
- **Fanstimmung** wirkt auf Zuschauerzahlen und das Vertrauen des Vorstands.
- **Halbzeitansprache** im Live-Spiel: loben, ruhig bleiben oder wachrütteln –
  je nach Spielstand kann das ein Spiel drehen oder kippen.
- **Testspiele** in der Vorbereitung (auch gegen Auslandsvereine): Spielpraxis
  ohne Druck, unbegrenzt wechseln, keine Sperren.

## Spielwelt auf lange Sicht

- **Spielpraxis entscheidet**: Stammspieler entwickeln sich schnell,
  Bankdrücker kaum. Am Saisonende wird das **Potenzial** junger Spieler neu
  eingeschätzt – wer spielt und überzeugt, wächst über sich hinaus, wer nur
  zuschaut, verliert den Anschluss. Leihen lohnen sich.
- Akademien bringen überwiegend solide Profis hervor, selten einen
  Ausnahmespieler. Der Leistungsabfall beginnt mit 31 sanft, Torhüter halten
  ihr Niveau drei Jahre länger.
- **Auslandsmarkt**: Leistungsträger wechseln zu Auslandsvereinen (und
  bleiben dort sichtbar – als Gegner im Europapokal), Vereine holen Ersatz und
  Verstärkungen von dort. Du bekommst in jedem Transferfenster rund 30
  Empfehlungen aus dem Ausland (Transfermarkt, Filter „Ausland"), kannst die
  Stars der Spitzenklubs kaufen – und erhältst für deine eigenen Spieler
  Angebote aus England, Spanien oder Italien.
- Ein **Regler hält das Niveau der Ligen stabil**: Liegt eine Liga über ihrem
  Ausgangsniveau, wandern mehr Spitzenspieler ab; liegt sie darunter, kommen
  mehr Zugänge. In Testläufen über 15 Saisons bleibt die Bundesliga im Schnitt
  bei 77 Punkten Mannschaftsstärke, mit Bayern und Dortmund an der Spitze.
- **KI-Vereine wirtschaften**: Notverkäufe statt Dauerminus, Aufsteiger
  investieren das TV-Geld, Talente ohne Perspektive wechseln eine Liga tiefer,
  große Namen rüsten gezielt nach.

## Transferbudget

Der Kontostand ist nicht das Transferbudget. Wie bei echten Vereinen gibt der
Vorstand zu Saisonbeginn und noch einmal im Januar zwei Budgets frei:

- **Liquiditätsreserve**: 10 % der Jahresgehälter plus 15 % der
  Betriebskosten müssen immer auf dem Konto bleiben.
- **Transferbudget**: ein Teil des Geldes über der Reserve. Wie groß der Teil
  ist (55 bis 90 %), hängt vom Vertrauen des Vorstands ab. Im Januar wird mit
  75 % dieses Anteils neu gerechnet; ist vom Sommer mehr übrig, bleibt der
  Rest stehen. Liegt der Kontostand unter der Reserve,
  gilt Sparkurs: kein Budget, nur Verkäufe.
- **Gehaltsbudget**: ein Anteil am erwarteten Umsatz (BL 58 %, 2. BL 62 %,
  3. Liga 66 %), mindestens 12 % über den aktuellen Gehältern und höchstens
  30 % darüber.

Was darauf angerechnet wird:

- Ablösen kosten zusätzlich **10 % Beraterhonorar**. Vereinslose verlangen
  ein **Handgeld** von 25 % ihres Jahresgehalts.
- Verkaufserlöse fließen zu **80 %** zurück ins Transferbudget (bei Sparkurs
  zu 50 %).
- Abfindungen bei Vertragsauflösungen gehen vom Transferbudget ab.
- Neue Verträge und Verlängerungen müssen ins Gehaltsbudget passen.
- Transfer- und Gehaltsbudget lassen sich **1 : 1 umschichten**.
- Einmal pro Transferfenster kann man beim Vorstand **mehr Budget anfragen**.
  Die Antwort hängt vom Vertrauen und vom freien Geld ab; eine Absage kostet
  etwas Vertrauen.

## Transfers und Verhandlungen

Inspiriert von Football Manager, dem Karrieremodus von EA SPORTS FC, der
Master League aus PES und Anstoss.

**Zwei Verhandlungsstufen.** Erst mit dem Verein über die Ablöse, dann mit
dem Spieler über den Vertrag. Beide Seiten haben eine sichtbare **Geduld**
(2 bis 5 Runden, je nach Verein und Lage). Jedes zu niedrige Angebot kostet
Geduld, ein lächerliches doppelt. Darauf folgt ein Gegenangebot, das mit
schwindender Geduld sinkt, aber nie über der Ausgangsforderung liegt. Ist die
Geduld aufgebraucht, ruhen die Gespräche drei Wochen. Verhandlungen bleiben
zwei Wochen offen und lassen sich jederzeit fortsetzen.

**Bausteine beim Verein**
- Ablöse sofort oder in **2–3 Jahresraten**: Der Verkäufer verlangt dafür
  etwas mehr, offene Raten erhöhen deine Liquiditätsreserve.
- **Weiterverkaufsbeteiligung** von 10 oder 20 %: Sie senkt die Ablöse,
  besonders bei jungen Talenten. Bei einem späteren Verkauf geht der Anteil
  automatisch an den alten Verein (das gilt auch, wenn dir eine Beteiligung
  zusteht).
- **Spielertausch**: Der Verkäufer rechnet deinen Spieler nach eigenem Bedarf
  an (85 % oder 55 % des Marktwerts), und der Spieler muss wechseln wollen.
- **Leistungsträger** großer Vereine gibt es nur für rund das 1,6-Fache.

**Vertrag mit dem Spieler**
- **Kaderrolle** (Schlüssel-, Stamm-, Rotations-, Ergänzungs- oder
  Perspektivspieler): Eine größere Rolle als erwartet senkt die
  Gehaltsforderung, eine kleinere erhöht sie oder schreckt ab.
- **Handgeld** gegen Gehalt: Mehr Handgeld senkt das geforderte Jahresgehalt.
- **Ausstiegsklausel**: Gute Spieler wünschen sich eine. Fehlt sie oder ist
  sie zu hoch, wollen sie 8 % mehr Gehalt.
- Ältere Spieler unterschreiben nur kurz. Bei Topspielern bietet manchmal ein
  größerer Verein mit, dann wird es teurer.

**Weitere Geschäfte**
- **Leihen** bis Saisonende mit Gehaltsanteil und optionaler **Kaufoption**,
  in beide Richtungen. Eigene Talente landen auf der Leihliste und sammeln
  Spielpraxis. KI-Vereine ziehen Kaufoptionen, wenn sich der Spieler bewährt.
- **Ausstiegsklauseln** (etwa jeder achte Spieler ab Stärke 70 und bis
  29 Jahre, außerhalb der Topklubs, dazu alle selbst ausgehandelten): Zahlst
  du die Klausel, kann der Verein nicht ablehnen. Umgekehrt ziehen KI-Vereine
  Klauseln deiner Spieler.
- **Vorverträge** ab Januar mit Spielern im letzten Vertragsjahr: Sie kommen im
  Sommer ablösefrei. Andere Vereine machen das auch mit deinen Spielern.
- **Angebote für deine Spieler**: Du kannst mehr verlangen. Der Interessent
  nimmt an, bessert nach oder zieht zurück. Manchmal überbietet ein zweiter
  Verein den ersten.
- **Deadline Day**: In den letzten 48 Stunden gehen Verkäufer runter, KI-Vereine
  machen mehr Geschäfte, und das Spiel hält am 30.08. und 30.01. an.

**Kaderrollen und Moral.** Jeden Monat wird geprüft, ob die versprochene
Rolle eingelöst wurde. Ein Stammspieler mit zu wenig Minuten wird erst
unzufrieden und kann einen **Wechselwunsch** äußern. Andere Vereine bieten
dann weniger, ein neuer Vertrag mit größerer Rolle stimmt ihn um. Beim
Sofortergebnis wechselt der Co-Trainer, damit auch Rotationsspieler Minuten
bekommen.

**Scouting.** Scout-Aufträge nach Position, Alter, Liga, Preisgrenze und
Schwerpunkt (beste Verstärkung, Talente, Schnäppchen). Nach 6 bis 14 Tagen
kommen bis zu acht Empfehlungen mit Note A–D, Einordnung (z. B.
„Sofortverstärkung“, „Toptalent“), Stärken und Schwäche, und das Potenzial ist
dann genau bekannt. Die Zahl der Scouts und das Tempo hängen von der
Scoutingabteilung ab. Dazu gibt es eine Beobachtungsliste (★) und eine
Transferbilanz der Saison mit offenen Raten.

## Infrastruktur

Sechs Abteilungen mit den Stufen 1 bis 5. Die Startstufe richtet sich nach
der Reputation des Vereins. Auf Stufe 3 ist jede Abteilung neutral, darunter
schlechter, darüber besser. Alle Vereine (auch die KI) nutzen dieselben Effekte.

| Abteilung | Wirkung |
| --- | --- |
| Stadion | rund +10 % Plätze pro Ausbau (1.000 bis 8.000, maximal 90.000). Während des Baus fehlen 8 % der Plätze. Die Ansicht zeigt die erwartete Auslastung, damit man nicht für ein halbleeres Stadion baut. |
| Trainingszentrum | Entwicklung −10 % bis +10 %, Trainingsverletzungen +20 % bis −20 % |
| Nachwuchsleistungszentrum | Talente −2 bis +2 Stärke und Potenzial; ab Stufe 4 ein zusätzliches Talent pro Jahr |
| Medizinische Abteilung | Ausfallzeiten +18 % bis −18 %, schnellere Regeneration |
| Scoutingabteilung | Potenzialanzeige fremder Spieler wird genauer; auf Stufe 5 exakt |
| Marketing & Fanshop | +8 % Sponsoring pro neuer Stufe |

Ein Ausbau wird sofort bezahlt und dauert mehrere Wochen. Danach steigt der
jährliche Unterhalt. Der Vorstand gibt nur Geld oberhalb der
Liquiditätsreserve frei. Kosten und Unterhalt skalieren mit der Liga: In der
3. Liga kostet eine Stufe etwa ein Achtel des Bundesliga-Preises.

## Echte Vereinsdaten

Jeder der 60 Vereine hat ein recherchiertes Profil (`data-src/profiles.py`):

| Daten | Quelle / Stand |
| --- | --- |
| Zuschauerschnitt 2025/26 aller Vereine (1. bis 3. Liga, Regionalliga-Aufsteiger) | diefalsche9.de-Zuschauertabellen, Abgleich mit kicker/90min (Stand 18.05.2026) |
| TV-Geld 2026/27 aller 36 Profiklubs (z. B. Bayern 92,3 Mio., Elversberg 31,2 Mio., Wolfsburg 24,1 Mio., Cottbus 7,5 Mio.) | Prognose der Liga an die Klubs, veröffentlicht von Sport Bild (u. a. via digitalfernsehen.de, hamburg1887.de, fussball-geld.de) |
| Gehaltsvolumen (Bayern, Dortmund, Leverkusen, Leipzig, Stuttgart, Frankfurt, Freiburg, Gladbach, Wolfsburg, St. Pauli, Hertha, Hannover, Nürnberg, Kaiserslautern, Magdeburg) | Capology-Schätzungen 2025/26 bzw. 2026/27 |
| Verbindlichkeiten Schalke (147,9 Mio.) und Hertha (Nordic Bond 40 Mio.) | Konzern- bzw. Jahresabschluss 2024/25 |
| DFB-Pokal-Prämien (211.886 € in Runde 1 bis 4,32 Mio. € für den Sieger) | Offizieller DFB-Verteilerschlüssel 2025/26 |
| DFB-Pokal 2026/27: Teilnehmerfeld und Auslosung der 1. Runde (6. Juni 2026) | fussball.de („Diese Amateurteams sind dabei“), kicker, Sportschau, schalke04.de, diefalsche9.de |
| Rahmenterminkalender 2026/27 | DFB/DFL: 2./3. Liga ab 7.8., Bundesliga ab 28.8. (14 Spieltage vor Weihnachten), Pokal 21.–24.8. / 27.–28.10. / 1.–2.12., Länderspielpausen, Winterpause ab 20.12., spielfreier 1. Mai, Finale 29.5. |
| Torschnitt und Ergebnisverteilung | Bundesliga 2024/25: 959 Tore in 306 Spielen (3,13), 111 Auswärtssiege |

Dazu kommt allgemeines Vereinswissen: Gründungsjahr, Spitzname, Rivalen, Vereinstyp
(Traditions-, Werks-, Investoren-, Kult-, Ausbildungsverein), Stärke des
Nachwuchsleistungszentrums (drei DFB-Sterne u. a. bei Union, Kaiserslautern,
Nürnberg, Paderborn, Bielefeld und Heidenheim belegt) und die Geduld des Umfelds.

**So wirken die Daten im Spiel**
- **Zuschauer** kommen aus der echten Fanbasis. Ein Ligawechsel kostet oder
  bringt Publikum (je Liga −18 % bzw. +12 %), Kult- und Traditionsvereine
  verlieren weniger. Ausverkaufte Stadien haben mehr Nachfrage als Plätze, ein
  Stadionausbau lohnt sich nur dort. Derbys, attraktive Gäste, Pokal und
  Tabellenplatz verändern die Zahl, Englische Wochen senken sie.
- **TV-Geld**: 2026/27 gelten die veröffentlichten Beträge. Danach rechnet das
  Spiel nach dem DFL-Prinzip: Die Hälfte wird gleich verteilt, der Rest nach
  einer Fünfjahreswertung, die aus den echten Beträgen zurückgerechnet und mit
  jeder Saison fortgeschrieben wird. Absteiger bekommen deshalb noch
  jahrelang viel TV-Geld, Aufsteiger wenig.
- **Gehälter**: Das Gehaltsniveau je Liga ist an die Gehaltsschätzungen
  angepasst. Wo das Gehaltsvolumen eines Vereins bekannt ist, wird der Kader
  darauf eingestellt (Bayern rund 240 Mio., Hertha rund 24 Mio.). Beim Abstieg
  greifen Abstiegsklauseln: Alle Gehälter sinken um 25 %.
- **Schulden** werden mit 5 % verzinst und mit 7 % pro Jahr getilgt.
  Gesellschafter von Werks- und Investorenklubs (Bayer, VW, Red Bull, Hopp
  u. a.) gleichen Verluste bis zu einer Obergrenze aus.
- **Derbys** zählen beim Vorstand doppelt, sind kartenreicher und ziehen mehr
  Zuschauer. Das Umfeld reagiert je nach Verein unterschiedlich geduldig.
- **DFB-Pokal**: Am Saisonende stehen die Töpfe fest (Topf 1: Bundesliga und
  2. Liga Platz 1–14, Topf 2: 2. Liga Platz 15–18, Top 4 der 3. Liga und die
  24 Landespokalsieger). In jedem Landesverband spielen die nicht qualifizierten
  Dritt- und Regionalligisten mit den Amateurvereinen um den Startplatz; als
  Drittligist kann man den DFB-Pokal also verpassen. Amateure haben zuhause
  gegen Profis einen Pokalfight-Bonus. In der Simulation gewinnen sie so gegen
  Bundesligisten rund 4 % und gegen Zweitligisten rund 12 % der Spiele,
  Drittligisten gegen Bundesligisten knapp 20 %. Die Zuschauereinnahmen werden
  geteilt, große Gäste füllen kleine Stadien. Amateurvereine haben fiktive
  Spieler, ihre Stärke, Zuschauerzahl und Vereinsfarben sind geschätzt.
- **Match-Engine** pro Liga kalibriert: In der Bundesliga rund 3,1 Tore pro
  Spiel und 41/22/37 % Heim/Remis/Auswärts, in der 2. und 3. Liga etwas
  torärmer, mit mehr Remis und mehr Karten.

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
| – | Stars der Auslandsvereine: FC-27-Gesamtwert (Stand nach dem Sommer 2026), Kartenwerte abgeleitet | 183 |
| ≈ | Übrige Spieler der Auslandsvereine und Zugänge aus dem Ausland: fiktive Namen, Stärke geschätzt | – |

Nach Ligen: In der **Bundesliga** sind 405 von 492 Spielern direkt aus FC 27
belegt (dazu 72 FC-26-Werte), in der 2. Bundesliga 242 von 432, in der
3. Liga 202 von 465. Nahezu vollständig mit FC-27-Kartenwerten sind u. a.
Bayern, Dortmund, Leverkusen, Leipzig, Frankfurt, Bremen, Augsburg, Union,
Gladbach, Köln, HSV, Schalke, Elversberg, Paderborn, St. Pauli, Hannover,
Bochum, Dresden, Kiel, Braunschweig, Cottbus, Duisburg, Viktoria Köln,
Rostock, Mannheim, Düsseldorf, Verl und Regensburg.
Das Alter stammt überwiegend aus Kaderlisten und Geburtsdaten; wo es fehlte, ist es geschätzt (≈ im Profil).

Die **Auslandsvereine** (`data-src/europe.py`) tragen echte Namen, Stadien und
Farben; ihre Spielstärke ist eine Schätzung auf der FC-27-Skala (Schnitt der
besten Elf), ebenso Kapazitäten und Farben kleinerer Klubs. Töpfe und Gegner
der deutschen Klubs 2026/27 stammen aus den Veröffentlichungen von UEFA und
Vereinen.

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
css/style.css           Design-System: Stadionheft (hell) und Flutlicht (dunkel),
                        Akzent in den Vereinsfarben, responsiv
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
  clubdata.js           echte Vereinsdaten: Fanbasis, TV-Geld, Schulden, Derbys
  cup.js                DFB-Pokal: Qualifikation, Landespokale, Amateurvereine, 1. Runde
  europe.js             Champions/Europa/Conference League, Auslandsvereine, UEFA-Prämien
  transfer.js           Verhandlungen, Leihen, Klauseln, Vorverträge, Scouting, Rollen
  abroad.js             Auslandsmarkt, Niveauregler der Ligen, Finanzplanung der KI-Vereine
  career.js             Ruf, Titel, Meilensteine, Trainermarkt, Fanstimmung
  events.js             Ereignisse mit Entscheidung, Versprechen, Halbzeitansprache, Testspiele
  season.js             Spieltage, Tabellen, Saisonende
js/ui/                  Oberfläche (Übersicht, Kader, Taktik, Spieltag, Europapokal, Karriere …)
js/vendor/              lz-string
data-src/               Rohdaten, Vereinsprofile (profiles.py), Pokal-Amateure (amateurs.py),
                        Auslandsvereine und Europapokal 2026/27 (europe.py), Spielplan-Löser
                        für die Ligaphasen (euro_draw.py), Build-Skript
tools/bundle.py         packt alles in eine einzelne HTML-Datei (dist/)
```
