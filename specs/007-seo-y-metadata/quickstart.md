# Quickstart: 007-seo-y-metadata

## 1. Automatizado

```bash
pnpm test
```

Debe incluir: test de Testing Library en `MainFlow.test.tsx` verificando que `document.title`
cambia según `currentRoute`.

## 2. Manual

1. Reemplazar `src/app/favicon.ico` con el logo real, correr `pnpm dev` y verificar la pestaña del
   navegador.
2. Verificar que `public/favicon.ico` no quede como duplicado obsoleto sin referenciar.
3. Agregar `src/app/opengraph-image.png` y extender `layout.tsx` con `openGraph`/`twitter`.
4. Pegar la URL local (o de un deploy de preview) en una herramienta de vista previa de Open Graph,
   o compartirla manualmente por WhatsApp/Slack, y verificar título, descripción e imagen.
5. Navegar entre secciones de la app y verificar que el título de la pestaña cambia de forma
   descriptiva.
