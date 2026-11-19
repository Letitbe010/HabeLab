import fc from 'fast-check';
import golden from './golden/golden.json';
import type { Beam, Exercise } from '../src/core/model';
import * as R from '../src/core/rational';
import { exerciseToBeam } from '../src/core/units';
import { solveAnalytic } from '../src/core/solverAnalytic';
import { compareAB, verifyBeam } from '../src/core/verify';
import { solveNumeric } from '../src/core/solverNumeric';
import { beamArb, beamArbWide } from './arbitraries';
import { runChecks } from '../src/core/checks';

const cases = (golden as { cases: { id: string; exercise: Exercise }[] }).cases;

describe('solver B agrees with solver A on the golden cases (|A − B| ≤ 1e-6·max)', () => {
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const v = verifyBeam(exerciseToBeam(c.exercise, '9.81'));
    expect(v.failures).toEqual([]);
  });
});

describe('solver B vs A on random beams (spec §9.4)', () => {
  it('10 000 random beams agree (coarser grid of 2 000 cells for speed)', () => {
    // The comparison is at nodes that are exact jump points; with Simpson's rule the
    // node values do not depend on the grid size, only the sampled extremes do
    // (error ≈ q·h²/8, far below 1e-6·max with 2 000 cells).
    fc.assert(
      fc.property(beamArb, (b) => {
        expect(verifyBeam(b, 2000).failures).toEqual([]);
      }),
      { numRuns: 10_000 },
    );
  });
  it('300 random beams agree with the full 20 000-cell grid', () => {
    fc.assert(
      fc.property(beamArb, (b) => {
        expect(verifyBeam(b).failures).toEqual([]);
      }),
      { numRuns: 300 },
    );
  });
});

describe('beyond the generator limits (twelfths of a metre, L ≤ 20 m, |loads| ≤ 1e6)', () => {
  it('2 000 wide random beams: checks pass and A = B', () => {
    fc.assert(
      fc.property(beamArbWide, (b) => {
        expect(runChecks(solveAnalytic(b)).failures).toEqual([]);
        expect(verifyBeam(b, 2000).failures).toEqual([]);
      }),
      { numRuns: 2000 },
    );
  });
});

describe('the comparison catches a wrong solver', () => {
  const b: Beam = {
    length: R.q(6),
    supports: [
      { id: 'a', type: 'pin', x: R.ZERO, label: 'A' },
      { id: 'b', type: 'roller', x: R.q(4), label: 'B' },
    ],
    loads: [
      { kind: 'linear', x1: R.q(1), x2: R.q(6), q1: R.q(2000), q2: R.q(-1000) },
      { kind: 'moment', x: R.q(5), M: R.q(3000) },
    ],
  };
  it('perturbing one B value by 1e-5·max is detected', () => {
    const a = solveAnalytic(b);
    const nb = solveNumeric(b);
    expect(compareAB(a, nb)).toEqual([]);
    const maxM = Math.max(...nb.Ml.map(Math.abs));
    const nodeAtBp = nb.xs.findIndex((x) => x === 4);
    const bad = { ...nb, Mr: nb.Mr.map((m, k) => (k === nodeAtBp ? m + 1e-5 * maxM : m)) };
    expect(compareAB(a, bad).length).toBeGreaterThan(0);
  });
  it('B with the moment sign flipped disagrees', () => {
    const flipped: Beam = { ...b, loads: b.loads.map((l) => (l.kind === 'moment' ? { ...l, M: R.neg(l.M) } : l)) };
    expect(compareAB(solveAnalytic(b), solveNumeric(flipped)).length).toBeGreaterThan(0);
  });
});
