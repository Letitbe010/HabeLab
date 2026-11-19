import fc from 'fast-check';
import * as R from '../src/core/rational';
import type { Beam } from '../src/core/model';
import { solveAnalytic, valuesAt, type AnalyticSolution } from '../src/core/solverAnalytic';
import { extremes, type KeyValue } from '../src/core/keyPoints';
import { evalNum } from '../src/core/poly';
import { beamArb } from './arbitraries';

const S = R.toString;

const cantilever = (L: number, fixedAt: 'left' | 'right', loads: Beam['loads']): Beam => ({
  length: R.q(L),
  supports: [{ id: 'a', type: 'fixed', x: fixedAt === 'left' ? R.ZERO : R.q(L), label: 'A' }],
  loads,
});

describe('extremes: only limits inside the beam count (regressions)', () => {
  it('G3-like cantilever: Mmax = 0 is reached at the free end x = 3, not at x = 0', () => {
    const e = extremes(solveAnalytic(cantilever(3, 'left', [{ kind: 'point', x: R.q(3), F: R.q(5000) }])));
    expect([S(e.Mmax.exact!), S(e.xMmax.exact!)]).toEqual(['0', '3']);
    expect([S(e.Mmin.exact!), S(e.xMmin.exact!)]).toEqual(['-15000', '0']);
    expect([S(e.absMmax.exact!), S(e.xAbsMmax.exact!)]).toEqual(['15000', '0']);
    expect([S(e.absVmax.exact!), S(e.xAbsVmax.exact!)]).toEqual(['5000', '0']);
  });

  it('cantilever with a counter-clockwise moment at the tip: M is constant, never 0 inside the beam', () => {
    for (const side of ['left', 'right'] as const) {
      const tip = side === 'left' ? R.q(2) : R.ZERO;
      const sol = solveAnalytic(cantilever(2, side, [{ kind: 'moment', x: tip, M: R.q(-4000) }]));
      const e = extremes(sol);
      const M = S(sol.segments[0]!.M[0]!);
      expect(sol.segments[0]!.M).toHaveLength(1); // constant
      expect(S(e.Mmax.exact!)).toBe(M);
      expect(S(e.Mmin.exact!)).toBe(M);
      expect(M).not.toBe('0');
      expect(S(e.absVmax.exact!)).toBe('0');
    }
  });
});

/** Inner-side limits of the diagram at x (V⁺/M⁺ at 0, V⁻/M⁻ at L, both elsewhere). */
function innerM(sol: AnalyticSolution, x: KeyValue): number[] | R.Rational[] {
  const L = sol.beam.length;
  if (x.exact) {
    const v = valuesAt(sol, x.exact);
    if (R.isZero(x.exact)) return [v.Mr];
    if (R.eq(x.exact, L)) return [v.Ml];
    return [v.Ml, v.Mr];
  }
  const seg = sol.segments.find((s) => R.toNumber(s.x1) < x.value && x.value < R.toNumber(s.x2))!;
  return [evalNum(seg.M, x.value)];
}

describe('extremes are attained inside the beam (property)', () => {
  it('M(xMmax) = Mmax, M(xMmin) = Mmin, |M(xAbsMmax)| = |M|max', () => {
    fc.assert(
      fc.property(beamArb, (b) => {
        const sol = solveAnalytic(b);
        const e = extremes(sol);
        const L = R.toNumber(b.length);
        for (const [val, x, abs] of [
          [e.Mmax, e.xMmax, false],
          [e.Mmin, e.xMmin, false],
          [e.absMmax, e.xAbsMmax, true],
        ] as const) {
          expect(x.value).toBeGreaterThanOrEqual(0);
          expect(x.value).toBeLessThanOrEqual(L);
          const cands = innerM(sol, x);
          if (val.exact && x.exact) {
            const vs = (cands as R.Rational[]).map((c) => S(abs ? R.abs(c) : c));
            expect(vs).toContain(S(val.exact));
          } else {
            const vs = cands.map((c) => (typeof c === 'number' ? c : R.toNumber(c))).map((c) => (abs ? Math.abs(c) : c));
            const scale = Math.max(1, Math.abs(val.value));
            expect(vs.some((c) => Math.abs(c - val.value) <= 1e-9 * scale)).toBe(true);
          }
        }
      }),
      { numRuns: 3000 },
    );
  });
});
