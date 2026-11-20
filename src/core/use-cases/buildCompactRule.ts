import type { DistributionCategory, Movement } from '../domain/models/types';
import { formatMoney } from './formatMoney';

export type CompactBucketKind = 'needs' | 'wants' | 'savings';

export interface CompactRuleBucket {
  id: string;
  name: string;
  percentage: number;
  isSavings: boolean;
  kind: CompactBucketKind;
  /** Budget base in cents: Math.round(expectedIncome * percentage / 100). */
  budget: number;
  /** Actual spent (non-savings) or savingsNet (savings; may be negative). */
  spent: number;
  /** Remaining cents = budget - spent (negative if exceeded). */
  remaining: number;
  /** Progress bar percentage clamped to [0, 100] (floor 0 when savingsNet < 0). */
  barPercent: number;
  /** True when non-savings spending exceeds its budget. */
  exceeded: boolean;
  /** True only for the savings bucket when savingsNet < 0. */
  negativeSavings: boolean;
  /** Human-readable neutral Spanish phrase for this bucket. */
  phrase: string;
}

export interface CompactRule {
  expectedIncome: number;
  hasBuckets: boolean;
  buckets: CompactRuleBucket[];
}

function classifyBucket(bucket: DistributionCategory, nonSavingsIndex: number): CompactBucketKind {
  if (bucket.is_savings) return 'savings';
  const normalized = bucket.name.toLowerCase();
  if (normalized.includes('deseo') || normalized.includes('gusto') || normalized.includes('personal')) return 'wants';
  if (normalized.includes('necesidad') || normalized.includes('esencial')) return 'needs';
  return nonSavingsIndex === 0 ? 'needs' : 'wants';
}

function buildBucketPhrase(
  name: string,
  isSavings: boolean,
  budget: number,
  spent: number,
  remaining: number,
  exceeded: boolean,
): string {
  const lowerName = name.trim().toLowerCase();

  if (isSavings) {
    if (spent < 0) return 'Este mes sacaste más de lo que ahorraste';
    if (budget > 0 && spent >= budget) return `Cumpliste tu meta de ${lowerName} con ${formatMoney(spent)}`;
    if (budget > 0) return `Llevas ${formatMoney(spent)} de ${formatMoney(budget)} en ${lowerName}`;
    return `Ahorraste ${formatMoney(spent)} este mes`;
  }

  if (exceeded) {
    return `Te pasaste ${formatMoney(spent - budget)} en ${lowerName}`;
  }
  return `Te quedan ${formatMoney(Math.max(0, remaining))} para ${lowerName}`;
}

/**
 * Pure compact 50/30/20 view for Section 4 of the minimalist Summary (spec 013 FR-010, FR-034).
 *
 * - Base = declared expectedIncome × bucket percentage (never inflates "Entró").
 * - Needs/Wants spent = non-adjustment `EXPENSE` movements in that bucket
 *   (includes credit card purchases on purchase day, expenses paid from savings,
 *   and loan installments assigned to that bucket; excludes transfers & adjustments).
 * - Savings spent = `savingsNet` from `MonthBalance` (may be negative; bar floors at 0).
 */
export function buildCompactRule(
  movements: Movement[],
  buckets: DistributionCategory[],
  expectedIncome: number,
  savingsNet: number,
): CompactRule {
  const activeBuckets = buckets.filter(b => !b.deleted_at);
  if (activeBuckets.length === 0) {
    return { expectedIncome, hasBuckets: false, buckets: [] };
  }

  // Order: non-savings by percentage descending (e.g. 50% Necesidades, 30% Deseos), then savings (20% Ahorro).
  const ordered = [...activeBuckets].sort((a, b) => {
    if (a.is_savings !== b.is_savings) return a.is_savings ? 1 : -1;
    return b.percentage - a.percentage || a.name.localeCompare(b.name);
  });

  const spentByBucket = new Map<string, number>();
  for (const m of movements) {
    if (m.deleted_at) continue;
    if (m.type !== 'EXPENSE') continue;
    if (m.is_adjustment) continue;
    if (!m.distribution_category_id) continue;
    spentByBucket.set(m.distribution_category_id, (spentByBucket.get(m.distribution_category_id) ?? 0) + m.amount);
  }

  let nonSavingsIdx = 0;
  const rows: CompactRuleBucket[] = ordered.map(bucket => {
    const kind = classifyBucket(bucket, nonSavingsIdx);
    if (!bucket.is_savings) nonSavingsIdx += 1;

    const budget = Math.round((expectedIncome * bucket.percentage) / 100);
    const spent = bucket.is_savings ? savingsNet : (spentByBucket.get(bucket.id) ?? 0);
    const remaining = budget - spent;
    const negativeSavings = bucket.is_savings && spent < 0;
    const exceeded = !bucket.is_savings && (budget > 0 ? spent > budget : spent > 0);

    let barPercent: number;
    if (bucket.is_savings) {
      barPercent = spent <= 0 || budget <= 0 ? 0 : Math.min(100, Math.round((spent / budget) * 100));
    } else if (budget <= 0) {
      barPercent = spent > 0 ? 100 : 0;
    } else {
      barPercent = Math.min(100, Math.max(0, Math.round((spent / budget) * 100)));
    }

    return {
      id: bucket.id,
      name: bucket.name,
      percentage: bucket.percentage,
      isSavings: bucket.is_savings,
      kind,
      budget,
      spent,
      remaining,
      barPercent,
      exceeded,
      negativeSavings,
      phrase: buildBucketPhrase(bucket.name, bucket.is_savings, budget, spent, remaining, exceeded),
    };
  });

  return {
    expectedIncome,
    hasBuckets: true,
    buckets: rows,
  };
}
