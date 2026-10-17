# 010 — Rediseño Obsidian

Estado: aprobada por el usuario (2026-10-16), a partir del proyecto Stitch
`9999102630742989203` ("Rediseño UI/UX para aplicación financiera"). Depende de la spec 011
(cuentas, hora, prioridad). Supera el reparto crear/controlar de la spec 002: Control vuelve a
ofrecer "+ Nuevo" y la ruta `create` desaparece. Sin dependencias runtime nuevas (iconos con
`lucide-react`; fuentes auto-hospedadas con `next/font`).

Referencias visuales versionadas en `design/` (HTML + PNG de las 7 pantallas).

## Experiencia

Tema "Obsidian Precision": grafito, esmeralda `#10B981`, bordes hairline, densidad alta, radios
4/8/12 px, sin sombras suaves. Geist para texto y JetBrains Mono para etiquetas, importes secundarios,
atajos y metadatos; cifras con `tabular-nums`. Oscuro por defecto; variante clara derivada con la
misma paleta (primary más oscuro para contraste AA) y el toggle existente. Controles de 44 px, foco
visible y movimiento reducido en ambos temas (heredado de la spec 009).

## Navegación

Rutas: `dashboard` (Inicio), `finances` (sub-pestañas Movimientos / Regla 50-30-20 / Préstamos),
`control`, `shared-space`, `progress`, `settings`. Desktop: barra lateral con "Nuevo Registro ⌘K",
seis destinos y pie de cuenta; barra superior con selector de mes, búsqueda ⌘K y notificaciones.
Móvil: Inicio, Finanzas, botón central "+", Hábitos, Ajustes; Espacio Compartido y Mi Progreso se
alcanzan desde Inicio y Ajustes. Se eliminan `MoreDrawer` y las rutas `movements`, `analysis`,
`goals`, `debts`, `create`.

## Pantallas

- **Inicio**: balance del ciclo con variación, acciones rápidas, presupuesto 50/30/20, Foco de Hoy
  (hábitos y tareas de hoy marcables), meta principal, Mi Progreso ("X de 6 logros"). Desktop añade
  score conductual, espacio compartido, próximo pago de préstamo y transacciones recientes.
- **Finanzas**: KPIs (ingresos, gastos, tasa de ahorro, capital disponible = suma de saldos de
  cuentas); Movimientos agrupados por día con filtros (Todos/Gastos/Ingresos/Transferencias/
  Compartido), búsqueda local, cuenta y hora; Regla 50/30/20 con ejecución y columnas por bucket;
  Préstamos (cuotas y deudas informales). Botones "Exportar CSV" y "Nuevo Movimiento".
- **Control & Hábitos**: desempeño semanal L–D, efectividad diaria, racha; hábitos con racha y
  puntos de 7 días; tareas (Para hoy / Esta semana / Hechas) con borde por prioridad, etiqueta y
  "Añadir tarea rápida ↵"; metas activas (Goal y meta de ahorro).
- **Nuevo Registro**: hoja con pestañas Gasto / Ingreso / Hábito / Meta; monto grande con chips
  +10/+20/+50/+100 y "Limpiar", concepto, categoría y bucket, fecha y hora, cuenta, opción de
  espacio compartido, "Guardar" y "Guardar y registrar otro". "Mover" abre la transferencia.
- Resto (compartido, progreso, ajustes con gestión de cuentas, notificaciones, login, onboarding):
  mismo flujo con los nuevos tokens y primitivos.

## Funciones solo de UI

Efectividad diaria y desempeño semanal (derivados de hábitos y tareas), paleta ⌘K con búsqueda sobre
movimientos/tareas/hábitos/metas y acciones, exportar CSV desde Finanzas, tarea rápida y montos
rápidos. La lógica vive en `core/use-cases` y en un hook de atajo; los componentes solo renderizan.
Importes con `formatMoney` (enteros en céntimos, PEN) en lugar de `toFixed` inline.

## Fuera de alcance

XP y niveles (la spec 009 los prohíbe), "v2.4", "PRO Plan", "BCP API", capacidad de horas de foco,
TCEA/referencia de préstamo sin dato real, adjuntos y "Entregar" en tareas. Cualquier elemento del
diseño sin dato real se omite; nunca se muestran cifras inventadas.

## Verificación

Unitarios de los casos de uso nuevos (puntaje diario, desempeño semanal, búsqueda, tarea rápida,
montos rápidos, formato de dinero). Testing Library: navegación, hoja de registro, filtros de
Finanzas, paleta ⌘K, tarea rápida. Actualizar los tests que dependen de rutas/etiquetas/testids
(BottomNav, MainFlow, Dashboard, ControlPage, CreatePage → QuickRecordSheet, MovementForm,
TaskForm) y los scripts `scripts/verify-*.js`. Tests, lint, TypeScript y build; revisión en
navegador a 1280 px y 390 px, claro/oscuro, teclado, movimiento reducido y offline con recarga.
Registrar resultados y límites en `verification.md` sin afirmar lo no ejecutado.
