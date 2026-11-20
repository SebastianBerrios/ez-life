# Contrato: migración Supabase (esquema `ez_life`)

Archivo a crear: `supabase/migrations/20261110120000_balance_onboarding_reminders.sql`.

> **Regla de la flota — no se aplica en esta feature sin confirmación.** Se escribe en el repo y se aplica
> solo con `supabase db push`, después de `mvp-lab-infra/audit/fleet-auth-audit.sql` y con confirmación
> explícita del dueño del proyecto (FR-047, CLAUDE.md de la flota reglas 2–4). Nunca por MCP
> (`apply_migration`/`execute_sql`) ni con `supabase db pull`. Debe estar viva **antes** de publicar el
> cliente: `sync_record` rechaza campos desconocidos.

Migración **aditiva e idempotente** (`if not exists`, `drop constraint if exists`), con el mismo estilo
de cabecera que `20261016120000_payment_accounts_time_priority.sql`.

## 1. Columnas nuevas (todas nullables; los clientes mandan `null` cuando no hay valor)

```sql
alter table ez_life.payment_accounts add column if not exists credit_limit  bigint   check (credit_limit is null or credit_limit > 0);
alter table ez_life.payment_accounts add column if not exists closing_day   smallint check (closing_day  is null or closing_day  between 1 and 31);
alter table ez_life.payment_accounts add column if not exists payment_day   smallint check (payment_day  is null or payment_day  between 1 and 31);
alter table ez_life.payment_accounts add column if not exists opening_date  timestamptz;

alter table ez_life.income_sources   add column if not exists pay_day        smallint check (pay_day is null or pay_day between 1 and 31);
alter table ez_life.income_sources   add column if not exists received_month text     check (received_month is null or received_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table ez_life.installment_loans add column if not exists payment_day smallint check (payment_day is null or payment_day between 1 and 31);

alter table ez_life.profiles add column if not exists onboarding_version        smallint;
alter table ez_life.profiles add column if not exists balance_since             text check (balance_since is null or balance_since ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table ez_life.profiles add column if not exists checklist_dismissed       boolean;
alter table ez_life.profiles add column if not exists checklist_not_applicable  jsonb;
alter table ez_life.profiles add column if not exists tour_seen                 boolean;
```

Notas:
- **`profiles.onboarding_step` tiene hoy `CHECK (onboarding_step between 0 and 3)`** (columna creada en
  `20261009014333_audit_sync_safety.sql`, constraint inline → nombre por defecto
  `profiles_onboarding_step_check`). La migración DEBE reemplazarlo por `between 0 and 6`
  (`alter table ez_life.profiles drop constraint if exists profiles_onboarding_step_check;` +
  `add constraint profiles_onboarding_step_check check (onboarding_step between 0 and 6)`); confirmar el
  nombre real con `\d ez_life.profiles` antes de aplicar. Sin esto, los pasos 4–6 fallarían en silencio al
  sincronizar (el push se reintenta y nunca confirma).
- `checklist_not_applicable` es `jsonb` (lista de claves) para no depender de la conversión de arreglos de
  `jsonb_populate_record`.
- `profiles` se actualiza por `sync_record` (rama `update`), nunca se inserta desde sync.

## 2. Tabla nueva `ez_life.reminder_skips`

```sql
create table if not exists ez_life.reminder_skips (
  id         uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_key   text not null check (char_length(btrim(item_key)) > 0),
  month      text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists reminder_skips_user_month_idx on ez_life.reminder_skips (user_id, month);

alter table ez_life.reminder_skips enable row level security;
drop policy if exists "own rows only" on ez_life.reminder_skips;
create policy "own rows only" on ez_life.reminder_skips
  for all to authenticated
  using      ((select auth.uid()) = user_id and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid())))
  with check ((select auth.uid()) = user_id and exists (select 1 from ez_life.profiles p where p.id = (select auth.uid())));

-- Default privileges of ez_life grant ALL to anon/authenticated (see 20261017120000): revoke first.
revoke all on ez_life.reminder_skips from public, anon, authenticated;
grant select, insert, update on ez_life.reminder_skips to authenticated;
```

Seguridad (Principio IX / regla 5 de la flota): la política es por **propietario** y exige un perfil propio
existente; no hay auto-inserción de membresía ni trigger sobre `auth.users`; el borrado es lógico
(`deleted_at`), sin `delete`/`truncate` para `authenticated`.

## 3. `notifications.type`

Reemplazar el `CHECK` vigente (el de `20261009195513_personal_achievements.sql`) con todos los tipos actuales
**más** `'register_due'`. Copiar la lista completa de esa migración, no reescribirla de memoria.

## 4. `sync_record`

`create or replace function ez_life.sync_record(...)` con el cuerpo **literal** de la última definición
(`20261016120000_payment_accounts_time_priority.sql`) y como **única** diferencia `'reminder_skips'` añadido a
la lista blanca. Las columnas nuevas de las secciones 1–2 no requieren más cambios: la función las valida
contra `information_schema.columns`.

## 5. Verificación previa a pedir confirmación

1. `mvp-lab-infra/audit/fleet-auth-audit.sql` sin hallazgos nuevos.
2. `supabase db push --dry-run` (si la CLI lo soporta) lista solo esta migración; si reporta versiones ajenas,
   añadir stubs de línea base según `OPERATIONS.md` §4 (nunca `migration repair --reverted`).
3. Tras aplicar: confirmar grants de `reminder_skips` (`select, insert, update` y nada más para
   `authenticated`) y que un `sync_record` de prueba con cada campo nuevo no falla.
