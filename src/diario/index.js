// Informe diario por correo: sector público + prensa en un solo email.
// Uso: npm run diario            → recoge, envía el correo y marca lo enviado como visto
//      npm run diario -- --prueba → solo genera una vista previa, sin enviar ni marcar nada
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import * as sectorPublico from '../sector-publico/index.js';
import * as clipping from '../clipping/index.js';
import { carpetaResultados, fechaLocal } from '../lib/salida.js';
import { componerCorreo } from './correo.js';

const SECCIONES = [
  { fuente: 'Plataforma de Contratación del Sector Público', titulo: 'Licitaciones', corto: 'licitaciones' },
  { fuente: 'Subvenciones (BDNS)', titulo: 'Subvenciones', corto: 'subvenciones' },
  { fuente: 'BOE', titulo: 'BOE', corto: 'BOE' },
];

export async function ejecutar() {
  const prueba = process.argv.includes('--prueba');

  console.log('— Sector público —');
  const publico = await sectorPublico.recoger();
  console.log('\n— Prensa —');
  const prensa = await clipping.recoger();

  const secciones = [
    ...SECCIONES.map((s) => ({ ...s, registros: publico.nuevos.filter((r) => r.fuente === s.fuente) })),
    { titulo: 'Prensa', corto: 'noticias', registros: prensa.nuevos },
  ];
  const correo = componerCorreo(secciones, new Date());

  if (prueba) {
    const ruta = path.join(carpetaResultados('diario'), `correo-${fechaLocal()}.html`);
    await mkdir(path.dirname(ruta), { recursive: true });
    await writeFile(ruta, correo.html, 'utf8');
    console.log(`\nModo prueba: no se envía nada. Asunto: ${correo.asunto}\nVista previa: ${ruta}`);
    return;
  }

  if (correo.total === 0 && process.env.ENVIAR_SIN_NOVEDADES === 'no') {
    console.log('\nSin novedades: no se envía correo.');
  } else {
    await enviar(correo);
    console.log(`\nCorreo enviado: ${correo.asunto}`);
  }

  // Solo se marca como visto lo que ha llegado a enviarse.
  await publico.guardar();
  await prensa.guardar();
}

async function enviar({ asunto, html, texto }) {
  const { GMAIL_USUARIO, GMAIL_CONTRASENA_APP, CORREO_DESTINO } = process.env;
  const faltan = Object.entries({ GMAIL_USUARIO, GMAIL_CONTRASENA_APP, CORREO_DESTINO })
    .filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length) throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}`);

  const transporte = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USUARIO, pass: GMAIL_CONTRASENA_APP.replace(/\s/g, '') },
  });
  await transporte.sendMail({
    from: `Vigilancia diaria <${GMAIL_USUARIO}>`,
    to: CORREO_DESTINO,
    subject: asunto,
    text: texto,
    html,
  });
}
