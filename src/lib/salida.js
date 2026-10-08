// Partes comunes a todos los módulos: control de repetidos y resultados del día.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerJson, escribirJson, escribirCsv } from './archivos.js';
import { generarInforme } from './informe.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const MAX_VISTOS = 20000;
const COLUMNAS = ['fecha', 'fuente', 'organismo', 'titulo', 'fragmento', 'parrafos', 'enlace', 'coincidencias'];

export function carpetaResultados(modulo) {
  return path.join(RAIZ, 'resultados', modulo);
}

export async function cargarVistos(carpeta) {
  return new Set(await leerJson(path.join(carpeta, 'vistos.json'), []));
}

export async function guardarVistos(carpeta, vistos) {
  await escribirJson(path.join(carpeta, 'vistos.json'), [...vistos].slice(-MAX_VISTOS));
}

// Añade los nuevos registros a los del día y regenera JSON, CSV e informe HTML.
export async function guardarDelDia(carpeta, nuevos, opcionesInforme) {
  const hoy = fechaLocal();
  const rutaBase = path.join(carpeta, hoy);
  const delDia = [...(await leerJson(`${rutaBase}.json`, [])), ...nuevos]
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  await escribirJson(`${rutaBase}.json`, delDia);
  const filasCsv = delDia.map((r) => ({ ...r, parrafos: r.parrafos?.join(' […] ') }));
  await escribirCsv(`${rutaBase}.csv`, filasCsv, COLUMNAS);
  await generarInforme(`${rutaBase}.html`, delDia, { ...opcionesInforme, dia: hoy });

  console.log(`\n${nuevos.length} registros nuevos (${delDia.length} en total hoy).`);
  console.log(`Informe: ${rutaBase}.html`);
}

export function fechaLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
