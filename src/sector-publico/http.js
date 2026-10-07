const CABECERAS = { 'User-Agent': 'Mozilla/5.0 (compatible; VigilanciaSectorPublico/0.1)' };

export async function pedir(url, { accept, timeoutMs = 60000 } = {}) {
  const respuesta = await fetch(url, {
    headers: { ...CABECERAS, ...(accept && { Accept: accept }) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return respuesta;
}

export async function pedirOk(url, opciones) {
  const respuesta = await pedir(url, opciones);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
  return respuesta;
}

// Los XML y JSON oficiales devuelven un objeto o un array según haya uno o varios elementos.
export const comoArray = (valor) => (valor == null ? [] : Array.isArray(valor) ? valor : [valor]);
