import { type AskType, type Level, generate, mulberry32 } from '../src/core/generator';
import { renderText } from '../src/core/text';
import { exerciseToBeam } from '../src/core/units';
import { verifyBeam } from '../src/core/verify';
import * as R from '../src/core/rational';
import type { Exercise } from '../src/core/model';

const P = R.parse;
const onGrid = (s: string, step: R.Rational) => R.isInteger(R.div(P(s), step));

/** Every constraint of spec §6.2, checked on the exercise data (not on the generator code). */
function checkConstraints(ex: Exercise): string[] {
  const f: string[] = [];
  const L = P(ex.beam.length);
  if (R.lt(L, R.q(2)) || R.gt(L, R.q(10)) || !onGrid(ex.beam.length, R.q(1, 2))) f.push(`L = ${ex.beam.length}`);
  const supX = ex.beam.supports.map((s) => s.x);
  for (const s of supX) if (!onGrid(s, R.q(1, 4))) f.push(`support at ${s}`);
  for (const l of ex.loads) {
    const xs = l.kind === 'point' || l.kind === 'moment' ? [l.x] : [l.x1, l.x2];
    for (const x of xs) if (!onGrid(x, R.q(1, 4))) f.push(`position ${x} off the 0.25 m grid`);
    if (l.kind === 'point') {
      if (supX.some((s) => R.eq(P(s), P(l.x)))) f.push(`point load on a support at ${l.x}`);
      if (l.unit === 'kg') {
        const v = P(l.F);
        if (!R.isInteger(R.div(v, R.q(100))) || R.lt(v, R.q(500)) || R.gt(v, R.q(8000))) f.push(`kg load ${l.F}`);
      } else if (!onGrid(l.F, R.q(1, 2)) || R.sign(P(l.F)) <= 0) f.push(`kN load ${l.F}`);
    }
    if (l.kind === 'moment') {
      if (supX.some((s) => R.eq(P(s), P(l.x)))) f.push(`moment on a support at ${l.x}`);
      if (R.isZero(P(l.x)) || R.eq(P(l.x), L)) f.push(`moment at a beam end`);
      if (!onGrid(l.M, R.q(1, 2))) f.push(`moment ${l.M}`);
      if (ex.difficulty < 3) f.push('moment below level 3');
    }
    if (l.kind === 'udl' && !onGrid(l.q, R.q(1, 2))) f.push(`q ${l.q}`);
    if (l.kind === 'linear' && (!onGrid(l.q1, R.q(1, 2)) || !onGrid(l.q2, R.q(1, 2)))) f.push(`q ${l.q1}/${l.q2}`);
    if (l.kind === 'linear' && ex.difficulty < 3) f.push('linear load below level 3');
  }
  return f;
}

describe('generator: mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('generator: reproducible from the seed', () => {
  it('same (level, seed) → identical exercise; different seeds → different exercises', () => {
    for (const level of [1, 2, 3] as Level[]) {
      const a = generate({ level, seed: 48213, cells: 2000 });
      const b = generate({ level, seed: 48213, cells: 2000 });
      expect(JSON.stringify(a.exercise)).toBe(JSON.stringify(b.exercise));
      const c = generate({ level, seed: 48214, cells: 2000 });
      expect(JSON.stringify(c.exercise)).not.toBe(JSON.stringify(a.exercise));
    }
  });
});

describe('generator: 10 000 exercises, all verified and within the constraints (phase 4 acceptance)', () => {
  const N = 10_000;
  const asks: (AskType | undefined)[] = [undefined, 'diagrams', 'point', 'mmax', 'equations'];
  it(`${N} exercises`, () => {
    const templates = new Map<string, number>();
    let nice = 0;
    for (let i = 0; i < N; i++) {
      const level = ((i % 3) + 1) as Level;
      const ask = level === 1 && asks[i % 5] === 'equations' ? undefined : asks[i % 5];
      const g = generate({ level, seed: 1_000_000 + i, ask, cells: 2000 });
      const ex = g.exercise;
      templates.set(g.template, (templates.get(g.template) ?? 0) + 1);
      // independent re-verification (A + checks + B)
      const v = verifyBeam(exerciseToBeam(ex, '9.81'), 2000);
      expect(v.failures, `${ex.id}`).toEqual([]);
      expect(checkConstraints(ex), `${ex.id}`).toEqual([]);
      expect(ex.difficulty).toBe(level);
      if (ask) {
        const key = { diagrams: 'diagrams', point: 'pointValues', mmax: 'mmax', equations: 'equations' }[ask] as keyof Exercise['ask'];
        expect(ex.ask[key]).toBeTruthy();
      }
      if (ex.ask.pointValues) {
        // p is inside the beam and not at a breakpoint (no jump there)
        const p = P(ex.points![0]!.x);
        const sol = v.a!;
        expect(sol.breakpoints.some((b) => R.eq(b.x, p))).toBe(false);
      }
      expect(ex.text?.eu.length).toBeGreaterThan(20);
      expect(ex.text?.es.length).toBeGreaterThan(20);
      const kg = R.q(981, 100);
      const isNice = v.a!.reactions.every((r) => {
        const u = ex.loads.some((l) => l.unit === 'kg') ? kg : R.q(1000);
        return R.isInteger(R.mul(R.div(r.R, u), R.q(2))) && (!r.M || R.isInteger(R.mul(R.div(r.M, u), R.q(2))));
      });
      if (isNice) nice++;
    }
    // every template is produced
    expect([...templates.keys()].sort()).toEqual(
      [
        'L1-simple',
        'L2-cantilever',
        'L2-overhang',
        'L2-ss-udl',
        'L3-cantilever-linear',
        'L3-mixed',
        'L3-moment',
        'L3-ss-linear',
        'L3-two-overhangs',
      ].sort(),
    );
    // "nice" reactions are the rule, not the exception (fallback only when none is found)
    expect(nice / N).toBeGreaterThan(0.95);
  }, 600_000); // ~1 min alone; slower when the whole suite runs in parallel
});

describe('statement text', () => {
  it('uses the decimal comma, measures x from the left end and substitutes g', () => {
    const ex = generate({ level: 1, seed: 7, ask: 'diagrams', cells: 2000 }).exercise;
    expect(ex.text!.eu).toContain('ezkerreko muturretik');
    expect(ex.text!.es).toContain('extremo izquierdo');
    expect(ex.text!.eu).not.toMatch(/\d\.\d/); // no decimal point
    const withKg = { ...ex.text!, eu: ex.text!.eu + ' Hartu g = {{g}} m/s².' };
    expect(renderText(withKg.eu, '9.81')).toContain('g = 9,81 m/s²');
    expect(renderText(withKg.eu, '10')).toContain('g = 10 m/s²');
  });
});
