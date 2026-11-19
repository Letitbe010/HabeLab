/**
 * Cross-check of solvers A and B against the Python/SymPy oracle (spec §9.3).
 *
 * Run the oracle first:
 *   tools/oracle/.venv/Scripts/python tools/oracle/beams.py tools/oracle/out/oracle.json \
 *     tests/golden/golden.json tests/oracle/random-beams.json
 * Locally the test is skipped if the oracle output is missing; in CI (ORACLE_REQUIRED=1)
 * a missing file is a failure.
 *
 * GEN_ORACLE_CASES=1 regenerates tests/oracle/random-beams.json (fixed seed).
 */
import fc from 'fast-check';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Beam, Exercise, ExerciseLoad } from '../src/core/model';
import * as R from '../src/core/rational';
import { exerciseToBeam } from '../src/core/units';
import { solveAnalytic } from '../src/core/solverAnalytic';
import { extremes } from '../src/core/keyPoints';
import { verifyBeam } from '../src/core/verify';
import { beamArb } from './arbitraries';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tools/oracle/out/oracle.json');
const RANDOM = resolve(ROOT, 'tests/oracle/random-beams.json');
const S = R.toString;

function beamToExercise(id: string, b: Beam): Exercise {
  const loads: ExerciseLoad[] = b.loads.map((ld) => {
    switch (ld.kind) {
      case 'point':
        return { kind: 'point', x: S(ld.x), F: S(ld.F), unit: 'N' };
      case 'moment':
        return { kind: 'moment', x: S(ld.x), M: S(ld.M), unit: 'N·m' };
      case 'udl':
        return { kind: 'udl', x1: S(ld.x1), x2: S(ld.x2), q: S(ld.q), unit: 'N/m' };
      case 'linear':
        return { kind: 'linear', x1: S(ld.x1), x2: S(ld.x2), q1: S(ld.q1), q2: S(ld.q2), unit: 'N/m' };
    }
  });
  return {
    id,
    origin: 'generated',
    difficulty: 3,
    beam: { length: S(b.length), supports: b.supports.map((s) => ({ type: s.type, x: S(s.x), label: s.label })) },
    loads,
    ask: { reactions: true, diagrams: true },
  };
}

if (process.env.GEN_ORACLE_CASES === '1') {
  const beams = fc.sample(beamArb, { seed: 20261119, numRuns: 300 });
  mkdirSync(resolve(ROOT, 'tests/oracle'), { recursive: true });
  writeFileSync(
    RANDOM,
    JSON.stringify({ seed: 20261119, beams: beams.map((b, i) => ({ id: `rnd-${i}`, exercise: beamToExercise(`rnd-${i}`, b) })) }, null, 1),
  );
}

interface OracleResult {
  reactions: Record<string, { R: string; M?: string }>;
  points: { x: string; Vl: string; Vr: string; Ml: string; Mr: string }[];
  Mmax: { value: string; x: string; exact: string | null };
  Mmin: { value: string; x: string; exact: string | null };
}

function inputs(): [string, Exercise][] {
  const g = JSON.parse(readFileSync(resolve(ROOT, 'tests/golden/golden.json'), 'utf8')) as { cases: { id: string; exercise: Exercise }[] };
  const r = JSON.parse(readFileSync(RANDOM, 'utf8')) as { beams: { id: string; exercise: Exercise }[] };
  return [...g.cases.map((c) => [c.id, c.exercise] as [string, Exercise]), ...r.beams.map((b) => [b.id, b.exercise] as [string, Exercise])];
}

const have = existsSync(OUT);
const required = process.env.ORACLE_REQUIRED === '1';

describe('oracle (SymPy) = solver A = solver B', () => {
  it('oracle output is present when required', () => {
    if (required) expect(have, `missing ${OUT}: run tools/oracle/beams.py first`).toBe(true);
  });

  const oracle: Record<string, OracleResult> = have
    ? (JSON.parse(readFileSync(OUT, 'utf8')) as { results: Record<string, OracleResult> }).results
    : {};

  it.skipIf(!have).each(have ? inputs() : [])('%s', (id, ex) => {
    const o = oracle[id];
    expect(o, `oracle has no result for ${id} (re-run it)`).toBeDefined();
    const beam = exerciseToBeam(ex, '9.81');
    const a = solveAnalytic(beam);

    // Exact equality with the oracle (both are exact rational computations).
    for (const r of a.reactions) {
      expect(S(r.R), `R_${r.label}`).toBe(o!.reactions[r.label]!.R);
      if (r.M) expect(S(r.M), `M_${r.label}`).toBe(o!.reactions[r.label]!.M);
    }
    expect(a.breakpoints.map((b) => [S(b.x), S(b.Vl), S(b.Vr), S(b.Ml), S(b.Mr)])).toEqual(
      o!.points.map((p) => [p.x, p.Vl, p.Vr, p.Ml, p.Mr]),
    );
    const e = extremes(a);
    for (const [mine, theirs] of [
      [e.Mmax, o!.Mmax],
      [e.Mmin, o!.Mmin],
    ] as const) {
      if (mine.exact && theirs.exact) expect(S(mine.exact)).toBe(theirs.exact);
      const scale = Math.max(1, Math.abs(Number(theirs.value)));
      expect(Math.abs(mine.value - Number(theirs.value))).toBeLessThanOrEqual(1e-9 * scale);
    }
    // ...and solver B agrees with A (hence with the oracle) within 1e-6·max.
    expect(verifyBeam(beam).failures).toEqual([]);
  });
});
