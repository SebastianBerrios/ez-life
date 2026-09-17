# spec.md — 007-network-gate-and-notifications

> [!NOTE]
> Esta spec autoriza retroactivamente (constitución regla 2) el trabajo de
> código ya implementado para cerrar las deudas 1 y 3 documentadas al cierre
> de `specs/006-qa-remediation/spec.md`. Deuda 2 (i18n) y deuda 4 (reasignar
> categoría entre buckets) quedan sin cambios, por decisión explícita del
> usuario — no forman parte de esta spec.

## Contexto

Al cerrar `006-qa-remediation` quedaron 4 deudas documentadas. El usuario las
resolvió una por una:

1. **Onboarding offline multi-dispositivo** → el wizard completo (no solo el
   login) va a exigir conexión, eliminando de raíz la duplicación de
   buckets/categorías seed entre dispositivos.
2. **i18n** → queda como deuda documentada, sin cambios.
3. **RF-16 (notificaciones)** → se implementa completo: historial in-app,
   alerta de presupuesto >80%, alerta de meta al 100%, hora configurable.
4. **Reasignar categoría entre buckets** → se mantiene inmutable, sin cambios.

Esta spec cubre el código de los puntos 1 y 3.

---

## RF-30 — El wizard de onboarding exige conexión

Amplía la excepción offline-first de la regla 5 de la constitución (hoy solo
cubre el login inicial, RF-01) a todo el wizard de onboarding.

Criterios de aceptación:
- Mientras el usuario está en cualquier paso del wizard de onboarding y no hay
  conexión, el sistema bloquea el wizard con un mensaje explícito y no permite
  continuar.
- El bloqueo es reactivo: si la conexión vuelve a mitad del wizard, el sistema
  retoma automáticamente en el paso donde estaba (el progreso ya persistido en
  IndexedDB por paso no se pierde ni se duplica).
- De paso, se corrige RF-01: el login ahora sí implementa su propio criterio
  de aceptación ("si no hay conectividad, informar que se requiere conexión")
  y captura errores del proveedor OAuth — antes no estaba implementado pese a
  que el texto de RF-01 lo prometía.

**Archivos**: `src/presentation/hooks/useOnlineStatus.ts` (NEW), `MainFlow.tsx`
(gate en el paso `onboarding-wizard`), `LoginScreen.tsx` (estado de error +
chequeo de red).

---

## RF-31 — Notificaciones completas (reemplaza el alcance parcial de RF-16)

`specs/001-ezlife-mvp/spec.md` RF-16 queda actualizado para reflejar esta
implementación — ver la enmienda aplicada ahí mismo. Resumen del alcance
nuevo:

- **Historial in-app**: cada alerta se persiste en una tabla `notifications`
  nueva (sincronizada igual que el resto de las tablas), visible desde un
  panel accesible por un ícono de campana (no se agregó un 6º ítem a
  `BottomNav`, que ya tiene 5 por decisión de `specs/004`).
- **Alerta de presupuesto >80%**: por bucket de distribución, una vez por
  ciclo (deduplicada por `type + related_id + cycle_key`).
- **Alerta de meta de ahorro al 100%**: una vez por meta, de por vida (no por
  ciclo — llegar a la meta es un evento único).
- **Recordatorio diario configurable**: el usuario define una hora (0-23) en
  Ajustes; el sistema dispara el recordatorio una vez por día a partir de esa
  hora, mientras la pestaña esté abierta.
- **Toggles independientes**: "notificaciones in-app" y "notificaciones push
  del navegador" se activan/desactivan por separado, tal como pedía el
  criterio original de RF-16.

**Limitación conocida, documentada y aceptada**: no hay service worker ni Web
Push real — el recordatorio horario y las alertas push solo disparan mientras
la aplicación está abierta en una pestaña. Implementar push real del sistema
operativo queda fuera de alcance de esta spec.

**Archivos**: `src/core/domain/models/types.ts` (`Notification`, campos
nuevos en `Profile`), `src/infrastructure/db/db.ts` (Dexie versión 5, tabla
`notifications`), `src/infrastructure/sync/CustomSyncLayer.ts` (tabla sumada
al pull), `IRepositories.ts` + `LocalNotificationRepository.ts` (NEW),
`src/core/use-cases/calculateSavingsGoalProgress.ts` (NEW),
`src/core/use-cases/calculateCategoryBreakdown.ts` (agrega
`calculateSpentByBucket`, compartido por `Dashboard.tsx` y el evaluador —
antes la fórmula estaba duplicada), `src/core/use-cases/evaluateNotifications.ts`
(NEW), `src/presentation/hooks/useNotificationEvaluator.ts` (NEW, corre al
montar y cada 5 minutos, mismo intervalo que `useSyncManager`),
`SettingsScreen.tsx` (hora + toggles), `NotificationHistory.tsx` (NEW),
`MainFlow.tsx` / `BottomNav.tsx` / `Layout.tsx` (ícono de campana + modal).

---

## Restricciones

- Sin nuevas dependencias runtime (constitución regla 7).
- Lógica de negocio en `core/use-cases`, cero lógica en componentes/hooks de
  presentación (constitución regla 3).
- Cada use-case nuevo con test unitario Vitest (constitución regla 4).
- `pnpm test`, `pnpm lint`, `npx tsc --noEmit` en verde.

## Estado

Implementado y verificado: 82/82 tests, lint y `tsc --noEmit` limpios.
