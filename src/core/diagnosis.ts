/**
 * Error diagnosis (spec §8.4). When an answer is wrong, typical mistakes are tried as
 * HYPOTHESES: the exercise (or the reading of the answer) is changed the way the mistake
 * would change it, the answer is graded again, and a hypothesis is reported when it
 * explains the answer much better than the correct solution does. Results are always
 * worded as hypotheses ("dirudienez…"), never as certainties.
 *
 * A hypothesis "explains" the answer when, under it:
 *   - at least 80 % of the values the user typed are right, and
 *   - strictly more values are right than with the correct solution.
 * Hypotheses are tried in a fixed order and all that explain the answer are returned,
 * best first. Everything is deterministic and uses the same graders as the correction.
 */

import { type GradeOptions, type GradeResult, type ModeAAnswer, grade, valueOk } from './grader';
import type { Exercise, ExerciseLoad } from './model';
import { extremes, keyPoints } from './keyPoints';
import * as R from './rational';
import { type GSetting, exerciseToBeam, parseUserNumber } from './units';
import { valuesAt } from './solverAnalytic';
import { verifyBeam } from './verify';

export type HypothesisId =
  | 'units-kg'
  | 'units-1000'
  | 'units-0.001'
  | 'g-other'
  | 'v-sign'
  | 'm-sign'
  | 'reactions-swapped'
  | 'dims-cumulative-as-chained'
  | 'dims-chained-as-cumulative'
  | 'resultant-centre'
  | 'moment-jump-forgotten'
  | 'moment-reversed'
  | 'jumps-swapped'
  | 'p-neighbour';

export interface Hypothesis {
  id: HypothesisId;
  /** values typed by the user that are right under this hypothesis / values typed */
  explained: number;
  typed: number;
  /** extra data for the message (e.g. the g used, the neighbour x) */
  info?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// answer transforms
// ---------------------------------------------------------------------------

const fmt = (v: number): string => String(Math.round(v * 1e9) / 1e9);

function scaleText(s: string | undefined, k: number): string | undefined {
  if (s === undefined || s.trim() === '') return s;
  try {
    return fmt(R.toNumber(parseUserNumber(s)) * k);
  } catch {
    return s;
  }
}

/** Multiply every force-type value by kF and every moment-type value by kM (x untouched). */
export function scaleAnswer(a: ModeAAnswer, kF: number, kM: number): ModeAAnswer {
  return {
    ...a,
    reactions: a.reactions && Object.fromEntries(Object.entries(a.reactions).map(([k, r]) => [k, { R: scaleText(r.R, kF), M: scaleText(r.M, kM) }])),
    points: a.points?.map((p) => ({ ...p, Vl: scaleText(p.Vl, kF), Vr: scaleText(p.Vr, kF), Ml: scaleText(p.Ml, kM), Mr: scaleText(p.Mr, kM) })),
    pointValues:
      a.pointValues && Object.fromEntries(Object.entries(a.pointValues).map(([k, p]) => [k, { Vl: scaleText(p.Vl, kF), Vr: scaleText(p.Vr, kF), M: scaleText(p.M, kM) }])),
    mmax: a.mmax && { ...a.mmax, value: scaleText(a.mmax.value, kM) },
    equations: a.equations?.map((e) => ({ ...e, V: e.V.map((c) => scaleText(c, kF) ?? ''), M: e.M.map((c) => scaleText(c, kM) ?? '') })),
  };
}

// ---------------------------------------------------------------------------
// exercise variants
// ---------------------------------------------------------------------------

const P = (s: string) => R.parse(s);
const S = (r: R.Rational) => R.toString(r);

/** Every position of the exercise remapped by f (supports, loads, points, length). */
function remap(ex: Exercise, f: (x: R.Rational) => R.Rational): Exercise {
  const m = (s: string) => S(f(P(s)));
  return {
    ...ex,
    beam: { length: m(ex.beam.length), supports: ex.beam.supports.map((s) => ({ ...s, x: m(s.x) })) },
    loads: ex.loads.map((l): ExerciseLoad => (l.kind === 'point' || l.kind === 'moment' ? { ...l, x: m(l.x) } : { ...l, x1: m(l.x1), x2: m(l.x2) })),
    points: ex.points?.map((p) => ({ ...p, x: m(p.x) })),
  };
}

function eventPositions(ex: Exercise): R.Rational[] {
  const xs: R.Rational[] = [P(ex.beam.length), ...ex.beam.supports.map((s) => P(s.x))];
  ex.loads.forEach((l) => (l.kind === 'point' || l.kind === 'moment' ? xs.push(P(l.x)) : xs.push(P(l.x1), P(l.x2))));
  ex.points?.forEach((p) => xs.push(P(p.x)));
  const pos = xs.filter((x) => R.sign(x) > 0).sort(R.cmp);
  return pos.filter((x, i) => i === 0 || !R.eq(x, pos[i - 1]!));
}

/** The coordinates of the cumulative dimension line read as segment lengths. */
function cumulativeAsChained(ex: Exercise): Exercise | null {
  const pos = eventPositions(ex);
  const map = new Map<string, R.Rational>([['0', R.ZERO]]);
  let acc = R.ZERO;
  for (const x of pos) {
    acc = R.add(acc, x);
    map.set(S(x), acc);
  }
  return remap(ex, (x) => map.get(S(x)) ?? x);
}

/** The segment lengths of the chained dimension line read as coordinates from the origin. */
function chainedAsCumulative(ex: Exercise): Exercise | null {
  const pos = eventPositions(ex);
  const map = new Map<string, R.Rational>([['0', R.ZERO]]);
  let prev = R.ZERO;
  let last = R.ZERO;
  for (const x of pos) {
    const len = R.sub(x, prev);
    if (!R.gt(len, last) && R.sign(last) > 0) return null; // would not be increasing: not a readable mistake
    map.set(S(x), len);
    last = len;
    prev = x;
  }
  return remap(ex, (x) => map.get(S(x)) ?? x);
}

/** Linear loads replaced by a uniform load of the same total force (resultant at the centre). */
function resultantAtCentre(ex: Exercise): Exercise | null {
  if (!ex.loads.some((l) => l.kind === 'linear')) return null;
  return {
    ...ex,
    loads: ex.loads.map((l): ExerciseLoad => (l.kind === 'linear' ? { kind: 'udl', x1: l.x1, x2: l.x2, q: S(R.div(R.add(P(l.q1), P(l.q2)), R.q(2))), unit: l.unit } : l)),
  };
}

function momentsReversed(ex: Exercise): Exercise | null {
  if (!ex.loads.some((l) => l.kind === 'moment')) return null;
  return { ...ex, loads: ex.loads.map((l): ExerciseLoad => (l.kind === 'moment' ? { ...l, M: S(R.neg(P(l.M))) } : l)) };
}

// ---------------------------------------------------------------------------

/** values the user typed (not empty, not invalid) and how many of them are right */
function counts(r: GradeResult): { typed: number; right: number } {
  const its = r.items.filter((i) => i.status === 'correct' || i.status === 'wrong');
  return { typed: its.length, right: its.filter((i) => i.status === 'correct').length };
}

function safeGrade(ex: Exercise, a: ModeAAnswer, opts: GradeOptions): GradeResult | null {
  try {
    if (!verifyBeam(exerciseToBeam(ex, opts.g ?? '9.81')).ok) return null;
    return grade(ex, a, opts);
  } catch {
    return null;
  }
}

export function diagnose(ex: Exercise, ans: ModeAAnswer, opts: GradeOptions = {}): Hypothesis[] {
  const g: GSetting = opts.g ?? '9.81';
  const base = grade(ex, ans, opts);
  const b = counts(base);
  if (b.typed === 0 || b.right === b.typed) return [];
  const out: Hypothesis[] = [];
  const consider = (id: HypothesisId, r: GradeResult | null, info?: Hypothesis['info']) => {
    if (!r) return;
    const c = counts(r);
    if (c.typed > 0 && c.right > b.right && c.right >= 0.8 * c.typed) out.push({ id, explained: c.right, typed: c.typed, info });
  };
  const hasKg = ex.loads.some((l) => l.unit.startsWith('kg'));
  const gNum = R.toNumber(P(g));

  // 1. units
  if (hasKg) consider('units-kg', safeGrade(ex, scaleAnswer(ans, gNum, gNum), opts));
  consider('units-1000', safeGrade(ex, scaleAnswer(ans, 1 / 1000, 1 / 1000), opts));
  consider('units-0.001', safeGrade(ex, scaleAnswer(ans, 1000, 1000), opts));
  if (hasKg) for (const og of ['9.81', '9.8', '10'] as GSetting[]) if (og !== g) consider('g-other', safeGrade(ex, ans, { ...opts, g: og }), { g: og.replace('.', ',') });

  // 2. signs
  consider('v-sign', safeGrade(ex, ans, { ...opts, vFlip: !opts.vFlip }));
  consider('m-sign', safeGrade(ex, scaleAnswer(ans, 1, -1), opts));

  // 3. reactions swapped
  const labels = Object.keys(ans.reactions ?? {});
  if (ex.beam.supports.length === 2 && labels.length === 2) {
    const [a, c] = ex.beam.supports.map((s) => s.label) as [string, string];
    consider('reactions-swapped', safeGrade(ex, { ...ans, reactions: { [a]: ans.reactions?.[c] ?? {}, [c]: ans.reactions?.[a] ?? {} } }, opts));
  }

  // 4. dimensions misread (the user's answer is graded against the misread beam)
  const v1 = cumulativeAsChained(ex);
  if (v1) consider('dims-cumulative-as-chained', safeGrade(v1, ans, opts));
  const v2 = chainedAsCumulative(ex);
  if (v2) consider('dims-chained-as-cumulative', safeGrade(v2, ans, opts));

  // 5. resultant of a triangular load placed at the centre
  const v3 = resultantAtCentre(ex);
  if (v3) consider('resultant-centre', safeGrade(v3, ans, opts));

  // 6. point moment: jump forgotten (reactions right, M without the jump) or reversed
  const v4 = momentsReversed(ex);
  if (v4) consider('moment-reversed', safeGrade(v4, ans, opts));
  if (ex.loads.some((l) => l.kind === 'moment')) consider('moment-jump-forgotten', momentJumpForgotten(ex, opts, base));

  // 7. V⁻ and V⁺ swapped at the jumps
  if (ans.points?.some((p) => (p.Vl ?? '').trim() && (p.Vr ?? '').trim())) {
    consider('jumps-swapped', safeGrade(ex, { ...ans, points: ans.points.map((p) => ({ ...p, Vl: p.Vr, Vr: p.Vl })) }, opts));
  }

  // 8. V or M at a neighbouring critical point instead of p
  const pn = pNeighbour(ex, ans, opts);
  if (pn) out.push(pn);

  return out.sort((p, q) => q.explained / q.typed - p.explained / p.typed || q.explained - p.explained);
}

/** M values compared with "M without the jumps of the point moments" (reactions unchanged). */
function momentJumpForgotten(ex: Exercise, opts: GradeOptions, base: GradeResult): GradeResult | null {
  const beam = exerciseToBeam(ex, opts.g ?? '9.81');
  const moms = beam.loads.filter((l): l is Extract<typeof l, { kind: 'moment' }> => l.kind === 'moment');
  const shift = (x: number, side: 'l' | 'r') => moms.reduce((s, m) => (R.toNumber(m.x) < x || (side === 'r' && Math.abs(R.toNumber(m.x) - x) < 1e-12) ? s + R.toNumber(m.M) : s), 0);
  const ext = extremes(base.solution);
  const Mscale = Math.max(1e-9, ext.absMmax.value);
  const items = base.items.map((it) => {
    if (it.part !== 'M' && it.part !== 'Mp') return it;
    if (it.given === null || it.expected === null || it.x === undefined) return it;
    const side = it.id.startsWith('M-') ? 'l' : 'r';
    const alt = it.expected - shift(it.x, side);
    return { ...it, status: valueOk(it.given, alt, Mscale) ? ('correct' as const) : ('wrong' as const) };
  });
  return { ...base, items };
}

/** For a "values at p" ask: V_p / M_p equal to the values at a neighbouring key point. */
function pNeighbour(ex: Exercise, ans: ModeAAnswer, opts: GradeOptions): Hypothesis | null {
  const label = ex.ask.pointValues?.[0];
  const pt = ex.points?.find((p) => p.label === label);
  const a = label ? ans.pointValues?.[label] : undefined;
  if (!label || !pt || !a) return null;
  const v = verifyBeam(exerciseToBeam(ex, opts.g ?? '9.81'));
  if (!v.a) return null;
  const sol = v.a;
  const fF = (ans.forceUnit === 'kN' ? 1000 : 1) * (opts.vFlip ? -1 : 1);
  const fM = ans.momentUnit === 'kN·m' ? 1000 : 1;
  const num = (s?: string) => {
    try {
      return s && s.trim() ? R.toNumber(parseUserNumber(s)) : null;
    } catch {
      return null;
    }
  };
  const V = num(a.Vl ?? a.Vr);
  const M = num(a.M);
  if (V === null && M === null) return null;
  const ext = extremes(sol);
  const xp = R.toNumber(P(pt.x));
  const here = valuesAt(sol, P(pt.x));
  const rightHere =
    (V === null || valueOk(V * fF, R.toNumber(here.Vl), ext.absVmax.value)) && (M === null || valueOk(M * fM, R.toNumber(here.Ml), ext.absMmax.value));
  if (rightHere) return null;
  // nearest key points first
  const kps = keyPoints(sol)
    .filter((k) => Math.abs(k.x.value - xp) > 1e-9)
    .sort((p, q) => Math.abs(p.x.value - xp) - Math.abs(q.x.value - xp));
  for (const k of kps) {
    const vs = [k.Vl.value, k.Vr.value];
    const ms = [k.Ml.value, k.Mr.value];
    const vOk = V === null || vs.some((x) => valueOk(V * fF, x, ext.absVmax.value));
    const mOk = M === null || ms.some((x) => valueOk(M * fM, x, ext.absMmax.value));
    if (vOk && mOk) {
      const typed = (V === null ? 0 : 1) + (M === null ? 0 : 1);
      return { id: 'p-neighbour', explained: typed, typed, info: { x: String(Math.round(k.x.value * 1000) / 1000).replace('.', ',') } };
    }
  }
  return null;
}
