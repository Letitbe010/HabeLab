"""
HabeLab external oracle (development time only, spec section 9.3).

Solves every beam independently of the TypeScript solvers, with SymPy and exact
Rationals, using the METHOD OF SECTIONS literally:

  * reactions: sympy.solve of  sum(Fy) = 0  and  sum(M about x = 0) = 0;
  * V(x0) = sum of the UPWARD forces strictly left of the section (left limit) or up to
    and including x0 (right limit); distributed loads integrated from x1 to min(x2, x0);
  * M(x0) = sum of the CLOCKWISE moments about the section of everything left of it.

Sign conventions are exactly the app's (spec section 4.1), stated here explicitly
because SymPy's own Beam module uses different ones (it is NOT used here):
  F, q > 0 downwards;  M0 > 0 clockwise;  R > 0 upwards;  reaction moment > 0 clockwise;
  V > 0 when the left resultant points up;  M > 0 sagging (clockwise moment of the left
  forces about the section).
  An upward force R at xi < x0 has a clockwise moment R * (x0 - xi) about the section;
  a downward force F has -F * (x0 - xi).

Usage:
  python tools/oracle/beams.py OUT.json INPUT.json [INPUT.json ...]
Each INPUT is either tests/golden/golden.json ({"cases": [{"id", "exercise"}]}) or a
random-beam file ({"beams": [{"id", "exercise"}]}). Exercises use the app's JSON format
(model.ts, Exercise); values are decimal or "p/q" strings.
"""

import json
import sys
from pathlib import Path

import sympy as sp

X = sp.Symbol("x", real=True)
G = sp.Rational(981, 100)  # g = 9.81 m/s^2 (golden cases use the default)


def num(s):
    """Exact parse of '2,5', '2.5', '-3/4', '1e3' (sympy.Rational parses decimal strings exactly)."""
    s = str(s).strip().replace(",", ".")
    if "/" in s:
        a, b = s.split("/")
        return sp.Rational(a) / sp.Rational(b)
    return sp.Rational(s)


def factor(unit):
    if unit in ("N", "N/m", "N·m"):
        return sp.Integer(1)
    if unit in ("kN", "kN/m", "kN·m"):
        return sp.Integer(1000)
    if unit in ("kg", "kg/m", "kg·m"):
        return G
    raise ValueError(f"unknown unit {unit}")


def to_si(ex):
    L = num(ex["beam"]["length"])
    supports = [{"type": s["type"], "x": num(s["x"]), "label": s["label"]} for s in ex["beam"]["supports"]]
    loads = []
    for ld in ex["loads"]:
        f = factor(ld["unit"])
        k = ld["kind"]
        if k == "point":
            loads.append({"kind": k, "x": num(ld["x"]), "F": num(ld["F"]) * f})
        elif k == "moment":
            loads.append({"kind": k, "x": num(ld["x"]), "M": num(ld["M"]) * f})
        elif k == "udl":
            q = num(ld["q"]) * f
            loads.append({"kind": "dist", "x1": num(ld["x1"]), "x2": num(ld["x2"]), "q1": q, "q2": q})
        elif k == "linear":
            loads.append({"kind": "dist", "x1": num(ld["x1"]), "x2": num(ld["x2"]),
                          "q1": num(ld["q1"]) * f, "q2": num(ld["q2"]) * f})
        else:
            raise ValueError(k)
    return L, supports, loads


def density(ld):
    """q(x) of a distributed load as a SymPy expression (valid on [x1, x2])."""
    x1, x2, q1, q2 = ld["x1"], ld["x2"], ld["q1"], ld["q2"]
    return q1 + (q2 - q1) * (X - x1) / (x2 - x1)


def solve_beam(ex):
    L, supports, loads = to_si(ex)

    # --- unknowns and equilibrium -------------------------------------------------
    unknown_R = {s["label"]: sp.Symbol("R_" + s["label"]) for s in supports}
    fixed = [s for s in supports if s["type"] == "fixed"]
    unknown_M = {s["label"]: sp.Symbol("MR_" + s["label"]) for s in fixed}

    sum_fy = sum(unknown_R.values())  # upward +
    sum_m0 = sp.Integer(0)  # clockwise + about x = 0
    for s in supports:
        sum_m0 += -unknown_R[s["label"]] * s["x"]  # upward force at x: counter-clockwise about 0
    for lbl, m in unknown_M.items():
        sum_m0 += m
    for ld in loads:
        if ld["kind"] == "point":
            sum_fy -= ld["F"]
            sum_m0 += ld["F"] * ld["x"]
        elif ld["kind"] == "moment":
            sum_m0 += ld["M"]
        else:
            q = density(ld)
            sum_fy -= sp.integrate(q, (X, ld["x1"], ld["x2"]))
            sum_m0 += sp.integrate(q * X, (X, ld["x1"], ld["x2"]))
    unknowns = list(unknown_R.values()) + list(unknown_M.values())
    sol = sp.solve([sum_fy, sum_m0], unknowns, dict=True)
    if len(sol) != 1 or len(sol[0]) != len(unknowns):
        raise RuntimeError("not statically determinate")
    sol = sol[0]
    reactions = {s["label"]: {"x": s["x"], "R": sp.simplify(sol[unknown_R[s["label"]]]),
                              "M": sp.simplify(sol[unknown_M[s["label"]]]) if s["label"] in unknown_M else None}
                 for s in supports}

    # --- method of sections ----------------------------------------------------------
    def section(x0, side):
        """V and M at x0; side = 'l' (left limit) or 'r' (right limit)."""
        left = (lambda xi: xi < x0) if side == "l" else (lambda xi: xi <= x0)
        V = sp.Integer(0)
        M = sp.Integer(0)
        for r in reactions.values():
            if left(r["x"]):
                V += r["R"]
                M += r["R"] * (x0 - r["x"])
                if r["M"] is not None:
                    M += r["M"]
        for ld in loads:
            if ld["kind"] == "point" and left(ld["x"]):
                V -= ld["F"]
                M -= ld["F"] * (x0 - ld["x"])
            elif ld["kind"] == "moment" and left(ld["x"]):
                M += ld["M"]
            elif ld["kind"] == "dist" and ld["x1"] < x0:
                b = sp.Min(ld["x2"], x0)
                q = density(ld)
                V -= sp.integrate(q, (X, ld["x1"], b))
                M -= sp.integrate(q * (x0 - X), (X, ld["x1"], b))
        return sp.simplify(V), sp.simplify(M)

    # breakpoints
    xs = {sp.Integer(0), L}
    xs |= {s["x"] for s in supports}
    for ld in loads:
        if ld["kind"] in ("point", "moment"):
            xs.add(ld["x"])
        else:
            xs |= {ld["x1"], ld["x2"]}
    xs = sorted(xs)

    points = []
    for x0 in xs:
        Vl, Ml = section(x0, "l")
        Vr, Mr = section(x0, "r")
        points.append({"x": x0, "Vl": Vl, "Vr": Vr, "Ml": Ml, "Mr": Mr})

    # --- extremes: inner-side limits at breakpoints + interior V = 0 --------------------
    cands_M = []  # (value, x)
    for i, p in enumerate(points):
        if i > 0:
            cands_M.append((p["Ml"], p["x"]))
        if i < len(points) - 1:
            cands_M.append((p["Mr"], p["x"]))
    t = sp.Symbol("t", real=True)
    zeros = []  # interior points where V changes sign: (x, M)
    for a, b in zip(xs[:-1], xs[1:]):
        # symbolic V(t), M(t) on the open segment (a, b): any interior t is a 'left' section
        Vt, Mt = section_symbolic(reactions, loads, t, a)
        for root in sp.solve(sp.Eq(Vt, 0), t):
            if root.is_real and a < root < b:
                # only sign changes are extrema
                eps = (b - a) / 10**9
                if sp.sign(Vt.subs(t, root - eps)) != sp.sign(Vt.subs(t, root + eps)):
                    m_root = sp.simplify(Mt.subs(t, root))
                    cands_M.append((m_root, root))
                    zeros.append((root, m_root))
    Mmax = max(cands_M, key=lambda c: (float(c[0]), -float(c[1])))
    Mmin = min(cands_M, key=lambda c: (float(c[0]), float(c[1])))

    S = lambda v: str(v) if sp.simplify(v).is_Rational else None  # exact p/q, or None if irrational
    F = lambda v: repr(float(v))
    return {
        "reactions": {k: {"R": S(v["R"]), **({"M": S(v["M"])} if v["M"] is not None else {})} for k, v in reactions.items()},
        "points": [{"x": S(p["x"]), "Vl": S(p["Vl"]), "Vr": S(p["Vr"]), "Ml": S(p["Ml"]), "Mr": S(p["Mr"])} for p in points],
        "shearZeros": [{"x": F(z[0]), "M": F(z[1]), "xExact": S(z[0]), "MExact": S(z[1])} for z in sorted(zeros, key=lambda z: float(z[0]))],
        "Mmax": {"value": F(Mmax[0]), "x": F(Mmax[1]), "exact": S(Mmax[0])},
        "Mmin": {"value": F(Mmin[0]), "x": F(Mmin[1]), "exact": S(Mmin[0])},
    }


def section_symbolic(reactions, loads, t, a):
    """V(t) and M(t) as expressions, for a section t strictly inside the segment that starts at a."""
    left = lambda xi: xi <= a  # everything at or before the segment start is left of t
    V = sp.Integer(0)
    M = sp.Integer(0)
    for r in reactions.values():
        if left(r["x"]):
            V += r["R"]
            M += r["R"] * (t - r["x"])
            if r["M"] is not None:
                M += r["M"]
    for ld in loads:
        if ld["kind"] == "point" and left(ld["x"]):
            V -= ld["F"]
            M -= ld["F"] * (t - ld["x"])
        elif ld["kind"] == "moment" and left(ld["x"]):
            M += ld["M"]
        elif ld["kind"] == "dist" and ld["x1"] <= a:
            q = density(ld)
            if ld["x2"] <= a:  # fully left of the segment
                V -= sp.integrate(q, (X, ld["x1"], ld["x2"]))
                M -= sp.integrate(q * (t - X), (X, ld["x1"], ld["x2"]))
            else:  # covers the segment: integrate up to the section
                V -= sp.integrate(q, (X, ld["x1"], t))
                M -= sp.integrate(q * (t - X), (X, ld["x1"], t))
    return sp.expand(V), sp.expand(M)


def main():
    out = Path(sys.argv[1])
    results = {}
    for path in sys.argv[2:]:
        data = json.loads(Path(path).read_text(encoding="utf8"))
        items = data.get("cases") or data.get("beams") or []
        for it in items:
            results[it["id"]] = solve_beam(it["exercise"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"tool": f"sympy {sp.__version__}", "g": "981/100", "results": results}, indent=1), encoding="utf8")
    print(f"oracle: {len(results)} beams -> {out}")


if __name__ == "__main__":
    main()
