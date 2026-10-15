# Vereinsprofile fuer die Saison 2026/27.
#
# Recherchierte Werte (Stand Oktober 2026):
#   att    Zuschauerschnitt der Saison 2025/26 (Ligaspiele, Stand 18.05.2026; Quelle: diefalsche9.de
#          Zuschauertabellen 1./2./3. Liga und Regionalligen, Abgleich mit kicker/90min)
#   attL   Liga, in der dieser Schnitt erzielt wurde
#   tv     Nationale Medienerloese 2026/27 in Mio. EUR laut Prognose der Liga an die Klubs
#          (Sport Bild, berichtet u. a. von digitalfernsehen.de, hamburg1887.de, fussball-geld.de)
#   pay    Geschaetzte fixe Bruttogehaelter des Profikaders in Mio. EUR (Capology 2026/27,
#          bei Zweitligisten teils 2025/26) - nur wo veroeffentlicht
#   debt   Zinstragende Verbindlichkeiten in Mio. EUR (Schalke: Konzernabschluss 2024/25 147,9 Mio.;
#          Hertha: Nordic Bond 40 Mio. laut Jahresabschluss 2024/25)
#
# Vereinswissen (allgemein bekannt, eigene Einordnung):
#   founded, nick  Gruendungsjahr und Spitzname
#   rivals         Derby-/Rivalitaetsgegner (nur Vereine im Spiel)
#   kind           tradition (Traditionsverein), works (Werks-/Konzernklub), investor (Investor/Maezen),
#                  cult (Kultklub mit besonders treuen Fans), youth (Ausbildungsverein), reserve
#   nlz            Qualitaet des Nachwuchsleistungszentrums 1-5 (5 = Spitzenakademie; drei DFB-Sterne
#                  fuer Union, Kaiserslautern, Nuernberg, Paderborn, Bielefeld, Heidenheim belegt)
#   owner          Maximaler jaehrlicher Verlustausgleich durch Gesellschafter/Konzern in Mio. EUR
#   pat            Geduld des Vorstands/Umfelds (Multiplikator auf Vertrauensverluste; >1 = ungeduldig)

PROFILES = {
    # ---------------- Bundesliga ----------------
    "fcb": dict(att=75000, attL="bl", tv=92.31, pay=240, founded=1900, nick="Die Roten", rivals=["bvb", "m60", "fcn", "fca"], kind=["tradition"], nlz=5, pat=1.35),
    "bvb": dict(att=81365, attL="bl", tv=83.73, pay=113.25, founded=1909, nick="Die Schwarzgelben", rivals=["s04", "fcb", "boc"], kind=["tradition"], nlz=5, pat=1.25),
    "b04": dict(att=30017, attL="bl", tv=81.33, pay=90, founded=1904, nick="Die Werkself", rivals=["koe", "bmg", "f95"], kind=["works"], nlz=5, owner=25, pat=1.1),
    "rbl": dict(att=44164, attL="bl", tv=72.86, pay=80, founded=2009, nick="Die Roten Bullen", rivals=[], kind=["investor"], nlz=5, owner=40, pat=1.1),
    "sge": dict(att=59065, attL="bl", tv=77.12, pay=50.85, founded=1899, nick="Die Adler", rivals=["d98", "m05", "fck", "sww"], kind=["tradition"], nlz=4, pat=1.1),
    "vfb": dict(att=59441, attL="bl", tv=66.00, pay=57.06, founded=1893, nick="Die Roten", rivals=["ksc", "scf", "fch", "tsg"], kind=["tradition"], nlz=5, pat=1.15),
    "scf": dict(att=34118, attL="bl", tv=71.84, pay=51.79, founded=1904, nick="Breisgau-Brasilianer", rivals=["vfb", "ksc"], kind=["youth"], nlz=5, pat=0.7),
    "m05": dict(att=31797, attL="bl", tv=61.30, founded=1905, nick="Die Nullfünfer", rivals=["sge", "fck"], kind=["youth"], nlz=4, pat=0.8),
    "svw": dict(att=41247, attL="bl", tv=47.57, founded=1899, nick="Die Grün-Weißen", rivals=["hsv", "h96", "stp"], kind=["tradition"], nlz=4, pat=1.0),
    "fca": dict(att=29787, attL="bl", tv=52.05, founded=1907, nick="Die Fuggerstädter", rivals=["fcb", "m60", "fcn"], kind=[], nlz=4, pat=0.9),
    "tsg": dict(att=26679, attL="bl", tv=62.05, founded=1899, nick="Die Kraichgauer", rivals=["vfb", "ksc", "wal"], kind=["investor", "youth"], nlz=5, owner=15, pat=0.95),
    "fcu": dict(att=21996, attL="bl", tv=59.62, founded=1966, nick="Die Eisernen", rivals=["bsc", "sgd", "fcm"], kind=["cult"], nlz=4, pat=0.7),
    "bmg": dict(att=51138, attL="bl", tv=52.34, pay=51.17, founded=1900, nick="Die Fohlen", rivals=["koe", "f95", "b04", "aac"], kind=["tradition"], nlz=4, pat=1.05),
    "koe": dict(att=49918, attL="bl", tv=47.99, founded=1948, nick="Die Geißböcke", rivals=["bmg", "b04", "f95", "aac", "vik", "fko"], kind=["tradition"], nlz=4, pat=1.2),
    "hsv": dict(att=56947, attL="bl", tv=40.05, founded=1887, nick="Die Rothosen", rivals=["svw", "stp", "h96", "ksv"], kind=["tradition"], nlz=4, pat=1.25),
    "s04": dict(att=61782, attL="bl2", tv=35.71, founded=1904, nick="Die Knappen", rivals=["bvb", "boc", "rwe", "msv"], kind=["tradition"], nlz=5, debt=148, pat=1.3),
    "sve": dict(att=9113, attL="bl2", tv=31.17, founded=1907, nick="Die SVE", rivals=["fcs"], kind=["investor"], nlz=3, owner=3, pat=0.7),
    "scp": dict(att=14522, attL="bl2", tv=37.22, founded=1907, nick="Die Paderborner", rivals=["dsc", "scv", "prm"], kind=["youth"], nlz=4, pat=0.75),
    # ---------------- 2. Bundesliga ----------------
    "wob": dict(att=24716, attL="bl", tv=24.14, pay=60.15, founded=1945, nick="Die Wölfe", rivals=["ebs", "h96"], kind=["works"], nlz=4, owner=40, pat=1.2),
    "fch": dict(att=14892, attL="bl", tv=21.67, founded=1846, nick="Die Heidenheimer", rivals=["ulm", "vfb"], kind=[], nlz=3, pat=0.6),
    "stp": dict(att=29484, attL="bl", tv=20.26, pay=19.21, founded=1910, nick="Kiezkicker", rivals=["hsv", "hro", "ksv"], kind=["cult"], nlz=4, pat=0.7),
    "h96": dict(att=42794, attL="bl2", tv=13.19, pay=14.59, founded=1896, nick="Die Roten", rivals=["ebs", "wob", "svw", "osn", "hav"], kind=["tradition"], nlz=4, pat=1.15),
    "d98": dict(att=17676, attL="bl2", tv=15.30, founded=1898, nick="Die Lilien", rivals=["sge", "sww", "fck"], kind=["tradition"], nlz=3, pat=0.85),
    "fck": dict(att=46717, attL="bl2", tv=10.90, pay=11.33, founded=1900, nick="Die Roten Teufel", rivals=["sge", "ksc", "m05", "wal", "fcs"], kind=["tradition"], nlz=4, pat=1.2),
    "bsc": dict(att=48291, attL="bl2", tv=16.90, pay=23.75, founded=1892, nick="Die Alte Dame", rivals=["fcu"], kind=["tradition"], nlz=5, debt=40, pat=1.25),
    "fcn": dict(att=35344, attL="bl2", tv=12.80, pay=12.44, founded=1900, nick="Der Club", rivals=["sgf", "fcb", "m60", "fwk", "fca"], kind=["tradition"], nlz=4, pat=1.15),
    "boc": dict(att=25594, attL="bl2", tv=18.60, founded=1848, nick="Die Unabsteigbaren", rivals=["s04", "bvb", "rwe", "msv"], kind=["tradition"], nlz=4, pat=1.0),
    "ksc": dict(att=30311, attL="bl2", tv=13.20, founded=1894, nick="Die Badener", rivals=["vfb", "wal", "fck", "scf"], kind=["tradition"], nlz=4, pat=1.0),
    "sgd": dict(att=31035, attL="bl2", tv=8.86, founded=1953, nick="Die Schwarz-Gelben", rivals=["fcm", "hro", "aue", "fce", "fcu"], kind=["tradition", "cult"], nlz=3, pat=1.1),
    "ksv": dict(att=14185, attL="bl2", tv=14.90, founded=1900, nick="Die Störche", rivals=["hro", "stp", "hsv"], kind=[], nlz=3, pat=0.8),
    "dsc": dict(att=26196, attL="bl2", tv=9.08, founded=1905, nick="Die Arminen", rivals=["scp", "prm", "osn", "scv"], kind=["tradition"], nlz=4, pat=0.95),
    "fcm": dict(att=25084, attL="bl2", tv=9.83, pay=8.9, founded=1965, nick="Der FCM", rivals=["sgd", "ebs", "fcu"], kind=["tradition"], nlz=3, pat=1.0),
    "ebs": dict(att=21088, attL="bl2", tv=9.12, founded=1895, nick="Die Löwen", rivals=["h96", "wob", "fcm"], kind=["tradition"], nlz=3, pat=1.05),
    "sgf": dict(att=12710, attL="bl2", tv=12.10, founded=1903, nick="Das Kleeblatt", rivals=["fcn"], kind=["youth"], nlz=4, pat=0.8),
    "osn": dict(att=14898, attL="l3", tv=7.91, founded=1899, nick="Die Lila-Weißen", rivals=["prm", "dsc", "svm", "h96"], kind=["tradition"], nlz=3, pat=0.95),
    "fce": dict(att=12858, attL="l3", tv=7.48, founded=1966, nick="Die Lausitzer", rivals=["sgd", "hro", "fcm", "aue"], kind=["tradition"], nlz=3, pat=0.9),
    # ---------------- 3. Liga ----------------
    "msv": dict(att=22944, attL="l3", founded=1902, nick="Die Zebras", rivals=["rwe", "s04", "boc", "f95"], kind=["tradition"], nlz=3, pat=1.05),
    "vik": dict(att=4356, attL="l3", founded=1904, nick="Die Höhenberger", rivals=["fko", "koe"], kind=[], nlz=2, pat=0.85),
    "rwe": dict(att=17319, attL="l3", founded=1907, nick="Rot-Weiss", rivals=["msv", "s04", "boc"], kind=["tradition", "cult"], nlz=3, pat=1.05),
    "fcs": dict(att=12962, attL="l3", founded=1903, nick="Die Molschder", rivals=["sve", "fck", "wal"], kind=["tradition"], nlz=3, pat=1.0),
    "tsg2": dict(att=1597, attL="l3", founded=1899, nick="Hoffenheim II", rivals=[], kind=["reserve"], nlz=5, pat=0.6),
    "hro": dict(att=24988, attL="l3", founded=1965, nick="Die Kogge", rivals=["stp", "sgd", "fcm", "ksv", "fce"], kind=["tradition", "cult"], nlz=4, pat=1.1),
    "aac": dict(att=23108, attL="l3", founded=1900, nick="Die Kartoffelkäfer", rivals=["koe", "bmg", "vik"], kind=["tradition"], nlz=3, pat=1.0),
    "prm": dict(att=10446, attL="bl2", founded=1906, nick="Die Adler", rivals=["osn", "dsc", "scv"], kind=["tradition"], nlz=3, pat=0.9),
    "wal": dict(att=12039, attL="l3", founded=1907, nick="Die Buwe", rivals=["ksc", "fck", "tsg", "fcs"], kind=["tradition"], nlz=3, pat=1.0),
    "f95": dict(att=42502, attL="bl2", founded=1895, nick="Die Flingeraner", rivals=["koe", "bmg", "b04", "msv"], kind=["tradition"], nlz=4, pat=1.15),
    "scv": dict(att=3003, attL="l3", founded=1924, nick="Die Verler", rivals=["dsc", "scp", "prm"], kind=[], nlz=2, pat=0.7),
    "fko": dict(att=2891, attL="rl", founded=1948, nick="Die Südstädter", rivals=["vik", "koe"], kind=[], nlz=2, pat=0.8),
    "sgs": dict(att=1329, attL="rl", founded=1994, nick="Die Aspacher", rivals=["vfb2"], kind=[], nlz=2, pat=0.8),
    "fci": dict(att=5063, attL="l3", founded=2004, nick="Die Schanzer", rivals=["jah", "fcn", "m60"], kind=["works"], nlz=4, owner=3, pat=1.0),
    "vfb2": dict(att=1651, attL="l3", founded=1893, nick="VfB II", rivals=["sgs"], kind=["reserve"], nlz=5, pat=0.6),
    "fwk": dict(att=2357, attL="rl", founded=1907, nick="Die Rothosen", rivals=["sw05", "fcn", "jah"], kind=[], nlz=3, pat=0.9),
    "svm": dict(att=7868, attL="rl", founded=1912, nick="Die Emsländer", rivals=["osn"], kind=["tradition"], nlz=2, pat=0.9),
    "jah": dict(att=8895, attL="l3", founded=1907, nick="Der Jahn", rivals=["fci", "fcn", "m60"], kind=[], nlz=3, pat=0.9),
    "sww": dict(att=4439, attL="l3", founded=1926, nick="Die Wehener", rivals=["d98", "m05", "sge"], kind=["investor"], nlz=3, owner=2, pat=0.85),
    "hav": dict(att=1785, attL="l3", founded=1912, nick="Die Garbsener", rivals=["h96"], kind=[], nlz=1, pat=0.7),
    # ---------------- Regionalliga-Pool ----------------
    "m60": dict(att=15000, attL="l3", founded=1860, nick="Die Löwen", rivals=["fcb", "fcn", "fca", "jah", "fci"], kind=["tradition", "cult"], nlz=4, pat=1.15),
    "aue": dict(att=8430, attL="l3", founded=1946, nick="Die Veilchen", rivals=["sgd", "fce"], kind=["tradition"], nlz=3, pat=1.0),
    "ulm": dict(att=10077, attL="l3", founded=1846, nick="Die Spatzen", rivals=["fch"], kind=["tradition"], nlz=3, pat=0.9),
    "sw05": dict(att=4181, attL="l3", founded=1905, nick="Die Schnüdel", rivals=["fwk"], kind=["tradition"], nlz=2, pat=0.9),
}
