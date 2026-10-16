# Verificación de 009

Implementación local terminada el 2026-10-09. Cambios preexistentes de la
auditoría 008 conservados; sin commits ni despliegue remoto.

## Resultado

Sistema visual aplicado a login, onboarding y todas las secciones. Resumen
prioriza balance y presupuestos; progreso precede al análisis secundario.
Tipografías comprobadas en navegador: Plus Jakarta Sans y Fraunces.
Opciones adicionales en movimientos, ahorro, metas, hábitos, tareas y préstamos.
Correcciones visuales encontradas durante la revisión: cabecera de préstamos
sin desbordamiento móvil y barras que colorean solo el indicador de avance.

Seis logros personales con progreso derivado, exclusiones, semanas completas,
comodines excluidos, inicialización silenciosa incluso con historial tardío,
correcciones y celebración gestionada una sola vez. La preferencia oculta
navegación, bloque, avisos y entradas de logros en notificaciones sin borrar datos.
El evaluador de Notification existente coordina las celebraciones de cinco segundos.

## Comprobaciones ejecutadas

| Comando / recorrido | Resultado |
|---|---|
| `pnpm.cmd test` | 86 archivos, 412 tests pasan |
| `pnpm.cmd lint` | Sin errores ni warnings de ESLint |
| `pnpm.cmd exec tsc --noEmit` | Exit 0 |
| `pnpm.cmd build` | Exit 0; 591 kB de JS inicial; 35 recursos offline |
| `node scripts/verify-progress-sql.mjs` | Assertions SQL pasan en PostgreSQL 17 desechable |
| `playwright-cli.cmd run-code --filename=scripts/verify-progress-browser.js` | 40 combinaciones de sección/tamaño/tema pasan |
| `playwright-cli.cmd run-code --filename=scripts/verify-progress-wizard.js` | Login y tres pasos: 16 combinaciones pasan; configuración/reanudación offline pasa |
| `git diff --check` | Exit 0 |

Build validada: `uaw23gtZyTrsg7ar1F2As`. Navegador headless Chromium,
producción en `http://localhost:3103`, datos sintéticos sin sesión OAuth remota.
Anchuras: 390 y 1440 px. Temas claro y oscuro. Sin desbordamiento horizontal.
Capturas reproducibles en `.playwright-cli/progress-*.png`.
Movimiento reducido activado y foco de teclado visible (`outline-style: solid`).

Offline: registrar S/ 12.34, ver balance actualizado, recargar, abrir otra pestaña,
leer Mi progreso, ocultarlo en Ajustes, recargar y volver a mostrarlo.
Onboarding: completar los tres pasos, recargar el segundo y el último, una sola
fuente de ingreso persistida. Reconexión local comprobada; sync y deduplicación
entre cuentas cubiertos por CustomSyncLayer y repositorio, más SQL aislado.
No se ejecutó sincronización contra Supabase remoto: la migración está preparada,
su aplicación remota queda fuera del alcance autorizado.

## Unidades de trabajo y reversión

| Unidad | Evidencia | Frontera de reversión |
|---|---|---|
| Evaluación, persistencia y sync | Suite completa; SQL aislado de preferencia, RLS, UUID/logro único e historial monotónico | Archivos nuevos evaluateAchievements, IAchievementRepository y LocalAchievementRepository; extensiones de DB/sync y migración 20261009195513. Conservar versión IndexedDB 17 y tabla para abrir bases existentes; no borrar historial. |
| Vista, navegación y avisos | Suite completa; 15 tests enfocados de useNotificationEvaluator y CustomSyncLayer; navegador y escritura offline | PersonalProgress, usePersonalProgress y hunks de integración de MainFlow/Layout/BottomNav/NotificationHistory/SettingsScreen/evaluador. Ocultar desde Ajustes permite desactivar la experiencia conservando registros. |
| Sistema visual y formularios | Suite completa; build y 56 combinaciones de navegador | Hunks visuales de CSS, fuentes, componentes y disclosures; conservar los hunks preexistentes de auditoría en los archivos compartidos. |

Sin dependencias runtime nuevas. Migración aditiva en `ez_life` con RLS por
propietario y extensión de `sync_record`; no otorga membresía ni modifica
entidades financieras. El script SQL elimina únicamente su contenedor temporal.
