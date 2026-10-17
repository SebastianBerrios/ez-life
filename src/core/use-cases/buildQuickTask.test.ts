import { describe, expect, it } from 'vitest';
import { buildQuickTask, QUICK_TASK_MAX_LENGTH } from './buildQuickTask';
import { calendarKey } from './calendar';

describe('buildQuickTask', () => {
  const evening = new Date(2026, 9, 16, 22, 40); // Friday night: already Saturday in UTC when the host is UTC-5

  it('builds a pending medium-priority task due today at local noon with a fresh id', () => {
    const result = buildQuickTask('  Llamar a contabilidad  ', 'user-1', evening);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.task).toMatchObject({ user_id: 'user-1', title: 'Llamar a contabilidad', status: 'pending', priority: 'medium' });
    expect(result.task.due_date).toEqual(new Date(2026, 9, 16, 12));
    expect(calendarKey(result.task.due_date)).toBe('2026-10-16');
    expect(result.task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.task).not.toHaveProperty('created_at');
    expect(result.task).not.toHaveProperty('updated_at');
  });

  it('generates a different id each time', () => {
    const a = buildQuickTask('a', 'u', evening);
    const b = buildQuickTask('a', 'u', evening);
    expect(a.ok && b.ok && a.task.id !== b.task.id).toBe(true);
  });

  it('rejects empty and whitespace-only titles', () => {
    for (const title of ['', '   ', '\n\t ']) {
      expect(buildQuickTask(title, 'u', evening)).toEqual({ ok: false, error: 'Escribí un título para la tarea.' });
    }
  });

  it('caps the length', () => {
    const result = buildQuickTask('x'.repeat(300), 'u', evening);
    expect(result.ok && result.task.title.length).toBe(QUICK_TASK_MAX_LENGTH);
  });

  it('does not leave a trailing space after truncating', () => {
    const title = `${'a'.repeat(QUICK_TASK_MAX_LENGTH - 1)} bbbb`;
    const result = buildQuickTask(title, 'u', evening);
    expect(result.ok && result.task.title).toBe('a'.repeat(QUICK_TASK_MAX_LENGTH - 1));
  });
});
