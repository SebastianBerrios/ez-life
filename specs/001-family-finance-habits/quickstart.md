# Quickstart: validar la feature end-to-end

Guía manual para probar que la feature funciona de punta a punta. No reemplaza los tests unitarios
de cada use-case (esos van en `tasks.md`/implementación) — esto es la validación de flujo completo.

## Prerrequisitos

- `pnpm install` ya corrido.
- Dos usuarios de prueba distintos en el pool de auth compartido de `mvp-lab` (o dos sesiones del
  mismo navegador en modo incógnito / dos perfiles), para poder probar el espacio compartido.
- `pnpm dev` corriendo.

## 1. Préstamos personales (User Story 1)

1. Iniciar sesión como Usuario A.
2. Ir a la sección de préstamos → registrar un préstamo hecho a "Juan", S/100, sin fecha de
   vencimiento.
3. Registrar una devolución parcial de S/40 → verificar saldo pendiente S/60.
4. Marcar el préstamo como saldado → verificar que aparece como liquidado y que NO se creó ningún
   movimiento nuevo en la distribución personal (revisar el dashboard financiero, el total de
   ingresos no cambió).

## 2. Espacio compartido (User Stories 2 y 3)

1. Como Usuario A, crear un espacio compartido "Casa" → copiar el código de invitación generado.
2. Como Usuario B (otra sesión), canjear el código → verificar que aparece como miembro.
3. Esperar >48hs simuladas (o generar un segundo código y forzar su expiración manualmente en la
   base para la prueba) → verificar que un código vencido es rechazado con un mensaje claro.
4. Como Usuario A, registrar un gasto compartido de S/100 con split 50/50, pagado enteramente por
   A → verificar que el dashboard de deudas del espacio muestra que B le debe S/50 a A.
5. Verificar que en la distribución personal de A aparece un movimiento enlazado de S/50 (su parte),
   y en la de B otro de S/50 — ninguno editable directamente fuera del gasto compartido.
6. Con ambos usuarios con la app abierta, registrar un segundo gasto compartido desde B → verificar
   que A lo ve reflejado en menos de 10 segundos sin recargar.
7. Cerrar la app de A, registrar un tercer gasto desde B, reabrir la app de A → verificar que A
   recibe una notificación de actividad compartida.
8. Como B, intentar editar un gasto cargado por A en modo estricto (default) → verificar que se
   rechaza. Cambiar el espacio a "modo abierto" desde cualquiera de los dos → repetir y verificar
   que ahora sí se puede.
9. Como B, abandonar el espacio con saldo pendiente → verificar que la salida se permite y que la
   deuda sigue visible en el historial de ambos.

## 3. Hábitos, metas y tareas (User Stories 4 y 5)

1. Crear un hábito "Correr" en modo días fijos (Lunes/Miércoles/Viernes) → marcarlo cumplido los
   tres días de una semana y los tres de la siguiente hasta completar 7 cumplimientos consecutivos
   → verificar que se gana 1 comodín.
2. Dejar pasar un día programado sin cumplir → usar el comodín → verificar que la racha no se
   rompe.
3. Crear un segundo hábito en modo frecuencia libre (3 veces por semana) → acumular 7 cumplimientos
   individuales a lo largo de varias semanas → verificar que se gana 1 comodín, y que sirve para
   cubrir una semana donde faltó un cumplimiento sin romper la racha.
4. Crear una meta numérica ("Ahorrar para bici", objetivo 20) y una meta checklist ("Aprender
   React", 3 hitos) → avanzar ambas hasta completarlas → verificar que se marcan `completed`.
5. Crear una tarea con fecha límite mañana → marcarla hecha → verificar que se archiva y desaparece
   de "próximas a vencer".

## 4. Wizard y dashboards (User Story 7)

1. Con un usuario nuevo, completar el wizard inicial → verificar la plantilla 50/30/20 con
   categorías precargadas en los tres buckets, editar una categoría antes de continuar.
2. Entrar por primera vez a la sección de espacio compartido → verificar que pide su propia
   configuración inicial, separada del wizard.
3. Entrar al dashboard financiero → verificar distribución vs. real, ingresos/egresos y deudas
   activas (propias + de espacios compartidos).
4. Entrar al dashboard de hábitos/motivación → verificar racha, % de cumplimiento en ventana móvil
   de 30 días, progreso de metas activas y tareas próximas.

## Comandos de referencia

- `pnpm test` — corre toda la suite (los nuevos use-cases deben tener sus tests unitarios acá).
- `pnpm test -- -t "streak"` — para iterar rápido sobre el cálculo de racha/comodines mientras se
  implementa.
- `pnpm dev` — para los pasos manuales de arriba.

Ver `data-model.md` para los campos exactos de cada entidad y `contracts/` para las interfaces de
repositorio y las dos funciones RPC de seguridad.
