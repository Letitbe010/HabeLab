import golden from './golden/golden.json';
import type { Exercise } from '../src/core/model';
import type { ModeAAnswer } from '../src/core/grader';
import { type HypothesisId, diagnose, scaleAnswer } from '../src/core/diagnosis';
import { extremes, keyPoints } from '../src/core/keyPoints';
import { solveAnalytic, valuesAt } from '../src/core/solverAnalytic';
import { exerciseToBeam } from '../src/core/units';
import * as R from '../src/core/rational';

const cases = (golden as { cases: { id: string; exercise: Exercise }[] }).cases;
const G = (id: string) => cases.find((c) => c.id === id)!.exercise;
const asDiagrams = (ex: Exercise): Exercise => ({ ...ex, ask: { reactions: true, diagrams: true } });

/** Exact answer of `solved` (possibly a misread variant), typed for exercise `ex`. */
function perfect(solved: Exercise, unit: 'N' | 'kN' = 'N', g: '9.81' | '9.8' | '10' = '9.81'): ModeAAnswer {
  const sol = solveAnalytic(exerciseToBeam(solved, g));
  const k = unit === 'kN' ? 1000 : 1;
  const s = (v: number) => (v / k).toFixed(6).replace('.', ',');
  const e = extremes(sol);
  return {
    forceUnit: unit,
    momentUnit: unit === 'kN' ? 'kN·m' : 'N·m',
    reactions: Object.fromEntries(sol.reactions.map((r) => [r.label, { R: s(R.toNumber(r.R)), ...(r.M ? { M: s(R.toNumber(r.M)) } : {}) }])),
    points: keyPoints(sol).map((p) => ({ x: p.x.value.toFixed(6), Vl: s(p.Vl.value), Vr: s(p.Vr.value), Ml: s(p.Ml.value), Mr: s(p.Mr.value) })),
    pointValues: Object.fromEntries(
      (solved.points ?? []).map((p) => {
        const v = valuesAt(sol, R.parse(p.x));
        return [p.label, { Vl: s(R.toNumber(v.Vl)), M: s(R.toNumber(v.Ml)) }];
      }),
    ),
    mmax: { value: s(e.absMmax.value), x: e.xAbsMmax.value.toFixed(6) },
  };
}

const ids = (h: { id: HypothesisId }[]) => h.map((x) => x.id);

describe('diagnosis: a right answer gets no hypothesis', () => {
  it.each(cases.map((c) => [c.id, c.exercise] as const))('%s', (_id, ex) => {
    expect(diagnose(ex, perfect(ex))).toEqual([]);
    expect(diagnose(asDiagrams(ex), perfect(ex))).toEqual([]);
  });
});

describe('diagnosis: each typical mistake of spec §8.4 is recognised (spec §9.5)', () => {
  it('1a. kg not converted to N (G1, values at p in kgf)', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-3000', M: '3000' } } };
    expect(ids(diagnose(G('G1'), a))).toContain('units-kg');
  });
  it('1b. kN and N mixed up: values in N with kN selected (G2)', () => {
    const ex = asDiagrams(G('G2'));
    const a = { ...perfect(ex, 'N'), forceUnit: 'kN' as const, momentUnit: 'kN·m' as const };
    expect(ids(diagnose(ex, a))).toContain('units-1000');
  });
  it('1c. another g (10 instead of 9.81) (G1)', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-30000', M: '30000' } } };
    const h = diagnose(G('G1'), a, { g: '9.81' });
    expect(ids(h)).toContain('g-other');
    expect(h.find((x) => x.id === 'g-other')!.info).toEqual({ g: '10' });
  });
  it('2a. all V signs reversed (G1, diagrams)', () => {
    const ex = asDiagrams(G('G1'));
    const a = perfect(ex);
    a.points = a.points!.map((p) => ({ ...p, Vl: `-${p.Vl}`.replace('--', ''), Vr: `-${p.Vr}`.replace('--', '') }));
    expect(ids(diagnose(ex, a))).toContain('v-sign');
  });
  it('2b. all M signs reversed (G2)', () => {
    const ex = asDiagrams(G('G2'));
    expect(ids(diagnose(ex, scaleAnswer(perfect(ex), 1, -1)))).toContain('m-sign');
  });
  it('3. R_A and R_B swapped (G1, diagrams)', () => {
    const ex = asDiagrams(G('G1'));
    const a = perfect(ex);
    a.reactions = { A: a.reactions!.B!, B: a.reactions!.A! };
    expect(ids(diagnose(ex, a))).toContain('reactions-swapped');
  });
  it('4. cumulative dimensions read as chained (G1: 1, 2, 3, 4 m → 1, 3, 6, 10 m)', () => {
    const ex = asDiagrams(G('G1'));
    const misread: Exercise = {
      ...ex,
      beam: { length: '10', supports: [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: '10', label: 'B' }] },
      loads: [
        { kind: 'point', x: '1', F: '2000', unit: 'kg' },
        { kind: 'point', x: '3', F: '5000', unit: 'kg' },
      ],
      points: [{ label: 'p', x: '6' }],
    };
    expect(ids(diagnose(ex, perfect(misread)))).toContain('dims-cumulative-as-chained');
  });
  it('5. resultant of the triangular load at the centre (G5, reactions)', () => {
    const ex: Exercise = { ...G('G5'), ask: { reactions: true, diagrams: false, mmax: true } };
    // with the resultant (36 kN) at x = 3: R_A = R_B = 18 kN
    const a: ModeAAnswer = { forceUnit: 'kN', momentUnit: 'kN·m', reactions: { A: { R: '18' }, B: { R: '18' } }, mmax: { value: '27', x: '3' } }; // q = 6 kN/m uniform: 6·6²/8 = 27
    expect(ids(diagnose(ex, a))).toContain('resultant-centre');
  });
  it('6a. point moment reversed (G6)', () => {
    const ex = asDiagrams(G('G6'));
    const rev: Exercise = { ...ex, loads: [{ kind: 'moment', x: '1', M: '-8', unit: 'kN·m' }] };
    expect(ids(diagnose(ex, perfect(rev, 'kN')))).toContain('moment-reversed');
  });
  it('6b. jump of the point moment forgotten in M (G6: reactions right, M = −2x everywhere)', () => {
    const ex = asDiagrams(G('G6'));
    const a: ModeAAnswer = {
      forceUnit: 'kN',
      momentUnit: 'kN·m',
      reactions: { A: { R: '-2' }, B: { R: '2' } },
      points: [
        { x: '0', Vr: '-2', Mr: '0' },
        { x: '1', Vl: '-2', Ml: '-2', Mr: '-2' },
        { x: '4', Vl: '-2', Ml: '-8' },
      ],
    };
    expect(ids(diagnose(ex, a))).toContain('moment-jump-forgotten');
  });
  it('7. V⁻ and V⁺ swapped at the point loads (G1)', () => {
    const ex = asDiagrams(G('G1'));
    const a = perfect(ex);
    a.points = a.points!.map((p) => ({ ...p, Vl: p.Vr, Vr: p.Vl }));
    expect(ids(diagnose(ex, a))).toContain('jumps-swapped');
  });
  it('8. values taken at a neighbouring critical point instead of p (G1: M at x = 2)', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-29430', M: '58860' } } };
    const h = diagnose(G('G1'), a);
    expect(ids(h)).toContain('p-neighbour');
    expect(h.find((x) => x.id === 'p-neighbour')!.info).toEqual({ x: '2' });
  });
  it('an unrelated wrong answer gets no hypothesis', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '123', M: '-777' } } };
    expect(diagnose(G('G1'), a)).toEqual([]);
  });
});
