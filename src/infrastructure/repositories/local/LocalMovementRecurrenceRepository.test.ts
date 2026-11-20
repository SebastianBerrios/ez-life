import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { LocalMovementRecurrenceRepository } from './LocalMovementRecurrenceRepository';

describe('LocalMovementRecurrenceRepository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('never generates movements automatically across three simulated months with an active rule (FR-014, SC-004)', async () => {
    const repo = new LocalMovementRecurrenceRepository();
    const userId = 'u1';
    const created = new Date(2026, 7, 5, 12, 0);

    await db.movement_recurrences.put({
      id: 'rule-gym',
      user_id: userId,
      type: 'EXPENSE',
      amount: 8000,
      date: created,
      description: 'Gimnasio',
      is_recurring: true,
      active: true,
      day_of_month: 5,
      activated_month: '2026-08',
      created_at: created,
      updated_at: created,
    });

    // Simulate three consecutive monthly runs
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      await repo.adoptLegacySources(userId);
    }

    expect(await db.movements.where('user_id').equals(userId).count()).toBe(0);
    expect(await db.movement_recurrences.where('user_id').equals(userId).count()).toBe(1);
  });

  it('preserves pre-existing recurring occurrences untouched (FR-018)', async () => {
    const repo = new LocalMovementRecurrenceRepository();
    const userId = 'u1';
    const oldDate = new Date(2026, 8, 5, 12, 0);

    await db.movement_recurrences.put({
      id: 'rule-1',
      user_id: userId,
      type: 'EXPENSE',
      amount: 8000,
      date: oldDate,
      description: 'Gimnasio',
      is_recurring: true,
      active: true,
      day_of_month: 5,
      activated_month: '2026-09',
      created_at: oldDate,
      updated_at: oldDate,
    });
    await db.movements.put({
      id: 'occ-2026-09',
      user_id: userId,
      type: 'EXPENSE',
      amount: 8000,
      date: oldDate,
      description: 'Gimnasio',
      is_recurring: true,
      recurrence_rule_id: 'rule-1',
      recurrence_month: '2026-09',
      created_at: oldDate,
      updated_at: oldDate,
    });

    await repo.adoptLegacySources(userId);

    const movements = await db.movements.where('user_id').equals(userId).toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      id: 'occ-2026-09',
      amount: 8000,
      recurrence_rule_id: 'rule-1',
      recurrence_month: '2026-09',
    });
  });

  it('adopts a legacy recurring movement into a rule once (idempotent) without creating extra movements', async () => {
    const repo = new LocalMovementRecurrenceRepository();
    const userId = 'u1';
    const date = new Date(2026, 9, 12, 12, 0);

    await db.movements.put({
      id: 'legacy-1',
      user_id: userId,
      type: 'EXPENSE',
      amount: 12000,
      date,
      description: 'Internet',
      is_recurring: true,
      created_at: date,
      updated_at: date,
    });

    await repo.adoptLegacySources(userId);
    await repo.adoptLegacySources(userId);

    const rules = await db.movement_recurrences.where('user_id').equals(userId).toArray();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 'legacy-1',
      active: true,
      day_of_month: 12,
      activated_month: '2026-10',
      description: 'Internet',
    });

    const movements = await db.movements.where('user_id').equals(userId).toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      id: 'legacy-1',
      recurrence_rule_id: 'legacy-1',
      recurrence_month: '2026-10',
    });
  });
});
