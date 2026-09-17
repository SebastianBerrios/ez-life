# Contratos: funciones Postgres (RPC)

Estas son las únicas dos piezas de esta feature que corren del lado del servidor (Supabase), porque
tocan una garantía de seguridad que el cliente no puede hacer cumplir por sí solo (Principio IX).
Todo lo demás de esta feature es cliente + Dexie + sync existente, igual que el resto de la app.

## `redeem_shared_invite(code: text) RETURNS membership`

**Contrato**: `SECURITY DEFINER`, ejecutable solo por un usuario autenticado (`auth.uid()` implícito).

**Precondiciones válidas para éxito**:
- Existe una fila en `shared_invites` con ese `code`.
- `now() < expires_at`.
- `redeemed_by IS NULL`.

**Efecto atómico si es válido**:
1. Marca la invitación como canjeada (`redeemed_by = auth.uid()`, `redeemed_at = now()`).
2. Crea la fila de `Membership` (`shared_space_id`, `user_id = auth.uid()`, `joined_at = now()`).
3. Devuelve la `Membership` creada.

**Falla (sin mutación) cuando**: código inexistente, vencido, o ya canjeado — mensaje de error
genérico ("invitación inválida o vencida"), sin distinguir el motivo exacto (evita filtrar si un
código existió alguna vez).

**Por qué RPC y no una política RLS de auto-inserción**: una política de auto-inserción solo puede
expresar condiciones declarativas sobre la fila que se inserta; no puede hacer las tres cosas
atómicamente (validar, marcar la invitación como usada, y crear la membresía) sin abrir una ventana
de carrera entre "validar" e "insertar". La función SECURITY DEFINER lo hace en una sola transacción.

## `leave_shared_space(space_id: uuid) RETURNS void`

**Contrato**: `SECURITY DEFINER`, ejecutable solo por un miembro activo del espacio.

**Efecto atómico**:
1. Marca `Membership.left_at = now()` para `(space_id, auth.uid())`.
2. Si no queda ningún miembro con `left_at IS NULL` en ese espacio, marca `SharedSpace.status =
   'archived'` (edge case de la spec).

No borra ningún `SharedMovement` ni `Debt` — quedan visibles como historial congelado (FR-016).
