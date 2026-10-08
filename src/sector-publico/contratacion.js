// Licitaciones de la Plataforma de Contratación del Sector Público (sindicación ATOM).
// Cada página trae las últimas actualizaciones y enlaza a la anterior con rel="next".
import { XMLParser } from 'fast-xml-parser';
import { pedirOk, comoArray } from './http.js';

export const NOMBRE = 'Plataforma de Contratación del Sector Público';

const SINDICACION = 'https://contrataciondelsectorpublico.gob.es/sindicacion';
// Perfiles alojados en la Plataforma (sector público estatal y muchas entidades locales).
const URL_ESTATAL = `${SINDICACION}/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom`;
// Plataformas autonómicas agregadas (Cataluña, Madrid, País Vasco, Galicia, Andalucía, Navarra…).
// Sus páginas son mucho más pequeñas, por eso necesitan más páginas para cubrir un día.
const URL_AGREGADAS = `${SINDICACION}/sindicacion_1044/PlataformasAgregadasSinMenores.atom`;

const ESTADOS = {
  PRE: 'Anuncio previo',
  PUB: 'En plazo',
  EV: 'Pendiente de adjudicación',
  ADJ: 'Adjudicada',
  RES: 'Resuelta',
  ANUL: 'Anulada',
};

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, attributeNamePrefix: '@' });

export async function obtener(desde, { maxPaginas = 10, maxPaginasAgregadas = 60 }) {
  return [
    ...await leerSindicacion(URL_ESTATAL, desde, maxPaginas),
    ...await leerSindicacion(URL_AGREGADAS, desde, maxPaginasAgregadas),
  ];
}

async function leerSindicacion(urlInicial, desde, maxPaginas) {
  const registros = [];
  let url = urlInicial;
  for (let pagina = 0; url && pagina < maxPaginas; pagina++) {
    const xml = await (await pedirOk(url, { timeoutMs: 120000 })).text();
    const { feed } = parser.parse(xml);
    const entradas = comoArray(feed.entry);

    for (const entrada of entradas) {
      if (new Date(entrada.updated) < desde) continue;
      registros.push(convertir(entrada));
    }

    // Las páginas van de más reciente a más antigua: se para al pasar de `desde`.
    const masAntigua = entradas.at(-1)?.updated;
    if (!masAntigua || new Date(masAntigua) < desde) break;
    url = comoArray(feed.link).find((l) => l['@rel'] === 'next')?.['@href'];
  }
  return registros;
}

function convertir(entrada) {
  const resumen = texto(entrada.summary);
  const campo = (nombre) => resumen.match(new RegExp(`${nombre}:\\s*([^;]+)`))?.[1]?.trim();
  const organismo = campo('Órgano de Contratación') ?? '';
  const estado = campo('Estado');
  const importe = campo('Importe');
  const lugar = texto(entrada.ContractFolderStatus?.ProcurementProject?.RealizedLocation?.CountrySubentity);
  const titulo = texto(entrada.title);

  return {
    // Se incluye el estado para avisar también cuando la licitación se adjudica.
    id: `placsp:${texto(entrada.id)}:${estado}`,
    fecha: new Date(entrada.updated).toISOString(),
    fuente: NOMBRE,
    organismo,
    titulo,
    fragmento: [
      importe && `Importe: ${formatearImporte(importe)}`,
      estado && `Estado: ${ESTADOS[estado] ?? capitalizar(estado)}`,
      lugar,
    ].filter(Boolean).join(' · '),
    enlace: comoArray(entrada.link)[0]?.['@href'] ?? '',
  };
}

// Las plataformas agregadas escriben el estado como quieren: "EN PLAZO", "En Plazo"…
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const texto = (v) => String((typeof v === 'object' && v !== null ? v['#text'] : v) ?? '').trim();

// La plataforma estatal escribe "47120.52 EUR"; las agregadas, "58541,21 EUR", "1.234,56 €", "173553.72EUR"…
function formatearImporte(importe) {
  const [, cantidad = '', moneda = ''] = importe.match(/^([\d.,]+)\s*(\S*)/) ?? [];
  const normalizada = cantidad.includes(',') ? cantidad.replace(/\./g, '').replace(',', '.') : cantidad;
  const numero = Number(normalizada);
  if (!cantidad || Number.isNaN(numero)) return importe;
  const codigo = /^[A-Z]{3}$/.test(moneda) ? moneda : 'EUR';
  try {
    return numero.toLocaleString('es-ES', { style: 'currency', currency: codigo });
  } catch {
    return importe;
  }
}
