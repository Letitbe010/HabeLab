/**
 * V and M diagrams (spec §11.3): same x scale as the beam figure, V in blue, M in orange,
 * light vertical guides at the key points, values written with units. Optional overlay of
 * the user's answer (dashed dark grey). V sign convention and M orientation follow the
 * settings, which affect drawing only.
 */
import type { KeyPoint } from '../core/keyPoints';
import { evalNum } from '../core/poly';
import * as R from '../core/rational';
import type { AnalyticSolution } from '../core/solverAnalytic';
import { useT } from '../i18n';
import { PAD_L, PAD_R } from './BeamFigure';
import { type DisplayUnits, num, useFigWidth } from './format';

export interface OverlayPoint {
  x: number;
  Vl?: number;
  Vr?: number;
  Ml?: number;
  Mr?: number;
}

interface Props {
  sol: AnalyticSolution;
  kps: KeyPoint[];
  units: DisplayUnits;
  vFlip: boolean;
  mBelow: boolean;
  overlay?: OverlayPoint[];
}

const PANEL_H = 190;
const PAD_TOP = 44; // room for the title and the labels above the curve
const PAD_BOT = 24;

function Panel({
  kind,
  sol,
  kps,
  units,
  sign,
  flip,
  overlay,
}: {
  kind: 'V' | 'M';
  sol: AnalyticSolution;
  kps: KeyPoint[];
  units: DisplayUnits;
  /** sign applied to the VALUES (alternative V convention) */
  sign: number;
  /** draw positive values below the axis (drawing only, labels unchanged) */
  flip: boolean;
  overlay?: OverlayPoint[];
}) {
  const { t } = useT();
  const FIG_W = useFigWidth();
  const L = R.toNumber(sol.beam.length);
  const span = FIG_W - PAD_L - PAD_R;
  const sx = (x: number) => PAD_L + (span * x) / L;
  const color = kind === 'V' ? 'var(--V)' : 'var(--M)';
  const unit = kind === 'V' ? units.force : units.moment;

  // polyline of the diagram, with vertical jumps at breakpoints (values in display units)
  const pts: [number, number][] = [[0, 0]];
  sol.breakpoints.forEach((bp, i) => {
    const x = R.toNumber(bp.x);
    const l = R.toNumber(kind === 'V' ? bp.Vl : bp.Ml);
    const r = R.toNumber(kind === 'V' ? bp.Vr : bp.Mr);
    pts.push([x, l], [x, r]);
    const seg = sol.segments[i];
    if (seg) {
      const p = kind === 'V' ? seg.V : seg.M;
      const x1 = R.toNumber(seg.x1);
      const x2 = R.toNumber(seg.x2);
      for (let k = 1; k < 40; k++) {
        const xx = x1 + ((x2 - x1) * k) / 40;
        pts.push([xx, evalNum(p, xx)]);
      }
    }
  });
  pts.push([L, 0]);
  const vals = pts.map((p) => (p[1] * sign) / units.fk);
  const ovVals = (overlay ?? []).flatMap((o) => (kind === 'V' ? [o.Vl, o.Vr] : [o.Ml, o.Mr])).filter((v): v is number => v !== undefined).map((v) => (v * sign) / units.fk);
  const draw = (v: number) => (flip ? -v : v);
  const lo = Math.min(0, ...vals.map(draw), ...ovVals.map(draw));
  const hi = Math.max(0, ...vals.map(draw), ...ovVals.map(draw));
  const range = Math.max(1e-9, hi - lo);
  const sy = (v: number) => PAD_TOP + ((hi - draw(v)) * (PANEL_H - PAD_TOP - PAD_BOT)) / range;
  const y0 = sy(0);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(vals[i] as number).toFixed(1)}`).join(' ');

  // labels. V: per segment (one label in the middle when constant, else one at each end).
  // M: per key point (both limits only where M jumps). Only values inside the beam.
  const labels: { x: number; v: number; anchor: 'start' | 'end' | 'middle' }[] = [];
  const same = (u: number, w: number) => Math.abs(u - w) <= 1e-9 * Math.max(1, Math.abs(u), Math.abs(w));
  if (kind === 'V') {
    for (const seg of sol.segments) {
      const x1 = R.toNumber(seg.x1);
      const x2 = R.toNumber(seg.x2);
      const v1 = (evalNum(seg.V, x1) * sign) / units.fk;
      const v2 = (evalNum(seg.V, x2) * sign) / units.fk;
      if (same(v1, v2)) labels.push({ x: (x1 + x2) / 2, v: v1, anchor: 'middle' });
      else labels.push({ x: x1, v: v1, anchor: 'start' }, { x: x2, v: v2, anchor: 'end' });
    }
  } else {
    for (const k of kps) {
      const x = k.x.value;
      const l = k.Ml.value / units.fk;
      const r = k.Mr.value / units.fk;
      if (Math.abs(x) < 1e-12) labels.push({ x, v: r, anchor: 'start' });
      else if (Math.abs(x - L) < 1e-12) labels.push({ x, v: l, anchor: 'end' });
      else if (!same(l, r)) labels.push({ x, v: l, anchor: 'end' }, { x, v: r, anchor: 'start' });
      else labels.push({ x, v: l, anchor: 'middle' });
    }
  }

  // overlay of the user's values (dashed)
  const ovPts = (overlay ?? [])
    .flatMap((o) => {
      const a = kind === 'V' ? o.Vl : o.Ml;
      const b = kind === 'V' ? (o.Vr ?? o.Vl) : (o.Mr ?? o.Ml);
      return [a, b].filter((v): v is number => v !== undefined).map((v) => [o.x, (v * sign) / units.fk] as [number, number]);
    })
    .sort((p, q) => p[0] - q[0]);

  return (
    <svg viewBox={`0 0 ${FIG_W} ${PANEL_H}`} role="img" aria-label={`${kind === 'V' ? t('diag.V') : t('diag.M')} (${unit})`}>
      <text x={6} y={16} className="dlab" fill={color}>
        {kind === 'V' ? t('diag.V') : t('diag.M')} ({unit})
      </text>
      {kps.map((k) => (
        <line key={k.x.value} x1={sx(k.x.value)} y1={26} x2={sx(k.x.value)} y2={PANEL_H - 4} className="guide" />
      ))}
      <path d={`${d} Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <line x1={sx(0)} y1={y0} x2={sx(L)} y2={y0} stroke="var(--ink)" strokeWidth={1.2} />
      {ovPts.length > 1 && (
        <polyline points={ovPts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ')} fill="none" stroke="var(--user)" strokeWidth={1.8} strokeDasharray="6 4" />
      )}
      {ovPts.map((p, i) => (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3} fill="var(--user)" />
      ))}
      {labels.map((lb, i) => {
        const y = sy(lb.v);
        const above = draw(lb.v) >= 0 ? y - 6 : y + 15;
        const dx = lb.anchor === 'start' ? 4 : lb.anchor === 'end' ? -4 : 0;
        return (
          <text key={i} x={sx(lb.x) + dx} y={Math.min(PANEL_H - 3, Math.max(34, above))} textAnchor={lb.anchor} className="dval">
            {num(lb.v)}
          </text>
        );
      })}
    </svg>
  );
}

export function DiagramView({ sol, kps, units, vFlip, mBelow, overlay }: Props) {
  return (
    <div className="diag-box">
      <Panel kind="V" sol={sol} kps={kps} units={units} sign={vFlip ? -1 : 1} flip={false} overlay={overlay} />
      <Panel kind="M" sol={sol} kps={kps} units={units} sign={1} flip={mBelow} overlay={overlay} />
    </div>
  );
}
