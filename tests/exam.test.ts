import { examExercises, examScore, formatClock, remainingSeconds } from '../src/core/exam';
import { exerciseToBeam } from '../src/core/units';
import { verifyBeam } from '../src/core/verify';

describe('exam mode (spec §11.1)', () => {
  it('one seed gives three verified exercises, levels 1, 2 and 3, always the same', () => {
    for (const seed of [1, 42, 48213, 999_999]) {
      const a = examExercises(seed);
      expect(a.map((e) => e.difficulty)).toEqual([1, 2, 3]);
      expect(JSON.stringify(examExercises(seed))).toBe(JSON.stringify(a));
      for (const e of a) expect(verifyBeam(exerciseToBeam(e, '9.81'), 2000).ok).toBe(true);
      expect(new Set(a.map((e) => e.id)).size).toBe(3);
    }
    expect(JSON.stringify(examExercises(1))).not.toBe(JSON.stringify(examExercises(2)));
  });
  it('the exam score is the mean of the three, one decimal', () => {
    expect(examScore([10, 5, 7.5])).toBe(7.5);
    expect(examScore([10, 10, 9.9])).toBe(10);
    expect(examScore([3.3, 3.3, 3.4])).toBe(3.3);
    expect(examScore([])).toBe(0);
  });
  it('countdown never goes below zero and formats m:ss', () => {
    const t0 = 1_000_000;
    expect(remainingSeconds(t0, 45, t0)).toBe(2700);
    expect(remainingSeconds(t0, 45, t0 + 2_700_000 + 5000)).toBe(0);
    expect(formatClock(2700)).toBe('45:00');
    expect(formatClock(61)).toBe('1:01');
  });
});
