# Contrato — Copy y guardia de voseo (spec 012)

Regla de la constitución v2.1.0 (Principio VI): español latinoamericano neutro, tuteo, sin voseo.

## 1. Copy nuevo / modificado del onboarding

| Ubicación | Texto |
|-----------|-------|
| Stepper, paso 1 | `Inicio` (se muestra en mayúsculas por estilo; antes `Ingresos`) |
| Paso 1, eyebrow | `Paso 1 de 3` (sin cambio) |
| Paso 1, título | `Tu punto de partida` (antes `Paso 1: Configuración Básica`) |
| Paso 1, campo sueldo | `Sueldo o ingreso mensual` (antes `Sueldo o Ingreso Base (Mensual)`) |
| Paso 1, campo saldo | `Saldo actual (opcional)` |
| Paso 1, ayuda del saldo | `Lo que tienes hoy entre efectivo y cuentas. Puedes ajustarlo después en Ajustes → Cuentas.` |
| Paso 1, error saldo negativo | `El saldo actual no puede ser negativo.` |
| Paso 1, error genérico de guardado | `No se pudo guardar tu punto de partida.` |
| Paso 2, descripción | `Define en qué categorías quieres distribuir lo que ganas cada mes. Puedes agregar, renombrar o eliminar las que necesites.` |
| Paso 2, cierre del tutorial | `Es solo un punto de partida — agrega, renombra o elimina categorías según tu realidad. Solo asegúrate de que sumen 100%.` |
| Paso 2, etiqueta de ahorro | `Ahorro · fija` |
| Paso 2, mínimo de categorías | `Necesitas al menos una categoría de distribución.` |
| Paso 2, fallo al guardar | `No se pudo guardar la distribución. {mensaje del dominio si existe}` |
| Paso 3, descripción | `Organiza tus gastos en categorías y subcategorías, agrupadas por cada categoría de distribución.` |
| Paso 3, categoría vacía | `Agrega al menos una subcategoría.` |
| Paso 3, ayuda de "Finalizar" | `Necesitas al menos una categoría con una subcategoría para continuar.` |
| Paso 3, última subcategoría | `No se puede eliminar: la categoría necesita al menos una subcategoría.` (sin cambio de texto) |

**Persistencia de cada mensaje** (FR-020/021): los de "no se puede eliminar…" son **transitorios** (4 s);
el hint de categoría vacía, el total ≠ 100% y los errores de guardado son **persistentes**.

## 2. Tabla de equivalencias voseo → tuteo (formas halladas en `src/`)

Reemplazo **manual**; cuidar tildes y clíticos.

| Voseo | Tuteo neutro | Voseo | Tuteo neutro |
|-------|--------------|-------|--------------|
| Seleccioná | Selecciona | Registrá | Registra |
| Completá | Completa | Creá | Crea |
| Necesitás / necesitás | Necesitas / necesitas | unite | únete |
| tenés | tienes | sos | eres |
| Escribí | Escribe | Vos / vos | Tú / tú (ver nota) |
| Ingresá | Ingresa | Agregá / agregá | Agrega / agrega |
| Elegí | Elige | Agregalas | Agrégalas |
| archivala | archívala | Organizá | Organiza |
| Eliminá / eliminá | Elimina / elimina | Definí | Define |
| guardá | guarda | ganás | ganas |
| querés | quieres | Podés / podés | Puedes / puedes |
| renombrá | renombra | asegurate | asegúrate |
| Usá | Usa | debés / Debés | debes / Debes |
| Descargá | Descarga | Intentá | Intenta |
| aceptás | aceptas | | |

**Nota "vos"**: sujeto → "tú"; tras preposición → "ti" (`a vos` → `a ti`), y `con vos` → `contigo`.
Revisar el contexto en `SharedSpaceBalances`, `SharedSpaceScreen` y `SharedMovementForm`.

**No son voseo** (no tocar): `más`, `Más`, `inglés`, `interés`, `Interés`, y pretéritos como
`Superaste` (válidos en tuteo).

**Jerga a evitar en mensajes visibles**: «bucket». Usar «categoría de distribución» (p. ej.
"No se puede desmarcar la única categoría de ahorro.", "No se puede eliminar la categoría de ahorro ni la
única categoría de distribución.", "La categoría requiere nombre y una categoría de distribución propia.").

Antes de dar por cerrado el reemplazo, ejecutar una vez una búsqueda heurística amplia de palabras que
terminan en `á`, `é`, `í`, `ás`, `és`, `ís` y revisar manualmente las no listadas, para ampliar la
guardia con formas que esta tabla no haya visto (p. ej. `Tocá`, `Pulsá`, `Confirmá`, `Cerrá`, `Abrí`).

## 3. Guardia automática — `src/voseoGuard.test.ts`

Prueba Vitest que:
1. Lee todos los `*.ts` / `*.tsx` bajo `src/` (incluye tests; **excluye este mismo archivo**).
2. Busca, con límites de palabra y sin distinguir mayúsculas, las formas de voseo de una lista explícita
   (la tabla de arriba más las que aparezcan en el barrido heurístico).
3. Falla con la lista `archivo:línea → forma` si hay coincidencias.

Cumple FR-009 / SC-003 y evita regresiones. Se activa al **final** del reemplazo masivo.
