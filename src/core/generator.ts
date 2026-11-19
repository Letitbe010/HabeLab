/**
 * Random exercise generator (spec §6.2), reproducible from a seed (mulberry32).
 *
 * Every candidate is verified with verifyBeam (solver A + global checks + solver B);
 * a candidate that fails, or that breaks a constraint, is discarded and the next one is
 * drawn from the same random stream, so (level, seed, ask, nice) always gives the
 * same exercise.
 *
 * Constraints ("nice" OPE-style numbers):
 *  - L ∈ [2, 10] m in steps of 0.5 m; positions on a 0.25 m or 0.5 m grid.
 *  - kg loads: multiples of 100 kg in [500, 8000]; kN loads: multiples of 0.5 kN;
 *    q in kN/m: multiples of 0.5; point moments in kN·m: multiples of 0.5.
 *  - No point load or point moment on a support; no point moment at a beam end
 *    (the spec requires this at levels 1–2; it is applied at level 3 too).
 *  - Optional `nice`: redraw until every reaction (in kgf or kN, and kN·m for a fixed
 *    support) is a multiple of 0.5, as in hand-solved exam exercises.
 */

import type { Exercise, ExerciseLoad, ExerciseSupport, ForceUnit } from './model';
import * as R from './rational';
import { exerciseToBeam } from './units';
import { verifyBeam } from './verify';
import { breakpointsOf } from './solverAnalytic';
import { exerciseText } from './text';

export type AskType = 'diagrams' | 'point' | 'mmax' | 'equations';
export type Level = 1 | 2 | 3;

export interface GenOptions {
  level: Level;
  seed: number;
  ask?: AskType;
  /** Redraw until reactions are multiples of 0.5 (kgf or kN). Default true. */
  nice?: boolean;
  /** Grid of solver B used for the verification (default 20 000 cells). */
  cells?: number;
  maxAttempts?: number;
}

export interface Generated {
  exercise: Exercise;
  attempts: number;
  template: string;
}

/** mulberry32: small, fast, good enough for exercise generation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(private readonly next: () => number) {}
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(0, xs.length - 1)] as T;
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
}

/** Quarters of a metre → decimal string ("1.25"); exact, quarters are exact in binary. */
const qs = (quarters: number): string => String(quarters / 4);
/** Halves → decimal string ("2.5"). */
const hs = (halves: number): string => String(halves / 2);

interface Draft {
  template: string;
  Lq: number; // length in quarters
  supports: ExerciseSupport[];
  loads: ExerciseLoad[];
}

function forceValue(rng: Rng, unit: ForceUnit): string {
  return unit === 'kg' ? String(100 * rng.int(5, 80)) : hs(rng.int(2, 40)); // 500–8000 kg | 1–20 kN
}

/** Free positions on the grid, strictly inside (0, L) unless allowEnds, never on a support. */
function freePositions(d: Draft, step: number, allowEnds: boolean, taken: Set<number>): number[] {
  const sup = new Set(d.supports.map((s) => Math.round(Number(s.x) * 4)));
  const out: number[] = [];
  for (let p = allowEnds ? 0 : step; p <= (allowEnds ? d.Lq : d.Lq - step); p += step) {
    if (!sup.has(p) && !taken.has(p)) out.push(p);
  }
  return out;
}

function addPoints(rng: Rng, d: Draft, n: number, step: number, unit: ForceUnit, allowEnds: boolean, taken: Set<number>) {
  for (let i = 0; i < n; i++) {
    const free = freePositions(d, step, allowEnds, taken);
    if (free.length === 0) return;
    const p = rng.pick(free);
    taken.add(p);
    d.loads.push({ kind: 'point', x: qs(p), F: forceValue(rng, unit), unit });
  }
}

function range(rng: Rng, Lq: number, step: number, full: boolean): [number, number] {
  if (full) return [0, Lq];
  const a = step * rng.int(0, Lq / step - 2);
  const b = step * rng.int(a / step + 2, Lq / step);
  return [a, b];
}

const qVal = (rng: Rng) => hs(rng.int(1, 20)); // 0.5–10 kN/m

function draft(rng: Rng, level: Level): Draft {
  const Lq = 2 * rng.int(4, 20); // 2–10 m, step 0.5 m
  const step = rng.bool() ? 1 : 2; // 0.25 m or 0.5 m grid (in quarters)
  const ss = (): ExerciseSupport[] => [
    { type: 'pin', x: '0', label: 'A' },
    { type: 'roller', x: qs(Lq), label: 'B' },
  ];
  const taken = new Set<number>();

  if (level === 1) {
    const d: Draft = { template: 'L1-simple', Lq, supports: ss(), loads: [] };
    addPoints(rng, d, rng.int(1, 3), step, rng.pick(['kg', 'kN'] as const), false, taken);
    return d;
  }

  if (level === 2) {
    const t = rng.pick(['ss-udl', 'overhang', 'cantilever'] as const);
    if (t === 'ss-udl') {
      const d: Draft = { template: 'L2-ss-udl', Lq, supports: ss(), loads: [] };
      const [a, b] = range(rng, Lq, step, rng.bool());
      d.loads.push({ kind: 'udl', x1: qs(a), x2: qs(b), q: qVal(rng), unit: 'kN/m' });
      addPoints(rng, d, rng.int(0, 2), step, 'kN', false, taken);
      return d;
    }
    if (t === 'overhang') {
      const right = rng.bool(); // overhang on the right (roller inside) or on the left
      const inner = step * rng.int(Math.ceil(Lq / 2 / step), Lq / step - 1);
      const supports: ExerciseSupport[] = right
        ? [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: qs(inner), label: 'B' }]
        : [{ type: 'pin', x: qs(Lq - inner), label: 'A' }, { type: 'roller', x: qs(Lq), label: 'B' }];
      const d: Draft = { template: 'L2-overhang', Lq, supports, loads: [] };
      if (rng.bool()) {
        const [a, b] = range(rng, Lq, step, rng.bool());
        d.loads.push({ kind: 'udl', x1: qs(a), x2: qs(b), q: qVal(rng), unit: 'kN/m' });
      }
      addPoints(rng, d, rng.int(1, 2), step, 'kN', true, taken);
      return d;
    }
    const left = rng.bool();
    const d: Draft = { template: 'L2-cantilever', Lq, supports: [{ type: 'fixed', x: left ? '0' : qs(Lq), label: 'A' }], loads: [] };
    if (rng.bool()) {
      const [a, b] = range(rng, Lq, step, rng.bool());
      d.loads.push({ kind: 'udl', x1: qs(a), x2: qs(b), q: qVal(rng), unit: 'kN/m' });
    }
    addPoints(rng, d, rng.int(1, 2), step, 'kN', true, taken);
    return d;
  }

  // level 3
  const t = rng.pick(['ss-linear', 'moment', 'two-overhangs', 'cantilever-linear', 'mixed'] as const);
  const linear = (full: boolean): ExerciseLoad => {
    const [a, b] = range(rng, Lq, step, full);
    const shape = rng.pick(['up', 'down', 'trap'] as const);
    const q1 = shape === 'up' ? '0' : qVal(rng);
    const q2 = shape === 'down' ? '0' : qVal(rng);
    return { kind: 'linear', x1: qs(a), x2: qs(b), q1, q2: shape === 'trap' && q1 === q2 ? hs(Number(q1) * 2 + 1) : q2, unit: 'kN/m' };
  };
  const moment = (d: Draft) => {
    const free = freePositions(d, step, false, taken);
    if (free.length === 0) return;
    const p = rng.pick(free);
    taken.add(p);
    const m = hs(rng.int(2, 40));
    d.loads.push({ kind: 'moment', x: qs(p), M: rng.bool() ? m : `-${m}`, unit: 'kN·m' });
  };
  if (t === 'ss-linear') {
    const d: Draft = { template: 'L3-ss-linear', Lq, supports: ss(), loads: [linear(rng.bool())] };
    addPoints(rng, d, rng.int(0, 1), step, 'kN', false, taken);
    return d;
  }
  if (t === 'moment') {
    const d: Draft = { template: 'L3-moment', Lq, supports: ss(), loads: [] };
    moment(d);
    if (rng.bool()) addPoints(rng, d, 1, step, 'kN', false, taken);
    else {
      const [a, b] = range(rng, Lq, step, rng.bool());
      d.loads.push({ kind: 'udl', x1: qs(a), x2: qs(b), q: qVal(rng), unit: 'kN/m' });
    }
    return d;
  }
  if (t === 'two-overhangs') {
    const a = step * rng.int(1, Math.max(1, Math.floor(Lq / 4 / step)));
    const b = Lq - step * rng.int(1, Math.max(1, Math.floor(Lq / 4 / step)));
    const d: Draft = {
      template: 'L3-two-overhangs',
      Lq,
      supports: [{ type: 'pin', x: qs(a), label: 'A' }, { type: 'roller', x: qs(b), label: 'B' }],
      loads: [],
    };
    if (rng.bool()) d.loads.push({ kind: 'udl', x1: '0', x2: qs(Lq), q: qVal(rng), unit: 'kN/m' });
    addPoints(rng, d, rng.int(1, 3), step, 'kN', true, taken);
    return d;
  }
  if (t === 'cantilever-linear') {
    const left = rng.bool();
    const d: Draft = { template: 'L3-cantilever-linear', Lq, supports: [{ type: 'fixed', x: left ? '0' : qs(Lq), label: 'A' }], loads: [linear(rng.bool())] };
    addPoints(rng, d, rng.int(0, 1), step, 'kN', true, taken);
    return d;
  }
  const d: Draft = { template: 'L3-mixed', Lq, supports: ss(), loads: [] };
  const [a, b] = range(rng, Lq, step, false);
  d.loads.push({ kind: 'udl', x1: qs(a), x2: qs(b), q: qVal(rng), unit: 'kN/m' });
  addPoints(rng, d, 1, step, 'kN', false, taken);
  moment(d);
  return d;
}

const isHalfMultiple = (r: R.Rational) => R.isInteger(R.mul(r, R.q(2)));

/** A generated exercise is "nice" when reactions are multiples of 0.5 kgf (kg loads) or 0.5 kN. */
function reactionsAreNice(ex: Exercise, sol: NonNullable<ReturnType<typeof verifyBeam>['a']>): boolean {
  const kg = ex.loads.some((l) => l.unit === 'kg');
  const unit = kg ? R.q(981, 100) : R.q(1000);
  return sol.reactions.every((r) => isHalfMultiple(R.div(r.R, unit)) && (!r.M || isHalfMultiple(R.div(r.M, unit))));
}

export function generate(opts: GenOptions): Generated {
  const { level, seed } = opts;
  const nice = opts.nice ?? true;
  const maxAttempts = opts.maxAttempts ?? 400;
  const rng = new Rng(mulberry32(seed));
  let lastValid: Generated | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const d = draft(rng, level);
    if (d.loads.length === 0) continue;
    // statement order: by position (start of a distributed load), as a person would write it
    const at = (l: ExerciseLoad) => Number(l.kind === 'point' || l.kind === 'moment' ? l.x : l.x1);
    d.loads.sort((u, v) => at(u) - at(v));
    const askType: AskType = opts.ask ?? rng.pick(level === 1 ? (['diagrams', 'point', 'mmax'] as const) : (['diagrams', 'point', 'mmax', 'equations'] as const));
    const ex: Exercise = {
      id: `gen-${level}-${seed}`,
      origin: 'generated',
      sourceNote: 'HabeLab sorgailua, OPE estiloan / generador HabeLab, estilo OPE',
      seed,
      difficulty: level,
      beam: { length: qs(d.Lq), supports: d.supports },
      loads: d.loads,
      ask: { reactions: true, diagrams: false },
    };
    const beam = exerciseToBeam(ex, '9.81');
    const v = verifyBeam(beam, opts.cells);
    if (!v.ok || !v.a) continue; // must never happen; discarded anyway (spec §6.2)

    if (askType === 'point') {
      // p on the grid, inside the beam, not at a breakpoint (no jump: one V and one M)
      const bps = new Set(breakpointsOf(beam).map((x) => R.toString(x)));
      const cands: number[] = [];
      for (let p = 1; p < d.Lq; p++) if (!bps.has(R.toString(R.q(p, 4)))) cands.push(p);
      if (cands.length === 0) continue;
      ex.points = [{ label: 'p', x: qs(rng.pick(cands)) }];
      ex.ask = { reactions: false, diagrams: false, pointValues: ['p'] };
    } else if (askType === 'mmax') ex.ask = { reactions: true, diagrams: false, mmax: true };
    else if (askType === 'equations') ex.ask = { reactions: true, diagrams: false, equations: true };
    else ex.ask = { reactions: true, diagrams: true };
    ex.text = exerciseText(ex);

    const g: Generated = { exercise: ex, attempts: attempt, template: d.template };
    lastValid = g;
    if (!nice || reactionsAreNice(ex, v.a)) return g;
  }
  if (lastValid) return lastValid; // no "nice" candidate found: accept the last verified one
  throw new Error(`generator: no valid exercise for level ${level}, seed ${seed}`);
}
