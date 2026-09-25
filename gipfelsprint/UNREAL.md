# Gipfelsprint in Unreal Engine

Dieses Dokument ist eine Übergabe, keine Absichtserklärung. Es enthält
alle gemessenen Werte, die das Spielgefühl ausmachen, und sagt für jeden,
wo er in der Unreal Engine hingehört.

---

## Warum nicht hier

Unreal Engine lässt sich in dieser Arbeitsumgebung nicht betreiben.
Geprüft, nicht vermutet:

| | Befund |
|---|---|
| UE-Installation | nicht vorhanden |
| `DISPLAY` | nicht gesetzt — die Umgebung ist kopflos |
| Freier Speicher | ~30 GB; UE 5 braucht 100 GB+ |
| .NET für UnrealBuildTool | nicht vorhanden |

Ein Editor lässt sich ohne Bildschirm nicht bedienen, und ein Build ohne
Compiler nicht erzeugen. Was hier möglich ist — und was hier passiert
ist — ist das Gegenteil: die Mechanik so lange messen und abstimmen, bis
die Zahlen stimmen. Diese Zahlen sind übertragbar, der Code ist es nicht.

---

## 1 Einheiten

Die Referenz rechnet in **Metern und Sekunden**. Unreal rechnet in
**Zentimetern**. Alle Längen und Geschwindigkeiten also mal 100,
Beschleunigungen ebenso.

    20 m/s  ->  2000 uu/s
    64 m/s² ->  6400 uu/s²

---

## 2 Bewegung — die gemessenen Werte

Gemessen mit `tools/budget.js` gegen die laufende Simulation.

| Größe | Referenz | Unreal | Ort |
|---|---|---|---|
| Laufgeschwindigkeit | 20 m/s | `MaxWalkSpeed = 2000` | CharacterMovement |
| Beschleunigung Boden | 200 m/s² | `MaxAcceleration = 20000` | CharacterMovement |
| Bremsung Boden | 170 m/s² | `BrakingDecelerationWalking = 17000` | CharacterMovement |
| Sprunggeschwindigkeit | 15,5 m/s | `JumpZVelocity = 1550` | CharacterMovement |
| Doppelsprung | 13,5 m/s | eigener Code, siehe unten | |
| Luftsteuerung | 88 m/s² | `AirControl ≈ 0.44`, `AirControlBoostMultiplier = 1` | CharacterMovement |
| Nachfrist an der Kante | 0,16 s | eigener Timer | |
| Sprungpuffer | 0,20 s | eigener Timer | |

### 2.1 Die drei Schwerkräfte

Das ist der Punkt, an dem `GravityScale` allein nicht reicht. Die
Referenz kennt drei Werte, und das Sprunggefühl hängt daran:

| Lage | Wert | Wirkung |
|---|---|---|
| steigend, Sprungtaste gehalten | 42 m/s² | hoher Sprung |
| steigend, Taste losgelassen | 78 m/s² | kurzer Sprung |
| fallend | 64 m/s² | zügiges Fallen |

Damit ist die Sprunghöhe steuerbar: 2,80 m bei gehaltener Taste, deutlich
weniger beim Antippen. In Unreal wird das in `UCharacterMovementComponent`
gelöst, indem `GravityScale` je Tick gesetzt wird — am saubersten in einer
abgeleiteten Klasse:

```cpp
void UGipfelMovement::TickComponent(float Dt, ...)
{
    const bool bSteigt = Velocity.Z > 0.f;
    const float G = bSteigt
        ? (bSprungGehalten ? 4200.f : 7800.f)
        : 6400.f;
    GravityScale = G / FMath::Abs(GetGravityZ() / GravityScale);
    Super::TickComponent(Dt, ...);
}
```

Gemessene Reichweiten, die daraus folgen — sie sind der Prüfstein, ob die
Portierung gelungen ist:

| Technik | Höhe | Weite |
|---|---|---|
| Sprung | 2,80 m | 13,3 m |
| Sprung + Doppelsprung | 4,65 m | 19,5 m |

---

## 3 Der Jet — und seine harte Obergrenze

Der Jet ist **kein Geschwindigkeitsbonus**. Er ermöglicht eine andere
Linie, nicht dieselbe Linie schneller. Das ist die zentrale Entscheidung
des Entwurfs, und sie steht und fällt mit einer Zeile Code.

| Größe | Wert | Bedeutung |
|---|---|---|
| `JET_TEMPO` | **20 m/s** | exakt gleich der Laufgeschwindigkeit |
| Waagerechter Schub | 95 m/s² | |
| Senkrechter Schub | 108 m/s² | netto +44 gegen 64 Fall |
| Steiggrenze | 22 m/s | |
| Schubneigung | 0,10 | volles Steuerkreuz nimmt 10 % Auftrieb |
| Querbremse | 1,4 /s | Tempoverlust, wenn man nicht lenkt |
| Abheben am Boden | 7,0 m/s | Stoß beim Zünden |
| Tank | 1,06 s Schub | |
| Nachfüllen | 1,39 s | nach 0,30 s Sperre |
| Kristall | +34 % Tank | sofort |

### 3.1 Wo die Grenze sitzt

In der Referenz: `src/player.js`, im Jet-Block, Kommentar
`harte Deckelung`. In Unreal gehört sie an die gleiche Stelle — **nach**
dem Schub, **vor** der Bewegung, in jedem Tick:

```cpp
// Erst der Schub ...
Velocity += Schubrichtung * SchubH * Dt;

// ... dann die Grenze. Immer. Ohne Ausnahme.
const FVector Waagerecht(Velocity.X, Velocity.Y, 0.f);
if (Waagerecht.SizeSquared() > FMath::Square(JetTempo))
{
    const FVector Gedeckelt = Waagerecht.GetSafeNormal() * JetTempo;
    Velocity.X = Gedeckelt.X;
    Velocity.Y = Gedeckelt.Y;
}
```

Drei Dinge, die dabei schiefgehen können — alle drei sind in der Referenz
schon einmal passiert:

1. **Die Grenze nur beim Zünden prüfen.** Sie muss in jedem Tick greifen,
   sonst beschleunigt der Schub über sie hinaus.
2. **Eine Ausnahme vom Tempozerfall.** Die Referenz hatte eine — sie war
   genau das, was den Jet zum Tempoknopf machte. Ersatzlos gestrichen.
3. **Restschwung nach dem Loslassen.** Auch danach darf nichts übrig
   bleiben, mit dem man schneller vorankommt als zu Fuß.

### 3.2 Wie man es nachprüft

Nicht glauben, messen. Der Test in `tools/budget.js` gibt der Figur von
Hand Tempo 40 — das Doppelte der Laufgeschwindigkeit — und zündet:

    Tempo beim Zuenden          40
    nach EINEM Schritt Schub    20
    hoechstes Tempo im Schub    20   (Grenze 20)
    hoechstes Tempo danach      20

Der zweite Nachweis ist der Lauf selbst: die sichere Strecke dauert mit
Jet 55,55 s und mit **gesperrtem** Jet 57,41 s. Der Unterschied kommt aus
kleinen Korrekturen, nicht aus Tempo.

### 3.3 Das Tempogefühl

Weil kein echtes Tempo mehr entsteht, muss die Darstellung es tragen. In
der Referenz läuft ein gedämpfter Schubzustand (`jetGlut`, 0..1):

* Blickfeld **+0,20 rad** — der größte Einzelposten im Bild
* Kamera **1,9 m** weiter zurück
* schnell beim Zünden (Dämpfung 11/s), träge beim Loslassen (3,2/s)

Das Nachlaufen ist der Trick: es fühlt sich an wie Schwung, der sich
legt, obwohl nie Schwung da war. In Unreal: `CameraComponent.FieldOfView`
und `SpringArm.TargetArmLength`, beide über denselben gedämpften Wert.

Dazu Flamme (Niagara, Rate an dtReal gekoppelt, **nicht** an den
Simulationsschritt), eine Rauschschleife im Ton mit mitlaufendem
Bandfilter, und ein Stottern bei fast leerem Tank.

---

## 4 Höhe wird Tempo

Die älteste Regel des Spiels und der Grund, warum Stürze sich lohnen.

| Größe | Wert |
|---|---|
| Schwelle | Aufprall 30 (≈ 7 m Fall) |
| Umrechnung | 62 % der Fallgeschwindigkeit werden Vortrieb |
| Obergrenze | 27 m/s |
| Kurzzeitige Rauschgrenze | 31 m/s, 1,6 s, ab Aufprall 36 |

Voraussetzung ist die gehaltene Rutschtaste beim Aufkommen. Damit ist das
Höchsttempo des Spiels 27 — nur 35 % über dem Laufen, und das ist
Absicht: bei 46 gegen 20 müsste eine Abkürzung auf 43 % der Strecke
verkürzen, um sich zu lohnen. Bei 27 gegen 20 genügen 74 %.

---

## 5 Regeln für den Streckenbau

Diese vier Regeln sind aus Fehlern entstanden, die alle mehrfach gemacht
wurden. Sie gelten in jeder Engine.

### 5.1 Die Fairnessgrenze

Kein Pflichtsprung der sicheren Route verlangt mehr als **70 %** dessen,
was ein Doppelsprung trägt:

    höchstens 3,25 m Höhe      höchstens 13,6 m Weite

Wer eine Strecke baut, die 95 % verlangt, baut eine Strecke, die nur er
selbst schafft.

### 5.2 Kante, nicht Mitte

Es zählt die **Lücke zwischen den Flächen**, nicht der Abstand ihrer
Mittelpunkte. Eine 24 m tiefe Fläche 34 m hinter der vorigen lässt zwölf
Meter Luft — nicht vierunddreißig.

Berühren sich zwei Flächen, gibt es nichts zu springen; man läuft. Im
fertigen Tal sind 34 von 53 Übergängen des Hauptwegs begehbar. Das ist
der Unterschied zwischen einer Landschaft und einer Leiter.

### 5.3 Anlauf für den Steigflug

Der Jet hebt mit rund 19 m/s² und fliegt waagerecht mit 20 m/s. Für einen
Steigflug um *h* Meter braucht es also

    Anlauf ≈ 7,5 · √h   Meter

Zwölf Meter Höhe brauchen sechsundzwanzig Meter Anlauf. Wer dichter baut,
lässt die Figur **unter** die nächste Kante fliegen statt auf sie.

### 5.4 Ein Fehlschlag kostet Zeit, nicht den Lauf

Unter jeder Abkürzung liegt Boden. Wer die Senke verfehlt, landet im
Muldenboden; wer die Schlucht verfehlt, landet unten und steigt über eine
Rampe heraus. Vier Sekunden Verlust. Ein Spiel, das für einen
misslungenen Versuch den ganzen Lauf nimmt, wird nicht zum zweiten Mal
versucht.

---

## 6 Was die Strecke leisten muss

Gemessen im fertigen Tal, Testpilot, alle Kombinationen sturzfrei:

| Route | Zeit | Anteil |
|---|---|---|
| sicher ×3, **Jet gesperrt** | 57,41 s | 100 % |
| sicher ×3 | 55,55 s | 97 % |
| eine Abkürzung | 50,58 – 53,17 s | 88 – 93 % |
| zwei Abkürzungen | 46,22 – 48,89 s | 81 – 85 % |
| alle drei | 44,17 s | 77 % |

Monoton: jede Abkürzung hilft, kombiniert helfen sie mehr. Und die erste
Zeile ist die wichtigste — mit gesperrtem Jet und null Zündungen kommt
man ins Ziel.

Die Medaillen liegen auf genau diesen Stufen: Platin 44,9 s (alle drei),
Gold 48,9 s (zwei), Silber 53,4 s (eine), Bronze 60,2 s (ankommen).

---

## 7 Reihenfolge einer Portierung

1. **Bewegung ohne Jet.** Laufen, Sprung, Doppelsprung, die drei
   Schwerkräfte, Nachfrist und Puffer. Danach die Reichweiten messen:
   2,80 / 13,3 und 4,65 / 19,5. Stimmen die nicht, stimmt nichts.
2. **Rutschlandung.** Schwelle 30, Faktor 0,62, Deckel 27.
3. **Jet mit Deckelung.** Zuerst die Deckelung, dann der Schub — in
   dieser Reihenfolge, damit die Grenze nie nachträglich eingebaut werden
   muss. Test aus 3.2 vor allem anderen bestehen.
4. **Tank und Anzeige.** Säule, die den Stand zeigt, nicht Ladungen.
5. **Darstellung.** Blickfeld, Flamme, Ton, Kamera.
6. **Strecke.** Erst danach, und mit den Regeln aus 5.

Die Reihenfolge ist nicht beliebig. Jeder Schritt ist an Zahlen zu
prüfen, die der vorige festgelegt hat.

---

## 8 Was sich nicht portieren lässt

Der Renderer ist handgeschrieben (WebGL2, instanziert, eigenes
Schattenverfahren, eigener Himmel). In Unreal ist davon nichts zu
übernehmen und nichts zu vermissen — Nanite, Lumen und Niagara lösen
dieselben Aufgaben besser.

Der Streckenbaukasten (`src/level.js`, `Builder`) ist dagegen ein
brauchbares Vorbild: eine Strecke entsteht als Folge von Abschnitten, die
jeweils `{ len, rise, turn }` zurückgeben, und der Cursor setzt sie
aneinander. In Unreal wäre das ein `UDataAsset` je Abschnitt plus ein
Editor-Werkzeug, das sie aneinanderreiht — und die Prüfwerkzeuge aus
`tools/` (Fairnessgrenze, Kantenabstand, Anlaufbedarf) laufen als
Commandlet weiter.
