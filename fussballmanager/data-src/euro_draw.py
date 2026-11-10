"""Spielplan der europaeischen Ligaphasen.

Baut aus den Lostoepfen und den bekannten Partien der deutschen Klubs einen vollstaendigen Spielplan,
der die UEFA-Regeln einhaelt:
  Champions League / Europa League: 36 Teams in 4 Toepfen, acht Spiele, je Topf (auch dem eigenen) ein
  Heim- und ein Auswaertsspiel, keine Duelle innerhalb eines Verbands, hoechstens zwei Gegner je Verband.
  Conference League: 36 Teams in 6 Toepfen, sechs Spiele, ein Gegner aus jedem Topf, je drei Heimspiele.
Jedes Team spielt an jedem Spieltag genau einmal.

Die Partien der deutschen Klubs 2026/27 sind echt, der Rest des Spielplans ist eine regelkonforme
Auslosung (fester Startwert, damit data.js reproduzierbar bleibt). Derselbe Plan dient spaeter als
Schablone: Die Vereine einer neuen Saison werden innerhalb ihrer Toepfe zufaellig auf die Plaetze verteilt.
"""
import random
import sys

sys.setrecursionlimit(10000)


class Fail(Exception):
    pass


def _kuhn(left, right_of, rng):
    """Perfektes Matching left -> right; right_of(t) liefert die erlaubten Partner in Zufallsreihenfolge."""
    match_r = {}

    def try_assign(t, seen):
        for u in right_of(t):
            if u in seen:
                continue
            seen.add(u)
            if u not in match_r or try_assign(match_r[u], seen):
                match_r[u] = t
                return True
        return False

    order = left[:]
    rng.shuffle(order)
    for t in order:
        if not try_assign(t, set()):
            raise Fail()
    return {t: u for u, t in match_r.items()}


def _pairs_ok(edges, nat, max_per_nat):
    """Keine Paarung doppelt, kein Verbandsduell, hoechstens max_per_nat Gegner je Verband."""
    seen = set()
    cnt = {}
    for h, a in edges:
        key = (h, a) if h < a else (a, h)
        if key in seen or nat[h] == nat[a]:
            return False
        seen.add(key)
        for x, y in ((h, a), (a, h)):
            k = (x, nat[y])
            cnt[k] = cnt.get(k, 0) + 1
            if cnt[k] > max_per_nat:
                return False
    return True


def _matchdays(teams, edges, forced_md, n_md, rng, limit=400000):
    """Jedem Spiel einen Spieltag zuweisen: jedes Team genau einmal je Spieltag (Tiefensuche mit Propagation)."""
    n = len(edges)
    inc = {t: [] for t in teams}
    for i, (h, a) in enumerate(edges):
        inc[h].append(i)
        inc[a].append(i)
    full = (1 << n_md) - 1
    dom = [full] * n
    val = [-1] * n
    used = {t: 0 for t in teams}
    trail = []
    steps = [0]

    def assign(i, d):
        """Wert setzen und propagieren; False bei Widerspruch."""
        stack = [(i, d)]
        while stack:
            j, dj = stack.pop()
            if val[j] == dj:
                continue
            if val[j] != -1 or not (dom[j] >> dj) & 1:
                return False
            h, a = edges[j]
            if (used[h] >> dj) & 1 or (used[a] >> dj) & 1:
                return False
            trail.append(('v', j, dom[j]))
            val[j] = dj
            dom[j] = 1 << dj
            used[h] |= 1 << dj
            used[a] |= 1 << dj
            for t in (h, a):
                for k in inc[t]:
                    if val[k] == -1 and (dom[k] >> dj) & 1:
                        trail.append(('d', k, dom[k]))
                        dom[k] &= ~(1 << dj)
                        if dom[k] == 0:
                            return False
                        if dom[k] & (dom[k] - 1) == 0:
                            stack.append((k, dom[k].bit_length() - 1))
            # jedes Team braucht fuer jeden freien Spieltag noch ein moegliches Spiel
            for t in (h, a):
                free = full & ~used[t]
                d2 = 0
                while free:
                    if free & 1:
                        cand = [k for k in inc[t] if val[k] == -1 and (dom[k] >> d2) & 1]
                        if not cand:
                            return False
                        if len(cand) == 1:
                            stack.append((cand[0], d2))
                    free >>= 1
                    d2 += 1
        return True

    def undo(mark):
        while len(trail) > mark:
            kind, j, old = trail.pop()
            if kind == 'v':
                h, a = edges[j]
                d = val[j]
                used[h] &= ~(1 << d)
                used[a] &= ~(1 << d)
                val[j] = -1
            dom[j] = old

    for i, d in forced_md.items():
        if not assign(i, d):
            raise Fail()

    def search():
        steps[0] += 1
        if steps[0] > limit:
            raise Fail()
        best, bc = -1, 99
        for i in range(n):
            if val[i] == -1:
                c = bin(dom[i]).count('1')
                if c < bc or (c == bc and rng.random() < 0.3):
                    best, bc = i, c
        if best == -1:
            return True
        ds = [d for d in range(n_md) if (dom[best] >> d) & 1]
        rng.shuffle(ds)
        for d in ds:
            mark = len(trail)
            if assign(best, d) and search():
                return True
            undo(mark)
        return False

    if not search():
        raise Fail()
    return val


def solve_two_per_pot(pots, nat, forced, seed):
    """Champions League / Europa League. forced: [(heim, gast, spieltag|None)]. Ergebnis: [(heim, gast, spieltag 1-8)]."""
    rng = random.Random(seed)
    pot_of = {t: i for i, p in enumerate(pots) for t in p}
    teams = [t for p in pots for t in p]
    n = len(pots)
    for attempt in range(4000):
        try:
            edges = []
            # Bijektionen H[p][q]: Team aus Topf p empfaengt Team aus Topf q
            order = [(p, q) for p in range(n) for q in range(n)]
            rng.shuffle(order)
            for p, q in order:
                fixed = {h: a for h, a, _ in forced if pot_of[h] == p and pot_of[a] == q}
                taken = set(fixed.values())
                played = set((h, a) if h < a else (a, h) for h, a in edges)
                cnt = {}
                for h, a in edges:
                    cnt[(h, nat[a])] = cnt.get((h, nat[a]), 0) + 1
                    cnt[(a, nat[h])] = cnt.get((a, nat[h]), 0) + 1

                def right_of(t, fixed=fixed, taken=taken, played=played, cnt=cnt, q=q):
                    if t in fixed:
                        return [fixed[t]]
                    cand = [u for u in pots[q] if u != t and u not in taken and nat[u] != nat[t]
                            and ((t, u) if t < u else (u, t)) not in played
                            and cnt.get((t, nat[u]), 0) < 2 and cnt.get((u, nat[t]), 0) < 2]
                    rng.shuffle(cand)
                    return cand

                m = _kuhn(pots[p], right_of, rng)
                edges.extend(m.items())
            if not _pairs_ok(edges, nat, 2):
                continue
            idx = {e: i for i, e in enumerate(edges)}
            forced_md = {idx[(h, a)]: md - 1 for h, a, md in forced if md}
            val = _matchdays(teams, edges, forced_md, 2 * n, rng, limit=60000)
            return [(h, a, val[i] + 1) for i, (h, a) in enumerate(edges)]
        except Fail:
            continue
    raise SystemExit("Europapokal-Spielplan: keine Loesung gefunden")


def solve_one_per_pot(pots, nat, forced, seed):
    """Conference League: ein Gegner je Topf, drei Heimspiele. Ergebnis: [(heim, gast, spieltag 1-6)]."""
    rng = random.Random(seed)
    pot_of = {t: i for i, p in enumerate(pots) for t in p}
    teams = [t for p in pots for t in p]
    n = len(pots)
    fpair = {}
    for h, a, md in forced:
        fpair[(h, a) if h < a else (a, h)] = (h, a, md)
    for attempt in range(4000):
        try:
            pairs = []
            for p in range(n):
                for q in range(p, n):
                    if p == q:
                        # perfektes Matching innerhalb des Topfs
                        for _ in range(200):
                            order = pots[p][:]
                            rng.shuffle(order)
                            cand = [(order[i], order[i + 1]) for i in range(0, len(order), 2)]
                            ok = all(nat[x] != nat[y] for x, y in cand)
                            for (x, y), (fh, fa, _) in fpair.items():
                                if pot_of[x] == p and pot_of[y] == p and not any({x, y} == {c[0], c[1]} for c in cand):
                                    ok = False
                            if ok:
                                pairs.extend(cand)
                                break
                        else:
                            raise Fail()
                    else:
                        fixed = {}
                        for (x, y) in fpair:
                            if pot_of[x] == p and pot_of[y] == q:
                                fixed[x] = y
                            elif pot_of[y] == p and pot_of[x] == q:
                                fixed[y] = x
                        taken = set(fixed.values())

                        def right_of(t, fixed=fixed, taken=taken, q=q):
                            if t in fixed:
                                return [fixed[t]]
                            cand = [u for u in pots[q] if u not in taken and nat[u] != nat[t]]
                            rng.shuffle(cand)
                            return cand

                        pairs.extend(_kuhn(pots[p], right_of, rng).items())
            # Heimrecht: je Team drei Heimspiele, bekannte Partien bleiben fest
            home = {}
            for i, (x, y) in enumerate(pairs):
                key = (x, y) if x < y else (y, x)
                home[i] = fpair[key][0] if key in fpair else (x if rng.random() < 0.5 else y)
            locked = set(i for i, (x, y) in enumerate(pairs) if ((x, y) if x < y else (y, x)) in fpair)
            hc = {t: 0 for t in teams}
            for i in home:
                hc[home[i]] += 1
            for _ in range(20000):
                over = [t for t in teams if hc[t] > n // 2]
                if not over:
                    break
                t = rng.choice(over)
                cand = [i for i, (x, y) in enumerate(pairs) if home[i] == t and i not in locked]
                if not cand:
                    raise Fail()
                # bevorzugt an einen Gegner mit zu wenigen Heimspielen abgeben
                cand.sort(key=lambda i: hc[pairs[i][0] if pairs[i][1] == t else pairs[i][1]] + rng.random())
                i = cand[0]
                o = pairs[i][0] if pairs[i][1] == t else pairs[i][1]
                home[i] = o
                hc[t] -= 1
                hc[o] += 1
            if any(hc[t] != n // 2 for t in teams):
                continue
            edges = [(home[i], x if home[i] == y else y) for i, (x, y) in enumerate(pairs)]
            if not _pairs_ok(edges, nat, 9):
                continue
            idx = {e: i for i, e in enumerate(edges)}
            forced_md = {idx[(h, a)]: md - 1 for h, a, md in forced if md}
            val = _matchdays(teams, edges, forced_md, n, rng, limit=60000)
            return [(h, a, val[i] + 1) for i, (h, a) in enumerate(edges)]
        except Fail:
            continue
    raise SystemExit("Conference-League-Spielplan: keine Loesung gefunden")


def check(pots, nat, forced, fx, per_pot):
    """Selbsttest: alle Regeln und alle bekannten Partien eingehalten?"""
    pot_of = {t: i for i, p in enumerate(pots) for t in p}
    teams = [t for p in pots for t in p]
    n_md = max(m for _, _, m in fx)
    for t in teams:
        mine = [(h, a, m) for h, a, m in fx if h == t or a == t]
        assert len(mine) == n_md, (t, len(mine))
        assert sorted(m for _, _, m in mine) == list(range(1, n_md + 1)), t
        assert sum(1 for h, _, _ in mine if h == t) == n_md // 2, t
        for p in range(len(pots)):
            opp = [(h, a) for h, a, _ in mine if pot_of[a if h == t else h] == p]
            assert len(opp) == per_pot, (t, p, len(opp))
            if per_pot == 2:
                assert sum(1 for h, _ in opp if h == t) == 1, (t, p)
    assert _pairs_ok([(h, a) for h, a, _ in fx], nat, 2 if per_pot == 2 else 9)
    have = {(h, a): m for h, a, m in fx}
    for h, a, m in forced:
        assert (h, a) in have and (m is None or have[(h, a)] == m), (h, a, m)
    return True
