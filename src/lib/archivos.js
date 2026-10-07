import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function leerJson(ruta, porDefecto) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return porDefecto;
    throw err;
  }
}

export async function escribirJson(ruta, datos) {
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, JSON.stringify(datos, null, 2), 'utf8');
}

// CSV con BOM y separador ";" para que Excel en español lo abra bien.
export async function escribirCsv(ruta, filas, columnas) {
  const celda = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    columnas.join(';'),
    ...filas.map((fila) => columnas.map((c) => celda(fila[c])).join(';')),
  ];
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, '﻿' + lineas.join('\r\n'), 'utf8');
}
