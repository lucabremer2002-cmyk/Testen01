# NPC-Life Simulator – Living World

Eine vollständig simulierte Stadt mit über 1.000 autonomen Einwohnern, die im Browser läuft.
Niemand von ihnen folgt einem Drehbuch: Sie treffen eigene Entscheidungen, arbeiten, verlieben
sich, streiten, ziehen um, machen Karriere, scheitern, bekommen Kinder und sterben. Die
interessanten Geschichten entstehen aus der Simulation selbst – nicht aus vorgeschriebenen Events.

Der Spieler ist Beobachter und Gott zugleich: zusehen, die Zeit beschleunigen, eingreifen.

## Schnellstart

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen. Das Spiel läuft vollständig lokal und offline – es gibt
keine Server- oder API-Abhängigkeit.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build (`dist/`) |
| `npm run typecheck` | TypeScript ohne Emit prüfen |
| `npm run simtest -- <Jahre> <Einwohner> <Seed>` | Headless-Langzeittest inkl. Plausibilitätsprüfungen |
| `npm run probe -- <Geschwindigkeit>` | Tagesrhythmus der Stadt nach Uhrzeit messen |
| `npm run e2e` | Browser-Smoketest (benötigt laufenden `npm run dev`) |

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Ziehen / Mausrad | Karte bewegen und zoomen |
| Klick auf eine Person | Details öffnen |
| Doppelklick | Person dauerhaft verfolgen (★) |
| `Leertaste` | Pause / Weiter |
| `1` – `7` | Geschwindigkeit 1× bis 500× |
| `D` | Debug-Modus |
| `S` | Welt speichern |
| `F` | Kamera folgt der ausgewählten Person |
| `Esc` | Auswahl aufheben |

## Architektur

Kernprinzip: **Die Simulation kennt React nicht.**

```
SimulationEngine            reines TypeScript, 10 Ticks/Sekunde
 ├─ SimulationClock         Sim-Minuten, Kalender, Geschwindigkeit 0–500×
 ├─ SimulationScheduler     Bucket-Queue: NPCs werden nur berührt, wenn ihre Aktion endet
 ├─ DecisionEngine          Utility-AI: Kandidaten bewerten, gewichtet auswählen
 ├─ Systeme                 Needs · Work · Social · Life · Housing · Economy
 ├─ RelationshipManager     Beziehungskanten + SocialGraph + Gerüchte
 ├─ EventLog → StoryTracker → Narrator
 └─ GodMode                 Spielereingriffe mit echten Folgen
```

React liest die Welt über `useSimPulse(hz)` nur mit 1–6 Hz aus; die Karte rendert direkt aus den
Engine-Daten per `requestAnimationFrame`. Dadurch bleibt die Oberfläche flüssig, obwohl pro
Sekunde Zehntausende Entscheidungen fallen.

```
src/
  core/          RNG (deterministisch), Mathe-Helfer
  time/          Kalender, SimulationClock
  world/         Stadtgenerator, Gebäude, Wetter, Reisezeiten
  npc/           Datenmodell, Bedürfnisse, Emotionen, Gedächtnis, Ziele, Lebenszyklus
  relationships/ Beziehungen, sozialer Graph, Gerüchte
  economy/       Berufe, Markt, Bank, Hauptbuch
  simulation/    Engine, Scheduler, Entscheidungslogik, Systeme, Gott-Modus
  events/        Ereignisprotokoll, Story-Erkennung, Erzähler
  render/        Canvas-Renderer, Farbpalette
  state/         Zustand-Store (UI) und Engine-Kontext
  components/    React-Oberfläche
  storage/       Serialisierung und IndexedDB-Spielstände
  dev/           Headless-Testwerkzeuge
```

## Wie die NPCs entscheiden

Jeder NPC bewertet bei jedem Handlungsende mehrere mögliche Aktionen. Die Bewertung kombiniert:

1. **Bedürfnisdringlichkeit** – quadratisch steigend, begrenzt durch den tatsächlichen Spielraum
   (satt essen bringt nichts, wenn man satt ist).
2. **Persönlichkeit und Ziele** – Ehrgeiz treibt zur Arbeit, Extraversion zu Menschen,
   Gewissenhaftigkeit ins eigene Bett.
3. **Tageszeit** – nachts gewinnt Schlaf, mittags die Arbeit. Der Faktor wirkt auf das gesamte
   Motiv, nicht nur auf den Bedürfnisanteil.
4. **Geld** – Preise werden am *frei verfügbaren Tagesbudget* gemessen, nicht am Gesamtvermögen.
   Deshalb geht jemand mit 50.000 € auf dem Konto trotzdem nicht dreimal täglich essen.
5. **Weg und Zeit** – Reisezeit kostet, und die Bewertung erfolgt als **Nutzen pro Zeiteinheit**.
   Ohne diese Normierung gewinnen immer die längsten Aktivitäten, und niemand hört auf zu essen.

Anschließend wird unter den besten Optionen gewichtet gelost – kontrollierter Zufall statt
Determinismus, damit dieselbe Person nicht jeden Tag exakt dasselbe tut.

**Ursache und Wirkung statt Abkürzungen:** Wer einen Job will, bewirbt sich, wartet und wird
abgelehnt oder genommen. Wer reich werden will, arbeitet, spart und investiert. Wer eine Beziehung
sucht, geht aus, lernt Menschen kennen und baut Nähe auf.

## Was simuliert wird

* **Bedürfnisse** – Hunger, Energie, Hygiene, Soziales, Spaß, Komfort, Sicherheit, Stress
* **Emotionen** – elf Zustände, die aus tatsächlichen Ereignissen entstehen und abklingen
* **Persönlichkeit** – zehn Werte plus acht Eigenschaften, teilweise an Kinder vererbt
* **Beziehungen** – Vertrauen, Sympathie, Nähe, Loyalität, Attraktion, Konflikt, Respekt;
  Freundschaft, Partnerschaft, Verlobung, Ehe, Trennung, Rivalität, Familie
* **Gerüchte** – Informationen wandern durch den sozialen Graphen; ob jemand glaubt, hängt von
  Vertrauen und Persönlichkeit ab. Affären fliegen so auf – oder eben nicht.
* **Gedächtnis** – wichtige Ereignisse bleiben lebenslang, Belangloses verblasst
* **Arbeit** – 28 Berufe mit Karriereleitern, Bewerbungen, Beförderungen, Kündigungen, Rente
* **Wirtschaft** – Unternehmen mit Umsatz, Kosten, Ruf, Wachstum und Insolvenz; Preise mit
  Inflationstrend; ein Hauptbuch, das jeden Euro der Stadt nach Kategorie ausweist
* **Wohnen** – Miete, Kauf, Umzug, Zwangsräumung, Obdachlosigkeit
* **Lebenszyklus** – Geburt, Schule, Ausbildung, Beruf, Familie, Alter, Tod, Erbschaft

## Geschichten

Der `StoryTracker` beobachtet den Ereignisstrom und erkennt kausale Ketten rund um eine Person.
Erreicht eine Kette genug Gewicht, erzeugt der `Narrator` daraus deutschen Fließtext – mit
Datumsangaben, Verbindungswörtern und einem Titel, der zur Art der Kette passt. Wiederholungen
derselben Ereignisart werden unterdrückt, damit keine Endlosschleifen entstehen.

## Performance

Die Simulation ist so gebaut, dass die Kosten mit der Zahl der *Entscheidungen* wachsen, nicht mit
der Zahl der NPCs:

* **Träge Aktualisierung** – Bedürfnisse und Emotionen werden nur berechnet, wenn ein NPC
  tatsächlich angefasst wird.
* **Bucket-Scheduler** – pro Tick werden nur fällige NPCs verarbeitet.
* **Memoisierte Ortssuche** – „nächstes Restaurant von hier“ ist konstant und wird zwischengespeichert.
* **Detailstufen** – verfolgte und ausgewählte Personen laufen immer vollständig detailliert, der
  Rest ab 100× vereinfacht (längere Aktionen, weniger Kandidaten).
* **Zeitbudget pro Tick** – überschreitet ein Tick sein Budget, verschiebt der Scheduler den Rest.
  Die Bildrate bleibt stabil, die simulierte Zeit läuft kurzzeitig etwas langsamer.

Messwerte auf dem Entwicklungsrechner (1.200 Einwohner, Seed 847291, 500×, Node): rund 86.000
Entscheidungen pro Sekunde bei etwa 28 ms je Tick. Im Browser bei 100× liegt die Tickzeit bei
3–5 ms und die Bildrate bei 60 fps.

Langzeitprüfung: `npm run simtest -- 20 800 555123` simuliert zwanzig Jahre am Stück und prüft
anschließend Bevölkerung, Altersstruktur, Arbeitslosigkeit, Obdachlosigkeit, Unternehmenszahl und
das Entstehen von Geschichten auf Plausibilität.

## Determinismus

Jede Zufallsentscheidung läuft über einen geseedeten Generator (`mulberry32`). Derselbe Seed
erzeugt dieselbe Stadt, dieselben Menschen und dieselben Persönlichkeiten. Eingriffe des Spielers
verändern den Verlauf ab dem Zeitpunkt des Eingriffs.

## Spielstände

Welten werden vollständig in IndexedDB gespeichert – NPCs, Beziehungen, Familien, Gebäude,
Unternehmen, Wirtschaft, Zeit, Ereignisse und Geschichten. Flüchtiger Zustand (wer gerade wo
steht) wird beim Laden rekonstruiert.

## Bekannte Grenzen

* Bei 100× und mehr laufen nicht beobachtete NPCs vereinfacht. Der Tagesrhythmus bleibt erkennbar,
  ist aber etwas unschärfer als bei niedrigen Geschwindigkeiten – das ist der bewusste Preis für
  die Geschwindigkeit.
* Verkehr ist abstrahiert: Reisezeit und Verkehrsmittel werden simuliert, aber keine Fahrzeuge auf
  Straßen.
* Der Erzähler arbeitet mit Vorlagen, nicht mit einem Sprachmodell. Das ist Absicht: Die Simulation
  muss lokal und ohne externe API funktionieren.
