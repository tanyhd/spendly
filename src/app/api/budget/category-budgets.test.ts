import { GET as getBudget, PUT as saveBudget } from './[year]/[month]/route';
import { GET as getSuggestions } from './[year]/[month]/suggestions/route';
import { GET as getDashboard } from '../dashboard/[year]/[month]/route';
import { POST as addEntry } from '../daily-log/route';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, ctx, type TestUser } from '@/test/requests';
import { thisMonthParts } from '@/test/dates';

const db = setupTestDb();

const save = (user: TestUser, y: number, m: number, body: unknown) =>
    saveBudget(req(`/api/budget/${y}/${m}`, { method: 'PUT', user, body }), ctx({ year: String(y), month: String(m) }));
const load = async (user: TestUser, y: number, m: number) =>
    (await getBudget(req(`/api/budget/${y}/${m}`, { user }), ctx({ year: String(y), month: String(m) }))).json();
const entry = (user: TestUser, date: number, category: string, amount: number) =>
    addEntry(req('/api/daily-log', { method: 'POST', user, body: { date, category, amount, note: '' } }));
const dashboard = async (user: TestUser, y: number, m: number) =>
    (await getDashboard(req(`/api/dashboard/${y}/${m}`, { user }), ctx({ year: String(y), month: String(m) }))).json();

const LIMITS = { categoryBudgets: [{ category: 'Food', amount: 400 }, { category: 'Transport', amount: 100 }] };

describe('category budgets on the Budget page', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('saves limits encrypted and reads them back with ids', async () => {
        expect((await save(alex, 2026, 10, LIMITS)).status).toBe(200);
        const stored = await db.raw().collection('monthly_plans').findOne({});
        expect(typeof stored?.categoryBudgets[0].amount).toBe('string');

        const back = await load(alex, 2026, 10);
        expect(back.categoryBudgets.map((l: { category: string; amount: number }) => [l.category, l.amount])).toEqual([['Food', 400], ['Transport', 100]]);
        expect(back.categoryBudgets[0].id).toBeTruthy();
    });

    it('copies last month\'s limits forward, like the rest of the plan', async () => {
        await save(alex, 2026, 9, LIMITS);
        const nov = await load(alex, 2026, 10);
        expect(nov.source).toBe('copied');
        expect(nov.categoryBudgets).toHaveLength(2);
    });

    it('saving income or fixed expenses without limits leaves the limits alone', async () => {
        await save(alex, 2026, 10, LIMITS);
        await save(alex, 2026, 10, { income: [{ label: 'Salary', category: 'Employment', amount: 5000 }] });
        expect((await load(alex, 2026, 10)).categoryBudgets).toHaveLength(2);
    });

    it('an empty list removes all limits', async () => {
        await save(alex, 2026, 10, LIMITS);
        await save(alex, 2026, 10, { categoryBudgets: [] });
        expect((await load(alex, 2026, 10)).categoryBudgets).toEqual([]);
    });

    it.each([
        [{ categoryBudgets: [{ category: 'Housing', amount: 1 }] }, 'Category budgets: unknown category "Housing"'],
        [{ categoryBudgets: [{ category: 'Food', amount: 1 }, { category: 'Food', amount: 2 }] }, 'Category budgets: Food has more than one limit'],
        [{ categoryBudgets: [{ category: 'Food', amount: -1 }] }, 'Category budgets: limits must be 0 or more'],
        [{ categoryBudgets: [{ category: 'Food' }] }, 'Category budgets: limits must be 0 or more'],
        [{ categoryBudgets: 'all' }, 'Category budgets must be a list'],
    ])('refuses bad limits (%#)', async (body, message) => {
        const res = await save(alex, 2026, 10, body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(message);
    });
});

describe('left to spend on the dashboard', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('is null until the saved plan has limits', async () => {
        const { year, month, day } = thisMonthParts();
        await save(alex, year, month, { income: [{ label: 'Salary', category: 'Employment', amount: 5000 }] });
        await entry(alex, year * 10000 + month * 100 + day, 'Food', 10);
        expect((await dashboard(alex, year, month)).budgets).toBeNull();
    });

    it('compares this month\'s daily spending with the limits', async () => {
        const { year, month, day } = thisMonthParts();
        const today = year * 10000 + month * 100 + day;
        await save(alex, year, month, LIMITS);
        await entry(alex, today, 'Food', 150);
        await entry(alex, today, 'Transport', 85);
        await entry(alex, today, 'Shopping', 40);

        const b = (await dashboard(alex, year, month)).budgets;
        expect(b).toMatchObject({ totalLimit: 500, spent: 235, left: 265, unbudgetedSpent: 40, timing: 'current' });
        expect(b.byCategory.map((c: { category: string; status: string }) => [c.category, c.status])).toEqual([['Food', 'ok'], ['Transport', 'warning']]);
        expect(b.dailyAllowance).toBeCloseTo(265 / b.daysLeft, 2);
    });

    it('only counts a saved plan: a copy of last month\'s limits is not used', async () => {
        const { year, month } = thisMonthParts();
        const prev = new Date(year, month - 2, 1);
        await save(alex, prev.getFullYear(), prev.getMonth() + 1, LIMITS);
        expect((await dashboard(alex, year, month)).budgets).toBeNull();
    });
});

describe('suggested limits', () => {
    it('averages the 3 months before, ignoring months with no spending, rounded up to $10', async () => {
        const alex = await makeUser('Alex');
        await entry(alex, 20260705, 'Food', 300);  // July
        await entry(alex, 20260910, 'Food', 359);  // September
        await entry(alex, 20260911, 'Transport', 41);
        await entry(alex, 20261001, 'Food', 9999); // October: the month itself is not used
        await entry(alex, 20260601, 'Food', 9999); // June: too early

        const res = await getSuggestions(req('/api/budget/2026/10/suggestions', { user: alex }), ctx({ year: '2026', month: '10' }));
        expect((await res.json()).suggestions).toEqual([
            { category: 'Food', amount: 330 },       // (300 + 359) / 2 = 329.5 → 330 (August had nothing)
            { category: 'Transport', amount: 30 },   // 41 / 2 = 20.5 → 30
        ]);
    });

    it('is 401 without a session and 400 for a bad month', async () => {
        expect((await getSuggestions(req('/api/budget/2026/10/suggestions'), ctx({ year: '2026', month: '10' }))).status).toBe(401);
        const alex = await makeUser('Alex');
        expect((await getSuggestions(req('/api/budget/2026/13/suggestions', { user: alex }), ctx({ year: '2026', month: '13' }))).status).toBe(400);
    });
});
