# Spanwerk – Zerspanungsmechaniker-Simulator

Ein Werkstatt-Simulator für den Ausbildungsberuf Zerspanungsmechaniker/-in.
Läuft im Browser, ohne Framework, ohne Build-Schritt.

Bohren, Gewindebohren, Reiben, Längs- und Plandrehen und Fräsen an
Säulenbohrmaschine, konventioneller Drehmaschine, CNC-Schrägbettdrehmaschine,
Konsolfräsmaschine und CNC-Bearbeitungszentrum. Die Prozesse werden in jedem
Simulationsschritt (480 Hz) gerechnet; wer falsch rüstet oder zu fest am Hebel
zieht, bricht das Werkzeug. Wer die Maschine überlastet, merkt es wie in echt:
Der Keilriemen quietscht und würgt die Spindel ab, die Vorschubkupplung ratscht,
der Frästisch hämmert im Umkehrspiel, die CNC hält mit Alarm an.

## Starten

```bash
cd zerspanung
python3 -m http.server 8000
# danach http://localhost:8000 öffnen
```

`index.html` lässt sich auch direkt öffnen. Die Schriften kommen von Google Fonts;
ohne Internet wird eine Ersatzschrift verwendet.

## Inhalt

* **Karriere:** 18 Aufträge vom ersten Lehrjahr bis zur Gesellenprüfung Teil 2
  (darunter Plandrehen auf Länge und zwei Teile an der CNC-Drehmaschine),
  mit technischer Zeichnung (Schriftfeld nach ISO 7200, ISO-Toleranzen),
  Arbeitsplan, Vorgabezeit und Werkzeugbudget. Bewertet wird nach dem
  IHK-Punkteschlüssel (100–92 sehr gut … 29–0 ungenügend).
* **Freie Werkstatt:** jedes Verfahren mit jedem Werkstoff und jedem Werkzeug
  ausprobieren, ohne Bewertung.
* **Tabellenbuch:** Schnittwerte, Kienzle-Werte, Kernlochtabelle,
  ISO-286-Rechner, Formeln, G- und M-Funktionen der CNC-Drehmaschine,
  Überlast erkennen, Werkstoffe, Betriebsanweisung.
* **CNC-Drehen:** Programmierhilfe erzeugt ein bearbeitbares Programm (Planen,
  Schruppen, Schlichten mit Fase); die Steuerung arbeitet es Satz für Satz ab
  (G0–G3, G4, G90/G91, G92/G50/LIMS, G94/G95, G96/G97, T, M3/M4/M5/M8/M9/M30),
  mit Einzelsatz, Override, Reset, Verschleißkorrektur und Alarmen.
* **Darstellung und Klang:** Dreh- und Fräsmaschinen in 2.5D (Schrägansicht
  mit Hallenlicht): Walzhaut, gedrehte Absätze und Fasen, Nutböden und -wände
  aus der Höhenkarte, Komma-, C- und Wendelspäne mit Anlauffarben, Funken nur
  dort, wo die Physik sie erzeugt. Der Klang ist synthetisch: 100-Hz-Brummen
  mit Schlupfschwebung, Servo-Singen der CNC, Riemenquietschen, Kupplungsratschen,
  Späneknistern, Klopfen, Hämmern und Tischanschlag im Umkehrspiel.
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
| Drehen | Mantel- und Stirnflächenprofil, Spanungsdicke aus dem Weg der letzten Umdrehung, Einstellwinkel je Bewegungsrichtung, Durchbiegung (Kragträger bzw. Reitstock), Rattern mit Prozessdämpfung, Rz = f²/(8 r), Spanformbereich und Spanstau, Wärmedehnung, Spannkraft minus Fliehkraft im Futter |
| Plandrehen | vc fällt zur Mitte, Spitzenhöhe (Butzen, Freiwinkel), Bettschlitten hält nur durch Reibung, Oberschlitten mit Umkehrspiel, schiefer Sägeschnitt (unterbrochener Schnitt), Planzug = halber Längsvorschub |
| Antrieb Drehen | Asynchronmotor nach Kloss, Keilriemen mit Haft- und Gleitzustand, Abwürgen, Motorschutz Klasse 10, Rastkupplung im Schlosskasten; CNC: Servospindel mit Trägheit, S6-Reserve, i²t- und Drehzahlalarm, G96 mit G92-Begrenzung |
| Fräsen | Zahnkraftsumme je Zahnteilung (Altintas) mit Drall und Rundlauf, Schaftbiegung abschnittsweise, Stabilitätskarte (Lobes), Tisch zieht bzw. hämmert im Umkehrspiel, Riemen, Motorkippen, Schraubstock-Haltekraft, Aufschweißen bei Aluminium, Auszug aus der Spannzange, Bruchstumpf |
| Hitze und Funken | Spantemperatur aus vc, h, kc und Wärmeleitung; Glühen ab etwa 600 °C; Funken nur bei Eisen und Titan durch Plattenbruch, mitschneidenden Halter, reibenden Stumpf, Mikroausbrüche oder Kollision |

Die Kennwerte sind Richtwerte aus der üblichen Fachliteratur. Einige Faktoren
(Richtungsfaktor beim Rattern, Spanraummodell) sind auf Praxiserfahrung
kalibriert und keine Messwerte – die Größenordnungen und die Zusammenhänge
stimmen, die Nachkommastellen sind kein Ersatz für einen Zerspanungsversuch.

## Steuerung

| Maschine | Tasten |
| --- | --- |
| alle | `Enter` Spindel bzw. NC-Start · `K` Kühlschmierstoff · `Leertaste` Not-Aus |
| Säulenbohrmaschine | `↓` / `↑` Hebelkraft · `1`–`9` Kraftstufen · `R` zurück · `A` Automatikvorschub · `U` Umsteuern (Gewinde) · `N` nächste Bohrung · Mausrad am Bild |
| Drehmaschine | `←` `→` Bettschlitten (mit `Shift` schnell) · `↑` `↓` X-Zielmaß ±0,1 (`Shift` ±1, `Alt` ±0,02) · `V` Längszug · `P` Planzug · `B` Bettschlitten klemmen · `+` `−` Oberschlitten ±0,1 · `0` Z nullen · `M` Messen · `H` Späne · `W` Platte |
| CNC-Drehmaschine | `Enter` NC-Start · `S` NC-Stopp · `E` Einzelsatz · `R` Reset · `O` Verschleißkorrektur · `W` Platten · `M` Messen |
| Konsolfräsmaschine | `←` `→` Tisch · `V` Vorschub · `R` Eilgang zurück · `M` Messen · `W` Fräser |
| CNC | `S` NC-Stopp · `+` / `−` Vorschub-Override |

## Dateien

```
index.html          Aufbau der Seite
style.css           Darstellung
js/daten.js         Werkstoffe, Schneidstoffe, Werkzeuge, Maschinen, Toleranzen
js/physik.js        Prozessphysik (BohrSim, DrehSim, FraesSim)
js/nc.js            NC-Interpreter und Programmierhilfe der CNC-Drehmaschine
js/missionen.js     Aufträge und IHK-Notenschlüssel
js/audio.js         Maschinengeräusche (Web Audio, synthetisch)
js/zeichnung.js     Technische Zeichnungen
js/szenen.js        Canvas-Darstellung (Bohren) und gemeinsame Helfer
js/szene-dreh.js    Drehmaschinen in 2.5D
js/szene-fraes.js   Fräsmaschinen in 2.5D
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
