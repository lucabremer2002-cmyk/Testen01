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

## Lernmodi

| Modus | Ablauf |
| --- | --- |
| **Gemischt** | wechselt zufaellig zwischen Multiple Choice, Tippen und Karteikarte |
| **Multiple Choice** | vier Vorschlaege, Auswahl per Klick oder Taste `1`–`4` |
| **Tippen** | Loesung selbst schreiben, mit Tippfehler-Toleranz |
| **Karteikarte** | erst ueberlegen, aufdecken, selbst einschaetzen |
| **Hoeren** | das englische Wort wird vorgelesen und muss geschrieben werden |

Die Abfragerichtung ist frei waehlbar: Deutsch → Englisch, Englisch → Deutsch
oder gemischt. Eine Runde umfasst 10, 20, 40 Karten oder genau das, was
gerade faellig ist.

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

## Antworten pruefen

Beim Tippen wird grosszuegig verglichen, damit nur echte Wissensluecken als
Fehler zaehlen:

* Gross-/Kleinschreibung und Satzzeichen sind egal.
* Artikel duerfen entfallen (`das Haus` = `Haus`, `to go` = `go`).
* Umlaute duerfen umschrieben werden (`Tuer` = `Tür`, `gross` = `groß`).
* Kurzformen werden aufgeloest (`I'm` = `I am`, `don't` = `do not`).
* Bei mehreren Loesungen (`flat / apartment`) zaehlt jede einzelne.
* Klammerzusaetze sind optional (`aktuell (nicht: actually)`).
* Ein einzelner Tippfehler fuehrt nicht sofort zum Fehler, sondern zu einem
  zweiten Versuch.

## Inhalte

442 Karten in 15 Themen von A1 bis B2:

Grundwortschatz · Familie & Menschen · Essen & Trinken · Haus & Alltag ·
Zeit, Zahlen & Wetter · Reisen & Verkehr · Koerper & Gesundheit ·
Schule & Lernen · Arbeit & Buero · Gefuehle & Charakter · Natur & Umwelt ·
Unregelmaessige Verben · Phrasal Verbs · Wichtige Redewendungen · False Friends

Jede Karte bringt einen englischen Beispielsatz mit. Englische Woerter und
Beispiele lassen sich ueber das Lautsprechersymbol vorlesen lassen
(`SpeechSynthesis` des Browsers; fehlt sie, wird der Hoeren-Modus deaktiviert).

## Tastatur

| Taste | Wirkung |
| --- | --- |
| `1`–`4` | Antwort im Multiple Choice waehlen |
| `Leertaste` | Karteikarte aufdecken |
| `1` / `J` bzw. `2` / `N` | Karteikarte als gewusst / nicht gewusst werten |
| `Enter` | Antwort abschicken bzw. zur naechsten Karte |
| `Esc` | Runde beenden |

## Weitere Ansichten

* **Wortschatz** – alle Karten durchsuchen, nach Thema und Lernstand filtern
  (neu, in Arbeit, gelernt, schwierig) und einzeln anhoeren.
* **Fortschritt** – Kennzahlen, die letzten 14 Tage als Balken, Fortschritt
  je Thema sowie die Einstellungen (Tagesziel, neue Karten pro Tag,
  Signaltoene, automatisches Vorlesen) und das Zuruecksetzen.

## Eigene Vokabeln

In `vocabulary.js` ein Deck ergaenzen oder eine Zeile an eine bestehende
Wortliste anhaengen – Format: `["english", "deutsch", "Example sentence."]`.
Die `id` eines Decks sollte stabil bleiben, weil der Lernfortschritt darueber
zugeordnet wird.

## Dateien

```
index.html      Aufbau der Seite
style.css       Darstellung, Layout und Responsive-Verhalten
vocabulary.js   alle Lerninhalte
app.js          Lernlogik, Wiederholung, Statistik
```
