# Quickstart: 006-ajuste-de-balance-mensual

## 1. Automatizado

```bash
pnpm test
```

Debe incluir: `validateBalanceAdjustment.test.ts` (motivo obligatorio, categoría siempre vacía),
`MovementForm.test.tsx` extendido (modo ajuste oculta categoría y exige motivo),
`MovementList.test.tsx` extendido (badge "Ajuste" visible, balance/distribución sin cambios de
comportamiento para movimientos regulares).

## 2. Manual

1. Crear un ajuste positivo con un motivo. **Esperado**: el balance total sube en ese monto; el
   ajuste aparece en Movimientos con el badge "Ajuste"; el Resumen (50/30/20) no lo cuenta en
   ninguna categoría.
2. Intentar crear un ajuste sin motivo. **Esperado**: no se puede guardar.
3. Crear un ajuste negativo. **Esperado**: el balance baja en ese monto.
4. Editar o borrar un ajuste ya creado. **Esperado**: funciona igual que con cualquier movimiento
   regular.
