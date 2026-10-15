# DFB-Pokal: Landesverbaende, Amateurvereine und echte Auslosung der 1. Runde 2026/27.
#
# Teilnehmer nach DFB-Regel: 36 Vereine aus Bundesliga und 2. Bundesliga der Vorsaison,
# die vier besten Mannschaften der 3. Liga und 24 Startplaetze der 21 Landesverbaende
# (Landespokalsieger, dazu je ein weiterer Platz fuer Bayern, Niedersachsen und Westfalen).
# Quellen: fussball.de ("DFB-Pokal 2026/2027: Diese Amateurteams sind dabei"), diefalsche9.de,
# kicker.de, sportschau.de, schalke04.de (Auslosung vom 6. Juni 2026).
#
# Amateurvereine: echte Namen und Ligazugehoerigkeit; Staerke (ovr = Schnitt der besten 14),
# Zuschauerschnitt (fans) und Farben sind Schaetzungen, Stadien wo bekannt.

# Landesverbaende: Kuerzel -> (Name, Startplaetze)
LV = {
    "bd": ("Baden", 1), "sb": ("Südbaden", 1), "wb": ("Württemberg", 1), "by": ("Bayern", 2),
    "he": ("Hessen", 1), "sw": ("Südwest", 1), "rh": ("Rheinland", 1), "sl": ("Saarland", 1),
    "mr": ("Mittelrhein", 1), "nr": ("Niederrhein", 1), "wf": ("Westfalen", 2), "ns": ("Niedersachsen", 2),
    "hb": ("Bremen", 1), "hh": ("Hamburg", 1), "sh": ("Schleswig-Holstein", 1), "mv": ("Mecklenburg-Vorpommern", 1),
    "be": ("Berlin", 1), "bb": ("Brandenburg", 1), "st": ("Sachsen-Anhalt", 1), "sn": ("Sachsen", 1), "th": ("Thüringen", 1),
}

# Landesverband der Profivereine (fuer den Landespokal nach einem Abstieg)
CLUB_LV = {
    "fcb": "by", "bvb": "wf", "b04": "mr", "rbl": "sn", "sge": "he", "vfb": "wb", "scf": "sb", "m05": "sw",
    "svw": "hb", "fca": "by", "tsg": "bd", "fcu": "be", "bmg": "nr", "koe": "mr", "hsv": "hh", "s04": "wf",
    "sve": "sl", "scp": "wf", "wob": "ns", "fch": "wb", "stp": "hh", "h96": "ns", "d98": "he", "fck": "sw",
    "bsc": "be", "fcn": "by", "boc": "wf", "ksc": "bd", "sgd": "sn", "ksv": "sh", "dsc": "wf", "fcm": "st",
    "ebs": "ns", "sgf": "by", "osn": "ns", "fce": "bb", "msv": "nr", "vik": "mr", "rwe": "nr", "fcs": "sl",
    "tsg2": "bd", "hro": "mv", "aac": "mr", "prm": "wf", "wal": "bd", "f95": "nr", "scv": "wf", "fko": "mr",
    "sgs": "wb", "fci": "by", "vfb2": "wb", "fwk": "by", "svm": "ns", "jah": "by", "sww": "he", "hav": "ns",
    "m60": "by", "aue": "sn", "ulm": "wb", "sw05": "by",
}

RL_N, RL_NO, RL_W, RL_SW, RL_BY = "Regionalliga Nord", "Regionalliga Nordost", "Regionalliga West", "Regionalliga Südwest", "Regionalliga Bayern"


def A(id, name, short, abbr, colors, stadium, cap, lv, div, ovr, fans):
    return dict(id=id, name=name, short=short, abbr=abbr, colors=colors, stadium=stadium, cap=cap,
                lv=lv, div=div, ovr=ovr, fans=fans)


AMATEURS = [
    # --- Hamburg ---
    A("am_hebc", "HEBC Hamburg", "HEBC", "HEBC", ["#C8102E", "#FFFFFF"], "Volksparkstadion", 57000, "hh", "Oberliga Hamburg", 47, 500),
    A("am_a93", "Altona 93", "Altona 93", "A93", ["#111111", "#FFFFFF"], "Adolf-Jäger-Kampfbahn", 8000, "hh", "Oberliga Hamburg", 47, 1500),
    A("am_nor", "FC Eintracht Norderstedt", "Norderstedt", "EIN", ["#D50000", "#111111"], "Edmund-Plambeck-Stadion", 5068, "hh", RL_N, 50, 700),
    A("am_das", "TuS Dassendorf", "Dassendorf", "TUS", ["#FFD100", "#111111"], "Sportplatz Wendelweg", 2000, "hh", "Oberliga Hamburg", 46, 300),
    # --- Schleswig-Holstein ---
    A("am_phx", "1. FC Phönix Lübeck", "Phönix Lübeck", "PHX", ["#E30613", "#FFD700"], "Stadion Lohmühle", 17849, "sh", RL_N, 50, 700),
    A("am_vfl", "VfB Lübeck", "VfB Lübeck", "LÜB", ["#008C45", "#FFFFFF"], "Stadion Lohmühle", 17849, "sh", RL_N, 51, 2800),
    A("am_wei", "SC Weiche Flensburg 08", "Weiche", "SCW", ["#0055A4", "#FFFFFF"], "Manfred-Werner-Stadion", 4000, "sh", RL_N, 50, 600),
    A("am_eut", "SV Eutin 08", "Eutin", "EUT", ["#D50000", "#FFFFFF"], "Waldstadion Eutin", 3000, "sh", "Oberliga Schleswig-Holstein", 45, 350),
    # --- Bremen ---
    A("am_hem", "SV Hemelingen", "Hemelingen", "SVH", ["#1B5E20", "#FFFFFF"], "Sportplatz Hemelingen", 2500, "hb", "Bremen-Liga", 43, 250),
    A("am_bsv", "Bremer SV", "Bremer SV", "BSV", ["#D50000", "#FFFFFF"], "Stadion am Panzenberg", 5000, "hb", "Bremen-Liga", 46, 500),
    A("am_blu", "Blumenthaler SV", "Blumenthal", "BLU", ["#003DA5", "#FFFFFF"], "Burgwall-Stadion", 3000, "hb", "Bremen-Liga", 44, 250),
    A("am_obn", "FC Oberneuland", "Oberneuland", "FCO", ["#FFCC00", "#111111"], "Sportpark Vinnenweg", 4000, "hb", "Bremen-Liga", 44, 250),
    # --- Niedersachsen ---
    A("am_jed", "SSV Jeddeloh II", "Jeddeloh", "SSV", ["#003DA5", "#FFFFFF"], "Sportpark Jeddeloh", 3000, "ns", RL_N, 51, 600),
    A("am_lsk", "Lüneburger SK Hansa", "Lüneburg", "LSK", ["#003DA5", "#FFFFFF"], "Sportpark Lüneburg", 3000, "ns", RL_N, 50, 700),
    A("am_dro", "SV Drochtersen/Assel", "Drochtersen", "D/A", ["#D50000", "#FFFFFF"], "Kehdinger Stadion", 3000, "ns", RL_N, 51, 1000),
    A("am_emd", "Kickers Emden", "Emden", "KIC", ["#003DA5", "#FFFFFF"], "Ostfriesland-Stadion", 7200, "ns", RL_N, 50, 1800),
    A("am_del", "SV Atlas Delmenhorst", "Atlas", "ATL", ["#003DA5", "#FFD700"], "Stadion an der Düsternortstraße", 6000, "ns", "Oberliga Niedersachsen", 48, 1200),
    A("am_hil", "VfV 06 Hildesheim", "Hildesheim", "VFV", ["#003DA5", "#FFFFFF"], "Friedrich-Ebert-Sportfeld", 6000, "ns", "Oberliga Niedersachsen", 47, 500),
    # --- Mecklenburg-Vorpommern ---
    A("am_gfc", "Greifswalder FC", "Greifswald", "GFC", ["#003DA5", "#FFFFFF"], "Volksstadion Greifswald", 7000, "mv", RL_NO, 52, 2000),
    A("am_scw", "FC Mecklenburg Schwerin", "Schwerin", "FCM", ["#003DA5", "#FFFFFF"], "Sportpark Lambrechtsgrund", 3000, "mv", "Oberliga Nordost", 46, 400),
    A("am_rfc", "Rostocker FC", "Rostocker FC", "RFC", ["#D50000", "#FFFFFF"], "Sportplatz Damerower Weg", 2000, "mv", "Oberliga Nordost", 45, 300),
    A("am_tor", "Torgelower FC Greif", "Torgelow", "TFC", ["#003DA5", "#FFFFFF"], "Stadion der Jugend", 2500, "mv", "Oberliga Nordost", 45, 300),
    # --- Berlin ---
    A("am_vsg", "VSG Altglienicke", "Altglienicke", "VSG", ["#D50000", "#FFFFFF"], "Stadion Altglienicke", 3000, "be", RL_NO, 52, 600),
    A("am_bfc", "BFC Dynamo", "BFC Dynamo", "BFC", ["#7B1E2E", "#FFFFFF"], "Sportforum Hohenschönhausen", 10000, "be", RL_NO, 53, 2000),
    A("am_v89", "FC Viktoria 1889 Berlin", "Viktoria Berlin", "V89", ["#5BA4DB", "#FFFFFF"], "Stadion Lichterfelde", 4300, "be", RL_NO, 50, 600),
    A("am_bak", "Berliner AK 07", "Berliner AK", "BAK", ["#D50000", "#FFFFFF"], "Poststadion", 10000, "be", RL_NO, 50, 400),
    A("am_teb", "Tennis Borussia Berlin", "TeBe", "TEB", ["#6A1B9A", "#FFFFFF"], "Mommsenstadion", 11500, "be", "Oberliga Nordost", 47, 800),
    # --- Brandenburg ---
    A("am_kri", "VfB Krieschow", "Krieschow", "KRI", ["#003DA5", "#FFFFFF"], "LEAG Energie Stadion", 22528, "bb", "Oberliga Nordost", 45, 300),
    A("am_bab", "SV Babelsberg 03", "Babelsberg", "SVB", ["#003DA5", "#FFFFFF"], "Karl-Liebknecht-Stadion", 10499, "bb", RL_NO, 51, 2200),
    A("am_luc", "FSV 63 Luckenwalde", "Luckenwalde", "FSV", ["#D50000", "#FFFFFF"], "Werner-Seelenbinder-Stadion", 5000, "bb", RL_NO, 50, 700),
    A("am_fue", "FSV Union Fürstenwalde", "Fürstenwalde", "FUF", ["#D50000", "#FFFFFF"], "Friesenstadion", 3000, "bb", "Oberliga Nordost", 46, 400),
    # --- Sachsen-Anhalt ---
    A("am_hfc", "Hallescher FC", "Halle", "HFC", ["#D50000", "#FFFFFF"], "Leuna-Chemie-Stadion", 15057, "st", RL_NO, 54, 6000),
    A("am_hbs", "VfB Germania Halberstadt", "Halberstadt", "GER", ["#003DA5", "#FFFFFF"], "Friedensstadion", 5000, "st", "Oberliga Nordost", 46, 500),
    A("am_sdl", "1. FC Lok Stendal", "Lok Stendal", "LOK", ["#003DA5", "#FFFFFF"], "Stadion am Hölzchen", 6000, "st", "Oberliga Nordost", 46, 600),
    # --- Sachsen ---
    A("am_cfc", "Chemnitzer FC", "Chemnitz", "CFC", ["#5BA4DB", "#FFFFFF"], "Stadion an der Gellertstraße", 15000, "sn", RL_NO, 53, 4500),
    A("am_lok", "1. FC Lokomotive Leipzig", "Lok Leipzig", "LOK", ["#003DA5", "#FFD200"], "Bruno-Plache-Stadion", 10900, "sn", RL_NO, 54, 4000),
    A("am_che", "BSG Chemie Leipzig", "Chemie Leipzig", "BSG", ["#007A3D", "#FFFFFF"], "Alfred-Kunze-Sportpark", 4999, "sn", RL_NO, 52, 3500),
    A("am_zwi", "FSV Zwickau", "Zwickau", "FSV", ["#D50000", "#FFFFFF"], "GGZ-Arena", 10134, "sn", RL_NO, 52, 4000),
    # --- Thueringen ---
    A("am_fcc", "FC Carl Zeiss Jena", "Jena", "FCC", ["#003DA5", "#FFD200"], "Ernst-Abbe-Sportfeld", 15000, "th", RL_NO, 54, 6000),
    A("am_erf", "FC Rot-Weiß Erfurt", "Erfurt", "RWE", ["#D50000", "#FFFFFF"], "Steigerwaldstadion", 18599, "th", RL_NO, 53, 5000),
    A("am_zfc", "ZFC Meuselwitz", "Meuselwitz", "ZFC", ["#003DA5", "#FFFFFF"], "bluechip-Arena", 3000, "th", RL_NO, 50, 600),
    A("am_wac", "FSV Wacker 90 Nordhausen", "Nordhausen", "WAC", ["#003DA5", "#FFFFFF"], "Albert-Kuntz-Sportpark", 7000, "th", "Oberliga Nordost", 47, 700),
    # --- Hessen ---
    A("am_ofc", "Kickers Offenbach", "Offenbach", "OFC", ["#D50000", "#FFFFFF"], "Stadion am Bieberer Berg", 20500, "he", RL_SW, 54, 7000),
    A("am_kas", "KSV Hessen Kassel", "Kassel", "KSV", ["#D50000", "#FFFFFF"], "Auestadion", 18737, "he", RL_SW, 52, 3500),
    A("am_fsv", "FSV Frankfurt", "FSV Frankfurt", "FSV", ["#003DA5", "#111111"], "PSD Bank Arena", 12542, "he", RL_SW, 51, 1500),
    A("am_ste", "TSV Steinbach Haiger", "Steinbach", "TSV", ["#D50000", "#FFFFFF"], "Sportzentrum Haarwasen", 3000, "he", RL_SW, 52, 1000),
    A("am_sta", "Eintracht Stadtallendorf", "Stadtallendorf", "EST", ["#D50000", "#FFFFFF"], "Herrenwaldstadion", 6000, "he", "Hessenliga", 47, 500),
    # --- Suedwest ---
    A("am_sco", "TSV Schott Mainz", "Schott Mainz", "TSV", ["#003DA5", "#FFFFFF"], "Bruchwegstadion", 10000, "sw", "Oberliga Rheinland-Pfalz/Saar", 46, 300),
    A("am_fkp", "FK Pirmasens", "Pirmasens", "FKP", ["#003DA5", "#FFFFFF"], "Sportpark Husterhöhe", 10000, "sw", "Oberliga Rheinland-Pfalz/Saar", 48, 800),
    A("am_wor", "VfR Wormatia Worms", "Worms", "WOR", ["#D50000", "#FFFFFF"], "EWR-Arena", 6000, "sw", "Oberliga Rheinland-Pfalz/Saar", 48, 1000),
    A("am_lud", "FC Arminia Ludwigshafen", "Ludwigshafen", "ARM", ["#003DA5", "#FFFFFF"], "Südweststadion", 6000, "sw", "Oberliga Rheinland-Pfalz/Saar", 45, 300),
    # --- Rheinland ---
    A("am_tri", "SV Eintracht Trier 05", "Trier", "TRI", ["#0A3F86", "#FFFFFF"], "Moselstadion", 10254, "rh", RL_SW, 52, 3000),
    A("am_tko", "TuS Koblenz", "TuS Koblenz", "TUS", ["#003DA5", "#111111"], "Stadion Oberwerth", 9500, "rh", "Oberliga Rheinland-Pfalz/Saar", 49, 1500),
    A("am_rwk", "FC Rot-Weiß Koblenz", "RW Koblenz", "RWK", ["#D50000", "#FFFFFF"], "Stadion Oberwerth", 9500, "rh", "Oberliga Rheinland-Pfalz/Saar", 47, 400),
    A("am_eng", "FV Engers 07", "Engers", "FVE", ["#D50000", "#FFFFFF"], "Sportplatz Engers", 3000, "rh", "Oberliga Rheinland-Pfalz/Saar", 46, 300),
    # --- Saarland ---
    A("am_hom", "FC 08 Homburg", "Homburg", "HOM", ["#00843D", "#FFFFFF"], "Waldstadion Homburg", 12500, "sl", RL_SW, 52, 1800),
    A("am_voe", "SV Röchling Völklingen", "Völklingen", "SVR", ["#003DA5", "#FFFFFF"], "Hermann-Neuberger-Stadion", 6000, "sl", "Saarlandliga", 46, 500),
    A("am_die", "FV Diefflen", "Diefflen", "FVD", ["#D50000", "#FFFFFF"], "Sportplatz Diefflen", 2500, "sl", "Oberliga Rheinland-Pfalz/Saar", 45, 300),
    A("am_aum", "SV Auersmacher", "Auersmacher", "SVA", ["#003DA5", "#FFFFFF"], "Sportplatz Auersmacher", 2000, "sl", "Oberliga Rheinland-Pfalz/Saar", 45, 300),
    # --- Baden ---
    A("am_svs", "SV Sandhausen", "Sandhausen", "SVS", ["#111111", "#FFFFFF"], "BWT-Stadion am Hardtwald", 15414, "bd", RL_SW, 54, 3000),
    A("am_ast", "FC-Astoria Walldorf", "Walldorf", "AST", ["#003DA5", "#FFFFFF"], "Dietmar-Hopp-Sportpark", 2500, "bd", RL_SW, 51, 500),
    A("am_vfr", "VfR Mannheim", "VfR Mannheim", "VFR", ["#003DA5", "#D50000"], "Rhein-Neckar-Stadion", 12000, "bd", "Oberliga Baden-Württemberg", 46, 500),
    A("am_pfo", "1. CfR Pforzheim", "Pforzheim", "CFR", ["#003DA5", "#FFFFFF"], "Stadion im Brötzinger Tal", 7000, "bd", "Oberliga Baden-Württemberg", 47, 600),
    # --- Suedbaden ---
    A("am_bah", "Bahlinger SC", "Bahlingen", "BSC", ["#111111", "#FFFFFF"], "Kaiserstuhlstadion", 4000, "sb", "Oberliga Baden-Württemberg", 47, 600),
    A("am_ofv", "Offenburger FV", "Offenburg", "OFV", ["#003DA5", "#FFFFFF"], "Karl-Heitz-Stadion", 6000, "sb", "Oberliga Baden-Württemberg", 46, 500),
    A("am_ffc", "Freiburger FC", "Freiburger FC", "FFC", ["#D50000", "#FFFFFF"], "Dietenbach-Sportpark", 3000, "sb", "Oberliga Baden-Württemberg", 46, 500),
    A("am_vil", "FC 08 Villingen", "Villingen", "FCV", ["#111111", "#FFFFFF"], "MS Technologie-Arena", 8000, "sb", "Oberliga Baden-Württemberg", 47, 800),
    # --- Wuerttemberg ---
    A("am_svk", "Stuttgarter Kickers", "Stuttg. Kickers", "SVK", ["#003DA5", "#FFFFFF"], "GAZi-Stadion auf der Waldau", 11410, "wb", RL_SW, 53, 3500),
    A("am_aal", "VfR Aalen", "Aalen", "VFR", ["#111111", "#FFFFFF"], "Centus-Arena", 14500, "wb", RL_SW, 51, 2000),
    A("am_bal", "TSG Balingen", "Balingen", "TSG", ["#D50000", "#FFFFFF"], "Bizerba-Arena", 6000, "wb", "Oberliga Baden-Württemberg", 48, 1000),
    A("am_fre", "SGV Freiberg", "Freiberg", "SGV", ["#003DA5", "#FFFFFF"], "Wasenstadion", 4000, "wb", RL_SW, 51, 600),
    # --- Bayern ---
    A("am_uhg", "SpVgg Unterhaching", "Unterhaching", "SPV", ["#D50000", "#003DA5"], "uhlsport Park", 15053, "by", RL_BY, 54, 2500),
    A("am_wab", "SV Wacker Burghausen", "Burghausen", "WAC", ["#111111", "#FFFFFF"], "Wacker-Arena", 10000, "by", RL_BY, 52, 1800),
    A("am_byr", "SpVgg Bayreuth", "Bayreuth", "SPV", ["#FFD200", "#111111"], "Hans-Walter-Wild-Stadion", 21500, "by", RL_BY, 52, 2000),
    A("am_ill", "FV Illertissen", "Illertissen", "FVI", ["#D50000", "#FFFFFF"], "Vöhlinstadion", 3500, "by", RL_BY, 51, 700),
    A("am_aub", "TSV Aubstadt", "Aubstadt", "TSV", ["#D50000", "#FFFFFF"], "NGN-Arena", 3000, "by", RL_BY, 50, 600),
    A("am_asc", "SV Viktoria Aschaffenburg", "Aschaffenburg", "SVV", ["#003DA5", "#FFFFFF"], "Stadion am Schönbusch", 6000, "by", RL_BY, 51, 1800),
    A("am_mem", "FC Memmingen", "Memmingen", "FCM", ["#D50000", "#FFFFFF"], "Arena Memmingen", 5100, "by", RL_BY, 50, 900),
    # --- Mittelrhein ---
    A("am_bon", "Bonner SC", "Bonn", "BSC", ["#D50000", "#111111"], "Sportpark Nord", 10164, "mr", RL_W, 51, 1500),
    A("am_hen", "FC Hennef 05", "Hennef", "HEN", ["#003DA5", "#FFFFFF"], "Sportpark Hennef", 3000, "mr", "Mittelrheinliga", 46, 400),
    A("am_sie", "Siegburger SV 04", "Siegburg", "SSV", ["#111111", "#FFFFFF"], "Walter-Mundorf-Stadion", 4000, "mr", "Mittelrheinliga", 46, 400),
    A("am_due", "1. FC Düren", "Düren", "FCD", ["#003DA5", "#FFFFFF"], "Westkampfbahn", 4000, "mr", "Mittelrheinliga", 47, 600),
    # --- Niederrhein ---
    A("am_sct", "SC St. Tönis 1911/20", "St. Tönis", "SCT", ["#003DA5", "#FFFFFF"], "Sportplatz St. Tönis", 2500, "nr", "Oberliga Niederrhein", 46, 300),
    A("am_wsv", "Wuppertaler SV", "Wuppertal", "WSV", ["#D50000", "#003DA5"], "Stadion am Zoo", 23067, "nr", RL_W, 51, 2500),
    A("am_rwo", "Rot-Weiß Oberhausen", "Oberhausen", "RWO", ["#D50000", "#FFFFFF"], "Stadion Niederrhein", 21318, "nr", RL_W, 53, 5000),
    A("am_kfc", "KFC Uerdingen 05", "Uerdingen", "KFC", ["#D50000", "#003DA5"], "Grotenburg-Stadion", 12000, "nr", "Oberliga Niederrhein", 48, 2000),
    A("am_bch", "1. FC Bocholt", "Bocholt", "BOC", ["#003DA5", "#FFFFFF"], "Stadion am Hünting", 6000, "nr", RL_W, 51, 1500),
    # --- Westfalen ---
    A("am_rhy", "SV Westfalia Rhynern", "Rhynern", "RHY", ["#D50000", "#FFFFFF"], "Papenloh", 2500, "wf", RL_W, 49, 500),
    A("am_wie", "SC Wiedenbrück", "Wiedenbrück", "SCW", ["#111111", "#FFFFFF"], "Jahnstadion", 3500, "wf", RL_W, 50, 700),
    A("am_roe", "SV Rödinghausen", "Rödinghausen", "SVR", ["#003DA5", "#FFFFFF"], "Häcker Wiehenstadion", 2489, "wf", RL_W, 51, 700),
    A("am_lot", "Sportfreunde Lotte", "Lotte", "SFL", ["#003DA5", "#FFFFFF"], "Sportpark am Lotter Kreuz", 10059, "wf", RL_W, 50, 1000),
    A("am_gue", "FC Gütersloh", "Gütersloh", "FCG", ["#003DA5", "#FFFFFF"], "Heidewaldstadion", 12500, "wf", RL_W, 50, 2000),
    A("am_sfs", "Sportfreunde Siegen", "Siegen", "SFS", ["#D50000", "#FFFFFF"], "Leimbachstadion", 18500, "wf", "Oberliga Westfalen", 49, 1500),
]

# Echte Auslosung der 1. Hauptrunde 2026/27 (Heimrecht zuerst), gespielt vom 21. bis 24. August 2026
CUP_DRAW_2026 = [
    ("osn", "fcb"), ("am_hebc", "bvb"), ("am_tri", "rbl"), ("hro", "vfb"), ("aue", "tsg"), ("sww", "b04"),
    ("f95", "scf"), ("am_sct", "sge"), ("ebs", "fcu"), ("rwe", "stp"), ("sgs", "dsc"), ("am_jed", "fch"),
    ("am_sco", "bmg"), ("fwk", "koe"), ("am_vsg", "wob"), ("am_phx", "scp"), ("am_rhy", "sgd"), ("am_fcc", "d98"),
    ("scv", "hsv"), ("am_lsk", "svw"), ("wal", "fck"), ("am_bah", "fcm"), ("fcs", "bsc"), ("am_hem", "h96"),
    ("m60", "ksv"), ("sgf", "boc"), ("am_kri", "m05"), ("fce", "fca"), ("vik", "fcn"), ("am_hfc", "s04"),
    ("msv", "sve"), ("prm", "ksc"),
]
