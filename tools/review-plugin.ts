/**
 * Development-only review endpoint (spec §12.3, §13.3; same design as KateLab):
 * POST /__review saves the user's review decisions, so texts can be approved from the app.
 *   { kind: 'pool' | 'worked' | 'theory', id, status?, note? }
 * Only src/data/review-status.json and src/data/review-notes.json are written; kinds, ids
 * (must already exist) and statuses are validated. Not part of the production build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export type ReviewKind = 'pool' | 'worked' | 'theory';
export interface ReviewRequest {
  kind: ReviewKind;
  id: string;
  status?: 'reviewed' | 'draft';
  note?: string;
}

const readJSON = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const writeJSON = (p: string, d: unknown) => writeFileSync(p, JSON.stringify(d, null, 2) + '\n');

/** Applies one review request under `root` (the project folder). Returns an error message or null. */
export function applyReview(root: string, r: ReviewRequest): string | null {
  if (!r || !['pool', 'worked', 'theory'].includes(r.kind)) return 'bad kind';
  if (typeof r.id !== 'string' || !/^[\w.-]{1,80}$/.test(r.id)) return 'bad id';
  if (r.status !== undefined && !['reviewed', 'draft'].includes(r.status)) return 'bad status';
  if (r.note !== undefined && (typeof r.note !== 'string' || r.note.length > 5000)) return 'bad note';
  const statusPath = join(root, 'src/data/review-status.json');
  const st = readJSON(statusPath) as Record<ReviewKind, Record<string, string>>;
  if (!st[r.kind] || !Object.prototype.hasOwnProperty.call(st[r.kind], r.id)) return 'unknown id';
  if (r.status) {
    st[r.kind][r.id] = r.status;
    writeJSON(statusPath, st);
  }
  if (r.note !== undefined && r.note.trim()) {
    const p = join(root, 'src/data/review-notes.json');
    const d = readJSON(p);
    d.notes.push({ ref: `${r.kind}:${r.id}`, text: r.note.trim(), date: new Date().toISOString().slice(0, 16) });
    writeJSON(p, d);
  }
  return null;
}

export function reviewPlugin(root: string): Plugin {
  return {
    name: 'habelab-review',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__review', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          let err: string | null;
          try {
            err = applyReview(root, JSON.parse(body) as ReviewRequest);
          } catch (e) {
            err = (e as Error).message;
          }
          res.statusCode = err ? 400 : 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(err ? { error: err } : { ok: true }));
        });
      });
    },
  };
}
