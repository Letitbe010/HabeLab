# HabeLab

**EU** — Habe isostatikoen ariketak (erreakzioak, ebakidura-indarren diagrama eta makurdura-momentuen diagrama) entrenatzeko aplikazioa, Euskadiko OPE 1508 espezialitaterako (*Fabrikazio Mekanikoaren Antolamendua eta Proiektuak*). Zuzenketa ebazle matematiko determinista batek egiten du (arrazional zehatzak), ez adimen artifizialak.

**ES** — Aplicación para entrenar ejercicios de vigas isostáticas (reacciones, diagrama de esfuerzos cortantes y diagrama de momentos flectores) para la OPE de Euskadi, especialidad 1508 (*Organización y Proyectos de Fabricación Mecánica*). La corrección la realiza un solucionador matemático determinista (racionales exactos), no una IA.

## Garapena / Desarrollo

```bash
npm install
npm run dev        # garapen-zerbitzaria / servidor de desarrollo
npm test           # testak / tests
npm run lint && npm run typecheck
npm run build
```

## Zeinu-konbentzioa / Convenio de signos

- x: ezkerreko muturretik eskuinera / de izquierda a derecha.
- V > 0: sekzioaren ezkerreko indarren erresultantea gorantz / resultante de fuerzas a la izquierda hacia arriba.
- M > 0: beheko zuntza trakzioan / fibra inferior traccionada.
- q > 0 beherantz / hacia abajo; M₀ > 0 erloju-orratzen noranzkoan / horario. dV/dx = −q, dM/dx = V.

## Lizentzia / Licencia

Kodea / Código: MIT. Edukia / Contenido: CC BY-SA 4.0. Ikus / Ver `LICENSE`.
