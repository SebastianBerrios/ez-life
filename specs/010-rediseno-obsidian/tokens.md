# 010 — Tokens y primitivos (Obsidian Precision)

Fuente de verdad: `src/app/globals.css` (variables HSL sin alpha, consumidas como
`hsl(var(--x) / <alpha-value>)` en `tailwind.config.ts`, así `bg-primary/10` funciona).
Oscuro por defecto (`ThemeProvider defaultTheme="dark" enableSystem={false}`); el claro es una variante derivada.
Los bordes hairline son el equivalente OPACO del blanco al 8 % (oscuro) / `#0B0D12` al 8 % (claro) sobre la superficie,
porque un triplete HSL no puede llevar alpha.

## Colores

| Token (Tailwind) | Oscuro | Claro | Uso |
|---|---|---|---|
| `background` | `#090A0F` | `#F7F8FA` | lienzo |
| `card` (surface-1) | `#12141A` | `#FFFFFF` | tarjetas, paneles, inputs |
| `surface-2` / `popover` | `#1A1D26` | `#F1F3F6` / `#FFFFFF` | diálogos, hojas, menús, tab activa |
| `surface-3` / `muted` / `accent` | `#222634` | `#E6E9EF` | chips, skeleton, hover |
| `foreground` | `#F9FAFB` | `#0B0D12` | texto |
| `muted-foreground` | `#94A3B8` | `#475569` | texto secundario |
| `subtle` | `#475569` | `#64748B` | texto terciario / decorativo (ver nota) |
| `border` | `#25272C` (blanco 8 % sobre `#12141A`) | `#EBECEC` (`#0B0D12` 8 % sobre blanco) | hairline |
| `border-strong` | `#3F4149` (blanco 16 % sobre `#1A1D26`) | `#D8D8D9` (`#0B0D12` 16 % sobre blanco) | borde activo, diálogos |
| `primary` | `#10B981` | `#047857` | acción principal, foco, progreso |
| `primary-hover` | `#34D399` | `#065F46` | hover del botón principal |
| `primary-foreground` | `#090A0F` | `#FFFFFF` | texto sobre primary |
| `success` | `#34D399` | `#065F46` | ingreso / delta positivo (claro: emerald-800; `#047857` daba 4.38:1 sobre insignias tintadas) |
| `expense` / `destructive` | `#FB7185` | `#BE123C` | gasto / error (oscuro rose-400 y claro rose-700: `#F43F5E` y `#E11D48` daban 4.24:1 y 3.78:1 sobre insignias tintadas) |
| `warning` | `#F59E0B` | `#92400E` | aviso (claro: amber-800; `#B45309` daba 4.39:1 sobre insignias tintadas) |

Nota: `subtle` NO cumple AA como texto (2.43:1 en oscuro sobre card); usar solo para iconos/decoración. Para texto, `muted-foreground`.

### Contraste (WCAG 2.x, calculado con script de Node)

| Par | Oscuro | Claro |
|---|---|---|
| foreground / background | 18.92 | 18.29 |
| foreground / card | 17.62 | 19.43 |
| muted-foreground / card | 7.18 | 7.58 |
| muted-foreground / background | 7.71 | 7.13 |
| muted-foreground / surface-3 (peor caso) | 5.87 | 6.23 |
| primary (texto) / card | 7.26 | 5.48 |
| primary-foreground / primary (botón) | 7.80 | 5.48 |
| destructive (texto) / card | 6.84 | 6.29 |
| warning (texto) / card | 8.57 | 7.09 |
| success (texto) / card | 9.58 | 7.68 |

Nota: estas tres filas se recalcularon tras la Fase 4e (colores `destructive`/`expense`, `success` y `warning` ajustados para que las insignias tintadas lleguen a AA); los ratios se calcularon con un script de Node, no se estimaron.

Desviación consciente: el brief pedía `#059669` como primary claro; sobre blanco da 3.77:1 (falla AA 4.5:1), por eso se usa `#047857` (5.48:1) y el hover claro oscurece (`#065F46`).

## Radios y sombras

`rounded-sm` 4 px (badges, kbd) · `rounded-md` 6 px · `rounded-lg` 8 px (botones, inputs, cards, paneles) · `rounded-xl` 12 px (diálogos, hojas). Píldora (`rounded-full`) solo para puntos de estado, avatares y el switch.
Sin sombras suaves: la profundidad es tonal + hairline. Únicas sombras: `shadow-dialog` (`0 20px 40px -10px rgb(0 0 0 / .8)`), `shadow-focus` / `shadow-focus-destructive` (borde de 1 px + brillo 12 px al 15 %).

## Tipografía

Geist (`font-sans`, variable `--font-geist`, auto-hospedada) para texto; JetBrains Mono (`font-mono`, `--font-jetbrains`) para micro-etiquetas, atajos, metadatos y deltas compactos. `font-heading` es un alias de Geist (ya no hay serif). `tabular-nums` en toda cifra.

| Clase | Tamaño / interlínea | Tracking | Peso |
|---|---|---|---|
| `text-display-hero` / `-mobile` | 44/52 · 32/40 | -0.03em · -0.025em | 600 |
| `text-headline-lg` / `-mobile` | 30/38 · 24/32 | -0.02em · -0.015em | 600 |
| `text-headline-md` | 20/28 | -0.015em | 500 |
| `text-headline-sm` | 16/24 | -0.01em | 500 |
| `text-body-lg` / `-md` / `-sm` | 16/24 · 14/20 · 12/16 | -0.005 · 0 · 0.005em | 400 |
| `text-metric-num-lg` / `-md` | 36/44 · 22/28 (+ `tabular-nums`) | -0.03em · -0.02em | 600 · 500 |
| `text-label-mono-sm` / `-xs` | 11/14 · 10/12 (+ `font-mono`) | 0.04em · 0.06em | 500 · 400 |

Importante: `cn()` es `src/lib/utils.ts` (no el paquete `cn` directo). Está configurado con estas clases; el paquete por defecto interpreta `text-headline-md` como COLOR y lo descarta junto a `text-foreground`. Importar siempre `cn` desde `@/lib/utils`.

## Qué primitivo usar

| Necesidad | Primitivo |
|---|---|
| Acción | `Button` (`default` = esmeralda, `outline`/`secondary`/`ghost` = hairline, `destructive`) |
| Campo de texto / selector | `Input`, `Select` (superficie-1 + hairline, foco esmeralda) |
| Contenedor genérico | `Card*` · tablero con eyebrow mono y acciones: `Panel`, `PanelHeader`, `PanelBody` |
| KPI | `StatCard` (+ `Money`) |
| Importe | `Money` (símbolo atenuado al 75 %, `−` tipográfico) o `formatMoney()` para texto plano (core) |
| Pestañas / filtros | `Segmented` (+ `SegmentedPanel`); `size="sm"` para densidad desktop, `mono` para etiquetas mono |
| Booleano | `Switch` |
| Hoja de registro / formularios | `Sheet*` (bottom-sheet móvil, panel centrado `md+`); confirmaciones: `Dialog*` |
| Estado / etiqueta | `Badge` (`positive`/`negative`/`neutral`/`warning`/`primary`) |
| Atajo de teclado | `Kbd` |
| Progreso lineal / circular | `Progress` (pista 4 px) / `RingProgress` |
