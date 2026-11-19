import golden from './golden/golden.json';
import pool from '../src/data/pool.json';
import type { Exercise } from '../src/core/model';
import { type ModeBAnswer, type NodeRow, expectedShapes, gradeB, userCurve } from '../src/core/diagramGrader';
import { keyPoints } from '../src/core/keyPoints';
import { solveAnalytic } from '../src/core/solverAnalytic';
import { exerciseToBeam } from '../src/core/units';
import * as R from '../src/core/rational';

const cases = (golden as { cases: { id: string; exercise: Exercise }[] }).cases;
const goldenEx = (id: string) => cases.find((c) => c.id === id)!.exercise;
const asDiagrams = (ex: Exercise): Exercise => ({ ...ex, ask: { reactions: true, diagrams: true } });

/** The exact diagrams entered in the editor, as a user who solved it right would. */
function perfectB(ex: Exercise, unit: 'N' | 'kN' = 'N'): ModeBAnswer {
  const sol = solveAnalytic(exerciseToBeam(ex, '9.81'));
  const kps = keyPoints(sol);
  const k = unit === 'kN' ? 1000 : 1;
  const s = (v: number) => (v / k).toFixed(6).replace('.', ',');
  const nodes: NodeRow[] = sol.breakpoints.map((bp, i) => {
    const row: NodeRow = { x: R.toNumber(bp.x).toFixed(6), Vl: s(R.toNumber(bp.Vl)), Vr: s(R.toNumber(bp.Vr)), Ml: s(R.toNumber(bp.Ml)), Mr: s(R.toNumber(bp.Mr)) };
    const seg = sol.segments[i];
    if (seg) {
      const e = expectedShapes(seg.V, seg.M);
      row.sV = e.V;
      row.sM = e.M;
      const z = kps.find((p) => p.tags.includes('shear-zero') && p.x.value > R.toNumber(seg.x1) && p.x.value < R.toNumber(seg.x2));
      if (z) {
        row.extX = z.x.value.toFixed(6);
        row.extM = s(z.Ml.value);
      }
    }
    return row;
  });
  return {
    forceUnit: unit,
    momentUnit: unit === 'kN' ? 'kN·m' : 'N·m',
    reactions: Object.fromEntries(sol.reactions.map((r) => [r.label, { R: s(R.toNumber(r.R)), ...(r.M ? { M: s(R.toNumber(r.M)) } : {}) }])),
    nodes,
  };
}

describe('mode B: every golden and pool exercise entered with the editor scores 10 (phase 6 acceptance)', () => {
  const all = [...cases.map((c) => c.exercise), ...(pool as { exercises: Exercise[] }).exercises].map(asDiagrams);
  it.each(all.map((e) => [e.id, e] as const))('%s', (_id, ex) => {
    for (const unit of ['N', 'kN'] as const) {
      const r = gradeB(ex, perfectB(ex, unit));
      expect(r.items.filter((i) => i.status !== 'correct')).toEqual([]);
      expect(r.invalid || r.incomplete).toBe(false);
      expect(r.score).toBe(10);
    }
  });
});

describe('mode B: shapes', () => {
  it('expected shapes follow the load (G2: V linear, M ∩; G5: V ∩... parabola, M cubic)', () => {
    const s2 = solveAnalytic(exerciseToBeam(goldenEx('G2')));
    expect(expectedShapes(s2.segments[0]!.V, s2.segments[0]!.M)).toEqual({ V: 'linear', M: 'parab-down' });
    const s5 = solveAnalytic(exerciseToBeam(goldenEx('G5')));
    expect(expectedShapes(s5.segments[0]!.V, s5.segments[0]!.M)).toEqual({ V: 'parab-down', M: 'cubic' });
    const s1 = solveAnalytic(exerciseToBeam(goldenEx('G1')));
    expect(expectedShapes(s1.segments[0]!.V, s1.segments[0]!.M)).toEqual({ V: 'const', M: 'linear' });
  });
  it('wrong concavity of M (∪ instead of ∩) is wrong, and so is the sampled curve', () => {
    const ex = asDiagrams(goldenEx('G2'));
    const a = perfectB(ex, 'kN');
    a.nodes[0]!.sM = 'parab-up';
    const r = gradeB(ex, a);
    expect(r.items.find((i) => i.id.startsWith('sM:'))!.status).toBe('wrong');
    expect(r.score).toBeLessThan(10);
  });
  it('a linear M where it is a parabola: shape wrong and samples wrong even with right end values', () => {
    const ex = asDiagrams(goldenEx('G2'));
    const a = perfectB(ex, 'kN');
    a.nodes[0]!.sM = 'linear';
    const r = gradeB(ex, a);
    expect(r.items.find((i) => i.id.startsWith('sM:'))!.status).toBe('wrong');
    expect(r.items.find((i) => i.id.startsWith('qM:'))!.status).toBe('wrong');
  });
  it('the extremum is required where V = 0 inside a segment, and checked', () => {
    const ex = asDiagrams(goldenEx('G2'));
    const a = perfectB(ex, 'kN');
    a.nodes[0]!.extM = '40';
    expect(gradeB(ex, a).items.find((i) => i.id.startsWith('ext:'))!.status).toBe('wrong');
    a.nodes[0]!.extX = '';
    a.nodes[0]!.extM = '';
    expect(gradeB(ex, a).items.find((i) => i.id.startsWith('ext:'))!.status).toBe('missing');
  });
  it('an extremum given where M has none is wrong', () => {
    const ex = asDiagrams(goldenEx('G1'));
    const a = perfectB(ex);
    a.nodes[0]!.extX = '0,5';
    a.nodes[0]!.extM = '20000';
    expect(gradeB(ex, a).items.some((i) => i.id.startsWith('ext?:') && i.status === 'wrong')).toBe(true);
  });
  it('a missing node is listed; the segment across it cannot be judged', () => {
    const ex = asDiagrams(goldenEx('G1'));
    const a = perfectB(ex);
    a.nodes = a.nodes.filter((n) => Math.abs(Number(n.x) - 1) > 1e-9);
    const r = gradeB(ex, a);
    expect(r.missingPoints).toEqual([1]);
    expect(r.score).toBeLessThan(10);
  });
  it('an extra node inside a segment with right values and shape is not penalised', () => {
    const ex = asDiagrams(goldenEx('G1'));
    const a = perfectB(ex);
    // split (2, 4) at x = 3: V = −29 430 N, M = 29 430 N·m
    const i = a.nodes.findIndex((n) => Math.abs(Number(n.x) - 2) < 1e-9);
    a.nodes.splice(i + 1, 0, { x: '3', Vl: '-29430', Ml: '29430', sV: 'const', sM: 'linear' });
    expect(gradeB(ex, a).score).toBe(10);
  });
  it('nodes typed in any order are sorted by x', () => {
    const ex = asDiagrams(goldenEx('G4'));
    const a = perfectB(ex, 'kN');
    a.nodes.reverse();
    // shapes are attached to the node on the LEFT of each interval, so they move with it
    expect(gradeB(ex, a).score).toBe(10);
  });
});

describe('mode B: user curves', () => {
  it('parabola through the ends and the vertex reproduces 30x − 5x²', () => {
    const f = userCurve('parab-down', 0, 0, 6, 0, { x: 3, y: 45 })!;
    for (const x of [0, 1, 2.5, 4, 6]) expect(f(x)).toBeCloseTo(30 * x - 5 * x * x, 9);
  });
  it('cubic with zero slope at the extremum reproduces 12x − x³/3 (G5)', () => {
    const e = Math.sqrt(12);
    const f = userCurve('cubic', 0, 0, 6, 0, { x: e, y: 12 * e - e ** 3 / 3 })!;
    for (const x of [0, 1, 2, 4, 5.5]) expect(f(x)).toBeCloseTo(12 * x - x ** 3 / 3, 9);
  });
  it('a parabola without an interior extremum is not determined', () => {
    expect(userCurve('parab-up', 0, 0, 1, 1)).toBeNull();
  });
});
