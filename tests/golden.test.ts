import golden from './golden/golden.json';
import type { Exercise } from '../src/core/model';
import * as R from '../src/core/rational';
import { exerciseToBeam, toSI, type AnyUnit } from '../src/core/units';
import { solveAnalytic, valuesAt, type AnalyticSolution } from '../src/core/solverAnalytic';
import { extremes, keyPoints, type KeyValue } from '../src/core/keyPoints';
import { runChecks } from '../src/core/checks';

interface GoldenPoint {
  kind: 'breakpoint' | 'interior' | 'shear-zero';
  x: string;
  Vl?: string;
  Vr?: string;
  Ml?: string;
  Mr?: string;
  M?: string;
  tol?: string;
}
interface GoldenExtreme {
  value: string;
  x: string;
  tol: string;
}
interface GoldenCase {
  id: string;
  exercise: Exercise;
  expected: {
    forceUnit: AnyUnit;
    momentUnit: AnyUnit;
    reactions: Record<string, { R: string; M?: string }>;
    points: GoldenPoint[];
    Mmax?: GoldenExtreme;
    Mmin?: GoldenExtreme;
    pointValues?: Record<string, { V: string; M: string }>;
    equations?: { x1: string; x2: string; V: string[]; M: string[] }[];
  };
}

const cases = (golden as { cases: GoldenCase[] }).cases;
const P = R.parse;
const S = R.toString;

describe.each(cases.map((c) => [c.id, c] as const))('golden %s (solver A, exact)', (_id, c) => {
  const beam = exerciseToBeam(c.exercise, '9.81');
  const sol: AnalyticSolution = solveAnalytic(beam);
  const F = (s: string) => toSI(P(s), c.expected.forceUnit, '9.81');
  const M = (s: string) => toSI(P(s), c.expected.momentUnit, '9.81');
  // Extremes given with a rounding tolerance are compared in the case's display unit.
  const closeTo = (actual: KeyValue, expected: string, tol: string, unit: AnyUnit) => {
    const factor = R.toNumber(toSI(R.ONE, unit, '9.81'));
    if (R.isZero(P(tol)) && actual.exact) expect(S(actual.exact)).toBe(S(toSI(P(expected), unit, '9.81')));
    else expect(Math.abs(actual.value / factor - R.toNumber(P(expected)))).toBeLessThanOrEqual(R.toNumber(P(tol)) + 1e-12);
  };

  it('passes every global check (§5.4)', () => {
    expect(runChecks(sol)).toEqual({ ok: true, failures: [] });
  });

  it('reactions', () => {
    for (const [label, exp] of Object.entries(c.expected.reactions)) {
      const r = sol.reactions.find((x) => x.label === label);
      expect(r, `reaction ${label}`).toBeDefined();
      expect(S(r!.R)).toBe(S(F(exp.R)));
      if (exp.M !== undefined) expect(S(r!.M ?? R.ZERO)).toBe(S(M(exp.M)));
    }
    expect(sol.reactions).toHaveLength(Object.keys(c.expected.reactions).length);
  });

  it('breakpoints are exactly the critical points, with V⁻ V⁺ M⁻ M⁺', () => {
    const expBp = c.expected.points.filter((p) => p.kind === 'breakpoint');
    expect(sol.breakpoints.map((b) => S(b.x))).toEqual(expBp.map((p) => S(P(p.x))));
    for (const p of expBp) {
      const bp = sol.breakpoints.find((b) => R.eq(b.x, P(p.x)))!;
      expect([S(bp.Vl), S(bp.Vr), S(bp.Ml), S(bp.Mr)], `x = ${p.x}`).toEqual([
        S(F(p.Vl!)),
        S(F(p.Vr!)),
        S(M(p.Ml!)),
        S(M(p.Mr!)),
      ]);
    }
  });

  it('interior points (valuesAt)', () => {
    for (const p of c.expected.points.filter((q) => q.kind === 'interior')) {
      const v = valuesAt(sol, P(p.x));
      expect([S(v.Vl), S(v.Vr), S(v.Ml), S(v.Mr)]).toEqual([S(F(p.Vl!)), S(F(p.Vr!)), S(M(p.Ml!)), S(M(p.Mr!))]);
    }
  });

  it('interior V = 0 points (key points)', () => {
    const kz = keyPoints(sol).filter((k) => k.tags.includes('shear-zero'));
    const expZ = c.expected.points.filter((p) => p.kind === 'shear-zero');
    expect(kz).toHaveLength(expZ.length);
    expZ.forEach((p, i) => {
      const k = kz[i]!;
      const tol = p.tol ?? '0';
      if (R.isZero(P(tol))) expect(S(k.x.exact!)).toBe(S(P(p.x)));
      else expect(Math.abs(k.x.value - R.toNumber(P(p.x)))).toBeLessThanOrEqual(R.toNumber(P(tol)));
      closeTo(k.Ml, p.M!, tol, c.expected.momentUnit);
    });
  });

  it('extremes', () => {
    const e = extremes(sol);
    if (c.expected.Mmax) {
      closeTo(e.Mmax, c.expected.Mmax.value, c.expected.Mmax.tol, c.expected.momentUnit);
      closeTo(e.xMmax, c.expected.Mmax.x, c.expected.Mmax.tol, 'N'); // x in m (factor 1)
    }
    if (c.expected.Mmin) {
      closeTo(e.Mmin, c.expected.Mmin.value, c.expected.Mmin.tol, c.expected.momentUnit);
      closeTo(e.xMmin, c.expected.Mmin.x, c.expected.Mmin.tol, 'N');
    }
  });

  it('values at the named points (p)', () => {
    for (const [label, exp] of Object.entries(c.expected.pointValues ?? {})) {
      const pt = c.exercise.points?.find((p) => p.label === label);
      const v = valuesAt(sol, P(pt!.x));
      expect(S(v.Vl)).toBe(S(v.Vr)); // no jump at p in these cases
      expect(S(v.Vl)).toBe(S(F(exp.V)));
      expect(S(v.Ml)).toBe(S(M(exp.M)));
    }
  });

  it('segment equations V(x), M(x)', () => {
    for (const eq of c.expected.equations ?? []) {
      const seg = sol.segments.find((s) => R.eq(s.x1, P(eq.x1)) && R.eq(s.x2, P(eq.x2)));
      expect(seg, `segment (${eq.x1}, ${eq.x2})`).toBeDefined();
      // coefficients are given in kN and kN·m with x in m
      expect(seg!.V.map(S)).toEqual(eq.V.map((v) => S(F(v))));
      expect(seg!.M.map(S)).toEqual(eq.M.map((v) => S(M(v))));
    }
  });
});
