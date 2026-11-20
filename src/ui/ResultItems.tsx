/** List of graded items: status, what it is, correct value and the user's value (spec §8.1.3). */
import type { BResult } from '../core/diagramGrader';
import type { Item } from '../core/grader';
import { useT } from '../i18n';
import { type DisplayUnits, fmtF, fmtM, num } from './format';

type AnyItem = Item | BResult['items'][number];
const ICON: Record<string, string> = { correct: '✓', wrong: '✗', missing: '!', invalid: '?' };

export function ResultItems({ items, units, vFlip }: { items: AnyItem[]; units: DisplayUnits; vFlip: boolean }) {
  const { t } = useT();
  const itemLabel = (it: AnyItem): string => {
    // segment ids look like "sV:0.0000-6.0000" (x1-x2, both ≥ 0)
    const range = (id: string) => id.slice(3).split('-').map((v) => num(Number(v))).join(' – ');
    if (it.id.startsWith('sV:') || it.id.startsWith('sM:')) return `${t(it.id[1] === 'V' ? 'ed.shapeV' : 'ed.shapeM')} (${range(it.id)} m)`;
    if (it.id.startsWith('qV:') || it.id.startsWith('qM:')) return `${it.id[1]} · ${t('res.sample')} (${range(it.id)} m)`;
    if (it.id.startsWith('ext')) return `${t('ed.extM')} (x = ${num(it.x ?? 0)} m)`;
    const [head, rest] = it.id.split(':') as [string, string?];
    const at = it.x !== undefined ? ` (x = ${num(it.x)} m)` : '';
    const names: Record<string, string> = { V: 'V', 'V-': 'V⁻', 'V+': 'V⁺', M: 'M', 'M-': 'M⁻', 'M+': 'M⁺', Vp: 'V', 'Vp-': 'V⁻', 'Vp+': 'V⁺', Mp: 'M' };
    if (head === 'R') return `R${rest}`;
    if (head === 'M' && it.part === 'reactions') return `M${rest}`;
    if (head === 'mmax') return '|M|max';
    if (head === 'xmax') return 'x (|M|max)';
    if (head === 'Veq' || head === 'Meq') return `${head === 'Veq' ? 'V(x)' : 'M(x)'}${at}`;
    if (head === 'x') return `x = ${('raw' in it ? it.raw : undefined) ?? ''}`;
    return `${names[head] ?? head}${head.startsWith('Vp') || head === 'Mp' ? ` ${rest}` : ''}${at}`;
  };
  const valText = (it: AnyItem, v: number | null) => {
    if (v === null) return '—';
    if (it.part === 'xmax') return `${num(v)} m`;
    const isM = it.part === 'M' || it.part === 'Mp' || it.part === 'mmax' || it.id.startsWith('M:');
    const shown = (it.part === 'V' || it.part === 'Vp') && vFlip ? -v : v;
    return isM ? fmtM(shown, units) : fmtF(shown, units);
  };
  return (
    <ul className="res-list">
      {items.map((it, i) => (
        <li key={`${it.id}-${i}`}>
          <span className={`chip ${it.status}`}>
            {ICON[it.status]} {t(`st.${it.status}`)}
          </span>
          <span className="what">{itemLabel(it)}</span>
          {'expectedShape' in it && it.expectedShape && <span className="vals">{t('res.expected', { v: t(`shape.${it.expectedShape}`) })}</span>}
          {'givenShape' in it && it.givenShape && it.status !== 'correct' && (
            <span className="vals">{t('res.given', { v: it.givenShape.split(',').map((s) => t(`shape.${s}`)).join(', ') })}</span>
          )}
          {it.expected !== null && <span className="vals">{t('res.expected', { v: valText(it, it.expected) })}</span>}
          {it.given !== null && <span className="vals">{t('res.given', { v: valText(it, it.given) })}</span>}
        </li>
      ))}
    </ul>
  );
}
