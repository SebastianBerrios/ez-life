import { describe, it, expect } from 'vitest';
import { calculateMonthBalance } from './calculateMonthBalance';
import type { DistributionCategory, MonthBalance, Movement, PaymentAccount } from '../domain/models/types';

const USER = 'u1';
const NOW = new Date(2026, 9, 1, 12, 0);

const BUCKET_NEEDS: DistributionCategory = {
  id: 'b-needs', user_id: USER, name: 'Necesidades', percentage: 50, is_default: true, is_savings: false, created_at: NOW, updated_at: NOW,
};
const BUCKET_SAVINGS: DistributionCategory = {
  id: 'b-savings', user_id: USER, name: 'Ahorro', percentage: 20, is_default: true, is_savings: true, created_at: NOW, updated_at: NOW,
};
const BUCKETS = [BUCKET_NEEDS, BUCKET_SAVINGS];

let seq = 0;
function acc(id: string, kind: PaymentAccount['kind'], opening_balance: number, extra: Partial<PaymentAccount> = {}): PaymentAccount {
  return {
    id, user_id: USER, name: id, kind, opening_balance, created_at: NOW, updated_at: NOW, ...extra,
  };
}

function mov(type: Movement['type'], amount: number, date: Date, extra: Partial<Movement> = {}): Movement {
  seq += 1;
  return {
    id: `m-${seq}`,
    user_id: USER,
    type,
    amount,
    date,
    is_recurring: false,
    created_at: date,
    updated_at: date,
    ...extra,
  };
}

function assertInvariants(res: MonthBalance) {
  expect(res.balance).toBe(res.opening + res.entro - res.salio - res.ahorraste + res.sacaste + res.ajuste);
  expect(res.savingsNet).toBe(res.ahorraste - res.sacaste);
}

describe('calculateMonthBalance — classification table (rows 1–18)', () => {
  const month = new Date(2026, 10, 15); // 2026-11
  const balanceSince = '2026-11';
  const baseAccounts = [
    acc('s1', 'debit', 100000),
    acc('s2', 'cash', 20000),
    acc('v1', 'savings', 50000),
    acc('v2', 'savings', 10000),
    acc('c1', 'credit', 0),
    acc('c2', 'credit', 0),
  ];

  const rows: {
    row: number;
    label: string;
    accounts?: PaymentAccount[];
    movements: Movement[];
    expected: Partial<MonthBalance>;
  }[] = [
    {
      row: 1,
      label: 'INGRESO a S',
      movements: [mov('INCOME', 50000, new Date(2026, 10, 5), { account_id: 's1' })],
      expected: { opening: 120000, entro: 50000, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 170000, savingsNet: 0 },
    },
    {
      row: 2,
      label: 'INGRESO a V (aporte implícito)',
      movements: [mov('INCOME', 8000, new Date(2026, 10, 5), { account_id: 'v1' })],
      expected: { opening: 120000, entro: 8000, salio: 0, ahorraste: 8000, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 8000 },
    },
    {
      row: 3,
      label: 'INGRESO a C (devolución)',
      movements: [mov('INCOME', 4000, new Date(2026, 10, 5), { account_id: 'c1' })],
      expected: { opening: 120000, entro: 4000, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 124000, savingsNet: 0 },
    },
    {
      row: 4,
      label: 'GASTO desde S, bucket normal',
      movements: [mov('EXPENSE', 30000, new Date(2026, 10, 5), { account_id: 's1', distribution_category_id: 'b-needs' })],
      expected: { opening: 120000, entro: 0, salio: 30000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 90000, savingsNet: 0 },
    },
    {
      row: 5,
      label: 'GASTO desde S, bucket Ahorro',
      movements: [mov('EXPENSE', 15000, new Date(2026, 10, 5), { account_id: 's1', distribution_category_id: 'b-savings' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 15000, sacaste: 0, ajuste: 0, balance: 105000, savingsNet: 15000 },
    },
    {
      row: 6,
      label: 'GASTO desde V, bucket normal (retiro implícito)',
      movements: [mov('EXPENSE', 5000, new Date(2026, 10, 5), { account_id: 'v1', distribution_category_id: 'b-needs' })],
      expected: { opening: 120000, entro: 0, salio: 5000, ahorraste: 0, sacaste: 5000, ajuste: 0, balance: 120000, savingsNet: -5000 },
    },
    {
      row: 7,
      label: 'GASTO desde V, bucket Ahorro (sin flujos)',
      movements: [mov('EXPENSE', 5000, new Date(2026, 10, 5), { account_id: 'v1', distribution_category_id: 'b-savings' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 },
    },
    {
      row: 8,
      label: 'GASTO desde C, bucket normal (mes >= balance_since)',
      movements: [mov('EXPENSE', 10000, new Date(2026, 10, 5), { account_id: 'c1', distribution_category_id: 'b-needs' })],
      expected: { opening: 120000, entro: 0, salio: 10000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 110000, savingsNet: 0 },
    },
    {
      row: 9,
      label: 'GASTO desde C, bucket Ahorro (mes >= balance_since)',
      movements: [mov('EXPENSE', 10000, new Date(2026, 10, 5), { account_id: 'c1', distribution_category_id: 'b-savings' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 10000, sacaste: 0, ajuste: 0, balance: 110000, savingsNet: 10000 },
    },
    {
      row: 10,
      label: 'CUOTA / ABONO de préstamo desde S',
      movements: [mov('EXPENSE', 25000, new Date(2026, 10, 5), { account_id: 's1', installment_payment_id: 'ip-1', distribution_category_id: 'b-needs' })],
      expected: { opening: 120000, entro: 0, salio: 25000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 95000, savingsNet: 0 },
    },
    {
      row: 11,
      label: 'TRANSFERENCIA S->S y V->V (sin flujos)',
      movements: [
        mov('TRANSFER', 10000, new Date(2026, 10, 5), { account_id: 's1', to_account_id: 's2' }),
        mov('TRANSFER', 5000, new Date(2026, 10, 6), { account_id: 'v1', to_account_id: 'v2' }),
      ],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 },
    },
    {
      row: 12,
      label: 'TRANSFERENCIA S->V',
      movements: [mov('TRANSFER', 20000, new Date(2026, 10, 5), { account_id: 's1', to_account_id: 'v1' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 20000, sacaste: 0, ajuste: 0, balance: 100000, savingsNet: 20000 },
    },
    {
      row: 13,
      label: 'TRANSFERENCIA V->S',
      movements: [mov('TRANSFER', 30000, new Date(2026, 10, 5), { account_id: 'v1', to_account_id: 's1' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 0, sacaste: 30000, ajuste: 0, balance: 150000, savingsNet: -30000 },
    },
    {
      row: 14,
      label: 'TRANSFERENCIA S->C con deuda previa parcial',
      accounts: [...baseAccounts.slice(0, 4), acc('c1', 'credit', -15000)],
      movements: [
        mov('EXPENSE', 10000, new Date(2026, 10, 2), { account_id: 'c1', distribution_category_id: 'b-needs' }),
        mov('TRANSFER', 20000, new Date(2026, 10, 5), { account_id: 's1', to_account_id: 'c1' }),
      ],
      // compra +10000 en salio, pago cubre 15000 previa (+15000 salio) + 5000 corriente (0)
      expected: { opening: 120000, entro: 0, salio: 25000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 95000, savingsNet: 0 },
    },
    {
      row: 15,
      label: 'TRANSFERENCIA V->C con deuda previa',
      accounts: [...baseAccounts.slice(0, 4), acc('c1', 'credit', -10000)],
      movements: [
        mov('EXPENSE', 5000, new Date(2026, 10, 2), { account_id: 'c1', distribution_category_id: 'b-needs' }),
        mov('TRANSFER', 15000, new Date(2026, 10, 5), { account_id: 'v1', to_account_id: 'c1' }),
      ],
      // compra 5000 (salio), pago from V: t=10000 (salio), sacaste=15000 -> net 0
      expected: { opening: 120000, entro: 0, salio: 15000, ahorraste: 0, sacaste: 15000, ajuste: 0, balance: 120000, savingsNet: -15000 },
    },
    {
      row: 16,
      label: 'TRANSFERENCIA C->S (adelanto de efectivo, neto 0)',
      movements: [mov('TRANSFER', 10000, new Date(2026, 10, 5), { account_id: 'c1', to_account_id: 's1' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 },
    },
    {
      row: 17,
      label: 'TRANSFERENCIA C->V (aporte financiado con tarjeta)',
      movements: [mov('TRANSFER', 10000, new Date(2026, 10, 5), { account_id: 'c1', to_account_id: 'v1' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 10000, sacaste: 0, ajuste: 0, balance: 110000, savingsNet: 10000 },
    },
    {
      row: 18,
      label: 'TRANSFERENCIA C->C (sin flujos, incluso con deuda previa en destino)',
      accounts: [...baseAccounts.slice(0, 4), acc('c1', 'credit', 0), acc('c2', 'credit', -30000)],
      movements: [mov('TRANSFER', 20000, new Date(2026, 10, 5), { account_id: 'c1', to_account_id: 'c2' })],
      expected: { opening: 120000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 },
    },
  ];

  for (const tc of rows) {
    it(`row ${tc.row}: ${tc.label}`, () => {
      const res = calculateMonthBalance({
        month,
        accounts: tc.accounts ?? baseAccounts,
        movements: tc.movements,
        distributionCategories: BUCKETS,
        balanceSince,
      });
      expect(res).toMatchObject(tc.expected);
      assertInvariants(res);
    });
  }
});

describe('calculateMonthBalance — manual adjustments', () => {
  const month = new Date(2026, 10, 15);
  const accounts = [acc('s1', 'debit', 100000), acc('v1', 'savings', 50000), acc('c1', 'credit', -10000)];

  it('applies manual adjustments on S (income/expense) to ajuste only, and ignores V/C adjustments in Balance', () => {
    const res = calculateMonthBalance({
      month,
      accounts,
      movements: [
        mov('INCOME', 4000, new Date(2026, 10, 4), { account_id: 's1', is_adjustment: true }),
        mov('EXPENSE', 1500, new Date(2026, 10, 5), { account_id: 's1', is_adjustment: true }),
        mov('INCOME', 9000, new Date(2026, 10, 6), { account_id: 'v1', is_adjustment: true }),
        mov('EXPENSE', 3000, new Date(2026, 10, 7), { account_id: 'c1', is_adjustment: true }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: '2026-11',
    });
    expect(res).toMatchObject({
      opening: 100000,
      entro: 0,
      salio: 0,
      ahorraste: 0,
      sacaste: 0,
      ajuste: 2500,
      balance: 102500,
      savingsNet: 0,
    });
    assertInvariants(res);
  });
});

describe('calculateMonthBalance — 24 minimum reference cases (contracts/balance-rules.md)', () => {
  const M = new Date(2026, 10, 15); // 2026-11
  const BS = '2026-11';

  it('case 1: arranque 1000, ingreso 500, gasto 300 en efectivo -> balance 1200, entro 500, salio 300', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 70000), acc('cash', 'cash', 30000)],
      movements: [
        mov('INCOME', 50000, new Date(2026, 10, 2), { account_id: 'd1' }),
        mov('EXPENSE', 30000, new Date(2026, 10, 3), { account_id: 'cash', distribution_category_id: 'b-needs' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 50000, salio: 30000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 2: cuenta de ahorros con 2000 -> no entra al balance', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 200000)],
      movements: [],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 100000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 3: compra con tarjeta 100 -> balance -100 ese día', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('c1', 'credit', 0, { credit_limit: 500000, payment_day: 15 })],
      movements: [mov('EXPENSE', 10000, new Date(2026, 10, 5), { account_id: 'c1', distribution_category_id: 'b-needs' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 10000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 90000, savingsNet: 0 });
    expect(res.cards).toEqual([{ accountId: 'c1', name: 'c1', owed: 10000, previousDebt: 0, creditLimit: 500000, paymentDay: 15 }]);
    assertInvariants(res);
  });

  it('case 4: pagar esa tarjeta con débito 100 -> balance sin cambio, sin salio extra', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('c1', 'credit', 0)],
      movements: [
        mov('EXPENSE', 10000, new Date(2026, 10, 5), { account_id: 'c1', distribution_category_id: 'b-needs' }),
        mov('TRANSFER', 10000, new Date(2026, 10, 10), { account_id: 'd1', to_account_id: 'c1' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 10000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 90000, savingsNet: 0 });
    expect(res.cards[0].owed).toBe(0);
    assertInvariants(res);
  });

  it('case 5: deuda previa 400; pagar 400 desde débito -> balance -400, salio +400', () => {
    const accounts = [acc('d1', 'debit', 100000), acc('c1', 'credit', -40000)];
    const beforePay = calculateMonthBalance({ month: M, accounts, movements: [], distributionCategories: BUCKETS, balanceSince: BS });
    expect(beforePay).toMatchObject({ opening: 100000, balance: 100000, salio: 0 });
    expect(beforePay.cards[0]).toMatchObject({ owed: 40000, previousDebt: 40000 });
    assertInvariants(beforePay);

    const afterPay = calculateMonthBalance({
      month: M,
      accounts,
      movements: [mov('TRANSFER', 40000, new Date(2026, 10, 10), { account_id: 'd1', to_account_id: 'c1' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(afterPay).toMatchObject({ opening: 100000, entro: 0, salio: 40000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 60000, savingsNet: 0 });
    expect(afterPay.cards[0]).toMatchObject({ owed: 0, previousDebt: 0 });
    assertInvariants(afterPay);
  });

  it('case 6: pago parcial mixto previa 400 + compra 100; pago 300 luego pago 200', () => {
    const accounts = [acc('d1', 'debit', 100000), acc('c1', 'credit', -40000)];
    const compra = mov('EXPENSE', 10000, new Date(2026, 10, 2), { account_id: 'c1', distribution_category_id: 'b-needs' });
    const pago1 = mov('TRANSFER', 30000, new Date(2026, 10, 5), { account_id: 'd1', to_account_id: 'c1' });
    const pago2 = mov('TRANSFER', 20000, new Date(2026, 10, 10), { account_id: 'd1', to_account_id: 'c1' });

    const r1 = calculateMonthBalance({ month: M, accounts, movements: [compra, pago1], distributionCategories: BUCKETS, balanceSince: BS });
    // compra -100, pago1 covers 300 of prevDebt -> -300 more = 600
    expect(r1).toMatchObject({ opening: 100000, entro: 0, salio: 40000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 60000, savingsNet: 0 });
    expect(r1.cards[0]).toMatchObject({ owed: 20000, previousDebt: 10000 });
    assertInvariants(r1);

    const r2 = calculateMonthBalance({ month: M, accounts, movements: [compra, pago1, pago2], distributionCategories: BUCKETS, balanceSince: BS });
    // pago2 covers remaining 100 prevDebt + 100 currentDebt -> -100 more = 500
    expect(r2).toMatchObject({ opening: 100000, entro: 0, salio: 50000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 50000, savingsNet: 0 });
    expect(r2.cards[0]).toMatchObject({ owed: 0, previousDebt: 0 });
    assertInvariants(r2);
  });

  it('case 7: cuota de préstamo 250 -> salio +250, balance -250', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000)],
      movements: [mov('EXPENSE', 25000, new Date(2026, 10, 5), { account_id: 'd1', installment_payment_id: 'pay-1', distribution_category_id: 'b-needs' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 25000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 75000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 8: transferencia 200 débito->ahorros -> ahorraste 200, balance -200, savingsNet +200', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 0)],
      movements: [mov('TRANSFER', 20000, new Date(2026, 10, 5), { account_id: 'd1', to_account_id: 'v1' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 20000, sacaste: 0, ajuste: 0, balance: 80000, savingsNet: 20000 });
    assertInvariants(res);
  });

  it('case 9: retiro 300 ahorros->débito -> sacaste 300, balance +300, savingsNet negativo', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 50000)],
      movements: [
        mov('TRANSFER', 10000, new Date(2026, 10, 3), { account_id: 'd1', to_account_id: 'v1' }),
        mov('TRANSFER', 30000, new Date(2026, 10, 6), { account_id: 'v1', to_account_id: 'd1' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 10000, sacaste: 30000, ajuste: 0, balance: 120000, savingsNet: -20000 });
    assertInvariants(res);
  });

  it('case 10: mes nuevo arranca con el cierre del anterior; primer mes con saldo declarado', () => {
    const accounts = [acc('d1', 'debit', 100000, { opening_date: new Date(2026, 10, 1) })];
    const movements = [
      mov('INCOME', 50000, new Date(2026, 10, 5), { account_id: 'd1' }),
      mov('EXPENSE', 20000, new Date(2026, 10, 8), { account_id: 'd1', distribution_category_id: 'b-needs' }),
      mov('EXPENSE', 10000, new Date(2026, 11, 2), { account_id: 'd1', distribution_category_id: 'b-needs' }),
    ];
    const m1 = calculateMonthBalance({ month: new Date(2026, 10, 15), accounts, movements, distributionCategories: BUCKETS, balanceSince: BS });
    const m2 = calculateMonthBalance({ month: new Date(2026, 11, 15), accounts, movements, distributionCategories: BUCKETS, balanceSince: BS });
    expect(m1).toMatchObject({ opening: 100000, balance: 130000 });
    expect(m2).toMatchObject({ opening: 130000, entro: 0, salio: 10000, balance: 120000 });
    assertInvariants(m1);
    assertInvariants(m2);
  });

  it('case 11: ingreso declarado sin movimiento -> entro 0', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000)],
      movements: [],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, balance: 100000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 12: mes sin movimientos -> balance = arranque, entro 0, salio 0', () => {
    const res = calculateMonthBalance({
      month: new Date(2026, 11, 15),
      accounts: [acc('d1', 'debit', 75000)],
      movements: [],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 75000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 75000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 13: cuenta archivada no entra al balance', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [
        acc('d1', 'debit', 100000),
        acc('old', 'debit', 50000, { archived: true }),
      ],
      movements: [mov('INCOME', 10000, new Date(2026, 10, 2), { account_id: 'old' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 100000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 14: balance negativo se calcula con signo', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 20000)],
      movements: [mov('EXPENSE', 50000, new Date(2026, 10, 4), { account_id: 'd1', distribution_category_id: 'b-needs' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 20000, entro: 0, salio: 50000, balance: -30000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 15: gasto desde ahorros 50 -> salio 50, sacaste 50, balance sin cambio, savingsNet -50', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 50000)],
      movements: [mov('EXPENSE', 5000, new Date(2026, 10, 4), { account_id: 'v1', distribution_category_id: 'b-needs' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 5000, ahorraste: 0, sacaste: 5000, ajuste: 0, balance: 100000, savingsNet: -5000 });
    assertInvariants(res);
  });

  it('case 16: ingreso depositado en ahorros 80 -> entro 80, ahorraste 80, balance sin cambio', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 50000)],
      movements: [mov('INCOME', 8000, new Date(2026, 10, 4), { account_id: 'v1' })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 8000, salio: 0, ahorraste: 8000, sacaste: 0, ajuste: 0, balance: 100000, savingsNet: 8000 });
    assertInvariants(res);
  });

  it('case 17: pago de tarjeta desde ahorros (previa 0, compra 100, pago 100) -> neto 0 en balance', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000), acc('v1', 'savings', 50000), acc('c1', 'credit', 0)],
      movements: [
        mov('EXPENSE', 10000, new Date(2026, 10, 3), { account_id: 'c1', distribution_category_id: 'b-needs' }),
        mov('TRANSFER', 10000, new Date(2026, 10, 8), { account_id: 'v1', to_account_id: 'c1' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 10000, ahorraste: 0, sacaste: 10000, ajuste: 0, balance: 100000, savingsNet: -10000 });
    assertInvariants(res);
  });

  it('case 18: ajuste manual +40 en débito -> ajuste +40, balance +40, entro/salio sin cambio', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000)],
      movements: [mov('INCOME', 4000, new Date(2026, 10, 4), { account_id: 'd1', is_adjustment: true })],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 4000, balance: 104000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 19: movimiento con fecha anterior a opening_date -> ignorado', () => {
    const res = calculateMonthBalance({
      month: M,
      accounts: [acc('d1', 'debit', 100000, { opening_date: new Date(2026, 10, 10) })],
      movements: [
        mov('EXPENSE', 25000, new Date(2026, 10, 5), { account_id: 'd1', distribution_category_id: 'b-needs' }),
        mov('INCOME', 5000, new Date(2026, 10, 10), { account_id: 'd1' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 5000, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 105000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 20: mes anterior a balance_since -> compras con tarjeta sin flujos; pagos de tarjeta como salio', () => {
    const res = calculateMonthBalance({
      month: new Date(2026, 9, 15), // 2026-10 < 2026-11
      accounts: [acc('d1', 'debit', 100000), acc('c1', 'credit', 0)],
      movements: [
        mov('EXPENSE', 20000, new Date(2026, 9, 4), { account_id: 'c1', distribution_category_id: 'b-needs' }),
        mov('TRANSFER', 15000, new Date(2026, 9, 10), { account_id: 'd1', to_account_id: 'c1' }),
      ],
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 0, salio: 15000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 85000, savingsNet: 0 });
    assertInvariants(res);
  });

  it('case 21: cuenta de débito creada en M+2 con saldo 500 -> ajuste +500 en M+2, M+1 sin cambios', () => {
    const accounts = [
      acc('d1', 'debit', 100000, { opening_date: new Date(2026, 10, 1) }),
      acc('d2', 'debit', 50000, { opening_date: new Date(2027, 0, 5) }), // M+2 = 2027-01
    ];
    const mPlus1 = calculateMonthBalance({ month: new Date(2026, 11, 15), accounts, movements: [], distributionCategories: BUCKETS, balanceSince: BS });
    const mPlus2 = calculateMonthBalance({ month: new Date(2027, 0, 15), accounts, movements: [], distributionCategories: BUCKETS, balanceSince: BS });

    expect(mPlus1).toMatchObject({ opening: 100000, ajuste: 0, balance: 100000, entro: 0, salio: 0 });
    expect(mPlus2).toMatchObject({ opening: 100000, ajuste: 50000, balance: 150000, entro: 0, salio: 0 });
    assertInvariants(mPlus1);
    assertInvariants(mPlus2);
  });

  it('case 22: cuenta de ahorros creada tarde con saldo 2000 -> sin efecto en Balance ni flujos', () => {
    const accounts = [
      acc('d1', 'debit', 100000, { opening_date: new Date(2026, 10, 1) }),
      acc('v2', 'savings', 200000, { opening_date: new Date(2027, 0, 5) }),
    ];
    const mPlus2 = calculateMonthBalance({ month: new Date(2027, 0, 15), accounts, movements: [], distributionCategories: BUCKETS, balanceSince: BS });
    expect(mPlus2).toMatchObject({ opening: 100000, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 100000, savingsNet: 0 });
    assertInvariants(mPlus2);
  });

  it('case 23: usuario nuevo (registro en M0) consulta M0-1 -> balance 0, entro 0, salio 0', () => {
    const accounts = [
      acc('cash', 'cash', 10000, { opening_date: new Date(2026, 10, 10) }),
      acc('d1', 'debit', 150000, { opening_date: new Date(2026, 10, 10) }),
    ];
    const prev = calculateMonthBalance({ month: new Date(2026, 9, 15), accounts, movements: [], distributionCategories: BUCKETS, balanceSince: BS });
    expect(prev).toMatchObject({ opening: 0, entro: 0, salio: 0, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 0, savingsNet: 0 });
    assertInvariants(prev);
  });

  it('case 24: usuario existente (sin opening_date) consulta 2 meses antes de balance_since -> compras con tarjeta sin flujos, invariante cumplido', () => {
    const accounts = [acc('d1', 'debit', 100000), acc('c1', 'credit', -20000)];
    const movements = [
      mov('INCOME', 30000, new Date(2026, 8, 5), { account_id: 'd1' }), // 2026-09 (M0 - 2)
      mov('EXPENSE', 15000, new Date(2026, 8, 10), { account_id: 'c1', distribution_category_id: 'b-needs' }), // card purchase -> previous debt
      mov('EXPENSE', 10000, new Date(2026, 8, 12), { account_id: 'd1', distribution_category_id: 'b-needs' }),
    ];
    const res = calculateMonthBalance({
      month: new Date(2026, 8, 15), // 2026-09
      accounts,
      movements,
      distributionCategories: BUCKETS,
      balanceSince: BS,
    });
    expect(res).toMatchObject({ opening: 100000, entro: 30000, salio: 10000, ahorraste: 0, sacaste: 0, ajuste: 0, balance: 120000, savingsNet: 0 });
    assertInvariants(res);
  });
});

describe('calculateMonthBalance — property-based invariant (>= 200 seeded sequences)', () => {
  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('satisfies balance === opening + entro - salio - ahorraste + sacaste + ajuste across 250 random multi-month sequences', () => {
    const rand = mulberry32(20261110);
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
    const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

    const months = [
      new Date(2026, 8, 15),  // 2026-09 (before balance_since)
      new Date(2026, 9, 15),  // 2026-10 (M0 = balance_since)
      new Date(2026, 10, 15), // 2026-11 (M0 + 1)
      new Date(2026, 11, 15), // 2026-12 (M0 + 2)
    ];

    for (let trial = 0; trial < 250; trial++) {
      const hasOpeningDates = rand() < 0.5;
      const openM0 = new Date(2026, 9, randInt(1, 5));
      const openLate = new Date(2026, 11, randInt(1, 5));

      const accounts: PaymentAccount[] = [
        acc('d1', 'debit', randInt(0, 200000), hasOpeningDates ? { opening_date: openM0 } : {}),
        acc('cash', 'cash', randInt(0, 50000), hasOpeningDates ? { opening_date: openM0 } : {}),
        acc('v1', 'savings', randInt(0, 200000), hasOpeningDates ? { opening_date: openM0 } : {}),
        acc('c1', 'credit', -randInt(0, 100000), hasOpeningDates ? { opening_date: openM0, credit_limit: 500000 } : { credit_limit: 500000 }),
        acc('c2', 'credit', -randInt(0, 50000), { credit_limit: 300000 }),
        acc('d-late', 'debit', randInt(0, 80000), { opening_date: openLate }),
        acc('arch', 'debit', randInt(0, 50000), { archived: true }),
      ];

      const activeIds = ['d1', 'cash', 'v1', 'c1', 'c2', 'd-late'];
      const movements: Movement[] = [];
      const count = randInt(5, 25);

      for (let i = 0; i < count; i++) {
        const mIdx = randInt(0, months.length - 1);
        const monthBase = months[mIdx];
        const day = randInt(1, 28);
        const date = new Date(monthBase.getFullYear(), monthBase.getMonth(), day, randInt(0, 23), randInt(0, 59));
        const amount = randInt(100, 40000);
        const kindRoll = rand();

        if (kindRoll < 0.25) {
          // INCOME
          const accountId = rand() < 0.1 ? undefined : pick(activeIds);
          const isAdj = rand() < 0.15;
          movements.push(mov('INCOME', amount, date, { account_id: accountId, ...(isAdj ? { is_adjustment: true } : {}) }));
        } else if (kindRoll < 0.65) {
          // EXPENSE
          const accountId = rand() < 0.1 ? undefined : pick(activeIds);
          const isAdj = rand() < 0.1;
          const isLoan = !isAdj && rand() < 0.15;
          const bucketId = isAdj ? undefined : (rand() < 0.2 ? 'b-savings' : 'b-needs');
          movements.push(mov('EXPENSE', amount, date, {
            account_id: accountId,
            ...(isAdj ? { is_adjustment: true } : { distribution_category_id: bucketId }),
            ...(isLoan ? { installment_payment_id: `ip-${trial}-${i}` } : {}),
          }));
        } else {
          // TRANSFER between two distinct active accounts
          const from = pick(activeIds);
          const to = pick(activeIds.filter(id => id !== from));
          movements.push(mov('TRANSFER', amount, date, { account_id: from, to_account_id: to }));
        }
      }

      for (const month of months) {
        const res = calculateMonthBalance({
          month,
          accounts,
          movements,
          distributionCategories: BUCKETS,
          balanceSince: '2026-10',
        });
        assertInvariants(res);
      }
    }
  });
});
