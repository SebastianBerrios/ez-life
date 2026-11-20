# UI & Pure-Function Contracts: Minimalismo en el resto de la app

**Feature**: `014-minimalismo-resto-app` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

Esta spec no modifica endpoints, RPCs ni tablas de Supabase. Los contratos que define son:
1. Funciones puras de formato y cálculo de vista en `src/core/use-cases/`.
2. Primitivas de interfaz compartidas en `src/components/ui/`.
3. Contratos de navegación, diseño responsive y copy en tuteo.

---

## 1. Funciones puras (`src/core/use-cases/`)

### 1.1 `buildFinancesHero.ts`

```ts
export interface FinancesHeroInput {
  filteredMovements: Movement[];
  allMovements: Movement[];
  accounts: PaymentAccount[];
  loans: InstallmentLoan[];
  debts: Debt[];
  rule: RuleView;
}

export interface FinancesCreditCardItem {
  accountId: string;
  name: string;
  owedCents: number;
  creditLimitCents?: number;
  paymentDay?: number;
}

export interface FinancesHeroSummary {
  movementsNetCents: number;
  movementsIncomeCents: number;
  movementsExpenseCents: number;
  ruleSpentPercent: number | null;
  ruleTotalSpentCents: number;
  ruleExpectedIncomeCents: number;
  totalOwedCents: number;
  totalOwedToMeCents: number;
  creditCards: FinancesCreditCardItem[];
}

export function buildFinancesHero(input: FinancesHeroInput): FinancesHeroSummary;
```

- **Reglas**:
  - `movementsIncomeCents` = suma de `amount` en `filteredMovements` con `type === 'INCOME'` y sin `deleted_at`.
  - `movementsExpenseCents` = suma de `amount` en `filteredMovements` con `type === 'EXPENSE'` y sin `deleted_at`.
  - `movementsNetCents = movementsIncomeCents - movementsExpenseCents`.
  - `ruleSpentPercent = rule.spentPercentOfBase`.
  - `creditCards` deriva la deuda de cada tarjeta activa (`kind === 'credit' && !archived && !deleted_at`) usando `calculateAccountBalances` + `selectCardOwed`.
  - `totalOwedCents` = suma de (`remaining_installments * installment_amount` de préstamos activos) + suma de `owedCents` de `creditCards` + suma de `Math.max(0, amount - settled_amount)` de deudas `borrowed` activas.
  - `totalOwedToMeCents` = suma de `Math.max(0, amount - settled_amount)` de deudas `lent` activas.

### 1.2 `formatFinancesPhrases.ts`

```ts
export function formatRuleBucketPhrase(bucket: Pick<RuleBucket, 'name' | 'spent' | 'budget' | 'remaining' | 'status'>, isSavings?: boolean): string;
export function formatInstallmentLoanPhrase(loan: Pick<InstallmentLoan, 'status' | 'remaining_installments' | 'payment_day'>): string;
export function formatInformalDebtPhrase(debt: Pick<Debt, 'direction' | 'counterparty_name' | 'amount' | 'settled_amount'>): string;
export function formatCreditCardPhrase(card: Pick<FinancesCreditCardItem, 'owedCents' | 'creditLimitCents' | 'paymentDay'>): string;
```

- **Ejemplos contractuales (tuteo neutro, sin voseo; salida canónica usando `formatMoney` con dos decimales y `bucket.name.toLowerCase()`)**:
  - `formatRuleBucketPhrase` (no ahorro, dentro de presupuesto): `"Llevas S/ 130.00 de S/ 630.00 en deseos"`.
  - `formatRuleBucketPhrase` (no ahorro, excedido): `"Te pasaste S/ 20.00 en deseos"`.
  - `formatRuleBucketPhrase` (`isSavings = true`, en progreso): `"Ahorraste S/ 150.00 de S/ 420.00"`.
  - `formatRuleBucketPhrase` (`isSavings = true`, meta alcanzada): `"Ahorraste S/ 420.00 · meta cumplida"`.
  - `formatRuleBucketPhrase` (`isSavings = true`, meta superada): `"Ahorraste S/ 500.00 · superaste tu meta de S/ 420.00"`.
  - `formatRuleBucketPhrase` (`budget <= 0`): `"Llevas S/ 130.00 en deseos"` (o `"Ahorraste S/ 150.00"` si `isSavings`).
  - `formatInstallmentLoanPhrase` (8 cuotas, día 15): `"Te faltan 8 cuotas · próxima el 15"`.
  - `formatInstallmentLoanPhrase` (1 cuota, día 15): `"Te falta 1 cuota · próxima el 15"`.
  - `formatInstallmentLoanPhrase` (3 cuotas, sin día): `"Te faltan 3 cuotas"`.
  - `formatInstallmentLoanPhrase` (saldado): `"Préstamo saldado"`.
  - `formatInformalDebtPhrase` (`borrowed`, pendiente): `"Le debes S/ 120.00 a Juan"`.
  - `formatInformalDebtPhrase` (`lent`, pendiente): `"Juan te debe S/ 80.00"`.
  - `formatInformalDebtPhrase` (saldado): `"Saldado con Juan"`.
  - `formatCreditCardPhrase` (con línea): `"Usaste S/ 450.00 de S/ 2,000.00 · Pagas el 15"`.
  - `formatCreditCardPhrase` (sin línea): `"Debes S/ 450.00"`.

### 1.3 `formatSharedSpacePhrases.ts`

```ts
export interface SharedPairPhrase {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  tone: 'positive' | 'negative' | 'neutral';
  phrase: string;
}

export interface SharedSpaceNetSummary {
  netCents: number;
  tone: 'positive' | 'negative' | 'settled';
  heroPhrase: string;
  pairPhrases: SharedPairPhrase[];
}

export function buildSharedSpaceSummary(
  balances: PairBalance[],
  currentUserId: string,
  memberNames?: Record<string, string>,
): SharedSpaceNetSummary;

export function formatSharedMovementSplit(
  movement: Pick<SharedMovement, 'paid_by' | 'split_type'>,
  currentUserId: string,
  memberNames?: Record<string, string>,
): string;
```

- **Ejemplos contractuales (salida canónica con `formatMoney`)**:
  - `balances = []` → `{ netCents: 0, tone: 'settled', heroPhrase: 'Están al día', pairPhrases: [] }`.
  - `fromUserId = 'ana'`, `toUserId = currentUserId`, `amount = 4000` → `"Ana te debe S/ 40.00"`, `tone: 'positive'`.
  - `fromUserId = currentUserId`, `toUserId = 'ana'`, `amount = 4000` → `"Le debes S/ 40.00 a Ana"`, `tone: 'negative'`.
  - `fromUserId = 'ana'`, `toUserId = 'luis'` (ninguno es `currentUserId`), `amount = 4000` → `"Ana le debe S/ 40.00 a Luis"`, `tone: 'neutral'`.
  - Si un `userId` no existe en `memberNames`, usar el respaldo `"Otro miembro"` (nunca mostrar un UUID crudo).

### 1.4 `formAdvancedFields.ts`

```ts
export function formatMoreOptionsLabel(activeCount: number): string;
export function countActiveFields(flags: readonly boolean[]): number;
export function hasAdvancedFieldError(errorFlags: readonly boolean[]): boolean;
```

- **Ejemplos contractuales**:
  - `formatMoreOptionsLabel(0)` → `"Más opciones"`.
  - `formatMoreOptionsLabel(1)` → `"Más opciones · 1 activa"`.
  - `formatMoreOptionsLabel(2)` → `"Más opciones · 2 activas"`.
  - `hasAdvancedFieldError([false, true])` → `true` (dispara auto-despliegue de `"Más opciones"`, FR-023).

---

## 2. Primitivas compartidas (`src/components/ui/`)

### 2.1 `CollapsibleSection` (`src/components/ui/collapsible-section.tsx`)

```ts
export interface CollapsibleSectionProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'panel' | 'inline';
  testId?: string;
  children: React.ReactNode;
}
```

- Botón disparador con `min-h-11` (≥ 44 px), `aria-expanded={isOpen}`, `aria-controls={contentId}` y foco visible.
- `variant="panel"` usa el contenedor `Panel` cálido (`rounded-card bg-card shadow-card`, usado en Ajustes y Analítica).
- `variant="inline"` usa fondo suave `rounded-2xl bg-surface-2/60` (usado en `"Más opciones"` dentro de formularios).

### 2.2 `EmptyState` (`src/components/ui/empty-state.tsx`)

```ts
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testId?: string;
}
```

### 2.3 `SheetContent` (`src/components/ui/sheet.tsx`)

- Celular (`< 768px`): bottom sheet (`fixed inset-x-0 bottom-0 rounded-t-card max-h-[92dvh]`) con soporte para `pb-[env(safe-area-inset-bottom)]`.
- Tablet y escritorio (`md:` `>= 768px`): diálogo centrado (`md:top-1/2 md:left-1/2 md:max-w-lg md:rounded-card`).
- Los formularios mantienen su acción primaria de guardar en un bloque sticky inferior dentro del `Sheet` con fondo `bg-popover` y safe-area inferior para permanecer al alcance del pulgar incluso con scroll o teclado móvil.

---

## 3. Contratos de navegación, layout y copy

| Elemento | Contrato |
|----------|----------|
| Breakpoint barra inferior ↔ lateral | `< 1024px` (`max-lg`): barra inferior fija + `MobileHeader`; `>= 1024px` (`lg`): barra lateral fija + `AppTopbar`. |
| Columna principal | `mx-auto w-full max-w-[720px]` en todas las pantallas principales. |
| Etiquetas de navegación (sentence case) | `Resumen` (móvil: `Inicio`), `Finanzas`, `Control y hábitos` (móvil: `Hábitos`), `Espacio compartido`, `Mi progreso`, `Ajustes`. |
| Acción primaria de navegación | Únicamente `Nuevo registro` (píldora en barra lateral / botón circular `+` en barra inferior). |
| Ajustes — accesos fijos arriba | `Completar configuración` y `Ver tutorial` siempre visibles fuera de secciones plegadas. |
| Ajustes — 5 secciones colapsables | `Perfil`, `Cuentas e ingresos`, `Notificaciones`, `Apariencia`, `Datos y exportación` (todas plegadas por defecto, múltiples abiertas simultáneamente). |
| Guardias automáticas | `src/typographyGuard.test.ts`, `src/voseoGuard.test.ts` y `src/tokens.contrast.test.ts` en verde sin excepciones. |
