import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { escaparHtml as e } from './texto.js';

// opciones: { titulo, nota, dia, agruparPorFuente }
export async function generarInforme(ruta, registros, opciones) {
  const { titulo, nota, dia, agruparPorFuente = false } = opciones;

  let cuerpo;
  if (registros.length === 0) {
    cuerpo = '<p>No hay resultados para hoy.</p>';
  } else if (agruparPorFuente) {
    const grupos = Map.groupBy(registros, (r) => r.fuente);
    cuerpo = [...grupos].map(([fuente, lista]) => `
  <section>
    <h2 class="grupo">${e(fuente)} <span>${lista.length}</span></h2>
    ${lista.map((r) => tarjeta(r, false)).join('')}
  </section>`).join('');
  } else {
    cuerpo = registros.map((r) => tarjeta(r, true)).join('');
  }

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titulo)} ${e(dia)}</title>
<style>
  :root { --fondo: #f6f7f9; --tarjeta: #fff; --texto: #1d2330; --suave: #5b6475; --acento: #1f5fbf; --borde: #e2e5ea; }
  @media (prefers-color-scheme: dark) {
    :root { --fondo: #14171c; --tarjeta: #1d2128; --texto: #e7e9ee; --suave: #9aa3b2; --acento: #7aa8ff; --borde: #2c313a; }
  }
  body { margin: 0; background: var(--fondo); color: var(--texto); font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px; }
  header h1 { margin: 0 0 4px; font-size: 1.6rem; }
  header p { margin: 0 0 24px; color: var(--suave); font-size: .9rem; }
  h2.grupo { font-size: 1.1rem; margin: 28px 0 10px; }
  h2.grupo span { font-weight: normal; color: var(--suave); font-size: .9rem; }
  article { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; }
  .meta { color: var(--suave); font-size: .8rem; }
  h3 { font-size: 1.02rem; margin: 4px 0 6px; }
  a { color: var(--acento); text-decoration: none; }
  a:hover { text-decoration: underline; }
  p { margin: 0 0 8px; color: var(--suave); }
  blockquote { margin: 8px 0; padding: 2px 0 2px 10px; border-left: 3px solid var(--acento); font-size: .92rem; }
  .tags span { display: inline-block; font-size: .75rem; border: 1px solid var(--borde); border-radius: 99px; padding: 1px 8px; margin-right: 4px; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${e(titulo)} · ${e(dia)}</h1>
    <p>${registros.length} resultados${nota ? ` · ${e(nota)}` : ''}</p>
  </header>
  ${cuerpo}
</main>
</body>
</html>`;

  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, html, 'utf8');
}

function tarjeta(r, mostrarFuente) {
  const meta = [mostrarFuente && r.fuente, r.organismo, formatearFecha(r.fecha)].filter(Boolean);
  return `
    <article>
      <div class="meta">${meta.map(e).join(' · ')}</div>
      <h3><a href="${e(r.enlace)}" target="_blank" rel="noopener">${e(r.titulo)}</a></h3>
      ${r.fragmento ? `<p>${e(r.fragmento)}</p>` : ''}
      ${(r.parrafos ?? []).map((p) => `<blockquote>${e(p)}</blockquote>`).join('')}
      <div class="tags">${r.coincidencias.split(', ').map((c) => `<span>${e(c)}</span>`).join('')}</div>
    </article>`;
}

function formatearFecha(iso) {
  if (!iso) return 'sin fecha';
  // Fechas sin hora (AAAA-MM-DD) se muestran solo como día.
  if (iso.length === 10) return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { dateStyle: 'medium' });
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}
