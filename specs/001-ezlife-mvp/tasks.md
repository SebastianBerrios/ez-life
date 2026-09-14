# Tareas de Implementación — MVP ez-life (001-ezlife-mvp)

Lista de tareas granulares (20-30 min) ordenadas estrictamente por dependencias. 

---

## Fase 1: Infraestructura Base
- [x] **1.1. Scaffolding del proyecto Next.js** (RNF-02)
  - Configurar Next.js App Router con TypeScript, Tailwind y ESLint/Prettier.
  - *Hecho cuando:* `pnpm dev` levanta un "Hola Mundo" sin errores de consola.
- [x] **1.2. Configuración de Base de Datos Local (Dexie.js)** (RF-18, RNF-01)
  - Instalar `dexie` y definir el esquema inicial en `src/infrastructure/db/db.ts` (perfiles, categorías, movimientos, metas, sync_queue).
  - *Hecho cuando:* Al abrir la consola del navegador, se ven las tablas creadas en IndexedDB bajo la base `ezlife-db`.
- [x] **1.3. Configuración de cliente Supabase y Tipos** (RF-01, RF-18)
  - Inicializar cliente de Supabase (browser/server). No implementar Auth todavía.
  - *Hecho cuando:* El cliente de Supabase compila correctamente y está disponible para inyección de dependencias.

## Fase 2: Core Domain (Lógica Pura y Tests)
*(Requisito: Constitución #3 y #4)*
- [x] **2.1. Definición de tipos de Dominio (Models)** (RNF-04)
  - Crear interfaces TypeScript estables en `src/core/domain/models/` para todas las entidades usando `UUID`.
  - *Hecho cuando:* Los tipos compilan y usan `number` explícitamente para montos (céntimos).
- [x] **2.2. Use Case: Redondeo de Presupuestos (TDD)** (RF-06, RF-07)
  - Escribir test en Vitest para la lógica que distribuye porcentajes y suma el sobrante de céntimos al mayor porcentaje. Implementar la función pura.
  - *Hecho cuando:* `pnpm test` aprueba el cálculo exacto de céntimos para 50/30/20 sobre montos que generan decimales.
- [x] **2.3. Use Case: Filtro por Ciclo Mensual (TDD)** (RF-03, RF-15)
  - Función que, dado un día de inicio (ej. 15) y una fecha actual, devuelve el rango `[fecha_inicio, fecha_fin]` del ciclo.
  - *Hecho cuando:* Los tests prueban meses de 31, 30 y 28 días con días de inicio dispares.
- [x] **2.4. Use Case: Validaciones de Eliminación** (RF-08, RF-14)
  - Lógica que arroja error si intentas borrar una categoría/meta que tiene `$count > 0` movimientos.
  - *Hecho cuando:* El unit test valida que arroje `DomainError` correctamente.

## Fase 3: Capa de Datos Local (Repositorios)
- [x] **3.1. Repositorio Local: Perfil e Ingresos** (RF-03, RF-04)
  - Implementar CRUD en IndexedDB usando Dexie para `profiles` y `income_sources`. Asegurar que se asigne `updated_at` y se use UUIDv7.
  - *Hecho cuando:* Se pueden leer y escribir perfiles e ingresos simulados en la DB local de forma exitosa.
- [x] **3.2. Repositorio Local: Categorías** (RF-08)
  - Implementar CRUD para `distribution_categories`, `expense_categories` y `subcategories`.
  - *Hecho cuando:* Funciones de lectura y escritura creadas y sin errores de tipado con los modelos de dominio.
- [x] **3.3. Repositorio Local: Movimientos y Metas** (RF-09, RF-13)
  - Implementar CRUD para `movements` y `savings_goals`.
  - *Hecho cuando:* Funciones de creación de movimientos soportan inserciones simuladas en céntimos sin errores.

## Fase 4: Auth y Onboarding (Capa UI)
- [x] **4.1. UI: Login Screen (OAuth)** (RF-01)
  - Componente de login invocando `supabase.auth.signInWithOAuth`.
  - *Hecho cuando:* Un clic redirige a Google/GitHub (excepción offline cumplida).
- [x] **4.2. UI: Tutorial - Paso 1 (Ingresos y Ciclo)** (RF-02, RF-03)
  - Pantalla para definir sueldo base y el día de inicio de mes. Guardar en Dexie local.
  - *Hecho cuando:* Los datos se guardan en IndexedDB y permite avanzar al paso 2.
- [x] **4.3. UI: Tutorial - Paso 2 (Distribución y Categorías)** (RF-02, RF-06)
  - UI interactiva para ajustar porcentajes (50/30/20) forzando validación a 100%. Permite crear primera categoría.
  - *Hecho cuando:* El usuario termina el tutorial y la app lo redirige al Dashboard (desbloqueando la navegación).

## Fase 5: Dashboard y Movimientos (Capa UI)
- [x] **5.1. UI: Layout Base y Navegación** (RNF-02)
  - Navbar inferior (mobile-first) con links a Dashboard, Movimientos, Metas, y Ajustes.
  - *Hecho cuando:* Renderiza correctamente en viewport de iPhone.
- [x] **5.2. UI: Formulario de Registro de Movimiento** (RF-05, RF-09)
  - Pantalla/Modal de agregar ingreso/egreso. Selectores encadenados (Categoría Distribución -> Gasto -> Subcategoría). Transforma `input(decimal)` a céntimos enteros.
  - *Hecho cuando:* Guardar crea una fila en Dexie con el valor real * 100 (céntimos).
- [x] **5.3. UI: Lista de Movimientos** (RF-10, RF-11)
  - Renderizado del historial filtrado por el ciclo actual. Incluye botones de editar/borrar (con modal de confirmación).
  - *Hecho cuando:* Editar actualiza el registro local y borrar lo oculta/hace soft-delete. Sin alertas de presupuesto aquí.
- [x] **5.4. UI: Dashboard (Resumen y Presupuesto)** (RF-11, RF-15)
  - Muestra Total Ingreso, Total Egreso, Balance. Lista de categorías de distribución con barras de progreso.
  - *Hecho cuando:* Si una barra pasa del 100%, se pinta de rojo brillante. Usa el UseCase de `Filtro por Ciclo Mensual`.

## Fase 6: Metas de Ahorro y Configuración (Capa UI)
- [x] **6.1. UI: Lista y Creación de Metas** (RF-13)
  - Pantalla para crear metas (nombre, monto, fecha opcional) y barra de progreso general de c/u.
  - *Hecho cuando:* Permite crear meta y muestra "Vencida" si la fecha ya pasó y `<100%`.
- [x] **6.2. UI: Asignación a Metas (RF-14)**
  - Modificar el form de Movimientos (5.2) para que, si el ingreso es a "Ahorros", muestre un select opcional de Metas.
  - *Hecho cuando:* El movimiento se enlaza por FK a la meta y el acumulado sube. Reasignación requerida para borrar funciona.

## Fase 7: Recurrencia, Exportación y Notificaciones
- [x] **7.1. Lógica Frontend: Evaluación de Recurrencia** (RF-12)
  - Efecto global (App/Layout) que verifica `last_recurrence_eval_date`. Genera movimientos copiando los recurrentes activos al ciclo nuevo.
  - *Hecho cuando:* Al cambiar de mes (simulado), los gastos base aparecen clonados.
- [x] **7.2. Exportación CSV y PDF** (RF-17)
  - Botón en Ajustes que compila la data de Dexie, la formatea a soles decimales con `,` y columnas con `;`.
  - *Hecho cuando:* Se descarga un archivo `.csv` válido abrible en Excel sin romper columnas.
- [x] **7.3. Configuración y Disparo de Notificaciones** (RF-16)
  - Integración de API Nativa de Notificaciones del navegador y alertas in-app simples.
  - *Hecho cuando:* El navegador pide permisos y lanza un pop-up de prueba.

## Fase 8: Sincronización (Motor Local/Remoto)
- [x] **8.1. Motor de Sincronización en Background** (RF-18)
  - Implementar `CustomSyncLayer`. Detectar `window.onOnline`. Hacer Pull de Supabase (`> updated_at`), resolver Last-Write-Wins, y hacer Push de la `sync_queue` de Dexie.
  - *Hecho cuando:* Crear un movimiento offline, encender la red, y ver que aparece reflejado en la tabla `movements` real en el proyecto compartido Supabase.
