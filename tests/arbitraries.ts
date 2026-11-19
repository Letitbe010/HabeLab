import fc from 'fast-check';
import type { Beam, Load, Support } from '../src/core/model';
import * as R from '../src/core/rational';

/** Positions on a grid of `step` (in quarters of a metre by default) inside [0, L]. */
const pos = (Lq: number) => fc.integer({ min: 0, max: Lq }).map((k) => R.q(k, 4));
const force = fc.integer({ min: -40, max: 80 }).filter((k) => k !== 0).map((k) => R.q(k * 500)); // N, can be upward
const dens = fc.integer({ min: -20, max: 40 }).map((k) => R.q(k * 250)); // N/m

function loadArb(Lq: number): fc.Arbitrary<Load> {
  const range = fc
    .tuple(fc.integer({ min: 0, max: Lq }), fc.integer({ min: 0, max: Lq }))
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => [R.q(Math.min(a, b), 4), R.q(Math.max(a, b), 4)] as const);
  return fc.oneof(
    fc.record({ kind: fc.constant('point' as const), x: pos(Lq), F: force }),
    fc.record({ kind: fc.constant('moment' as const), x: pos(Lq), M: force }),
    fc.tuple(range, dens).map(([[x1, x2], q]): Load => ({ kind: 'udl', x1, x2, q })),
    fc.tuple(range, dens, dens).map(([[x1, x2], q1, q2]): Load => ({ kind: 'linear', x1, x2, q1, q2 })),
  );
}

/** Any valid isostatic beam: pin + roller anywhere (either order), or a cantilever at either end. */
export const beamArb: fc.Arbitrary<Beam> = fc
  .integer({ min: 4, max: 48 }) // L from 1 m to 12 m in quarters
  .chain((Lq) => {
    const L = R.q(Lq, 4);
    const supports: fc.Arbitrary<Support[]> = fc.oneof(
      fc
        .tuple(fc.integer({ min: 0, max: Lq }), fc.integer({ min: 0, max: Lq }), fc.boolean())
        .filter(([a, b]) => a !== b)
        .map(([a, b, pinFirst]) => [
          { id: 'S0', type: pinFirst ? ('pin' as const) : ('roller' as const), x: R.q(a, 4), label: 'A' },
          { id: 'S1', type: pinFirst ? ('roller' as const) : ('pin' as const), x: R.q(b, 4), label: 'B' },
        ]),
      fc.boolean().map((left) => [{ id: 'S0', type: 'fixed' as const, x: left ? R.ZERO : L, label: 'A' }]),
    );
    return fc.record({ length: fc.constant(L), supports, loads: fc.array(loadArb(Lq), { minLength: 1, maxLength: 5 }) });
  });

export function scaleBeam(b: Beam, k: R.Rational): Beam {
  return {
    ...b,
    loads: b.loads.map((ld): Load => {
      switch (ld.kind) {
        case 'point':
          return { ...ld, F: R.mul(ld.F, k) };
        case 'moment':
          return { ...ld, M: R.mul(ld.M, k) };
        case 'udl':
          return { ...ld, q: R.mul(ld.q, k) };
        case 'linear':
          return { ...ld, q1: R.mul(ld.q1, k), q2: R.mul(ld.q2, k) };
      }
    }),
  };
}

/** Mirror x → L − x. A clockwise moment becomes counter-clockwise. */
export function mirrorBeam(b: Beam): Beam {
  const m = (x: R.Rational) => R.sub(b.length, x);
  return {
    length: b.length,
    supports: b.supports.map((s) => ({ ...s, x: m(s.x) })),
    loads: b.loads.map((ld): Load => {
      switch (ld.kind) {
        case 'point':
          return { ...ld, x: m(ld.x) };
        case 'moment':
          return { ...ld, x: m(ld.x), M: R.neg(ld.M) };
        case 'udl':
          return { ...ld, x1: m(ld.x2), x2: m(ld.x1) };
        case 'linear':
          return { ...ld, x1: m(ld.x2), x2: m(ld.x1), q1: ld.q2, q2: ld.q1 };
      }
    }),
  };
}

/**
 * Beyond the generator's limits (spec §9.4 "eta haratago ere"): positions on twelfths of a
 * metre (not representable exactly in binary floats), L up to 20 m, magnitudes up to 1e6,
 * closely spaced events. Stresses B's float node matching and the grid merge.
 */
export const beamArbWide: fc.Arbitrary<Beam> = fc.integer({ min: 6, max: 240 }).chain((L12) => {
  const L = R.q(L12, 12);
  const p = fc.integer({ min: 0, max: L12 }).map((k) => R.q(k, 12));
  const mag = fc.integer({ min: -1_000_000, max: 1_000_000 }).filter((k) => k !== 0).map((k) => R.q(k));
  const range = fc
    .tuple(fc.integer({ min: 0, max: L12 }), fc.integer({ min: 0, max: L12 }))
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => [R.q(Math.min(a, b), 12), R.q(Math.max(a, b), 12)] as const);
  const load: fc.Arbitrary<Load> = fc.oneof(
    fc.record({ kind: fc.constant('point' as const), x: p, F: mag }),
    fc.record({ kind: fc.constant('moment' as const), x: p, M: mag }),
    fc.tuple(range, mag).map(([[x1, x2], q]): Load => ({ kind: 'udl', x1, x2, q })),
    fc.tuple(range, mag, mag).map(([[x1, x2], q1, q2]): Load => ({ kind: 'linear', x1, x2, q1, q2 })),
  );
  const supports: fc.Arbitrary<Support[]> = fc.oneof(
    fc
      .tuple(fc.integer({ min: 0, max: L12 }), fc.integer({ min: 0, max: L12 }))
      .filter(([a, b]) => a !== b)
      .map(([a, b]) => [
        { id: 'S0', type: 'pin' as const, x: R.q(a, 12), label: 'A' },
        { id: 'S1', type: 'roller' as const, x: R.q(b, 12), label: 'B' },
      ]),
    fc.boolean().map((left) => [{ id: 'S0', type: 'fixed' as const, x: left ? R.ZERO : L, label: 'A' }]),
  );
  return fc.record({ length: fc.constant(L), supports, loads: fc.array(load, { minLength: 1, maxLength: 8 }) });
});
