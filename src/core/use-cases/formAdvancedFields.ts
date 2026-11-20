export function countActiveFields(flags: readonly boolean[]): number {
  let count = 0;
  for (const active of flags) {
    if (active) count += 1;
  }
  return count;
}

export function formatMoreOptionsLabel(activeCount: number): string {
  if (activeCount <= 0) return 'Más opciones';
  if (activeCount === 1) return 'Más opciones · 1 activa';
  return `Más opciones · ${activeCount} activas`;
}

export function hasAdvancedFieldError(errorFlags: readonly boolean[]): boolean {
  return errorFlags.some(Boolean);
}
