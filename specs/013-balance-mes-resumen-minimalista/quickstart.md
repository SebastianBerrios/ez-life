# Quickstart: validar la spec 013

Guía de validación de punta a punta. No contiene código de implementación: el detalle vive en
[contracts/](./contracts/) y [data-model.md](./data-model.md).

## Prerrequisitos

- `pnpm install` hecho; Node compatible con Next 14.
- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Para probar sincronización real** la migración `20261110120000_balance_onboarding_reminders.sql` debe
  estar aplicada en `mvp-lab` (solo `supabase db push`, con auditoría de flota y confirmación del dueño; ver
  [contracts/supabase-migration.md](./contracts/supabase-migration.md)). **Sin ella** todo lo demás se valida
  localmente (IndexedDB), pero el push de campos nuevos fallará y quedará en cola.

## 1. Automatizado (obligatorio antes de dar la feature por lista)

```bash
pnpm test        # suite completa (incluye voseoGuard y typographyGuard)
pnpm lint
pnpm build
```

Archivos de prueba que deben existir y pasar (ver `tasks.md`):

| Prueba | Qué demuestra |
|---|---|
| `calculateMonthBalance.test.ts` | Los 24 casos de [balance-rules.md](./contracts/balance-rules.md) + invariante por propiedad (SC-001). |
| `buildPendingRegistrations.test.ts` | Ventanas de aparición, recorte día 29–31, cubierto por vínculo, omitido, saldado, mes distinto del actual. |
| `evaluateNotifications.test.ts` | 1 `register_due` por ítem y mes; respeta duplicados; simulación de 3 meses sin acciones = 0 movimientos creados (SC-004). |
| `LocalOnboardingRepository.test.ts` | Pasos 1–4 atómicos e idempotentes; retomar sin duplicar (FR-026); tabla de compatibilidad v1→v2. |
| `LocalMovementRecurrenceRepository.test.ts` | `adoptLegacySources` no crea ocurrencias; las existentes quedan intactas (FR-018). |
| `LocalInstallmentLoanRepository.test.ts` | `alreadyPaid` sin movimientos; egreso con `account_id` (FR-020). |
| `calculateAccountBalances.test.ts` | `opening_date` ignora movimientos previos; sin `opening_date`, resultado idéntico al actual. |
| `buildSetupChecklist.test.ts` | "No tengo" completa; "Omitir" no. |
| Componentes (Testing Library): `OnboardingStep1..4`, `Summary*`, `GuidedTour`, `SettingsScreen` | Wiring de formularios, omitir/registrar, tour de 4 pasos, selector de tema. |
| `tokens.contrast.test.ts` | Pares de texto/fondo AA en claro y oscuro (SC-007). |

## 2. Recorrido manual — usuario nuevo (US1, US2, US5)

1. `pnpm dev`, abrir `http://localhost:3000` en una ventana limpia (sin datos) con el SO en **modo claro**;
   confirmar que **no** existe la clave `theme` en `localStorage` y que la app sigue al sistema (SC-007).
2. Iniciar sesión con una cuenta nueva. Paso 1: sueldo S/ 3,000, día de pago 28, "¿Ya recibiste tu sueldo?" = No.
3. Paso 2: Efectivo S/ 100 + "BCP" Débito S/ 1,500. Paso 3: tarjeta "BBVA", línea 5,000, consumido 800,
   cierre 10, pago 15. Paso 4: préstamo en cuotas (monto 12,000, cuota 1,000, 12 cuotas, 6 pagadas, día 5).
4. Terminar distribución y categorías. Esperado: arranca el **tour de 4 pasos** (con `Omitir`).
5. Resumen esperado: **Balance S/ 1,600**, `Entró S/ 0 · Salió S/ 0`; tarjeta `Usaste S/ 800 de S/ 5,000 ·
   Pagas el 15`; préstamo con saldo de 6 cuotas y próxima cuota S/ 1,000; "Por registrar" muestra `Sueldo`
   (día 28) cuando corresponda y no hay ningún movimiento creado solo.
6. En 390 px de ancho: sin scroll se ven balance, "Entró · Salió" y el primer ítem de "Por registrar".

## 3. Recorrido manual — reglas del Balance (US1)

Partiendo del paso 5 anterior (Balance S/ 1,600; BBVA con **deuda previa** de S/ 800). Los pagos de tarjeta
se aplican primero a la deuda previa (R3), por eso los pasos 4 y 5 sí mueven el Balance y el 6 no:

| # | Acción | Esperado |
|---|---|---|
| 1 | Ingreso S/ 500 (fuente "Sueldo Base") a BCP | Balance 2,100; `Entró S/ 500`; el ítem "Sueldo" sale de "Por registrar". |
| 2 | Gasto S/ 300 en efectivo | Balance 1,800; `Salió S/ 300`. |
| 3 | Compra S/ 100 con BBVA | Balance 1,700; `Salió S/ 400`; cuenta en el 50/30/20 ese día. |
| 4 | Transferir S/ 100 BCP → BBVA | Cubre deuda previa (800 → 700): Balance 1,600; `Salió S/ 500`. |
| 5 | Transferir S/ 700 BCP → BBVA | Salda la deuda previa: Balance 900; `Salió S/ 1,200`. |
| 6 | Transferir S/ 100 BCP → BBVA | Cubre la compra del paso 3 (ya descontada): Balance sin cambio; no es gasto. |
| 7 | Transferir S/ 200 BCP → cuenta de ahorros | `Ahorraste S/ 200`; Balance 700; el bloque Ahorro del 50/30/20 sube 200. |
| 8 | Retiro S/ 300 de ahorros → BCP | `Sacaste S/ 300 de tus ahorros`; Balance 1,000. |
| 9 | Mes siguiente (selector de mes) | Arranque = S/ 1,000 (cierre del mes anterior). |

Comprobación: 1,600 + 500 − 1,200 − 200 + 300 = 1,000 (el invariante de R1).

## 4. Recorrido manual — "Por registrar" y notificaciones (US3)

1. Crear una recurrencia mensual S/ 80 el día de hoy (marcar "Se repite cada mes").
2. Recargar y avanzar el reloj del navegador/SO al día de la regla en el mes siguiente: **no** aparece ningún
   movimiento nuevo; "Por registrar" muestra `Gimnasio · S/ 80 · día N`.
3. **Registrar** → formulario prellenado → guardar → el ítem desaparece y el Balance baja S/ 80. Repetir con
   **Omitir este mes** (desaparece solo este mes; reaparece el siguiente).
4. Con "Recordatorio" activado en Ajustes → llega **una** notificación `Toca registrar: Gimnasio`; refrescar
   varias veces no genera otra.
5. Registrar a mano un gasto con la misma descripción pero **sin** vínculo de la regla: el ítem **no** queda
   cubierto (FR-019).

## 5. Recorrido manual — usuario existente (US5-S6, FR-032)

1. Cargar un perfil con `onboarding_step = 3` (v1, completo) y tarjetas sin línea de crédito.
2. Abrir la app: **no** se repite el onboarding; se ve el tour **una vez** y la tarjeta
   `Completa tu configuración · N de 4`; la tarjeta existente muestra `Debes S/ X` y `Agregar línea de crédito`.
3. Datos y "Efectivo" existente intactos; recurrencias ya generadas conservadas.

## 6. Sin conexión (SC-008, Principio XII)

DevTools → Network → *Offline*: repetir el onboarding de un usuario ya autenticado, registrar desde "Por
registrar", omitir, descartar el checklist y repetir el tutorial. Todo funciona; al volver *Online* la sincronización
termina sin errores en consola.

## 7. Visual (US6)

- Claro y oscuro con calidad equivalente en Resumen, onboarding, checklist y tour; fondo crema / ciruela
  oscuro; verde pastel como acento.
- Ajustes → Apariencia: `Claro`, `Oscuro`, `Sistema` cambian al instante y persisten tras recargar.
- Búsqueda en el código: cero `font-mono`, `uppercase` de etiqueta y `JetBrains` (lo hace cumplir
  `typographyGuard.test.ts`); las fuentes Fredoka/Figtree se sirven desde el mismo origen (pestaña Network).
- Teclado: foco visible, controles ≥ 44 px, "reducir movimiento" respetado.
- `Lighthouse`/axe en Resumen: sin fallos de contraste.

## Criterio de salida

`pnpm test`, `pnpm lint` y `pnpm build` en verde, los recorridos 2–6 sin diferencias, y la migración aplicada
(con confirmación del dueño) antes de publicar el cliente. Registrar el resultado en `verification.md` (como en
las specs 009–012).
