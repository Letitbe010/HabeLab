import golden from './golden/golden.json';
import pool from '../src/data/pool.json';
import type { Exercise } from '../src/core/model';
import { type ModeAAnswer, grade } from '../src/core/grader';
import { extremes, keyPoints } from '../src/core/keyPoints';
import { solveAnalytic, valuesAt } from '../src/core/solverAnalytic';
import { exerciseToBeam } from '../src/core/units';
import * as R from '../src/core/rational';

const cases = (golden as { cases: { id: string; exercise: Exercise }[] }).cases;
const goldenEx = (id: string) => cases.find((c) => c.id === id)!.exercise;
const asDiagrams = (ex: Exercise): Exercise => ({ ...ex, ask: { reactions: true, diagrams: true } });

/** The exact solution typed as a user would, in N/N·m or kN/kN·m. */
function perfect(ex: Exercise, unit: 'N' | 'kN' = 'N', digits = 6): ModeAAnswer {
  const sol = solveAnalytic(exerciseToBeam(ex, '9.81'));
  const k = unit === 'kN' ? 1000 : 1;
  const s = (v: number) => (v / k).toFixed(digits).replace('.', ',');
  const ans: ModeAAnswer = { forceUnit: unit, momentUnit: unit === 'kN' ? 'kN·m' : 'N·m' };
  ans.reactions = Object.fromEntries(
    sol.reactions.map((r) => [r.label, { R: s(R.toNumber(r.R)), ...(r.M ? { M: s(R.toNumber(r.M)) } : {}) }]),
  );
  ans.points = keyPoints(sol).map((p) => ({ x: p.x.value.toFixed(6), Vl: s(p.Vl.value), Vr: s(p.Vr.value), Ml: s(p.Ml.value), Mr: s(p.Mr.value) }));
  ans.pointValues = Object.fromEntries(
    (ex.points ?? []).map((p) => {
      const v = valuesAt(sol, R.parse(p.x));
      return [p.label, { Vl: s(R.toNumber(v.Vl)), Vr: s(R.toNumber(v.Vr)), M: s(R.toNumber(v.Ml)) }];
    }),
  );
  const e = extremes(sol);
  ans.mmax = { value: s(e.absMmax.value), x: e.xAbsMmax.value.toFixed(6) };
  ans.equations = sol.segments.map((sg) => ({
    x1: R.toString(sg.x1),
    x2: R.toString(sg.x2),
    V: sg.V.length ? sg.V.map((c) => s(R.toNumber(c))) : ['0'], // V ≡ 0: the user types 0
    M: sg.M.length ? sg.M.map((c) => s(R.toNumber(c))) : ['0'],
  }));
  return ans;
}

describe('grader: a correct answer scores 10 (spec §9.5)', () => {
  const all = [...cases.map((c) => c.exercise), ...(pool as { exercises: Exercise[] }).exercises];
  it.each(all.map((e) => [e.id, e] as const))('%s (as asked, and as reactions + diagrams), in N and in kN', (_id, ex) => {
    for (const unit of ['N', 'kN'] as const) {
      const r1 = grade(ex, perfect(ex, unit));
      expect(r1.invalid).toBe(false);
      expect(r1.items.filter((i) => i.status !== 'correct')).toEqual([]);
      expect(r1.score).toBe(10);
      const d = asDiagrams(ex);
      expect(grade(d, perfect(d, unit)).score).toBe(10);
    }
  });
});

describe('grader: G1 (OPE Euskadi 2022), values at p', () => {
  const ex = goldenEx('G1');
  it('V_p = −29 430 N and M_p = 29 430 N·m → 10; kN accepted', () => {
    expect(grade(ex, { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-29430', M: '29430' } } }).score).toBe(10);
    expect(grade(ex, { forceUnit: 'kN', momentUnit: 'kN·m', pointValues: { p: { Vl: '-29,43', M: '29,43' } } }).score).toBe(10);
  });
  it('|V_p| without sign is wrong under the default convention, right with the alternative one', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '29430', M: '29430' } } };
    expect(grade(ex, a).score).toBe(5);
    expect(grade(ex, a, { vFlip: true }).score).toBe(10);
  });
  it('kgf instead of N (no conversion) is wrong', () => {
    const r = grade(ex, { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-3000', M: '3000' } } });
    expect(r.score).toBe(0);
  });
  it('the value of g follows the setting', () => {
    const a: ModeAAnswer = { forceUnit: 'N', momentUnit: 'N·m', pointValues: { p: { Vl: '-30000', M: '30000' } } };
    expect(grade(ex, a, { g: '10' }).score).toBe(10);
    expect(grade(ex, a, { g: '9.81' }).score).toBe(0); // 1.9 % off
  });
});

describe('grader: tolerances (spec §8.1, §9.5)', () => {
  const ex = asDiagrams(goldenEx('G2')); // R = 30 kN, M_max = 45 kN·m
  const base = () => perfect(ex, 'kN');
  it('0.99 % off → correct; 1.5 % off → wrong (on the largest value, so the absolute rule does not apply)', () => {
    const a = base();
    a.reactions!.A!.R = String(30 * 1.0099).replace('.', ',');
    expect(grade(ex, a).items.find((i) => i.id === 'R:A')!.status).toBe('correct');
    a.reactions!.A!.R = String(30 * 1.015).replace('.', ',');
    expect(grade(ex, a).items.find((i) => i.id === 'R:A')!.status).toBe('wrong');
  });
  it('near zero the absolute rule (0.5 % of max |M|) applies', () => {
    const a = base();
    const row = a.points!.find((p) => Number(p.x) === 0)!;
    row.Mr = '0,2'; // |0.2| ≤ 0.005·45 = 0.225 kN·m
    expect(grade(ex, a).items.find((i) => i.part === 'M' && i.x === 0)!.status).toBe('correct');
    row.Mr = '0,3';
    expect(grade(ex, a).items.find((i) => i.part === 'M' && i.x === 0)!.status).toBe('wrong');
  });
  it('x of the V = 0 point: ±0.02 m accepted, 0.05 m not', () => {
    const a = base();
    const row = a.points!.find((p) => Math.abs(Number(p.x) - 3) < 1e-9)!;
    row.x = '3,02';
    let r = grade(ex, a);
    expect(r.missingPoints).toEqual([]);
    row.x = '3,05';
    r = grade(ex, a);
    expect(r.missingPoints).toEqual([3]);
  });
});

describe('grader: missing, extra and invalid input', () => {
  const ex = asDiagrams(goldenEx('G1'));
  it('a missing key point is listed and lowers V and M, not the reactions', () => {
    const a = perfect(ex);
    a.points = a.points!.filter((p) => Math.abs(Number(p.x) - 1) > 1e-9);
    const r = grade(ex, a);
    expect(r.missingPoints).toEqual([1]);
    expect(r.parts.find((p) => p.key === 'reactions')!.ratio).toBe(1);
    expect(r.parts.find((p) => p.key === 'V')!.ratio).toBeLessThan(1);
    expect(r.score).toBeLessThan(10);
  });
  it('an extra point with right values is not penalised; with wrong values it is', () => {
    const a = perfect(ex);
    a.points!.push({ x: '3', Vl: '-29430', Ml: '29430' });
    expect(grade(ex, a).score).toBe(10);
    a.points![a.points!.length - 1] = { x: '3', Vl: '-29430', Ml: '20000' };
    expect(grade(ex, a).score).toBeLessThan(10);
  });
  it('a jump needs both V⁻ and V⁺; a single value is accepted where there is no jump', () => {
    const a = perfect(ex);
    const at1 = a.points!.find((p) => Number(p.x) === 1)!;
    at1.Vr = '';
    const r = grade(ex, a);
    expect(r.items.find((i) => i.id.startsWith('V+:1.0000'))!.status).toBe('missing');
  });
  it('uninterpretable text is "invalid" and flags the result', () => {
    const a = perfect(ex);
    a.reactions!.A!.R = '39,,24';
    const r = grade(ex, a);
    expect(r.invalid).toBe(true);
    expect(r.items.find((i) => i.id === 'R:A')!.status).toBe('invalid');
  });
});

describe('grader: |M|max and position', () => {
  const ex = { ...goldenEx('G3'), ask: { reactions: true, diagrams: false, mmax: true } }; // cantilever, |M|max = 15 kN·m at 0
  it('sign of M_max is not required; x must be where |M| is maximal', () => {
    const a: ModeAAnswer = { forceUnit: 'kN', momentUnit: 'kN·m', reactions: { A: { R: '5', M: '-15' } }, mmax: { value: '-15', x: '0' } };
    expect(grade(ex, a).score).toBe(10);
    a.mmax = { value: '15', x: '3' };
    const r = grade(ex, a);
    expect(r.items.find((i) => i.id === 'xmax')!.status).toBe('wrong');
  });
});
