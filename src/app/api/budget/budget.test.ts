import { GET as getBudget, PUT as saveBudget } from './[year]/[month]/route';
import { GET as getDashboard } from '../dashboard/[year]/[month]/route';
import { GET as getAnnual } from '../annual-overview/[year]/route';
import { POST as addEntry } from '../daily-log/route';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, ctx, type TestUser } from '@/test/requests';

const db = setupTestDb();

const PLAN = {
    income: [{ label: 'Salary', category: 'Employment', amount: 5000 }, { label: 'Dividends', category: 'Investment', amount: 199.5 }],
    fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: 2200 }, { label: 'Taxes', category: 'Tax', amount: 400 }],
};

const save = (user: TestUser, y: number, m: number, body: unknown) =>
    saveBudget(req(`/api/budget/${y}/${m}`, { method: 'PUT', user, body }), ctx({ year: String(y), month: String(m) }));
const load = async (user: TestUser, y: number, m: number) =>
    (await getBudget(req(`/api/budget/${y}/${m}`, { user }), ctx({ year: String(y), month: String(m) }))).json();
const entry = (user: TestUser, date: number, category: string, amount: number) =>
    addEntry(req('/api/daily-log', { method: 'POST', user, body: { date, category, amount, note: '' } }));

describe('monthly budget', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('saves a month with amounts encrypted, and reads it back as "saved"', async () => {
        expect((await save(alex, 2026, 10, PLAN)).status).toBe(200);

        const stored = await db.raw().collection('monthly_plans').findOne({ year: 2026, month: 10 });
        expect(typeof stored?.income[0].amount).toBe('string');
        expect(stored?.income[0].amount).not.toContain('5000');

        const back = await load(alex, 2026, 10);
        expect(back.source).toBe('saved');
        expect(back.income.map((r: { amount: number }) => r.amount)).toEqual([5000, 199.5]);
        expect(back.fixedExpenses[0]).toMatchObject({ label: 'Rent', category: 'Housing', amount: 2200 });
    });

    it('offers last month as a copy when this month is not saved, without saving it', async () => {
        await save(alex, 2026, 10, PLAN);
        const nov = await load(alex, 2026, 11);
        expect(nov.source).toBe('copied');
        expect(nov.copiedFrom).toEqual({ year: 2026, month: 10 });
        expect(nov.income[0].amount).toBe(5000);
        expect(await db.raw().collection('monthly_plans').countDocuments({ month: 11 })).toBe(0);
    });

    it('copies December into January of the next year', async () => {
        await save(alex, 2025, 12, PLAN);
        expect((await load(alex, 2026, 1)).copiedFrom).toEqual({ year: 2025, month: 12 });
    });

    it('returns null (starter template) when neither this nor last month is saved', async () => {
        expect(await load(alex, 2026, 10)).toBeNull();
    });

    it('saving again replaces the month', async () => {
        await save(alex, 2026, 10, PLAN);
        await save(alex, 2026, 10, { income: [{ label: 'Salary', category: 'Employment', amount: 6000 }], fixedExpenses: [] });
        const back = await load(alex, 2026, 10);
        expect(back.income).toHaveLength(1);
        expect(back.income[0].amount).toBe(6000);
        expect(await db.raw().collection('monthly_plans').countDocuments()).toBe(1);
    });

    it("keeps each user's budget separate", async () => {
        const sam = await makeUser('Sam');
        await save(alex, 2026, 10, PLAN);
        expect(await load(sam, 2026, 10)).toBeNull();
    });

    it('is 401 without a session', async () => {
        expect((await getBudget(req('/api/budget/2026/10'), ctx({ year: '2026', month: '10' }))).status).toBe(401);
        expect((await saveBudget(req('/api/budget/2026/10', { method: 'PUT', body: PLAN }), ctx({ year: '2026', month: '10' }))).status).toBe(401);
    });
});

describe('dashboard', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    const dashboard = async (user: TestUser, y: number, m: number) =>
        (await getDashboard(req(`/api/dashboard/${y}/${m}`, { user }), ctx({ year: String(y), month: String(m) }))).json();

    it('adds up income, fixed and daily spending for the month', async () => {
        await save(alex, 2026, 10, PLAN);
        await entry(alex, 20261005, 'Food', 10);
        await entry(alex, 20261005, 'Transport', 5);
        await entry(alex, 20261012, 'Food', 30);
        await entry(alex, 20261101, 'Food', 999); // next month: excluded

        const d = await dashboard(alex, 2026, 10);
        expect(d).toMatchObject({ totalIncome: 5199.5, totalFixed: 2600, totalVariable: 45, budgetSaved: true });
        expect(d.variableByCategory).toEqual([{ category: 'Food', total: 40 }, { category: 'Transport', total: 5 }]);
        expect(d.fixedByCategory).toEqual([{ category: 'Housing', total: 2200 }, { category: 'Tax', total: 400 }]);
        expect(d.dailyTotals).toEqual([{ date: 20261005, total: 15 }, { date: 20261012, total: 30 }]);
        expect(d.recentTransactions.map((t: { amount: number }) => t.amount)).toEqual([30, 5, 10]);
    });

    it('counts only a saved budget: a copy of last month gives $0 income', async () => {
        await save(alex, 2026, 9, PLAN);
        const d = await dashboard(alex, 2026, 10);
        expect(d).toMatchObject({ totalIncome: 0, totalFixed: 0, budgetSaved: false });
    });

    it('shows at most the 10 latest transactions', async () => {
        for (let day = 1; day <= 12; day++) await entry(alex, 20261000 + day, 'Food', day);
        const d = await dashboard(alex, 2026, 10);
        expect(d.recentTransactions).toHaveLength(10);
        expect(d.recentTransactions[0].date).toBe(20261012);
    });
});

describe('annual overview', () => {
    it('returns all 12 months with income, fixed rows and daily totals', async () => {
        const alex = await makeUser('Alex');
        await save(alex, 2026, 3, PLAN);
        await entry(alex, 20260315, 'Food', 20);
        await entry(alex, 20260720, 'Shopping', 50);

        const { months } = await (await getAnnual(req('/api/annual-overview/2026', { user: alex }), ctx({ year: '2026' }))).json();
        expect(months).toHaveLength(12);
        expect(months[2].income).toEqual([{ label: 'Salary', amount: 5000 }, { label: 'Dividends', amount: 199.5 }]);
        expect(months[2].variable).toEqual([{ category: 'Food', total: 20 }]);
        expect(months[6]).toEqual({ income: [], fixedExpenses: [], variable: [{ category: 'Shopping', total: 50 }] });
        expect(months[0]).toEqual({ income: [], fixedExpenses: [], variable: [] });
    });
});

describe('budget save is locked down', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    const status = async (body: unknown) => (await save(alex, 2026, 10, body)).status;
    const message = async (body: unknown) => (await (await save(alex, 2026, 10, body)).json()).message;

    it('keeps only known fields: a request cannot write other fields like userId into the plan', async () => {
        const sam = await makeUser('Sam');
        await save(alex, 2026, 10, {
            ...PLAN,
            userId: sam.userId, year: 1999, isAdmin: true,
            income: [{ label: 'Salary', category: 'Employment', amount: 5000, injected: '$where' }],
        });
        const stored = await db.raw().collection('monthly_plans').findOne({});
        expect(stored?.userId.toString()).toBe(alex.userId);
        expect(stored?.year).toBe(2026);
        expect(stored).not.toHaveProperty('isAdmin');
        expect(Object.keys(stored!.income[0]).sort()).toEqual(['amount', 'category', 'id', 'label']);
    });

    it.each([
        [{ income: 'lots' }, 'Income must be a list'],
        [{ income: [{ label: 'Salary', category: 'Housing', amount: 1 }] }, 'Income: unknown category "Housing"'],
        [{ fixedExpenses: [{ label: 'Rent', category: 'Employment', amount: 1 }] }, 'Fixed expenses: unknown category "Employment"'],
        [{ fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: -5 }] }, 'Fixed expenses: amounts must be 0 or more'],
        [{ fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: 'abc' }] }, 'Fixed expenses: amounts must be 0 or more'],
        [{ income: [{ label: 'x'.repeat(81), category: 'Employment', amount: 1 }] }, 'Income: labels can be at most 80 characters'],
        [{ income: Array.from({ length: 101 }, () => ({ label: 'x', category: 'Employment', amount: 1 })) }, 'Income can have at most 100 rows'],
    ])('refuses bad input (%#) and saves nothing', async (body, msg) => {
        expect(await status(body)).toBe(400);
        expect(await message(body)).toBe(msg);
        expect(await db.raw().collection('monthly_plans').countDocuments()).toBe(0);
    });

    it('refuses a body that is not JSON', async () => {
        const res = await saveBudget(new (await import('next/server')).NextRequest('http://localhost/api/budget/2026/10', {
            method: 'PUT', headers: { cookie: `token=${alex.token}` }, body: 'not json',
        }), ctx({ year: '2026', month: '10' }));
        expect(res.status).toBe(400);
    });

    it('trims labels, rounds amounts to cents and treats an empty amount as 0', async () => {
        await save(alex, 2026, 10, { income: [{ label: '  Salary  ', category: 'Employment', amount: 1234.567 }, { label: 'Bonus', category: 'Employment', amount: '' }] });
        const back = await load(alex, 2026, 10);
        expect(back.income.map((r: { label: string; amount: number }) => [r.label, r.amount])).toEqual([['Salary', 1234.57], ['Bonus', 0]]);
    });

    it.each([['2026', '13'], ['2026', '0'], ['abcd', '10'], ['1850', '1']])('refuses an invalid month %s/%s', async (year, month) => {
        expect((await getBudget(req(`/api/budget/${year}/${month}`, { user: alex }), ctx({ year, month }))).status).toBe(400);
        expect((await saveBudget(req(`/api/budget/${year}/${month}`, { method: 'PUT', user: alex, body: PLAN }), ctx({ year, month }))).status).toBe(400);
    });
});

describe('budget row ids', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('keeps the ids the page sends, and gives rows without one an id', async () => {
        await save(alex, 2026, 10, { fixedExpenses: [{ id: 'rent1', label: 'Rent', category: 'Housing', amount: 2200 }, { label: 'Taxes', category: 'Tax', amount: 400 }] });
        const rows = (await load(alex, 2026, 10)).fixedExpenses;
        expect(rows[0].id).toBe('rent1');
        expect(rows[1].id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
    });

    it('ids stay the same across saves and when a month is copied forward', async () => {
        await save(alex, 2026, 10, { fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: 2200 }] });
        const id = (await load(alex, 2026, 10)).fixedExpenses[0].id;

        const oct = await load(alex, 2026, 10);
        await save(alex, 2026, 10, oct);
        expect((await load(alex, 2026, 10)).fixedExpenses[0].id).toBe(id);
        expect((await load(alex, 2026, 11)).fixedExpenses[0].id).toBe(id); // copy of October
    });

    it('refuses ids with odd characters and replaces them', async () => {
        await save(alex, 2026, 10, { fixedExpenses: [{ id: '{"$gt":""}', label: 'Rent', category: 'Housing', amount: 1 }] });
        expect((await load(alex, 2026, 10)).fixedExpenses[0].id).not.toContain('$');
    });

    it('rows saved before ids existed get one when read', async () => {
        await db.raw().collection('monthly_plans').insertOne({
            userId: new (await import('mongodb')).ObjectId(alex.userId), year: 2026, month: 10,
            income: [{ label: 'Salary', category: 'Employment', amount: 5000 }], fixedExpenses: [],
        });
        expect((await load(alex, 2026, 10)).income[0].id).toBeTruthy();
    });
});
