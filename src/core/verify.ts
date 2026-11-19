/**
 * Full verification of one beam (spec §5.3–§5.4), used by the tests AND at run time:
 *   solver A (exact) → global checks → solver B (numeric) → A vs B comparison.
 * If anything fails, the exercise must NOT be shown (better no exercise than a wrong one).
 *
 * Tolerance (spec §5.3): |A − B| ≤ 1e-6 · scale at every key point, where scale is
 * max|M| for moments and max|V| for shear forces and reactions (at least 1 N or 1 N·m,
 * so that an all-zero diagram does not demand an impossible 0 tolerance).
 */

import type { Beam } from './model';
import { runChecks } from './checks';
import { extremes } from './keyPoints';
import { type AnalyticSolution, solveAnalytic } from './solverAnalytic';
import { type NumericSolution, nodeIndex, numericExtremes, solveNumeric } from './solverNumeric';
import { toNumber } from './rational';

export const AB_RTOL = 1e-6;

export interface Verification {
  ok: boolean;
  failures: string[];
  a?: AnalyticSolution;
  b?: NumericSolution;
}

export function compareAB(a: AnalyticSolution, b: NumericSolution): string[] {
  const f: string[] = [];
  const e = extremes(a);
  const Ms = Math.max(1, Math.abs(e.Mmax.value), Math.abs(e.Mmin.value));
  const Vs = Math.max(1, e.absVmax.value, ...a.reactions.map((r) => Math.abs(toNumber(r.R))));
  const near = (x: number, y: number, s: number) => Math.abs(x - y) <= AB_RTOL * s;

  for (const ra of a.reactions) {
    const rb = b.reactions.find((r) => r.label === ra.label);
    if (!rb) {
      f.push(`B has no reaction ${ra.label}`);
      continue;
    }
    if (!near(toNumber(ra.R), rb.R, Vs)) f.push(`R_${ra.label}: A = ${toNumber(ra.R)}, B = ${rb.R}`);
    if (ra.M && !near(toNumber(ra.M), rb.M ?? NaN, Ms)) f.push(`M_${ra.label}: A = ${toNumber(ra.M)}, B = ${rb.M}`);
  }
  for (const bp of a.breakpoints) {
    const x = toNumber(bp.x);
    const i = nodeIndex(b, x);
    if (i < 0) {
      f.push(`B has no node at x = ${x}`);
      continue;
    }
    const pairs: [string, number, number, number][] = [
      ['V⁻', toNumber(bp.Vl), b.Vl[i]!, Vs],
      ['V⁺', toNumber(bp.Vr), b.Vr[i]!, Vs],
      ['M⁻', toNumber(bp.Ml), b.Ml[i]!, Ms],
      ['M⁺', toNumber(bp.Mr), b.Mr[i]!, Ms],
    ];
    for (const [name, va, vb, s] of pairs) if (!near(va, vb, s)) f.push(`${name}(${x}): A = ${va}, B = ${vb}`);
  }
  if (!near(b.endV, 0, Vs)) f.push(`B: V(L⁺) = ${b.endV}`);
  if (!near(b.endM, 0, Ms)) f.push(`B: M(L⁺) = ${b.endM}`);
  const eb = numericExtremes(b);
  if (!near(e.Mmax.value, eb.Mmax, Ms)) f.push(`Mmax: A = ${e.Mmax.value}, B = ${eb.Mmax}`);
  if (!near(e.Mmin.value, eb.Mmin, Ms)) f.push(`Mmin: A = ${e.Mmin.value}, B = ${eb.Mmin}`);
  if (!near(e.absVmax.value, eb.absVmax, Vs)) f.push(`|V|max: A = ${e.absVmax.value}, B = ${eb.absVmax}`);
  return f;
}

export function verifyBeam(beam: Beam, cells?: number): Verification {
  let a: AnalyticSolution;
  try {
    a = solveAnalytic(beam);
  } catch (err) {
    return { ok: false, failures: [`solver A: ${(err as Error).message}`] };
  }
  const c = runChecks(a);
  const b = solveNumeric(beam, cells);
  const failures = [...c.failures, ...compareAB(a, b)];
  return { ok: failures.length === 0, failures, a, b };
}
