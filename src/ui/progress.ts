/**
 * Progress and history (spec §1, §11.1.4), stored in localStorage, always inside
 * try/catch; export and import as JSON. The app works without storage.
 * Same structure as KateLab's progress store, adapted to scored beam exercises.
 */
import { useSyncExternalStore } from 'react';

export interface Attempt {
  ts: number;
  exercise: string;
  level: number;
  ask: string; // diagrams | point | mmax | equations
  mode: 'A' | 'B';
  score: number; // 0–10
  /** ratio of correct items per part (reactions, V, M, Vp, Mp, mmax, xmax, Veq, Meq) */
  parts: Record<string, number>;
  diagnoses: string[];
  seconds: number;
}

export interface ProgressData {
  version: 1;
  attempts: Attempt[];
  theorySeen: string[];
  workedDone: string[];
  lastRoute?: string;
  introSeen: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export const KEY = 'habelab.progress.v1';
export const MAX_ATTEMPTS = 2000;
const empty = (): ProgressData => ({ version: 1, attempts: [], theorySeen: [], workedDone: [], introSeen: false, theme: 'auto' });

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Accepts unknown JSON and returns valid progress data (invalid parts dropped). */
export function sanitize(x: unknown): ProgressData {
  const d = empty();
  if (!x || typeof x !== 'object') return d;
  const o = x as Record<string, unknown>;
  if (Array.isArray(o.attempts))
    d.attempts = o.attempts
      .filter((a): a is Attempt => !!a && typeof a === 'object' && typeof (a as Attempt).exercise === 'string' && isNum((a as Attempt).score))
      .map((a) => ({
        ts: isNum(a.ts) ? a.ts : 0,
        exercise: a.exercise,
        level: isNum(a.level) ? a.level : 0,
        ask: typeof a.ask === 'string' ? a.ask : 'diagrams',
        mode: a.mode === 'B' ? ('B' as const) : ('A' as const),
        score: Math.max(0, Math.min(10, a.score)),
        parts: a.parts && typeof a.parts === 'object' ? Object.fromEntries(Object.entries(a.parts).filter(([, v]) => isNum(v))) : {},
        diagnoses: Array.isArray(a.diagnoses) ? a.diagnoses.filter((s) => typeof s === 'string') : [],
        seconds: isNum(a.seconds) ? a.seconds : 0,
      }))
      .slice(-MAX_ATTEMPTS);
  if (Array.isArray(o.theorySeen)) d.theorySeen = o.theorySeen.filter((s): s is string => typeof s === 'string');
  if (Array.isArray(o.workedDone)) d.workedDone = o.workedDone.filter((s): s is string => typeof s === 'string');
  if (typeof o.lastRoute === 'string' && o.lastRoute.startsWith('#/')) d.lastRoute = o.lastRoute;
  d.introSeen = o.introSeen === true;
  d.theme = o.theme === 'light' || o.theme === 'dark' ? o.theme : 'auto';
  return d;
}

// ---------------- store ----------------
let data: ProgressData = load();
const listeners = new Set<() => void>();

function load(): ProgressData {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}
function save() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: progress kept for this visit only */
  }
  listeners.forEach((l) => l());
}

export const getProgress = (): ProgressData => data;
export function update(f: (d: ProgressData) => ProgressData) {
  data = f(data);
  save();
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const useProgress = (): ProgressData => useSyncExternalStore(subscribe, getProgress, getProgress);

export const recordAttempt = (a: Attempt) => update((d) => ({ ...d, attempts: [...d.attempts, a].slice(-MAX_ATTEMPTS) }));
export const markTheory = (id: string) => {
  if (!data.theorySeen.includes(id)) update((d) => ({ ...d, theorySeen: [...d.theorySeen, id] }));
};
export const markWorked = (id: string) => {
  if (!data.workedDone.includes(id)) update((d) => ({ ...d, workedDone: [...d.workedDone, id] }));
};
export const setLastRoute = (r: string) => {
  if (data.lastRoute !== r) update((d) => ({ ...d, lastRoute: r }));
};
export const setIntroSeen = () => update((d) => ({ ...d, introSeen: true }));
export const setTheme = (theme: ProgressData['theme']) => update((d) => ({ ...d, theme }));
export const resetProgress = () => update((d) => ({ ...empty(), theme: d.theme, introSeen: true }));

export const exportJSON = (): string => JSON.stringify(data, null, 2);
export function importJSON(text: string): boolean {
  try {
    data = sanitize(JSON.parse(text));
    save();
    return true;
  } catch {
    return false;
  }
}

// ---------------- statistics ----------------
/** Mean success ratio per part (reactions, V, M…) over the attempts that graded that part. */
export function partRates(attempts: Attempt[]): { key: string; mean: number; n: number }[] {
  const m = new Map<string, { sum: number; n: number }>();
  for (const a of attempts)
    for (const [k, v] of Object.entries(a.parts)) {
      const r = m.get(k) ?? { sum: 0, n: 0 };
      r.sum += v;
      r.n += 1;
      m.set(k, r);
    }
  return [...m.entries()].map(([key, r]) => ({ key, mean: r.sum / r.n, n: r.n })).sort((x, y) => y.n - x.n);
}
export function topMistakes(attempts: Attempt[], n = 5): { code: string; count: number }[] {
  const m = new Map<string, number>();
  for (const a of attempts) for (const c of a.diagnoses) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, n);
}

/** For tests: replace the in-memory data (and storage). */
export function _reset(d?: ProgressData) {
  data = d ?? load();
  listeners.forEach((l) => l());
}
