# Feature Specification: Ajuste Manual de Balance Mensual

**Feature Branch**: `[006-ajuste-de-balance-mensual]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Debería haber una opción para modificar el balance del mes, como un ajuste extracurricular que pasó."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un ajuste manual de balance (Priority: P1)

Como usuario, quiero poder corregir mi balance del mes con un ajuste manual (positivo o negativo)
cuando pasó algo extraordinario que mis ingresos/egresos normales no capturan, para que mi balance
refleje la realidad sin tener que forzarlo dentro de una categoría que no le corresponde.

**Why this priority**: Es el único comportamiento nuevo de esta spec; sin él, el usuario sigue sin
tener forma de corregir su balance ante un evento excepcional.

**Independent Test**: Registrar un ajuste positivo y uno negativo, y verificar que el balance total
del usuario cambia en el monto correspondiente en cada caso, y que cada ajuste queda visible en
Movimientos identificado como tal.

**Acceptance Scenarios**:

1. **Given** el usuario quiere reflejar un ingreso extraordinario no capturado por sus fuentes de
   ingreso habituales, **When** registra un ajuste positivo con un motivo, **Then** su balance
   total aumenta en ese monto.
2. **Given** el usuario quiere reflejar una pérdida o gasto extraordinario, **When** registra un
   ajuste negativo con un motivo, **Then** su balance total disminuye en ese monto.
3. **Given** un ajuste ya registrado, **When** el usuario abre Movimientos, **Then** lo ve listado
   y claramente distinguible de un ingreso/egreso regular (ej. etiquetado "Ajuste").
4. **Given** el usuario intenta registrar un ajuste sin motivo, **When** intenta guardar, **Then**
   el sistema se lo impide — el motivo es obligatorio.

---

### Edge Cases

- Un ajuste NO DEBE contarse dentro de la distribución 50/30/20 por categoría, ya que no
  pertenece a ninguna categoría de ingreso/egreso real — solo afecta el balance total.
- El usuario puede editar o eliminar un ajuste que registró antes, igual que cualquier otro
  movimiento.
- El usuario puede fechar un ajuste en cualquier mes (pasado o actual), no solo el mes en curso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Los usuarios DEBEN poder crear un ajuste manual de balance, con un monto (positivo
  para aumentar el balance, negativo para disminuirlo) y una fecha.
- **FR-002**: El motivo/descripción de un ajuste manual de balance ES obligatorio — a diferencia
  de la descripción opcional de un Movement regular — porque es la única evidencia de por qué se
  hizo esa corrección excepcional.
- **FR-003**: Un ajuste manual de balance DEBE afectar el cálculo del balance total del usuario
  exactamente igual que un Movement regular del signo correspondiente.
- **FR-004**: Un ajuste manual de balance NO DEBE contarse dentro de la distribución 50/30/20 por
  categoría de ingreso/egreso.
- **FR-005**: Un ajuste manual de balance DEBE aparecer en Movimientos (Historial), distinguible
  visualmente de los ingresos/egresos regulares.
- **FR-006**: Los usuarios DEBEN poder editar o eliminar un ajuste manual de balance que crearon
  previamente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede registrar un ajuste de cualquier signo y ver su balance total
  reflejarlo de inmediato.
- **SC-002**: El 100% de los ajustes de balance son visualmente distinguibles de los movimientos
  regulares en Movimientos.
- **SC-003**: El 100% de los ajustes de balance quedan excluidos del reporte de distribución
  50/30/20 por categoría.
- **SC-004**: El 100% de los ajustes de balance requieren un motivo antes de poder guardarse.

## Assumptions

- Los ajustes se pueden fechar en cualquier momento (pasado o presente), sin restricción adicional
  respecto a la fecha ya permitida en un Movement regular.
- Los ajustes siguen las mismas reglas de edición/eliminación que un Movement regular; no aplican
  a espacios compartidos (son siempre personales, nunca un `SharedMovement`).
- La decisión de si un ajuste se modela como un nuevo tipo de registro o como un `Movement` con un
  indicador especial se toma en `/speckit-plan`, no en este spec.
