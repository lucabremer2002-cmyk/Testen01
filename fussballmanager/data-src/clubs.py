# Vereinsstammdaten Saison 2026/27.
# file: Rohdatei in raw/, colors: Primär-/Sekundärfarbe (keine Wappen, nur Farben),
# rep: Reputation 1-100, money: Kontostand zu Saisonbeginn in Mio. EUR.

LEAGUES = [
    {"id": "bl", "name": "Bundesliga", "short": "BL", "level": 1},
    {"id": "bl2", "name": "2. Bundesliga", "short": "2. BL", "level": 2},
    {"id": "l3", "name": "3. Liga", "short": "3. Liga", "level": 3},
    {"id": "rlw", "name": "Regionalliga West", "short": "RL West", "level": 4},
    {"id": "rlsw", "name": "Regionalliga Südwest", "short": "RL Südwest", "level": 4},
    {"id": "rl", "name": "Regionalliga (andere Staffeln)", "short": "RL", "level": 4},
    {"id": "olw", "name": "Oberliga (Westen)", "short": "OL", "level": 5},
    {"id": "olsw", "name": "Oberliga (Südwesten)", "short": "OL", "level": 5},
]

# Vereine aus Nordrhein-Westfalen: steigen aus der 3. Liga in die Regionalliga West ab
WEST = {"bvb", "b04", "bmg", "koe", "s04", "scp", "boc", "dsc", "msv", "rwe", "aac", "f95", "scv", "fko", "prm", "vik"}
# Vereine aus Hessen, Rheinland-Pfalz, Saarland und Baden-Wuerttemberg: Abstieg in die Regionalliga Suedwest
SUEDWEST = {"sge", "vfb", "scf", "m05", "tsg", "sve", "fch", "d98", "fck", "ksc", "fcs", "tsg2", "wal", "sgs", "vfb2", "sww"}

CLUBS = [
    # --- Bundesliga ---
    dict(id="fcb", file="fcb", league="bl", name="FC Bayern München", short="Bayern", abbr="FCB", colors=["#DC052D", "#FFFFFF"], stadium="Allianz Arena", cap=75024, rep=98, money=180),
    dict(id="bvb", file="bvb", league="bl", name="Borussia Dortmund", short="Dortmund", abbr="BVB", colors=["#FDE100", "#111111"], stadium="Signal Iduna Park", cap=81365, rep=90, money=95),
    dict(id="b04", file="b04", league="bl", name="Bayer 04 Leverkusen", short="Leverkusen", abbr="B04", colors=["#E32221", "#111111"], stadium="BayArena", cap=30210, rep=88, money=85),
    dict(id="rbl", file="rbl", league="bl", name="RB Leipzig", short="Leipzig", abbr="RBL", colors=["#FFFFFF", "#DD0741"], stadium="Red Bull Arena", cap=47069, rep=85, money=80),
    dict(id="sge", file="sge", league="bl", name="Eintracht Frankfurt", short="Frankfurt", abbr="SGE", colors=["#E1000F", "#111111"], stadium="Deutsche Bank Park", cap=58000, rep=82, money=60),
    dict(id="vfb", file="vfb", league="bl", name="VfB Stuttgart", short="Stuttgart", abbr="VFB", colors=["#FFFFFF", "#E32219"], stadium="MHPArena", cap=60449, rep=81, money=50),
    dict(id="scf", file="scf", league="bl", name="SC Freiburg", short="Freiburg", abbr="SCF", colors=["#E2001A", "#111111"], stadium="Europa-Park Stadion", cap=34700, rep=76, money=40),
    dict(id="m05", file="m05", league="bl", name="1. FSV Mainz 05", short="Mainz", abbr="M05", colors=["#C3141E", "#FFFFFF"], stadium="MEWA Arena", cap=33305, rep=71, money=25),
    dict(id="svw", file="svw", league="bl", name="SV Werder Bremen", short="Bremen", abbr="SVW", colors=["#1D9053", "#FFFFFF"], stadium="Weserstadion", cap=42100, rep=74, money=20),
    dict(id="fca", file="fca", league="bl", name="FC Augsburg", short="Augsburg", abbr="FCA", colors=["#BA3733", "#46714D"], stadium="WWK Arena", cap=30660, rep=68, money=22),
    dict(id="tsg", file="tsg", league="bl", name="TSG Hoffenheim", short="Hoffenheim", abbr="TSG", colors=["#1C63B7", "#FFFFFF"], stadium="PreZero Arena", cap=30150, rep=72, money=40),
    dict(id="fcu", file="fcu", league="bl", name="1. FC Union Berlin", short="Union", abbr="FCU", colors=["#EB1923", "#FFFFFF"], stadium="An der Alten Försterei", cap=22012, rep=70, money=25),
    dict(id="bmg", file="bmg", league="bl", name="Borussia Mönchengladbach", short="Gladbach", abbr="BMG", colors=["#111111", "#1A9F3D"], stadium="Borussia-Park", cap=54042, rep=75, money=30),
    dict(id="koe", file="koe", league="bl", name="1. FC Köln", short="Köln", abbr="KOE", colors=["#ED1C24", "#FFFFFF"], stadium="RheinEnergieStadion", cap=50000, rep=72, money=18),
    dict(id="hsv", file="hsv", league="bl", name="Hamburger SV", short="HSV", abbr="HSV", colors=["#0A3F86", "#FFFFFF"], stadium="Volksparkstadion", cap=57000, rep=74, money=22),
    dict(id="s04", file="s04", league="bl", name="FC Schalke 04", short="Schalke", abbr="S04", colors=["#004D9D", "#FFFFFF"], stadium="Veltins-Arena", cap=62271, rep=75, money=12),
    dict(id="sve", file="sve", league="bl", name="SV Elversberg", short="Elversberg", abbr="SVE", colors=["#111111", "#FFFFFF"], stadium="Ursapharm-Arena", cap=10000, rep=55, money=10),
    dict(id="scp", file="scp", league="bl", name="SC Paderborn 07", short="Paderborn", abbr="SCP", colors=["#005CA9", "#111111"], stadium="Home Deluxe Arena", cap=15000, rep=58, money=10),
    # --- 2. Bundesliga ---
    dict(id="wob", file="wob", league="bl2", name="VfL Wolfsburg", short="Wolfsburg", abbr="WOB", colors=["#65B32E", "#FFFFFF"], stadium="Volkswagen Arena", cap=28917, rep=70, money=38),
    dict(id="fch", file="fch2", league="bl2", name="1. FC Heidenheim 1846", short="Heidenheim", abbr="FCH", colors=["#E2001A", "#003B79"], stadium="Voith-Arena", cap=15000, rep=60, money=16),
    dict(id="stp", file="stp", league="bl2", name="FC St. Pauli", short="St. Pauli", abbr="STP", colors=["#624839", "#FFFFFF"], stadium="Millerntor-Stadion", cap=29546, rep=64, money=14),
    dict(id="h96", file="h96", league="bl2", name="Hannover 96", short="Hannover", abbr="H96", colors=["#C8102E", "#111111"], stadium="Heinz von Heiden Arena", cap=49000, rep=64, money=10),
    dict(id="d98", file="d98", league="bl2", name="SV Darmstadt 98", short="Darmstadt", abbr="D98", colors=["#004C99", "#FFFFFF"], stadium="Merck-Stadion am Böllenfalltor", cap=17810, rep=57, money=7),
    dict(id="fck", file="fck", league="bl2", name="1. FC Kaiserslautern", short="Lautern", abbr="FCK", colors=["#D00027", "#FFFFFF"], stadium="Fritz-Walter-Stadion", cap=49780, rep=63, money=8),
    dict(id="bsc", file="bsc", league="bl2", name="Hertha BSC", short="Hertha", abbr="BSC", colors=["#005CA9", "#FFFFFF"], stadium="Olympiastadion", cap=74475, rep=67, money=6),
    dict(id="fcn", file="fcn", league="bl2", name="1. FC Nürnberg", short="Nürnberg", abbr="FCN", colors=["#8B0D1E", "#111111"], stadium="Max-Morlock-Stadion", cap=50000, rep=62, money=8),
    dict(id="boc", file="boc", league="bl2", name="VfL Bochum 1848", short="Bochum", abbr="BOC", colors=["#005CA9", "#FFFFFF"], stadium="Vonovia Ruhrstadion", cap=26000, rep=61, money=10),
    dict(id="ksc", file="ksc", league="bl2", name="Karlsruher SC", short="Karlsruhe", abbr="KSC", colors=["#004C99", "#FFFFFF"], stadium="BBBank Wildpark", cap=34302, rep=58, money=6),
    dict(id="sgd", file="sgd", league="bl2", name="Dynamo Dresden", short="Dresden", abbr="SGD", colors=["#FDD200", "#111111"], stadium="Rudolf-Harbig-Stadion", cap=32066, rep=58, money=6),
    dict(id="ksv", file="ksv", league="bl2", name="Holstein Kiel", short="Kiel", abbr="KSV", colors=["#004C99", "#E30613"], stadium="Holstein-Stadion", cap=15034, rep=58, money=9),
    dict(id="dsc", file="dsc", league="bl2", name="Arminia Bielefeld", short="Bielefeld", abbr="DSC", colors=["#004E95", "#111111"], stadium="SchücoArena", cap=26515, rep=58, money=6),
    dict(id="fcm", file="fcm", league="bl2", name="1. FC Magdeburg", short="Magdeburg", abbr="FCM", colors=["#0055A4", "#FFFFFF"], stadium="Avnet Arena", cap=30098, rep=56, money=6),
    dict(id="ebs", file="ebs", league="bl2", name="Eintracht Braunschweig", short="Braunschweig", abbr="EBS", colors=["#FFD700", "#00428C"], stadium="Eintracht-Stadion", cap=23325, rep=56, money=5),
    dict(id="sgf", file="sgf", league="bl2", name="SpVgg Greuther Fürth", short="Fürth", abbr="SGF", colors=["#009639", "#FFFFFF"], stadium="Sportpark Ronhof", cap=16626, rep=55, money=6),
    dict(id="osn", file="vfl", league="bl2", name="VfL Osnabrück", short="Osnabrück", abbr="OSN", colors=["#5B2D8B", "#FFFFFF"], stadium="Bremer Brücke", cap=15741, rep=52, money=3),
    dict(id="fce", file="fce", league="bl2", name="FC Energie Cottbus", short="Cottbus", abbr="FCE", colors=["#E30613", "#FFFFFF"], stadium="LEAG Energie Stadion", cap=22528, rep=50, money=3),
    # --- 3. Liga ---
    dict(id="msv", file="msv", league="l3", name="MSV Duisburg", short="Duisburg", abbr="MSV", colors=["#004B93", "#FFFFFF"], stadium="Schauinsland-Reisen-Arena", cap=31514, rep=52, money=3),
    dict(id="vik", file="vik", league="l3", name="FC Viktoria Köln", short="Viktoria", abbr="VIK", colors=["#E2001A", "#FFFFFF"], stadium="Sportpark Höhenberg", cap=8343, rep=40, money=1.5),
    dict(id="rwe", file="rwe", league="l3", name="Rot-Weiss Essen", short="Essen", abbr="RWE", colors=["#E2001A", "#FFFFFF"], stadium="Stadion an der Hafenstraße", cap=19962, rep=50, money=2.5),
    dict(id="fcs", file="fcs", league="l3", name="1. FC Saarbrücken", short="Saarbrücken", abbr="FCS", colors=["#0060AA", "#111111"], stadium="Ludwigsparkstadion", cap=16003, rep=48, money=2.5),
    dict(id="tsg2", file="tsg2", league="l3", name="TSG Hoffenheim II", short="Hoffenheim II", abbr="TSG2", colors=["#1C63B7", "#FFFFFF"], stadium="Dietmar-Hopp-Stadion", cap=6350, rep=36, money=1.5, reserve="tsg"),
    dict(id="hro", file="fch", league="l3", name="FC Hansa Rostock", short="Rostock", abbr="HRO", colors=["#004C99", "#FFFFFF"], stadium="Ostseestadion", cap=29000, rep=54, money=3),
    dict(id="aac", file="aac", league="l3", name="Alemannia Aachen", short="Aachen", abbr="AAC", colors=["#FFDD00", "#111111"], stadium="Tivoli", cap=32960, rep=48, money=2),
    dict(id="prm", file="scp2", league="l3", name="SC Preußen Münster", short="Münster", abbr="PRM", colors=["#00843D", "#111111"], stadium="LVM-Preußenstadion", cap=14300, rep=48, money=2),
    dict(id="wal", file="svw2", league="l3", name="SV Waldhof Mannheim", short="Mannheim", abbr="WAL", colors=["#004C99", "#111111"], stadium="Carl-Benz-Stadion", cap=25667, rep=48, money=2),
    dict(id="f95", file="f95", league="l3", name="Fortuna Düsseldorf", short="Düsseldorf", abbr="F95", colors=["#DA251D", "#FFFFFF"], stadium="Merkur Spiel-Arena", cap=54600, rep=58, money=6),
    dict(id="scv", file="scv", league="l3", name="SC Verl", short="Verl", abbr="SCV", colors=["#111111", "#FFFFFF"], stadium="Sportclub Arena", cap=5207, rep=38, money=1.2),
    dict(id="fko", file="fko", league="l3", name="SC Fortuna Köln", short="Fortuna Köln", abbr="FKÖ", colors=["#E2001A", "#FFFFFF"], stadium="Südstadion", cap=11748, rep=36, money=1),
    dict(id="sgs", file="sgs", league="l3", name="SG Sonnenhof Großaspach", short="Großaspach", abbr="SGS", colors=["#111111", "#F2C200"], stadium="WIRmachenDRUCK Arena", cap=10001, rep=34, money=1),
    dict(id="fci", file="fci", league="l3", name="FC Ingolstadt 04", short="Ingolstadt", abbr="FCI", colors=["#111111", "#E2001A"], stadium="Audi Sportpark", cap=15200, rep=50, money=3),
    dict(id="vfb2", file="vfb2", league="l3", name="VfB Stuttgart II", short="Stuttgart II", abbr="VFB2", colors=["#FFFFFF", "#E32219"], stadium="GAZi-Stadion auf der Waldau", cap=11410, rep=36, money=1.5, reserve="vfb"),
    dict(id="fwk", file="fwk", league="l3", name="FC Würzburger Kickers", short="Würzburg", abbr="FWK", colors=["#E2001A", "#FFFFFF"], stadium="Akon Arena", cap=13090, rep=40, money=1.2),
    dict(id="svm", file="svm", league="l3", name="SV Meppen", short="Meppen", abbr="SVM", colors=["#004C99", "#FFFFFF"], stadium="Hänsch-Arena", cap=13815, rep=38, money=1),
    dict(id="jah", file="ssv", league="l3", name="SSV Jahn Regensburg", short="Regensburg", abbr="JAH", colors=["#E2001A", "#FFFFFF"], stadium="Jahnstadion Regensburg", cap=15210, rep=48, money=2),
    dict(id="sww", file="sww", league="l3", name="SV Wehen Wiesbaden", short="Wiesbaden", abbr="SVWW", colors=["#E2001A", "#111111"], stadium="BRITA-Arena", cap=15295, rep=46, money=2),
    dict(id="hav", file="hav", league="l3", name="TSV Havelse", short="Havelse", abbr="HAV", colors=["#004C99", "#FFFFFF"], stadium="Eilenriedestadion", cap=5000, rep=32, money=0.8),
    # --- Regionalliga-Pool (nur fuer Auf-/Abstieg, nicht simuliert) ---
    dict(id="m60", file="r60", league="rl", name="TSV 1860 München", short="1860", abbr="M60", colors=["#79A6D2", "#FFFFFF"], stadium="Grünwalder Stadion", cap=15000, rep=50, money=1.5),
    dict(id="aue", file="rau", league="rl", name="FC Erzgebirge Aue", short="Aue", abbr="AUE", colors=["#5B2D8B", "#FFFFFF"], stadium="Erzgebirgsstadion", cap=16485, rep=44, money=1),
    dict(id="sw05", file="rsw", league="rl", name="1. FC Schweinfurt 05", short="Schweinfurt", abbr="S05", colors=["#009639", "#FFFFFF"], stadium="Sachs-Stadion", cap=15060, rep=34, money=0.6),
    # --- Regionalliga West (simuliert). fans: Zuschauerschnitt, money: fiktive Kasse, pot: fiktiver Sponsorentopf pro Saison (Mio. EUR) ---
    dict(id="rwo", file="rlw_rwo", league="rlw", name="Rot-Weiß Oberhausen", short="Oberhausen", abbr="RWO", colors=["#E2001A", "#FFFFFF"], stadium="Stadion Niederrhein", cap=21318, rep=46, money=0.9, fans=4300, pot=0.3),
    dict(id="fcg", file="rlw_fcg", league="rlw", name="FC Gütersloh", short="Gütersloh", abbr="FCG", colors=["#1E5AA8", "#2E9B4F"], stadium="Heidewaldstadion", cap=12500, rep=36, money=0.6, fans=1700, pot=0.2),
    dict(id="bvb2", file="rlw_bvb2", league="rlw", name="Borussia Dortmund II", short="Dortmund II", abbr="BVB2", colors=["#FDE100", "#111111"], stadium="Stadion Rote Erde", cap=9999, rep=40, money=0.5, fans=1400, reserve="bvb", pot=0.12),
    dict(id="s042", file="rlw_s042", league="rlw", name="FC Schalke 04 II", short="Schalke II", abbr="S042", colors=["#004D9D", "#FFFFFF"], stadium="Parkstadion", cap=3500, rep=38, money=0.5, fans=1000, reserve="s04", pot=0.12),
    dict(id="boh", file="rlw_boh", league="rlw", name="1. FC Bocholt", short="Bocholt", abbr="FCB", colors=["#111111", "#FFFFFF"], stadium="Stadion am Hünting", cap=6500, rep=38, money=0.7, fans=2100, pot=0.25),
    dict(id="sfs", file="rlw_sfs", league="rlw", name="Sportfreunde Siegen", short="Siegen", abbr="SFS", colors=["#E2001A", "#FFFFFF"], stadium="Leimbachstadion", cap=18500, rep=40, money=0.5, fans=2700, pot=0.18),
    dict(id="svr", file="rlw_svr", league="rlw", name="SV Rödinghausen", short="Rödinghausen", abbr="SVR", colors=["#1B8A3C", "#FFFFFF"], stadium="Häcker Wiehenstadion", cap=2489, rep=34, money=1.0, fans=800, pot=0.35),
    dict(id="sgw", file="rlw_sgw", league="rlw", name="SG Wattenscheid 09", short="Wattenscheid", abbr="SGW", colors=["#111111", "#FFFFFF"], stadium="Lohrheidestadion", cap=16233, rep=40, money=0.35, fans=2800, pot=0.15),
    dict(id="sfl", file="rlw_sfl", league="rlw", name="Sportfreunde Lotte", short="Lotte", abbr="SFL", colors=["#004C99", "#FFFFFF"], stadium="Stadion am Lotter Kreuz", cap=10059, rep=36, money=0.45, fans=1500, pot=0.15),
    dict(id="bon", file="rlw_bon", league="rlw", name="Bonner SC", short="Bonn", abbr="BSC", colors=["#E2001A", "#111111"], stadium="Sportpark Nord", cap=10164, rep=36, money=0.45, fans=1900, pot=0.15),
    dict(id="koe2", file="rlw_koe2", league="rlw", name="1. FC Köln II", short="Köln II", abbr="KOE2", colors=["#ED1C24", "#FFFFFF"], stadium="Franz-Kremer-Stadion", cap=5457, rep=36, money=0.5, fans=900, reserve="koe", pot=0.12),
    dict(id="bmg2", file="rlw_bmg2", league="rlw", name="Borussia Mönchengladbach II", short="Gladbach II", abbr="BMG2", colors=["#111111", "#1A9F3D"], stadium="Grenzlandstadion", cap=10000, rep=36, money=0.5, fans=700, reserve="bmg", pot=0.12),
    dict(id="scp2", file="rlw_scp2", league="rlw", name="SC Paderborn 07 II", short="Paderborn II", abbr="SCP2", colors=["#005CA9", "#111111"], stadium="Paderkampfbahn", cap=3000, rep=32, money=0.4, fans=450, reserve="scp", pot=0.12),
    dict(id="scw", file="rlw_scw", league="rlw", name="SC Wiedenbrück", short="Wiedenbrück", abbr="SCW", colors=["#111111", "#1D5FB4"], stadium="Jahnstadion", cap=3700, rep=32, money=0.4, fans=900, pot=0.1),
    dict(id="boc2", file="rlw_boc2", league="rlw", name="VfL Bochum II", short="Bochum II", abbr="BOC2", colors=["#005CA9", "#FFFFFF"], stadium="Stadion Hiltrop", cap=3000, rep=32, money=0.4, fans=500, reserve="boc", pot=0.12),
    dict(id="rhy", file="rlw_rhy", league="rlw", name="Westfalia Rhynern", short="Rhynern", abbr="SVW", colors=["#E2001A", "#FFFFFF"], stadium="Papenloh", cap=2500, rep=26, money=0.35, fans=650, pot=0.08),
    dict(id="bgl", file="rlw_bgl", league="rlw", name="SV Bergisch Gladbach 09", short="Bergisch Gladbach", abbr="SVB", colors=["#E2001A", "#FFFFFF"], stadium="BELKAW-Arena", cap=4000, rep=26, money=0.35, fans=650, pot=0.09),
    dict(id="hil", file="rlw_hil", league="rlw", name="VfB 03 Hilden", short="Hilden", abbr="VFB", colors=["#111111", "#FFFFFF"], stadium="Stadion Hoffeldstraße", cap=3000, rep=24, money=0.3, fans=550, pot=0.07),
    # --- Regionalliga Suedwest (simuliert). Die staerkste und teuerste Staffel: Traditionsvereine mit
    #     hohen Zuschauerzahlen und groesseren Sponsorentoepfen ---
    dict(id="off", file="rlsw_off", league="rlsw", name="Kickers Offenbach", short="Offenbach", abbr="OFC", colors=["#E2001A", "#FFFFFF"], stadium="Stadion am Bieberer Berg", cap=20500, rep=46, money=1.1, fans=7200, pot=0.5),
    dict(id="ulm", file="rlsw_ulm", league="rlsw", name="SSV Ulm 1846", short="Ulm", abbr="ULM", colors=["#111111", "#FFFFFF"], stadium="Donaustadion", cap=17400, rep=44, money=1.3, fans=5000, pot=0.4),
    dict(id="svs", file="rlsw_svs", league="rlsw", name="SV Sandhausen", short="Sandhausen", abbr="SVS", colors=["#111111", "#FFFFFF"], stadium="BWT-Stadion am Hardtwald", cap=15414, rep=42, money=1.0, fans=2600, pot=0.4),
    dict(id="skk", file="rlsw_skk", league="rlsw", name="Stuttgarter Kickers", short="Stuttg. Kickers", abbr="SKI", colors=["#1D3F8F", "#FFFFFF"], stadium="GAZi-Stadion auf der Waldau", cap=11410, rep=40, money=0.6, fans=4300, pot=0.3),
    dict(id="kas", file="rlsw_kas", league="rlsw", name="KSV Hessen Kassel", short="Kassel", abbr="KAS", colors=["#E2001A", "#FFFFFF"], stadium="Auestadion", cap=18737, rep=38, money=0.5, fans=3300, pot=0.25),
    dict(id="hom", file="rlsw_hom", league="rlsw", name="FC 08 Homburg", short="Homburg", abbr="HOM", colors=["#00843D", "#FFFFFF"], stadium="Waldstadion Homburg", cap=16488, rep=38, money=0.6, fans=2300, pot=0.28),
    dict(id="tri", file="rlsw_tri", league="rlsw", name="Eintracht Trier", short="Trier", abbr="TRI", colors=["#0057B8", "#111111"], stadium="Moselstadion", cap=10254, rep=38, money=0.45, fans=3600, pot=0.22),
    dict(id="hfb", file="rlsw_hfb", league="rlsw", name="SGV Heilbronn-Freiberg", short="Heilbronn-Freiberg", abbr="SGV", colors=["#1E5AA8", "#FFFFFF"], stadium="Frankenstadion", cap=17284, rep=34, money=0.7, fans=1800, pot=0.3),
    dict(id="fsvf", file="rlsw_fsvf", league="rlsw", name="FSV Frankfurt", short="FSV Frankfurt", abbr="FSV", colors=["#111111", "#1E5AA8"], stadium="PSD Bank Arena", cap=12542, rep=38, money=0.5, fans=1900, pot=0.25),
    dict(id="tss", file="rlsw_tss", league="rlsw", name="TSV Steinbach Haiger", short="Steinbach", abbr="TSV", colors=["#E2001A", "#FFFFFF"], stadium="SIBRE-Sportzentrum Haarwasen", cap=4970, rep=34, money=0.6, fans=1100, pot=0.3),
    dict(id="aal", file="rlsw_aal", league="rlsw", name="VfR Aalen", short="Aalen", abbr="AAL", colors=["#111111", "#FFFFFF"], stadium="Centus Arena", cap=14500, rep=36, money=0.4, fans=2700, pot=0.2),
    dict(id="wdf", file="rlsw_wdf", league="rlsw", name="FC-Astoria Walldorf", short="Walldorf", abbr="AST", colors=["#1E5AA8", "#FFFFFF"], stadium="Dietmar-Hopp-Sportpark", cap=5000, rep=30, money=0.45, fans=650, pot=0.18),
    dict(id="scf2", file="rlsw_scf2", league="rlsw", name="SC Freiburg II", short="Freiburg II", abbr="SCF2", colors=["#E2001A", "#111111"], stadium="Dreisamstadion", cap=24000, rep=36, money=0.5, fans=900, reserve="scf", pot=0.12),
    dict(id="m052", file="rlsw_m052", league="rlsw", name="1. FSV Mainz 05 II", short="Mainz II", abbr="M052", colors=["#C3141E", "#FFFFFF"], stadium="Bruchwegstadion", cap=9000, rep=34, money=0.5, fans=600, reserve="m05", pot=0.12),
    dict(id="sge2", file="rlsw_sge2", league="rlsw", name="Eintracht Frankfurt II", short="Frankfurt II", abbr="SGE2", colors=["#E1000F", "#111111"], stadium="Stadion am Brentanobad", cap=5200, rep=32, money=0.5, fans=700, reserve="sge", pot=0.12),
    dict(id="fck2", file="rlsw_fck2", league="rlsw", name="1. FC Kaiserslautern II", short="Lautern II", abbr="FCK2", colors=["#D00027", "#FFFFFF"], stadium="Sportpark Rote Teufel", cap=2000, rep=30, money=0.4, fans=400, reserve="fck", pot=0.1),
    dict(id="fld", file="rlsw_fld", league="rlsw", name="SG Barockstadt Fulda-Lehnerz", short="Barockstadt", abbr="SGB", colors=["#111111", "#FFFFFF"], stadium="Sportpark Johannisau", cap=12573, rep=30, money=0.4, fans=1300, pot=0.15),
    dict(id="vfrm", file="rlsw_vfrm", league="rlsw", name="VfR Mannheim", short="VfR Mannheim", abbr="VFR", colors=["#1E5AA8", "#E2001A"], stadium="Rhein-Neckar-Stadion", cap=4999, rep=30, money=0.35, fans=900, pot=0.14),
    # --- Oberliga-Pool Westen (nicht simuliert, Kader fiktiv) ---
    dict(id="wsv", file="", league="olw", name="Wuppertaler SV", short="Wuppertal", abbr="WSV", colors=["#E30613", "#0A3D91"], stadium="Stadion am Zoo", cap=23067, rep=38, money=0.3, fans=1900),
    dict(id="kfc", file="", league="olw", name="KFC Uerdingen 05", short="Uerdingen", abbr="KFC", colors=["#E30613", "#003E7E"], stadium="Grotenburg-Stadion", cap=12000, rep=34, money=0.25, fans=1600),
    dict(id="f952", file="", league="olw", name="Fortuna Düsseldorf II", short="Düsseldorf II", abbr="F952", colors=["#DA251D", "#FFFFFF"], stadium="Paul-Janes-Stadion", cap=7200, rep=30, money=0.3, fans=400, reserve="f95"),
    dict(id="rwa", file="", league="olw", name="Rot Weiss Ahlen", short="Ahlen", abbr="RWA", colors=["#E2001A", "#FFFFFF"], stadium="Wersestadion", cap=10500, rep=30, money=0.2, fans=900),
    # --- Oberliga-Pool Suedwesten (Oberliga Rheinland-Pfalz/Saar, nicht simuliert, Kader fiktiv) ---
    dict(id="tsm", file="", league="olsw", name="TSV Schott Mainz", short="Schott Mainz", abbr="TSM", colors=["#1E5AA8", "#FFFFFF"], stadium="Bezirkssportanlage Mombach", cap=3000, rep=28, money=0.3, fans=450),
    dict(id="wor", file="", league="olsw", name="Wormatia Worms", short="Worms", abbr="WOR", colors=["#E2001A", "#FFFFFF"], stadium="EWR-Arena", cap=6000, rep=32, money=0.25, fans=1300),
    dict(id="tus", file="", league="olsw", name="TuS Koblenz", short="Koblenz", abbr="TUS", colors=["#1E5AA8", "#111111"], stadium="Stadion Oberwerth", cap=9500, rep=32, money=0.3, fans=1600),
    dict(id="fkp", file="", league="olsw", name="FK Pirmasens", short="Pirmasens", abbr="FKP", colors=["#1E5AA8", "#FFFFFF"], stadium="Sportpark Husterhöhe", cap=10000, rep=30, money=0.25, fans=1100),
]

for _c in CLUBS:
    if _c["id"] in WEST or _c["league"] in ("rlw", "olw"):
        _c["region"] = "west"
    elif _c["id"] in SUEDWEST or _c["league"] in ("rlsw", "olsw"):
        _c["region"] = "suedwest"
