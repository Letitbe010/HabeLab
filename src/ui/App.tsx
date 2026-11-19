const COMMIT = (import.meta.env.VITE_COMMIT as string | undefined)?.slice(0, 7) ?? 'dev';

export function App() {
  return (
    <main className="hello">
      <h1>HabeLab</h1>
      <p lang="eu">Kaixo! Habe isostatikoen ariketak entrenatzeko aplikazioa (garapenean).</p>
      <p lang="es">¡Hola! Aplicación para entrenar ejercicios de vigas isostáticas (en desarrollo).</p>
      <p className="meta">v0.1.0 · {COMMIT}</p>
    </main>
  );
}
