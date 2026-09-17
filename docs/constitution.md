# Constitución — ez-life

1. **Stack**: TypeScript, React, Next.js, Supabase. Toda nueva dependencia runtime requiere justificación en la spec correspondiente.
2. **Spec → Código**: Toda funcionalidad DEBE tener una spec en `specs/` ANTES de escribir código. Código sin spec no está autorizado.
3. **Lógica ≠ UI**: Las reglas de negocio viven en funciones puras/hooks sin imports de UI. Los componentes solo renderizan y delegan.
4. **Tests**: Todo caso de uso tiene al menos un test unitario (Vitest). El comportamiento de UI que implica wiring o flujo de datos (conectar un formulario, cambiar qué se llama al hacer submit, agregar una ruta) requiere test con Testing Library. Los cambios puramente de estilo visual o de tokens (spacing, tipografía, colores, tamaños) no requieren test nuevo. Sin e2e hasta que una spec lo requiera explícitamente.
5. **Persistencia**: Offline-first — IndexedDB es la fuente de verdad local. Supabase sincroniza a la nube mediante una capa de sync custom. La app DEBE funcionar completamente sin conectividad, con una única excepción explícita: el login inicial vía OAuth requiere conexión (ver `specs/001-ezlife-mvp/spec.md` RF-01/RNF-01). La persistencia vive detrás de una interfaz de repositorio.
6. **Idioma**: Código, tipos, variables y commits en inglés. El copy de UI va en español, centralizado a mano en los componentes — v1 NO usa una librería de i18n: agregar una violaría las reglas 1 y 7 (nueva dependencia sin justificación suficiente frente al valor que aporta hoy). Esto se documenta como deuda técnica explícita, no como una violación activa de esta constitución. README y docs en español.
7. **Simplicidad**: Si una librería aporta menos de 50 líneas de valor, se escribe a mano. Menos dependencias, menos problemas.
8. **Dinero**: Todos los valores monetarios se almacenan como enteros (céntimos). Nunca floats. v1 opera solo en PEN.
