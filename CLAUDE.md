# HabeLab – arau nagusiak
Espezifikazio osoa: `../HabeLab_argibideak.md`.

- Zehaztasuna > dena. core/-n akats batek erabiltzailearen ikaskuntza hondatzen du.
- Barne-unitateak: N, m. Aritmetika: arrazional zehatzak (src/core/rational.ts).
- Zeinu-konbentzioa: V+ = ezkerreko erresultantea gorantz; M+ = beheko zuntza trakzioan;
  q>0 beherantz; M₀>0 erloju-orratzen noranzkoan. dV/dx=-q, dM/dx=V.
- Landaketaren erreakzio-momentua (M_landaketa): erloju-orratzen noranzkoan +, M₀-ren konbentzio bera
  (erabiltzaileak berretsia, 2026-11-19). Ezkerrean = M(0⁺); eskuinean = −M(L⁻).
- Bi ebazle independente (A analitikoa, B zenbakizkoa) + Python orakulua. Bat ez badatoz → errorea.
- Golden testak (tests/golden) ez dira inoiz aldatzen inplementazioari egokitzeko.
- Zuzenketan ez da AArik erabiltzen.
- UI elebiduna: eu (lehenetsia) / es. Terminologia: espezifikazioko §11.2.
- Fase bat ez da amaitutzat jotzen bere test guztiak berde egon arte.
- Teoriako eta ebatzietako zenbakiak beti ebazletik txertatzen dira (txantiloiak), inoiz ez eskuz.
- Lau atal: Teoria, Ebatziak, Praktika, Aurrerapena. Nabigazioa: behe-barra (mugikorra) / alboko barra (mahaigaina).
- GitHub: biltegia sortu edo push egin aurretik, erabiltzaileari baieztapena eskatu. Despliegea Pages-era, CI berde badago soilik.
- core/-k ez du UIren ezer inportatzen (ESLint-ek debekatzen du).
- Kodea, iruzkinak eta commit-mezuak ingelesez. Commit-egilea: Letitbe010 noreply helbidearekin.
- Testuen berrikuspena: `#/berrikusi` (garapen-moduan bakarrik, `npm run dev`). Egoerak `src/data/review-status.json`-en, oharrak `src/data/review-notes.json`-en. Pool-a birsortzean (GEN_POOL=1) ID berriak gehitu review-status.json-era (testak eskatzen du). Erabiltzailearen oharrak aplikatu eta zerrenda hustu.
