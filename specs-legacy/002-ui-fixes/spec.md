# Spec 002 — UI/UX Fixes & Polish

> [!NOTE]
> Entrega histórica — ver `specs/001-ezlife-mvp/spec.md` para el estado
> vigente de requisitos.

## Contexto

Revisión multi-dispositivo detectó 10 problemas entre bugs funcionales y deudas de diseño.

## Items

### Bug fixes funcionales

1. **ThemeToggle de 2 modos → 3 modos**: Agregar opción "sistema" al ciclo claro/oscuro.
2. **Selects mostrando UUIDs**: `MovementForm` y `OnboardingStep2` muestran valores internos porque el `Select` renderiza antes de que los datos asincrónicos estén disponibles.
3. **Layout tablet/desktop roto**: La sidebar fija de 256px no coordina bien con el `main` en breakpoints intermedios. Los links de nav tampoco funcionan de forma consistente en tablet.
4. **FAB mobile ausente / Botón "Nuevo" sidebar no abre modal**: El FAB existe pero no se ve. El botón de sidebar usa toggle en lugar de abrir siempre el formulario.
5. **Íconos OAuth incorrectos**: `Mail` de lucide-react no es el ícono de Google. `GitBranch` no es el ícono de GitHub.
6. **`calculateMonthlyCycle` sin import en `Dashboard.tsx`**: La función se llama sin importarla → bug de runtime silencioso.
7. **Foto de perfil OAuth no se muestra**: `session.user.user_metadata.avatar_url` existe pero nunca se lee ni se muestra.
8. **Sin botón de Cerrar Sesión**: No existe en ningún componente.

### Mejoras de UX

9. **Tutorial de categorías**: Agregar banner explicativo del método 50/30/20 en `OnboardingStep2`. Mejorar el copy del botón "Editar Categorías" en `SettingsScreen`.
10. **Rediseño visual — dirección cálida y humana**: Reemplazar grays hardcodeados por tokens CSS del sistema. Refinar la paleta en `globals.css` para que sea más expresiva, rounded y warm. Dark mode debe funcionar correctamente en todos los componentes.

## Reglas

- Sin nuevas dependencias runtime (SVG de marcas: inline).
- No se toca lógica de negocio ni repositorios.
- Todos los tests existentes deben seguir pasando.
- `pnpm lint` sin errores al terminar.

## Archivos modificados

- `specs/002-ui-fixes/spec.md` [NEW]
- `src/app/globals.css` [MODIFY]
- `src/presentation/components/ThemeToggle.tsx` [MODIFY]
- `src/presentation/components/LoginScreen.tsx` [MODIFY]
- `src/presentation/components/Layout.tsx` [MODIFY]
- `src/presentation/components/BottomNav.tsx` [MODIFY]
- `src/presentation/components/MainFlow.tsx` [MODIFY]
- `src/presentation/components/SettingsScreen.tsx` [MODIFY]
- `src/presentation/components/MovementForm.tsx` [MODIFY]
- `src/presentation/components/OnboardingStep2.tsx` [MODIFY]
- `src/presentation/components/Dashboard.tsx` [MODIFY]
