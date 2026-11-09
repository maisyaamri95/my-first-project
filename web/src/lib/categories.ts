export type CategoryId = 'makan' | 'dapur' | 'jalan' | 'bil' | 'diri' | 'lain';

export interface Category { id: CategoryId; name: string; short: string }

export const CATEGORIES: Category[] = [
  { id: 'makan', name: 'Makan & minum', short: 'Makan' },
  { id: 'dapur', name: 'Barang dapur', short: 'Dapur' },
  { id: 'jalan', name: 'Pengangkutan', short: 'Kenderaan' },
  { id: 'bil', name: 'Bil & utiliti', short: 'Bil' },
  { id: 'diri', name: 'Peribadi', short: 'Peribadi' },
  { id: 'lain', name: 'Lain-lain', short: 'Lain-lain' },
];

export const CATEGORY: Record<CategoryId, Category> = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<CategoryId, Category>;

export const isCategoryId = (x: unknown): x is CategoryId => typeof x === 'string' && x in CATEGORY;
