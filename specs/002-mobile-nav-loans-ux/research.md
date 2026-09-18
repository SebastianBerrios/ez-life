# Research: Navegación mobile, metas/tareas/hábitos, préstamos con cuotas y dropdowns

Todas las decisiones de producto ya quedaron resueltas en `spec.md` (incluida la sesión de
`## Clarifications`), después de una sesión de grilling extensa con el usuario previa a
`/speckit-specify`. Lo que sigue son las decisiones técnicas puntuales que hacían falta para poder
diseñar el modelo de datos y los contratos, sin dejar nada como `NEEDS CLARIFICATION` en el
Technical Context del plan.

## 1. Por qué `InstallmentLoan` no calcula ninguna tabla de amortización

**Decision**: El sistema nunca deriva `installment_amount`, cuotas restantes ni ningún otro número
a partir de `amount` e `interest_rate` mediante una fórmula de amortización (francesa, alemana o
cualquier otra). Todos esos valores los ingresa el usuario directamente, tal como se los da su banco
o caja, y el sistema solo los guarda y lleva la cuenta de lo que ya se pagó (FR-011, FR-012).

**Rationale**: Cualquier fórmula de amortización que el sistema implementara podría no coincidir
exactamente con el redondeo/método que usa la entidad financiera real del usuario (sistema francés
vs. alemán, redondeo por cuota vs. por período, etc.), mostrando un número que "no cuadra" con el
estado de cuenta real — exactamente el problema que el usuario pidió evitar explícitamente. Guardar
los números tal cual se los dan es más simple (Principio VII) y elimina esa clase entera de bugs.

**Alternatives considered**:
- *Implementar amortización francesa (la más común en bancos peruanos)*: se descartó por decisión
  explícita del usuario durante el grilling — ver Q3 de la sesión de clarificación previa a esta
  spec (no forma parte de `spec.md` porque ocurrió antes de `/speckit-specify`, pero es la razón de
  fondo de FR-012/FR-013).
- *Ofrecer ambos modos (con y sin fórmula) configurables por préstamo*: se descartó por
  Principio VII — agregaría una rama de lógica completa (motor de amortización + su UI) para un
  caso que el usuario ya dijo no necesitar.

## 2. Por qué `InstallmentLoan`/`InstallmentPayment` no necesitan ningún cambio en la capa de sync

**Decision**: Ambas tablas se agregan a la lista `SYNCED_TABLES` existente en
`src/infrastructure/db/db.ts` exactamente igual que cualquier otra entidad sincronizada (`debts`,
`goals`, `tasks`, etc.). No hace falta ningún código nuevo de sync.

**Rationale**: Este proyecto acaba de corregir un bug donde los hooks `creating`/`updating` de Dexie
que escriben a `sync_queue` perdían la escritura en silencio en un navegador real, porque esa tabla
no estaba dentro del scope de la transacción implícita de un `db.<tabla>.put()` directo. El fix
(`setupSyncQueueTransactionScope()`, un middleware `db.use({stack: 'dbcore'})`) resuelve esto para
**toda** tabla listada en `SYNCED_TABLES`, no tabla por tabla — así que cualquier tabla nueva que se
agregue a esa lista queda cubierta automáticamente, sin repetir trabajo.

**Alternatives considered**: Ninguna evaluada — es el mismo patrón que ya usa cada entidad
sincronizada del proyecto, no hay una alternativa razonable a seguirlo.

## 3. Por qué `InstallmentLoan` es una entidad nueva y no una extensión de `Debt`

**Decision**: `InstallmentLoan` se modela como una entidad de dominio separada, no como campos
opcionales agregados a `Debt`.

**Rationale**: `Debt` tiene un contrato simple y estable (monto único + abonos acumulados en
`settled_amount`) usado hoy tanto para `lent` como para `borrowed`. Agregarle campos opcionales de
cuotas/plazo lo complicaría para el 80%+ de sus usos actuales (préstamos informales entre personas,
sin cuotas pactadas) y mezclaría dos semánticas de "pago" distintas (un abono libre vs. una cuota
fija con posibilidad de reducir plazo o monto) en una sola entidad — el mismo tipo de problema que el
Principio XIII ya identifica para `Habit`/`Goal`/`Task`/`SavingsGoal`. `InstallmentLoan` solo aplica
a préstamos de una entidad financiera (siempre `borrowed`, per Clarifications de `spec.md`), un caso
de uso genuinamente distinto al de `Debt`.

**Alternatives considered**:
- *Extender `Debt` con campos opcionales (`installment_count?`, `remaining_installments?`, etc.)*:
  se descartó — decisión explícita del usuario durante el grilling (ver el prompt de
  `/speckit-specify`, sección 3), por el riesgo de romper o complicar el 80% de usos actuales de
  `Debt` que no tienen cuotas.

## 4. Por qué el drawer de "Más" no necesita una nueva dependencia

**Decision**: El overlay de "Más" (FR-002) se implementa con las primitivas ya disponibles en el
proyecto (Radix/shadcn `Sheet` o `Dialog`, según lo que ya esté instalado bajo `components/ui/`), no
con una librería de bottom-sheet dedicada.

**Rationale**: Principio I/VII — un bottom-sheet es un `Sheet`/`Dialog` posicionado abajo con una
animación de entrada, patrón que shadcn ya cubre. Si el proyecto no tuviera ya un componente `Sheet`
instalado, se evalúa agregarlo vía `shadcn add sheet` (no es una dependencia nueva, es un componente
generado dentro del propio proyecto, igual que `select.tsx`).

**Alternatives considered**: Ninguna librería externa de bottom-sheet fue evaluada seriamente — el
volumen de valor que aportaría (unas pocas líneas de posicionamiento/animación) no supera el umbral
de 50 líneas del Principio VII.
