import { DistributionCategory, ExpenseCategory, ExpenseSubcategory } from '../domain/models/types';
import { stableId } from './stableId';
export function defaultCategorySeeds(userId: string, buckets: DistributionCategory[]): { category: Omit<ExpenseCategory, 'created_at' | 'updated_at'>; subcategories: Omit<ExpenseSubcategory, 'created_at' | 'updated_at'>[] }[] {
  const nonSavings = buckets.filter(bucket => !bucket.is_savings).sort((a, b) => b.percentage - a.percentage || a.id.localeCompare(b.id));
  const primary = nonSavings[0]?.id ?? buckets[0]?.id;
  const secondary = nonSavings[1]?.id ?? primary;
  const savings = buckets.find(bucket => bucket.is_savings)?.id;
  const defaults = [
    { bucket: primary, name: 'Alimentación', subs: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'] },
    { bucket: secondary, name: 'Ocio', subs: ['Deporte', 'Cine', 'Fiesta', 'Restaurante'] },
    { bucket: primary, name: 'Transporte', subs: ['Combustible', 'Taxi/Uber', 'Transporte público'] },
    { bucket: savings, name: 'Ahorro', subs: ['Fondo de emergencia', 'Inversiones'] },
  ];
  return defaults.filter(def => Boolean(def.bucket)).map(def => {
    const id = stableId(`seed-category:${userId}:${def.name}`);
    return { category: { id, user_id: userId, name: def.name, distribution_category_id: def.bucket! },
      subcategories: def.subs.map(name => ({ id: stableId(`seed-subcategory:${id}:${name}`), category_id: id, name })),
    };
  });
}
