// Órdenes del día de los Plenos de las Juntas Municipales de Distrito de Madrid.
// Recorre el Tablón de Edictos Electrónico, descarga el PDF de cada convocatoria y extrae su texto.
// La sede bloquea las peticiones que no vienen de un navegador, por eso se usa Playwright con Edge.
//
// Uso: npm run plenos            → solo las convocatorias nuevas desde la última vez
//      npm run plenos -- --todos → todas las que estén publicadas en el tablón
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { extractText, getDocumentProxy } from 'unpdf';
import { escribirJson } from '../lib/archivos.js';
import { carpetaResultados, cargarVistos, guardarVistos, fechaLocal, esperar } from '../lib/salida.js';

const SEDE = 'https://sede.madrid.es';
const TABLON = `${SEDE}/portal/site/tramites/menuitem.dd7c2859598d94d061e061e084f1a5a0/`
  + '?vgnextoid=3b4d814231ede410VgnVCM1000000b205a0aRCRD&vgnextchannel=3b4d814231ede410VgnVCM1000000b205a0aRCRD&vgnextfmt=default';
const MAX_PAGINAS = 10;
const CARPETA = carpetaResultados('plenos');

export async function ejecutar() {
  const todos = process.argv.includes('--todos');
  const vistos = await cargarVistos(CARPETA);
  const carpetaDia = path.join(CARPETA, fechaLocal());

  const navegador = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // En modo oculto Edge se identifica como "HeadlessChrome" y la sede responde 403;
    // con el identificador normal del navegador se accede igual que desde una ventana.
    const ua = await (await navegador.newPage()).evaluate(() => navigator.userAgent);
    const contexto = await navegador.newContext({ userAgent: ua.replace('HeadlessChrome', 'Chrome'), locale: 'es-ES' });
    const pagina = await contexto.newPage();
    const convocatorias = (await listarConvocatorias(pagina)).filter((c) => todos || !vistos.has(c.enlace));
    console.log(`${convocatorias.length} convocatorias ${todos ? 'publicadas' : 'nuevas'}`);

    const resultados = [];
    for (const c of convocatorias) {
      try {
        const urlPdf = await buscarPdf(pagina, c.enlace);
        const pdf = await (await pagina.request.get(urlPdf)).body();
        const texto = await textoDePdf(pdf);
        const nombre = archivoSeguro(`${c.distrito} ${c.sesion || c.publicado}`);
        await mkdir(carpetaDia, { recursive: true });
        await writeFile(path.join(carpetaDia, `${nombre}.pdf`), pdf);
        await writeFile(path.join(carpetaDia, `${nombre}.txt`), texto, 'utf8');
        resultados.push({ ...c, pdf: urlPdf, archivo: `${nombre}.pdf`, caracteres: texto.length });
        vistos.add(c.enlace);
        console.log(`✔ ${c.distrito} (${c.sesion || 'sin fecha'}): ${texto.length} caracteres`);
      } catch (err) {
        console.warn(`✖ ${c.distrito}: ${err.message}`);
      }
      await esperar(1000);
    }

    if (resultados.length) await escribirJson(path.join(carpetaDia, 'convocatorias.json'), resultados);
    await guardarVistos(CARPETA, vistos);
    console.log(`\nArchivos en: ${carpetaDia}`);
  } finally {
    await navegador.close();
  }
}

// Recorre las páginas del tablón y se queda con las convocatorias de plenos de distrito.
async function listarConvocatorias(pagina) {
  const convocatorias = [];
  for (let n = 0; n < MAX_PAGINAS; n++) {
    await pagina.goto(n === 0 ? TABLON : TABLON.replace('/?', `/?page=${n}&`), { waitUntil: 'domcontentloaded' });
    const items = await pagina.$$eval('li', (lis) => lis
      .map((li) => ({
        cabecera: li.querySelector('.event-type')?.textContent.trim(),
        titulo: li.querySelector('a.event-link')?.textContent.trim(),
        href: li.querySelector('a.event-link')?.getAttribute('href'),
      }))
      .filter((i) => i.cabecera && i.titulo && i.href));
    if (items.length === 0) break;

    for (const { cabecera, titulo, href } of items) {
      if (!/orden del d[ií]a/i.test(titulo) || !/Junta Municipal del Distrito/i.test(titulo)) continue;
      // Los Consejos de Proximidad también se publican "de la Junta Municipal", pero no son plenos.
      if (/Consejo de Proximidad/i.test(titulo)) continue;
      const [publicado, ...resto] = cabecera.split(' - ');
      convocatorias.push({
        distrito: resto.join(' - ').trim(),
        publicado: publicado.trim(),
        sesion: titulo.match(/(\d{1,2} de \w+ de \d{4})/)?.[1] ?? '',
        titulo,
        enlace: new URL(href, SEDE).href,
      });
    }
    await esperar(1000);
  }
  return convocatorias;
}

async function buscarPdf(pagina, enlace) {
  await pagina.goto(enlace, { waitUntil: 'domcontentloaded' });
  const href = await pagina.$$eval('a[href$=".pdf"]', (as) => as.map((a) => a.getAttribute('href'))
    .find((h) => h.includes('/TablonEdictos/')));
  if (!href) throw new Error('no se encuentra el PDF del edicto');
  return new URL(href, SEDE).href;
}

async function textoDePdf(bytes) {
  const documento = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(documento, { mergePages: true });
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

const archivoSeguro = (texto) => texto.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
