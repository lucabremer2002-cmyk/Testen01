/*
 * Look-Datenbank.
 *
 * source-Werte pro Produkt:
 *   "eigene"   – Produkt aus der eigenen Marke der Person (sicher, dass sie es nutzt)
 *   "berichtet"– in Interviews, Beauty-Videos oder Presse genannt
 *   "gesicht"  – Person ist Werbegesicht der Marke
 *   "match"    – kein Beleg, dass sie es nutzt; erzeugt aber denselben Effekt
 *
 * Preise sind grobe Richtwerte (ca. in €) und können abweichen.
 * Shop- und Video-Links werden als Suchlinks erzeugt (app.js), damit sie
 * nicht ins Leere laufen, wenn ein Shop seine Produkt-URLs ändert.
 */
window.LOOKS = [
  {
    id: "hailey-glazed",
    title: "Glazed Donut Skin",
    person: "Hailey Bieber",
    kind: "celebrity",
    occasion: "alltag",
    level: "leicht",
    minutes: 10,
    colors: ["#f4d9cf", "#e9b7a4", "#d98f86", "#c9786f", "#fff4ec"],
    intro: "Glasige, „glasierte“ Haut, rosige Wangen und ein glänzender Lippenbalsam. Wenig Make-up, viel Pflege – ideal für jeden Tag.",
    products: [
      { cat: "Pflege", brand: "Rhode", name: "Peptide Glazing Fluid", price: 32, source: "eigene" },
      { cat: "Pflege", brand: "Rhode", name: "Barrier Restore Cream", price: 32, source: "eigene" },
      { cat: "Teint", brand: "Rare Beauty", name: "Liquid Touch Brightening Concealer", price: 25, source: "match", note: "Nur punktuell, kein Foundation-Layer" },
      { cat: "Wangen", brand: "Rhode", name: "Pocket Blush", shade: "Sleepy Girl", price: 26, source: "eigene" },
      { cat: "Highlighter", brand: "Rhode", name: "Glazing Milk", price: 34, source: "eigene" },
      { cat: "Augenbrauen", brand: "Anastasia Beverly Hills", name: "Brow Freeze", price: 25, source: "match" },
      { cat: "Lippen", brand: "Rhode", name: "Peptide Lip Tint", shade: "Ribbon", price: 22, source: "eigene" }
    ],
    steps: [
      { title: "Haut vorbereiten", text: "Gesicht reinigen. 2–3 Tropfen Glazing Fluid einklopfen, danach eine dünne Schicht Barrier Restore Cream.", uses: [0, 1] },
      { title: "Nur abdecken, wo nötig", text: "Concealer nur unter die Augen und auf Rötungen tupfen. Mit dem Finger einklopfen – keine Foundation.", uses: [2] },
      { title: "Rosige Wangen", text: "Pocket Blush direkt auf die Wangenäpfel tupfen und Richtung Schläfe einklopfen. Lieber zweimal wenig als einmal zu viel.", uses: [3] },
      { title: "Der Glaze", text: "Glazing Milk mit dem Finger auf Wangenknochen, Nasenrücken und Amorbogen tupfen. Das ist der „Donut“-Glanz.", uses: [4] },
      { title: "Brauen hochbürsten", text: "Brow Freeze dünn auftragen und die Härchen nach oben bürsten. Fertig sind fluffige „Soap Brows“.", uses: [5] },
      { title: "Lippen", text: "Lip Tint großzügig auftragen. Wer mag, zeichnet vorher mit einem braunen Lipliner leicht die Kontur nach.", uses: [6] }
    ],
    videos: [
      { title: "Hailey Bieber – Vogue Beauty Secrets", q: "Hailey Bieber Vogue Beauty Secrets" },
      { title: "Glazed Donut Skin Tutorial (deutsch)", q: "Glazed Donut Skin Tutorial deutsch" }
    ]
  },
  {
    id: "selena-softglam",
    title: "Soft Glam mit Liquid Blush",
    person: "Selena Gomez",
    kind: "celebrity",
    occasion: "alltag",
    level: "leicht",
    minutes: 15,
    colors: ["#f1d3c4", "#e3a39a", "#c96a73", "#a5524f", "#8a5a44"],
    intro: "Natürlicher, frischer Teint mit stark pigmentiertem Flüssig-Rouge und rosig-nudigen Lippen. Komplett aus ihrer Marke Rare Beauty.",
    products: [
      { cat: "Teint", brand: "Rare Beauty", name: "Liquid Touch Weightless Foundation", price: 32, source: "eigene" },
      { cat: "Teint", brand: "Rare Beauty", name: "Liquid Touch Brightening Concealer", price: 25, source: "eigene" },
      { cat: "Wangen", brand: "Rare Beauty", name: "Soft Pinch Liquid Blush", shade: "Hope (Dewy)", price: 25, source: "eigene" },
      { cat: "Highlighter", brand: "Rare Beauty", name: "Positive Light Liquid Luminizer", price: 27, source: "eigene" },
      { cat: "Augenbrauen", brand: "Rare Beauty", name: "Brow Harmony Precision Pencil", price: 22, source: "eigene" },
      { cat: "Augen", brand: "Rare Beauty", name: "Perfect Strokes Universal Volumizing Mascara", price: 24, source: "eigene" },
      { cat: "Lippen", brand: "Rare Beauty", name: "Kind Words Matte Lip Liner", price: 19, source: "eigene" },
      { cat: "Lippen", brand: "Rare Beauty", name: "Kind Words Matte Lipstick", price: 24, source: "eigene" }
    ],
    steps: [
      { title: "Dünne Foundation", text: "1–2 Pumpstöße Foundation mit Schwamm oder Pinsel von der Gesichtsmitte nach außen verteilen.", uses: [0] },
      { title: "Concealer", text: "Unter die Augen in einem kleinen Dreieck auftragen und einklopfen.", uses: [1] },
      { title: "Ein Punkt Rouge reicht", text: "Das Soft Pinch Blush ist extrem stark pigmentiert. Einen einzigen Punkt pro Wange auftragen und sofort mit den Fingern verblenden.", uses: [2] },
      { title: "Glow", text: "Luminizer auf Wangenknochen und Augeninnenwinkel tupfen.", uses: [3] },
      { title: "Brauen & Wimpern", text: "Lücken in den Brauen mit feinen Strichen füllen. Mascara in Zickzack-Bewegungen von der Wurzel nach oben.", uses: [4, 5] },
      { title: "Lippen", text: "Kontur mit dem Liner nachziehen, leicht in die Lippe hinein verblenden, dann Lippenstift drauf.", uses: [6, 7] }
    ],
    videos: [
      { title: "Selena Gomez – Rare Beauty Makeup Tutorial", q: "Selena Gomez makeup tutorial Rare Beauty" },
      { title: "Soft Pinch Liquid Blush richtig auftragen", q: "Rare Beauty Soft Pinch Liquid Blush auftragen" }
    ]
  },
  {
    id: "rihanna-redlip",
    title: "Red Lip & Fenty Glow",
    person: "Rihanna",
    kind: "celebrity",
    occasion: "abend",
    level: "mittel",
    minutes: 20,
    colors: ["#c88a62", "#e0b77a", "#b3121d", "#7c0f16", "#f2d27b"],
    intro: "Ebenmäßiger Teint, goldener Highlighter, der aus der Ferne leuchtet, und ein matter, knallroter Lippenstift. Ein Klassiker für den Abend.",
    products: [
      { cat: "Teint", brand: "Fenty Beauty", name: "Pro Filt'r Soft Matte Longwear Foundation", price: 39, source: "eigene" },
      { cat: "Teint", brand: "Fenty Beauty", name: "We're Even Hydrating Longwear Concealer", price: 29, source: "eigene" },
      { cat: "Teint", brand: "Fenty Beauty", name: "Pro Filt'r Instant Retouch Setting Powder", price: 38, source: "eigene" },
      { cat: "Bronzer", brand: "Fenty Beauty", name: "Sun Stalk'r Instant Warmth Bronzer", price: 34, source: "eigene" },
      { cat: "Highlighter", brand: "Fenty Beauty", name: "Killawatt Freestyle Highlighter", shade: "Trophy Wife", price: 38, source: "eigene" },
      { cat: "Augen", brand: "Fenty Beauty", name: "Full Frontal Volume, Lift & Curl Mascara", price: 27, source: "eigene" },
      { cat: "Lippen", brand: "Fenty Beauty", name: "Stunna Lip Paint Longwear Fluid Lip Color", shade: "Uncensored", price: 27, source: "eigene" }
    ],
    steps: [
      { title: "Teint aufbauen", text: "Foundation in dünnen Schichten auftragen. Concealer unter die Augen und um die Nase.", uses: [0, 1] },
      { title: "Fixieren", text: "Puder unter die Augen und in die T-Zone drücken, damit der rote Lippenstift später nicht mit einem glänzenden Teint konkurriert.", uses: [2] },
      { title: "Wärme", text: "Bronzer in einer „3“ von der Stirn über die Wangenknochen zum Kiefer auftragen.", uses: [3] },
      { title: "Der Fenty-Glow", text: "Trophy Wife mit einem Fächerpinsel auf die höchsten Punkte der Wangenknochen. Lieber in Schichten aufbauen.", uses: [4] },
      { title: "Wimpern", text: "Zwei Schichten Mascara, die zweite nur auf die äußeren Wimpern.", uses: [5] },
      { title: "Die rote Lippe", text: "Erst die Kontur mit der Applikatorspitze ziehen, dann ausfüllen. Mit Concealer am Rand die Kante „schärfen“.", uses: [6, 1] }
    ],
    videos: [
      { title: "Rihanna – Fenty Beauty Makeup Tutorial", q: "Rihanna Fenty Beauty makeup tutorial" },
      { title: "Perfekte rote Lippen – Anleitung", q: "perfekte rote Lippen schminken Anleitung" }
    ]
  },
  {
    id: "kylie-nudelip",
    title: "90s Nude Lip",
    person: "Kylie Jenner",
    kind: "celebrity",
    occasion: "alltag",
    level: "leicht",
    minutes: 15,
    colors: ["#e7c3a9", "#b98264", "#9c6a55", "#7a4b3b", "#5a3a2d"],
    intro: "Der Look, mit dem alles anfing: überbetonte, matt-nudefarbene Lippen mit dunklerem Liner, sanfte Konturen und volle Wimpern.",
    products: [
      { cat: "Teint", brand: "Kylie Cosmetics", name: "Power Plush Longwear Foundation", price: 35, source: "eigene" },
      { cat: "Teint", brand: "Kylie Cosmetics", name: "Power Plush Longwear Concealer", price: 26, source: "eigene" },
      { cat: "Kontur", brand: "Makeup by Mario", name: "SoftSculpt Shaping Stick", price: 33, source: "match" },
      { cat: "Augenbrauen", brand: "Kylie Cosmetics", name: "Kybrow Pencil", price: 18, source: "eigene" },
      { cat: "Augen", brand: "Kylie Cosmetics", name: "Kylash Volume Mascara", price: 22, source: "eigene" },
      { cat: "Lippen", brand: "Kylie Cosmetics", name: "Matte Lip Kit", shade: "Candy K", price: 33, source: "eigene" }
    ],
    steps: [
      { title: "Teint", text: "Foundation auftragen, Concealer etwas heller als die Haut unter die Augen.", uses: [0, 1] },
      { title: "Sanfte Kontur", text: "Konturstick unter die Wangenknochen und seitlich an die Nase, mit Schwamm verblenden.", uses: [2] },
      { title: "Brauen", text: "Mit dem Pencil feine Härchen zeichnen, vorne heller, hinten kräftiger.", uses: [3] },
      { title: "Wimpern", text: "Mascara in mehreren Schichten. Für den Original-Look kommen falsche Wimpern dazu.", uses: [4] },
      { title: "Lippen leicht überzeichnen", text: "Mit dem Liner knapp außerhalb der natürlichen Kontur nachziehen – vor allem in der Mitte der Oberlippe. Dann den Liquid Lipstick ausfüllen.", uses: [5] }
    ],
    videos: [
      { title: "Kylie Jenner – Makeup Routine", q: "Kylie Jenner makeup routine tutorial" },
      { title: "Lippen überzeichnen – Anleitung", q: "Lippen überzeichnen Tutorial deutsch" }
    ]
  },
  {
    id: "kim-contour",
    title: "Sculpted Contour",
    person: "Kim Kardashian",
    kind: "celebrity",
    occasion: "abend",
    level: "mittel",
    minutes: 30,
    colors: ["#d9b08c", "#a8775a", "#7a5340", "#c99a8b", "#4a3329"],
    intro: "Der berühmte Kontur-Look ihres Make-up-Artists Mario Dedivanovic: definierte Wangenknochen, matte braune Augen und Nude-Lippen.",
    products: [
      { cat: "Teint", brand: "Makeup by Mario", name: "SurrealSkin Liquid Foundation", price: 45, source: "berichtet", note: "Marke ihres Make-up-Artists" },
      { cat: "Teint", brand: "Laura Mercier", name: "Translucent Loose Setting Powder", price: 45, source: "match" },
      { cat: "Kontur", brand: "Makeup by Mario", name: "SoftSculpt Shaping Stick", price: 33, source: "berichtet", note: "Marke ihres Make-up-Artists" },
      { cat: "Augen", brand: "Makeup by Mario", name: "Master Mattes Eyeshadow Palette", price: 50, source: "berichtet", note: "Marke ihres Make-up-Artists" },
      { cat: "Augen", brand: "Maybelline", name: "Lash Sensational Sky High Mascara", price: 13, source: "match" },
      { cat: "Lippen", brand: "Makeup by Mario", name: "Ultra Suede Sculpting Lip Pencil", price: 25, source: "berichtet", note: "Marke ihres Make-up-Artists" },
      { cat: "Lippen", brand: "SKKN by Kim", name: "Lip Balm", price: 30, source: "eigene", note: "Alternativ jeder klare Lipbalm" }
    ],
    steps: [
      { title: "Teint", text: "Foundation auftragen. Concealer kannst du optional unter die Augen setzen.", uses: [0] },
      { title: "Baken", text: "Viel Puder unter die Augen und unter die Konturlinie drücken, 5 Minuten wirken lassen, dann abpinseln. So wird die Kontur extra scharf.", uses: [1] },
      { title: "Kontur", text: "Shaping Stick: Linie unter den Wangenknochen, an der Stirn-Haargrenze, unter dem Kiefer und schmal an der Nase. Nach oben verblenden.", uses: [2] },
      { title: "Matte Augen", text: "Hellbraun in die Lidfalte, Dunkelbraun in den äußeren Winkel, alles weich auswischen. Ein Hauch Braun unter den unteren Wimpernkranz.", uses: [3] },
      { title: "Wimpern", text: "Mascara großzügig – Kim trägt meist zusätzlich falsche Wimpern.", uses: [4] },
      { title: "Nude Lippen", text: "Lippen komplett mit dem Lip Pencil ausmalen und Balm darübergeben.", uses: [5, 6] }
    ],
    videos: [
      { title: "Mario Dedivanovic schminkt Kim Kardashian", q: "Mario Dedivanovic Kim Kardashian makeup tutorial" },
      { title: "Kontur für Anfänger", q: "Konturieren für Anfänger Anleitung deutsch" }
    ]
  },
  {
    id: "taylor-redlip",
    title: "Classic Red Lip & Cat Eye",
    person: "Taylor Swift",
    kind: "celebrity",
    occasion: "abend",
    level: "mittel",
    minutes: 20,
    colors: ["#f4dccd", "#e8bfae", "#b0172b", "#1b1414", "#d9a3a0"],
    intro: "Ihr Markenzeichen: ein zeitloser roter Lippenstift mit klassischem Lidstrich. Rest dezent, damit Lippen und Augen wirken.",
    products: [
      { cat: "Teint", brand: "Estée Lauder", name: "Double Wear Stay-in-Place Foundation", price: 45, source: "match" },
      { cat: "Wangen", brand: "NARS", name: "Blush", shade: "Orgasm", price: 35, source: "match" },
      { cat: "Augen", brand: "Stila", name: "Stay All Day Waterproof Liquid Eye Liner", price: 23, source: "match" },
      { cat: "Augen", brand: "L'Oréal Paris", name: "Telescopic Mascara", price: 14, source: "match" },
      { cat: "Lippen", brand: "NARS", name: "Velvet Matte Lip Pencil", shade: "Dragon Girl", price: 28, source: "berichtet" },
      { cat: "Lippen", brand: "MAC", name: "Retro Matte Lipstick", shade: "Ruby Woo", price: 25, source: "berichtet" }
    ],
    steps: [
      { title: "Ruhiger Teint", text: "Foundation dünn auftragen, Rötungen ausgleichen. Kein starker Bronzer.", uses: [0] },
      { title: "Etwas Frische", text: "Wenig Rouge auf die Wangenäpfel.", uses: [1] },
      { title: "Lidstrich in 3 Schritten", text: "1) Kleiner Strich vom äußeren Augenwinkel Richtung Augenbrauen-Ende. 2) Von der Spitze zurück zur Lidmitte verbinden. 3) Lücke am Wimpernkranz ausfüllen.", uses: [2] },
      { title: "Wimpern", text: "Mascara auf obere Wimpern, die unteren nur leicht.", uses: [3] },
      { title: "Rote Lippen", text: "Kontur mit dem Stift, Lippenstift darüber oder den Stift komplett ausmalen. Abtupfen, zweite Schicht – hält länger.", uses: [4, 5] }
    ],
    videos: [
      { title: "Taylor Swift Inspired Makeup", q: "Taylor Swift inspired makeup tutorial red lip" },
      { title: "Lidstrich für Anfänger", q: "Lidstrich ziehen für Anfänger deutsch" }
    ]
  },
  {
    id: "ariana-cateye",
    title: "Signature Cat Eye",
    person: "Ariana Grande",
    kind: "celebrity",
    occasion: "abend",
    level: "mittel",
    minutes: 25,
    colors: ["#f2d6c3", "#d9a28a", "#c58c86", "#1d1717", "#e9c2b9"],
    intro: "Langer, nach oben gezogener Lidstrich, rosige Wangen und glänzende Nude-Lippen. Produkte überwiegend aus ihrer Marke r.e.m. beauty.",
    products: [
      { cat: "Teint", brand: "r.e.m. beauty", name: "Sweetener Foundation", price: 32, source: "eigene" },
      { cat: "Wangen", brand: "r.e.m. beauty", name: "Sweetener Blush", price: 22, source: "eigene" },
      { cat: "Highlighter", brand: "r.e.m. beauty", name: "Interstellar Highlighter", price: 24, source: "eigene" },
      { cat: "Augen", brand: "r.e.m. beauty", name: "At the Borderline Kohl Eyeliner Pencil", price: 18, source: "eigene" },
      { cat: "Augen", brand: "KVD Beauty", name: "Tattoo Liner", price: 23, source: "match", note: "Für eine besonders scharfe Spitze" },
      { cat: "Augen", brand: "r.e.m. beauty", name: "Flourish Lash Lifting Mascara", price: 22, source: "eigene" },
      { cat: "Lippen", brand: "r.e.m. beauty", name: "On Your Collar Plumping Lip Gloss", price: 20, source: "eigene" }
    ],
    steps: [
      { title: "Teint & Wangen", text: "Foundation auftragen, Rouge hoch auf die Wangenknochen Richtung Schläfe.", uses: [0, 1] },
      { title: "Glow", text: "Highlighter auf Wangenknochen und Nasenspitze.", uses: [2] },
      { title: "Grundlinie", text: "Mit dem Kohl-Stift eine Linie dicht am oberen Wimpernkranz ziehen.", uses: [3] },
      { title: "Der lange Flügel", text: "Mit Flüssig-Liner eine lange, gerade Linie vom Augenwinkel Richtung Brauenende. Tipp: Ein Klebeband als Schablone hilft.", uses: [4] },
      { title: "Wimpern", text: "Wimpern zangen, dann Mascara. Ariana trägt fast immer falsche Wimpern, die außen länger sind.", uses: [5] },
      { title: "Glossy Nude", text: "Gloss über die ganze Lippe.", uses: [6] }
    ],
    videos: [
      { title: "Ariana Grande Makeup Tutorial", q: "Ariana Grande makeup tutorial cat eye" },
      { title: "Cat Eye mit Klebeband", q: "Cat Eye Klebeband Trick Tutorial" }
    ]
  },
  {
    id: "zendaya-bronze",
    title: "Bronzed Red Carpet Glow",
    person: "Zendaya",
    kind: "celebrity",
    occasion: "abend",
    level: "mittel",
    minutes: 25,
    colors: ["#b07a58", "#8c5a3c", "#d4a373", "#6f3f2a", "#c2876a"],
    intro: "Warme Bronze-Töne auf Augen und Wangen, strahlende Haut und gebräunte Nude-Lippen. Sie ist Werbegesicht von Lancôme.",
    products: [
      { cat: "Teint", brand: "Lancôme", name: "Teint Idole Ultra Wear Foundation", price: 46, source: "gesicht" },
      { cat: "Bronzer", brand: "Benefit", name: "Hoola Matte Bronzer", price: 34, source: "match" },
      { cat: "Augen", brand: "Huda Beauty", name: "Nude Obsessions Eyeshadow Palette", shade: "Nude Rich", price: 32, source: "match" },
      { cat: "Augen", brand: "Lancôme", name: "Lash Idôle Mascara", price: 33, source: "gesicht" },
      { cat: "Highlighter", brand: "Fenty Beauty", name: "Killawatt Freestyle Highlighter", shade: "Trophy Wife", price: 38, source: "match" },
      { cat: "Lippen", brand: "Lancôme", name: "L'Absolu Rouge Lipstick", price: 36, source: "gesicht" }
    ],
    steps: [
      { title: "Teint", text: "Foundation auftragen, Concealer optional.", uses: [0] },
      { title: "Bronze überall", text: "Bronzer auf Stirn, Wangen, Kiefer und – ganz leicht – über die Lider.", uses: [1] },
      { title: "Warme Augen", text: "Mittelbraun in die Lidfalte, Bronze-Schimmer mit dem Finger auf das bewegliche Lid tupfen, dunkles Braun am äußeren Winkel.", uses: [2] },
      { title: "Wimpern", text: "Zwei Schichten Mascara.", uses: [3] },
      { title: "Strahlen", text: "Goldenen Highlighter auf Wangenknochen und Augeninnenwinkel.", uses: [4] },
      { title: "Lippen", text: "Einen warmen Nude- oder Braunton auftragen.", uses: [5] }
    ],
    videos: [
      { title: "Zendaya Red Carpet Makeup", q: "Zendaya red carpet makeup tutorial" },
      { title: "Bronze Augen Make-up", q: "Bronze Augen Make-up Tutorial deutsch" }
    ]
  },
  {
    id: "margot-barbie",
    title: "Barbie Pink",
    person: "Margot Robbie",
    kind: "celebrity",
    occasion: "party",
    level: "leicht",
    minutes: 15,
    colors: ["#f7d7d3", "#f2a7b8", "#e46a9b", "#c94f7c", "#fbeaf0"],
    intro: "Frischer Teint, pinke Wangen, Pink auf den Lidern und eine glänzende pinke Lippe. Sie ist Werbegesicht von Chanel.",
    products: [
      { cat: "Teint", brand: "Chanel", name: "Les Beiges Healthy Glow Foundation", price: 60, source: "gesicht" },
      { cat: "Wangen", brand: "Rare Beauty", name: "Soft Pinch Liquid Blush", shade: "Lucky", price: 25, source: "match" },
      { cat: "Augen", brand: "Too Faced", name: "Born This Way Palette", price: 45, source: "match", note: "Oder jeder rosa Lidschatten" },
      { cat: "Augen", brand: "Chanel", name: "Inimitable Mascara", price: 38, source: "gesicht" },
      { cat: "Lippen", brand: "Chanel", name: "Rouge Coco Flash", price: 42, source: "gesicht" }
    ],
    steps: [
      { title: "Leichter Teint", text: "Foundation dünn auftragen, damit die Haut frisch bleibt.", uses: [0] },
      { title: "Pinke Wangen", text: "Rouge großflächig auf die Wangenäpfel – für den Barbie-Look darf es kräftig sein.", uses: [1] },
      { title: "Rosa Lider", text: "Zartrosa Lidschatten mit dem Finger auf das ganze Lid.", uses: [2] },
      { title: "Wimpern", text: "Mascara vor allem auf die oberen Wimpern.", uses: [3] },
      { title: "Pinke Lippe", text: "Glänzenden pinken Lippenstift direkt aus der Hülse auftragen.", uses: [4] }
    ],
    videos: [
      { title: "Barbie Movie Makeup Tutorial", q: "Margot Robbie Barbie makeup tutorial" },
      { title: "Barbie Make-up deutsch", q: "Barbie Make-up Tutorial deutsch" }
    ]
  },
  {
    id: "huda-fullglam",
    title: "Baked Full Glam",
    person: "Huda Kattan",
    kind: "influencer",
    occasion: "party",
    level: "fortgeschritten",
    minutes: 40,
    colors: ["#e6c1a3", "#b8835e", "#7d4f3a", "#a86b5b", "#3a2620"],
    intro: "Der typische Instagram-Glam der Beauty-Influencerin: makelloser, „gebackener“ Teint, Smokey Eyes, Wimpern und definierte Nude-Lippen.",
    products: [
      { cat: "Teint", brand: "Huda Beauty", name: "#FauxFilter Luminous Matte Foundation", price: 40, source: "eigene" },
      { cat: "Teint", brand: "Huda Beauty", name: "#FauxFilter Concealer", price: 30, source: "eigene" },
      { cat: "Teint", brand: "Huda Beauty", name: "Easy Bake Loose Baking & Setting Powder", price: 38, source: "eigene" },
      { cat: "Augen", brand: "Huda Beauty", name: "Nude Obsessions Eyeshadow Palette", price: 32, source: "eigene" },
      { cat: "Augen", brand: "Huda Beauty", name: "Faux Mink Lashes", price: 25, source: "eigene" },
      { cat: "Lippen", brand: "Huda Beauty", name: "Lip Contour 2.0", price: 18, source: "eigene" },
      { cat: "Lippen", brand: "Huda Beauty", name: "Power Bullet Matte Lipstick", price: 26, source: "eigene" }
    ],
    steps: [
      { title: "Volle Deckkraft", text: "Foundation mit feuchtem Schwamm einklopfen, deckend aufbauen.", uses: [0] },
      { title: "Concealer-Dreieck", text: "Großes Dreieck unter die Augen, dazu Kinn und Stirnmitte aufhellen.", uses: [1] },
      { title: "Baken", text: "Easy Bake Powder dick unter die Augen und unter die Wangenknochen. 5–10 Minuten „backen“ lassen, dann abpinseln.", uses: [2] },
      { title: "Smokey Eyes", text: "Hellen Ton als Basis, mittleren in die Lidfalte, dunklen außen. Verblenden, verblenden, verblenden.", uses: [3] },
      { title: "Wimpern", text: "Falsche Wimpern auf Länge kürzen, Kleber auftragen, 30 Sekunden antrocknen lassen, dann dicht an den Wimpernkranz setzen.", uses: [4] },
      { title: "Lippen", text: "Kontur mit dem Liner, dann Lippenstift. Mitte optional mit etwas Gloss betonen.", uses: [5, 6] }
    ],
    videos: [
      { title: "Huda Kattan – Full Glam Tutorial", q: "Huda Kattan full glam makeup tutorial" },
      { title: "Baking für Anfänger", q: "Make-up Baking Anleitung deutsch" }
    ]
  },
  {
    id: "patrick-sculpt",
    title: "Glossy Sculpted Skin",
    person: "Patrick Ta",
    kind: "influencer",
    occasion: "alltag",
    level: "leicht",
    minutes: 15,
    colors: ["#ecc9b3", "#c9967a", "#a8705a", "#d98f86", "#f5e1d4"],
    intro: "Der Make-up-Artist und Influencer ist für seine Creme-plus-Puder-Technik bekannt: erst Creme, dann Puder vom selben Ton. Hält lange und sieht trotzdem natürlich aus.",
    products: [
      { cat: "Teint", brand: "Patrick Ta", name: "Major Skin Hydra-Glow Oil-Free Foundation", price: 52, source: "eigene" },
      { cat: "Kontur", brand: "Patrick Ta", name: "Major Sculpt Crème Contour & Powder Bronzer Duo", price: 42, source: "eigene" },
      { cat: "Wangen", brand: "Patrick Ta", name: "Major Headlines Double-Take Crème & Powder Blush Duo", price: 40, source: "eigene" },
      { cat: "Augen", brand: "Maybelline", name: "Lash Sensational Sky High Mascara", price: 13, source: "match" },
      { cat: "Lippen", brand: "Patrick Ta", name: "Major Volume Plumping Lip Gloss", price: 30, source: "eigene" }
    ],
    steps: [
      { title: "Teint", text: "Foundation dünn verteilen – die Haut soll durchscheinen.", uses: [0] },
      { title: "Creme-Kontur", text: "Creme-Seite des Duos unter die Wangenknochen, mit Pinsel verblenden.", uses: [1] },
      { title: "Puder darüber", text: "Dieselbe Stelle mit der Puder-Seite nachziehen. Das ist der Trick: Creme + Puder = hält den ganzen Tag.", uses: [1] },
      { title: "Rouge doppelt", text: "Gleiches Prinzip: erst Creme-Blush, dann Puder-Blush darüber.", uses: [2] },
      { title: "Wimpern & Lippen", text: "Mascara und Gloss – fertig.", uses: [3, 4] }
    ],
    videos: [
      { title: "Patrick Ta – Crème & Powder Technique", q: "Patrick Ta cream and powder technique tutorial" },
      { title: "Patrick Ta Makeup Tutorial", q: "Patrick Ta makeup tutorial" }
    ]
  },
  {
    id: "nikkie-nomakeup",
    title: "No-Makeup Makeup",
    person: "NikkieTutorials",
    kind: "influencer",
    occasion: "alltag",
    level: "leicht",
    minutes: 8,
    colors: ["#f0d2bf", "#dcae96", "#c98b7c", "#b77768", "#f7e6da"],
    intro: "Für Tage, an denen es schnell gehen soll: ein Look, der aussieht wie „nur gute Haut“. Inspiriert von NikkieTutorials’ bekannten Quick-Routinen.",
    products: [
      { cat: "Teint", brand: "NARS", name: "Pure Radiant Tinted Moisturizer", price: 45, source: "match" },
      { cat: "Teint", brand: "NARS", name: "Radiant Creamy Concealer", price: 34, source: "match" },
      { cat: "Wangen", brand: "e.l.f.", name: "Halo Glow Liquid Filter", price: 15, source: "match" },
      { cat: "Augenbrauen", brand: "essence", name: "Fix & Last 24h Brow Gel", price: 3, source: "match" },
      { cat: "Augen", brand: "essence", name: "Lash Princess False Lash Effect Mascara", price: 5, source: "match" },
      { cat: "Lippen", brand: "Burt's Bees", name: "Tinted Lip Balm", price: 7, source: "match" }
    ],
    steps: [
      { title: "Getönte Feuchtigkeit", text: "Tinted Moisturizer mit den Fingern wie eine Creme einarbeiten.", uses: [0] },
      { title: "Nur wo nötig", text: "Concealer auf Augenringe und Pickel tupfen.", uses: [1] },
      { title: "Frische", text: "Einen Hauch Glow auf die Wangenknochen.", uses: [2] },
      { title: "Brauen & Wimpern", text: "Brauen hochbürsten, eine Schicht Mascara.", uses: [3, 4] },
      { title: "Lippen", text: "Getönter Lippenbalsam – fertig in 8 Minuten.", uses: [5] }
    ],
    videos: [
      { title: "NikkieTutorials – Natural Makeup", q: "NikkieTutorials natural makeup" },
      { title: "No-Makeup Make-up deutsch", q: "No Makeup Make-up Tutorial deutsch" }
    ]
  }
];
