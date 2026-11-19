/**
 * Mode B: structured diagram builder with live preview (spec §7.2). The user adds nodes
 * (x, V⁻ V⁺ M⁻ M⁺) and chooses, for the interval to the next node, the shape of V and M
 * (and, for M, an optional interior extremum). The preview is drawn on the same x scale
 * as the beam figure. No freehand drawing (it cannot be graded reliably).
 */
import type { Exercise } from '../core/model';
import type { BResult, MShape, ModeBAnswer, NodeRow, VShape } from '../core/diagramGrader';
import { userCurve } from '../core/diagramGrader';
import type { Status } from '../core/grader';
import { positionTol } from '../core/grader';
import * as R from '../core/rational';
import { parseUserNumber } from '../core/units';
import { useT } from '../i18n';
import { PAD_L, PAD_R } from './BeamFigure';
import { num, useFigWidth } from './format';
import { toggleSign } from './KeyValuesForm';

interface Props {
  ex: Exercise;
  ans: ModeBAnswer;
  onChange: (a: ModeBAnswer) => void;
  result?: BResult | null;
}

const V_SHAPES: VShape[] = ['const', 'linear', 'parab-up', 'parab-down'];
const M_SHAPES: MShape[] = ['linear', 'parab-up', 'parab-down', 'cubic'];

const tryNum = (s?: string): number | null => {
  if (!s || !s.trim()) return null;
  try {
    return R.toNumber(parseUserNumber(s));
  } catch {
    return null;
  }
};

function Num({ label, value, onChange, status, signed = true }: { label: string; value?: string; onChange: (v: string) => void; status?: Status; signed?: boolean }) {
  return (
    <div className={`fld ${status ?? ''}`}>
      <span>{label}</span>
      <span className="num-in">
        <input inputMode="decimal" autoComplete="off" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        {signed && (
          <button type="button" className="pm" aria-label={`± ${label}`} onClick={() => onChange(toggleSign(value ?? ''))}>
            ±
          </button>
        )}
      </span>
    </div>
  );
}

/** Live preview of the user's V and M (display units). */
function Preview({ ex, nodes, kind }: { ex: Exercise; nodes: NodeRow[]; kind: 'V' | 'M' }) {
  const { t } = useT();
  const W = useFigWidth();
  const H = 150;
  const L = R.toNumber(R.parse(ex.beam.length));
  const sx = (x: number) => PAD_L + ((W - PAD_L - PAD_R) * x) / L;
  const ns = nodes
    .map((r) => ({ r, x: tryNum(r.x) }))
    .filter((n): n is { r: NodeRow; x: number } => n.x !== null && n.x >= 0 && n.x <= L)
    .sort((a, b) => a.x - b.x);
  const lv = (r: NodeRow) => tryNum(kind === 'V' ? r.Vl : r.Ml) ?? tryNum(kind === 'V' ? r.Vr : r.Mr);
  const rv = (r: NodeRow) => tryNum(kind === 'V' ? r.Vr : r.Mr) ?? tryNum(kind === 'V' ? r.Vl : r.Ml);
  const pts: [number, number][] = [];
  ns.forEach((n, i) => {
    const l = lv(n.r);
    const r = rv(n.r);
    if (l !== null) pts.push([n.x, i === 0 ? (r ?? l) : l]);
    if (r !== null && i < ns.length - 1) pts.push([n.x, r]);
    const next = ns[i + 1];
    if (!next || r === null) return;
    const y2 = lv(next.r);
    if (y2 === null) return;
    const shape = kind === 'V' ? n.r.sV : n.r.sM;
    const ex_ = kind === 'M' ? tryNum(n.r.extX) : null;
    const ey = kind === 'M' ? tryNum(n.r.extM) : null;
    let f = userCurve(shape, n.x, r, next.x, y2, ex_ !== null && ey !== null ? { x: ex_, y: ey } : undefined);
    if (!f && (shape === 'parab-up' || shape === 'parab-down' || shape === 'cubic')) {
      // not determined by the data: a nominal curve of the chosen concavity (drawing only)
      const span = Math.max(Math.abs(y2 - r), 1e-9) * 0.25 + 1e-9;
      const sgn = shape === 'parab-down' ? 1 : shape === 'parab-up' ? -1 : 0;
      f = (x) => r + ((y2 - r) * (x - n.x)) / (next.x - n.x) + sgn * span * 4 * ((x - n.x) * (next.x - x)) / (next.x - n.x) ** 2;
    }
    if (f) for (let k = 1; k < 30; k++) pts.push([n.x + ((next.x - n.x) * k) / 30, f(n.x + ((next.x - n.x) * k) / 30)]);
  });
  const ys = [0, ...pts.map((p) => p[1])];
  const hi = Math.max(...ys);
  const lo = Math.min(...ys);
  const range = Math.max(1e-9, hi - lo);
  const sy = (v: number) => 30 + ((hi - v) * (H - 50)) / range;
  const color = kind === 'V' ? 'var(--V)' : 'var(--M)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kind === 'V' ? t('diag.V') : t('diag.M')} (${t('ed.preview')})`}>
      <text x={6} y={16} className="dlab" fill={color}>
        {kind === 'V' ? t('diag.V') : t('diag.M')} · {t('ed.preview')}
      </text>
      <line x1={sx(0)} y1={sy(0)} x2={sx(L)} y2={sy(0)} stroke="var(--ink)" strokeWidth={1.2} />
      {pts.length > 1 && <polyline points={pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')} fill="none" stroke={color} strokeWidth={2.2} />}
      {ns.map((n) => (
        <line key={n.x} x1={sx(n.x)} y1={24} x2={sx(n.x)} y2={H - 4} className="guide" />
      ))}
    </svg>
  );
}

export function DiagramEditor({ ex, ans, onChange, result }: Props) {
  const { t } = useT();
  const L = R.toNumber(R.parse(ex.beam.length));
  const items = result?.items ?? [];
  const set = (patch: Partial<ModeBAnswer>) => onChange({ ...ans, ...patch });
  const upd = (i: number, patch: Partial<NodeRow>) => set({ nodes: ans.nodes.map((r, k) => (k === i ? { ...r, ...patch } : r)) });

  const statusAt = (row: NodeRow, field: 'Vl' | 'Vr' | 'Ml' | 'Mr'): Status | undefined => {
    const x = tryNum(row.x);
    if (x === null || !result) return undefined;
    const part = field[0] as 'V' | 'M';
    const its = items.filter((i) => i.part === part && i.x !== undefined && Math.abs(i.x - x) <= positionTol(L) && /^(V|M)[-+]?:/.test(i.id));
    const side = field[1] === 'l' ? '-' : '+';
    const ex_ = its.find((i) => i.id.startsWith(`${part}${side}:`));
    if (ex_) return ex_.status;
    const single = its.find((i) => i.id.startsWith(`${part}:`));
    return single && (row[field] ?? '').trim() ? single.status : undefined;
  };
  const shapeStatus = (row: NodeRow, part: 'V' | 'M'): Status | undefined => {
    const x = tryNum(row.x);
    if (x === null || !result) return undefined;
    const it = items.find((i) => i.id.startsWith(`s${part}:`) && i.x !== undefined && Math.abs(i.x - x) <= positionTol(L));
    return it?.status;
  };
  const extStatus = (row: NodeRow): Status | undefined => {
    const x = tryNum(row.extX);
    if (x === null || !result) return undefined;
    return items.find((i) => (i.id.startsWith('ext:') || i.id.startsWith('ext?:')) && i.x !== undefined && Math.abs(i.x - x) <= positionTol(L, true))?.status;
  };

  return (
    <div className="ask">
      <header>
        <b>{t('ed.title')}</b>
      </header>
      <p className="hint">{t('ed.hint')}</p>
      <div className="prows">
        {ans.nodes.map((row, i) => (
          <div className="prow" key={i}>
            <Num label="x (m)" value={row.x} signed={false} onChange={(v) => upd(i, { x: v })} />
            <Num label={`V⁻ (${ans.forceUnit})`} value={row.Vl} status={statusAt(row, 'Vl')} onChange={(v) => upd(i, { Vl: v })} />
            <Num label={`V⁺ (${ans.forceUnit})`} value={row.Vr} status={statusAt(row, 'Vr')} onChange={(v) => upd(i, { Vr: v })} />
            <Num label={`M⁻ (${ans.momentUnit})`} value={row.Ml} status={statusAt(row, 'Ml')} onChange={(v) => upd(i, { Ml: v })} />
            <Num label={`M⁺ (${ans.momentUnit})`} value={row.Mr} status={statusAt(row, 'Mr')} onChange={(v) => upd(i, { Mr: v })} />
            <div className="seg-shapes">
              <span className="unit">{t('ed.toNext')}</span>
              <label className={`fld ${shapeStatus(row, 'V') ?? ''}`}>
                {t('ed.shapeV')}
                <select value={row.sV ?? ''} onChange={(e) => upd(i, { sV: e.target.value as VShape })}>
                  <option value="">—</option>
                  {V_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {t(`shape.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`fld ${shapeStatus(row, 'M') ?? ''}`}>
                {t('ed.shapeM')}
                <select value={row.sM ?? ''} onChange={(e) => upd(i, { sM: e.target.value as MShape })}>
                  <option value="">—</option>
                  {M_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {t(`shape.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Num label={t('ed.extX')} value={row.extX} signed={false} status={extStatus(row)} onChange={(v) => upd(i, { extX: v })} />
              <Num label={`${t('ed.extM')} (${ans.momentUnit})`} value={row.extM} status={extStatus(row)} onChange={(v) => upd(i, { extM: v })} />
            </div>
            <button className="small rm" onClick={() => set({ nodes: ans.nodes.filter((_, k) => k !== i) })} aria-label={t('form.remove')}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="actions">
        <button onClick={() => set({ nodes: [...ans.nodes, { x: '' }] })}>{t('ed.addNode')}</button>
      </div>
      <div className="diag-box">
        <Preview ex={ex} nodes={ans.nodes} kind="V" />
        <Preview ex={ex} nodes={ans.nodes} kind="M" />
      </div>
      <p className="hint">{t('ed.previewHint', { n: num(ans.nodes.length, 0) })}</p>
    </div>
  );
}
