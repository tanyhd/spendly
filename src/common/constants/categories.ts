/** `color` is a CSS colour (a theme variable), usable in inline styles */
export type Category = { id: string; code: string; color: string };

export const DAILY_CATEGORIES: Category[] = [
    { id: 'Food', code: 'FOO', color: 'var(--c-food)' },
    { id: 'Transport', code: 'TRN', color: 'var(--c-transport)' },
    { id: 'Shopping', code: 'SHP', color: 'var(--c-shopping)' },
    { id: 'Health', code: 'HLT', color: 'var(--c-health)' },
    { id: 'Entertainment', code: 'ENT', color: 'var(--c-ent)' },
    { id: 'Education', code: 'EDU', color: 'var(--c-edu)' },
    { id: 'Utilities', code: 'UTL', color: 'var(--c-util)' },
    { id: 'Others', code: 'OTH', color: 'var(--c-others)' },
];

export const FIXED_CATEGORIES: Category[] = [
    { id: 'Housing', code: 'HSG', color: 'var(--f1)' },
    { id: 'Tax', code: 'TAX', color: 'var(--f2)' },
    { id: 'Insurance', code: 'INS', color: 'var(--f3)' },
    { id: 'Education', code: 'EDU', color: 'var(--f4)' },
    { id: 'Family', code: 'FAM', color: 'var(--f5)' },
    { id: 'Other', code: 'OTH', color: 'var(--f6)' },
];

export const INCOME_CATEGORIES: Category[] = [
    { id: 'Employment', code: 'EMP', color: 'var(--i1)' },
    { id: 'Investment', code: 'INV', color: 'var(--i2)' },
    { id: 'Business', code: 'BIZ', color: 'var(--i3)' },
    { id: 'Other', code: 'OTH', color: 'var(--i4)' },
];

const FALLBACK: Category = { id: 'Others', code: 'OTH', color: 'var(--c-others)' };

function finder(list: Category[]) {
    return (id: string): Category => list.find(c => c.id === id) ?? { ...FALLBACK, id };
}

export const dailyCategory = finder(DAILY_CATEGORIES);
export const fixedCategory = finder(FIXED_CATEGORIES);
export const incomeCategory = finder(INCOME_CATEGORIES);
