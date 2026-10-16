# 008 — Auditoría y remediación secuencial

Estado: aprobada por la instrucción de implementación del usuario (2026-10-08).
Esta spec complementa las siete specs históricas y siete vigentes. La constitución
2.0.0 prevalece ante contradicciones. No autoriza despliegues remotos.

## Decisiones confirmadas

- Presupuestos calculados sobre ingresos mensuales esperados.
- Aportes de ahorro: egresos del bucket de ahorro.
- Abonos reducen plazo únicamente con elección y valor explícitos del usuario.
- Cada miembro configura una preferencia privada de bucket por espacio.
- Offline incluye recarga y reapertura después del primer uso online; logout
  borra la selección activa y ninguna sesión local concede permisos remotos.
- Conservar historial; no generar pagos históricos ni reasignar propietarios
  o fusionar categorías mediante heurísticas.
- Entidades de dominio separadas y único pipeline de notificaciones.
- Sin nuevas dependencias runtime. Service worker nativo y recursos propios.
- Migraciones aditivas y pruebas exclusivamente en ez_life, preparadas localmente.

## Requisitos transversales

1. Validación de céntimos enteros seguros, fechas calendario locales, referencias
   y propiedad desde negocio/repositorios; formularios renderizan y delegan.
2. Sync: adaptador tipado para fechas y opcionales; enviar null al borrar campos;
   aplicar pulls sin encolar; lecturas completas paginadas por ID, sin cursor
   global de reloj local; coordinador por sesión; cola filtrada por propietario
   y dependencias; confirmar únicamente snapshots enviados. LWW condicionado
   en servidor con prioridad de tombstones y RPC financieras transaccionales
   e idempotentes. Campos locales ausentes se agregan mediante migraciones.
3. Fechas de input conservan su día; hoy y semanas lunes-domingo son locales.
   Reglas recurrentes con identidad estable y ocurrencias independientes.
   Movimientos mensuales respetan último día, reactivación e idempotencia.
   Tareas generan fechas vencidas únicas, N entre 1 y 7, offsets floor(k*7/N).
4. Cambios confirmados en IndexedDB actualizan vistas/evaluadores por tabla y
   usuario; cancelar lecturas obsoletas al cambiar cuenta o período.
5. Cache versionada del shell y recursos de todas las secciones, excluyendo
   OAuth y Supabase privado. Gráficos/PDF bajo demanda y disponibles offline.
   Agregaciones con mapas/recorridos únicos, marca vectorial reutilizable.

## Orden y aceptación por spec

Cada fila se cierra con requisitos, implementación, regresiones, pnpm test,
pnpm lint y evidencia offline antes de avanzar. Los arreglos compartidos se
implementan una vez y se referencian en las filas afectadas.

| Orden | Spec | Aceptación |
|---|---|---|
| 1 | Histórica 001 MVP | Edición/fecha/fuente de movimientos; CRUD de fuentes; sync seguro; recurrencias mensuales; presupuesto esperado. |
| 2 | Histórica 002 UI | Navegación, tema, avatar, logout y formularios responsive; limpieza de auth y estados login/onboarding. |
| 3 | Histórica 003 Wizard | Paso explícito persistido; reanudación sin ingresos duplicados ni distribución omitida; separar Ajustes. |
| 4 | Histórica 004 Jerarquía | Relaciones validadas; categorías completas; borrados válidos; Análisis actualizado tras local/sync. |
| 5 | Histórica 005 Selects | Mantener wrapper de labels; verificar ahorro, selectores, tamaños táctiles/tokens/contraste; corregir fallos reproducibles. |
| 6 | Histórica 006 QA | Validación en repositorios, distribución atómica, único ahorro protegido, totales PDF y URLs liberadas. |
| 7 | Histórica 007 Red | Configuración offline, preferencias independientes, dedupe, >80% estricto, calendario local. |
| 8 | Vigente 001 Familia | Aislamiento, splits/permisos/edición compartida, liquidaciones fechadas, saldos congelados, preferencias por miembro, rachas semanales/comodines. |
| 9 | Vigente 002 Cuotas | Mantener Crear/Control; editar condiciones, validar abonos, concurrencia y hoy local. |
| 10 | Vigente 003 Críticos | Actualización local universal; pagos atómicos/idempotentes; corregir documentación sobre plazo explícito. |
| 11 | Vigente 004 Dashboards | Agregaciones fuera de render; evolución real de racha, vencimiento correcto y vistas actualizadas. |
| 12 | Vigente 005 Recurrencia | N ocurrencias/semana sin día repetido; reglas separadas; editar/cancelar, recuperar atrasadas, borrar futuras pendientes, idempotencia. |
| 13 | Vigente 006 Ajustes | Fecha/edición/motivo obligatorio en repositorio; excluir de presupuesto/categorías/ahorro, incluir en balance/comparación. |
| 14 | Vigente 007 SEO | Apple icon, descripciones y títulos login/onboarding, marca/OG coherentes, URLs e imágenes válidas. |

## Casos de verificación global

- Cuenta A→B→A, fechas remotas, >1000 filas, errores parciales, conflictos,
  tombstones y escritura durante envío; nunca modificar datos ajenos.
- Atomicidad/idempotencia de cuotas, abonos, liquidaciones, series y alertas.
- America/Lima: medianoche, domingo/lunes, meses cortos, fin del día y semanas
  ausentes; Sin asignar nunca persiste identificador ficticio.
- SQL aislado RLS/RPC: dos miembros, intruso, antiguo miembro, invitaciones
  concurrentes y actividad posterior a salida; helpers privilegiados privados.
- Testing Library: edición/wizard/preferencias/Resumen/dashboards, errores,
  doble envío; navegador online→offline→escritura→recarga→reapertura→todas las
  secciones→reconexión sin duplicados; actualización de cache entre builds.
- Cierre: tests, lint, TypeScript, build, offline y comparación del bundle
  inicial con línea base reportada de 583 kB. La línea base de 376 tests y
  resultados del agente anterior deben comprobarse de nuevo.

## Evidencia y seguimiento

El avance y límites observados se registran en progress.md. Una fila pendiente
no se declara terminada por pasar tests existentes. Cada unidad documenta
regresión, frontera de rollback y verificación runtime (o N/A justificado).
