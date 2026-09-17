# AGENTS.md — ez-life

## Proyecto

App de finanzas personales y familiares. Offline-first con sincronización a Supabase mediante una capa de sync custom. Stack: TypeScript, React, Next.js, Supabase, IndexedDB.

## Comandos

- Ejecutar: `pnpm dev`
- Tests: `pnpm test`
- Lint/formato: `pnpm lint`

## Estilo y convenciones

- TypeScript strict mode. No `any` salvo justificación en comentario.
- Nombres en inglés: variables, funciones, tipos, componentes, commits.
- UI copy en español, centralizado a mano en los componentes. Sin librería de i18n en v1 (ver `docs/constitution.md` regla 6).
- Commits: conventional commits en inglés (`feat:`, `fix:`, `docs:`, etc.).
- Componentes: PascalCase. Hooks: `use` prefix. Utilities: camelCase.

## Reglas

- Lee docs/constitution.md y la spec activa antes de tocar código.
- No agregar dependencias runtime sin justificación en la spec.
- No escribir lógica de negocio dentro de componentes React.
- No usar `float` para valores monetarios. Siempre enteros (céntimos).
- No escribir código sin spec aprobada en `specs/`.

## Al terminar cualquier tarea

- Ejecutar `pnpm test` y verificar que todos los tests pasan.
- Ejecutar `pnpm lint` y verificar cero errores.
- Verificar que la app funciona sin conexión a internet.
