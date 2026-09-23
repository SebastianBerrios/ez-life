# Quickstart: 005-habitos-tareas-metas-ux

## 1. Automatizado

```bash
pnpm test
```

Debe incluir: `evaluateTaskRecurrence.test.ts` (primera generación, no duplicar, recurrencia
cancelada, edición de patrón afecta solo el futuro), `useTaskRecurrenceEvaluator.test.tsx`,
`HabitForm.test.tsx`/`TaskForm.test.tsx`/`GoalForm.test.tsx` extendidos con los campos nuevos, y
`BottomNav.test.tsx` (si existe) verificando el nuevo label.

## 2. Manual — Tareas recurrentes (US1)

1. Crear una tarea con recurrencia "días fijos: sábado" (hoy, para la prueba, usar un día
   distinto).
2. Avanzar el reloj del sistema (o esperar) hasta el próximo sábado simulado.
3. **Esperado**: aparece una nueva ocurrencia con esa fecha, sin repetir la anterior.
4. Cancelar la recurrencia. **Esperado**: no se generan más ocurrencias; las existentes quedan
   intactas.
5. Verificar que ninguna ocurrencia acumula racha ni usa tokens de protección.

## 3. Manual — Formularios más ricos (US2)

1. Crear un hábito y asignarle un ícono/emoji opcional.
2. Crear una tarea con una descripción opcional.
3. Crear una meta con una descripción opcional.

## 4. Manual — Sidebar (US3)

1. Abrir la navegación principal. **Esperado**: el ítem que lista `SavingsGoal` dice "Metas de
   Ahorro", distinto de "Metas" en Control.
