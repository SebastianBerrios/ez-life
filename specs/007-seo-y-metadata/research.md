# Research: 007-seo-y-metadata

## 1. Un solo título de pestaña por diseño — FR-004 no puede usar `generateMetadata` por ruta

- **Decision**: los títulos "por página" (FR-004) se actualizan client-side, mutando
  `document.title` desde `MainFlow.tsx` cuando cambia `currentRoute` (con un `useEffect` mínimo),
  no vía el mecanismo estándar de metadata de Next.js.
- **Rationale**: confirmado (`find src/app`) que la app tiene un único `src/app/page.tsx` — no hay
  archivos de ruta por sección (Movimientos, Control, etc.), porque el ruteo es un state machine
  client-side dentro de `MainFlow` (CLAUDE.md: "no hay Next.js file-based routing más allá del
  único `src/app/page.tsx`"). El `export const metadata`/`generateMetadata` de Next.js es
  server-side y fijo por archivo de ruta — con una sola ruta real, solo puede dar UN título
  estático de entrada (el que ve un link compartido / un crawler antes de que cargue el JS). Un
  título "por pantalla" dentro de la SPA solo puede hacerse en el cliente.
- **Alternatives considered**: convertir cada sección a una ruta real de Next.js
  (`/movimientos`, `/control`, etc.) para poder usar `generateMetadata` por archivo (rechazado —
  reescribiría todo el sistema de ruteo de la app, muy por fuera del alcance de "mejorar SEO y
  metadata"; sería un cambio arquitectónico, no esta feature puntual).

## 2. Favicon — hay dos archivos hoy, uno es el que cuenta

- **Decision**: reemplazar `src/app/favicon.ico` (la convención de App Router — Next.js lo sirve
  automáticamente desde ahí) con el logo real. Verificar si `public/favicon.ico` (encontrado en una
  investigación previa) es un duplicado obsoleto y, si no se referencia desde ningún lado,
  eliminarlo para no dejar dos favicons divergentes.
- **Rationale**: Next.js App Router usa `src/app/favicon.ico` como convención de archivo especial
  (se sirve automáticamente en `/favicon.ico`); un `public/favicon.ico` solo se serviría si algo lo
  referencia explícitamente, lo que hoy no ocurre según `layout.tsx` (no hay ningún `<link
  rel="icon">` manual).

## 3. Metadata Open Graph / Twitter Card (FR-003)

- **Decision**: extender `export const metadata: Metadata` en `src/app/layout.tsx` (hoy solo tiene
  `title`/`description`, confirmado) con `openGraph: { title, description, images: [...] }` y
  `twitter: { card: 'summary_large_image', ... }`, usando la API nativa de Next.js (`Metadata` de
  `next`).
- **Rationale**: es la única ruta real de la app — el metadata de `layout.tsx` es lo único que un
  crawler/preview de mensajería ve antes de que cargue el cliente. No requiere ninguna librería
  nueva (Principio VII).

## 4. Imagen de Open Graph

- **Decision**: usar la convención de archivo `src/app/opengraph-image.png` (o `.tsx` si se genera
  dinámicamente) — Next.js la sirve y la referencia automáticamente en el metadata sin configurar
  la URL a mano.
- **Rationale**: convención nativa de Next.js App Router, cero dependencias, consistente con cómo
  ya se maneja `favicon.ico`.
