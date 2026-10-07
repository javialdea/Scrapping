// Correo diario en HTML compatible con Outlook: tablas y estilos en línea, sin CSS moderno.
import { escaparHtml as e } from '../lib/texto.js';

const COLOR = { texto: '#1d2330', suave: '#5b6475', acento: '#1f5fbf', borde: '#e2e5ea', fondo: '#f4f5f7' };
const FUENTE_LETRA = "font-family:Segoe UI,Arial,sans-serif;";

// secciones: [{ titulo, registros }]
export function componerCorreo(secciones, fecha) {
  const total = secciones.reduce((n, s) => n + s.registros.length, 0);
  const fechaLarga = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const conResultados = secciones.filter((s) => s.registros.length > 0);

  const asunto = total === 0
    ? `Vigilancia diaria · ${fecha.toLocaleDateString('es-ES')} · sin novedades`
    : `Vigilancia diaria · ${fecha.toLocaleDateString('es-ES')} · ${secciones
      .filter((s) => s.registros.length)
      .map((s) => `${s.registros.length} ${s.corto}`)
      .join(', ')}`;

  const resumen = secciones.map((s) => `
    <td style="padding:10px 8px;text-align:center;border:1px solid ${COLOR.borde};background:#fff;">
      <div style="${FUENTE_LETRA}font-size:22px;font-weight:bold;color:${s.registros.length ? COLOR.acento : COLOR.suave};">${s.registros.length}</div>
      <div style="${FUENTE_LETRA}font-size:12px;color:${COLOR.suave};">${e(s.titulo)}</div>
    </td>`).join('');

  const cuerpo = conResultados.length === 0
    ? `<p style="${FUENTE_LETRA}font-size:15px;color:${COLOR.suave};">Hoy no hay publicaciones nuevas que coincidan con tus palabras clave.</p>`
    : conResultados.map((s) => `
      <h2 style="${FUENTE_LETRA}font-size:17px;color:${COLOR.texto};margin:28px 0 8px;border-bottom:2px solid ${COLOR.acento};padding-bottom:4px;">
        ${e(s.titulo)} <span style="font-weight:normal;color:${COLOR.suave};font-size:14px;">(${s.registros.length})</span>
      </h2>
      ${s.registros.map(tarjeta).join('')}`).join('');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLOR.fondo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.fondo};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
    <tr><td>
      <h1 style="${FUENTE_LETRA}font-size:22px;color:${COLOR.texto};margin:0;">Vigilancia diaria</h1>
      <p style="${FUENTE_LETRA}font-size:14px;color:${COLOR.suave};margin:4px 0 16px;">${e(fechaLarga)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${resumen}</tr></table>
      ${cuerpo}
      <p style="${FUENTE_LETRA}font-size:12px;color:${COLOR.suave};margin-top:32px;">
        Fuentes: BOE, Plataforma de Contratación del Sector Público, BDNS y medios de comunicación (solo titular, fragmento y enlace).
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const texto = [
    `Vigilancia diaria · ${fechaLarga}`,
    ...secciones.flatMap((s) => s.registros.length === 0 ? [] : [
      '', `== ${s.titulo} (${s.registros.length}) ==`,
      ...s.registros.map((r) => `- ${r.titulo}\n  ${[r.organismo || r.fuente, r.fragmento].filter(Boolean).join(' · ')}\n  ${r.enlace}`),
    ]),
    ...(total === 0 ? ['', 'Hoy no hay publicaciones nuevas que coincidan con tus palabras clave.'] : []),
  ].join('\n');

  return { asunto, html, texto, total };
}

function tarjeta(r) {
  const meta = [r.organismo || r.fuente, fechaCorta(r.fecha)].filter(Boolean).join(' · ');
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${COLOR.borde};margin-bottom:10px;">
        <tr><td style="padding:14px 16px;">
          <div style="${FUENTE_LETRA}font-size:12px;color:${COLOR.suave};">${e(meta)}</div>
          <div style="${FUENTE_LETRA}font-size:15px;font-weight:bold;margin:4px 0;">
            <a href="${e(r.enlace)}" style="color:${COLOR.acento};text-decoration:none;">${e(r.titulo)}</a>
          </div>
          ${r.fragmento ? `<div style="${FUENTE_LETRA}font-size:13px;color:${COLOR.suave};">${e(r.fragmento)}</div>` : ''}
          <div style="${FUENTE_LETRA}font-size:12px;color:${COLOR.suave};margin-top:6px;">🔎 ${e(r.coincidencias)}</div>
        </td></tr>
      </table>`;
}

function fechaCorta(iso) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
