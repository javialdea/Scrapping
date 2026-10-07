// Convocatorias de la Base de Datos Nacional de Subvenciones (BDNS) mediante su API pública.
// Aviso legal de reutilización: https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal
import { pedirOk } from './http.js';
import { esperar } from '../lib/salida.js';

export const NOMBRE = 'Subvenciones (BDNS)';

const API = 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda';
const POR_PAGINA = 100;

export async function obtener(desde, { maxPaginas = 30 }) {
  const registros = [];
  const params = new URLSearchParams({
    pageSize: POR_PAGINA,
    order: 'fechaRecepcion',
    direccion: 'desc',
    fechaDesde: fechaBdns(desde),
    fechaHasta: fechaBdns(new Date()),
  });

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    params.set('page', pagina);
    const datos = await (await pedirOk(`${API}?${params}`)).json();
    registros.push(...datos.content.map(convertir));
    if (datos.last) break;
    // Pausa breve: la BDNS restringe el acceso ante un uso abusivo de la API.
    await esperar(500);
  }
  return registros;
}

function convertir(c) {
  const organismo = [...new Set([c.nivel2, c.nivel3].filter(Boolean))].join(' · ');
  return {
    id: `bdns:${c.numeroConvocatoria}`,
    fecha: c.fechaRecepcion,
    fuente: NOMBRE,
    organismo,
    titulo: c.descripcion,
    fragmento: `Ámbito: ${c.nivel1.toLowerCase()} · Convocatoria ${c.numeroConvocatoria}`,
    enlace: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${c.numeroConvocatoria}`,
  };
}

const fechaBdns = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
