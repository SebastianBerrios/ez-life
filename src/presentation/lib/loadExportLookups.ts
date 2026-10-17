import { LocalPaymentAccountRepository } from '../../infrastructure/repositories/local/LocalPaymentAccountRepository';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalIncomeSourceRepository } from '../../infrastructure/repositories/local/LocalIncomeSourceRepository';
import type { ExportLookups } from '../../core/use-cases/exportMovements';

/** id -> name tables (accounts, expense categories, income sources) so an export shows names instead of ids. */
export async function loadExportLookups(userId: string): Promise<ExportLookups> {
  const [accounts, categories, sources] = await Promise.all([
    new LocalPaymentAccountRepository().getAll(userId),
    new LocalCategoryRepository().getExpenseCategories(userId),
    new LocalIncomeSourceRepository().getAll(userId),
  ]);
  return {
    accountNames: Object.fromEntries(accounts.map(a => [a.id, a.name])),
    categoryNames: Object.fromEntries([...categories, ...sources].map(x => [x.id, x.name])),
  };
}
