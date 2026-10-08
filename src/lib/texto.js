// Minúsculas y sin tildes, para comparar palabras clave sin falsos negativos.
export function normalizar(texto = '') {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Devuelve las palabras clave que aparecen en el texto como palabras completas.
// - Sin distinguir mayúsculas ni tildes: "accesibilidad" encuentra "Accesibilidad".
// - Terminada en *, busca el principio de palabra: "discapacidad*" encuentra "discapacidades".
// - Escrita toda en mayúsculas es una sigla y debe aparecer igual: "ELA" no encuentra "ela".
// - Como objeto { palabra, requiere: [...] }, solo cuenta si en el texto aparece además alguna
//   palabra de `requiere`. Sirve para siglas ambiguas como "POP".
export function buscarPalabras(texto, palabras) {
  const limpio = sinTildes(texto);
  return palabras
    .map((p) => (typeof p === 'string' ? { palabra: p } : p))
    .filter(({ palabra, requiere }) =>
      patronDe(palabra).test(limpio) && (!requiere || requiere.some((r) => patronDe(r).test(limpio))))
    .map(({ palabra }) => palabra);
}

const patrones = new Map();

function patronDe(palabra) {
  if (!patrones.has(palabra)) {
    const prefijo = palabra.endsWith('*');
    const limpia = sinTildes(prefijo ? palabra.slice(0, -1) : palabra).trim();
    const esSigla = limpia.length > 1 && limpia === limpia.toUpperCase() && limpia !== limpia.toLowerCase();
    const cuerpo = limpia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // \p{L}\p{N} en lugar de \b para que funcione con ñ y demás letras no inglesas.
    const fuente = `(?<![\\p{L}\\p{N}])${cuerpo}${prefijo ? '' : '(?![\\p{L}\\p{N}])'}`;
    patrones.set(palabra, new RegExp(fuente, esSigla ? 'u' : 'iu'));
  }
  return patrones.get(palabra);
}

const sinTildes = (texto = '') => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function limpiarHtml(html = '') {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Recorta sin partir palabras.
export function recortar(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return (ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte) + '…';
}

export function escaparHtml(texto = '') {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
