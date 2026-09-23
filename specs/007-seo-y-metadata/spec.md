# Feature Specification: SEO, Favicon y Metadata al Compartir

**Feature Branch**: `[007-seo-y-metadata]`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Mejorar el SEO, el logo en la pestaña, los datos al momento de compartir el link de la app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Logo real en la pestaña del navegador (Priority: P1)

Como usuario, quiero ver el logo de ez-life en la pestaña del navegador, no un ícono genérico, para
identificar la app entre mis otras pestañas abiertas.

**Why this priority**: Es el detalle más visible y de menor esfuerzo; hoy la app usa el favicon
genérico por defecto.

**Independent Test**: Abrir la app en el navegador y verificar que la pestaña muestra el logo de
ez-life, no el ícono placeholder actual.

**Acceptance Scenarios**:

1. **Given** el usuario abre la app en cualquier navegador, **When** mira la pestaña, **Then** ve
   el logo de ez-life como favicon.
2. **Given** el usuario agrega la app a su pantalla de inicio en el celular, **When** mira el
   ícono guardado, **Then** ve el mismo logo, no un ícono genérico.

---

### User Story 2 - Vista previa rica al compartir el link (Priority: P1)

Como usuario, quiero que al compartir el link de la app en WhatsApp, Slack o redes sociales,
aparezca una vista previa con título, descripción e imagen, para que quien lo reciba entienda qué
es antes de abrirlo.

**Why this priority**: Mismo nivel de impacto que el logo — es lo primero que ve alguien externo
antes de siquiera entrar a la app.

**Independent Test**: Pegar el link de la app en una herramienta de vista previa de Open Graph (o
compartirlo manualmente en una app de mensajería) y verificar que muestra título, descripción e
imagen representativos de ez-life, no una URL pelada.

**Acceptance Scenarios**:

1. **Given** el usuario comparte el link de la app, **When** la app de mensajería o red social
   genera la vista previa, **Then** muestra un título, una descripción y una imagen de ez-life.

---

### User Story 3 - Títulos y descripciones específicos por página (Priority: P2)

Como usuario/buscador, quiero que cada página principal de la app tenga un título y descripción
propios y descriptivos, para que sea más fácil de identificar en el historial del navegador, en
pestañas múltiples, o en un buscador.

**Why this priority**: Es una mejora incremental sobre US1/US2, de menor impacto inmediato ya que
hoy la app es de uso demo/localhost (no indexada públicamente todavía).

**Independent Test**: Navegar a distintas páginas principales de la app y verificar que el título
de la pestaña cambia de forma descriptiva según la página.

**Acceptance Scenarios**:

1. **Given** el usuario navega a una página principal distinta de la de inicio, **When** mira el
   título de la pestaña, **Then** ve un título específico de esa página, no siempre el mismo
   título genérico.

---

### Edge Cases

- Si la app se comparte antes de que exista una imagen representativa (Open Graph image), la
  vista previa debe igual mostrar título y descripción — no debe romperse ni mostrar un espacio en
  blanco confuso por falta de imagen.
- El favicon debe verse correctamente tanto en modo claro como oscuro del sistema operativo/
  navegador, si el diseño del logo lo requiere.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El favicon de la app DEBE mostrar el logo de ez-life, reemplazando el ícono
  genérico/placeholder actual.
- **FR-002**: El favicon DEBE renderizarse correctamente en los tamaños y contextos comunes
  (pestaña de escritorio, ícono de acceso directo en pantalla de inicio móvil).
- **FR-003**: Al compartir el link de la app, la vista previa generada DEBE incluir un título, una
  descripción y una imagen representativos de ez-life (metadata Open Graph / Twitter Card).
- **FR-004**: Cada página principal de la app DEBE tener un título y una descripción específicos
  de su contenido, distintos entre sí.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los navegadores muestran el logo de ez-life en la pestaña, no un ícono
  genérico.
- **SC-002**: Al compartir el link de la app en al menos una app de mensajería o red social común,
  la vista previa muestra título, descripción e imagen.
- **SC-003**: Las páginas principales de la app tienen títulos de pestaña distintos entre sí,
  reflejando el contenido de cada una.

## Assumptions

- Existe o se producirá, como parte del trabajo de diseño, un logo/imagen representativa de
  ez-life apta para favicon e imagen de Open Graph; este spec no define el diseño visual del logo
  en sí, solo que debe existir y usarse de forma consistente.
- ez-life hoy vive en `mvp-lab` como demo/localhost (ver reglas de la fleet en
  `mvp-lab-infra/OPERATIONS.md`); el beneficio inmediato de esto es sobre todo compartir el link
  con testers/usuarios de demo, no indexación pública masiva — igual se implementan las buenas
  prácticas básicas para no tener que rehacerlas al graduar la app.
- No se agrega ninguna librería nueva para esto: Next.js App Router ya soporta metadata
  (`generateMetadata`, `icons`, `openGraph`) de forma nativa (Principio VII, Simplicidad).
