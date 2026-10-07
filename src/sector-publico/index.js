// Vigilancia del sector público a partir de datos abiertos oficiales:
// BOE, Plataforma de Contratación del Sector Público y BDNS (subvenciones).
import path from 'node:path';
import { leerJson } from '../lib/archivos.js';
import { buscarPalabras } from '../lib/texto.js';
import { RAIZ, carpetaResultados, cargarVistos, guardarVistos, guardarDelDia, fechaLocal } from '../lib/salida.js';
import * as boe from './boe.js';
import * as contratacion from './contratacion.js';
import * as subvenciones from './subvenciones.js';

const RUTA_CONFIG = path.join(RAIZ, 'config', 'sector-publico.json');
const CARPETA = carpetaResultados('sector-publico');
const FUENTES = { boe, contratacion, subvenciones };

export async function ejecutar() {
  const { guardar } = await recoger();
  await guardar();
}

// Devuelve los registros nuevos y una función para guardarlos y marcarlos como vistos.
// El informe diario solo llama a `guardar` cuando el correo se ha enviado bien.
export async function recoger() {
  const config = await leerJson(RUTA_CONFIG);
  const vistos = await cargarVistos(CARPETA);

  // Se revisa desde hace `diasAtras` días hasta hoy; lo ya visto no se repite.
  const desde = new Date();
  desde.setDate(desde.getDate() - (config.diasAtras ?? 1));
  desde.setHours(0, 0, 0, 0);

  const nuevos = [];
  for (const [clave, fuente] of Object.entries(FUENTES)) {
    const opciones = config[clave] ?? {};
    if (!opciones.activo) continue;
    try {
      const registros = await fuente.obtener(desde, opciones);
      let relevantes = 0;
      for (const { id, ...registro } of registros) {
        // Las palabras clave se buscan en el título; los organismos, en el organismo emisor.
        const coincidencias = [
          ...buscarPalabras(registro.titulo, config.palabrasClave),
          ...buscarPalabras(registro.organismo, config.organismos ?? []),
        ];
        if (coincidencias.length === 0 || vistos.has(id)) continue;
        vistos.add(id);
        nuevos.push({ ...registro, coincidencias: coincidencias.join(', ') });
        relevantes++;
      }
      console.log(`✔ ${fuente.NOMBRE}: ${registros.length} publicaciones desde el ${fechaLocal(desde)}, ${relevantes} nuevas relevantes`);
    } catch (err) {
      console.warn(`✖ ${fuente.NOMBRE}: ${err.message}`);
    }
  }

  const guardar = async () => {
    await guardarDelDia(CARPETA, nuevos, {
      titulo: 'Sector público',
      nota: 'Fuentes: BOE, Plataforma de Contratación del Sector Público y BDNS.',
      agruparPorFuente: true,
    });
    await guardarVistos(CARPETA, vistos);
  };
  return { nuevos, guardar };
}
