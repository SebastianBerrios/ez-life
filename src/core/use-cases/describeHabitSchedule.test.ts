import { describe, expect, it } from 'vitest';
import { describeHabitSchedule } from './describeHabitSchedule';

describe('describeHabitSchedule', () => {
  it('every day', () => {
    expect(describeHabitSchedule({ schedule_mode: 'fixed_days', fixed_days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] })).toBe('Todos los días');
  });
  it('lists selected days Monday first regardless of the stored order', () => {
    expect(describeHabitSchedule({ schedule_mode: 'fixed_days', fixed_days: ['fri', 'mon', 'wed'] })).toBe('Lun · Mié · Vie');
    expect(describeHabitSchedule({ schedule_mode: 'fixed_days', fixed_days: ['sun', 'sat'] })).toBe('Sáb · Dom');
    expect(describeHabitSchedule({ schedule_mode: 'fixed_days', fixed_days: ['thu'] })).toBe('Jue');
  });
  it('frequency, singular and plural, defaulting to once', () => {
    expect(describeHabitSchedule({ schedule_mode: 'frequency', frequency_target: 3 })).toBe('3 veces por semana');
    expect(describeHabitSchedule({ schedule_mode: 'frequency', frequency_target: 1 })).toBe('1 vez por semana');
    expect(describeHabitSchedule({ schedule_mode: 'frequency' })).toBe('1 vez por semana');
  });
  it('falls back to the frequency text when a fixed-days habit has no days (corrupt data)', () => {
    expect(describeHabitSchedule({ schedule_mode: 'fixed_days', fixed_days: [] })).toBe('1 vez por semana');
  });
});
