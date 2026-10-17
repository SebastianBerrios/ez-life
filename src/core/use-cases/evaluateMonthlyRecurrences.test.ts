import { describe, it, expect } from 'vitest';
import { evaluateMonthlyRecurrences } from './evaluateMonthlyRecurrences';
import { MovementRecurrence } from '../domain/models/types';
const rule: MovementRecurrence = { id: 'rule', user_id: 'A', type: 'EXPENSE', amount: 100,
  is_recurring: true, active: true, day_of_month: 31, activated_month: '2026-01',
  date: new Date(2026, 0, 31), created_at: new Date(), updated_at: new Date() };
describe('monthly recurrence rules', () => {
  it('clamps the day to February and waits until the scheduled calendar day', () => {
    expect(evaluateMonthlyRecurrences([rule], [], new Date(2026, 1, 27))).toHaveLength(0);
    const result = evaluateMonthlyRecurrences([rule], [], new Date(2026, 1, 28));
    expect(result[0].date.getDate()).toBe(28);
    expect(result[0].is_recurring).toBe(false);
    expect(result[0].recurrence_rule_id).toBe('rule');
  });
  it('keeps deleted occurrences as deduplication receipts', () => {
    const occurrence = { ...rule, recurrence_rule_id: rule.id, recurrence_month: '2026-02', deleted_at: new Date() };
    expect(evaluateMonthlyRecurrences([rule], [occurrence], new Date(2026, 1, 28))).toHaveLength(0);
  });
  it('never generates inactive months or months before reactivation', () => {
    expect(evaluateMonthlyRecurrences([{ ...rule, active: false }], [], new Date(2026, 5, 30))).toHaveLength(0);
    expect(evaluateMonthlyRecurrences([{ ...rule, activated_month: '2026-06' }], [], new Date(2026, 4, 31))).toHaveLength(0);
    expect(evaluateMonthlyRecurrences([{ ...rule, activated_month: '2026-06' }], [], new Date(2026, 5, 30))).toHaveLength(1);
  });
  it('copies the payment account into each generated occurrence and keeps it at 12:00', () => {
    const [occurrence] = evaluateMonthlyRecurrences([{ ...rule, account_id: 'acc-1' }], [], new Date(2026, 1, 28, 18, 45));
    expect(occurrence.account_id).toBe('acc-1');
    expect(occurrence.to_account_id).toBeUndefined();
    expect(occurrence.date.getHours()).toBe(12);
    expect(occurrence.date.getMinutes()).toBe(0);
  });
});
