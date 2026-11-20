import worked from '../src/data/worked.json';
import pool from '../src/data/pool.json';
import type { Exercise } from '../src/core/model';
import { fillTemplate, workedVars } from '../src/core/workedVars';
import { exerciseToBeam } from '../src/core/units';
import { verifyBeam } from '../src/core/verify';

interface Bi {
  eu: string;
  es: string;
}
interface WorkedItem {
  id: string;
  pool: string;
  status: 'draft' | 'reviewed';
  support: string;
  load: string;
  title: Bi;
  intro: Bi;
  careful?: Record<string, Bi>;
  why?: Record<string, Bi>;
  ope?: Bi;
}
const items = (worked as unknown as { items: WorkedItem[] }).items;
const exercises = (pool as { exercises: Exercise[] }).exercises;

/** every text of an item (both languages) */
const texts = (w: WorkedItem): string[] =>
  [w.title, w.intro, ...Object.values(w.careful ?? {}), ...Object.values(w.why ?? {}), ...(w.ope ? [w.ope] : [])].flatMap((b) => [b.eu, b.es]);

describe('worked exercises (spec §13)', () => {
  it('there are at least 12, with unique ids, covering every typology of §13.1', () => {
    expect(items.length).toBeGreaterThanOrEqual(12);
    expect(new Set(items.map((w) => w.id)).size).toBe(items.length);
    for (const s of ['simple', 'overhang', 'cantilever']) expect(items.some((w) => w.support === s)).toBe(true);
    for (const l of ['point', 'udl', 'linear', 'moment', 'mixed']) expect(items.some((w) => w.load === l)).toBe(true);
  });

  it.each(items.map((w) => [w.id, w] as const))('%s: based on a verified pool exercise (A + checks + B)', (_id, w) => {
    const ex = exercises.find((e) => e.id === w.pool);
    expect(ex, `pool exercise ${w.pool}`).toBeDefined();
    expect(verifyBeam(exerciseToBeam(ex!, '9.81')).ok).toBe(true);
    expect(['draft', 'reviewed']).toContain(w.status);
  });

  it.each(items.map((w) => [w.id, w] as const))('%s: both languages, every {{variable}} resolves', (_id, w) => {
    const ex = exercises.find((e) => e.id === w.pool)!;
    const vars = workedVars(ex, '9.81', { force: 'kN', moment: 'kN·m', fk: 1000 });
    for (const t of texts(w)) {
      expect(t.trim().length).toBeGreaterThan(0);
      expect(fillTemplate(t, vars), t).not.toMatch(/\{\{/);
    }
  });

  it.each(items.map((w) => [w.id, w] as const))('%s: no hard-coded numbers in the texts (spec §13.3)', (_id, w) => {
    for (const t of texts(w)) {
      const stripped = t
        .replace(/\{\{\w+\}\}/g, '') // solver values
        .replace(/\b(19|20)\d{2}(?!\d)/g, '') // years of real exams ("2022ko")
        .replace(/\b[VM]\s?=\s?0\b/g, '') // conceptual conditions: V = 0, M = 0
        .replace(/\b2?L\/[234]\b|qL²\/[28]|PL\/4|Pab\/L/g, ''); // symbolic formulas
      expect(stripped, t).not.toMatch(/\d/);
    }
  });

  it('variables carry the solver values (G1: R_A = 39 240 N, M_p = 29 430 N·m)', () => {
    const ex = exercises.find((e) => e.id === 'pool-G1')!;
    const v = workedVars(ex, '9.81', { force: 'N', moment: 'N·m', fk: 1 });
    expect(v.R_A).toBe('39 240 N');
    expect(v.Mp).toBe('29 430 N·m');
    expect(v.xp).toBe('3');
    const g5 = workedVars(exercises.find((e) => e.id === 'pool-G5')!, '9.81', { force: 'kN', moment: 'kN·m', fk: 1000 });
    expect(g5.W1).toBe('36 kN');
    expect(g5.xW1).toBe('4');
  });
});
