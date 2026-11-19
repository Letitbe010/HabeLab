import fc from 'fast-check';
import * as R from '../src/core/rational';
import type { Beam } from '../src/core/model';
import { solveAnalytic, valuesAt, breakpointsOf } from '../src/core/solverAnalytic';
import { runChecks } from '../src/core/checks';
import { extremes } from '../src/core/keyPoints';
import { beamArb, mirrorBeam, scaleBeam } from './arbitraries';

const S = R.toString;
const RUNS = 10_000;

describe('solver A: properties on random isostatic beams (spec §9.4)', () => {
  it(`all global checks pass (${RUNS} beams)`, () => {
    fc.assert(
      fc.property(beamArb, (b) => {
        const r = runChecks(solveAnalytic(b));
        expect(r.failures).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });

  it('linearity: loads × k → results × k', () => {
    fc.assert(
      fc.property(beamArb, fc.integer({ min: -7, max: 9 }).filter((k) => k !== 0), (b, k) => {
        const kk = R.q(k, 3);
        const a = solveAnalytic(b);
        const s = solveAnalytic(scaleBeam(b, kk));
        a.reactions.forEach((r, i) => expect(S(s.reactions[i]!.R)).toBe(S(R.mul(r.R, kk))));
        a.breakpoints.forEach((bp, i) => {
          const t = s.breakpoints[i]!;
          expect([t.Vl, t.Vr, t.Ml, t.Mr].map(S)).toEqual([bp.Vl, bp.Vr, bp.Ml, bp.Mr].map((v) => S(R.mul(v, kk))));
        });
      }),
      { numRuns: 2000 },
    );
  });

  it('superposition: S(loads1 + loads2) = S(loads1) + S(loads2)', () => {
    fc.assert(
      fc.property(beamArb, beamArb, (b1, b2raw) => {
        // same length and supports as b1; keep only the loads of b2 that fit inside b1
        const fits = (ld: Beam['loads'][number]) =>
          (ld.kind === 'point' || ld.kind === 'moment' ? [ld.x] : [ld.x1, ld.x2]).every((x) => !R.gt(x, b1.length));
        const b2: Beam = { ...b1, loads: b2raw.loads.filter(fits) };
        const both: Beam = { ...b1, loads: [...b1.loads, ...b2.loads] };
        const s1 = solveAnalytic(b1);
        const s2 = solveAnalytic(b2);
        const s = solveAnalytic(both);
        s.reactions.forEach((r, i) => expect(S(r.R)).toBe(S(R.add(s1.reactions[i]!.R, s2.reactions[i]!.R))));
        for (const x of breakpointsOf(both)) {
          const v = valuesAt(s, x);
          const v1 = valuesAt(s1, x);
          const v2 = valuesAt(s2, x);
          expect([v.Vl, v.Vr, v.Ml, v.Mr].map(S)).toEqual(
            [R.add(v1.Vl, v2.Vl), R.add(v1.Vr, v2.Vr), R.add(v1.Ml, v2.Ml), R.add(v1.Mr, v2.Mr)].map(S),
          );
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('mirror: R swaps, V(x) → −V(L−x), M(x) → M(L−x)', () => {
    fc.assert(
      fc.property(beamArb, (b) => {
        const a = solveAnalytic(b);
        const m = solveAnalytic(mirrorBeam(b));
        for (const r of a.reactions) {
          const rm = m.reactions.find((t) => R.eq(t.x, R.sub(b.length, r.x)))!;
          expect(S(rm.R)).toBe(S(r.R));
          if (r.M) expect(S(rm.M!)).toBe(S(R.neg(r.M)));
        }
        for (const bp of a.breakpoints) {
          const t = valuesAt(m, R.sub(b.length, bp.x));
          // left and right limits swap sides in the mirror
          expect([t.Vl, t.Vr, t.Ml, t.Mr].map(S)).toEqual([R.neg(bp.Vr), R.neg(bp.Vl), bp.Mr, bp.Ml].map(S));
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('extremes bound a dense sampling of M and |V| on every segment', () => {
    fc.assert(
      fc.property(beamArb, (b) => {
        const sol = solveAnalytic(b);
        const e = extremes(sol);
        const scale = Math.max(1, Math.abs(e.Mmax.value), Math.abs(e.Mmin.value));
        const vscale = Math.max(1, e.absVmax.value);
        for (const seg of sol.segments) {
          const x1 = R.toNumber(seg.x1);
          const x2 = R.toNumber(seg.x2);
          const Mc = seg.M.map(R.toNumber);
          const Vc = seg.V.map(R.toNumber);
          const horner = (c: number[], x: number) => c.reduceRight((acc, ci) => acc * x + ci, 0);
          for (let i = 0; i <= 50; i++) {
            const x = x1 + ((x2 - x1) * i) / 50;
            const Mx = horner(Mc, x);
            expect(Mx).toBeLessThanOrEqual(e.Mmax.value + 1e-9 * scale);
            expect(Mx).toBeGreaterThanOrEqual(e.Mmin.value - 1e-9 * scale);
            expect(Math.abs(horner(Vc, x))).toBeLessThanOrEqual(e.absVmax.value + 1e-9 * vscale);
          }
        }
      }),
      { numRuns: 3000 },
    );
  });
});

describe('solver A: textbook formulas (spec §9.4, §12.1.10)', () => {
  const ss = (L: R.Rational, loads: Beam['loads']): Beam => ({
    length: L,
    supports: [
      { id: 'a', type: 'pin', x: R.ZERO, label: 'A' },
      { id: 'b', type: 'roller', x: L, label: 'B' },
    ],
    loads,
  });
  const cant = (L: R.Rational, loads: Beam['loads']): Beam => ({
    length: L,
    supports: [{ id: 'a', type: 'fixed', x: R.ZERO, label: 'A' }],
    loads,
  });
  const Larb = fc.integer({ min: 2, max: 40 }).map((k) => R.q(k, 4));
  const Parb = fc.integer({ min: 1, max: 200 }).map((k) => R.q(k * 100));

  it('P at mid-span → M_max = PL/4; P anywhere → Pab/L', () => {
    fc.assert(
      fc.property(Larb, Parb, fc.integer({ min: 1, max: 99 }), (L, P, pct) => {
        const mid = R.div(L, R.q(2));
        expect(S(extremes(solveAnalytic(ss(L, [{ kind: 'point', x: mid, F: P }]))).Mmax.exact!)).toBe(S(R.div(R.mul(P, L), R.q(4))));
        const a = R.mul(L, R.q(pct, 100));
        const bb = R.sub(L, a);
        const e = extremes(solveAnalytic(ss(L, [{ kind: 'point', x: a, F: P }])));
        expect(S(e.Mmax.exact!)).toBe(S(R.div(R.mul(R.mul(P, a), bb), L)));
        expect(S(e.xMmax.exact!)).toBe(S(a));
      }),
      { numRuns: 1000 },
    );
  });

  it('full UDL → qL²/8 at L/2', () => {
    fc.assert(
      fc.property(Larb, Parb, (L, qv) => {
        const e = extremes(solveAnalytic(ss(L, [{ kind: 'udl', x1: R.ZERO, x2: L, q: qv }])));
        expect(S(e.Mmax.exact!)).toBe(S(R.div(R.mul(qv, R.mul(L, L)), R.q(8))));
        expect(S(e.xMmax.exact!)).toBe(S(R.div(L, R.q(2))));
      }),
      { numRuns: 1000 },
    );
  });

  it('triangular 0 → q → M_max = qL²/(9√3) at L/√3', () => {
    fc.assert(
      fc.property(Larb, Parb, (L, qv) => {
        const e = extremes(solveAnalytic(ss(L, [{ kind: 'linear', x1: R.ZERO, x2: L, q1: R.ZERO, q2: qv }])));
        const Ln = R.toNumber(L);
        const qn = R.toNumber(qv);
        const ref = (qn * Ln * Ln) / (9 * Math.sqrt(3));
        expect(Math.abs(e.Mmax.value - ref)).toBeLessThanOrEqual(1e-9 * ref);
        expect(Math.abs(e.xMmax.value - Ln / Math.sqrt(3))).toBeLessThanOrEqual(1e-9 * Ln);
      }),
      { numRuns: 1000 },
    );
  });

  it('cantilever: P at the tip → −PL; full UDL → −qL²/2 (at the fixed end)', () => {
    fc.assert(
      fc.property(Larb, Parb, (L, P) => {
        const e1 = extremes(solveAnalytic(cant(L, [{ kind: 'point', x: L, F: P }])));
        expect(S(e1.Mmin.exact!)).toBe(S(R.neg(R.mul(P, L))));
        expect(S(e1.xMmin.exact!)).toBe('0');
        const e2 = extremes(solveAnalytic(cant(L, [{ kind: 'udl', x1: R.ZERO, x2: L, q: P }])));
        expect(S(e2.Mmin.exact!)).toBe(S(R.neg(R.div(R.mul(P, R.mul(L, L)), R.q(2)))));
      }),
      { numRuns: 1000 },
    );
  });
});

describe('checks detect corrupted solutions', () => {
  it('a wrong value anywhere makes runChecks fail', () => {
    const b: Beam = {
      length: R.q(4),
      supports: [
        { id: 'a', type: 'pin', x: R.ZERO, label: 'A' },
        { id: 'b', type: 'roller', x: R.q(4), label: 'B' },
      ],
      loads: [{ kind: 'point', x: R.q(1), F: R.q(19620) }],
    };
    const good = solveAnalytic(b);
    expect(runChecks(good).ok).toBe(true);
    const badR = { ...good, reactions: good.reactions.map((r, i) => (i === 0 ? { ...r, R: R.add(r.R, R.ONE) } : r)) };
    expect(runChecks(badR).ok).toBe(false);
    const badBp = { ...good, breakpoints: good.breakpoints.map((bp, i) => (i === 1 ? { ...bp, Mr: R.add(bp.Mr, R.ONE) } : bp)) };
    expect(runChecks(badBp).ok).toBe(false);
    const badSeg = { ...good, segments: good.segments.map((s, i) => (i === 0 ? { ...s, q: [R.ONE] } : s)) };
    expect(runChecks(badSeg).ok).toBe(false);
  });
});
