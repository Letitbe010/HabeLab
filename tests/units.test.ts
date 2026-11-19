import * as R from '../src/core/rational';
import { exerciseToBeam, factorToSI, formatNumber, formatSmart, gValue, parseUserNumber, THIN_SPACE, toSI } from '../src/core/units';
import { type Beam, type Exercise, BeamError, validateBeam } from '../src/core/model';

const S = R.toString;
const T = THIN_SPACE;

describe('units: g and conversions', () => {
  it('g values are exact rationals', () => {
    expect(S(gValue('9.81'))).toBe('981/100');
    expect(S(gValue('9.8'))).toBe('49/5');
    expect(S(gValue('10'))).toBe('10');
  });
  it('kg → N with g = 9.81 (spec §4.2 example: 2000 kg = 19 620 N)', () => {
    expect(S(toSI(R.q(2000), 'kg', '9.81'))).toBe('19620');
    expect(S(toSI(R.q(5000), 'kg', '9.81'))).toBe('49050');
    expect(S(toSI(R.q(2000), 'kg', '10'))).toBe('20000');
    expect(S(toSI(R.q(2000), 'kg', '9.8'))).toBe('19600');
  });
  it('kN, kN/m and kN·m → ×1000', () => {
    for (const u of ['kN', 'kN/m', 'kN·m'] as const) expect(S(factorToSI(u, '9.81'))).toBe('1000');
    for (const u of ['N', 'N/m', 'N·m'] as const) expect(S(factorToSI(u, '9.81'))).toBe('1');
    expect(S(toSI(R.parse('2,5'), 'kN/m', '9.81'))).toBe('2500');
  });
  it('exerciseToBeam converts every load kind exactly', () => {
    const ex: Exercise = {
      id: 't',
      origin: 'golden',
      difficulty: 1,
      beam: { length: '4', supports: [{ type: 'pin', x: '0', label: 'A' }, { type: 'roller', x: '4', label: 'B' }] },
      loads: [
        { kind: 'point', x: '1', F: '2000', unit: 'kg' },
        { kind: 'udl', x1: '0', x2: '2,5', q: '1,5', unit: 'kN/m' },
        { kind: 'linear', x1: '1', x2: '3', q1: '0', q2: '100', unit: 'kg/m' },
        { kind: 'moment', x: '2', M: '8', unit: 'kN·m' },
      ],
      ask: { reactions: true, diagrams: true },
    };
    const b = exerciseToBeam(ex);
    expect(S(b.length)).toBe('4');
    const [p, u, l, m] = b.loads;
    expect(p).toMatchObject({ kind: 'point' });
    if (p?.kind === 'point') expect(S(p.F)).toBe('19620');
    if (u?.kind === 'udl') {
      expect(S(u.q)).toBe('1500');
      expect(S(u.x2)).toBe('5/2');
    }
    if (l?.kind === 'linear') expect(S(l.q2)).toBe('981');
    if (m?.kind === 'moment') expect(S(m.M)).toBe('8000');
  });
});

describe('units: formatting (decimal comma, thin space)', () => {
  it('formats like the spec examples', () => {
    expect(formatNumber(R.q(19620), 0)).toBe(`19${T}620`);
    expect(formatNumber(27.7128, 2)).toBe('27,71');
    expect(formatNumber(R.q(-29430), 0)).toBe(`−29${T}430`);
    expect(formatNumber(R.q(1234567, 100), 2)).toBe(`12${T}345,67`);
    expect(formatNumber(-0.0001, 2)).toBe('0,00');
    expect(formatNumber(R.q(999), 0)).toBe('999');
  });
  it('smart format drops useless decimals', () => {
    expect(formatSmart(R.q(39240))).toBe(`39${T}240`);
    expect(formatSmart(R.q(5, 2))).toBe('2,5');
    expect(formatSmart(27.71281292)).toBe('27,713');
  });
  it('parses user input with comma, point, spaces and the minus sign', () => {
    expect(S(parseUserNumber('19 620'))).toBe('19620');
    expect(S(parseUserNumber(`19${T}620`))).toBe('19620');
    expect(S(parseUserNumber('27,71'))).toBe('2771/100');
    expect(S(parseUserNumber('−3'))).toBe('-3');
    expect(() => parseUserNumber('')).toThrow();
  });
});

describe('model: structural validation', () => {
  const sup = (type: 'pin' | 'roller' | 'fixed', x: number, label: string) => ({ id: label, type, x: R.q(x), label });
  const beam = (supports: Beam['supports'], loads: Beam['loads'] = []): Beam => ({ length: R.q(6), supports, loads });
  const code = (b: Beam): string | null => {
    try {
      validateBeam(b);
      return null;
    } catch (e) {
      return e instanceof BeamError ? e.code : 'other';
    }
  };
  it('accepts pin + roller and a cantilever at either end', () => {
    expect(code(beam([sup('pin', 0, 'A'), sup('roller', 6, 'B')]))).toBeNull();
    expect(code(beam([sup('roller', 1, 'A'), sup('pin', 4, 'B')]))).toBeNull();
    expect(code(beam([sup('fixed', 0, 'A')]))).toBeNull();
    expect(code(beam([sup('fixed', 6, 'A')]))).toBeNull();
  });
  it('rejects unstable or hyperstatic configurations', () => {
    expect(code(beam([sup('roller', 0, 'A'), sup('roller', 6, 'B')]))).toBe('not-isostatic');
    expect(code(beam([sup('pin', 0, 'A'), sup('pin', 6, 'B')]))).toBe('not-isostatic');
    expect(code(beam([sup('fixed', 0, 'A'), sup('roller', 6, 'B')]))).toBe('not-isostatic');
    expect(code(beam([sup('pin', 0, 'A')]))).toBe('not-isostatic');
    expect(code(beam([]))).toBe('not-isostatic');
    expect(code(beam([sup('pin', 3, 'A'), sup('roller', 3, 'B')]))).toBe('support-coincident');
    expect(code(beam([sup('fixed', 3, 'A')]))).toBe('fixed-position');
  });
  it('rejects loads outside the beam and empty ranges', () => {
    const ok = [sup('pin', 0, 'A'), sup('roller', 6, 'B')];
    expect(code(beam(ok, [{ kind: 'point', x: R.q(7), F: R.q(1) }]))).toBe('load-position');
    expect(code(beam(ok, [{ kind: 'udl', x1: R.q(3), x2: R.q(3), q: R.q(1) }]))).toBe('load-range');
    expect(code(beam(ok, [{ kind: 'udl', x1: R.q(-1), x2: R.q(3), q: R.q(1) }]))).toBe('load-position');
    expect(code(beam([sup('pin', 0, 'A'), sup('roller', 7, 'B')]))).toBe('support-position');
  });
});
