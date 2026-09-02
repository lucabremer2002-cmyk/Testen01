# Fußballmanager – Bundesliga bis Regionalliga West

Ein vollständiger Fußballmanager für den Browser. Reines HTML, CSS und
JavaScript – kein Framework, kein Build-Schritt, keine Abhängigkeiten.

## Spielen

`index.html` im Browser öffnen. Das war's.

Alternativ über einen lokalen Server:

```bash
python3 -m http.server 8000
# danach http://localhost:8000 aufrufen
```

### Als einzelne Datei

`fussballmanager.html` enthält das komplette Spiel in einer Datei – ohne
externe Verweise. Praktisch zum Verschicken oder Hochladen. Neu erzeugt wird
sie mit:

```bash
node build-einzeldatei.js              # fussballmanager.html
node build-einzeldatei.js --rumpflos   # nur Inhalt, ohne <html>/<head>/<body>
```

Der Spielstand wird im Browser (localStorage) gespeichert und beim nächsten
Start zum Fortsetzen angeboten.

## Die Spielwelt

| Liga | Vereine | Spieltage | Aufstieg | Abstieg |
| --- | --- | --- | --- | --- |
| Bundesliga | 18 | 34 | – | 2 direkt + Relegation |
| 2. Bundesliga | 18 | 34 | 2 direkt + Relegation | 2 direkt + Relegation |
| 3. Liga | 20 | 38 | 2 direkt + Relegation | 3 |
| Regionalliga West | 18 | 34 | 1 | 3 |

Dazu der **DFB-Pokal** mit 64 Mannschaften: alle Vereine der Bundesliga,
2. Bundesliga und 3. Liga sowie die acht bestplatzierten Klubs der
Regionalliga West als Landespokalvertreter. K.-o.-System in einem Spiel, in
den ersten beiden Runden hat der klassentiefere Verein Heimrecht. Bei
Gleichstand folgen Verlängerung und Elfmeterschießen. Jede Runde bringt
Prämien, der Pokalsieg zusätzlich 4,3 Mio. €.

Alle vier Ligen werden vollständig simuliert – jeder Spieltag, jede Tabelle,
jeder Torschütze. Dazu kommen **83 internationale Vereine** aus 22 Ländern
(Premier League, LaLiga, Serie A, Ligue 1, Eredivisie, Liga Portugal,
Süper Lig, Brasilien, Argentinien, MLS, Saudi Pro League und weitere).
Diese Klubs nehmen **nicht am Spielbetrieb teil**, sind aber auf dem
Transfermarkt als Käufer und Verkäufer aktiv.

Da nur die Regionalliga West abgebildet ist, kommen Auf- und Absteiger der
übrigen Regionalligen aus einem Pool echter Vereine (Chemnitzer FC,
Hallescher FC, Kickers Offenbach, Stuttgarter Kickers …). Unterhalb der
Regionalliga West übernehmen Oberliga-Aufsteiger aus NRW. Der eigene Verein
bleibt dabei immer in der Spielwelt.

### Gestaltung

Aufgebaut nach den Prinzipien der Apple-Systemoberflächen:

- **Systemfarbpalette** für Flächen, Trennlinien und Fülltöne, mit
  vollständig getrenntem hellem und dunklem Satz. Die Oberfläche folgt der
  Einstellung Ihres Systems.
- **Gruppierte Listen mit eingerückten Trennlinien** – sie beginnen erst
  beim Inhalt, nicht am Rand der Fläche.
- **Flache Flächen ohne Schatten.** Schatten tragen nur schwebende Ebenen
  wie Dialoge.
- **Disziplinierte Typo-Skala** in der Systemschrift, mit negativem
  Zeichenabstand bei großen Graden und Tabellenziffern überall.
- **Farbe nur, wo sie etwas bedeutet.** Positionskürzel sind einfarbig – das
  Kürzel selbst trägt die Information; Farbe bleibt Auf- und Abstiegszonen,
  Formkürzeln und Warnungen vorbehalten.
- **Segmentierte Umschalter**, Pillenknöpfe und eine große Seitenüberschrift
  wie in einer Navigationsleiste.

### Vereinsnamen und Wappen

Verwendet werden die **echten Vereinsnamen, Städte, Stadien, Kapazitäten und
Vereinsfarben**. Die echten Wappen sind geschützte Grafiken und werden
deshalb **nicht** verwendet. Stattdessen erzeugt `js/logos.js` für jeden
Verein ein eigenes Wappen als SVG – aus den echten Vereinsfarben, einem
Trikotmuster (Streifen, Halbteilung, Schrägbalken, Ring, Querbalken) und
einer Wappenform (Schild, Rund, Raute, Sechseck). Jeder Verein ist damit auf
einen Blick erkennbar, ohne fremdes Markenmaterial zu übernehmen.

## Was Sie tun können

### Kader und Aufstellung
- Vollständige Kaderübersicht mit Stärke, Potenzial, Form, Fitness, Moral,
  Noten, Toren, Vorlagen, Karten, Marktwert, Gehalt und Vertragsende
- Zehn Attribute je Spieler (Tempo, Technik, Zweikampf, Passspiel, Abschluss,
  Kopfball, Kondition, Übersicht, Stellungsspiel, Reflexe), positionsabhängig
  gewichtet
- Acht Formationen, Aufstellung per Klick auf dem Spielfeld tauschen
- Taktik: Ausrichtung, Pressing, Spielweise, Zweikampfhärte
- Automatische Warnung bei Verletzten, Gesperrten und Fehlbesetzungen

### Spiele
- **Zweidimensionale Ansicht mit sichtbarem Passspiel**: Ein Spieler führt
  den Ball, dribbelt kurz an und sucht dann einen Mitspieler. Der Pass
  fliegt sichtbar – flach und schnell über kurze Wege, als hoher Ball mit
  Flugkurve über weite – und kann vom Gegner abgefangen werden. Wer den Ball
  hat, trägt einen Ring; jeder Spieler zeigt seine **Rückennummer**. Die
  Ansicht liest die laufende Simulation, sie ersetzt sie nicht.
- **Ausdauer im Spiel**: Spieler verlieren über 90 Minuten Frische, je nach
  Kondition und Pressinghöhe. Das drückt ihre Leistung – 28 % aller Tore
  fallen nach der 70. Minute, genau wie in der Realität. Eingewechselte
  Spieler kommen frisch, deshalb lohnen sich Wechsel wirklich.
- **Elfmeter**: Ein Teil der Chancen endet mit einem Foul im Strafraum. Der
  beste Schütze tritt an, rund drei Viertel werden verwandelt – zusammen
  etwa 8 % aller Tore.
- Live-Ticker Minute für Minute, in drei Geschwindigkeiten oder als
  Sofortergebnis
- Während des Spiels wechseln (bis zu fünf) und die Taktik umstellen
- Ballbesitz, Torschüsse, Ecken, Karten, Einzelnoten nach Schulnotensystem
- Verletzungen, Gelbsperren (fünfte Gelbe) und Platzverweise mit Sperren

### Transfermarkt und Verhandlungen

Vor jedem Angebot steht ein **Dossier**: Ablöseforderung im Verhältnis zum
Marktwert, Wechselbereitschaft des Spielers, seine Bedeutung im alten Kader,
Restlaufzeit, Gehaltsvorstellung und konkrete Hinweise („Nur noch ein Jahr
Vertrag – das drückt die Forderung spürbar."). Sie verhandeln nicht im
Blindflug.

- Suche über den kompletten Weltbestand (rund 4.000 Spieler) mit Filtern für
  Bereich, Position, Stärke, Alter, Marktwert und Nation
- **Transferverhandlung mit dem abgebenden Verein**: Sofortzahlung,
  Ratenzahlung über bis zu vier Jahre, Bonus nach 25 Einsätzen,
  Erfolgsbonus und Weiterverkaufsbeteiligung. Eine Messlatte zeigt beim
  Tippen, was der Verein Ihr Angebot wirklich wert findet – so wird
  nachvollziehbar, warum Raten weniger zählen als Bargeld.
- Jede Antwort benennt die Abweichung in Prozent statt nur „zu wenig". Ein
  **Gesprächsklima** verschlechtert sich bei Tiefstangeboten; wer zu lange
  reizt, erlebt den Abbruch.
- **Vertragsverhandlung mit dem Spieler**: Er nennt seine Vorstellungen
  vorab – Gehalt, Laufzeit, Handgeld, erwartete Rolle, Ausstiegsklausel.
  Ein Knopf übernimmt sie, eine Live-Einschätzung sagt, ob er annehmen wird.
- **Spielertausch**: Bis zu drei eigene Spieler lassen sich in einen Deal
  geben. Der andere Verein bewertet sie danach, ob sie ihm sportlich
  weiterhelfen – ein Spieler, der seine Startelf verstärkt, zählt fast voll,
  ein überzähliger nur zu einem Bruchteil. Ein Knopf passt den Barbetrag so
  an, dass die Forderung genau erfüllt ist.
- Eingehende Angebote für eigene Spieler: annehmen, nachverhandeln, ablehnen
- Vertragsverlängerungen; auslaufende Verträge werden angemahnt
- Ratenzahlungen werden wöchentlich abgebucht und dem Verkäufer gutgeschrieben,
  Weiterverkaufsbeteiligungen greifen beim nächsten Transfer

### Leihgeschäfte

- Spieler **verleihen** oder **ausleihen**, bis zum Saisonende
- Frei verhandelbar: Gehaltsanteil des ausleihenden Vereins, Leihgebühr und
  eine optionale Kaufoption, die Sie während der Leihe jederzeit ziehen können
- Die Auswahlliste sortiert Vereine nach **Einsatzaussicht** – eine Leihe zum
  Tabellenführer nützt niemandem, wenn der Spieler dort auf der Bank sitzt
- Beide Seiten bewerten getrennt: Der Verein achtet auf Kaderdichte und
  Gehaltsentlastung, der Spieler auf Spielzeit
- Das Gehalt wird wöchentlich nach dem vereinbarten Schlüssel zwischen beiden
  Vereinen aufgeteilt
- Andere Vereine fragen von sich aus nach Ihren jungen Reservisten
- Leihen sind nur zwischen Vereinen mit laufendem Spielbetrieb möglich

### Jugendakademie

- Fünf Ausbaustufen von der **Kreisebene** bis zur **Eliteschule des
  Fußballs** – sie bestimmen, wie viele Talente nachrücken und wie weit sie
  es bringen können
- Fünf **Scoutingstufen** bestimmen, wie genau das Potenzial eingeschätzt
  wird. Bei schwachem Scouting sehen Sie nur eine breite Spanne wie „54–78";
  mit datengestützter Analyse wird daraus „71–76".
- Jeden Sommer rückt ein neuer Jahrgang nach, mit Scoutbericht und Urteil
- Talente bekommen einen Profivertrag und rücken in den Kader auf, oder sie
  werden freigegeben. Wer mit 20 noch keinen Vertrag hat, verlässt den Verein.
- Die meisten Talente werden solide Spieler ihrer Liga, wenige schlagen
  wirklich ein – die Verteilung ist bewusst rechtsschief

### Sponsoring
Vier Bereiche: Hauptsponsor, Ärmelsponsor, Ausrüster und Stadionname.
Je Bereich liegen drei Angebote vor – kurz und hoch dotiert, ausgewogen oder
lang und erfolgsabhängig. Jedes Angebot besteht aus Festbetrag, Siegprämie,
Meisterprämie und Aufstiegsprämie. Die Höhe richtet sich nach Ansehen und
Ligazugehörigkeit; ein Stadionname-Vertrag benennt das Stadion um.

### Stadion

Eine **Draufsicht** zeigt das Stadion so, wie es gerade dasteht: Die Tiefe
der Tribünen folgt der Kapazität, ab 12.000, 34.000 und 60.000 Plätzen kommt
je ein weiterer Rang dazu, die VIP-Logen sitzen auf der Westtribüne, und die
Ausstattung erscheint als eigene Bauteile – Flutlichtmasten, Videowand,
Parkhaus, Fanshop. Während gebaut wird, steht ein Kran an der betroffenen
Seite. Stellen Sie einen Ausbau ein, zeigt dieselbe Grafik sofort den
geplanten Zustand.

- Eintrittspreise getrennt für Steh-, Sitz- und VIP-Plätze
- Ausbau einzelner Bereiche mit Kosten und echter Bauzeit
- Acht Ausbaustufen: Rasenheizung, Videowand, Gastronomie, Parkhaus,
  Fanshop, Business-Logen, Leistungszentrum, Flutlicht
- Die Zuschauerzahl ergibt sich aus Ansehen, Tabellenplatz, Form, Gegner,
  Eintrittspreisen und Ausstattung

### Bank
- Zwei Verwendungszwecke: **Betriebsmittel** fließen auf das Konto,
  ein **Transferkredit** erhöht zusätzlich das Transferbudget um denselben
  Betrag – dafür verlangt die Bank 0,8 Prozentpunkte Aufschlag
- Kreditrahmen und Zinssatz abhängig von Bonität, Liga und Laufzeit
- Laufzeiten von einem bis zehn Jahren, wöchentliche Annuitätenrate
- Sondertilgung mit 1 % Vorfälligkeitsentschädigung
- Überziehungszinsen von 14,5 % p. a.; bleibt das Konto zu lange im Minus,
  droht der Verband mit Punktabzug

### Finanzen

Wöchentliche Abrechnung mit Spielergehältern, Trainerstab, Stadionunterhalt,
Jugendarbeit, Sponsoreneinnahmen, Medienerlösen nach Tabellenplatz,
Merchandising, Spieltagseinnahmen, Europapokalgeldern, Kreditraten und
Transferraten – aufgeschlüsselt nach Posten für die laufende Saison.

**Transferkredit.** Reicht das Transferbudget für einen Wunschspieler nicht,
lässt es sich bei der Bank aufstocken. Der Kredit erhöht Kontostand und
Transferbudget gleichermaßen; die Wochenrate läuft unabhängig davon weiter,
ob sich der Einkauf sportlich auszahlt.

**Betriebsreserve.** Acht Wochen laufende Kosten bleiben unangetastet. Alles
darüber ist *frei verfügbar* – für Einkäufe, Stadionbau und Jugendarbeit.
Damit kann kein Kauf und kein Bauvorhaben den Verein ins Minus reißen, und
das Transferbudget verspricht nie mehr, als tatsächlich da ist. Bei einem
strukturierten Transfer dürfen Sie über Raten mehr binden, als Sie bar
haben – die Sofortzahlung bleibt aber immer durch Guthaben gedeckt.

**Vorschau und Konto decken.** Die Finanzseite zeigt den wöchentlichen Saldo
und die Reichweite in Wochen. Rutscht der Verein ins Minus oder steuert
darauf zu, erscheint eine Liste von Verkaufskandidaten: erwartete Ablöse
(berechnet aus tatsächlichem Interesse und den Transferbudgets der anderen
Vereine), eingespartes Gehalt und wie viel Prozent der Lücke ein Verkauf
schließt. Ein Klick holt konkrete Angebote ein.

**Notverkauf.** Steht das Konto im Minus, genehmigt der Verband Verkäufe
auch außerhalb des Transferfensters – die Käufer wissen das und drücken den
Preis um etwa 15 %.

### Saison
Am Saisonende: Platzprämien, Relegation im Hin- und Rückspiel (mit
Elfmeterschießen), Auf- und Abstieg, ein neu ausgeloster Pokalwettbewerb,
Meisterprämien der Sponsoren,
Spielerentwicklung nach Alter und Einsatzzeit, Karriereenden, Rückkehr aller
Leihspieler, ein neuer Jahrgang in der Akademie, auslaufende Verträge und
neue Vorstandsziele.
Fällt das Vorstandsvertrauen zu tief, werden Sie freigestellt.

## Aufbau des Quelltexts

| Datei | Inhalt |
| --- | --- |
| `js/core.js` | Zufallsgenerator, Zahlen- und Datumsformatierung |
| `js/data-clubs.js` | Vereine der vier spielbaren Ligen |
| `js/data-intl.js` | 83 internationale Vereine für den Transfermarkt |
| `js/data-pool.js` | Ersatzvereine für Auf- und Abstieg an den Rändern |
| `js/names.js` | Namenspools nach Nationen |
| `js/logos.js` | Wappenerzeugung als SVG |
| `js/players.js` | Spielererzeugung, Attribute, Marktwert, Entwicklung |
| `js/league.js` | Spielplan, Tabellen, Kalender |
| `js/match.js` | Spielsimulation als Minuten-Stepper |
| `js/spielfeld2d.js` | Zweidimensionale Darstellung mit Passspiel |
| `js/pokal.js` | DFB-Pokal: Auslosung, Runden, Verlängerung, Elfmeter |
| `js/stadion-grafik.js` | Draufsicht des Stadions |
| `js/finance.js` | Sponsoring, Stadion, Zuschauer, Kredite |
| `js/transfers.js` | Bewertungen, Verhandlungs- und Leihlogik |
| `js/jugend.js` | Jugendakademie, Scouting, Jahrgänge |
| `js/game.js` | Spielwelt, Tagesablauf, KI |
| `js/saison.js` | Saisonabschluss, Relegation, Auf- und Abstieg |
| `js/save.js` | Kompakter Spielstand (rund 0,9 MB statt 3,5 MB) |
| `js/ui*.js` | Oberfläche |
| `tetris/` | Das frühere Tetris-Spiel, unverändert erhalten |
| `build-einzeldatei.js` | Baut das Spiel in eine einzelne HTML-Datei |

## Hinweise

Alle Sponsorennamen sind frei erfunden. Spieler, Kader und Werte werden zu
Spielbeginn zufällig erzeugt und bilden keine realen Personen ab. Das Projekt
ist für den privaten Gebrauch gedacht.
