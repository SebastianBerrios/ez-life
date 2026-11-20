# Contrato: copy de UI y estructura del Resumen

Español latinoamericano neutro, **tuteo**, sin voseo (Principio VI; `src/voseoGuard.test.ts` debe seguir
verde). Texto escrito a mano en los componentes. Los importes se muestran con `formatMoney` (PEN).

## Resumen — orden y contenido (FR-034, SC-009)

Móvil (390 px): una columna. Escritorio: barra lateral conservada, columna centrada de ~720 px, **Cuentas y
Deudas lado a lado**, sin cuadrícula de indicadores. Sin scroll en 390 px se ven: cifra del balance,
"Entró · Salió" y el primer ítem de "Por registrar" (SC-003).

| # | Sección | Contenido y frases |
|---|---|---|
| 1 | **Balance del mes** (`data-tour="balance"`) | Cifra grande; debajo `Entró S/ 500 · Salió S/ 300`. Línea aparte solo si existen: `Ahorraste S/ 200`, `Sacaste S/ 300 de tus ahorros`, `Ajuste de saldo S/ 40`. Negativo: signo + `Gastaste más de lo que tenías este mes` (tono neutro). Botón de ocultar importes conservado. |
| 2 | **Por registrar** | Filas `Gimnasio · S/ 80 · día 5` con **Registrar** y **Omitir este mes**; vencidas destacadas. `Ver todos (N)` si hay muchas. Vacío: `No tienes nada pendiente este mes.` Solo mes en curso. |
| 3 | **Cuentas** y **Deudas** (`data-tour="accounts"`) | Cuentas: débito, efectivo y ahorros con saldo (sin archivadas). Deudas: tarjeta `Usaste S/ 800 de S/ 5,000 · Pagas el 15`; sin línea: `Debes S/ 800` + acción `Agregar línea de crédito`; préstamo: saldo y `Próxima cuota S/ 250`. Vacío de deudas: `No tienes tarjetas ni préstamos. Si los tienes, agrégalos para ver cuánto debes.` |
| 4 | **50/30/20** | Barra compacta + frases: `Te quedan S/ 885 para necesidades`; ahorro negativo: `Este mes sacaste más de lo que ahorraste`. |
| 5 | **Meta de ahorro principal** | Reutiliza `pickPrimarySavingsGoal`. |
| 6 | **Completa tu configuración · N de 4** (`data-tour="setup"`) | Descartable; ítems Ingresos, Cuentas, Tarjetas, Préstamos; cada uno abre su paso. |

Retirado del Resumen (FR-011, FR-036): "Capital disponible", "Rendimiento conductual", "Foco de Hoy"/hábitos,
"Terminal de control", "Resumen Ejecutivo", cuadrícula de indicadores y el bloque "Mi progreso" (sigue en su
ruta; `MobileRouteLinks` del Resumen pasa a `showProgress={progress.visible}`).

En móvil, tras la sección 6, se conservan los accesos de navegación a `Espacio compartido` y `Mi progreso` (`MobileRouteLinks`); no son secciones (FR-034, SC-009).

## Onboarding (6 pasos)

Indicador de progreso con los nombres: `Ingresos`, `Dinero`, `Tarjetas`, `Préstamos`, `Distribución`,
`Categorías`.

| Paso | Título | Campos / botones |
|---|---|---|
| 1 | `Tus ingresos` | `Ingreso mensual` (obligatorio); `¿Qué día te pagan?` (opcional, 1–31); `¿Ya recibiste tu sueldo de este mes?` (Sí / No). `Continuar`. |
| 2 | `¿Dónde tienes tu dinero?` | Campo fijo `Efectivo` (S/ 0 por defecto); lista de cuentas con `Nombre`, `Tipo` (Débito / Ahorros) y `Saldo actual`; `+ Agregar cuenta`; botón `Solo uso efectivo` (declara que no usas cuentas de banco). `Continuar` siempre habilitado. |
| 3 | `¿Tienes tarjetas de crédito?` | Por tarjeta: `Nombre`, `Línea de crédito` (obligatoria), `Consumido hasta hoy`, `Día de cierre`, `Día de pago`; resumen `Usaste S/ X de S/ Y · Pagas el 15`. Botones: `Guardar tarjetas y continuar`, `No tengo tarjetas`, `Omitir por ahora`. |
| 4 | `¿Tienes préstamos?` | `Entidad o persona`; interruptor `¿Pagas en cuotas?`. Con cuotas: `Monto`, `Cuota`, `Cuotas totales`, `Cuotas ya pagadas`, `Día de pago`. Sin cuotas: `Saldo pendiente`. Botones: `Guardar préstamos y continuar`, `No tengo préstamos`, `Omitir por ahora`. |
| 5 | `Distribución` | Sin cambios funcionales (spec 012). |
| 6 | `Categorías` | Sin cambios funcionales (spec 012). |

Validaciones (mensaje junto al campo, `role="alert"`):
- `El consumo no puede superar la línea de crédito.`
- `La línea de crédito es obligatoria.`
- `El saldo no puede ser negativo.`
- `Las cuotas pagadas no pueden superar las cuotas totales.`
- `Ingresa un día entre 1 y 31.`

## Tour de 4 pasos (cada uno con `Omitir`)

1. `Tu balance del mes` — "Aquí ves cuánto dinero tienes este mes."
2. `Tus cuentas y deudas` — "Revisa dónde está tu dinero y cuánto debes."
3. `Registrar` — "Toca el botón + para anotar un gasto o un ingreso."
4. `Completa tu configuración` — "Desde aquí (o en Ajustes) agregas lo que te falta."
Botones: `Siguiente`, `Listo`, `Omitir`.
Anclas (`data-tour`): `balance` (paso 1), `accounts` (paso 2), `add` (botón "+", paso 3), `setup` (tarjeta de checklist, paso 4) o `settings` (entrada de nav Ajustes) si no hay tarjeta. Cada paso usa el primer elemento visible.

## Ajustes

- Nuevas filas: `Completar configuración` (abre el paso pendiente), `Ver tutorial`.
- Apariencia: selector `Claro` / `Oscuro` / `Sistema`.
- Corrección FR-045: `Recibí alertas cuando superes…` → `Recibe alertas cuando superes el 80% de un
  presupuesto, cumplas una meta de ahorro, o un recordatorio diario para registrar tus movimientos.`

## Notificación `register_due`

Título `Toca registrar: <nombre>`; cuerpo `<nombre> · S/ <monto> · día <día>`. Una vez por ítem y mes.

## Guardia tipográfica (SC-006)

`src/typographyGuard.test.ts` falla si en `src/` (excepto tests y la propia guardia) aparece `font-mono`,
`label-mono`, `JetBrains` o una etiqueta estilizada con `uppercase`. Se activa al terminar el barrido de
estilos (si se activa antes, falla hasta terminar).
