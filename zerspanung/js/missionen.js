/*
 * Karriere: Auftraege vom ersten Lehrjahr bis zur Gesellenpruefung.
 *
 * Jede Mission besteht aus Arbeitsgaengen (ops). Ein Arbeitsgang beschreibt,
 * was gefertigt werden soll; welches Werkzeug und welche Schnittwerte genommen
 * werden, entscheidet der Spieler beim Ruesten.
 *
 * Arbeitsgangtypen:
 *   bohren   Bohrungen (auch Vor- und Kernlochbohren); vor = Index eines frueheren
 *            Arbeitsgangs, dessen Bohrungen aufgebohrt werden
 *   reiben   Reiben einer Passbohrung, vor = Arbeitsgang der Vorbohrung
 *   gewinde  Gewindebohren, vor = Arbeitsgang der Kernlochbohrung
 *   drehen   Drehen an der konventionellen oder der CNC-Drehmaschine: ein Absatz
 *            (d, tol, laenge) oder eine Kontur aus Absaetzen (kontur: d, tol, bis =
 *            Abstand der Schulter von der Stirnflaeche), dazu wahlweise Plandrehen auf
 *            Gesamtlaenge (plan: gesamt, tol, ra, eben) und eine Fase
 *   fraesen  Nut oder Absatz in Laengsrichtung
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  function reihe(n, x0, y0, dx, dy) {
    var r = [], i;
    for (i = 0; i < n; i++) { r.push([x0 + i * dx, y0 + i * dy]); }
    return r;
  }

  var missionen = [
    // ------------------------------------------------------------ 1. Lehrjahr
    {
      id: 'M01', jahr: 1, titel: 'Der erste Tag',
      kunde: 'Lehrwerkstatt', auftrag: 'LW-0101', lohn: 40,
      text: 'Willkommen in der Lehrwerkstatt. Dein erstes Werkstück ist eine Lasche aus Flachstahl. Zwei Durchgangsbohrungen Ø 8, angerissen und gekörnt ist schon. Zeig mal, ob du mit der Säulenbohrmaschine umgehen kannst.',
      meister: [
        'Drehzahl rechnen: n = vc · 1000 / (π · d). Für HSS in S235 nehmen wir vc ≈ 30 m/min. Das ergibt bei Ø 8 rund 1190 1/min – an der Maschine stellst du die nächstkleinere Stufe ein.',
        'Den Hebel gleichmäßig ziehen. Wenn die Späne als lange, silbrige Wendeln kommen, passt der Vorschub. Blaue Späne heißt: zu schnell.',
        'Kurz vor dem Durchbruch Druck rausnehmen, sonst reißt es dir den Bohrer rein.',
        'Und der Schraubstock wird festgespannt. Immer.'
      ],
      mat: 'S235', zeit: 300, budget: 15,
      teil: { art: 'platte', name: 'Lasche', B: 80, H: 40, T: 10 },
      ops: [
        { typ: 'bohren', name: 'Bohren Ø 8', maschine: 'saeule', d: 8, tol: '2768-m', durch: true, dicke: 10,
          pos: [[20, 20], [60, 20]], lageTol: 0.3, ra: 12.5, empfWkz: 'bohrer-HSS-8' }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE'] }
    },
    {
      id: 'M02', jahr: 1, titel: 'Kleine Löcher, große Wirkung',
      kunde: 'Lehrwerkstatt', auftrag: 'LW-0102', lohn: 45,
      text: 'Ein Halteblech braucht drei Bohrungen Ø 3. Kleine Bohrer verzeihen nichts: Sie brechen schon bei gut 1 Nm.',
      meister: [
        'Bei Ø 3 brauchst du über 3000 1/min. Nimm die höchste Stufe, die nicht darüber liegt.',
        'Der Vorschub muss klein sein, etwa 0,05 mm/U. Das ist ein leichter, gleichmäßiger Zug am Hebel – nicht drücken!',
        'Beim Durchbruch entspannt sich die Maschine wie eine Feder. Bei so einem dünnen Bohrer ist das oft das Ende.'
      ],
      mat: 'S235', zeit: 300, budget: 10,
      teil: { art: 'platte', name: 'Halteblech', B: 60, H: 30, T: 8 },
      ops: [
        { typ: 'bohren', name: 'Bohren Ø 3', maschine: 'saeule', d: 3, tol: '2768-m', durch: true, dicke: 8,
          pos: reihe(3, 15, 15, 15, 0), lageTol: 0.3, ra: 12.5 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE'] }
    },
    {
      id: 'M03', jahr: 1, titel: 'Großer Durchmesser',
      kunde: 'Schlosserei Brandt', auftrag: 'SB-2231', lohn: 60,
      text: 'Für einen Geländerpfosten braucht die Schlosserei eine Fußplatte mit zwei Bohrungen Ø 14 in 15 mm Blech.',
      meister: [
        'Die Querschneide eines Ø-14-Bohrers ist über 2 mm breit. Sie schneidet nicht, sie quetscht. Deshalb vorbohren, etwa so groß wie die Querschneide plus Reserve – Ø 5 bis 6.',
        'Große Bohrer: kleine Drehzahl. Ø 14 bei 30 m/min sind knapp 700 1/min.',
        'Mehr Durchmesser heißt mehr Drehmoment. Ein lose aufgelegter Schraubstock fliegt dir da um die Ohren.'
      ],
      mat: 'S235', zeit: 480, budget: 25,
      teil: { art: 'platte', name: 'Fußplatte', B: 100, H: 60, T: 15 },
      ops: [
        { typ: 'bohren', name: 'Vorbohren', maschine: 'saeule', d: null, durch: true, dicke: 15,
          pos: [[25, 30], [75, 30]], lageTol: 0.4, zwischen: true, hinweis: 'Vorbohrdurchmesser frei wählbar' },
        { typ: 'bohren', name: 'Aufbohren Ø 14', maschine: 'saeule', d: 14, tol: '2768-m', durch: true, dicke: 15,
          pos: [[25, 30], [75, 30]], lageTol: 0.4, vor: 0, ra: 12.5 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE'] }
    },
    {
      id: 'M04', jahr: 1, titel: 'Die tiefe Bohrung',
      kunde: 'Hydraulik Kessler', auftrag: 'HK-0417', lohn: 70,
      text: 'Ein Ventilblock aus C45 braucht eine Sackbohrung Ø 6, 40 mm tief. Das sind fast 7 × D. Die Späne müssen da irgendwie raus.',
      meister: [
        'Ab etwa 3 × D bekommen die Späne Platzprobleme. Regelmäßig ganz herausfahren (entspanen), dann fallen sie aus der Nut.',
        'Die Bohrtiefe wird am zylindrischen Teil gemessen. Die Spitze kommt noch dazu: 0,3 × d bei 118°.',
        'Stell den Tiefenanschlag, dann kannst du nicht zu tief bohren.'
      ],
      mat: 'C45', zeit: 420, budget: 15,
      teil: { art: 'block', name: 'Ventilblock', B: 40, H: 40, T: 60 },
      ops: [
        { typ: 'bohren', name: 'Sackbohrung Ø 6 × 40', maschine: 'saeule', d: 6, tol: '2768-m', durch: false, tiefe: 40, tiefeTol: 0.5, dicke: 60,
          pos: [[20, 20]], lageTol: 0.3, ra: 12.5 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE', 'HSSL', 'HSSEL'] }
    },

    // ------------------------------------------------------------ 2. Lehrjahr
    {
      id: 'M05', jahr: 2, titel: 'Gewinde M8',
      kunde: 'Maschinenbau Ott', auftrag: 'MO-5510', lohn: 85,
      text: 'Eine Anschraubplatte bekommt vier Durchgangsgewinde M8. Kernloch bohren, Gewinde schneiden. Klingt einfach.',
      meister: [
        'Kernloch = Nenndurchmesser minus Steigung. M8 hat 1,25 mm Steigung. Schau im Tabellenbuch nach, bevor du einen Bohrer nimmst.',
        'Für Durchgangslöcher Form B mit Schälanschnitt, der schiebt die Späne nach vorn raus. Form C ist für Grundlöcher.',
        'Gewindeschneiden immer mit Schneidöl und langsam: 10 bis 15 m/min.',
        'Tiefenanschlag beim Durchgangsgewinde: Plattendicke plus Anschnittlänge plus etwas Luft, sonst ist das Gewinde unten nicht voll.',
        'Die Rutschkupplung am Gewindeschneidapparat stellst du unter das Bruchmoment des Gewindebohrers. Für M8 sind das etwa 9–10 Nm.'
      ],
      mat: 'S235', zeit: 600, budget: 35,
      teil: { art: 'platte', name: 'Anschraubplatte', B: 80, H: 50, T: 12 },
      ops: [
        { typ: 'bohren', name: 'Kernloch bohren', maschine: 'saeule', d: null, durch: true, dicke: 12,
          pos: [[15, 12], [65, 12], [15, 38], [65, 38]], lageTol: 0.3, zwischen: true, hinweis: 'Kernlochdurchmesser selbst bestimmen' },
        { typ: 'gewinde', name: 'Gewinde M8', maschine: 'saeule', gw: 'M8', durch: true, dicke: 12,
          pos: [[15, 12], [65, 12], [15, 38], [65, 38]], vor: 0, lageTol: 0.3 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE'], gewinde: ['M6', 'M8', 'M10'] }
    },
    {
      id: 'M06', jahr: 2, titel: 'Passbohrung Ø 10 H7',
      kunde: 'Vorrichtungsbau Lenz', auftrag: 'VL-0610', lohn: 110,
      text: 'In eine Aufnahmeplatte kommen zwei Zylinderstifte. Die Bohrungen müssen Ø 10 H7 haben (10,000 bis 10,015 mm) und auf ±0,05 mm sitzen.',
      meister: [
        'H7 schafft kein Spiralbohrer. Vorbohren mit Untermaß, dann reiben. Reibzugabe bei Ø 10: etwa 0,2 mm am Durchmesser.',
        'Die Lage kannst du nicht anreißen, dafür nimmst du den Kreuztisch mit Messuhr. Und anbohren mit dem NC-Anbohrer, sonst verläuft der Bohrer.',
        'Reiben: etwa ein Drittel der Bohrgeschwindigkeit, aber deutlich mehr Vorschub. Und mit Öl. Die Reibahle korrigiert keine Lage!',
        'Mit dem automatischen Vorschub wird die Oberfläche gleichmäßiger als von Hand.'
      ],
      mat: 'C45', zeit: 720, budget: 60,
      teil: { art: 'platte', name: 'Aufnahmeplatte', B: 60, H: 40, T: 12 },
      ops: [
        { typ: 'bohren', name: 'Vorbohren', maschine: 'saeule', d: null, durch: true, dicke: 12,
          pos: [[15, 20], [45, 20]], lageTol: 0.05, zwischen: true, hinweis: 'Vorbohrdurchmesser für Ø 10 H7 wählen' },
        { typ: 'reiben', name: 'Reiben Ø 10 H7', maschine: 'saeule', d: 10, tol: 'H7', durch: true, dicke: 12,
          pos: [[15, 20], [45, 20]], lageTol: 0.05, vor: 0, ra: 1.6 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE', 'HSSTIN'], reibahlen: ['HSSE'] }
    },
    {
      id: 'M07', jahr: 2, titel: 'Die erste Welle',
      kunde: 'Lehrwerkstatt', auftrag: 'LW-0207', lohn: 80,
      text: 'Ab an die Drehmaschine. Ein Rundstahl Ø 40 bekommt einen Absatz Ø 36 h11 auf 50 mm Länge.',
      meister: [
        'Die Schnittgeschwindigkeit bezieht sich auf den Durchmesser, den du gerade drehst. Hartmetall in Baustahl: 200 bis 250 m/min.',
        'Die Wendeschneidplatte hat einen Spanformbereich. Liegt der Vorschub darunter, gibt es lange Bandspäne, die sich um alles wickeln.',
        'Setz den Längsanschlag! Wer in die laufenden Backen fährt, kauft ein neues Futter.',
        'Gemessen wird bei stehender Spindel. Immer.'
      ],
      mat: 'S235', zeit: 600, budget: 30,
      teil: { art: 'welle', name: 'Bolzen' },
      ops: [
        { typ: 'drehen', name: 'Längsdrehen Ø 36 h11', maschine: 'drehKonv', wst: { D: 40, L: 70, spannL: 40 },
          d: 36, tol: 'h11', laenge: 50, laengeTol: 0.3, ra: 3.2 }
      ],
      werkzeuge: { platten: ['CNMG120408-PM', 'CNMG120404-PF', 'CNMG120412-PR'] }
    },
    {
      id: 'M16', jahr: 2, titel: 'Auf Länge planen',
      kunde: 'Lehrwerkstatt', auftrag: 'LW-0216', lohn: 90,
      text: 'Ein gesägter Rundstahl Ø 50 × 103 aus C45 wird an der Stirnseite plangedreht: Gesamtlänge 100 ± 0,1 mm, Ra 3,2, eben, und in der Mitte darf kein Butzen stehen bleiben.',
      meister: [
        'Der Drehmeißel muss genau auf Mitte stehen. Richte ihn an der Reitstockspitze aus. Steht er darüber, drückt die Freifläche zur Mitte hin gegen den Butzen und die Schneide bricht aus. Steht er darunter, bleibt ein Butzen stehen.',
        'Vor dem Plandrehen den Bettschlitten klemmen (B). Sonst weicht er unter der Passivkraft aus, und die Stirnfläche rattert oder wird hohl. Zugestellt wird dann mit dem Oberschlitten.',
        'Der Planvorschub ist an dieser Maschine halb so groß wie der Längsvorschub. Zur Mitte hin sinkt die Schnittgeschwindigkeit gegen null – dort wird die Fläche rauer.',
        'Ankratzen, Z nullen, dann rechnen: 103 − 100 = 3 mm müssen runter. Schruppen, Länge messen, schlichten.'
      ],
      mat: 'C45', zeit: 540, budget: 25,
      teil: { art: 'welle', name: 'Ronde' },
      ops: [
        { typ: 'drehen', name: 'Stirnseite plandrehen', maschine: 'drehKonv', wst: { D: 50, L: 63, spannL: 40, saege: true },
          plan: { gesamt: 100, tol: 0.1, ra: 3.2, eben: 0.03 } }
      ],
      werkzeuge: { platten: ['CNMG120408-PM', 'CNMG120404-PF', 'CNMG120412-PR'] }
    },
    {
      id: 'M08', jahr: 2, titel: 'Lagersitz',
      kunde: 'Getriebebau Hofmann', auftrag: 'GH-3381', lohn: 130,
      text: 'Ein Lagersitz Ø 45 k6 (+0,002 bis +0,018) auf 40 mm Länge, Ra 0,8. Das Wälzlager sitzt später mit Übermaß drauf.',
      meister: [
        'Schruppen und Schlichten. Schlichtzugabe etwa 0,3 bis 0,5 mm im Radius, dann mit kleinem Vorschub und kleinem Eckenradius fertigdrehen.',
        'Rz ≈ f² / (8 · r). Mit r = 0,4 mm und f = 0,1 mm/U kommst du auf etwa Ra 0,8. Eine Wiper-Platte halbiert das.',
        'Das Werkstück wird beim Drehen warm. Stahl dehnt sich um 11,5 µm pro Meter und Kelvin – bei Ø 45 und 10 K sind das 5 µm. Bei einer 16-µm-Toleranz zählt das.',
        'Die Plattenwahl ist nicht für alles gleich. Zum Schlichten wechselst du die Platte.'
      ],
      mat: 'C45', zeit: 900, budget: 50,
      teil: { art: 'welle', name: 'Antriebswelle' },
      ops: [
        { typ: 'drehen', name: 'Lagersitz Ø 45 k6', maschine: 'drehKonv', wst: { D: 50, L: 60, spannL: 45 },
          d: 45, tol: 'k6', laenge: 40, laengeTol: 0.2, ra: 0.8 }
      ],
      werkzeuge: { platten: ['CNMG120408-PM', 'CNMG120404-PF', 'CNMG120412-PR', 'CNMG120408-WM'] }
    },

    // ------------------------------------------------------------ 3. Lehrjahr
    {
      id: 'M09', jahr: 3, titel: 'Die erste Nut',
      kunde: 'Lehrwerkstatt', auftrag: 'LW-0309', lohn: 100,
      text: 'An der Konsolfräsmaschine fräst du eine durchgehende Nut 10 mm breit und 6 mm tief in einen Stahlblock.',
      meister: [
        'Eine Vollnut ist zur Hälfte Gleichlauf. Die Tischspindel hat Spiel – wenn der Fräser zieht, springt der Tisch. Deshalb nicht zu viel auf einmal.',
        'HSS-Fräser in Stahl: um die 25 bis 30 m/min, Zahnvorschub etwa 0,03 bis 0,05 mm.',
        'Tiefe in mehreren Zustellungen fahren. Ein HSS-Fräser biegt sich schnell weg.',
        'Der Vorschub an der Konsolfräsmaschine wird in mm/min eingestellt: vf = fz · z · n.'
      ],
      mat: 'S235', zeit: 720, budget: 40,
      teil: { art: 'nutblock', name: 'Führungsleiste', L: 80, B: 40, H: 30 },
      ops: [
        { typ: 'fraesen', name: 'Nut 10 × 6', maschine: 'fraesKonv', wst: { L: 80, B: 40, H: 30 },
          art: 'nut', breite: 10, breiteTol: '+0.1/+0', tiefe: 6, tiefeTol: '±0.1', y: 20, lageTol: 0.1, ra: 3.2 }
      ],
      werkzeuge: { fraeser: ['HSSZ4', 'HSSZ2'] }
    },
    {
      id: 'M10', jahr: 3, titel: 'Edelstahl ist kein Baustahl',
      kunde: 'Lebensmitteltechnik Weber', auftrag: 'LW-7710', lohn: 120,
      text: 'Eine Halterung aus 1.4301 bekommt vier Bohrungen Ø 8. Die Kollegen haben dabei letzte Woche drei Bohrer verbrannt.',
      meister: [
        'V2A leitet die Wärme schlecht. Die Hitze bleibt an der Schneide – also deutlich langsamer: 10 bis 12 m/min mit HSS-E.',
        'Nie reiben lassen! Wenn der Bohrer nur drückt statt schneidet, verfestigt sich die Oberfläche und ist danach doppelt so hart.',
        'Lieber den automatischen Vorschub nehmen. Der schneidet konstant.',
        'Kühlen. Ohne Emulsion oder Öl wird das nichts.'
      ],
      mat: '1.4301', zeit: 600, budget: 40,
      teil: { art: 'platte', name: 'Halterung', B: 60, H: 40, T: 10 },
      ops: [
        { typ: 'bohren', name: 'Bohren Ø 8', maschine: 'saeule', d: 8, tol: '2768-m', durch: true, dicke: 10,
          pos: [[12, 10], [48, 10], [12, 30], [48, 30]], lageTol: 0.3, ra: 12.5 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE', 'HSSTIN'] }
    },
    {
      id: 'M11', jahr: 3, titel: 'Alu-Nut auf der CNC',
      kunde: 'Sondermaschinenbau Arndt', auftrag: 'SA-1123', lohn: 160,
      text: 'In einen Aluminiumblock kommt eine Führungsnut 12 mm breit und 15 mm tief. Auf dem Bearbeitungszentrum, mit Hartmetall.',
      meister: [
        'Aluminium klebt. TiAlN-Beschichtung enthält selbst Aluminium – das schweißt sich auf. Für Alu gibt es polierte, unbeschichtete Fräser mit großem Spanraum.',
        'Aluminium verträgt hohe Schnittgeschwindigkeit: 400 bis 600 m/min. Die Spindel kann 12 000 1/min.',
        'Wenn es rattert: Schnitttiefe reduzieren oder die Drehzahl mit dem Override verschieben. Es gibt stabile Drehzahlen, die Stabilitätskarte zeigt sie.',
        '15 mm Tiefe bei Ø 12 sind 1,25 × D in voller Breite. Lieber in zwei oder drei Zustellungen.'
      ],
      mat: 'AlMgSi1', zeit: 480, budget: 120,
      teil: { art: 'nutblock', name: 'Führungsblock', L: 100, B: 50, H: 30 },
      ops: [
        { typ: 'fraesen', name: 'Nut 12 × 15', maschine: 'baz', wst: { L: 100, B: 50, H: 30 },
          art: 'nut', breite: 12, breiteTol: '+0.05/+0', tiefe: 15, tiefeTol: '±0.05', y: 25, lageTol: 0.05, ra: 1.6 }
      ],
      werkzeuge: { fraeser: ['VHMZ4', 'VHMZ3AL'] }
    },
    {
      id: 'M12', jahr: 3, titel: 'Die schlanke Welle',
      kunde: 'Pumpenbau Seidel', auftrag: 'PS-0912', lohn: 170,
      text: 'Eine Pumpenwelle aus C45: Ø 25 auf Ø 20 h7 über 150 mm, Ausspannlänge 180 mm. Toleranz 21 µm über die ganze Länge.',
      meister: [
        'L/D = 7. Ohne Reitstock biegt sich die Welle unter der Passivkraft weg, und am freien Ende wird sie dicker als am Futter.',
        'Schlanke Teile rattern. Kleiner Eckenradius und eine Platte mit wenig Passivkraft helfen.',
        'Zwischen den Schnitten messen, an mehreren Stellen. Die Welle ist warm, wenn du misst.'
      ],
      mat: 'C45', zeit: 1080, budget: 60,
      teil: { art: 'welle', name: 'Pumpenwelle' },
      ops: [
        { typ: 'drehen', name: 'Ø 20 h7 auf 150', maschine: 'drehKonv', wst: { D: 25, L: 180, spannL: 30 },
          d: 20, tol: 'h7', laenge: 150, laengeTol: 0.3, ra: 1.6, reitstockErlaubt: true }
      ],
      werkzeuge: { platten: ['CNMG120408-PM', 'CNMG120404-PF', 'CNMG120408-WM', 'DNMG150608-MM'] }
    },

    {
      id: 'M17', jahr: 3, titel: 'CNC: Stufenbolzen',
      kunde: 'Hydraulik Brandt', auftrag: 'HB-3170', lohn: 190,
      text: 'Dein erstes Teil auf der CNC-Drehmaschine: ein Stufenbolzen aus C45 mit Ø 30 h9 und Ø 40 h11, Fase 1 × 45° und Gesamtlänge 100 ± 0,1. Die Programmierhilfe erzeugt das Programm – Werte eintragen, prüfen, Nullpunkt setzen, einfahren.',
      meister: [
        'G96 heißt konstante Schnittgeschwindigkeit: Die Steuerung rechnet die Drehzahl laufend aus dem Durchmesser. Beim Plandrehen zur Mitte hin wird sie immer schneller – deshalb vorher mit G92 begrenzen.',
        'Der Werkstücknullpunkt W liegt auf der fertigen Stirnfläche. Rohteil 103 lang, Fertigteil 100: Die Stirnseite steht 3 mm über Z0.',
        'Vor jedem Werkzeugwechsel den Wechselpunkt anfahren, sonst schwenkt der Revolver ins Werkstück.',
        'Neue Programme im Einzelsatz und mit kleinem Override einfahren. Wer im Eilgang ins Werkstück fährt, zahlt Platte und Halter.'
      ],
      mat: 'C45', zeit: 300, budget: 40,
      teil: { art: 'welle', name: 'Stufenbolzen' },
      ops: [
        { typ: 'drehen', name: 'Stufenbolzen komplett', maschine: 'drehCNC', wst: { D: 50, L: 63, spannL: 40, saege: true },
          plan: { gesamt: 100, tol: 0.1, ra: 3.2, eben: 0.03 },
          kontur: [{ d: 30, tol: 'h9', bis: 20, ra: 1.6 }, { d: 40, tol: 'h11', bis: 45, ra: 3.2 }], fase: 1, laengeTol: 0.1 }
      ],
      werkzeuge: { platten: ['CNMG120408-PM', 'CNMG120412-PR', 'CNMG120404-PF', 'CNMG120408-WM'] }
    },
    // ------------------------------------------------------------ 4. Lehrjahr
    {
      id: 'M13', jahr: 4, titel: 'Titan für die Medizintechnik',
      kunde: 'Orthomed GmbH', auftrag: 'OM-2440', lohn: 220,
      text: 'Eine Knochenplatte aus Ti6Al4V: vier Sackbohrungen Ø 5, 15 mm tief. Ein Rohteil kostet 90 Euro.',
      meister: [
        'Titan leitet kaum Wärme ab. Die Schneide wird glühend heiß, selbst bei kleiner Schnittgeschwindigkeit. VHM mit 35 bis 45 m/min.',
        'Ohne innere Kühlmittelzufuhr kommst du nicht weit. Die Späne müssen raus, sonst schweißen sie in die Bohrung.',
        'Feine, heiße Titanspäne können sich entzünden – trocken erst recht. Brennendes Titan niemals mit Wasser löschen, nur mit Metallbrandpulver (Klasse D).',
        'Im Zyklus musst du die Bohrtiefe für die Spitze selbst programmieren: Spitzenlänge bei 140° etwa 0,18 × d.'
      ],
      mat: 'Ti6Al4V', zeit: 420, budget: 200,
      teil: { art: 'platte', name: 'Knochenplatte', B: 50, H: 30, T: 20 },
      ops: [
        { typ: 'bohren', name: 'Sackbohrung Ø 5 × 15', maschine: 'baz', d: 5, tol: '+0.05/+0', durch: false, tiefe: 15, tiefeTol: 0.2, dicke: 20,
          pos: [[10, 10], [40, 10], [10, 20], [40, 20]], lageTol: 0.05, ra: 3.2 }
      ],
      werkzeuge: { bohrer: ['HSSE', 'HSSTIN', 'VHM3', 'VHM5I'] }
    },
    {
      id: 'M14', jahr: 4, titel: 'Serie in Grauguss',
      kunde: 'Armaturen Pohl', auftrag: 'AP-8800', lohn: 200,
      text: 'Zwölf Bohrungen Ø 8,5 durch 20 mm Grauguss pro Flansch. Die Vorgabezeit ist knapp, der Kunde zahlt nach Stück.',
      meister: [
        'Grauguss bohrt man trocken. Der Graphit schmiert, und der Staub mit Emulsion ist eine Sauerei.',
        'Rechne: HSS mit 22 m/min oder VHM mit 100 m/min. Der VHM-Bohrer kostet zehnmal so viel, ist aber vier- bis fünfmal so schnell.',
        'Kurzspanend heißt: Entspanen ist kaum nötig. Spart Zeit.',
        'Grauguss bricht an der Austrittskante aus, wenn du dort mit viel Vorschub rausgehst.'
      ],
      mat: 'GJL250', zeit: 200, budget: 120,
      teil: { art: 'platte', name: 'Flansch', B: 150, H: 100, T: 20 },
      ops: [
        { typ: 'bohren', name: '12 × Ø 8,5', maschine: 'baz', d: 8.5, tol: '2768-m', durch: true, dicke: 20,
          pos: reihe(6, 20, 25, 22, 0).concat(reihe(6, 20, 75, 22, 0)), lageTol: 0.1, ra: 12.5 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE', 'VHM3', 'VHM5I'] }
    },
    {
      id: 'M18', jahr: 4, titel: 'CNC: Achse aus Edelstahl',
      kunde: 'Lebensmitteltechnik Kraus', auftrag: 'LK-4180', lohn: 240,
      text: 'Eine Rührwerksachse aus 1.4301: Lagersitz Ø 25 k6 mit Ra 0,8, Bund Ø 32 h9, Fase 0,5 × 45°, Gesamtlänge 80 ± 0,05. Rohteil Ø 36 × 83, gesägt.',
      meister: [
        '1.4301 verfestigt sich. Nicht reiben lassen, sondern mit genug Vorschub unter die verfestigte Schicht schneiden. Auch beim Schlichten muss die Platte im Spanformbereich bleiben (Vorschub und Schnitttiefe), sonst wickeln sich Bandspäne um das Teil und zerkratzen die Fläche.',
        'Edelstahl leitet die Wärme schlecht, sie bleibt in Schneide und Span. Mit Emulsion und einer M-Sorte bei etwa 160 bis 200 m/min drehen.',
        'k6 heißt +0,002 bis +0,015 mm. Profis programmieren auf Toleranzmitte, messen nach dem Schlichten und korrigieren den Verschleiß am Werkzeug.',
        'Das Werkstück wird warm und schrumpft beim Abkühlen. 1.4301 dehnt sich um 16 µm je Meter und Kelvin.'
      ],
      mat: '1.4301', zeit: 360, budget: 60,
      teil: { art: 'welle', name: 'Rührwerksachse' },
      ops: [
        { typ: 'drehen', name: 'Achse komplett', maschine: 'drehCNC', wst: { D: 36, L: 58, spannL: 25, saege: true },
          plan: { gesamt: 80, tol: 0.05, ra: 3.2, eben: 0.02 },
          kontur: [{ d: 25, tol: 'k6', bis: 30, ra: 0.8 }, { d: 32, tol: 'h9', bis: 50, ra: 1.6 }], fase: 0.5, laengeTol: 0.1 }
      ],
      werkzeuge: { platten: ['DNMG150608-MM', 'CNMG120408-PM', 'CNMG120404-PF', 'CNMG120408-WM'] }
    },
    {
      id: 'M15', jahr: 4, titel: 'Gesellenprüfung Teil 2',
      kunde: 'Prüfungsausschuss', auftrag: 'GP-2-2026', lohn: 400,
      text: 'Das Prüfungsstück: ein Lagerbock aus C45. Nut fräsen, Passbohrungen Ø 8 H7, Gewinde M8. Alles in der Vorgabezeit, bewertet nach dem IHK-Punkteschlüssel.',
      meister: [
        'Lies die Zeichnung zweimal. Plane die Reihenfolge, bevor du einen Hebel anfasst.',
        'Vorbohrmaß für Ø 8 H7 und Kernloch für M8 – beides steht im Tabellenbuch.',
        'Du kannst das. Ruhig bleiben, sauber arbeiten.'
      ],
      mat: 'C45', zeit: 2400, budget: 120,
      teil: { art: 'lagerbock', name: 'Lagerbock', B: 80, H: 60, T: 20 },
      ops: [
        { typ: 'fraesen', name: 'Nut 12 × 4', maschine: 'fraesKonv', wst: { L: 80, B: 60, H: 20 },
          art: 'nut', breite: 12, breiteTol: '+0.1/+0', tiefe: 4, tiefeTol: '±0.1', y: 30, lageTol: 0.1, ra: 3.2 },
        { typ: 'bohren', name: 'Vorbohren für Ø 8 H7', maschine: 'saeule', d: null, durch: true, dicke: 20,
          pos: [[15, 45], [65, 45]], lageTol: 0.05, zwischen: true },
        { typ: 'reiben', name: 'Reiben Ø 8 H7', maschine: 'saeule', d: 8, tol: 'H7', durch: true, dicke: 20,
          pos: [[15, 45], [65, 45]], lageTol: 0.05, vor: 1, ra: 1.6 },
        { typ: 'bohren', name: 'Kernloch M8', maschine: 'saeule', d: null, durch: true, dicke: 20,
          pos: [[15, 15], [65, 15]], lageTol: 0.2, zwischen: true },
        { typ: 'gewinde', name: 'Gewinde M8', maschine: 'saeule', gw: 'M8', durch: true, dicke: 20,
          pos: [[15, 15], [65, 15]], vor: 3, lageTol: 0.2 }
      ],
      werkzeuge: { bohrer: ['HSS', 'HSSE', 'HSSTIN'], reibahlen: ['HSSE'], gewinde: ['M6', 'M8', 'M10'], fraeser: ['HSSZ4', 'HSSZ2'] }
    }
  ];

  // IHK-Punkteschluessel
  function note(punkte) {
    if (punkte >= 92) { return { note: 1, text: 'sehr gut' }; }
    if (punkte >= 81) { return { note: 2, text: 'gut' }; }
    if (punkte >= 67) { return { note: 3, text: 'befriedigend' }; }
    if (punkte >= 50) { return { note: 4, text: 'ausreichend' }; }
    if (punkte >= 30) { return { note: 5, text: 'mangelhaft' }; }
    return { note: 6, text: 'ungenügend' };
  }

  ZM.missionen = {
    liste: missionen,
    finde: function (id) {
      var i;
      for (i = 0; i < missionen.length; i++) { if (missionen[i].id === id) { return missionen[i]; } }
      return null;
    },
    note: note,
    jahre: ['1. Lehrjahr', '2. Lehrjahr', '3. Lehrjahr', '4. Lehrjahr']
  };
})(typeof window !== 'undefined' ? window : globalThis);
