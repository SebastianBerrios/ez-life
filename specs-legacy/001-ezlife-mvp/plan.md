# Plan Técnico — MVP ez-life (001-ezlife-mvp)

Este documento detalla el diseño técnico para implementar el MVP de ez-life, respetando rigurosamente los 8 principios de `docs/constitution.md` y cubriendo todos los Requisitos Funcionales (RF) de la especificación `spec.md`.

---

## 1. Estructura de módulos y carpetas
Para respetar la regla de **Logic ≠ UI** (Constitución #3) y facilitar los tests de lógica pura, usaremos una Arquitectura Hexagonal adaptada a Next.js (App Router).

```text
src/
├── core/                        # Lógica de negocio pura (independiente de React)
│   ├── domain/                  # Entidades e interfaces
│   │   ├── models/              # Tipos base (Movement, Category, Goal)
│   │   └── repositories/        # Interfaces (ILocalRepository, ISyncRepository)
│   └── use-cases/               # Reglas de negocio (ej. calculateBudget)
├── infrastructure/              # Implementaciones concretas (Constitución #5)
│   ├── db/                      # IndexedDB local (Dexie.js)
│   ├── sync/                    # Capa de sincronización custom
│   └── supabase/                # Cliente Supabase
├── presentation/                # Capa UI (React)
│   ├── components/              # Componentes de interfaz (Dumb/Smart)
│   ├── hooks/                   # Binding entre Core y UI (ej. useMovements)
│   └── i18n/                    # Textos en español (Constitución #6)
└── app/                         # Next.js App Router (Páginas y ruteo)
```
*(Cubre RNF-02 Mobile-first, Constitución #3)*

---

## 2. Modelo de datos relacional para Supabase (y Local)
Se basa en UUIDs (preferiblemente UUIDv7 para ordenamiento natural) para permitir creación offline sin colisiones. Todas las tablas incluyen `updated_at` (para resolver conflictos) y `deleted_at` (soft deletes obligatorios para sincronización).

**Tablas Principales:**

* **`profiles`**
  * `id` (UUID, FK auth.users)
  * `monthly_cycle_start_day` (Int, 1-28)
  * `created_at`, `updated_at`

* **`distribution_categories`**
  * `id` (UUID), `user_id` (UUID)
  * `name` (String)
  * `percentage` (Int, 1-100)
  * `is_default` (Boolean)
  * `created_at`, `updated_at`, `deleted_at`

* **`expense_categories`** / **`expense_subcategories`**
  * `id`, `user_id`, `name`
  * Relaciones jerárquicas correspondientes.
  * `created_at`, `updated_at`, `deleted_at`

* **`savings_goals`**
  * `id`, `user_id`, `name`
  * `target_amount` (Int, céntimos)
  * `deadline` (Date, Nullable)
  * `created_at`, `updated_at`, `deleted_at`

* **`movements`**
  * `id`, `user_id`
  * `type` (Enum: INCOME, EXPENSE)
  * `amount` (Int, céntimos) *(Constitución #8)*
  * `date` (Date)
  * `description` (String, Nullable)
  * `distribution_category_id` (UUID, Nullable)
  * `expense_category_id` (UUID, Nullable)
  * `expense_subcategory_id` (UUID, Nullable)
  * `income_source_id` (UUID, Nullable)
  * `savings_goal_id` (UUID, Nullable)
  * `is_recurring` (Boolean)
  * `created_at`, `updated_at`, `deleted_at`

*(Cubre RF-03 a RF-14, RNF-04 Moneda y Constitución #8)*

---

## 3. Arquitectura de la Capa Sync y Algoritmos
*(Cubre RF-18 Offline-first, RNF-01, RF-07)*

La fuente de verdad para la UI es **siempre** la base de datos local (IndexedDB). Supabase actúa como un respaldo remoto.

**Diseño de Sync (Custom Sync Layer):**
1. **Mutaciones:** Cuando el usuario crea un gasto (offline u online), se guarda en IndexedDB con `updated_at = Date.now()` y se añade a una tabla local de `sync_queue`.
2. **Push:** Un Web Worker o Hook global revisa el `sync_queue`. Si hay conexión, hace un `upsert` a Supabase.
3. **Pull:** Periódicamente o al recuperar conexión, el cliente pide a Supabase: `SELECT * FROM table WHERE updated_at > last_sync_timestamp`.

### Algoritmo de Sync (Pseudocódigo):
```typescript
async function syncWithCloud() {
  const lastSync = localStorage.getItem('last_sync');
  
  // 1. Pull changes from server
  const remoteChanges = await supabase
    .from('movements')
    .select('*')
    .gt('updated_at', lastSync);
    
  // 2. Resolve conflicts locally (Last-Write-Wins)
  for (const remoteRecord of remoteChanges) {
    const localRecord = await localDB.movements.get(remoteRecord.id);
    if (!localRecord || remoteRecord.updated_at > localRecord.updated_at) {
      await localDB.movements.put(remoteRecord); // Gana el servidor
    }
  }

  // 3. Push local pending changes
  const pendingQueue = await localDB.sync_queue.toArray();
  for (const item of pendingQueue) {
    const { error } = await supabase.from(item.table).upsert(item.data);
    if (!error) await localDB.sync_queue.delete(item.id);
  }

  localStorage.setItem('last_sync', Date.now());
}
```

### Algoritmo de Redondeo de Presupuesto (RF-07):
```typescript
function calculateBudgets(totalIncomeCents: number, categories: Category[]) {
  let remainingCents = 0;
  const budgets = categories.map(cat => {
    const exactAmount = (totalIncomeCents * cat.percentage) / 100;
    const intAmount = Math.floor(exactAmount); // Truncamos a entero
    remainingCents += (exactAmount - intAmount);
    return { ...cat, budget: intAmount };
  });

  if (remainingCents > 0) {
    // Buscar la categoría con el porcentaje más alto
    const highestCat = budgets.reduce((prev, curr) => 
      (prev.percentage > curr.percentage) ? prev : curr
    );
    highestCat.budget += Math.round(remainingCents); // Sumar los céntimos perdidos
  }
  
  return budgets;
}
```

---

## 4. Resolución técnica de casos límite

* **Ajuste de porcentaje retroactivo (RF-06):** El monto disponible por categoría no se guarda en la base de datos de forma estática. Es un **estado derivado** que se calcula al vuelo (`totalIngresosMes * porcentaje`). Así, si el porcentaje cambia, el recálculo aplica instantáneamente al mes en curso.
* **Sincronización de un mismo gasto en dos dispositivos:** Se maneja automáticamente mediante la estrategia `Last-Write-Wins` descrita en el algoritmo de sync, confiando en el timestamp `updated_at` generado por el dispositivo al momento del guardado.
* **Eliminar meta con aportes (RF-14):** Se implementa a nivel del dominio. `DeleteGoalUseCase` valida `countMovements(goalId)`. Si es `> 0`, el Use Case arroja un error `RequiresReassignmentError`. La capa de presentación atrapa este error y renderiza un modal para reasignar los aportes a `Ahorro general` o a otra meta, invocando luego `ReassignAndDeleteGoalUseCase`.
* **Desactivar recurrencia (RF-12):** La recurrencia se maneja en un job de frontend (evaluado al abrir la app). Guarda en `profiles` un campo `last_recurrence_eval_date`. Si un egreso recurrente es desactivado (`is_recurring = false`), el job lo ignora, evitando pagos fantasma.

---

## 5. Decisiones técnicas justificadas

| Decisión | Justificación (Pro Constitución) | Alternativa descartada |
|---|---|---|
| **IndexedDB (Dexie.js)** | Almacenamiento local asíncrono, robusto y con soporte para índices. Cumple el RF-18 offline-first. | *LocalStorage* (Síncrono, bloquea UI, límite 5MB). |
| **Custom Sync Layer** | Código propio ligero usando timestamps. Cumple regla #7 (simplicidad, cero dependencias pesadas). | *PowerSync / WatermelonDB* (Librerías enormes y complejas que violan la regla #7). |
| **UUIDv7 en cliente** | Permite crear registros offline garantizando unicidad y orden temporal al sincronizar. | *IDs auto-incrementales (Serial)* (Imposible generar IDs seguros offline sin colisionar). |
| **Estado Derivado en UI** | Cálculos de presupuesto hechos en UseCases locales al vuelo, sin mutar DB. | *Guardar totales cacheados en DB* (Rompe consistencia offline y complica retroactividad). |

---

## 6. Estrategia de tests
*(Cubre Constitución #4)*

1. **Pruebas Unitarias de Core (Vitest):**
   - Cobertura 100% para algoritmos de cálculo: `calculateBudgets` (verificar que no haya pérdida de céntimos) y `calculateMonthlyCycle` (fechas personalizadas del 15 al 14).
2. **Pruebas Unitarias de Use Cases (Vitest):**
   - `DeleteGoalUseCase` (arroja error si hay dependencias).
   - `SyncLayer` (simulando respuestas de Supabase para validar LWW).
3. **Pruebas de Componentes UI (React Testing Library):**
   - Flujo de creación de movimientos.
   - Mostrar advertencia roja cuando el estado derivado detecta `gastado > presupuesto`.
4. **Pruebas E2E:** 
   - Estrictamente excluidas en esta etapa por Constitución #4, salvo que la especificación exija explícitamente un flujo end-to-end automatizado.
