# 009 — Minimalismo y progreso personal

Estado: aprobada por la instrucción del usuario de implementar el plan (2026-10-09).
Complementa la spec 008 sin reemplazar sus cambios. Sin dependencias runtime nuevas
ni despliegue remoto. Constitución 2.0.0 aplicable.

## Experiencia

Conservar salvia, crema, Plus Jakarta Sans y Fraunces. Superficies sobrias,
separadores suaves, filas compactas y menos sombras en todas las pantallas.
Resumen presenta balance, ingresos/egresos, presupuesto y un bloque pequeño
de progreso antes de análisis secundarios. Mantener cuatro accesos móviles y
Más; añadir Mi progreso en Más y escritorio. Opciones de formulario adicionales
se revelan bajo demanda, conservando validaciones y capacidades.
Controles de 44 px, foco visible y movimiento reducido en ambos temas.

## Dominio

Seis logros, una identidad estable por usuario/logro:
registro en siete fechas personales distintas (excluye ajustes, recurrencias,
cuotas y compartidos); diez tareas terminadas; una meta personal completada;
cuatro semanas consecutivas de un hábito cumpliendo su programación real;
una meta de ahorro al 50%; una al 100%.
Semanas locales lunes-domingo completas: excluir semana inicial parcial y
semana actual no terminada. Comodines y completados borrados no cuentan.
El progreso deriva de datos vigentes; correcciones pueden revocar el estado.
Historial inicial silencioso; recuperación nunca repite una celebración.

## Persistencia y avisos

Profile.gamification_enabled (ausente equivale a true). AchievementReceipt
guarda inicialización y celebración gestionada, no contadores. IndexedDB,
repositorio y sync custom con migración aditiva y RLS por propietario.
Evaluación tras cambios locales, pull y al montar, dentro del evaluador de
Notification existente. Nuevos logros generan un aviso breve in-app cuando
gamificación e inapp_enabled están habilitados; ocultar consume la celebración
sin borrar historial. No push adicional, XP, niveles ni logros familiares.

## Verificación

Unitarios: umbrales, exclusiones, fechas, semanas/frecuencia, comodines,
correcciones, historial y deduplicación. Repositorio: aislamiento y cola sync.
Testing Library: navegación, visibilidad, progreso y opciones adicionales.
Tests, lint, TypeScript, build y revisión navegador móvil/escritorio, claro/
oscuro, teclado, movimiento reducido y offline con recarga/reapertura.
Registrar resultados y límites en verification.md sin afirmar verificaciones
que no se hayan ejecutado.
