/** User settings (spec §11.1.5), kept in localStorage (always inside try/catch). */
import { createContext, useContext } from 'react';
import type { GSetting } from '../core/units';

export interface Settings {
  g: GSetting;
  /** Alternative V sign convention: affects display and grading, never the solver (§4.1). */
  vFlip: boolean;
  /** Draw positive M below the axis (civil engineering habit). Drawing only. */
  mBelow: boolean;
  dims: 'both' | 'chained' | 'cumulative';
}

export const DEFAULT_SETTINGS: Settings = { g: '9.81', vFlip: false, mBelow: false, dims: 'both' };
const KEY = 'habelab.settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      g: s.g === '9.8' || s.g === '10' ? s.g : '9.81',
      vFlip: s.vFlip === true,
      mBelow: s.mBelow === true,
      dims: s.dims === 'chained' || s.dims === 'cumulative' ? s.dims : 'both',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings only for this visit */
  }
}

export const SettingsContext = createContext<{ settings: Settings; set: (s: Settings) => void }>({
  settings: DEFAULT_SETTINGS,
  set: () => undefined,
});
export const useSettings = () => useContext(SettingsContext);

/** Generic per-viewer storage helpers (answers in progress). */
export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
