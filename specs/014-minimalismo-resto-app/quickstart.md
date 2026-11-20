# Quickstart & Validation Guide: Minimalismo en el resto de la app

**Feature**: `014-minimalismo-resto-app` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

Esta guía documenta cómo validar de extremo a extremo que el rediseño minimalista del resto de la app cumple todos los
requisitos funcionales (FR-001..FR-029) y criterios de éxito (SC-001..SC-007) sin regresiones.

---

## 1. Prerrequisitos y ejecución local

```bash
pnpm install
pnpm dev
```

No se requieren migraciones de base de datos ni variables de entorno nuevas (spec estrictamente de presentación).

---

## 2. Validación automatizada

Ejecutar la suite completa, el linter y el build de producción (incluye caché offline):

```bash
pnpm test
pnpm lint
pnpm build
```

**Resultados esperados**:
- 100% de los tests unitarios existentes y nuevos pasan (incluidos los de `buildFinancesHero`, `formatFinancesPhrases`,
  `formatSharedSpacePhrases` y `formAdvancedFields`).
- 100% de los tests de cableado UI pasan (`CollapsibleSection`, formularios con `"Más opciones"` y auto-expansión por
  error, `SettingsScreen` con 5 secciones plegadas y deep-link, `ControlPage` con selector segmentado, `FinancesScreen`
  con 3 pestañas, `SharedSpaceScreen` con frases).
- `src/typographyGuard.test.ts` en verde (0 `font-mono`, `label-mono`, `JetBrains`, `uppercase`).
- `src/voseoGuard.test.ts` en verde (0 voseo en `src/`).
- `src/tokens.contrast.test.ts` en verde (WCAG AA ≥ 4.5:1 en claro y oscuro).
- `pnpm lint` con 0 errores y `pnpm build` exitoso.

---

## 3. Recorrido manual de escenarios (claro y oscuro)

Probar en los cuatro anchos objetivo usando las herramientas de desarrollo del navegador:
- **Celular**: `360 × 800` (verificar 0 desbordamiento horizontal, objetivos táctiles ≥ 44 px, safe-area inferior).
- **Tablet vertical**: `768 × 1024` (barra inferior fija + contenido centrado ≤ 720 px).
- **Tablet horizontal / Escritorio**: `1024 × 768` y `1440 × 900` (barra lateral fija + columna centrada ~720 px).

### Escenario A — Navegación, inicio de sesión, carga y error (US1)
1. Verificar etiquetas en formato de oración (`Resumen`, `Finanzas`, `Control y hábitos`, `Espacio compartido`, `Mi progreso`, `Ajustes`) y que `Nuevo registro` (`+`) es la única acción primaria destacada.
2. Alternar modo claro y modo oscuro: comprobar contraste legible en píldoras pastel y que `<meta name="theme-color">` cambia entre `#FBF5EA` (claro) y `#241A2B` (oscuro).
3. Revisar pantalla de inicio de sesión y pantalla de carga: tarjetas redondeadas, botones píldora, tono en tuteo.

### Escenario B — Finanzas (US2)
1. Abrir **Finanzas** y confirmar que no existe cuadrícula de 4 KPIs ni tabla de movimientos en escritorio.
2. En **Movimientos**: confirmar dato protagonista (balance neto del periodo filtrado), lista agrupada por día y acciones de filtrar/editar/eliminar.
3. En **Regla 50/30/20**: confirmar dato protagonista (% gastado del ingreso mensual) y bloques Necesidades / Deseos / Ahorro con píldoras pastel y frases cortas.
4. En **Préstamos**: confirmar dato protagonista (total que debes: préstamos + tarjetas + deudas por pagar), bloque secundario aparte para "Te deben" si aplica, tarjetas de crédito con acceso "Agregar línea de crédito" cuando falta línea, y frases de estado en préstamos (singular/plural).
5. Comprobar estados vacíos accionables cuando una pestaña no tiene registros.

### Escenario C — Formularios con "Más opciones" (US3)
1. Abrir **Nuevo registro** (`Gasto`, `Ingreso`, `Mover`) y los formularios de **Cuenta**, **Préstamo con cuotas** y **Deuda informal**.
2. Confirmar que en celular (`360 px`) abren como bottom sheet con botón de guardar fijo al alcance del pulgar, y en tablet/escritorio (`>= 768 px`) como diálogo centrado.
3. Guardar un registro completando solo los campos esenciales visibles sin abrir `"Más opciones"`.
4. Editar un registro que ya tenga campos avanzados completos: confirmar que `"Más opciones"` inicia plegado mostrando el contador (ej. `"Más opciones · 2 activas"`).
5. Introducir un valor inválido en un campo avanzado (p. ej. día de pago `99` en préstamo o activar ajuste sin motivo en movimiento), plegar `"Más opciones"` y enviar: confirmar que `"Más opciones"` se despliega automáticamente mostrando el error.

### Escenario D — Control y Hábitos (US4)
1. Abrir **Control y hábitos**: confirmar puntaje de hábitos y **"Foco de Hoy"** arriba sin expandir nada.
2. Cambiar entre **Hábitos / Tareas / Metas** en el selector segmentado debajo de "Foco de Hoy"; marcar un hábito o tarea y verificar persistencia.
3. Confirmar que **Analítica** inicia plegada por defecto y se despliega al pulsarla.

### Escenario E — Espacio Compartido (US5)
1. Sin espacio: confirmar estado vacío amable con `Crear espacio` y `Unirme con código`.
2. Con espacio activo y movimientos divididos: confirmar dato protagonista del saldo neto, frases por miembro (`"Ana te debe S/ 40"`, `"Le debes S/ 40 a Ana"` o `"Están al día"`) y lista legible de movimientos compartidos sin tablas.

### Escenario F — Mi Progreso y Ajustes (US6)
1. En **Mi progreso**: confirmar resumen protagonista y cuadrícula ligera de 6 logros distinguiendo `Logrado` vs `En curso`.
2. En **Ajustes**: confirmar `"Completar configuración"` y `"Ver tutorial"` visibles arriba, y las 5 secciones (`Perfil`, `Cuentas e ingresos`, `Notificaciones`, `Apariencia`, `Datos y exportación`) plegadas por defecto y capaces de mantenerse abiertas a la vez.
3. Probar deep-link `"Agregar línea de crédito"` desde Resumen: confirmar que `Cuentas e ingresos` se abre automáticamente y muestra el formulario de la tarjeta.
4. Desactivar y reactivar `"Mostrar logros personales"` dentro de **Apariencia** y verificar que Mi Progreso se oculta/muestra.

### Escenario G — Accesibilidad y modo sin conexión (SC-005, SC-007)
1. Activar `prefers-reduced-motion: reduce` en DevTools y verificar que colapsables y hojas responden sin animaciones bruscas.
2. Navegar con `Tab` y flechas en selectores segmentados: verificar foco visible en todos los controles.
3. Activar modo **Offline** en DevTools (Network → Offline) y recorrer Finanzas, Control y Hábitos, Espacio Compartido, Mi Progreso, Ajustes y formularios: confirmar que todo carga, guarda y responde sin errores ni bloqueos.
