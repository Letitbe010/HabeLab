/**
 * Data model (spec §3).
 *
 * Two layers, on purpose:
 *  - Beam / Load / Support: what the solvers see. Internal units are always N and m,
 *    every number is an exact Rational.
 *  - Exercise: the JSON-friendly statement as written in the exam (kg, kN, kN/m...).
 *    Values are decimal strings ("2000", "2,5", "3/4") so they parse exactly.
 *    units.ts turns an Exercise into a Beam with the chosen g (spec §3: kg loads are
 *    converted when the exercise is solved, so changing g keeps results coherent).
 *
 * Deliberate deviation from the spec sketch: the spec stores both F (in N) and a
 * display value on each load. Here the exam value + unit is the single source of
 * truth and N is always derived from it, so the two can never disagree.
 *
 * Sign conventions (spec §4.1, not negotiable):
 *  - x from the left end (x = 0) to the right.
 *  - Point load F > 0 and distributed load q > 0 act DOWNWARDS.
 *  - Point moment M > 0 is CLOCKWISE.
 *  - Reactions: R > 0 UPWARDS; reaction moment of a fixed support > 0 CLOCKWISE
 *    (same sense as applied point moments).
 */

import { type Rational, ZERO, cmp, gt, isZero, lt, eq, toString } from './rational';

export type SupportType = 'pin' | 'roller' | 'fixed'; // artikulazio finkoa | euskarri mugikorra | landaketa

export interface Support {
  id: string;
  type: SupportType;
  x: Rational;
  label: string; // "A", "B"
}

export type Load =
  | { kind: 'point'; x: Rational; F: Rational } // N, > 0 downwards
  | { kind: 'udl'; x1: Rational; x2: Rational; q: Rational } // N/m, > 0 downwards
  | { kind: 'linear'; x1: Rational; x2: Rational; q1: Rational; q2: Rational } // N/m at x1 and x2
  | { kind: 'moment'; x: Rational; M: Rational }; // N·m, > 0 clockwise

export interface Beam {
  length: Rational; // m
  supports: Support[];
  loads: Load[];
}

// ---------------------------------------------------------------------------
// Exercise (statement) layer
// ---------------------------------------------------------------------------

export type ForceUnit = 'kg' | 'N' | 'kN';
export type LineUnit = 'kg/m' | 'N/m' | 'kN/m';
export type MomentUnit = 'kg·m' | 'N·m' | 'kN·m';

/** Decimal string with comma or point, or a fraction: parsed exactly by rational.parse. */
export type Num = string;

export type ExerciseLoad =
  | { kind: 'point'; x: Num; F: Num; unit: ForceUnit; label?: string }
  | { kind: 'udl'; x1: Num; x2: Num; q: Num; unit: LineUnit; label?: string }
  | { kind: 'linear'; x1: Num; x2: Num; q1: Num; q2: Num; unit: LineUnit; label?: string }
  | { kind: 'moment'; x: Num; M: Num; unit: MomentUnit; label?: string };

export interface ExerciseSupport {
  type: SupportType;
  x: Num;
  label: string;
}

export interface Exercise {
  id: string;
  origin: 'pool' | 'generated' | 'golden';
  sourceNote?: string; // never claim a real exam origin that is not real (spec §6.1)
  seed?: number;
  difficulty: 1 | 2 | 3;
  beam: { length: Num; supports: ExerciseSupport[] };
  loads: ExerciseLoad[];
  points?: { label: string; x: Num }[]; // "p"-like points
  ask: {
    reactions: boolean;
    diagrams: boolean;
    pointValues?: string[];
    mmax?: boolean;
    equations?: boolean;
  };
  text?: { eu: string; es: string };
}

// ---------------------------------------------------------------------------
// Structural validation (spec §5.2 step 1)
// ---------------------------------------------------------------------------

export class BeamError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BeamError';
  }
}

const inBeam = (x: Rational, L: Rational): boolean => !lt(x, ZERO) && !gt(x, L);

/**
 * Throws BeamError unless the beam is a valid statically determinate one:
 * exactly (pin + roller) at different positions, or a single fixed support at one end.
 * A fixed support is only accepted at x = 0 or x = L (a cantilever); a fixed support
 * in the middle of a beam is not an exam case and is rejected rather than guessed.
 */
export function validateBeam(beam: Beam): void {
  const L = beam.length;
  if (!gt(L, ZERO)) throw new BeamError('length', `Beam length must be > 0 (got ${toString(L)})`);

  const s = beam.supports;
  for (const sp of s) {
    if (!inBeam(sp.x, L)) throw new BeamError('support-position', `Support ${sp.label} is outside the beam`);
  }
  const types = s.map((sp) => sp.type).sort().join('+');
  if (types === 'pin+roller') {
    const [a, b] = s as [Support, Support];
    if (eq(a.x, b.x)) throw new BeamError('support-coincident', 'The two supports cannot be at the same position');
  } else if (types === 'fixed') {
    const f = s[0] as Support;
    if (!isZero(f.x) && !eq(f.x, L)) throw new BeamError('fixed-position', 'A fixed support must be at one end of the beam');
  } else {
    throw new BeamError(
      'not-isostatic',
      `Supports "${types || 'none'}" do not make a statically determinate beam (allowed: pin + roller, or one fixed)`,
    );
  }

  for (const ld of beam.loads) {
    if (ld.kind === 'point' || ld.kind === 'moment') {
      if (!inBeam(ld.x, L)) throw new BeamError('load-position', 'A load is outside the beam');
    } else {
      if (!inBeam(ld.x1, L) || !inBeam(ld.x2, L)) throw new BeamError('load-position', 'A distributed load is outside the beam');
      if (cmp(ld.x1, ld.x2) >= 0) throw new BeamError('load-range', 'A distributed load needs x1 < x2');
    }
  }
}
