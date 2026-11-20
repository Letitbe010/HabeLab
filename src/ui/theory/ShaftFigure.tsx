/**
 * Mechanical view of a shaft on bearings (as drawn in some OPE statements, e.g. Madrid 2025)
 * next to its beam model. The same Exercise drives both drawings: each support is drawn
 * as a rolling bearing (housing + balls), each point load as a gear or pulley with its force.
 * The beam model below is the usual free-body diagram with the unknown reactions.
 */
import type { Exercise } from '../../core/model';
import * as R from '../../core/rational';
import { useT } from '../../i18n';
import { BeamFigure, PAD_L, PAD_R } from '../BeamFigure';
import { num, useFigWidth } from '../format';

const P = (s: string) => R.toNumber(R.parse(s));

export function ShaftFigure({ ex }: { ex: Exercise }) {
  const { t } = useT();
  const W = useFigWidth();
  const H = 215;
  const L = P(ex.beam.length);
  const sx = (x: number) => PAD_L + ((W - PAD_L - PAD_R) * x) / L;
  const Y = 132; // shaft axis (room above for the title and the force labels)
  const supports = ex.beam.supports.map((s) => ({ ...s, X: sx(P(s.x)) }));
  const inside = (x: number) => {
    const xs = supports.map((s) => P(s.x));
    return x >= Math.min(...xs) && x <= Math.max(...xs);
  };
  return (
    <div className="shaft">
      <div className="fig-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('th.shaft.mech')}>
          <text x={6} y={16} className="dlab" fill="var(--muted)">
            {t('th.shaft.mech')}
          </text>
          {/* shaft */}
          <rect x={sx(0) - 6} y={Y - 9} width={sx(L) - sx(0) + 12} height={18} rx={3} fill="var(--soft)" stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={sx(0) - 14} y1={Y} x2={sx(L) + 14} y2={Y} stroke="var(--muted)" strokeDasharray="10 4 2 4" strokeWidth={1} />
          {/* bearings: housing above and below the shaft, with balls */}
          {supports.map((s) => (
            <g key={s.label}>
              {[-1, 1].map((d) => (
                <g key={d}>
                  <rect x={s.X - 14} y={d < 0 ? Y - 42 : Y + 9} width={28} height={33} rx={3} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
                  <circle cx={s.X} cy={d < 0 ? Y - 25 : Y + 26} r={8} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
                </g>
              ))}
              <text x={s.X} y={Y - 50} textAnchor="middle" className="lab">
                {s.label}
              </text>
            </g>
          ))}
          {/* gears / pulleys with their forces */}
          {ex.loads.map((l, i) => {
            if (l.kind !== 'point') return null;
            const X = sx(P(l.x));
            const pulley = !inside(P(l.x));
            return (
              <g key={i}>
                <rect x={X - (pulley ? 9 : 16)} y={Y - (pulley ? 52 : 44)} width={pulley ? 18 : 32} height={pulley ? 104 : 88} rx={pulley ? 9 : 3} fill="var(--warnbg)" stroke="var(--M)" strokeWidth={2} />
                <line x1={X} y1={40} x2={X} y2={Y - 14} stroke="var(--load)" strokeWidth={2.4} />
                <path d={`M${X} ${Y - 8} L${X - 5} ${Y - 18} L${X + 5} ${Y - 18} Z`} fill="var(--load)" />
                <text x={X > W / 2 ? X - 8 : X + 8} y={52} textAnchor={X > W / 2 ? 'end' : 'start'} className="fl">
                  {num(P(l.F))} {l.unit}
                </text>
                <text x={X} y={Y + (pulley ? 70 : 62)} textAnchor="middle" className="dimunit">
                  {pulley ? t('th.shaft.pulley') : t('th.shaft.gear')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="shaft-arrow" aria-hidden="true">
        ↓ {t('th.shaft.model')}
      </p>
      <BeamFigure ex={ex} dims="chained" symbolic />
    </div>
  );
}
