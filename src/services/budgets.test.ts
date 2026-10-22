import { encryptAmount } from '@/lib/crypto';
import { setupTestDb } from '@/test/testDb';
import { makeUser } from '@/test/requests';
import { getBudgetForMonth, upsertBudget, countBudgets } from './budgets';

setupTestDb();

const row = (label: string, category: string, amount: number) => ({ label, category, amount: encryptAmount(amount) });

describe('getBudgetForMonth', () => {
    it('treats an empty saved previous month as no plan (the page shows its starter template)', async () => {
        const { userId } = await makeUser();
        await upsertBudget(userId, 2026, 9, { income: [], fixedExpenses: [] });
        expect(await getBudgetForMonth(userId, 2026, 10)).toBeNull();
    });

    it('a saved month wins over last month, even when it is empty', async () => {
        const { userId } = await makeUser();
        await upsertBudget(userId, 2026, 9, { income: [row('Salary', 'Employment', 5000)], fixedExpenses: [] });
        await upsertBudget(userId, 2026, 10, { income: [], fixedExpenses: [] });
        expect(await getBudgetForMonth(userId, 2026, 10)).toEqual({ income: [], fixedExpenses: [], source: 'saved' });
    });

    it('decrypts amounts in both saved and copied plans', async () => {
        const { userId } = await makeUser();
        await upsertBudget(userId, 2026, 9, { income: [row('Salary', 'Employment', 5000)], fixedExpenses: [row('Rent', 'Housing', 1500.5)] });
        const copied = await getBudgetForMonth(userId, 2026, 10);
        expect(copied?.income[0].amount).toBe(5000);
        expect(copied?.fixedExpenses[0].amount).toBe(1500.5);
    });
});

describe('countBudgets', () => {
    it('counts one month or all months, for that user only', async () => {
        const alex = await makeUser();
        const sam = await makeUser();
        await upsertBudget(alex.userId, 2026, 9, { income: [], fixedExpenses: [] });
        await upsertBudget(alex.userId, 2026, 10, { income: [], fixedExpenses: [] });
        await upsertBudget(sam.userId, 2026, 10, { income: [], fixedExpenses: [] });
        expect(await countBudgets(alex.userId)).toBe(2);
        expect(await countBudgets(alex.userId, 2026, 10)).toBe(1);
        expect(await countBudgets(alex.userId, 2026, 11)).toBe(0);
    });
});
