// Boletines oficiales autonómicos a partir de sus RSS (configurados en config/sector-publico.json).
import Parser from 'rss-parser';
import { pedirOk } from './http.js';
import { limpiarHtml } from '../lib/texto.js';

export const NOMBRE = 'Boletines autonómicos';

const parser = new Parser();

export async function obtener(desde, { fuentes = [] }) {
  const registros = [];
  for (const boletin of fuentes) {
    let n = 0;
    for (const url of boletin.feeds) {
      try {
        const feed = await parser.parseString(await descargar(url));
        for (const item of feed.items) {
          item.isoDate ??= fechaDeRespaldo(item);
          if (item.isoDate && new Date(item.isoDate) < desde) continue;
          registros.push(convertir(item, boletin));
          n++;
        }
      } catch (err) {
        console.warn(`  ✖ ${boletin.nombre} (${url}): ${err.message}`);
      }
    }
    console.log(`  · ${boletin.nombre}: ${n}`);
  }
  return registros;
}

// Algunos boletines (BOCM) publican una fecha sin hora que no se puede interpretar
// ("Wed, 07 Oct 2026 +0200"); entonces se toma la fecha AAAAMMDD que lleva el enlace.
function fechaDeRespaldo(item) {
  const m = (item.link ?? '').match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

// Varios boletines publican en ISO-8859-1: se decodifica según la cabecera del XML.
async function descargar(url) {
  const bytes = await (await pedirOk(url)).arrayBuffer();
  const cabecera = new TextDecoder('latin1').decode(bytes.slice(0, 300));
  const codificacion = cabecera.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? 'utf-8';
  return new TextDecoder(codificacion).decode(bytes);
}

function convertir(item, boletin) {
  let titulo = limpiarHtml(item.title);
  let fragmento = '';

  // BOCM: el título es "Orden Nº 1 / Boletín…" y el texto real va en la descripción,
  // con el formato "Categoría – Título Orden Nº 1 del Boletín…".
  if (boletin.tituloEnDescripcion) {
    const descripcion = limpiarHtml(item.content || '');
    const [categoria, resto] = descripcion.split(/\s[–-]\s/, 2);
    const real = resto?.split(/\s+Orden Nº/)[0]?.trim();
    if (real) {
      titulo = real;
      fragmento = categoria.trim();
    }
  }

  // BOC Cantabria antepone el organismo en mayúsculas: "AYUNTAMIENTO DE X: Título".
  let organismo = boletin.nombre;
  const prefijo = titulo.match(/^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ,.'()-]{5,}):\s+(.+)$/);
  if (prefijo) {
    organismo = `${boletin.nombre} · ${prefijo[1]}`;
    titulo = prefijo[2];
  }

  return {
    id: `boletin:${item.link || item.guid || titulo}`,
    fecha: item.isoDate ?? '',
    fuente: NOMBRE,
    organismo,
    titulo,
    fragmento,
    enlace: item.link ?? '',
  };
}
