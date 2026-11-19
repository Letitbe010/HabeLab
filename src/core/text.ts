/**
 * Exercise statements in Basque (default) and Spanish, built from the exercise data
 * (spec §11.2 terminology). Numbers use the decimal comma; distances are always
 * measured from the LEFT END of the beam (stated explicitly in the text).
 *
 * The value of g is a setting, so statements contain the placeholder {{g}}, replaced at
 * display time by renderText().
 *
 * Basque unit suffixes are avoided on purpose ("karga puntuala: 5 kN") so that no
 * declension of unit symbols is needed.
 *
 * Status: draft. The user reviews wording and terminology (spec §12.3).
 */

import type { Exercise, ExerciseLoad, ExerciseSupport } from './model';
import * as R from './rational';
import { type GSetting, formatSmart, gValue } from './units';

const n = (s: string): string => formatSmart(R.parse(s));
const abs = (s: string): string => (s.startsWith('-') ? s.slice(1) : s);

function supportText(s: ExerciseSupport): { eu: string; es: string } {
  const x = n(s.x);
  switch (s.type) {
    case 'pin':
      return { eu: `${s.label}: euskarri finkoa (x = ${x} m)`, es: `${s.label}: apoyo fijo (x = ${x} m)` };
    case 'roller':
      return { eu: `${s.label}: euskarri mugikorra (x = ${x} m)`, es: `${s.label}: apoyo móvil (x = ${x} m)` };
    case 'fixed':
      return { eu: `${s.label}: landaketa (x = ${x} m)`, es: `${s.label}: empotramiento (x = ${x} m)` };
  }
}

function loadText(l: ExerciseLoad): { eu: string; es: string } {
  switch (l.kind) {
    case 'point':
      return {
        eu: `karga puntuala: ${n(l.F)} ${l.unit}, beherantz, x = ${n(l.x)} m-an`,
        es: `carga puntual de ${n(l.F)} ${l.unit}, hacia abajo, en x = ${n(l.x)} m`,
      };
    case 'udl':
      return {
        eu: `karga uniformea: ${n(l.q)} ${l.unit}, beherantz, x = ${n(l.x1)} m-tik x = ${n(l.x2)} m-ra`,
        es: `carga uniforme de ${n(l.q)} ${l.unit}, hacia abajo, entre x = ${n(l.x1)} m y x = ${n(l.x2)} m`,
      };
    case 'linear':
      return {
        eu: `karga linealki aldakorra, beherantz: ${n(l.q1)} ${l.unit} x = ${n(l.x1)} m-an eta ${n(l.q2)} ${l.unit} x = ${n(l.x2)} m-an`,
        es: `carga linealmente variable, hacia abajo: ${n(l.q1)} ${l.unit} en x = ${n(l.x1)} m y ${n(l.q2)} ${l.unit} en x = ${n(l.x2)} m`,
      };
    case 'moment': {
      const cw = !l.M.startsWith('-');
      return {
        eu: `momentu puntuala: ${n(abs(l.M))} ${l.unit}, ${cw ? 'erloju-orratzen noranzkoan' : 'erloju-orratzen aurkako noranzkoan'}, x = ${n(l.x)} m-an`,
        es: `momento puntual de ${n(abs(l.M))} ${l.unit}, en sentido ${cw ? 'horario' : 'antihorario'}, en x = ${n(l.x)} m`,
      };
    }
  }
}

export function exerciseText(ex: Exercise): { eu: string; es: string } {
  const L = n(ex.beam.length);
  const sup = ex.beam.supports.map(supportText);
  const loads = ex.loads.map(loadText);
  const kg = ex.loads.some((l) => l.unit.startsWith('kg'));
  const p = ex.points?.[0];

  let askEu: string;
  let askEs: string;
  if (ex.ask.pointValues?.length && p) {
    askEu = `Kalkulatu ebakidura-indarra (indar ebakitzailea) eta makurdura-momentua ${p.label} puntuan (x = ${n(p.x)} m), SIko unitateetan.`;
    askEs = `Calcula el esfuerzo cortante y el momento flector en el punto ${p.label} (x = ${n(p.x)} m), en unidades del SI.`;
  } else if (ex.ask.mmax) {
    askEu = 'Kalkulatu erreakzioak eta makurdura-momentu maximoa (balio absolutuan), eta adierazi non gertatzen den.';
    askEs = 'Calcula las reacciones y el momento flector máximo (en valor absoluto), e indica dónde se produce.';
  } else if (ex.ask.equations) {
    askEu = 'Kalkulatu erreakzioak eta idatzi tarte bakoitzeko V(x) eta M(x) ekuazioak.';
    askEs = 'Calcula las reacciones y escribe las ecuaciones V(x) y M(x) de cada tramo.';
  } else {
    askEu =
      'Kalkulatu erreakzioak eta marraztu ebakidura-indarren eta makurdura-momentuen diagramak, puntu kritikoetako balioak eta unitateak (SI) adieraziz.';
    askEs =
      'Calcula las reacciones y dibuja los diagramas de esfuerzos cortantes y de momentos flectores, indicando los valores en los puntos críticos y sus unidades (SI).';
  }

  const eu = [
    `${L} m-ko habea. x koordenatua habearen ezkerreko muturretik neurtzen da.`,
    `Euskarriak: ${sup.map((s) => s.eu).join('; ')}.`,
    `Kargak: ${loads.map((l) => l.eu).join('; ')}.`,
    kg ? 'Hartu g = {{g}} m/s².' : '',
    askEu,
  ];
  const es = [
    `Viga de ${L} m. La coordenada x se mide desde el extremo izquierdo de la viga.`,
    `Apoyos: ${sup.map((s) => s.es).join('; ')}.`,
    `Cargas: ${loads.map((l) => l.es).join('; ')}.`,
    kg ? 'Toma g = {{g}} m/s².' : '',
    askEs,
  ];
  return { eu: eu.filter(Boolean).join(' '), es: es.filter(Boolean).join(' ') };
}

/** Replace template variables ({{g}}) for display. */
export function renderText(text: string, g: GSetting): string {
  return text.replace(/\{\{g\}\}/g, formatSmart(gValue(g)));
}
