/**
 * Mode B: structured diagram builder (spec §7.2) and its grader (spec §8.2).
 *
 * The user describes each diagram with NODES (x and the left/right values of V and M) and,
 * for the interval from each node to the next one, a SHAPE:
 *   V: constant | linear | parabola (concave up ∪ / down ∩)
 *   M: linear | parabola (∪ / ∩) | cubic, plus an optional interior extremum (x, M).
 * Freehand drawing is deliberately not offered: it cannot be graded reliably.
 *
 * What is graded (all against solver A):
 *  - nodes: every breakpoint present (missing ones listed; extra nodes are not penalised
 *    when their values are right), V⁻ V⁺ M⁻ M⁺ with the §8.1 tolerances;
 *  - shape of every solver segment: degree and, for parabolas, concavity
 *    (V'' = −q', M'' = −q: a downward load gives M concave down ∩);
 *  - extremum: where V changes sign inside a segment, the user must give (x, M) there;
 *  - sampling: where the user's curve is fully determined (constant, linear, or an M
 *    parabola/cubic with its interior extremum), it is evaluated at 51 points and compared
 *    with the exact one, to catch "right shape, wrong values". A parabola without an
 *    interior extremum is not determined by its end values, so it is checked by shape only.
 *
 * Scoring: reactions 20 %, V 30 %, M 50 % (same split as mode A, §8.3); inside V and M,
 * proportion of correct items (values, shapes, samples, extremum).
 */

import type { Exercise } from './model';
import { type GradeOptions, type Part, type Status, positionTol, valueOk } from './grader';
import { type KeyPoint, extremes, keyPoints } from './keyPoints';
import { coef, degree, evalNum } from './poly';
import * as R from './rational';
import type { AnalyticSolution } from './solverAnalytic';
import { exerciseToBeam, factorToSI, parseUserNumber } from './units';
import { verifyBeam } from './verify';

export type VShape = 'const' | 'linear' | 'parab-up' | 'parab-down';
export type MShape = 'linear' | 'parab-up' | 'parab-down' | 'cubic';

export interface NodeRow {
  x: string;
  Vl?: string;
  Vr?: string;
  Ml?: string;
  Mr?: string;
  /** shape of the interval from this node to the next one (by x) */
  sV?: VShape | '';
  sM?: MShape | '';
  /** optional interior extremum of M in that interval */
  extX?: string;
  extM?: string;
}

export interface ModeBAnswer {
  forceUnit: 'N' | 'kN';
  momentUnit: 'N·m' | 'kN·m';
  reactions?: Record<string, { R?: string; M?: string }>;
  nodes: NodeRow[];
}

export type BPart = 'reactions' | 'V' | 'M';

export interface BItem {
  part: BPart;
  id: string;
  status: Status;
  expected: number | null;
  given: number | null;
  x?: number;
  extra?: boolean;
  /** for shape items: the expected shape */
  expectedShape?: string;
  givenShape?: string;
}

export interface BResult {
  items: BItem[];
  parts: Part[];
  score: number;
  invalid: boolean;
  incomplete: boolean;
  missingPoints: number[];
  solution: AnalyticSolution;
}

// ---------------------------------------------------------------------------

const num = (s: string | undefined): number | null | 'invalid' => {
  if (s === undefined || s.trim() === '') return null;
  try {
    return R.toNumber(parseUserNumber(s));
  } catch {
    return 'invalid';
  }
};

const has = (s?: string) => s !== undefined && s.trim() !== '';

/** Expected shapes of a solver segment. */
export function expectedShapes(V: readonly R.Rational[], M: readonly R.Rational[]): { V: VShape; M: MShape } {
  const dV = degree(V);
  const dM = degree(M);
  const v: VShape = dV <= 0 ? 'const' : dV === 1 ? 'linear' : R.sign(coef(V, 2)) > 0 ? 'parab-up' : 'parab-down';
  const m: MShape = dM <= 1 ? 'linear' : dM === 2 ? (R.sign(coef(M, 2)) > 0 ? 'parab-up' : 'parab-down') : 'cubic';
  return { V: v, M: m };
}

/** A user curve on one interval, as a function of x when it is fully determined, else null. */
export function userCurve(
  shape: VShape | MShape | '' | undefined,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ext?: { x: number; y: number },
): ((x: number) => number) | null {
  const lin = (x: number) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
  if (shape === 'const') return Math.abs(y1 - y2) <= 1e-12 * Math.max(1, Math.abs(y1)) ? () => y1 : null;
  if (shape === 'linear') return lin;
  if (!ext || !(ext.x > x1 && ext.x < x2)) return null;
  if (shape === 'parab-up' || shape === 'parab-down') {
    // parabola through the two ends and the extremum point (Lagrange)
    const [a, b, c] = [x1, ext.x, x2];
    return (x) =>
      (y1 * (x - b) * (x - c)) / ((a - b) * (a - c)) + (ext.y * (x - a) * (x - c)) / ((b - a) * (b - c)) + (y2 * (x - a) * (x - b)) / ((c - a) * (c - b));
  }
  if (shape === 'cubic') {
    // cubic with the two end values, value ext.y at ext.x and zero slope there (4 conditions)
    // Write p(x) = ext.y + (x − e)² (α + β (x − e)); solve α, β from the two ends.
    const e = ext.x;
    const d1 = x1 - e;
    const d2 = x2 - e;
    // y1 − ye = d1² (α + β d1);  y2 − ye = d2² (α + β d2)
    const r1 = (y1 - ext.y) / (d1 * d1);
    const r2 = (y2 - ext.y) / (d2 * d2);
    const beta = (r2 - r1) / (d2 - d1);
    const alpha = r1 - beta * d1;
    return (x) => ext.y + (x - e) * (x - e) * (alpha + beta * (x - e));
  }
  return null;
}

// ---------------------------------------------------------------------------

export function gradeB(ex: Exercise, ans: ModeBAnswer, opts: GradeOptions = {}): BResult {
  const g = opts.g ?? '9.81';
  const v = verifyBeam(exerciseToBeam(ex, g));
  if (!v.ok || !v.a) throw new Error(`gradeB: the exercise did not pass verification (${v.failures.join('; ')})`);
  const sol = v.a;
  const kps: KeyPoint[] = keyPoints(sol);
  const ext = extremes(sol, kps);
  const L = R.toNumber(sol.beam.length);
  const fF = R.toNumber(factorToSI(ans.forceUnit, g)) * (opts.vFlip ? -1 : 1);
  const fRe = R.toNumber(factorToSI(ans.forceUnit, g));
  const fM = R.toNumber(factorToSI(ans.momentUnit, g));
  const Vscale = Math.max(1e-9, ext.absVmax.value);
  const Rscale = Math.max(Vscale, ...sol.reactions.map((r) => Math.abs(R.toNumber(r.R))));
  const Mscale = Math.max(1e-9, ext.absMmax.value);
  const items: BItem[] = [];
  let invalid = false;
  let incomplete = false;

  const judge = (part: BPart, id: string, raw: string | undefined, expected: number, f: number, scale: number, extra: Partial<BItem> = {}, standalone = false): BItem => {
    const p = num(raw);
    if (p === 'invalid') {
      invalid = true;
      return { part, id, status: 'invalid', expected, given: null, ...extra };
    }
    if (p === null) {
      if (standalone) incomplete = true;
      return { part, id, status: 'missing', expected, given: null, ...extra };
    }
    const given = p * f;
    return { part, id, status: valueOk(given, expected, scale) ? 'correct' : 'wrong', expected, given, ...extra };
  };

  // --- reactions ---------------------------------------------------------------------
  if (ex.ask.reactions) {
    for (const r of sol.reactions) {
      const a = ans.reactions?.[r.label];
      items.push(judge('reactions', `R:${r.label}`, a?.R, R.toNumber(r.R), fRe, Rscale, { x: R.toNumber(r.x) }, true));
      if (r.M) items.push(judge('reactions', `M:${r.label}`, a?.M, R.toNumber(r.M), fM, Mscale, { x: R.toNumber(r.x) }, true));
    }
  }

  // --- nodes: parse, sort, match to breakpoints -----------------------------------------
  type N = { row: NodeRow; x: number };
  const nodes: N[] = [];
  for (const row of ans.nodes) {
    const x = num(row.x);
    if (x === 'invalid') {
      invalid = true;
      continue;
    }
    if (x === null) {
      if ([row.Vl, row.Vr, row.Ml, row.Mr, row.extX, row.extM].some(has)) incomplete = true;
      continue;
    }
    nodes.push({ row, x });
  }
  nodes.sort((p, q) => p.x - q.x);

  const bps = sol.breakpoints.map((b) => ({ b, x: R.toNumber(b.x) }));
  const tol = positionTol(L);
  const matched = new Map<number, N>(); // breakpoint index → node
  const extras: N[] = [];
  for (const n of nodes) {
    let best = -1;
    let bestD = Infinity;
    bps.forEach((bp, i) => {
      const d = Math.abs(bp.x - n.x);
      if (d <= tol && d < bestD && !matched.has(i)) [best, bestD] = [i, d];
    });
    if (best >= 0) matched.set(best, n);
    else extras.push(n);
  }

  /** value items at one node: only limits inside the beam; one value when no jump */
  const nodeItems = (x: number, Vl: number, Vr: number, Ml: number, Mr: number, row: NodeRow | null, extra: boolean) => {
    const out: BItem[] = [];
    const atStart = Math.abs(x) < 1e-12;
    const atEnd = Math.abs(x - L) < 1e-12;
    for (const part of ['V', 'M'] as const) {
      const l = part === 'V' ? Vl : Ml;
      const r = part === 'V' ? Vr : Mr;
      const rawL = part === 'V' ? row?.Vl : row?.Ml;
      const rawR = part === 'V' ? row?.Vr : row?.Mr;
      const f = part === 'V' ? fF : fM;
      const scale = part === 'V' ? Vscale : Mscale;
      const tag = x.toFixed(4);
      if (row && !has(rawL) && !has(rawR)) incomplete = true;
      if (atStart) out.push(judge(part, `${part}:${tag}`, has(rawR) ? rawR : rawL, r, f, scale, { x, extra }));
      else if (atEnd) out.push(judge(part, `${part}:${tag}`, has(rawL) ? rawL : rawR, l, f, scale, { x, extra }));
      else if (Math.abs(l - r) <= 1e-9 * Math.max(1, scale)) {
        const first = judge(part, `${part}:${tag}`, has(rawL) ? rawL : rawR, l, f, scale, { x, extra });
        out.push(first.status === 'correct' && has(rawL) && has(rawR) ? judge(part, `${part}:${tag}`, rawR, l, f, scale, { x, extra }) : first);
      } else {
        // a node left with a single value where there is a jump: that value is V⁻ (M⁻)
        out.push(judge(part, `${part}-:${tag}`, rawL, l, f, scale, { x, extra }));
        out.push(judge(part, `${part}+:${tag}`, has(rawR) ? rawR : undefined, r, f, scale, { x, extra }));
      }
    }
    return extra ? out.filter((i) => i.status !== 'missing') : out;
  };

  const missingPoints: number[] = [];
  bps.forEach((bp, i) => {
    const n = matched.get(i);
    if (!n) missingPoints.push(bp.x);
    items.push(...nodeItems(bp.x, R.toNumber(bp.b.Vl), R.toNumber(bp.b.Vr), R.toNumber(bp.b.Ml), R.toNumber(bp.b.Mr), n?.row ?? null, false));
  });
  for (const n of extras) {
    if (n.x < -1e-12 || n.x > L + 1e-12) continue;
    // an extra node inside a segment: no jump there; compare with the exact values
    const seg = sol.segments.find((s) => R.toNumber(s.x1) < n.x && n.x < R.toNumber(s.x2));
    if (!seg) continue;
    const V = evalNum(seg.V, n.x);
    const M = evalNum(seg.M, n.x);
    items.push(...nodeItems(n.x, V, V, M, M, n.row, true));
  }

  // --- segments: shape, extremum, sampling -------------------------------------------------
  // user intervals: between consecutive nodes (by x), with the shape stored on the left node
  const userIntervals = nodes.slice(0, -1).map((n, i) => ({ a: n, b: nodes[i + 1]! }));
  const valueOf = (raw: string | undefined, other: string | undefined, f: number): number | null => {
    const p = num(has(raw) ? raw : other);
    return typeof p === 'number' ? p * f : null;
  };

  sol.segments.forEach((seg) => {
    const x1 = R.toNumber(seg.x1);
    const x2 = R.toNumber(seg.x2);
    const tag = `${x1.toFixed(4)}-${x2.toFixed(4)}`;
    const exp = expectedShapes(seg.V, seg.M);
    const inside = userIntervals.filter((u) => {
      const mid = (u.a.x + u.b.x) / 2;
      return mid > x1 && mid < x2 && u.a.x >= x1 - tol && u.b.x <= x2 + tol;
    });
    const zeros = kps.filter((k) => k.tags.includes('shear-zero') && k.x.value > x1 && k.x.value < x2);

    for (const part of ['V', 'M'] as const) {
      const expShape = part === 'V' ? exp.V : exp.M;
      const id = `s${part}:${tag}`;
      if (inside.length === 0) {
        items.push({ part, id, status: 'missing', expected: null, given: null, x: x1, expectedShape: expShape });
        continue;
      }
      const shapes = inside.map((u) => (part === 'V' ? u.a.row.sV : u.a.row.sM) ?? '');
      if (shapes.some((s) => s === '')) {
        incomplete = true;
        items.push({ part, id, status: 'missing', expected: null, given: null, x: x1, expectedShape: expShape });
        continue;
      }
      // pieces of a parabola split by an extra node keep the same shape; M linear also
      // accepts a constant M (degree 0) and V 'const' a zero V
      const ok = shapes.every((s) => s === expShape);
      items.push({ part, id, status: ok ? 'correct' : 'wrong', expected: null, given: null, x: x1, expectedShape: expShape, givenShape: shapes.join(',') });

      // sampling where the user's curve is determined
      const f = part === 'V' ? fF : fM;
      const scale = part === 'V' ? Vscale : Mscale;
      const poly = part === 'V' ? seg.V : seg.M;
      let determined = 0;
      let good = true;
      for (const u of inside) {
        const y1 = valueOf(part === 'V' ? u.a.row.Vr : u.a.row.Mr, part === 'V' ? u.a.row.Vl : u.a.row.Ml, f);
        const y2 = valueOf(part === 'V' ? u.b.row.Vl : u.b.row.Ml, undefined, f);
        if (y1 === null || y2 === null) continue;
        const ex_ = part === 'M' ? num(u.a.row.extX) : null;
        const ey = part === 'M' ? num(u.a.row.extM) : null;
        const extPt = typeof ex_ === 'number' && typeof ey === 'number' ? { x: ex_, y: ey * fM } : undefined;
        const fn = userCurve(part === 'V' ? u.a.row.sV : u.a.row.sM, u.a.x, y1, u.b.x, y2, extPt);
        if (!fn) continue;
        determined++;
        for (let k = 0; k <= 50 && good; k++) {
          const x = u.a.x + ((u.b.x - u.a.x) * k) / 50;
          good = valueOk(fn(x), evalNum(poly, Math.min(x2, Math.max(x1, x))), scale);
        }
      }
      if (determined > 0) items.push({ part, id: `q${part}:${tag}`, status: good ? 'correct' : 'wrong', expected: null, given: null, x: x1 });

      // extremum of M inside the segment (where V changes sign)
      if (part === 'M') {
        const given = inside
          .map((u) => ({ x: num(u.a.row.extX), m: num(u.a.row.extM) }))
          .filter((e) => e.x !== null || e.m !== null);
        if (given.some((e) => e.x === 'invalid' || e.m === 'invalid')) invalid = true;
        for (const z of zeros) {
          const zt = `ext:${z.x.value.toFixed(4)}`;
          const hit = given.find((e) => typeof e.x === 'number' && Math.abs(e.x - z.x.value) <= positionTol(L, true));
          if (!hit) {
            items.push({ part: 'M', id: zt, status: 'missing', expected: z.Ml.value, given: null, x: z.x.value });
            continue;
          }
          const mOk = typeof hit.m === 'number' && valueOk(hit.m * fM, z.Ml.value, Mscale);
          items.push({ part: 'M', id: zt, status: mOk ? 'correct' : typeof hit.m === 'number' ? 'wrong' : 'missing', expected: z.Ml.value, given: typeof hit.m === 'number' ? hit.m * fM : null, x: z.x.value });
          if (typeof hit.m !== 'number') incomplete = true;
        }
        // an extremum given where M has none is wrong
        for (const e of given) {
          if (typeof e.x !== 'number') continue;
          if (!zeros.some((z) => Math.abs(z.x.value - (e.x as number)) <= positionTol(L, true))) {
            items.push({ part: 'M', id: `ext?:${e.x.toFixed(4)}`, status: 'wrong', expected: null, given: typeof e.m === 'number' ? e.m * fM : null, x: e.x, extra: true });
          }
        }
      }
    }
  });

  // --- parts and score -------------------------------------------------------------------
  const weights: Partial<Record<BPart, number>> = { reactions: 0.2, V: 0.3, M: 0.5 };
  if (!ex.ask.reactions) delete weights.reactions;
  const sumW = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  const parts: Part[] = (Object.entries(weights) as [BPart, number][]).map(([key, w]) => {
    const its = items.filter((i) => i.part === key && !(i.extra && i.status === 'correct'));
    const correct = its.filter((i) => i.status === 'correct').length;
    return { key, weight: w / sumW, correct, total: its.length, ratio: its.length ? correct / its.length : 1 };
  });
  const score = Math.round(parts.reduce((a, p) => a + p.weight * p.ratio, 0) * 100) / 10;
  return { items, parts, score, invalid, incomplete, missingPoints, solution: sol };
}
