import { type Attempt, MAX_ATTEMPTS, partRates, sanitize, topMistakes } from '../src/ui/progress';

const a = (over: Partial<Attempt> = {}): Attempt => ({
  ts: 1,
  exercise: 'pool-G1',
  level: 1,
  ask: 'point',
  mode: 'A',
  score: 5,
  parts: { Vp: 1, Mp: 0 },
  diagnoses: [],
  seconds: 60,
  ...over,
});

describe('progress store (spec §1: export/import, robust to bad data)', () => {
  it('sanitize drops invalid parts and clamps values', () => {
    const d = sanitize({
      attempts: [a(), { exercise: 3 }, a({ score: 14, mode: 'X' as 'A', parts: { V: 0.5, bad: 'x' as unknown as number } })],
      theorySeen: ['oreka', 4],
      lastRoute: 'http://evil',
      introSeen: 'yes',
      theme: 'neon',
    });
    expect(d.attempts).toHaveLength(2);
    expect(d.attempts[1]!.score).toBe(10);
    expect(d.attempts[1]!.mode).toBe('A');
    expect(d.attempts[1]!.parts).toEqual({ V: 0.5 });
    expect(d.theorySeen).toEqual(['oreka']);
    expect(d.lastRoute).toBeUndefined();
    expect(d.introSeen).toBe(false);
    expect(d.theme).toBe('auto');
  });
  it('sanitize of garbage gives an empty store; history is capped', () => {
    expect(sanitize(null).attempts).toEqual([]);
    expect(sanitize({ attempts: Array.from({ length: MAX_ATTEMPTS + 10 }, () => a()) }).attempts).toHaveLength(MAX_ATTEMPTS);
  });
  it('statistics: mean ratio per part and most frequent mistakes', () => {
    const at = [a({ parts: { V: 1, M: 0 }, diagnoses: ['units-kg'] }), a({ parts: { V: 0, M: 0.5 }, diagnoses: ['units-kg', 'v-sign'] })];
    expect(partRates(at).find((r) => r.key === 'V')).toEqual({ key: 'V', mean: 0.5, n: 2 });
    expect(topMistakes(at)).toEqual([
      { code: 'units-kg', count: 2 },
      { code: 'v-sign', count: 1 },
    ]);
  });
});
