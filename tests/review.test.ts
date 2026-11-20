/** Dev-only review endpoint: writes only the expected fields of the expected files (as in KateLab). */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyReview } from '../tools/review-plugin';
import status from '../src/data/review-status.json';
import pool from '../src/data/pool.json';
import worked from '../src/data/worked.json';
import { TOPICS } from '../src/content/theory/topics';

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'habelab-review-'));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  const w = (p: string, d: unknown) => writeFileSync(join(root, p), JSON.stringify(d));
  w('src/data/review-status.json', { theory: { oreka: 'draft' }, worked: { W01: 'draft' }, pool: { 'pool-G1': 'draft' } });
  w('src/data/review-notes.json', { notes: [] });
  const r = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  return { root, r };
}

describe('review endpoint', () => {
  it('approves theory topics, worked exercises and pool exercises', () => {
    const { root, r } = setup();
    expect(applyReview(root, { kind: 'theory', id: 'oreka', status: 'reviewed' })).toBeNull();
    expect(applyReview(root, { kind: 'worked', id: 'W01', status: 'reviewed' })).toBeNull();
    expect(applyReview(root, { kind: 'pool', id: 'pool-G1', status: 'reviewed' })).toBeNull();
    expect(r('src/data/review-status.json')).toEqual({ theory: { oreka: 'reviewed' }, worked: { W01: 'reviewed' }, pool: { 'pool-G1': 'reviewed' } });
  });
  it('stores notes with a reference', () => {
    const { root, r } = setup();
    expect(applyReview(root, { kind: 'theory', id: 'oreka', note: '  "eragozten" → "galarazten"  ' })).toBeNull();
    expect(r('src/data/review-notes.json').notes[0]).toMatchObject({ ref: 'theory:oreka', text: '"eragozten" → "galarazten"' });
  });
  it('rejects unknown ids, bad kinds, bad statuses and path tricks without writing anything', () => {
    const { root, r } = setup();
    expect(applyReview(root, { kind: 'pool', id: 'nope', status: 'reviewed' })).toBe('unknown id');
    expect(applyReview(root, { kind: 'pool', id: '../../etc', status: 'reviewed' })).toBe('bad id');
    expect(applyReview(root, { kind: 'worked', id: 'W01', status: 'hacked' as never })).toBe('bad status');
    expect(applyReview(root, { kind: 'other' as never, id: 'x', status: 'reviewed' })).toBe('bad kind');
    expect(applyReview(root, { kind: 'theory', id: '__proto__', status: 'reviewed' })).toBe('unknown id');
    expect(r('src/data/review-status.json').worked.W01).toBe('draft');
  });
});

describe('review-status.json lists exactly the reviewable texts', () => {
  const ST = status as unknown as Record<string, Record<string, string>>;
  it('theory topics, worked exercises and pool exercises', () => {
    expect(Object.keys(ST.theory!).sort()).toEqual(TOPICS.map((t) => t.id).sort());
    expect(Object.keys(ST.worked!).sort()).toEqual((worked as { items: { id: string }[] }).items.map((w) => w.id).sort());
    expect(Object.keys(ST.pool!).sort()).toEqual((pool as { exercises: { id: string }[] }).exercises.map((e) => e.id).sort());
    for (const k of ['theory', 'worked', 'pool']) for (const v of Object.values(ST[k]!)) expect(['draft', 'reviewed']).toContain(v);
  });
});
