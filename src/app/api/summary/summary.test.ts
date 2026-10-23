import { GET as getSummaryRoute } from './route';
import { encryptAmount } from '@/lib/crypto';
import { createEntry } from '@/services/entries';
import { upsertBudget, parsePlanInput, setBillPaid } from '@/services/budgets';
import { getSummary } from '@/services/summaries';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, type TestUser } from '@/test/requests';

setupTestDb();

const TODAY = 20261022; // a Thursday

const spend = (u: TestUser, date: number, category: string, amount: number) =>
    createEntry(u.userId, { date, category, amount: encryptAmount(amount), note: '' });

async function plan(u: TestUser, y: number, m: number, body: unknown) {
    const p = parsePlanInput(body);
    if (!p.ok) throw new Error(p.error);
    await upsertBudget(u.userId, y, m, p.data);
}

const PLAN = {
    income: [{ label: 'Salary', category: 'Employment', amount: 5000 }],
    fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 2000, dueDay: 1 }],
};

describe('month summary', () => {
    let alex: TestUser;
    beforeEach(async () => {
        alex = await makeUser('Alex');
        await plan(alex, 2026, 10, PLAN);
        await spend(alex, 20261005, 'Food', 100);
        await spend(alex, 20261020, 'Food', 50);
        await spend(alex, 20261021, 'Transport', 30);
        await spend(alex, 20261028, 'Food', 999);       // entered ahead for later this month: still counts in October
        await spend(alex, 20260910, 'Food', 200);       // Sept 1–22: compared
        await spend(alex, 20260925, 'Food', 500);       // Sept 25: after "this point last month", not compared
    });

    it('totals income, fixed, daily, net and savings rate from the saved plan and the log', async () => {
        const s = await getSummary(alex.userId, 'month', TODAY, TODAY);
        expect(s).toMatchObject({
            label: 'OCT 2026', range: { start: 20261001, end: 20261031 }, timing: 'current',
            income: 5000, fixed: 2000, daily: 1179, net: 1821, savingsRate: 0.364,
        });
        expect(s.bars).toHaveLength(31);
        expect(s.bars[4]).toEqual({ label: '5', start: 20261005, end: 20261005, daily: 100, income: null, fixed: null, budgeted: null });
    });

    it('compares with the same point last month (Sept 1–22), not all of September', async () => {
        const s = await getSummary(alex.userId, 'month', TODAY, TODAY);
        expect(s.compareRange).toEqual({ start: 20260901, end: 20260922 });
        expect(s.byCategory.find(c => c.category === 'Food')).toEqual({ category: 'Food', spent: 1149, prevSpent: 200, change: 949 });
        expect(s.pace).toEqual({ spentSoFar: 1179, prevSameDay: 200 });
    });

    it('a finished month compares whole with whole, and has no pace', async () => {
        const s = await getSummary(alex.userId, 'month', 20260915, TODAY);
        expect(s).toMatchObject({ timing: 'past', compareRange: { start: 20260801, end: 20260831 }, pace: null, daily: 700 });
        expect(s.income).toBe(0); // no saved September plan (October's isn't copied back)
    });

    it('a future month has nothing to compare', async () => {
        const s = await getSummary(alex.userId, 'month', 20261115, TODAY);
        expect(s).toMatchObject({ timing: 'future', compareRange: null, pace: null });
        expect(s.insights).toEqual([]);
    });

    it('builds insights: the change, overdue bills, the pace', async () => {
        const s = await getSummary(alex.userId, 'month', TODAY, TODAY);
        expect(s.insights.map(i => i.text)).toEqual([
            "Rent ($2,000.00) is 21 days overdue. Tick it once it's paid.",
            "You've spent $1,179.00 so far, $979.00 more than this point last month.",
            'Food is up 475% ($949.00) vs last month.',
        ]);

        await setBillPaid(alex.userId, 2026, 10, 'rent', true);
        expect((await getSummary(alex.userId, 'month', TODAY, TODAY)).insights.map(i => i.kind)).toEqual(['pace', 'change']);
    });

    it('category budgets show up in the month view', async () => {
        await plan(alex, 2026, 10, { categoryBudgets: [{ category: 'Food', amount: 1000 }] });
        const s = await getSummary(alex.userId, 'month', TODAY, TODAY);
        expect(s.insights[0]).toMatchObject({ kind: 'budget', text: 'Food is $149.00 over budget with 10 days left.' });
    });
});

describe('week summary', () => {
    it('is spending only: no income, fixed, net or savings rate', async () => {
        const alex = await makeUser('Alex');
        await plan(alex, 2026, 10, PLAN);
        await spend(alex, 20261019, 'Food', 10);   // Monday
        await spend(alex, 20261022, 'Food', 5);    // Thursday (today)
        await spend(alex, 20261013, 'Food', 40);   // last Tuesday: compared (Mon–Thu last week)
        await spend(alex, 20261017, 'Food', 70);   // last Saturday: not compared

        const s = await getSummary(alex.userId, 'week', TODAY, TODAY);
        expect(s).toMatchObject({
            label: 'OCT 19–25 2026', income: null, fixed: null, net: null, savingsRate: null, daily: 15,
            compareRange: { start: 20261012, end: 20261015 }, pace: { spentSoFar: 15, prevSameDay: 40 },
        });
        expect(s.bars.map(b => [b.label, b.daily])).toEqual([['MON', 10], ['TUE', 0], ['WED', 0], ['THU', 5], ['FRI', 0], ['SAT', 0], ['SUN', 0]]);
        expect(s.bars.every(b => b.income === null)).toBe(true);
        expect(s.months).toBeNull();
    });

    it("shows this month's limits against the whole month's spending, not just the week's", async () => {
        const alex = await makeUser('Alex');
        await plan(alex, 2026, 10, { categoryBudgets: [{ category: 'Food', amount: 100 }] });
        await spend(alex, 20261005, 'Food', 90);   // earlier this month
        await spend(alex, 20261020, 'Food', 5);    // this week
        const s = await getSummary(alex.userId, 'week', TODAY, TODAY);
        expect(s.budgets).toMatchObject({ totalLimit: 100, spent: 95, left: 5 });
        expect(s.insights[0].text).toBe('Food has $5.00 of its $100.00 budget left with 10 days left.');
        expect((await getSummary(alex.userId, 'week', 20261008, TODAY)).budgets).toBeNull(); // a past week
    });
});

describe('quarter and year summaries', () => {
    it('add up saved plans by month, with month bars', async () => {
        const alex = await makeUser('Alex');
        await plan(alex, 2026, 10, PLAN);
        await plan(alex, 2026, 11, PLAN);  // December has no saved plan: counts as 0
        await spend(alex, 20261105, 'Shopping', 300);

        const q = await getSummary(alex.userId, 'quarter', TODAY, TODAY);
        expect(q).toMatchObject({ label: 'Q4 2026', income: 10000, fixed: 4000, daily: 300, net: 5700, months: { budgeted: 2, total: 3 }, budgets: null });
        expect(q.bars).toEqual([
            { label: 'OCT', start: 20261001, end: 20261031, daily: 0, income: 5000, fixed: 2000, budgeted: true },
            { label: 'NOV', start: 20261101, end: 20261130, daily: 300, income: 5000, fixed: 2000, budgeted: true },
            { label: 'DEC', start: 20261201, end: 20261231, daily: 0, income: 0, fixed: 0, budgeted: false },
        ]);

        const y = await getSummary(alex.userId, 'year', TODAY, TODAY);
        expect(y).toMatchObject({ label: '2026', income: 10000, compareRange: { start: 20250101, end: 20251022 } });
        expect(y.bars).toHaveLength(12);
    });

    it('no income means no savings rate', async () => {
        const alex = await makeUser('Alex');
        await spend(alex, 20261005, 'Food', 10);
        expect(await getSummary(alex.userId, 'quarter', TODAY, TODAY)).toMatchObject({ income: 0, net: -10, savingsRate: null });
    });
});

describe('GET /api/summary', () => {
    it("checks the session and params, and only uses the user's own data", async () => {
        expect((await getSummaryRoute(req('/api/summary'))).status).toBe(401);
        const alex = await makeUser('Alex');
        const sam = await makeUser('Sam');
        await spend(sam, 20261022, 'Food', 999);

        expect((await getSummaryRoute(req('/api/summary?period=decade', { user: alex }))).status).toBe(400);
        expect((await getSummaryRoute(req('/api/summary?anchor=20261340', { user: alex }))).status).toBe(400);
        const ok = await getSummaryRoute(req('/api/summary?period=year&anchor=20261022', { user: alex }));
        expect(ok.status).toBe(200);
        expect((await ok.json()).daily).toBe(0);
    });
});
