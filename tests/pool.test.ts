/**
 * The exercise pool (src/data/pool.json, spec §6.1).
 *
 * GEN_POOL=1 regenerates it: the six golden cases (with their statement texts) plus 30
 * generator exercises from fixed seeds, 10 per level, covering every ask type.
 * Every pool exercise must pass solver A + global checks + solver B (here) and the
 * SymPy oracle (tests/oracle.test.ts).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import golden from './golden/golden.json';
import type { Exercise } from '../src/core/model';
import { type AskType, type Level, generate } from '../src/core/generator';
import { exerciseText } from '../src/core/text';
import { exerciseToBeam } from '../src/core/units';
import { verifyBeam } from '../src/core/verify';

const POOL = resolve(__dirname, '../src/data/pool.json');

const GOLDEN_NOTES: Record<string, string> = {
  G1: 'OPE Euskadi 2022, 4. ariketa (A aukera) / OPE Euskadi 2022, ejercicio 4 (opción A)',
};
const CLASSIC = 'Kasu klasikoa (testuliburua) / caso clásico (libro de texto)';

/** (level, seed, ask): fixed, so the pool is reproducible. */
const PLAN: [Level, number, AskType][] = [
  ...([101, 102, 103, 104, 105, 106, 107, 108, 109, 110] as const).map((s, i): [Level, number, AskType] => [
    1,
    s,
    (['diagrams', 'point', 'mmax', 'diagrams', 'point'] as const)[i % 5]!,
  ]),
  ...([201, 202, 203, 204, 205, 206, 207, 208, 209, 210] as const).map((s, i): [Level, number, AskType] => [
    2,
    s,
    (['diagrams', 'point', 'mmax', 'equations', 'diagrams'] as const)[i % 5]!,
  ]),
  ...([301, 302, 303, 304, 305, 306, 307, 308, 309, 310] as const).map((s, i): [Level, number, AskType] => [
    3,
    s,
    (['diagrams', 'mmax', 'equations', 'point', 'diagrams'] as const)[i % 5]!,
  ]),
];

if (process.env.GEN_POOL === '1') {
  const fromGolden = (golden as { cases: { id: string; exercise: Exercise }[] }).cases.map((c): Exercise => {
    const ex: Exercise = { ...c.exercise, id: `pool-${c.id}`, origin: 'pool', sourceNote: GOLDEN_NOTES[c.id] ?? CLASSIC };
    return { ...ex, text: exerciseText(ex) };
  });
  const generated = PLAN.map(([level, seed, ask]): Exercise => {
    const ex = generate({ level, seed, ask }).exercise;
    return { ...ex, id: `pool-L${level}-${seed}`, origin: 'pool' };
  });
  writeFileSync(POOL, JSON.stringify({ version: 1, exercises: [...fromGolden, ...generated] }, null, 1) + '\n');
}

describe('pool.json', () => {
  const pool = existsSync(POOL) ? (JSON.parse(readFileSync(POOL, 'utf8')) as { exercises: Exercise[] }).exercises : [];

  it('has the golden cases and 30 generated exercises, with unique ids', () => {
    expect(pool.length).toBe(36);
    expect(new Set(pool.map((e) => e.id)).size).toBe(pool.length);
    for (const level of [1, 2, 3]) expect(pool.filter((e) => e.difficulty === level).length).toBeGreaterThanOrEqual(10);
  });

  it('never claims a real exam origin except G1 (spec §6.1)', () => {
    for (const e of pool) {
      if (e.id === 'pool-G1') expect(e.sourceNote).toContain('OPE Euskadi 2022');
      else expect(e.sourceNote ?? '').not.toMatch(/OPE Euskadi \d{4}|\d{4}.*ariketa/);
    }
  });

  it('covers every ask type', () => {
    expect(pool.some((e) => e.ask.pointValues?.length)).toBe(true);
    expect(pool.some((e) => e.ask.mmax)).toBe(true);
    expect(pool.some((e) => e.ask.equations)).toBe(true);
    expect(pool.some((e) => e.ask.diagrams)).toBe(true);
  });

  it.each(pool.map((e) => [e.id, e] as const))('%s: solver A + checks + solver B (20 000 cells)', (_id, e) => {
    expect(verifyBeam(exerciseToBeam(e, '9.81')).failures).toEqual([]);
    expect(e.text?.eu).toBeTruthy();
    expect(e.text?.es).toBeTruthy();
  });

  it('generated pool entries are still what the generator produces from their seed', () => {
    for (const [level, seed, ask] of PLAN) {
      const e = pool.find((x) => x.id === `pool-L${level}-${seed}`)!;
      const g = generate({ level, seed, ask }).exercise;
      expect({ ...g, id: e.id, origin: 'pool' }).toEqual(e);
    }
  });
});
