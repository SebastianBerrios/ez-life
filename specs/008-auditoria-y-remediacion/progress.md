# Avance de remediación

## Histórica 001 — MVP

Implementado: formulario de creación/edición con fecha/fuente, fuentes editables
en Ajustes, conversión decimal exacta, validación de montos/referencias/propiedad
y protección de movimientos derivados. Dashboard y alertas presupuestarias usan
fuentes esperadas; Dashboard e Historial reaccionan a commits locales.

Sync compartido: sin reparación de propietarios/fusión heurística en login;
adaptación de fechas y nulls; pull paginado por ID sin cursor, sin reencolado;
coordinador de sesión, cola por propietario/dependencias y confirmación de los
snapshots capturados. RPC LWW invoker con RLS y prioridad de tombstones.

Recurrencias mensuales: reglas separadas, fechas programadas/meses cortos,
reactivación desde mes actual, IDs deterministas y receipts de ocurrencias
borradas. La migración preserva fuentes antiguas por ID, sin agrupar por nombre.

Prerequisito offline compartido: service worker generado por build, caché solo
de shell/recursos propios y selección de cuenta local que logout elimina.

Evidencia obtenida: 384 tests pasan, lint limpio, TypeScript sin incremental
limpio y build correcto (586 kB inicial; optimización aún pendiente). SQL en
contenedor temporal PostgreSQL: LWW, nulls, tombstones y aislamiento de cuentas.
Navegador producción localhost: 35 recursos cacheados, escritura offline,
recarga y reapertura en otra pestaña conservan balance. Fixtures sintéticos,
sin OAuth ni escrituras remotas. Regresiones añadidas posteriormente requieren
la siguiente ejecución completa antes de declarar cerrado el bloque.

Rollback: retirar las unidades de sync, finanzas/formularios, recurrencia y
cache por separado; la migración es aditiva y no borra datos. No revertir
IndexedDB a una versión menor ni eliminar historial de ocurrencias.

## Histórica 002 — UI

Listener de auth extraído con cleanup inmediato, callbacks fuera del lock de
auth y descarte de sesiones iniciales obsoletas. Selección local borrada en
logout. Regresiones: unsubscribe, respuesta A tardía después de B y selección
offline. Navegador: navegación/edición sin overflow a 390, 820 y 1440 px.
La revisión de tema/avatar/logout completo sigue pendiente de evidencia.

## Pendiente

- Cierre definitivo de Histórica 001 con las últimas regresiones.
- Históricas 002–007 y vigentes 001–007: pendientes de implementación y cierre
  secuencial. La selección local y limpieza de auth son prerequisitos comunes;
  aún faltan sus pruebas específicas y revisión responsive.
- Pruebas SQL de espacios/invitaciones/antiguos miembros, transacciones
  financieras compuestas, navegación offline completa, actualización entre
  builds y reducción del bundle: pendientes. No hay despliegue remoto.
