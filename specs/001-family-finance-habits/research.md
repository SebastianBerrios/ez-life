# Research: Finanzas familiares, préstamos y hábitos motivacionales

Todas las decisiones de producto ya quedaron resueltas en `spec.md` (incluida la sesión de
`## Clarifications`). Lo que sigue son las decisiones puramente técnicas que hacían falta para
poder diseñar el modelo de datos y los contratos, sin dejar nada como `NEEDS CLARIFICATION` en el
Technical Context del plan.

## 1. Cómo lograr "casi instantáneo" en el espacio compartido sin romper offline-first

**Decision**: Suscribir un canal de Supabase Realtime (`supabase.channel(...).on('postgres_changes', ...)`)
por espacio compartido activo, que dispara un pull incremental inmediato de ese espacio cuando llega
un cambio — aditivo sobre el `CustomSyncLayer` existente (pull cada 5 min / al reconectar / al abrir
la app), nunca en reemplazo.

**Rationale**: `@supabase/supabase-js` ya está en el proyecto (incluye el cliente Realtime), así que
no hace falta ninguna dependencia nueva (Principios I/VII). Cuando el canal no está disponible
(offline, o el navegador lo cierra), la app sigue funcionando exactamente igual que hoy con el pull
periódico — la mejora es aditiva, nunca un requisito duro (Principio XII).

**Alternatives considered**:
- *Polling más agresivo (cada 10-15s) en vez de Realtime*: se descartó por consumir batería/red sin
  necesidad, cuando ya existe un canal de push nativo en la misma librería.
- *WebSocket propio*: se descartó — reinventar lo que Supabase Realtime ya resuelve violaría el
  Principio VII (Simplicidad).

## 2. Dónde se valida y canjea un código de invitación

**Decision**: El canje se hace a través de una función Postgres `SECURITY DEFINER` (RPC) que recibe
el código, valida que exista, no esté vencido (24-48hs) y no haya sido usado, y si todo es válido
crea la fila de `Membership` de forma atómica. El cliente nunca inserta una membresía directamente.

**Rationale**: Es la única forma de cumplir el Principio IX (membership nunca implícita ni por
auto-inserción) de manera verificable — la lógica de validación vive del lado del servidor, no
puede saltearse manipulando el cliente.

**Alternatives considered**:
- *Política RLS de auto-inserción con el código como condición*: se descartó explícitamente — es
  justo el patrón que el Principio IX prohíbe, porque una condición de RLS mal escrita es mucho más
  fácil de explotar que una función atómica con su propia validación.

## 3. Cómo se calcula "quién le debe a quién" en un espacio compartido

**Decision**: El saldo entre cada par de miembros se calcula bajo demanda con una función pura en
`core/use-cases` (sin persistir un balance acumulado) a partir de los `SharedMovement` y los `Debt`
manuales asociados a ese espacio. Se recalcula en cada lectura del dashboard/pantalla de deudas.

**Rationale**: Evita mantener un contador denormalizado que se puede desincronizar (por ejemplo, si
se borra un gasto compartido). Con offline-first y sync eventual, un balance derivado en el momento
de la lectura es más simple y más correcto que uno cacheado que necesitaría invalidación (Principio
VII). El volumen de movimientos de un espacio familiar es bajo (no es un caso de escala que
justifique la complejidad de un balance materializado).

**Alternatives considered**:
- *Columna de balance acumulado actualizada por trigger*: se descartó por el riesgo de
  desincronización silenciosa con ediciones/borrados offline, y porque agrega lógica de invalidación
  que el Principio VII no justifica a este volumen de datos.

## 4. Cómo se integran los nuevos recordatorios al sistema de notificaciones existente

**Decision**: Los cinco tipos nuevos (`loan_due_soon`, `shared_movement_added`, `habit_reminder`,
`task_due`, `streak_at_risk`) se agregan como nuevas ramas dentro de la función pura
`evaluateNotifications` ya existente (invocada por `useNotificationEvaluator`), siguiendo el mismo
patrón que los tipos actuales (`budget_over_80`, `goal_completed`, `daily_reminder`).

**Rationale**: Es exactamente lo que exige el Principio XI (un solo sistema de recordatorios) — no
se crea un pipeline de evaluación paralelo ni un segundo hook de scheduling.

**Alternatives considered**: Ninguna evaluada seriamente — el principio constitucional ya elimina
cualquier alternativa de un sistema paralelo.
