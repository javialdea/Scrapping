// Clipping de medios en modo seguro: solo se guarda titular, fragmento corto y enlace.
// Nunca se descarga ni se almacena el texto completo de los artículos.
import path from 'node:path';
import Parser from 'rss-parser';
import { leerJson } from '../lib/archivos.js';
import { normalizar, limpiarHtml, recortar, buscarPalabras } from '../lib/texto.js';
import { RAIZ, carpetaResultados, cargarVistos, guardarVistos, guardarDelDia, esperar } from '../lib/salida.js';

const RUTA_CONFIG = path.join(RAIZ, 'config', 'clipping.json');
const CARPETA = carpetaResultados('clipping');

export async function ejecutar() {
  const { guardar } = await recoger();
  await guardar();
}

// Devuelve los recortes nuevos y una función para guardarlos y marcarlos como vistos.
export async function recoger() {
  const config = await leerJson(RUTA_CONFIG);
  const parser = new Parser({
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClippingInterno/0.1)' },
    customFields: { item: ['source'] },
  });

  const vistos = await cargarVistos(CARPETA);
  const fuentes = [
    ...config.fuentes,
    ...config.busquedasGoogleNews.map((q) => ({
      nombre: `Google News: ${q}`,
      rss: urlGoogleNews(q),
      busqueda: q,
    })),
  ];

  const nuevos = [];
  for (const fuente of fuentes) {
    try {
      const feed = await parser.parseURL(fuente.rss);
      let relevantes = 0;
      for (const item of feed.items) {
        const recorte = procesar(item, fuente, config);
        if (!recorte) continue;
        // Se descarta si ya salió por el enlace o por el mismo titular en otro medio.
        const claves = [recorte.enlace, normalizar(recorte.titulo)].filter(Boolean);
        if (claves.some((c) => vistos.has(c))) continue;
        claves.forEach((c) => vistos.add(c));
        nuevos.push(recorte);
        relevantes++;
      }
      console.log(`✔ ${fuente.nombre}: ${feed.items.length} noticias, ${relevantes} nuevas relevantes`);
    } catch (err) {
      console.warn(`✖ ${fuente.nombre}: ${err.message}`);
    }
    await esperar(config.pausaEntreFuentesMs);
  }

  const guardar = async () => {
    await guardarDelDia(CARPETA, nuevos, {
      titulo: 'Clipping de medios',
      nota: 'Uso interno: solo titular, fragmento y enlace a la fuente original.',
    });
    await guardarVistos(CARPETA, vistos);
  };
  return { nuevos, guardar };
}

function procesar(item, fuente, config) {
  const medio = medioDe(item, fuente);
  let titulo = limpiarHtml(item.title);
  if (!titulo) return null;
  // Google News añade " - Medio" al final del titular.
  if (medio && titulo.endsWith(` - ${medio}`)) titulo = titulo.slice(0, -(medio.length + 3));

  const resumen = item.contentSnippet || limpiarHtml(item.content || item.summary || '');
  // También se filtran los resultados de Google News: Google no distingue "ONCE" de "once".
  const coincidencias = buscarPalabras(`${titulo} ${resumen}`, config.palabrasClave);
  if (coincidencias.length === 0) return null;

  return {
    fecha: item.isoDate ?? '',
    fuente: medio,
    organismo: '',
    titulo,
    // Google News repite el titular como resumen; en ese caso no aporta nada.
    fragmento: resumen.startsWith(titulo) ? '' : recortar(resumen, config.fragmentoMaxCaracteres),
    enlace: item.link ?? '',
    coincidencias: coincidencias.join(', '),
  };
}

function medioDe(item, fuente) {
  if (!fuente.busqueda) return fuente.nombre;
  const source = item.source;
  return (typeof source === 'string' ? source : source?._) || 'Google News';
}

// `when:1d` limita la búsqueda a las últimas 24 horas; sin él Google devuelve noticias antiguas.
function urlGoogleNews(consulta) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${consulta} when:1d`)}&hl=es&gl=ES&ceid=ES:es`;
}
