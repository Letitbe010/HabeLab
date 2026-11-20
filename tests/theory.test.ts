import fc from 'fast-check';
import { TOPICS } from '../src/content/theory/topics';
import type { Bi, Block, FormulaId } from '../src/content/theory/types';
import pool from '../src/data/pool.json';
import worked from '../src/data/worked.json';
import type { Beam, Exercise } from '../src/core/model';
import { extremes } from '../src/core/keyPoints';
import * as R from '../src/core/rational';
import { solveAnalytic } from '../src/core/solverAnalytic';
import { fillTemplate, workedVars } from '../src/core/workedVars';

const exercises = (pool as { exercises: Exercise[] }).exercises;
const workedIds = (worked as { items: { id: string }[] }).items.map((w) => w.id);

/** prose of a block, both languages (formulas excluded: they are tested numerically) */
function prose(b: Block): string[] {
  switch (b.t) {
    case 'p':
    case 'note':
    case 'example':
      return [b.eu, b.es];
    case 'list':
      return [...b.eu, ...b.es];
    case 'table':
      return [...b.head, ...b.rows.flat()].flatMap((c: Bi) => [c.eu, c.es]);
    default:
      return [];
  }
}

describe('theory content (spec §12)', () => {
  it('has the 12 topics of §12.1, with unique ids and a review status', () => {
    expect(TOPICS).toHaveLength(12);
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(12);
    for (const t of TOPICS) {
      expect(['draft', 'reviewed']).toContain(t.status);
      expect(t.title.eu && t.title.es).toBeTruthy();
    }
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))('%s: both languages everywhere, lists of equal length', (_id, t) => {
    for (const b of t.blocks) {
      for (const s of prose(b)) expect(s.trim().length).toBeGreaterThan(0);
      if (b.t === 'list') expect(b.eu.length).toBe(b.es.length);
    }
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))('%s: no hard-coded numbers in the prose (§12.3)', (_id, t) => {
    for (const b of t.blocks) {
      for (const s of prose(b)) {
        const stripped = s
          .replace(/\{\{\w+\}\}/g, '')
          .replace(/\b(19|20)\d{2}(?!\d)/g, '') // years of real exams
          .replace(/(?:\b[VMqR]x?|M₀)\s?[=<>]\s?0\b/g, '') // conditions: V = 0, M > 0, Rx = 0, M₀ > 0
          .replace(/\b2?[aL]\/[234]\b|qL²\/[28]|PL\/4|Pab\/L/g, ''); // symbolic formulas
        expect(stripped, s).not.toMatch(/\d/);
      }
    }
  });

  it.each(TOPICS.map((t) => [t.id, t] as const))('%s: examples resolve from a verified pool exercise; practice links exist', (_id, t) => {
    for (const b of t.blocks) {
      if (b.t === 'example') {
        const ex = exercises.find((e) => e.id === b.pool);
        expect(ex, b.pool).toBeDefined();
        const vars = workedVars(ex!, '9.81', { force: 'kN', moment: 'kN·m', fk: 1000 });
        for (const s of [b.eu, b.es]) expect(fillTemplate(s, vars)).not.toMatch(/\{\{/);
      }
      if (b.t === 'practice' && b.worked) expect(workedIds).toContain(b.worked);
    }
  });

  it('every formula with a check id is one of the tested formulas, and all are used', () => {
    const used = TOPICS.flatMap((t) => t.blocks).filter((b): b is Extract<Block, { t: 'f' }> => b.t === 'f' && !!b.check).map((b) => b.check!);
    expect(new Set(used)).toEqual(new Set<FormulaId>(['pl4', 'pab', 'ql2', 'tri', 'cant-p', 'cant-q']));
  });
});

describe('theory formulas against the solver, 1000 random cases each (§12.1.10, §12.3)', () => {
  const ss = (L: R.Rational, loads: Beam['loads']): Beam => ({
    length: L,
    supports: [
      { id: 'a', type: 'pin', x: R.ZERO, label: 'A' },
      { id: 'b', type: 'roller', x: L, label: 'B' },
    ],
    loads,
  });
  const cant = (L: R.Rational, loads: Beam['loads']): Beam => ({ length: L, supports: [{ id: 'a', type: 'fixed', x: R.ZERO, label: 'A' }], loads });
  const Larb = fc.integer({ min: 1, max: 80 }).map((k) => R.q(k, 4));
  const Varb = fc.integer({ min: 1, max: 5000 }).map((k) => R.q(k * 10));
  const absMax = (b: Beam) => extremes(solveAnalytic(b)).absMmax;

  const checks: Record<FormulaId, () => void> = {
    pl4: () =>
      fc.assert(
        fc.property(Larb, Varb, (L, P) => {
          expect(R.toString(absMax(ss(L, [{ kind: 'point', x: R.div(L, R.q(2)), F: P }])).exact!)).toBe(R.toString(R.div(R.mul(P, L), R.q(4))));
        }),
        { numRuns: 1000 },
      ),
    pab: () =>
      fc.assert(
        fc.property(Larb, Varb, fc.integer({ min: 1, max: 99 }), (L, P, pct) => {
          const a = R.mul(L, R.q(pct, 100));
          const b = R.sub(L, a);
          expect(R.toString(absMax(ss(L, [{ kind: 'point', x: a, F: P }])).exact!)).toBe(R.toString(R.div(R.mul(R.mul(P, a), b), L)));
        }),
        { numRuns: 1000 },
      ),
    ql2: () =>
      fc.assert(
        fc.property(Larb, Varb, (L, q) => {
          expect(R.toString(absMax(ss(L, [{ kind: 'udl', x1: R.ZERO, x2: L, q }])).exact!)).toBe(R.toString(R.div(R.mul(q, R.mul(L, L)), R.q(8))));
        }),
        { numRuns: 1000 },
      ),
    tri: () =>
      fc.assert(
        fc.property(Larb, Varb, (L, q) => {
          const ref = (R.toNumber(q) * R.toNumber(L) ** 2) / (9 * Math.sqrt(3));
          expect(Math.abs(absMax(ss(L, [{ kind: 'linear', x1: R.ZERO, x2: L, q1: R.ZERO, q2: q }])).value - ref)).toBeLessThanOrEqual(1e-9 * ref);
        }),
        { numRuns: 1000 },
      ),
    'cant-p': () =>
      fc.assert(
        fc.property(Larb, Varb, (L, P) => {
          expect(R.toString(absMax(cant(L, [{ kind: 'point', x: L, F: P }])).exact!)).toBe(R.toString(R.mul(P, L)));
        }),
        { numRuns: 1000 },
      ),
    'cant-q': () =>
      fc.assert(
        fc.property(Larb, Varb, (L, q) => {
          expect(R.toString(absMax(cant(L, [{ kind: 'udl', x1: R.ZERO, x2: L, q }])).exact!)).toBe(R.toString(R.div(R.mul(q, R.mul(L, L)), R.q(2))));
        }),
        { numRuns: 1000 },
      ),
  };
  it.each(Object.keys(checks) as FormulaId[])('%s', (id) => checks[id]());
});
