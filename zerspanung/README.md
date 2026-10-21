# Spanwerk – Zerspanungsmechaniker-Simulator

Ein Werkstatt-Simulator für den Ausbildungsberuf Zerspanungsmechaniker/-in.
Läuft im Browser, ohne Framework, ohne Build-Schritt.

Bohren, Gewindebohren, Reiben, Drehen und Fräsen an Säulenbohrmaschine,
konventioneller Drehmaschine, Konsolfräsmaschine und CNC-Bearbeitungszentrum.
Die Prozesse werden in jedem Simulationsschritt (480 Hz) gerechnet; wer falsch
rüstet oder zu fest am Hebel zieht, bricht das Werkzeug.

## Starten

```bash
cd zerspanung
python3 -m http.server 8000
# danach http://localhost:8000 öffnen
```

`index.html` lässt sich auch direkt öffnen. Die Schriften kommen von Google Fonts;
ohne Internet wird eine Ersatzschrift verwendet.

## Inhalt

* **Karriere:** 15 Aufträge vom ersten Lehrjahr bis zur Gesellenprüfung Teil 2,
  mit technischer Zeichnung (Schriftfeld nach ISO 7200, ISO-Toleranzen),
  Arbeitsplan, Vorgabezeit und Werkzeugbudget. Bewertet wird nach dem
  IHK-Punkteschlüssel (100–92 sehr gut … 29–0 ungenügend).
* **Freie Werkstatt:** jedes Verfahren mit jedem Werkstoff und jedem Werkzeug
  ausprobieren, ohne Bewertung.
* **Tabellenbuch:** Schnittwerte, Kienzle-Werte, Kernlochtabelle,
  ISO-286-Rechner, Formeln, Werkstoffe, Betriebsanweisung.
* **Realismusstufen:** *Azubi* (alle Messwerte, Bruchgrenzen, Meister warnt),
  *Geselle* (Drehzahl, Vorschub, Spindellast), *Meister* (nur Digitalanzeige,
  Geräusch und Späne).

## Was gerechnet wird

| Bereich | Modell |
| --- | --- |
| Schnittkraft | Kienzle: kc = kc1.1 · h^−mc mit Korrekturen für Spanwinkel, vc, Verschleiß, KSS |
| Bohrmoment, Vorschubkraft | M = kc · f · (ra² − ri²) / 2, Haupt- und Querschneide getrennt |
| Handhebel | Die Hand gibt eine **Kraft** vor, die Maschine ist eine Feder (≈ 2,5 kN/mm). Beim Durchbruch entspannt sie sich und der Vorschub springt. |
| Spänestau | Spanraumfüllung mit tiefenabhängigem Abtransport (Spanform, KSS, IKZ, Entspanen) |
| Werkzeugbruch | Vergleichsspannung aus Torsion und Biegung, Euler-Knicken, Ermüdung ab 60 % Last, Streuung der Festigkeit |
| Verschleiß | Taylor (HSS n ≈ 0,125, Hartmetall n ≈ 0,25–0,3) plus Warmhärtegrenze |
| Temperatur | empirische Schneidentemperatur, Kühlwirkung je KSS, Anlauffarben |
| Gewinde | Moment ∝ Gewindetiefe², Reibung je Gang, Form B/C, Bohrungsgrund, Rutschkupplung |
| Reiben | Reibzugabe, vc, Vorschub, Schmierung → Durchmesser und Rauheit |
| Drehen | Durchbiegung (Kragträger bzw. Reitstock), Rattern mit Prozessdämpfung, Rz = f²/(8 r), Spanformbereich, Wärmedehnung, Futter-Haltemoment |
| Fräsen | mittlere Spanungsdicke hm, Schaftbiegung, Stabilitätskarte (Lobes), Umkehrspiel im Gleichlauf, Aufschweißen bei Aluminium, Auszug aus der Spannzange |

Die Kennwerte sind Richtwerte aus der üblichen Fachliteratur. Einige Faktoren
(Richtungsfaktor beim Rattern, Spanraummodell) sind auf Praxiserfahrung
kalibriert und keine Messwerte – die Größenordnungen und die Zusammenhänge
stimmen, die Nachkommastellen sind kein Ersatz für einen Zerspanungsversuch.

## Steuerung

| Maschine | Tasten |
| --- | --- |
| alle | `Enter` Spindel bzw. NC-Start · `K` Kühlschmierstoff · `Leertaste` Not-Aus |
| Säulenbohrmaschine | `↓` / `↑` Hebelkraft · `1`–`9` Kraftstufen · `R` zurück · `A` Automatikvorschub · `U` Umsteuern (Gewinde) · `N` nächste Bohrung · Mausrad am Bild |
| Drehmaschine | `←` `→` Bettschlitten (mit `Shift` schnell) · `↑` `↓` X-Zielmaß ±0,1 (`Shift` ±1, `Alt` ±0,02) · `V` Vorschub · `M` Messen · `H` Späne · `W` Platte |
| Konsolfräsmaschine | `←` `→` Tisch · `V` Vorschub · `R` Eilgang zurück · `M` Messen · `W` Fräser |
| CNC | `S` NC-Stopp · `+` / `−` Vorschub-Override |

## Dateien

```
index.html          Aufbau der Seite
style.css           Darstellung
js/daten.js         Werkstoffe, Schneidstoffe, Werkzeuge, Maschinen, Toleranzen
js/physik.js        Prozessphysik (BohrSim, DrehSim, FraesSim)
js/missionen.js     Aufträge und IHK-Notenschlüssel
js/audio.js         Maschinengeräusche (Web Audio, synthetisch)
js/zeichnung.js     Technische Zeichnungen
js/szenen.js        Canvas-Darstellung der Maschinen
js/ui.js            DOM-Helfer, Speicherstand
js/ruesten.js       Werkzeugausgabe, Maschineneinstellung, Rechner, NC-Programm
js/bearbeiten.js    Simulationsschleife, Bedienpult, Meister
js/pruefen.js       Endprüfung und Bewertung
js/spiel.js         Spielablauf, Werkstatt, Tabellenbuch, Einstellungen
tests/              Regressionstests und Kalibrierlauf
```

## Tests

```bash
cd zerspanung
node --test                 # Regressionstests der Physik
node tests/kalibrierung.js  # Kennwerte typischer Fälle ausgeben
```
