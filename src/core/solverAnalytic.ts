/**
 * Solver A (analytic, exact). Spec §5.2.
 *
 * 1. Validate the beam (model.validateBeam).
 * 2. Reactions from ΣFy = 0 and ΣM = 0 about the LEFT support (or the fixed support).
 * 3. Break the beam at every "event" (ends, supports, point loads, point moments, starts
 *    and ends of distributed loads) and walk from left to right:
 *      - at each breakpoint apply the jumps: V += R (support) − F (point load);
 *        M += M₀ (clockwise point moment) + M_R (clockwise reaction moment);
 *      - in each segment V(x) = V(xa⁺) − ∫q, M(x) = M(xa⁺) + ∫V, with exact
 *        Rational coefficients in the global x.
 *
 * Conventions (spec §4.1): F, q > 0 downwards; M₀ > 0 clockwise; R > 0 upwards;
 * V > 0 when the resultant of the forces LEFT of the section points up;
 * M > 0 sagging (bottom fibre in tension) = clockwise moment of the left forces.
 *
 * Moment of a force about a point p, clockwise positive:
 *   downward force F at x → +F·(x − p);  upward reaction R at x → −R·(x − p).
 */

import { type Beam, type Load, type Support, type SupportType, validateBeam } from './model';
import { type Poly, antiderivative, evalAt, padd, pconst, pmul, psub, integrate } from './poly';
import { type Rational, ONE, ZERO, add, cmp, div, eq, isZero, mul, neg, sub } from './rational';

export interface Reaction {
  supportId: string;
  label: string;
  type: SupportType;
  x: Rational;
  /** Vertical reaction, N, > 0 upwards. */
  R: Rational;
  /** Fixed support only: reaction moment on the beam, N·m, > 0 clockwise. */
  M?: Rational;
}

export interface Segment {
  x1: Rational;
  x2: Rational;
  /** Load density on the segment, N/m, > 0 downwards. */
  q: Poly;
  /** Shear force V(x), N, valid on the open interval (x1, x2). */
  V: Poly;
  /** Bending moment M(x), N·m, valid on (x1, x2). */
  M: Poly;
}

/** Left and right limits at a breakpoint (V⁻, V⁺, M⁻, M⁺). At x = 0 the left limits are 0. */
export interface Breakpoint {
  x: Rational;
  Vl: Rational;
  Vr: Rational;
  Ml: Rational;
  Mr: Rational;
}

export interface AnalyticSolution {
  beam: Beam;
  reactions: Reaction[];
  segments: Segment[];
  breakpoints: Breakpoint[];
  /** V and M just right of x = L, after every reaction: both must be exactly 0 (checked in checks.ts). */
  endV: Rational;
  endM: Rational;
}

// ---------------------------------------------------------------------------

/** Load density of a distributed load as a polynomial in global x (N/m). */
export function densityPoly(ld: Load): Poly {
  switch (ld.kind) {
    case 'udl':
      return pconst(ld.q);
    case 'linear': {
      const s = div(sub(ld.q2, ld.q1), sub(ld.x2, ld.x1)); // slope, N/m²
      return padd(pconst(sub(ld.q1, mul(s, ld.x1))), [ZERO, s]);
    }
    default:
      return [];
  }
}

/** Total downward force (N) and clockwise moment about p (N·m) of one load, exact. */
export function loadResultant(ld: Load, p: Rational): { F: Rational; Mp: Rational } {
  switch (ld.kind) {
    case 'point':
      return { F: ld.F, Mp: mul(ld.F, sub(ld.x, p)) };
    case 'moment':
      return { F: ZERO, Mp: ld.M };
    case 'udl':
    case 'linear': {
      const qx = densityPoly(ld);
      const arm: Poly = [neg(p), ONE]; // (x − p)
      const F = integrate(qx, ld.x1, ld.x2); // ∫ q dx
      const Mp = integrate(pmul(qx, arm), ld.x1, ld.x2); // ∫ q·(x − p) dx
      return { F, Mp };
    }
  }
}

function sumResultants(loads: Load[], p: Rational): { F: Rational; Mp: Rational } {
  let F = ZERO;
  let Mp = ZERO;
  for (const ld of loads) {
    const r = loadResultant(ld, p);
    F = add(F, r.F);
    Mp = add(Mp, r.Mp);
  }
  return { F, Mp };
}

export function computeReactions(beam: Beam): Reaction[] {
  const sup = [...beam.supports].sort((a, b) => cmp(a.x, b.x));
  const base = (s: Support) => ({ supportId: s.id, label: s.label, type: s.type, x: s.x });
  if (sup.length === 1) {
    const f = sup[0] as Support;
    const { F, Mp } = sumResultants(beam.loads, f.x);
    // ΣFy: R − ΣF = 0.  ΣM about the support: Mp(loads) + M_R = 0.
    return [{ ...base(f), R: F, M: neg(Mp) }];
  }
  const [a, b] = sup as [Support, Support];
  const { F, Mp } = sumResultants(beam.loads, a.x);
  // ΣM about a: Mp(loads) − R_b·(x_b − x_a) = 0.   ΣFy: R_a + R_b − ΣF = 0.
  const Rb = div(Mp, sub(b.x, a.x));
  const Ra = sub(F, Rb);
  return [
    { ...base(a), R: Ra },
    { ...base(b), R: Rb },
  ];
}

/** Sorted, de-duplicated list of breakpoints (all exact). */
export function breakpointsOf(beam: Beam): Rational[] {
  const xs: Rational[] = [ZERO, beam.length, ...beam.supports.map((s) => s.x)];
  for (const ld of beam.loads) {
    if (ld.kind === 'point' || ld.kind === 'moment') xs.push(ld.x);
    else xs.push(ld.x1, ld.x2);
  }
  xs.sort(cmp);
  return xs.filter((x, i) => i === 0 || !eq(x, xs[i - 1] as Rational));
}

export function solveAnalytic(beam: Beam): AnalyticSolution {
  validateBeam(beam);
  const reactions = computeReactions(beam);
  const xs = breakpointsOf(beam);

  const breakpoints: Breakpoint[] = [];
  const segments: Segment[] = [];
  let Vl = ZERO;
  let Ml = ZERO;

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i] as Rational;
    // Jumps at x.
    let Vr = Vl;
    let Mr = Ml;
    for (const r of reactions) {
      if (!eq(r.x, x)) continue;
      Vr = add(Vr, r.R);
      if (r.M) Mr = add(Mr, r.M);
    }
    for (const ld of beam.loads) {
      if (ld.kind === 'point' && eq(ld.x, x)) Vr = sub(Vr, ld.F);
      if (ld.kind === 'moment' && eq(ld.x, x)) Mr = add(Mr, ld.M);
    }
    breakpoints.push({ x, Vl, Vr, Ml, Mr });

    const next = xs[i + 1];
    if (next === undefined) {
      Vl = Vr;
      Ml = Mr;
      break;
    }
    // Segment (x, next): every distributed load either covers it fully or not at all.
    let qx: Poly = [];
    for (const ld of beam.loads) {
      if ((ld.kind === 'udl' || ld.kind === 'linear') && cmp(ld.x1, x) <= 0 && cmp(ld.x2, next) >= 0) {
        qx = padd(qx, densityPoly(ld));
      }
    }
    const Q = antiderivative(qx);
    const V = padd(pconst(add(Vr, evalAt(Q, x))), psub([], Q)); // V(t) = Vr − (Q(t) − Q(x))
    const IV = antiderivative(V);
    const M = padd(pconst(sub(Mr, evalAt(IV, x))), IV); // M(t) = Mr + (IV(t) − IV(x))
    segments.push({ x1: x, x2: next, q: qx, V, M });
    Vl = evalAt(V, next);
    Ml = evalAt(M, next);
  }

  return { beam, reactions, segments, breakpoints, endV: Vl, endM: Ml };
}

/** Exact V and M limits at any x in [0, L] (a breakpoint or a point inside a segment). */
export function valuesAt(sol: AnalyticSolution, x: Rational): Breakpoint {
  const bp = sol.breakpoints.find((b) => eq(b.x, x));
  if (bp) return bp;
  const seg = sol.segments.find((s) => cmp(s.x1, x) < 0 && cmp(x, s.x2) < 0);
  if (!seg) throw new RangeError('valuesAt: x is outside the beam');
  const V = evalAt(seg.V, x);
  const M = evalAt(seg.M, x);
  return { x, Vl: V, Vr: V, Ml: M, Mr: M };
}

export const hasJump = (bp: Breakpoint): { V: boolean; M: boolean } => ({
  V: !isZero(sub(bp.Vr, bp.Vl)),
  M: !isZero(sub(bp.Mr, bp.Ml)),
});
