# HabeLab

**EU** — Habe isostatikoen ariketak (erreakzioak, ebakidura-indarren diagrama eta makurdura-momentuen diagrama) entrenatzeko aplikazioa, Euskadiko OPE 1508 espezialitaterako (*Fabrikazio Mekanikoaren Antolamendua eta Proiektuak*). Zuzenketa ebazle matematiko determinista batek egiten du (arrazional zehatzak), ez adimen artifizialak.

**ES** — Aplicación para entrenar ejercicios de vigas isostáticas (reacciones, diagrama de esfuerzos cortantes y diagrama de momentos flectores) para la OPE de Euskadi, especialidad 1508 (*Organización y Proyectos de Fabricación Mecánica*). La corrección la realiza un solucionador matemático determinista (racionales exactos), no una IA.

Aplikazioa / Aplicación: https://letitbe010.github.io/HabeLab/ (lehen despliegearen ondoren / tras el primer despliegue)

## Garapena / Desarrollo

```bash
npm install
npm run dev        # garapen-zerbitzaria / servidor de desarrollo
npm test           # testak / tests
npm run lint && npm run typecheck
npm run build
```

### Python orakulua / Oráculo Python (SymPy)

```bash
python -m venv tools/oracle/.venv
tools/oracle/.venv/Scripts/python -m pip install -r tools/oracle/requirements.txt   # Windows
tools/oracle/.venv/Scripts/python tools/oracle/beams.py tools/oracle/out/oracle.json tests/golden/golden.json src/data/pool.json tests/oracle/random-beams.json
ORACLE_REQUIRED=1 npm run oracle
```

(`npm run oracle:py` CIrako da: `python`-ek SymPy instalatuta izan behar du. / `npm run oracle:py` es para CI: `python` debe tener SymPy.)

## Zeinu-konbentzioa / Convenio de signos

- x: ezkerreko muturretik eskuinera / de izquierda a derecha.
- V > 0: sekzioaren ezkerreko indarren erresultantea gorantz / resultante de fuerzas a la izquierda hacia arriba.
- M > 0: beheko zuntza trakzioan / fibra inferior traccionada.
- q > 0 beherantz / hacia abajo; M₀ > 0 erloju-orratzen noranzkoan / horario. dV/dx = −q, dM/dx = V.

## Lizentzia / Licencia

Kodea / Código: MIT. Edukia / Contenido: CC BY-SA 4.0. Ikus / Ver `LICENSE`.
