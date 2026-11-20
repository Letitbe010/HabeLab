/**
 * Theory (spec §12.1): 12 topics, Basque and Spanish. Status "draft" until the user
 * reviews the texts (§12.3). No number is written by hand in the prose: examples use
 * {{…}} variables computed by the solver from a verified pool exercise.
 */
import type { Topic } from './types';

export const TOPICS: Topic[] = [
  {
    id: 'euskarriak',
    status: 'draft',
    title: { eu: 'Habeak eta euskarriak', es: 'Vigas y apoyos' },
    blocks: [
      {
        t: 'p',
        eu: 'Euskarri batek habearen mugimendu batzuk eragozten ditu, eta eragotzitako mugimendu bakoitzeko erreakzio bat sortzen du: desplazamendu horizontala eragozteak Rx sortzen du, bertikala eragozteak Ry, eta sekzioaren biraketa (makurdura-planoko biraketa, θ) eragozteak M. Horregatik, euskarri-motak zehazten du zenbat ezezagun dauden.',
        es: 'Un apoyo impide algunos movimientos de la viga, y por cada movimiento impedido aparece una reacción: impedir el desplazamiento horizontal da Rx, el vertical da Ry, y el giro de la sección (giro en el plano de flexión, θ) da M. Por eso el tipo de apoyo determina cuántas incógnitas hay.',
      },
      { t: 'supports' },
      {
        t: 'table',
        head: [
          { eu: 'Euskarria', es: 'Apoyo' },
          { eu: 'Eragozten duena', es: 'Lo que impide' },
          { eu: 'Erreakzioak (ezezagunak)', es: 'Reacciones (incógnitas)' },
        ],
        rows: [
          [
            { eu: 'Euskarri mugikorra (gurpilak)', es: 'Apoyo móvil (rodillos)' },
            { eu: 'desplazamendu bertikala', es: 'el desplazamiento vertical' },
            { eu: 'Ry', es: 'Ry' },
          ],
          [
            { eu: 'Euskarri finkoa (artikulazioa)', es: 'Apoyo fijo (articulación)' },
            { eu: 'desplazamendu bertikala eta horizontala', es: 'los desplazamientos vertical y horizontal' },
            { eu: 'Rx eta Ry', es: 'Rx y Ry' },
          ],
          [
            { eu: 'Landaketa', es: 'Empotramiento' },
            { eu: 'bi desplazamenduak eta biraketa (θ)', es: 'los dos desplazamientos y el giro (θ)' },
            { eu: 'Rx, Ry eta M', es: 'Rx, Ry y M' },
          ],
        ],
      },
      {
        t: 'p',
        eu: 'Habe isostatikoa: hiru oreka-ekuazio (ΣFx, ΣFy, ΣM) eta hiru ezezagun. Bi konbinazio dira ohikoenak: euskarri finko bat gehi mugikor bat, edo landaketa bakarra (konsola). Karga horizontalik ez dagoenean, Rx = 0; horregatik, aplikazioan R_A idazten da R_Ay adierazteko.',
        es: 'Viga isostática: tres ecuaciones de equilibrio (ΣFx, ΣFy, ΣM) y tres incógnitas. Las dos combinaciones habituales: un apoyo fijo más uno móvil, o un único empotramiento (voladizo). Sin cargas horizontales, Rx = 0; por eso en la aplicación se escribe R_A para indicar R_Ay.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Bi euskarri mugikorrekin habea ezegonkorra da: ezerk ez du eragozten desplazamendu horizontala. Bi euskarri finkorekin, berriz, hiperestatikoa da (ezezagun bat soberan). Eta ez nahastu: «euskarri finkoa» (apoyo fijo) artikulazio bat da, eta biraketa (θ) onartzen du; landaketak ez.',
        es: 'Con dos apoyos móviles la viga es inestable: nada impide el desplazamiento horizontal. Con dos apoyos fijos, en cambio, es hiperestática (sobra una incógnita). Y no confundir: un «apoyo fijo» es una articulación y permite el giro (θ); el empotramiento no.',
      },
      {
        t: 'p',
        eu: 'Zer biraketa da hori? Habea okertzean, sekzio bakoitza deformatutako ardatzarekiko perpendikular mantentzen da, eta, horregatik, inklinatu egiten da: hori da makurdura-planoko biraketa (θ), irudiaren planoan gertatzen dena. Euskarri finkoak eta mugikorrak biraketa hori onartzen dute, eta ez dute momenturik sortzen. Landaketak eragotzi egiten du (θ = 0), eta horretarako M_A momentua egin behar du.',
        es: '¿Qué giro es ese? Al flectar la viga, cada sección se mantiene perpendicular al eje deformado y, por eso, se inclina: es el giro en el plano de flexión (θ), en el plano del dibujo. Los apoyos fijos y móviles permiten ese giro y no producen momento. El empotramiento lo impide (θ = 0) y para ello tiene que ejercer el momento M_A.',
      },
      { t: 'rotation' },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Ez nahastu bihurdurarekin (tortsioa): ardatzaren ardatz luzetarakoaren inguruko biraketa da (φ), momentu bihurtzaile batek (T) sortua. Plano-habeen ariketa hauetan ez da agertzen; makurdura-planoko biraketa bakarrik (θ).',
        es: 'No confundir con la torsión: es el giro alrededor del eje longitudinal (φ), producido por un momento torsor (T). En estos ejercicios de vigas planas no aparece; solo el giro en el plano de flexión (θ).',
      },
      {
        t: 'p',
        eu: 'Hiru habe-mota, erreakzio guztiak marraztuta (noranzko positiboan hartuta) eta oreka-ekuazioak haiekin osatuta. Momentuak euskarri batekiko hartzen dira, erloju-orratzen noranzkoa positibo.',
        es: 'Tres tipos de viga, con todas las reacciones dibujadas (tomadas en sentido positivo) y las ecuaciones de equilibrio formadas con ellas. Los momentos se toman respecto a un apoyo, con el sentido horario positivo.',
      },
      {
        t: 'fbd',
        pool: 'pool-W1',
        tex: [
          '\\textstyle\\sum F_x = 0:\\quad R_{Ax} = 0',
          '\\textstyle\\sum F_y = 0:\\quad R_{Ay} + R_{By} - P = 0',
          '\\textstyle\\sum M_A = 0\\ (\\circlearrowright+):\\quad P\\,a - R_{By}\\,L = 0 \\;\\Rightarrow\\; R_{By} = \\dfrac{P\\,a}{L},\\quad R_{Ay} = \\dfrac{P\\,b}{L}',
        ],
        eu: 'Bi euskarri (finkoa A, mugikorra B): hiru ezezagun, R_Ax, R_Ay eta R_By. Ebazlearekin: R_A = {{R_A}}, R_B = {{R_B}}.',
        es: 'Dos apoyos (fijo A, móvil B): tres incógnitas, R_Ax, R_Ay y R_By. Con el solucionador: R_A = {{R_A}}, R_B = {{R_B}}.',
      },
      {
        t: 'fbd',
        pool: 'pool-G4',
        tex: [
          '\\textstyle\\sum F_x = 0:\\quad R_{Ax} = 0',
          '\\textstyle\\sum F_y = 0:\\quad R_{Ay} + R_{By} - P = 0',
          '\\textstyle\\sum M_A = 0\\ (\\circlearrowright+):\\quad P\\,L - R_{By}\\,b = 0 \\;\\Rightarrow\\; R_{By} = \\dfrac{P\\,L}{b} > P,\\quad R_{Ay} = P - R_{By} < 0',
        ],
        eu: 'Hegala: B euskarria ez dago muturrean. R_Ay negatiboa ateratzen da, hau da, beherantz doa: R_A = {{R_A}}, R_B = {{R_B}}.',
        es: 'Voladizo: el apoyo B no está en el extremo. R_Ay sale negativa, es decir, va hacia abajo: R_A = {{R_A}}, R_B = {{R_B}}.',
      },
      {
        t: 'fbd',
        pool: 'pool-G3',
        tex: [
          '\\textstyle\\sum F_x = 0:\\quad R_{Ax} = 0',
          '\\textstyle\\sum F_y = 0:\\quad R_{Ay} - P = 0 \\;\\Rightarrow\\; R_{Ay} = P',
          '\\textstyle\\sum M_A = 0\\ (\\circlearrowright+):\\quad M_A + P\\,L = 0 \\;\\Rightarrow\\; M_A = -P\\,L',
        ],
        eu: 'Konsola: landaketak hiru ezezagun ematen ditu (R_Ax, R_Ay eta M_A). M_A negatiboa da: erlojuaren aurkako noranzkoan. Ebazlearekin: R_A = {{R_A}}, M_A = {{M_A}}.',
        es: 'Voladizo empotrado: el empotramiento da tres incógnitas (R_Ax, R_Ay y M_A). M_A es negativo: en sentido antihorario. Con el solucionador: R_A = {{R_A}}, M_A = {{M_A}}.',
      },
      { t: 'practice', worked: 'W01', level: 1 },
    ],
  },
  {
    id: 'ardatzak',
    status: 'draft',
    title: { eu: 'Ardatzak errodamenduetan: habe-eredua', es: 'Ejes sobre rodamientos: modelo de viga' },
    blocks: [
      {
        t: 'p',
        eu: 'OPEko ariketa batzuetan ez da habe bat marrazten, baizik eta ardatz bat, errodamenduetan bermatuta eta engranaje edo polea batekin. Makurdura kalkulatzeko, ardatza habe gisa eredutzen da.',
        es: 'En algunos ejercicios de la OPE no se dibuja una viga, sino un eje apoyado en rodamientos y con un engranaje o una polea. Para calcular la flexión, el eje se modeliza como una viga.',
      },
      {
        t: 'list',
        eu: [
          'Ardatzaren lerro geometrikoa da habea; distantziak errodamenduen eta engranaje/polearen erdiko planoen artean neurtzen dira.',
          'Errodamendu bakoitza euskarri sinple bat da, haren erdiko planoan. Ez du makurdura-planoko biraketa (θ) eragozten (bola-errodamendu zurrunek angelu txiki bat onartzen dute): ez da landaketa.',
          'Errodamendu bat finkoa da (kokatzailea: karga axiala hartzen du) eta bestea librea (dilatazio termikoa onartzen du): euskarri finkoa + mugikorra, habe isostatikoa.',
          'Engranaje edo polea baten indarra karga puntual bat da, haren erdiko planoan. Polea batean, uhalaren bi adarren tiraketen batura.',
          'Errodamenduetatik kanpo dagoen polea edo engranaje batek hegal bat sortzen du.',
          'Indarrek bi planotan osagaiak badituzte (indar tangentziala eta erradiala, adibidez), plano bakoitza bereiz ebazten da.',
          'Errodamenduek ez dute bihurdura eusten: ardatzak libre biratzen du haietan. Momentu bihurtzailea (T) engranajeak, poleak edo akoplamenduak transmititzen dute, eta makurdura-kalkulutik bereiz aztertzen da.',
        ],
        es: [
          'La viga es la línea media del eje; las distancias se miden entre los planos medios de los rodamientos y del engranaje o la polea.',
          'Cada rodamiento es un apoyo simple en su plano medio. No impide el giro en el plano de flexión (θ) (los rodamientos rígidos de bolas admiten un pequeño ángulo): no es un empotramiento.',
          'Un rodamiento es fijo (posicionador: toma la carga axial) y el otro libre (admite la dilatación térmica): apoyo fijo + móvil, viga isostática.',
          'La fuerza de un engranaje o de una polea es una carga puntual en su plano medio. En una polea, la suma de los tiros de los dos ramales de la correa.',
          'Una polea o un engranaje fuera de los rodamientos produce un voladizo.',
          'Si las fuerzas tienen componentes en dos planos (fuerza tangencial y radial, por ejemplo), cada plano se resuelve por separado.',
          'Los rodamientos no resisten la torsión: el eje gira libremente en ellos. El momento torsor (T) lo transmiten el engranaje, la polea o el acoplamiento, y se estudia aparte del cálculo a flexión.',
        ],
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Testu batek bi errodamenduak «apoyos fijos» direla esan dezake (adibidez, OPE Madril 2025). Euskarri finkoa artikulazio bat da, ez landaketa. Karga axialik ez dagoenean, eredu isostatikoak (finkoa + mugikorra) erreakzio bertikal berberak ematen ditu.',
        es: 'Un enunciado puede decir que los dos rodamientos son «apoyos fijos» (por ejemplo, OPE Madrid 2025). Un apoyo fijo es una articulación, no un empotramiento. Sin cargas axiales, el modelo isostático (fijo + móvil) da las mismas reacciones verticales.',
      },
      {
        t: 'shaft',
        pool: 'pool-G7',
        eu: 'OPE Madril 2025: ardatza bi errodamendutan, engranajearen indarrarekin. Eredua: euskarri finkoa + mugikorra. R_A = {{R_A}}, R_B = {{R_B}}, M_max = {{Mmax}} (x = {{xMmax}} m).',
        es: 'OPE Madrid 2025: eje sobre dos rodamientos, con la fuerza del engranaje. Modelo: apoyo fijo + móvil. R_A = {{R_A}}, R_B = {{R_B}}, M_máx = {{Mmax}} (x = {{xMmax}} m).',
      },
      {
        t: 'shaft',
        pool: 'pool-S1',
        eu: 'Polea hegalean: B errodamendutik kanpo dagoen polearen indarrak hegal bat sortzen du, eta M negatiboa da B-n. R_A = {{R_A}}, R_B = {{R_B}}, |M|max = {{Mmax}} (x = {{xMmax}} m).',
        es: 'Polea en voladizo: la fuerza de la polea, fuera del rodamiento B, crea un voladizo, y M es negativo en B. R_A = {{R_A}}, R_B = {{R_B}}, |M|máx = {{Mmax}} (x = {{xMmax}} m).',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Madrilgo ariketak, gainera, makurdurako tentsio normala (σ = M/W) eta tortsioa eskatzen zituen. Aplikazioaren hurrengo bertsio baterako geratzen dira.',
        es: 'El ejercicio de Madrid pedía además la tensión normal de flexión (σ = M/W) y la torsión. Quedan para una próxima versión de la aplicación.',
      },
      { t: 'practice', worked: 'W12', level: 1 },
    ],
  },
  {
    id: 'kargak',
    status: 'draft',
    title: { eu: 'Kargak eta haien erresultanteak', es: 'Cargas y sus resultantes' },
    blocks: [
      {
        t: 'p',
        eu: 'Karga banatu baten erresultantea karga-diagramaren azalera da, eta azalera horren zentroidean aplikatzen da.',
        es: 'La resultante de una carga distribuida es el área del diagrama de carga, y se aplica en el centroide de esa área.',
      },
      { t: 'f', tex: 'W_{\\text{unif}} = q\\,a \\quad\\text{(erdian: } a/2\\text{)}' },
      { t: 'f', tex: 'W_{\\text{triang}} = \\tfrac{1}{2}\\,q\\,a \\quad\\text{(alde handitik } a/3\\text{; txikitik } 2a/3\\text{)}' },
      {
        t: 'example',
        pool: 'pool-G5',
        eu: 'Karga triangeluarraren erresultantea {{W1}} da, eta x = {{xW1}} m-an aplikatzen da.',
        es: 'La resultante de la carga triangular es {{W1}} y se aplica en x = {{xW1}} m.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Erresultantea erreakzioak kalkulatzeko erabil daiteke. Sekzio baten barne-esfortzuak kalkulatzean, ordea, sekzioaren alde batean dagoen karga-zatiaren erresultantea bakarrik hartzen da.',
        es: 'La resultante sirve para calcular las reacciones. Al calcular los esfuerzos internos en una sección, en cambio, solo se toma la resultante de la parte de la carga que está a un lado de la sección.',
      },
      { t: 'practice', worked: 'W10', level: 3 },
    ],
  },
  {
    id: 'unitateak',
    status: 'draft',
    title: { eu: 'Unitateak', es: 'Unidades' },
    blocks: [
      {
        t: 'p',
        eu: 'OPEko enuntziatuetan kargak kg-tan agertzen dira askotan: indar gisa, kgf esan nahi dute. Emaitzak SIn eskatzen dira, beraz N-tara pasatu behar dira g-rekin biderkatuz.',
        es: 'En los enunciados de la OPE las cargas aparecen a menudo en kg: como fuerza, significan kgf. Los resultados se piden en el SI, así que hay que pasarlas a N multiplicando por g.',
      },
      { t: 'f', tex: 'F\\,[\\mathrm{N}] = m\\,[\\mathrm{kg}] \\cdot g, \\qquad 1\\ \\mathrm{kN} = 1000\\ \\mathrm{N}, \\qquad 1\\ \\mathrm{kN\\cdot m} = 1000\\ \\mathrm{N\\cdot m}' },
      {
        t: 'example',
        pool: 'pool-G1',
        eu: 'g = {{g}} m/s² erabiliz, OPE Euskadi 2022ko ariketan R_A = {{R_A}} eta R_B = {{R_B}} dira.',
        es: 'Con g = {{g}} m/s², en el ejercicio de la OPE Euskadi 2022, R_A = {{R_A}} y R_B = {{R_B}}.',
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Akats ohikoak: kg ez bihurtzea, kN eta N nahastea (mila aldiz handiagoa edo txikiagoa), eta unitaterik gabe idaztea. Ezarpenetan g aukeratu daiteke.',
        es: 'Errores habituales: no convertir los kg, mezclar kN y N (mil veces mayor o menor) y escribir sin unidades. En ajustes se puede elegir g.',
      },
      { t: 'practice', worked: 'W02', level: 1 },
    ],
  },
  {
    id: 'oreka',
    status: 'draft',
    title: { eu: 'Oreka eta erreakzioak', es: 'Equilibrio y reacciones' },
    blocks: [
      { t: 'f', tex: '\\sum F_x = 0, \\qquad \\sum F_y = 0, \\qquad \\sum M_P = 0' },
      {
        t: 'p',
        eu: 'Momentuak ezezagun bat dagoen puntu batekiko hartzen dira (adibidez euskarri batekiko): horrela ekuazioak ezezagun bakarra du. Bigarren erreakzioa ΣFy-tik ateratzen da, eta beste puntu batekiko momentuekin egiaztatzen da.',
        es: 'Los momentos se toman respecto a un punto donde hay una incógnita (por ejemplo un apoyo): así la ecuación tiene una sola incógnita. La segunda reacción sale de ΣFy y se comprueba con momentos respecto a otro punto.',
      },
      {
        t: 'example',
        pool: 'pool-G4',
        eu: 'Hegal batean erreakzio bat negatiboa izan daiteke: hemen R_A = {{R_A}} eta R_B = {{R_B}}. Zeinu negatiboak esan nahi du erreakzioa beherantz doala.',
        es: 'En un voladizo una reacción puede ser negativa: aquí R_A = {{R_A}} y R_B = {{R_B}}. El signo negativo significa que la reacción va hacia abajo.',
      },
      { t: 'practice', worked: 'W06', level: 2 },
    ],
  },
  {
    id: 'ebaketa',
    status: 'draft',
    title: { eu: 'Barne-esfortzuak: ebaketaren metodoa', es: 'Esfuerzos internos: método de las secciones' },
    blocks: [
      {
        t: 'p',
        eu: 'Habea orekan badago, haren edozein zati ere orekan dago. Sekzio batean habea "ebakitzen" bada, ezkerreko zatia orekan egoteko, ebakian indar bat (V, ebakidura-indarra) eta momentu bat (M, makurdura-momentua) behar dira.',
        es: 'Si la viga está en equilibrio, cualquier parte de ella también lo está. Si se "corta" la viga en una sección, para que la parte izquierda esté en equilibrio hacen falta en el corte una fuerza (V, esfuerzo cortante) y un momento (M, momento flector).',
      },
      {
        t: 'p',
        eu: 'Ezkerreko zatia edo eskuinekoa erabil daiteke: biek emaitza bera ematen dute (akzio-erreakzioa). Aukeratu karga gutxien duena.',
        es: 'Se puede usar la parte izquierda o la derecha: las dos dan el mismo resultado (acción-reacción). Elige la que tenga menos cargas.',
      },
      { t: 'widget', w: 'section-cut' },
      { t: 'practice', worked: 'W03', level: 2 },
    ],
  },
  {
    id: 'zeinuak',
    status: 'draft',
    title: { eu: 'Zeinu-konbentzioa', es: 'Convenio de signos' },
    blocks: [
      {
        t: 'list',
        eu: [
          'V > 0: sekzioaren ezkerreko indarren erresultantea gorantz doa.',
          'M > 0: beheko zuntza trakzioan dago (habea "irribarrea" eginez okertzen da).',
          'q > 0 beherantz; momentu puntuala M₀ > 0 erloju-orratzen noranzkoan.',
        ],
        es: [
          'V > 0: la resultante de las fuerzas a la izquierda de la sección va hacia arriba.',
          'M > 0: la fibra inferior está traccionada (la viga se curva "sonriendo").',
          'q > 0 hacia abajo; momento puntual M₀ > 0 en sentido horario.',
        ],
      },
      {
        t: 'p',
        eu: 'Liburu batzuek V-ren zeinua alderantziz hartzen dute; ingeniaritza zibilean, M positiboa ardatzaren azpian marrazten da. Biak ezarpenetan alda daitezke: balioak ez dira aldatzen, irakurketa bakarrik.',
        es: 'Algunos libros toman el signo de V al revés; en ingeniería civil, el M positivo se dibuja bajo el eje. Ambos se pueden cambiar en ajustes: los valores no cambian, solo la lectura.',
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Azterketan, idatzi zein konbentzio erabiltzen duzun: zuzentzaileak zeinuak horren arabera irakurriko ditu.',
        es: 'En el examen, escribe qué convenio usas: el corrector leerá los signos según ese convenio.',
      },
      { t: 'practice', worked: 'W08', level: 2 },
    ],
  },
  {
    id: 'erlazioak',
    status: 'draft',
    title: { eu: 'q, V eta M-ren arteko erlazioak', es: 'Relaciones entre q, V y M' },
    blocks: [
      {
        t: 'p',
        eu: 'dx luzerako elementu baten oreka planteatuz (indar bertikalak eta momentuak), bi erlazio ateratzen dira:',
        es: 'Planteando el equilibrio de un elemento de longitud dx (fuerzas verticales y momentos) salen dos relaciones:',
      },
      { t: 'f', tex: '\\frac{dV}{dx} = -q(x), \\qquad \\frac{dM}{dx} = V(x)' },
      {
        t: 'table',
        head: [
          { eu: 'Tartean…', es: 'En el tramo…' },
          { eu: 'V', es: 'V' },
          { eu: 'M', es: 'M' },
        ],
        rows: [
          [{ eu: 'kargarik ez', es: 'sin carga' }, { eu: 'konstantea', es: 'constante' }, { eu: 'lineala', es: 'lineal' }],
          [{ eu: 'karga uniformea', es: 'carga uniforme' }, { eu: 'lineala', es: 'lineal' }, { eu: 'parabola', es: 'parábola' }],
          [{ eu: 'karga triangeluarra', es: 'carga triangular' }, { eu: 'parabola', es: 'parábola' }, { eu: 'kubikoa', es: 'cúbica' }],
          [{ eu: 'karga puntuala', es: 'carga puntual' }, { eu: 'jauzia (F)', es: 'salto (F)' }, { eu: 'malda-aldaketa (ertza)', es: 'cambio de pendiente (pico)' }],
          [{ eu: 'momentu puntuala', es: 'momento puntual' }, { eu: 'aldaketarik ez', es: 'sin cambio' }, { eu: 'jauzia (M₀)', es: 'salto (M₀)' }],
          [{ eu: 'V = 0', es: 'V = 0' }, { eu: '—', es: '—' }, { eu: 'maximo/minimo lokala', es: 'máximo/mínimo local' }],
        ],
      },
      {
        t: 'p',
        eu: 'Azalera-metodoa: bi punturen artean, V diagramaren azalera = M-ren aldea; q-ren azalera = V-ren aldea (zeinu negatiboarekin). Azterketan bide azkarrena da.',
        es: 'Método de las áreas: entre dos puntos, el área del diagrama de V = la variación de M; el área de q = la variación de V (con signo negativo). En el examen es el camino más rápido.',
      },
      { t: 'practice', worked: 'W04', level: 2 },
    ],
  },
  {
    id: 'metodoa',
    status: 'draft',
    title: { eu: 'Diagramak marrazteko metodoa', es: 'Método para dibujar los diagramas' },
    blocks: [
      {
        t: 'list',
        eu: [
          'Erreakzioak kalkulatu, eta beste puntu batekiko momentuekin egiaztatu.',
          'Puntu kritikoak zerrendatu: muturrak, euskarriak, kargak, karga banatuen hasiera eta amaiera, momentu puntualak.',
          'V ezkerretik eskuinera: jauziak karga puntualetan eta erreakzioetan, malda karga banatuetan.',
          'M V-ren azaleretatik (edo tarteen ekuazioetatik); jauziak momentu puntualetan.',
          'V = 0 puntuak bilatu: M-ren muturrak.',
          'Egiaztatu: muturretan M = 0 (landaketan ez), eta azken jauziaren ondoren V = 0.',
        ],
        es: [
          'Calcular las reacciones y comprobarlas con momentos respecto a otro punto.',
          'Listar los puntos críticos: extremos, apoyos, cargas, inicio y fin de cargas distribuidas, momentos puntuales.',
          'V de izquierda a derecha: saltos en cargas puntuales y reacciones, pendiente en cargas distribuidas.',
          'M a partir de las áreas de V (o de las ecuaciones de cada tramo); saltos en los momentos puntuales.',
          'Buscar los puntos con V = 0: extremos de M.',
          'Comprobar: M = 0 en los extremos (salvo en el empotramiento), y V = 0 tras el último salto.',
        ],
      },
      { t: 'widget', w: 'free-editor' },
      { t: 'practice', worked: 'W05', level: 2 },
    ],
  },
  {
    id: 'mmax',
    status: 'draft',
    title: { eu: 'Puntu kritikoak eta M_max', es: 'Puntos críticos y M_máx' },
    blocks: [
      {
        t: 'p',
        eu: 'dM/dx = V denez, M-k mutur lokal bat du V-k zeinua aldatzen duen tokian. Karga uniformearekin, V lineala da tartean, eta V = 0 puntua zuzenean ateratzen da:',
        es: 'Como dM/dx = V, M tiene un extremo local donde V cambia de signo. Con carga uniforme, V es lineal en el tramo y el punto V = 0 sale directamente:',
      },
      { t: 'f', tex: 'x_0 = x_1 + \\frac{V(x_1^+)}{q}' },
      {
        t: 'p',
        eu: 'Karga triangeluarrarekin, V bigarren mailakoa da, eta V = 0 ekuazio koadratiko bat da. Karga puntualen azpian, berriz, V-k jauzi egiten du zeinua aldatuz: M-ren muturra ertz bat da.',
        es: 'Con carga triangular, V es de segundo grado y V = 0 es una ecuación cuadrática. Bajo las cargas puntuales, en cambio, V salta cambiando de signo: el extremo de M es un pico.',
      },
      {
        t: 'example',
        pool: 'pool-W4',
        eu: 'Karga uniforme partzialarekin, V = 0 x = {{xMmax}} m-an dago, eta M_max = {{Mmax}}.',
        es: 'Con la carga uniforme parcial, V = 0 en x = {{xMmax}} m, y M_máx = {{Mmax}}.',
      },
      { t: 'widget', w: 'moving-load' },
      { t: 'practice', worked: 'W04', level: 2 },
    ],
  },
  {
    id: 'formulak',
    status: 'draft',
    title: { eu: 'Kasu tipikoen formulak', es: 'Fórmulas de casos típicos' },
    blocks: [
      {
        t: 'p',
        eu: 'Formula hauek azterketan egiaztapen azkarrak egiteko balio dute. Bakoitza aplikazioaren ebazlearekin alderatuta dago ausazko mila kasutan.',
        es: 'Estas fórmulas sirven para comprobaciones rápidas en el examen. Cada una está contrastada con el solucionador de la aplicación en mil casos aleatorios.',
      },
      { t: 'f', tex: '\\text{Bi euskarri / dos apoyos, } P \\text{ erdian / en el centro: } M_{\\max} = \\frac{P L}{4}', check: 'pl4' },
      { t: 'f', tex: '\\text{Bi euskarri / dos apoyos, } P \\text{ (a, b): } M_{\\max} = \\frac{P a b}{L}', check: 'pab' },
      { t: 'f', tex: '\\text{Bi euskarri / dos apoyos, } q \\text{ osoa / completa: } M_{\\max} = \\frac{q L^2}{8}', check: 'ql2' },
      { t: 'f', tex: '\\text{Bi euskarri / dos apoyos, triangeluarra / triangular: } M_{\\max} = \\frac{q L^2}{9\\sqrt{3}}', check: 'tri' },
      { t: 'f', tex: '\\text{Konsola / voladizo, } P \\text{ muturrean / en el extremo: } |M|_{\\max} = P L', check: 'cant-p' },
      { t: 'f', tex: '\\text{Konsola / voladizo, } q \\text{ osoa / completa: } |M|_{\\max} = \\frac{q L^2}{2}', check: 'cant-q' },
      { t: 'widget', w: 'moving-load' },
      { t: 'practice', worked: 'W03', level: 2 },
    ],
  },
  {
    id: 'akatsak',
    status: 'draft',
    title: { eu: 'Akats ohikoak eta nola saihestu', es: 'Errores habituales y cómo evitarlos' },
    blocks: [
      {
        t: 'list',
        eu: [
          'Unitateak: kg ez bihurtzea N-tara, kN eta N nahastea, beste g bat erabiltzea.',
          'Zeinuak: V edo M-ren zeinu guztiak alderantziz (beste konbentzio bat).',
          'Erreakzioak trukatuta: momentuak puntu batekiko hartu eta beste puntuko erreakzioari esleitu.',
          'Distantziak: jatorritik metatutako neurriak tarteka balira bezala irakurtzea (edo alderantziz).',
          'Karga triangeluarra: erresultantea erdian jartzea, alde handitik a/3-ra jarri beharrean.',
          'Momentu puntuala: M-ren jauzia ahaztea edo haren noranzkoa alderantziz hartzea.',
          'Jauziak: V⁻ eta V⁺ nahastea karga puntual batean.',
          'p puntua: V edo M ondoko beste puntu kritiko batean kalkulatzea.',
        ],
        es: [
          'Unidades: no pasar los kg a N, mezclar kN y N, usar otra g.',
          'Signos: todos los signos de V o de M invertidos (otro convenio).',
          'Reacciones intercambiadas: tomar momentos respecto a un punto y asignar la reacción del otro.',
          'Distancias: leer las cotas acumuladas desde el origen como encadenadas (o al revés).',
          'Carga triangular: poner la resultante en el centro, en lugar de a a/3 del lado mayor.',
          'Momento puntual: olvidar el salto de M o tomar su sentido al revés.',
          'Saltos: confundir V⁻ y V⁺ en una carga puntual.',
          'Punto p: calcular V o M en otro punto crítico cercano.',
        ],
      },
      {
        t: 'note',
        kind: 'careful',
        eu: 'Praktikan, zuzentzaileak akats hauek automatikoki probatzen ditu eta, bat egiten badu, "dirudienez…" mezu batekin adierazten du.',
        es: 'En la práctica, el corrector prueba automáticamente estos errores y, si uno encaja, lo indica con un mensaje "parece que…".',
      },
      { t: 'practice', worked: 'W11', level: 3 },
    ],
  },
  {
    id: 'ope',
    status: 'draft',
    title: { eu: 'OPEan nola aurkeztu', es: 'Cómo presentarlo en la OPE' },
    blocks: [
      {
        t: 'list',
        eu: [
          'Gorputz askearen diagrama, erreakzioak geziekin eta haien noranzkoa adierazita.',
          'Oreka-ekuazioak zenbakiekin, eta erreakzioen egiaztapena.',
          'V eta M diagramak habearen azpian lerrokatuta, eskala berean.',
          'Balioak eta unitateak puntu kritiko guztietan; tarteen forma zuzena (zuzena, parabola, kubikoa).',
          'M_max eta haren posizioa, V = 0 kalkuluarekin.',
        ],
        es: [
          'Diagrama de sólido libre, con las reacciones como flechas e indicando su sentido.',
          'Ecuaciones de equilibrio con números, y comprobación de las reacciones.',
          'Diagramas de V y M alineados bajo la viga, a la misma escala.',
          'Valores y unidades en todos los puntos críticos; forma correcta de los tramos (recta, parábola, cúbica).',
          'M_máx y su posición, con el cálculo de V = 0.',
        ],
      },
      {
        t: 'note',
        kind: 'ope',
        eu: 'Euskadiko OPE 2020an, habe-ariketa batean, erreakzioek, V diagramak eta M diagramak puntuazioaren bosten bat, hamarren hiru eta erdia balio zuten. Aplikazioak banaketa bera erabiltzen du.',
        es: 'En la OPE de Euskadi 2020, en un ejercicio de vigas, las reacciones, el diagrama de V y el de M valían un quinto, tres décimas y la mitad de la puntuación. La aplicación usa el mismo reparto.',
      },
      { t: 'practice', worked: 'W12', level: 3 },
    ],
  },
];
