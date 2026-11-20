/**
 * Hash router (GitHub Pages has no SPA routing, spec §11.1).
 *   #/                                       → learning path ("Ikasbidea")
 *   #/praktika                               → practice home
 *   #/praktika/<level>/<ask>/seed/<n>        → generated exercise (ask: any|diagrams|point|mmax|equations)
 *   #/praktika/pool/<id>                     → pool exercise
 *   #/ebatziak, #/ebatziak/<id>              → worked exercises
 *   #/teoria, #/teoria/<id>                  → theory
 *   #/azterketa, #/azterketa/<seed>/<min>    → exam mode (start, running exam)
 *   #/aurrerapena                            → progress
 *   #/ezarpenak, #/honi-buruz                → settings, about
 *   #/berrikusi                              → text review (development only)
 */
import { useEffect, useState } from 'react';
import type { AskType, Level } from '../core/generator';

export type AskChoice = AskType | 'any';

export type Route =
  | { name: 'start' }
  | { name: 'home' }
  | { name: 'generated'; level: Level; ask: AskChoice; seed: number }
  | { name: 'pool'; id: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'progress' }
  | { name: 'exam' }
  | { name: 'review' }
  | { name: 'examRun'; seed: number; minutes: number }
  | { name: 'worked' }
  | { name: 'workedItem'; id: string }
  | { name: 'theory' }
  | { name: 'theoryTopic'; id: string };

const ASKS: AskChoice[] = ['any', 'diagrams', 'point', 'mmax', 'equations'];

export function parseHash(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (p.length === 0) return { name: 'start' };
  if (p[0] === 'praktika' && p[1] === 'pool' && p[2]) return { name: 'pool', id: p[2] };
  if (p[0] === 'praktika' && ['1', '2', '3'].includes(p[1] ?? '') && ASKS.includes(p[2] as AskChoice) && p[3] === 'seed' && /^\d+$/.test(p[4] ?? ''))
    return { name: 'generated', level: Number(p[1]) as Level, ask: p[2] as AskChoice, seed: Number(p[4]) };
  if (p[0] === 'praktika') return { name: 'home' };
  if (p[0] === 'ezarpenak') return { name: 'settings' };
  if (p[0] === 'honi-buruz') return { name: 'about' };
  if (p[0] === 'aurrerapena') return { name: 'progress' };
  if (p[0] === 'berrikusi') return { name: 'review' };
  if (p[0] === 'azterketa' && /^\d+$/.test(p[1] ?? '') && /^\d+$/.test(p[2] ?? '')) return { name: 'examRun', seed: Number(p[1]), minutes: Math.min(180, Math.max(1, Number(p[2]))) };
  if (p[0] === 'azterketa') return { name: 'exam' };
  if (p[0] === 'ebatziak') return p[1] ? { name: 'workedItem', id: p[1] } : { name: 'worked' };
  if (p[0] === 'teoria') return p[1] ? { name: 'theoryTopic', id: p[1] } : { name: 'theory' };
  return { name: 'start' };
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case 'start':
      return '#/';
    case 'generated':
      return `#/praktika/${r.level}/${r.ask}/seed/${r.seed}`;
    case 'pool':
      return `#/praktika/pool/${encodeURIComponent(r.id)}`;
    case 'settings':
      return '#/ezarpenak';
    case 'about':
      return '#/honi-buruz';
    case 'progress':
      return '#/aurrerapena';
    case 'exam':
      return '#/azterketa';
    case 'review':
      return '#/berrikusi';
    case 'examRun':
      return `#/azterketa/${r.seed}/${r.minutes}`;
    case 'worked':
      return '#/ebatziak';
    case 'workedItem':
      return `#/ebatziak/${encodeURIComponent(r.id)}`;
    case 'theory':
      return '#/teoria';
    case 'theoryTopic':
      return `#/teoria/${encodeURIComponent(r.id)}`;
    default:
      return '#/praktika';
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
