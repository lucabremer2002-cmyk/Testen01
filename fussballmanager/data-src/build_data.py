#!/usr/bin/env python3
"""Erzeugt ../js/data.js aus den Rohkadern in raw/*.md.

Rohformat pro Zeile:
  | rang | Name | POS/POS | OVR | PAC | SHO | PAS | DRI | DEF | PHY |   FC-27-Werte inkl. Kartenwerte
  | rang | Name | POS | OVR |                                       nur FC-27-Gesamtwert bekannt
  Name | POS | OVR | Alter                                           (nach "#est") geschaetzt
  @ Name = OVR                                                       Korrektur auf FC-27-Wert
  + Name | POS | OVR                                                 Zugang mit FC-27-Wert
  #src fc26                                                          Basis ist FC-26-Datenstand

Quellen-Kennung im Ergebnis:
  v = FC 27 Gesamtwert + Kartenwerte, o = FC 27 Gesamtwert (Kartenwerte abgeleitet),
  f = FC-26-Datenstand, e = geschaetzt (echter Kaderspieler, Wert geschaetzt)
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from clubs import CLUBS, LEAGUES  # noqa: E402
from profiles import PROFILES  # noqa: E402
from amateurs import AMATEURS, CLUB_LV, CUP_DRAW_2026, LV  # noqa: E402
import europe  # noqa: E402
import euro_draw  # noqa: E402
from ages import AGES  # noqa: E402

# Gleichnamige, aber verschiedene Spieler (nicht deduplizieren)
HOMONYMS = {"Jonas Hofmann"}
AGE_OVERRIDE = {("Jonas Hofmann", "fce"): 27}

POS_ALIASES = {"LWB": "LB", "RWB": "RB", "CF": "ST"}


def h(*parts):
    return int(hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()[:8], 16)


def jitter(name, key, spread):
    return (h(name, key) % (2 * spread + 1)) - spread


def clamp(v, lo=15, hi=99):
    return max(lo, min(hi, int(round(v))))


def derive_stats(name, pos, ovr):
    """Kartenwerte aus Position und Gesamtwert ableiten (wenn nicht bekannt)."""
    p = pos.split("/")[0]
    o = ovr
    if p == "GK":
        base = [o + 1, o - 2, o - 7, o + 2, 38, o - 1]
    elif p == "ST":
        base = [o + 2, o + 3, o - 12, o - 2, 33, o + 3]
    elif p in ("LW", "RW", "LM", "RM"):
        base = [o + 9, o - 4, o - 4, o + 3, 38, o - 10]
    elif p == "CAM":
        base = [o - 2, o - 3, o + 2, o + 3, 45, o - 12]
    elif p == "CM":
        base = [o - 4, o - 8, o + 1, o, o - 8, o - 2]
    elif p == "CDM":
        base = [o - 9, o - 15, o - 4, o - 6, o + 1, o + 5]
    elif p == "CB":
        base = [o - 6, 35, o - 15, o - 13, o + 1, o + 5]
    elif p in ("LB", "RB"):
        base = [o + 5, 45, o - 6, o - 4, o - 3, o]
    else:
        base = [o] * 6
    keys = ["pac", "sho", "pas", "dri", "def", "phy"]
    return [clamp(b + jitter(name, k, 3)) for b, k in zip(base, keys)]


def norm_pos(pos):
    out = []
    for p in re.split(r"[/,\s]+", pos.strip()):
        p = POS_ALIASES.get(p.upper(), p.upper())
        if p and p not in out:
            out.append(p)
    return "/".join(out)


def guess_age(name, ovr, club_top, src):
    gap = club_top - ovr
    r = h(name, "age")
    if gap >= 14:
        return 18 + r % 4
    if gap >= 9:
        return 19 + r % 6
    return 21 + r % 11


def parse_file(path):
    players = []
    patches = {}
    src_mode = "fc27"
    est = False
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#src"):
                src_mode = line.split()[1]
                continue
            if line.startswith("#est"):
                est = True
                continue
            if line.startswith("@"):
                m = re.match(r"@\s*(.+?)\s*=\s*(\d+)", line)
                patches[m.group(1)] = int(m.group(2))
                continue
            if line.startswith("+"):
                parts = [p.strip() for p in line[1:].split("|")]
                players.append(dict(name=parts[0], pos=norm_pos(parts[1]), ovr=int(parts[2]), stats=None, src="o", age=None))
                continue
            if line.startswith("|"):
                cells = [c.strip() for c in line.strip("|").split("|")]
                name, pos, ovr = cells[1], norm_pos(cells[2]), int(cells[3])
                stats = [int(c) for c in cells[4:10]] if len(cells) >= 10 else None
                if src_mode == "fc26":
                    src = "f"
                else:
                    src = "v" if stats else "o"
                players.append(dict(name=name, pos=pos, ovr=ovr, stats=stats, src=src, age=None))
                continue
            if est:
                parts = [p.strip() for p in line.split("|")]
                age = int(parts[3]) if len(parts) > 3 and parts[3] else None
                players.append(dict(name=parts[0], pos=norm_pos(parts[1]), ovr=int(parts[2]), stats=None, src="e", age=age))
    for p in players:
        if p["name"] in patches:
            new = patches[p["name"]]
            if p["stats"]:
                d = new - p["ovr"]
                p["stats"] = [clamp(s + d) for s in p["stats"]]
            p["ovr"] = new
            p["src"] = "o"
    return players


def main():
    seen = set()
    out_players = {}
    stats = {"v": 0, "o": 0, "f": 0, "e": 0}
    for club in CLUBS:
        path = os.path.join(HERE, "raw", club["file"] + ".md")
        plist = parse_file(path)
        top = max(p["ovr"] for p in plist)
        rows = []
        for p in plist:
            key = p["name"]
            if key in seen and key not in HOMONYMS:
                continue
            seen.add(key)
            age = AGE_OVERRIDE.get((key, club["id"])) or p["age"] or AGES.get(key)
            age_known = age is not None
            if not age_known:
                age = guess_age(key, p["ovr"], top, p["src"])
            st = p["stats"] or derive_stats(key, p["pos"], p["ovr"])
            src = p["src"]
            if src == "v" and p["stats"] is None:
                src = "o"
            stats[src] += 1
            rows.append([key, p["pos"], p["ovr"], st, age, src + ("" if age_known else "?")])
        rows.sort(key=lambda r: -r[2])
        out_players[club["id"]] = rows

    ids = {c["id"] for c in CLUBS}
    clubs_out = []
    for c in CLUBS:
        d = {k: v for k, v in c.items() if k != "file"}
        prof = PROFILES.get(c["id"])
        if not prof:
            raise SystemExit("Kein Vereinsprofil fuer " + c["id"])
        for r in prof.get("rivals", []):
            if r not in ids:
                raise SystemExit("Unbekannter Rivale %s bei %s" % (r, c["id"]))
        d["profile"] = prof
        if c["id"] not in CLUB_LV:
            raise SystemExit("Kein Landesverband fuer " + c["id"])
        d["lv"] = CLUB_LV[c["id"]]
        clubs_out.append(d)

    # DFB-Pokal: Amateurvereine und echte Auslosung pruefen
    am_ids = set()
    for a in AMATEURS:
        if a["id"] in ids or a["id"] in am_ids:
            raise SystemExit("Doppelte Vereins-ID " + a["id"])
        if a["lv"] not in LV:
            raise SystemExit("Unbekannter Landesverband bei " + a["id"])
        am_ids.add(a["id"])
    for lv in LV:
        if sum(1 for a in AMATEURS if a["lv"] == lv) < 3:
            raise SystemExit("Zu wenige Amateurvereine im Landesverband " + lv)
    drawn = [cid for pair in CUP_DRAW_2026 for cid in pair]
    if len(CUP_DRAW_2026) != 32 or len(set(drawn)) != 64:
        raise SystemExit("Pokalauslosung 2026/27 unvollstaendig oder doppelt")
    for cid in drawn:
        if cid not in ids and cid not in am_ids:
            raise SystemExit("Unbekannter Pokalteilnehmer " + cid)
    for c in CLUBS:
        if c["league"] in ("bl", "bl2") and c["id"] not in drawn:
            raise SystemExit("Profiverein fehlt in der Pokalauslosung: " + c["id"])

    # Europapokal: Auslandsvereine, Stars und Spielplaene der Ligaphasen 2026/27
    eu_ids = set()
    for c in europe.CLUBS:
        if c["id"] in ids or c["id"] in am_ids or c["id"] in eu_ids:
            raise SystemExit("Doppelte Vereins-ID " + c["id"])
        if c["nat"] not in europe.LEAGUE or c["nat"] not in europe.COUNTRY:
            raise SystemExit("Unbekannter Verband bei " + c["id"])
        eu_ids.add(c["id"])
    nat = {c["id"]: c["nat"] for c in europe.CLUBS}
    draw = {}
    for comp, pots in europe.POTS_2026.items():
        flat = [t for pot in pots for t in pot]
        if len(flat) != 36 or len(set(flat)) != 36:
            raise SystemExit("Lostoepfe unvollstaendig: " + comp)
        for t in flat:
            if t in ids:
                nat[t] = "GER"
            elif t not in eu_ids:
                raise SystemExit("Unbekannter Europapokal-Teilnehmer " + t)
        real = europe.REAL_2026[comp]
        fx = (euro_draw.solve_one_per_pot if comp == "ecl" else euro_draw.solve_two_per_pot)(pots, nat, real, 2026)
        euro_draw.check(pots, nat, real, fx, 1 if comp == "ecl" else 2)
        draw[comp] = [list(f) for f in fx]
    for cid, stars in europe.STARS.items():
        if cid not in eu_ids:
            raise SystemExit("Stars fuer unbekannten Verein " + cid)
        for st in stars:
            if st[1].split("/")[0] not in ("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"):
                raise SystemExit("Unbekannte Position bei " + st[0])
    eu = {
        "clubs": europe.CLUBS,
        "league": europe.LEAGUE,
        "country": europe.COUNTRY,
        "stars": {k: [list(x) for x in v] for k, v in europe.STARS.items()},
        "names": {k: [v[0], v[1]] for k, v in europe.NAMES.items()},
        "natPool": europe.NAT_POOL,
        "pots": europe.POTS_2026,
        "draw": draw,
    }

    data = {
        "season": "2026/27",
        "startYear": 2026,
        "generated": "Datenstand: EA SPORTS FC 27 (Launch-Ratings, Sept. 2026) / Kader 2026/27",
        "leagues": LEAGUES,
        "clubs": clubs_out,
        "players": out_players,
        "lv": {k: {"name": v[0], "slots": v[1]} for k, v in LV.items()},
        "amateurs": AMATEURS,
        "cupDraw": [list(p) for p in CUP_DRAW_2026],
        "eu": eu,
    }
    js = "/* Automatisch erzeugt von data-src/build_data.py - nicht von Hand bearbeiten. */\n"
    js += "window.FM_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    dst = os.path.join(HERE, "..", "js", "data.js")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write(js)
    total = sum(len(v) for v in out_players.values())
    print(f"{len(clubs_out)} Vereine, {total} Spieler, {len(AMATEURS)} Amateurvereine, {len(europe.CLUBS)} Auslandsvereine -> {os.path.relpath(dst)}")
    print("Quellen:", stats)
    for c in CLUBS:
        rows = out_players[c["id"]]
        gk = sum(1 for r in rows if r[1].startswith("GK"))
        print(f"  {c['id']:5} {len(rows):3} Spieler  GK={gk}  Top={rows[0][2]}  Schnitt11={sum(r[2] for r in rows[:11])/11:.1f}")


if __name__ == "__main__":
    main()
