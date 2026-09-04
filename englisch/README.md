# Englisch Trainer

Ein Vokabeltrainer fuer den Browser – reines HTML, CSS und JavaScript, ohne
Framework, ohne Build-Schritt und ohne Abhaengigkeiten. Der Lernstand bleibt
im Browser (`localStorage`), es gibt kein Backend und keine Anmeldung.

## Starten

`englisch/index.html` im Browser oeffnen. Das war's.

Alternativ ueber einen lokalen Server (noetig, falls der Browser bei
`file://` die Sprachausgabe blockiert):

```bash
python3 -m http.server 8000
# danach http://localhost:8000/englisch/ aufrufen
```

## Englischniveau

Ein **Einstufungstest** mit zwoelf Fragen bestimmt das Niveau nach GER
(A1 bis B2). Der Test laeuft adaptiv in Bloecken zu drei Fragen: wer in
einem Block mindestens zwei richtig hat, steigt in den naechsten Block auf,
sonst endet der Test und die zuletzt sichere Stufe zaehlt. Danach werden die
passenden Themen vorgeschlagen; bei duenn besetzten Stufen (B2 hat nur ein
Thema) kommt die Stufe darunter dazu.

Das Niveau **steigt mit dem Lernstand**: sobald 80 % der Karten der
aktuellen Stufe sicher sitzen, geht es automatisch eine Stufe hoch. Der
Fortschritt dorthin steht auf der Startseite, die Stufenuebersicht unter
*Fortschritt*.

## Wiederholung nach Leitner

Jede Karte liegt in einem von fuenf Faechern. Eine richtige Antwort schiebt
sie ein Fach weiter, eine falsche zurueck in Fach 1:

| Fach | naechste Abfrage nach |
| --- | --- |
| 1 | sofort (noch in derselben Runde) |
| 2 | 1 Tag |
| 3 | 3 Tagen |
| 4 | 7 Tagen |
| 5 | 21 Tagen |

Ab Fach 4 gilt eine Karte als *gelernt*. Faellige Karten werden bevorzugt
abgefragt; neue Karten kommen nur bis zum eingestellten Tageslimit dazu
(Voreinstellung: 10 pro Tag). Falsch beantwortete Karten wandern ausserdem
noch einmal ans Ende der laufenden Runde.

## Lernmodi

| Modus | Ablauf |
| --- | --- |
| **Gemischt** | wechselt zufaellig zwischen Multiple Choice, Tippen und Karteikarte |
| **Multiple Choice** | vier Vorschlaege, Auswahl per Klick oder Taste `1`–`4` |
| **Tippen** | Loesung selbst schreiben, mit Tippfehler-Toleranz |
| **Karteikarte** | erst ueberlegen, aufdecken, selbst einschaetzen |
| **Hoeren** | das englische Wort wird vorgelesen und muss geschrieben werden |
| **Blitzrunde** | 60 Sekunden gegen die Uhr, so viele Karten wie moeglich – mit eigenem Bestwert |

Die Abfragerichtung ist frei waehlbar: Deutsch → Englisch, Englisch → Deutsch
oder gemischt. Eine Runde umfasst 10, 20, 40 Karten oder genau das, was
gerade faellig ist.

## Spielelemente

* **XP und Spielerlevel** – jede richtige Karte bringt 10 XP, ein zweiter
  Versuch 5. Level *n* verlangt insgesamt `80 · (n-1) · n / 2` XP, jedes
  Level hat einen eigenen Rang vom *Neuling* bis zum *Sprachmeister*.
* **Serien-Multiplikator** – jede richtige Antwort in Folge erhoeht den
  Faktor um 0,1 bis maximal ×2 bei zehn am Stueck. Ein Fehler setzt die
  Serie zurueck. Bei 5, 10 und 20 gibt es eine kurze Feier.
* **Bonus-XP** – +50 fuer eine fehlerfreie Runde, +100 fuer das erreichte
  Tagesziel.
* **14 Abzeichen** – vom ersten Test ueber Serien und Combos bis zum
  Buecherwurm bei 500 Antworten. Die Uebersicht steht unter *Fortschritt*.
* **Konfetti, Jubelkarten und Toene** – der Ton steigt mit jeder Serie an.
  Beides laesst sich in den Einstellungen abschalten, und
  `prefers-reduced-motion` wird respektiert.

## Antworten pruefen

Beim Tippen wird grosszuegig verglichen, damit nur echte Wissensluecken als
Fehler zaehlen:

* Gross-/Kleinschreibung und Satzzeichen sind egal.
* Artikel duerfen entfallen (`das Haus` = `Haus`, `to go` = `go`).
* Umlaute duerfen umschrieben werden (`Tuer` = `Tür`, `gross` = `groß`).
* Kurzformen werden aufgeloest (`I'm` = `I am`, `don't` = `do not`).
* Bei mehreren Loesungen (`flat / apartment`) zaehlt jede einzelne.
* Klammerzusaetze sind optional (`tatsaechlich (nicht: aktuell)`).
* Ein einzelner Tippfehler fuehrt nicht sofort zum Fehler, sondern zu einem
  zweiten Versuch.

## Inhalte

442 Karten in 15 Themen von A1 bis B2:

| Stufe | Themen | Karten |
| --- | --- | --- |
| A1 | Grundwortschatz, Familie & Menschen, Essen & Trinken, Haus & Alltag, Zeit, Zahlen & Wetter | 150 |
| A2 | Reisen & Verkehr, Koerper & Gesundheit, Schule & Lernen, Unregelmaessige Verben, Wichtige Redewendungen | 160 |
| B1 | Arbeit & Buero, Gefuehle & Charakter, Natur & Umwelt, Phrasal Verbs | 108 |
| B2 | False Friends | 24 |

Jede Karte bringt einen englischen Beispielsatz mit. Englische Woerter und
Beispiele lassen sich ueber das Lautsprechersymbol vorlesen lassen
(`SpeechSynthesis` des Browsers; fehlt sie, wird der Hoeren-Modus deaktiviert).

## Tastatur

| Taste | Wirkung |
| --- | --- |
| `1`–`4` | Antwort im Multiple Choice und im Einstufungstest waehlen |
| `Leertaste` | Karteikarte aufdecken |
| `1` / `J` bzw. `2` / `N` | Karteikarte als gewusst / nicht gewusst werten |
| `Enter` | Antwort abschicken bzw. zur naechsten Karte |
| `Esc` | Runde beenden |

## Weitere Ansichten

* **Wortschatz** – alle Karten durchsuchen, nach Thema und Lernstand filtern
  (neu, in Arbeit, gelernt, schwierig) und einzeln anhoeren.
* **Fortschritt** – Niveau-Uebersicht, Abzeichen, Kennzahlen, die letzten
  14 Tage als Balken, Fortschritt je Thema sowie die Einstellungen
  (Tagesziel, neue Karten pro Tag, Signaltoene, Vorlesen, Konfetti),
  Einstufungstest wiederholen und Zuruecksetzen.

## Eigene Vokabeln

In `vocabulary.js` ein Deck ergaenzen oder eine Zeile an eine bestehende
Wortliste anhaengen – Format: `["english", "deutsch", "Example sentence."]`.
Das `level` eines Decks (`A1` bis `B2`) steuert Einstufungstest und
Niveau-Fortschritt mit. Die `id` eines Decks sollte stabil bleiben, weil der
Lernfortschritt darueber zugeordnet wird.

## Dateien

```
index.html      Aufbau der Seite
style.css       Darstellung, Layout und Responsive-Verhalten
vocabulary.js   alle Lerninhalte
app.js          Lernlogik, Wiederholung, Niveau, Spielelemente, Statistik
```
