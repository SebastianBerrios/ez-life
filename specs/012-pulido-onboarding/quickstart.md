# Quickstart — Validación de la spec 012

Guía para comprobar que la feature funciona de punta a punta. No contiene código de implementación.

## Prerrequisitos

- Node + pnpm instalados; dependencias con `pnpm install`.
- Sin variables ni migraciones nuevas. Para el recorrido manual, las de `.env.local` habituales
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- Cambios de esquema: **ninguno** → no ejecutar `supabase db push`.

## 1. Verificación automática

```bash
pnpm test        # suite completa (incluye src/voseoGuard.test.ts)
pnpm lint
pnpm build
```

Resultado esperado: todo en verde y `voseoGuard` sin coincidencias.

### Cobertura mínima esperada (por historia)

| Historia | Pruebas |
|----------|---------|
| US1 saldo | `parseCurrentBalance` (vacío, decimales, coma, negativo, enorme); `saveStartingPoint` (crea cuenta con saldo, idempotente, no pisa cuenta existente, rollback si falla); `OnboardingStep1` (2 campos, copy, negativo bloquea, vacío continúa); flujo wizard → "Capital disponible" = saldo y presupuesto = sueldo × % |
| US2 idioma | `voseoGuard.test.ts`; tests existentes con textos actualizados |
| US3 ahorro | `validateDistribution` (0% solo ahorro; 0% en no-ahorro rechazado); `OnboardingStep2` (sin radio, etiqueta "Ahorro · fija", sin botón eliminar en ahorro, categoría nueva no es ahorro, error visible al fallar el guardado) |
| US4 orden | `sortByCreation`; `creationClock`; `LocalCategoryRepository` (orden por creación, semillas conservan orden, crear categoría sin subcategorías, última subcategoría protegida); `OnboardingStep3` (nueva al final, sin "General", hint, "Finalizar" bloqueado); `MovementForm` (excluye categorías vacías) |
| US5 avisos | `useTransientMessages` con temporizadores falsos (4 s, reinicio por clave, `clearAll`, desmontaje); Steps 2/3 (el aviso desaparece, el total ≠ 100% no) |

## 2. Recorrido manual (`pnpm dev`)

Usar un usuario nuevo (o borrar IndexedDB `EzLifeDB` desde DevTools → Application).

1. **Paso 1**: se ve "Tu punto de partida", el indicador dice **INICIO**, hay dos campos y la ayuda del
   saldo. Probar: saldo vacío → continúa; `-5` → mensaje "El saldo actual no puede ser negativo."
   Ingresar sueldo `3000` y saldo `800` → continúa.
2. **Paso 2**: no hay radios "AHORRO"; "Ahorro e Inversión" muestra "Ahorro · fija" y no tiene papelera.
   Textos en tuteo. Agregar una categoría nueva → no es de ahorro. Poner ahorro en 0% y ajustar el resto
   a 100% → se guarda. Forzar un total ≠ 100% → el aviso de total **no** desaparece.
3. **Paso 3**: crear 3 categorías seguidas → aparecen al final, en orden, **vacías**, con
   "Agrega al menos una subcategoría" y "Finalizar" deshabilitado. Agregar una subcategoría a cada una →
   aparecen al final y "Finalizar" se habilita. Intentar eliminar la última subcategoría de una categoría →
   aviso que **desaparece a los 4 s** (o antes si haces otra acción).
4. **Resultado**: en Inicio, "Capital disponible" = **S/ 800.00**; el presupuesto de la categoría al 50% =
   **S/ 1,500.00**. En Ajustes → Cuentas, "Efectivo" tiene saldo inicial S/ 800.00 y no hay duplicados.
5. **Movimientos**: abrir "Nuevo gasto" → solo aparecen categorías con subcategorías.
6. **Offline**: repetir el recorrido con la red desactivada; debe funcionar igual y sincronizar al volver.
7. **Usuario existente**: iniciar sesión con una cuenta previa → categorías (incluida "General") y
   categoría de ahorro intactas; ahorro marcado "Ahorro · fija".

## 3. Búsqueda de control de voseo (manual, complementa la prueba)

```bash
# Debe devolver 0 coincidencias (lista completa en contracts/ui-copy.md)
rg -n -i -w "(querés|podés|tenés|sos|vos|debés|necesitás|ganás|aceptás|elegí|seleccioná|ingresá|completá|escribí|definí|agregá|agregalas|eliminá|renombrá|guardá|registrá|creá|organizá|usá|descargá|intentá|unite|asegurate|archivala)" src
```
