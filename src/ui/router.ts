/**
 * Hash router (GitHub Pages has no SPA routing, spec §11.1).
 *   #/praktika                               → practice home
 *   #/praktika/<level>/<ask>/seed/<n>        → generated exercise (ask: any|diagrams|point|mmax|equations)
 *   #/praktika/pool/<id>                     → pool exercise
 *   #/ezarpenak                              → settings
 *   #/ebatziak, #/ebatziak/<id>              → worked exercises
 *   #/teoria, #/teoria/<id>                  → theory
 *   #/aurrerapena                            → section of a later phase
 */
import { useEffect, useState } from 'react';
import type { AskType, Level } from '../core/generator';

export type AskChoice = AskType | 'any';

export type Route =
  | { name: 'home' }
  | { name: 'generated'; level: Level; ask: AskChoice; seed: number }
  | { name: 'pool'; id: string }
  | { name: 'settings' }
  | { name: 'worked' }
  | { name: 'workedItem'; id: string }
  | { name: 'theory' }
  | { name: 'theoryTopic'; id: string }
  | { name: 'soon'; section: 'aurrerapena' };

const ASKS: AskChoice[] = ['any', 'diagrams', 'point', 'mmax', 'equations'];

export function parseHash(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 'praktika' && p[1] === 'pool' && p[2]) return { name: 'pool', id: p[2] };
  if (p[0] === 'praktika' && ['1', '2', '3'].includes(p[1] ?? '') && ASKS.includes(p[2] as AskChoice) && p[3] === 'seed' && /^\d+$/.test(p[4] ?? ''))
    return { name: 'generated', level: Number(p[1]) as Level, ask: p[2] as AskChoice, seed: Number(p[4]) };
  if (p[0] === 'ezarpenak') return { name: 'settings' };
  if (p[0] === 'ebatziak') return p[1] ? { name: 'workedItem', id: p[1] } : { name: 'worked' };
  if (p[0] === 'teoria') return p[1] ? { name: 'theoryTopic', id: p[1] } : { name: 'theory' };
  if (p[0] === 'aurrerapena') return { name: 'soon', section: p[0] };
  return { name: 'home' };
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case 'generated':
      return `#/praktika/${r.level}/${r.ask}/seed/${r.seed}`;
    case 'pool':
      return `#/praktika/pool/${encodeURIComponent(r.id)}`;
    case 'settings':
      return '#/ezarpenak';
    case 'worked':
      return '#/ebatziak';
    case 'workedItem':
      return `#/ebatziak/${encodeURIComponent(r.id)}`;
    case 'theory':
      return '#/teoria';
    case 'theoryTopic':
      return `#/teoria/${encodeURIComponent(r.id)}`;
    case 'soon':
      return `#/${r.section}`;
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
