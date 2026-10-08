# Scrapping

Scrapers y clipping de medios y administraciones públicas (Node.js ≥ 22).

## Instalación

```bash
npm install
```

## Clipping de medios

```bash
npm run clipping
```

Lee los RSS de `config/clipping.json`, se queda con las noticias que contienen alguna de las
`palabrasClave` (sin distinguir mayúsculas ni tildes) y añade los resultados de las
`busquedasGoogleNews`. Cada noticia aparece una sola vez aunque se ejecute varias veces.

Resultados en `resultados/clipping/AAAA-MM-DD.{html,csv,json}`.

**Modo seguro:** solo se guarda titular, fragmento corto (`fragmentoMaxCaracteres`), medio,
fecha y enlace.

**Personas (`textoCompleto`):** para los `nombres` configurados se busca en Google News y se lee
el artículo completo, porque suelen aparecer citados en el cuerpo y no en el titular. Del artículo
solo se guardan los párrafos donde aparecen (como máximo `maxParrafos`). También se leen las
noticias que coinciden con `tambienEnNoticiasDe`. En el correo van en una sección propia.

**Palabras con contexto:** una palabra clave puede escribirse como
`{ "palabra": "POP", "requiere": ["paciente*", "sanidad", …] }` y solo cuenta si en el titular o
la entradilla aparece además alguna de `requiere`. Así se evita, por ejemplo, el K-POP.

## Sector público

```bash
npm run sector-publico
```

Revisa fuentes oficiales de datos abiertos desde hace `diasAtras` días:

| Fuente | Qué trae |
|---|---|
| BOE (API de datos abiertos) | Todo el sumario diario: normativa, ayudas, nombramientos, anuncios |
| Plataforma de Contratación del Sector Público (ATOM) | Licitaciones con importe, estado y provincia |
| BDNS / Infosubvenciones (API) | Convocatorias de subvenciones de todas las administraciones |

Configuración en `config/sector-publico.json`:

- `palabrasClave`: se buscan en el **título** de cada publicación.
- `organismos`: se buscan en el **organismo emisor**, para seguir todo lo que publica uno concreto
  (por ejemplo `"Ayuntamiento de Murcia"`).
- Cada fuente se puede desactivar con `"activo": false`.

Una licitación vuelve a aparecer cuando cambia de estado (por ejemplo, al adjudicarse).

Resultados en `resultados/sector-publico/AAAA-MM-DD.{html,csv,json}`, agrupados por fuente.

## Plenos de distrito de Madrid

```bash
npm run plenos             # convocatorias nuevas desde la última vez
npm run plenos -- --todos  # todas las publicadas ahora en el Tablón de Edictos
```

Recorre el Tablón de Edictos Electrónico del Ayuntamiento, descarga el PDF del orden del día
de cada Pleno de Junta Municipal de Distrito y extrae su texto en
`resultados/plenos/AAAA-MM-DD/` (un `.pdf` y un `.txt` por distrito, más `convocatorias.json`).
La sede bloquea las peticiones que no vienen de un navegador, por eso usa Playwright con el
Edge instalado en Windows, en modo oculto.

## Correo diario

```bash
npm run diario -- --prueba   # genera resultados/diario/correo-AAAA-MM-DD.html sin enviar nada
npm run diario               # recoge todo y envía un único correo con sector público y prensa
```

Solo se marcan como vistos los resultados de un correo enviado correctamente.

Se ejecuta solo de lunes a viernes por la mañana con GitHub Actions
(`.github/workflows/diario.yml`); también se puede lanzar a mano desde la pestaña **Actions**.
El historial de lo ya enviado se conserva entre ejecuciones con la caché de Actions.

### Configuración (una vez)

1. En la cuenta de Gmail que envía: activar la verificación en dos pasos y crear una
   **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>.
2. En GitHub: **Settings → Secrets and variables → Actions → New repository secret** y crear:
   - `GMAIL_USUARIO`: la dirección de Gmail que envía
   - `GMAIL_CONTRASENA_APP`: la contraseña de aplicación
   - `CORREO_DESTINO`: la dirección que recibe el informe

Para probar el envío en local, copia `.env.example` como `.env` y rellénalo.
