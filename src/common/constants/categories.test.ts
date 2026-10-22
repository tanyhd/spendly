import {
    DAILY_CATEGORIES, FIXED_CATEGORIES, INCOME_CATEGORIES, dailyCategory, fixedCategory, incomeCategory,
} from './categories';

describe('categories', () => {
    it.each([
        ['daily', DAILY_CATEGORIES],
        ['fixed', FIXED_CATEGORIES],
        ['income', INCOME_CATEGORIES],
    ])('%s categories have unique ids and 3-letter codes, coloured by theme variables', (_name, list) => {
        expect(new Set(list.map(c => c.id)).size).toBe(list.length);
        for (const c of list) {
            expect(c.code).toMatch(/^[A-Z]{3}$/);
            expect(c.color).toMatch(/^var\(--[a-z0-9-]+\)$/);
        }
    });

    it('looks categories up by id', () => {
        expect(dailyCategory('Food').code).toBe('FOO');
        expect(fixedCategory('Housing').code).toBe('HSG');
        expect(incomeCategory('Employment').code).toBe('EMP');
    });

    it('falls back to an "Others" style for unknown ids but keeps the id', () => {
        expect(dailyCategory('Crypto')).toEqual({ id: 'Crypto', code: 'OTH', color: 'var(--c-others)' });
    });
});
