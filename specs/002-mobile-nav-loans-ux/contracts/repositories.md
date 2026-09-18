# Contratos: interfaces de repositorio

Esta app no expone una API REST propia — el "contrato" real hacia `core/use-cases` y
`presentation/` son las interfaces de repositorio en
`src/core/domain/repositories/IRepositories.ts`, igual que `IDebtRepository`,
`IMovementRepository`, etc. ya existentes. `IInstallmentLoanRepository` tiene una implementación
local (`LocalInstallmentLoanRepository.ts`, Dexie) que encola cada cambio en `sync_queue` mediante
el mismo mecanismo (hooks + middleware `dbcore`) que ya usa toda entidad sincronizada — ver
`research.md` #2.

Firmas a nivel de contrato (sin implementación) — todos los tipos vienen de `data-model.md`:

## IInstallmentLoanRepository

- `getAll(userId): Promise<InstallmentLoan[]>`
- `getById(id): Promise<InstallmentLoan | undefined>`
- `create(loan): Promise<void>` — `remaining_installments` se inicializa igual a
  `installment_count` (FR-011)
- `updateTerms(id, { amount?, installmentCount?, installmentAmount?, interestRate? }): Promise<void>`
  — corrige los términos originales, independiente de registrar un pago (FR-022)
- `recordInstallmentPayment(loanId, installmentsPaid, date): Promise<void>` — valida que
  `installmentsPaid <= remaining_installments` (rechaza si no, FR-021), decrementa
  `remaining_installments`, crea un `InstallmentPayment` con `kind = 'installment'`, y actualiza
  `status` a `settled` si llega a 0 (FR-014, FR-025) — vía el use-case puro
  `recordInstallmentPayment.ts`, no lógica en el repositorio. **Nunca crea ni toca un `Movement`**
  (FR-027, Principio X) — el use-case es una función pura sin acceso a `IMovementRepository`, mismo
  patrón que `applyDebtSettlement.ts`.
- `recordPrincipalPayment(loanId, amountCents, date, adjustment): Promise<void>` — `adjustment` es
  `{ type: 'reduce_term', newRemainingInstallments } | { type: 'reduce_installment_amount', newInstallmentAmountCents }`;
  valida que `amountCents` no exceda el saldo pendiente (rechaza si no, FR-021), aplica el valor que
  el usuario ingresó (nunca lo calcula), crea un `InstallmentPayment` con `kind = 'principal'`
  (FR-015 a FR-017, FR-026) — vía `recordPrincipalPayment.ts`. **Nunca crea ni toca un `Movement`**
  (FR-027, Principio X), mismo motivo que arriba.
- `getPayments(loanId): Promise<InstallmentPayment[]>` — historial completo, ordenado por fecha
  (FR-026)
- `delete(id): Promise<void>`

## IGoalRepository, ITaskRepository, IHabitRepository (sin cambios de contrato)

**Corrección aplicada durante `/speckit-analyze` (hallazgo F1)**: este documento proponía
originalmente un método `update(id, changes)` nuevo. No hace falta — `LocalGoalRepository.save()`,
`LocalTaskRepository.save()` y `LocalHabitRepository.save()` ya hacen upsert por `id` (confirmado
leyendo esos tres archivos). FR-006 (edición desde "Crear") se resuelve pasándole a `save()` el `id`
de un ítem existente desde la UI — ningún método de repositorio nuevo, ninguna interfaz cambia.

## IDebtRepository (sin cambios)

Se reutiliza tal cual — `InstallmentLoan` es una entidad separada, no una extensión de `Debt` (ver
`research.md` #3).

## Selector unificado (sin contrato de repositorio — es de presentación)

No aplica un contrato de datos: `SettingsScreen.tsx`, `DebtForm.tsx` y `SharedMovementForm.tsx`
migran su `<select>` nativo al componente ya existente `src/components/ui/select.tsx` (FR-023,
FR-024). Es un cambio de presentación puro, sin tocar ninguna interfaz de repositorio.
