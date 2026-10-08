// Lectura del artículo completo para encontrar menciones a personas concretas.
// Del artículo solo se conservan los párrafos donde aparecen; el resto se descarta.
import * as cheerio from 'cheerio';
import { buscarPalabras, recortar } from '../lib/texto.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const MAX_CARACTERES_PARRAFO = 700;

// Los enlaces de Google News pasan por una redirección que se resuelve con JavaScript.
// Se obtiene la URL real con la misma petición que hace la página de Google.
export async function resolverEnlace(url) {
  if (!url.startsWith('https://news.google.com/')) return url;
  try {
    const id = new URL(url).pathname.split('/').pop();
    const html = await (await pedir(`https://news.google.com/rss/articles/${id}`)).text();
    const firma = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const marca = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!firma || !marca) return url;

    const peticion = [[['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${marca},"${firma}"]`, null, 'generic']]];
    const respuesta = await pedir('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `f.req=${encodeURIComponent(JSON.stringify(peticion))}`,
    });
    const datos = JSON.parse((await respuesta.text()).split('\n\n')[1])[0][2];
    return JSON.parse(datos)[1] || url;
  } catch {
    return url;
  }
}

// Devuelve { leido, nombres, parrafos }: qué nombres aparecen y los párrafos donde salen.
// Una vez que el nombre completo aparece, también cuentan los párrafos que solo dicen el
// apellido ("Escobar señaló…"), que es como suelen citar los periodistas.
export async function buscarEnArticulo(url, nombres, maxParrafos) {
  let parrafos;
  try {
    const respuesta = await pedir(url);
    if (!respuesta.ok || !/html/i.test(respuesta.headers.get('content-type') ?? '')) {
      return { leido: false, nombres: [], parrafos: [] };
    }
    parrafos = extraerParrafos(await respuesta.text());
  } catch {
    return { leido: false, nombres: [], parrafos: [] };
  }

  const textoCompleto = parrafos.join(' ');
  const encontrados = buscarPalabras(textoCompleto, nombres);
  const apellidos = encontrados.map((n) => n.split(/\s+/).at(-1));
  const conMencion = parrafos
    .filter((p) => buscarPalabras(p, [...encontrados, ...apellidos]).length > 0)
    .slice(0, maxParrafos)
    .map((p) => recortar(p, MAX_CARACTERES_PARRAFO));

  return { leido: parrafos.length > 0, nombres: encontrados, parrafos: conMencion };
}

function extraerParrafos(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, form').remove();
  // Primero el cuerpo del artículo; si la web no lo marca, todos los párrafos de la página.
  let nodos = $('article p, main p, [itemprop="articleBody"] p');
  if (nodos.length === 0) nodos = $('p');
  const vistos = new Set();
  return nodos
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((p) => p.length > 40 && !vistos.has(p) && vistos.add(p));
}

function pedir(url, opciones = {}) {
  return fetch(url, {
    ...opciones,
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9', ...opciones.headers },
    signal: AbortSignal.timeout(20000),
  });
}
