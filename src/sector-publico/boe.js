// Sumario diario del BOE mediante su API de datos abiertos.
// https://www.boe.es/datosabiertos/documentos/APIsumarioBOE.pdf
import { pedir, comoArray } from './http.js';
import { fechaLocal } from '../lib/salida.js';

export const NOMBRE = 'BOE';

export async function obtener(desde) {
  const registros = [];
  for (const dia = new Date(desde); dia <= new Date(); dia.setDate(dia.getDate() + 1)) {
    const fecha = fechaLocal(dia);
    const respuesta = await pedir(
      `https://www.boe.es/datosabiertos/api/boe/sumario/${fecha.replaceAll('-', '')}`,
      { accept: 'application/json' },
    );
    // Los domingos y festivos no hay BOE: la API responde 404.
    if (respuesta.status === 404) continue;
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en el sumario del ${fecha}`);
    const { data } = await respuesta.json();
    registros.push(...extraer(data.sumario, fecha));
  }
  return registros;
}

function extraer(sumario, fecha) {
  const registros = [];
  for (const diario of comoArray(sumario.diario)) {
    for (const seccion of comoArray(diario.seccion)) {
      for (const departamento of comoArray(seccion.departamento)) {
        // Los items pueden colgar de un epígrafe o directamente del departamento.
        const grupos = [
          { epigrafe: null, items: departamento.item },
          ...comoArray(departamento.epigrafe).map((ep) => ({ epigrafe: ep.nombre, items: ep.item })),
        ];
        for (const { epigrafe, items } of grupos) {
          for (const item of comoArray(items)) {
            registros.push({
              id: `boe:${item.identificador}`,
              fecha,
              fuente: NOMBRE,
              organismo: departamento.nombre,
              titulo: item.titulo,
              fragmento: [seccion.nombre, epigrafe].filter(Boolean).join(' · '),
              enlace: item.url_html,
            });
          }
        }
      }
    }
  }
  return registros;
}
