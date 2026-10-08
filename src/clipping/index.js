// Clipping de medios en modo seguro: se guarda titular, fragmento corto y enlace.
// Solo para los nombres de `textoCompleto` se lee el artículo, y de él únicamente se
// conservan los párrafos donde aparecen.
import path from 'node:path';
import Parser from 'rss-parser';
import { leerJson } from '../lib/archivos.js';
import { normalizar, limpiarHtml, recortar, buscarPalabras } from '../lib/texto.js';
import { RAIZ, carpetaResultados, cargarVistos, guardarVistos, guardarDelDia, esperar } from '../lib/salida.js';
import { resolverEnlace, buscarEnArticulo } from './articulo.js';

const RUTA_CONFIG = path.join(RAIZ, 'config', 'clipping.json');
const CARPETA = carpetaResultados('clipping');

export async function ejecutar() {
  const { guardar } = await recoger();
  await guardar();
}

// Devuelve los recortes nuevos y una función para guardarlos y marcarlos como vistos.
export async function recoger() {
  const config = await leerJson(RUTA_CONFIG);
  const textoCompleto = { nombres: [], tambienEnNoticiasDe: [], maxParrafos: 3, ...config.textoCompleto };
  const parser = new Parser({
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClippingInterno/0.1)' },
    customFields: { item: ['source'] },
  });

  const vistos = await cargarVistos(CARPETA);
  const fuentes = [
    ...config.fuentes.map((f) => ({ ...f, etiqueta: f.nombre })),
    ...config.busquedasGoogleNews.map((q) => fuenteGoogle(q)),
    // Google busca en el texto completo, así que encuentra menciones que no están en el titular.
    ...textoCompleto.nombres.map((n) => fuenteGoogle(`"${n}"`, n)),
  ];

  const nuevos = [];
  for (const fuente of fuentes) {
    try {
      const feed = await parser.parseURL(fuente.rss);
      let relevantes = 0;
      for (const item of feed.items) {
        const recorte = procesar(item, fuente, config);
        // Lo que sale buscando un nombre se queda pendiente de comprobar en el artículo.
        if (!recorte || (recorte.coincidencias.length === 0 && !fuente.nombreBuscado)) continue;
        // Se descarta si ya salió por el enlace o por el mismo titular en otro medio.
        const claves = [recorte.enlace, normalizar(recorte.titulo)].filter(Boolean);
        if (claves.some((c) => vistos.has(c))) continue;
        claves.forEach((c) => vistos.add(c));
        nuevos.push(recorte);
        relevantes++;
      }
      console.log(`✔ ${fuente.etiqueta}: ${feed.items.length} noticias, ${relevantes} nuevas`);
    } catch (err) {
      console.warn(`✖ ${fuente.etiqueta}: ${err.message}`);
    }
    await esperar(config.pausaEntreFuentesMs);
  }

  const confirmados = await revisarTextoCompleto(nuevos, textoCompleto, config.pausaEntreFuentesMs);
  const recortes = confirmados.map((r) => ({ ...r, coincidencias: r.coincidencias.join(', ') }));

  const guardar = async () => {
    await guardarDelDia(CARPETA, recortes, {
      titulo: 'Clipping de medios',
      nota: 'Uso interno: titular, fragmento, párrafos con menciones y enlace a la fuente original.',
    });
    await guardarVistos(CARPETA, vistos);
  };
  return { nuevos: recortes, guardar };
}

// Lee el artículo de las noticias que salen al buscar un nombre o que tratan de los temas de
// `tambienEnNoticiasDe`, y añade los párrafos donde se menciona a esas personas.
async function revisarTextoCompleto(recortes, { nombres, tambienEnNoticiasDe, maxParrafos }, pausaMs) {
  if (nombres.length === 0) return recortes;
  const resultado = [];
  let leidos = 0;
  for (const recorte of recortes) {
    const { nombreBuscado, ...limpio } = recorte;
    const revisar = nombreBuscado
      || recorte.coincidencias.some((c) => tambienEnNoticiasDe.includes(c) || nombres.includes(c));
    if (!revisar) {
      resultado.push(limpio);
      continue;
    }

    limpio.enlace = await resolverEnlace(recorte.enlace);
    const { leido, nombres: encontrados, parrafos } = await buscarEnArticulo(limpio.enlace, nombres, maxParrafos);
    leidos++;
    await esperar(pausaMs);

    if (encontrados.length > 0) {
      limpio.coincidencias = [...new Set([...limpio.coincidencias, ...encontrados])];
      limpio.parrafos = parrafos;
    } else if (nombreBuscado && !leido) {
      // No se pudo leer (muro de pago, bloqueo…): se confía en Google y se avisa.
      limpio.coincidencias = [...new Set([...limpio.coincidencias, nombreBuscado])];
      limpio.fragmento = 'Google indica que se menciona a esta persona, pero no se ha podido leer el artículo.';
    } else if (limpio.coincidencias.length === 0) {
      // Se ha leído y el nombre no aparece: Google lo relacionó por otra parte de la página.
      continue;
    }
    limpio.mencion = limpio.coincidencias.some((c) => nombres.includes(c));
    resultado.push(limpio);
  }
  if (leidos) console.log(`✔ Texto completo: ${leidos} artículos leídos`);
  return resultado;
}

function fuenteGoogle(consulta, nombreBuscado) {
  return {
    etiqueta: `Google News: ${consulta}`,
    rss: urlGoogleNews(consulta),
    busqueda: consulta,
    nombreBuscado,
  };
}

function procesar(item, fuente, config) {
  const medio = medioDe(item, fuente);
  let titulo = limpiarHtml(item.title);
  if (!titulo) return null;
  // Google News añade " - Medio" al final del titular.
  if (medio && titulo.endsWith(` - ${medio}`)) titulo = titulo.slice(0, -(medio.length + 3));

  const resumen = item.contentSnippet || limpiarHtml(item.content || item.summary || '');
  // También se filtran los resultados de Google News: Google no distingue mayúsculas de minúsculas.
  const coincidencias = buscarPalabras(`${titulo} ${resumen}`, config.palabrasClave);

  return {
    fecha: item.isoDate ?? '',
    fuente: medio,
    organismo: '',
    titulo,
    // Google News repite el titular como resumen; en ese caso no aporta nada.
    fragmento: resumen.startsWith(titulo) ? '' : recortar(resumen, config.fragmentoMaxCaracteres),
    enlace: item.link ?? '',
    coincidencias,
    nombreBuscado: fuente.nombreBuscado,
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
