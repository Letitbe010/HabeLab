import * as R from '../src/core/rational';
import type { Beam } from '../src/core/model';
import { solveAnalytic } from '../src/core/solverAnalytic';

/**
 * Convention confirmed by the user on 2026-11-19: the reaction moment of a fixed support
 * ("M_landaketa") is reported with the same sign as applied point moments, CLOCKWISE > 0.
 * For a left-end cantilever it equals M(0⁺); for a right-end one it equals −M(L⁻).
 */
const S = R.toString;
const cant = (fixedX: number, loadX: number): Beam => ({
  length: R.q(3),
  supports: [{ id: 'a', type: 'fixed', x: R.q(fixedX), label: 'A' }],
  loads: [{ kind: 'point', x: R.q(loadX), F: R.q(5000) }],
});

describe('reaction moment of a fixed support: clockwise > 0', () => {
  it('fixed at the left, P at the tip: M_A = −15 kN·m (counter-clockwise) = M(0⁺)', () => {
    const sol = solveAnalytic(cant(0, 3));
    expect(S(sol.reactions[0]!.M!)).toBe('-15000');
    expect(S(sol.breakpoints[0]!.Mr)).toBe('-15000');
  });
  it('fixed at the right, P at the tip: M_A = +15 kN·m (clockwise) = −M(L⁻)', () => {
    const sol = solveAnalytic(cant(3, 0));
    expect(S(sol.reactions[0]!.M!)).toBe('15000');
    expect(S(sol.breakpoints.at(-1)!.Ml)).toBe('-15000');
  });
});
