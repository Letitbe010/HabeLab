/**
 * Statement figure (spec §6.3): textbook-style SVG with normalised supports, load arrows
 * with value and unit, distributed loads as arrow fields (variable height for linear
 * loads), point moments as curved arrows, named points, and dimension lines:
 * chained (segment lengths) and/or cumulative (coordinate of every point from x = 0).
 * With `reactions`, it draws the free-body diagram: reactions as green arrows.
 */
import type { Exercise, ExerciseLoad } from '../core/model';
import type { Reaction } from '../core/solverAnalytic';
import * as R from '../core/rational';
import { useT } from '../i18n';
import { type DisplayUnits, fmtF, fmtM, num, useFigWidth } from './format';

export const PAD_L = 40;
export const PAD_R = 40;
const BEAM_Y = 112;

const P = (s: string) => R.toNumber(R.parse(s));

interface Props {
  ex: Exercise;
  dims?: 'both' | 'chained' | 'cumulative' | 'none';
  reactions?: Reaction[];
  units?: DisplayUnits;
}

function Arrow({ x, y1, y2, color, w = 2 }: { x: number; y1: number; y2: number; color: string; w?: number }) {
  // arrow from y1 to y2 (head at y2)
  const dir = y2 > y1 ? 1 : -1;
  return (
    <g stroke={color} fill={color}>
      <line x1={x} y1={y1} x2={x} y2={y2 - dir * 7} strokeWidth={w} />
      <path d={`M${x} ${y2} L${x - 5} ${y2 - dir * 9} L${x + 5} ${y2 - dir * 9} Z`} stroke="none" />
    </g>
  );
}

export function BeamFigure({ ex, dims = 'both', reactions, units }: Props) {
  const { t } = useT();
  const FIG_W = useFigWidth();
  const L = P(ex.beam.length);
  const span = FIG_W - PAD_L - PAD_R;
  const sx = (x: number) => PAD_L + (span * x) / L;
  const fbd = !!reactions;

  // dimension ticks: every relevant position
  const ticks = new Set<number>([0, L]);
  ex.beam.supports.forEach((s) => ticks.add(P(s.x)));
  ex.loads.forEach((l) => (l.kind === 'point' || l.kind === 'moment' ? ticks.add(P(l.x)) : (ticks.add(P(l.x1)), ticks.add(P(l.x2)))));
  ex.points?.forEach((p) => ticks.add(P(p.x)));
  const tk = [...ticks].sort((a, b) => a - b);

  const showChained = dims === 'both' || dims === 'chained';
  const showCum = dims === 'both' || dims === 'cumulative';
  const yChain = fbd ? 230 : 182;
  const yCum = showChained ? yChain + 38 : yChain;
  const H = (showCum ? yCum : showChained ? yChain : fbd ? 215 : 165) + 26;

  const maxQ = Math.max(
    1e-9,
    ...ex.loads.flatMap((l) => (l.kind === 'udl' ? [Math.abs(P(l.q))] : l.kind === 'linear' ? [Math.abs(P(l.q1)), Math.abs(P(l.q2))] : [])),
  );

  const loadLabel = (l: ExerciseLoad): string => {
    switch (l.kind) {
      case 'point':
        return `${num(P(l.F))} ${l.unit}`;
      case 'udl':
        return `${num(P(l.q))} ${l.unit}`;
      case 'linear':
        return '';
      case 'moment':
        return `${num(Math.abs(P(l.M)))} ${l.unit}`;
    }
  };

  const desc = [
    `L = ${num(L)} m`,
    ...ex.beam.supports.map((s) => `${s.label} (${s.type}) x = ${num(P(s.x))} m`),
    ...ex.loads.map((l) => `${l.kind} ${loadLabel(l)}`),
  ].join('; ');

  return (
    <div className="fig-box">
      <svg viewBox={`0 0 ${FIG_W} ${H}`} role="img" aria-label={`${t('fig.label')}: ${desc}`}>
        {/* distributed loads */}
        {ex.loads.map((l, i) => {
          if (l.kind !== 'udl' && l.kind !== 'linear') return null;
          const x1 = P(l.x1);
          const x2 = P(l.x2);
          const q1 = l.kind === 'udl' ? P(l.q) : P(l.q1);
          const q2 = l.kind === 'udl' ? P(l.q) : P(l.q2);
          const hOf = (q: number) => (46 * Math.abs(q)) / maxQ;
          const base = BEAM_Y - 8;
          const n = Math.max(2, Math.round((sx(x2) - sx(x1)) / 22));
          const arrows = [];
          for (let k = 0; k <= n; k++) {
            const x = x1 + ((x2 - x1) * k) / n;
            const q = q1 + ((q2 - q1) * k) / n;
            const h = hOf(q);
            if (h > 5) arrows.push(<Arrow key={k} x={sx(x)} y1={base - h} y2={base} color="var(--load)" w={1.4} />);
          }
          return (
            <g key={`d${i}`}>
              <polygon points={`${sx(x1)},${base} ${sx(x1)},${base - hOf(q1)} ${sx(x2)},${base - hOf(q2)} ${sx(x2)},${base}`} fill="var(--load)" opacity={0.07} />
              <line x1={sx(x1)} y1={base - hOf(q1)} x2={sx(x2)} y2={base - hOf(q2)} stroke="var(--load)" strokeWidth={1.6} />
              {arrows}
              {l.kind === 'udl' ? (
                <text x={(sx(x1) + sx(x2)) / 2} y={base - hOf(q1) - 6} textAnchor="middle" className="fl">
                  {loadLabel(l)}
                </text>
              ) : (
                <>
                  {Math.abs(q1) > 0 && (
                    <text x={sx(x1)} y={base - hOf(q1) - 6} textAnchor="start" className="fl">
                      {num(q1)} {l.unit}
                    </text>
                  )}
                  {Math.abs(q2) > 0 && (
                    <text x={sx(x2)} y={base - hOf(q2) - 6} textAnchor="end" className="fl">
                      {num(q2)} {l.unit}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* beam */}
        <rect x={sx(0)} y={BEAM_Y - 6} width={span} height={12} fill="#dfe5ee" stroke="var(--ink)" strokeWidth={1.5} rx={2} />

        {/* supports */}
        {ex.beam.supports.map((s, i) => {
          const X = sx(P(s.x));
          const faded = fbd ? 0.35 : 1;
          if (s.type === 'fixed') {
            const left = P(s.x) === 0;
            const d = left ? -1 : 1;
            return (
              <g key={`s${i}`} opacity={faded} stroke="var(--ink)">
                <line x1={X} y1={BEAM_Y - 34} x2={X} y2={BEAM_Y + 34} strokeWidth={2.5} />
                {Array.from({ length: 8 }, (_, k) => (
                  <line key={k} x1={X} y1={BEAM_Y - 30 + k * 9} x2={X + d * 10} y2={BEAM_Y - 22 + k * 9} strokeWidth={1.2} />
                ))}
                <text x={X - d * 12} y={BEAM_Y - 40} textAnchor="middle" className="lab" stroke="none">
                  {s.label}
                </text>
              </g>
            );
          }
          const top = BEAM_Y + 6;
          const triH = s.type === 'pin' ? 24 : 18;
          const groundY = s.type === 'pin' ? top + triH + 3 : top + triH + 11;
          return (
            <g key={`s${i}`} opacity={faded}>
              <path d={`M${X} ${top} L${X - 13} ${top + triH} L${X + 13} ${top + triH} Z`} fill="#fff" stroke="var(--ink)" strokeWidth={1.6} />
              {s.type === 'roller' && (
                <>
                  <circle cx={X - 6} cy={top + triH + 5} r={4} fill="#fff" stroke="var(--ink)" strokeWidth={1.3} />
                  <circle cx={X + 6} cy={top + triH + 5} r={4} fill="#fff" stroke="var(--ink)" strokeWidth={1.3} />
                </>
              )}
              <line x1={X - 18} y1={groundY} x2={X + 18} y2={groundY} stroke="var(--ink)" strokeWidth={1.6} />
              {Array.from({ length: 5 }, (_, k) => (
                <line key={k} x1={X - 16 + k * 8} y1={groundY} x2={X - 22 + k * 8} y2={groundY + 7} stroke="var(--ink)" strokeWidth={1} />
              ))}
              <text x={X} y={groundY + 21} textAnchor="middle" className="lab">
                {s.label}
              </text>
            </g>
          );
        })}

        {/* point loads and moments */}
        {ex.loads.map((l, i) => {
          if (l.kind === 'point') {
            const X = sx(P(l.x));
            const down = P(l.F) >= 0;
            return (
              <g key={`p${i}`}>
                {down ? (
                  <Arrow x={X} y1={30} y2={BEAM_Y - 7} color="var(--load)" w={2.4} />
                ) : (
                  <Arrow x={X} y1={BEAM_Y - 7} y2={30} color="var(--load)" w={2.4} />
                )}
                <text x={X} y={22} textAnchor="middle" className="fl">
                  {loadLabel(l)}
                </text>
              </g>
            );
          }
          if (l.kind === 'moment') {
            const X = sx(P(l.x));
            const cw = P(l.M) >= 0;
            const r = 22;
            // arc over the top, from left to right (cw) or right to left (ccw)
            const a0 = cw ? Math.PI * 0.95 : Math.PI * 0.05;
            const a1 = cw ? Math.PI * 0.05 : Math.PI * 0.95;
            const p0 = [X + r * Math.cos(a0), BEAM_Y - r * Math.sin(a0)] as const;
            const p1 = [X + r * Math.cos(a1), BEAM_Y - r * Math.sin(a1)] as const;
            const head = cw ? `M${p1[0]} ${p1[1] + 7} L${p1[0] - 6} ${p1[1] - 4} L${p1[0] + 5} ${p1[1] - 3} Z` : `M${p1[0]} ${p1[1] + 7} L${p1[0] + 6} ${p1[1] - 4} L${p1[0] - 5} ${p1[1] - 3} Z`;
            return (
              <g key={`m${i}`} stroke="var(--load)" fill="none">
                <path d={`M${p0[0]} ${p0[1]} A ${r} ${r} 0 0 ${cw ? 1 : 0} ${p1[0]} ${p1[1]}`} strokeWidth={2.2} />
                <path d={head} fill="var(--load)" stroke="none" />
                <circle cx={X} cy={BEAM_Y} r={2.5} fill="var(--load)" stroke="none" />
                <text x={X} y={BEAM_Y - r - 10} textAnchor="middle" className="fl" stroke="none" fill="var(--load)">
                  {loadLabel(l)} {cw ? '↻' : '↺'}
                </text>
              </g>
            );
          }
          return null;
        })}

        {/* named points */}
        {ex.points?.map((p) => (
          <g key={p.label}>
            <circle cx={sx(P(p.x))} cy={BEAM_Y} r={4.5} fill="var(--ink)" />
            <text x={sx(P(p.x)) + 7} y={BEAM_Y - 9} className="lab">
              {p.label}
            </text>
          </g>
        ))}

        {/* reactions (free-body diagram) */}
        {reactions?.map((r) => {
          const X = sx(R.toNumber(r.x));
          const v = R.toNumber(r.R);
          const up = v >= 0;
          const lab = units ? `R${r.label} = ${fmtF(v, units)}` : `R${r.label}`;
          return (
            <g key={`r${r.label}`}>
              {Math.abs(v) > 1e-9 && (up ? <Arrow x={X} y1={BEAM_Y + 72} y2={BEAM_Y + 8} color="var(--react)" w={2.6} /> : <Arrow x={X} y1={BEAM_Y + 8} y2={BEAM_Y + 72} color="var(--react)" w={2.6} />)}
              <text x={X} y={BEAM_Y + 90} textAnchor={X < FIG_W / 2 ? 'start' : 'end'} className="fr">
                {lab}
              </text>
              {r.M && Math.abs(R.toNumber(r.M)) > 1e-9 && units && (
                <text x={X} y={BEAM_Y + 108} textAnchor={X < FIG_W / 2 ? 'start' : 'end'} className="fr">
                  M{r.label} = {fmtM(R.toNumber(r.M), units)} {R.toNumber(r.M) >= 0 ? '↻' : '↺'}
                </text>
              )}
            </g>
          );
        })}

        {/* dimension lines */}
        {showChained && (
          <g className="dim">
            <line x1={sx(0)} y1={yChain} x2={sx(L)} y2={yChain} />
            {tk.map((x) => (
              <line key={x} x1={sx(x)} y1={yChain - 6} x2={sx(x)} y2={yChain + 6} />
            ))}
            {tk.slice(1).map((x, i) => {
              const a = tk[i] as number;
              return (
                <text key={`c${x}`} x={(sx(a) + sx(x)) / 2} y={yChain - 6} textAnchor="middle">
                  {num(x - a)}
                </text>
              );
            })}
          </g>
        )}
        {showCum && (
          <g className="dim">
            <line x1={sx(0)} y1={yCum} x2={sx(L)} y2={yCum} />
            {tk.map((x) => (
              <g key={`k${x}`}>
                <line x1={sx(x)} y1={yCum - 6} x2={sx(x)} y2={yCum + 6} />
                <text x={sx(x)} y={yCum + 19} textAnchor="middle">
                  {num(x)}
                </text>
              </g>
            ))}
          </g>
        )}
        {(showChained || showCum) && (
          <text x={FIG_W - 4} y={H - 4} textAnchor="end" className="dimunit">
            m
          </text>
        )}
      </svg>
    </div>
  );
}
