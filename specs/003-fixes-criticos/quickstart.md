# Quickstart: 003-fixes-criticos

Guía de validación manual + automatizada. Prerrequisito: `pnpm install` ya corrido, `.env.local`
con las credenciales de `mvp-lab` ya configurado (ver `CLAUDE.md` raíz del monorepo).

## 1. Automatizado — `pnpm test`

```bash
pnpm test
```

Debe incluir (nuevos, agregados en la fase de tasks):

- `src/core/use-cases/recordInstallmentPayment.test.ts` — el resultado devuelto incluye la
  descripción del `Movement` a crear (monto, fecha), sin crearlo él mismo (sigue puro).
- `src/core/use-cases/recordPrincipalPayment.test.ts` — ídem para `principal`, ambos
  `adjustment.type`.
- `src/infrastructure/repositories/local/LocalInstallmentLoanRepository.test.ts` — tras
  `recordInstallmentPayment`/`recordPrincipalPayment`, existe un `db.movements` con
  `installment_payment_id` apuntando al pago, monto y `distribution_category_id` correctos
  (**incluye el caso `reduce_installment_amount` que hoy falta — ver research.md §4**).
- `src/presentation/components/MovementList.test.tsx` — tras invocar el callback de creación desde
  el padre, la lista se refetch-ea (no requiere reload).
- `src/presentation/components/HabitList.test.tsx` — un hábito no programado para "hoy" sigue
  apareciendo en la lista, marcado como "no corresponde hoy".
- `src/presentation/components/InstallmentLoanList.test.tsx` — el botón de confirmar abono queda
  `disabled` mientras la promesa está en curso.

## 2. Manual — dropdowns (US4)

1. `pnpm dev`, loguearse, abrir cualquier formulario con un Select (ej. Nuevo Movimiento →
   categoría).
2. Abrir el dropdown con un valor ya seleccionado.
3. **Esperado**: el menú se despliega debajo del control, sin tapar el valor actual ni el primer
   ítem.

## 3. Manual — reactividad (US2)

1. Ir a Movimientos, crear un ingreso.
2. **Esperado**: aparece en la lista sin recargar la página.
3. Repetir para un hábito y una tarea desde "Crear", navegar a Control.
4. **Esperado**: ambos aparecen sin recargar.

## 4. Manual — hábitos en Control (US3)

1. Crear un hábito con `fixed_days` que NO incluya el día de hoy (ej. solo sábado, en un día de
   semana).
2. Ir a Control.
3. **Esperado**: el hábito aparece igual, marcado como "no corresponde hoy" (antes: no aparecía).

## 5. Manual — préstamos (US1)

1. Crear un préstamo de prueba con `distribution_category_id` asignado.
2. Registrar un pago de cuota (`installment`).
3. **Esperado**: `remaining_installments` baja en 1; el balance total baja en el monto pagado;
   Movimientos muestra un nuevo egreso vinculado a ese pago.
4. Registrar un abono a capital con "Reducir cuota".
5. **Esperado**: `remaining_installments` NO cambia; el balance baja en el monto del abono;
   Movimientos muestra el egreso correspondiente.
6. Repetir el paso 4 haciendo doble clic rápido en "Confirmar".
7. **Esperado**: se registra un solo pago (botón queda `disabled` durante el submit), no dos.

## Fuera de alcance de esta guía

- El fix de sync pull (FR-015) requiere dos sesiones/dispositivos distintos para validarse — se
  verifica en su propia tarea con un test de integración contra `CustomSyncLayer`, no manualmente
  acá.
