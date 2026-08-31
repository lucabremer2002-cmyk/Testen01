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
- Live-Ticker Minute für Minute, in drei Geschwindigkeiten oder als
  Sofortergebnis
- Während des Spiels wechseln (bis zu fünf) und die Taktik umstellen
- Ballbesitz, Torschüsse, Ecken, Karten, Einzelnoten nach Schulnotensystem
- Verletzungen, Gelbsperren (fünfte Gelbe) und Platzverweise mit Sperren

### Transfermarkt und Verhandlungen
- Suche über den kompletten Weltbestand (rund 4.000 Spieler) mit Filtern für
  Bereich, Position, Stärke, Alter, Marktwert und Nation
- **Transferverhandlung mit dem abgebenden Verein**: Sofortzahlung,
  Ratenzahlung über bis zu vier Jahre, Bonus nach 25 Einsätzen,
  Erfolgsbonus und Weiterverkaufsbeteiligung. Der Verein antwortet mit
  Annahme, Gegenangebot oder Abbruch – über mehrere Runden.
- **Vertragsverhandlung mit dem Spieler**: Wochengehalt, Laufzeit, Handgeld,
  versprochene Rolle im Kader und Ausstiegsklausel. Der Spieler nennt seine
  Vorstellungen und springt ab, wenn zu lange gefeilscht wird.
- Die Forderung hängt von Marktwert, Restlaufzeit, Bedeutung im Kader,
  Transferlisten-Status und dem Ansehen beider Vereine ab
- Eingehende Angebote für eigene Spieler: annehmen, nachverhandeln, ablehnen
- Vertragsverlängerungen; auslaufende Verträge werden angemahnt
- Ratenzahlungen werden wöchentlich abgebucht und dem Verkäufer gutgeschrieben,
  Weiterverkaufsbeteiligungen greifen beim nächsten Transfer

### Sponsoring
Vier Bereiche: Hauptsponsor, Ärmelsponsor, Ausrüster und Stadionname.
Je Bereich liegen drei Angebote vor – kurz und hoch dotiert, ausgewogen oder
lang und erfolgsabhängig. Jedes Angebot besteht aus Festbetrag, Siegprämie,
Meisterprämie und Aufstiegsprämie. Die Höhe richtet sich nach Ansehen und
Ligazugehörigkeit; ein Stadionname-Vertrag benennt das Stadion um.

### Stadion
- Eintrittspreise getrennt für Steh-, Sitz- und VIP-Plätze
- Ausbau einzelner Bereiche mit Kosten und echter Bauzeit
- Acht Ausbaustufen: Rasenheizung, Videowand, Gastronomie, Parkhaus,
  Fanshop, Business-Logen, Leistungszentrum, Flutlicht
- Die Zuschauerzahl ergibt sich aus Ansehen, Tabellenplatz, Form, Gegner,
  Eintrittspreisen und Ausstattung

### Bank
- Kreditrahmen und Zinssatz abhängig von Bonität, Liga und Laufzeit
- Laufzeiten von einem bis zehn Jahren, wöchentliche Annuitätenrate
- Sondertilgung mit 1 % Vorfälligkeitsentschädigung
- Überziehungszinsen von 14,5 % p. a.; bleibt das Konto zu lange im Minus,
  droht der Verband mit Punktabzug

### Finanzen
Wöchentliche Abrechnung mit Spielergehältern, Trainerstab, Stadionunterhalt,
Sponsoreneinnahmen, Medienerlösen nach Tabellenplatz, Merchandising,
Spieltagseinnahmen, Europapokalgeldern, Kreditraten und Transferraten –
aufgeschlüsselt nach Posten für die laufende Saison.

### Saison
Am Saisonende: Platzprämien, Relegation im Hin- und Rückspiel (mit
Elfmeterschießen), Auf- und Abstieg, Meisterprämien der Sponsoren,
Spielerentwicklung nach Alter und Einsatzzeit, Karriereenden, Nachwuchs aus
der eigenen Jugend, auslaufende Verträge und neue Vorstandsziele.
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
| `js/finance.js` | Sponsoring, Stadion, Zuschauer, Kredite |
| `js/transfers.js` | Bewertungen und Verhandlungslogik |
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
