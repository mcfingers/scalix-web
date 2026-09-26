# Scalix — Web de una página

Sitio de una página para **Scalix**, agencia de marketing digital orientada a pequeños y negocios locales.
Especificación completa en [`DESIGN.md`](DESIGN.md).

## Requisitos

- Node.js 18+ (build de Tailwind y servidor local — no se necesita Python)

## Comandos

```bash
npm install        # dependencias (tailwindcss v4 + puppeteer-core para verificación)
npm run build      # compila CSS + genera build/ listo para subir
npm run dev        # servidor local + CSS en watch (lo que usarás normalmente)
npm run serve      # solo servidor local, sin watch
npm run dev:css    # solo watch de Tailwind
npm run verify     # auditoría en Chrome (overflow, imágenes, consola, interacciones)
```

## Ver el sitio

```bash
npm run dev
# abrir http://127.0.0.1:8080/
```

El servidor (`scripts/serve.mjs`) es Node puro, sin dependencias: MIME correcto para
SVG/MP4/ICO y soporte de rangos (permite hacer scrub en el vídeo del hero).
Opcional: `PORT=8081 npm run serve` para usar otro puerto.

## Despliegue

```bash
npm run build     # → build/ (30 archivos, ~6,4 MB)
```

`scripts/build.mjs` compila Tailwind (minificado), limpia y rellena `build/` con todo lo
necesario y **valida que ninguna referencia local (`src`/`href`/`url()`) esté rota** dentro
de la carpeta. Resultado:

```
build/
├── index.html            # página única
├── favicon.* / apple-touch-icon.png / logo-scalix.png
└── assets/
    ├── css/styles.css    # Tailwind compilado y minificado
    ├── js/main.js
    ├── img/ (12 fotos + 6 logos)
    └── video/ (loop del hero 720p + 360p)
```

Todo usa rutas relativas: sube el **contenido** de `build/` a cualquier hosting/carpeta
pública tal cual. Lo único externo son las tipografías de Google Fonts (CDN).
Para revisarlo en local antes de subir: `SITE_ROOT=build npm run serve` → http://127.0.0.1:8080/.
Auditoría de la carpeta compilada: `node scripts/verify-build.mjs`.

## Estructura

```
index.html              # página única (español), secciones con anclas
build/                  # salida de `npm run build`: sitio autocontenido listo para subir
src/styles.css          # tema Tailwind v4 (@theme: colores, tipografía, utilidades)
assets/css/styles.css   # CSS compilado (generado, no editar a mano)
assets/js/main.js       # menú móvil, acordeón FAQ, scroll reveal, año actual, vídeo del hero
assets/img/             # fotografías descargadas localmente (Unsplash, alt en español)
assets/video/           # loop de fondo del hero (Pexels · licencia libre · 720p + 360p)
favicon.svg / .ico      # favicon: la flecha del logo (assets en el raíz: favicon-*.png, apple-touch-icon.png)
scripts/verify.mjs      # auditoría: overflow, imágenes, errores de consola, interacciones
scripts/capture.mjs     # capturas por sección en shots/
design-system/scalix/   # design system generado por la skill ui-ux-pro-max (MASTER.md)
shots/                  # capturas de verificación
```

## Secciones

Hero → barra de confianza → Servicios → Planes (49/82/99 €) → Comparativa → Clientes →
Proceso → FAQ → Hablemos (WhatsApp 640 295 743 / 640 243 045 + botón «Agendar llamada») → Footer.
El hero lleva un vídeo de fondo (`assets/video/`) mezclado con los degradados de marca mediante
`mix-blend-overlay`; con `prefers-reduced-motion` se queda en pausa. En móvil: barra fija con
“WhatsApp” y “Agendar llamada”.

## Configuración pendiente

- **Enlace de reservas (Google Calendar):** crear una *Appointment Schedule* en Google
  Calendar y sustituir el marcador de posición en `index.html`:

  ```bash
  # buscar y reemplazar (1 resultado):
  https://calendar.google.com/calendar/appointments/REEMPLAZA_CON_TU_ENLACE
  ```

- **WhatsApp:** todos los enlaces de teléfono usan `https://wa.me/34640295743` y
  `https://wa.me/34640243045` (formato `wa.me/` + prefijo de país `34`, sin espacios ni `+`).
  Los botones «Agendar llamada» del header, hero, footer y barra fija siguen llevando a
  `#contacto`; di si quieres que apunten directamente al enlace de reservas.

## SEO / Accesibilidad

- `lang="es"`, un solo H1, meta + Open Graph, JSON-LD `ProfessionalService` y `FAQPage`
- Texto alternativo en todas las imágenes, acordeón FAQ con `aria-expanded`
- Navegación por teclado, `:focus-visible`, `prefers-reduced-motion`
- Sin desbordamiento horizontal en 375 / 768 / 1024 / 1440 px

## Licencia

Sin licencia: © 2026 Mauro Cardinali — **todos los derechos reservados**.
El código es un encargo para el cliente y no está autorizada su reutilización.
(Tipografías vía Google Fonts · fotos de Unsplash · vídeo del hero de Pexels · logos de cliente de logoipsum.)
