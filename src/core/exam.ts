/**
 * Exam mode (spec §11.1): three exercises, levels 1, 2 and 3, ask type at random, all
 * fixed by one seed so that an exam can be repeated or shared. Graded only at the end;
 * the exam score is the mean of the three scores (0–10, one decimal).
 */
import { type Level, generate } from './generator';
import type { Exercise } from './model';

export const EXAM_MINUTES = [30, 45, 60, 90] as const;
export const EXAM_DEFAULT_MINUTES = 45;

/** Seed of exercise k (level k + 1) of exam `seed`: deterministic and distinct per level. */
export const examExerciseSeed = (seed: number, level: Level) => (seed * 7 + level * 104_729) % 2_147_483_647;

export function examExercises(seed: number): Exercise[] {
  return ([1, 2, 3] as Level[]).map((level) => {
    const ex = generate({ level, seed: examExerciseSeed(seed, level) }).exercise;
    return { ...ex, id: `exam-${seed}-L${level}` };
  });
}

export function examScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** Remaining seconds (never negative). */
export function remainingSeconds(startedAt: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + minutes * 60_000 - now) / 1000));
}

export const formatClock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
