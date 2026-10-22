import { ObjectId } from 'mongodb';
import { GET as getBudget, PUT as saveBudget } from './[year]/[month]/route';
import { PATCH as patchBill } from './[year]/[month]/bills/[rowId]/route';
import { GET as getUpcoming } from '../bills/upcoming/route';
import { GET as getDashboard } from '../dashboard/[year]/[month]/route';
import { getUpcomingBills } from '@/services/summaries';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, ctx, type TestUser } from '@/test/requests';
import { thisMonthParts } from '@/test/dates';

const db = setupTestDb();

const save = (user: TestUser, y: number, m: number, body: unknown) =>
    saveBudget(req(`/api/budget/${y}/${m}`, { method: 'PUT', user, body }), ctx({ year: String(y), month: String(m) }));
const load = async (user: TestUser, y: number, m: number) =>
    (await getBudget(req(`/api/budget/${y}/${m}`, { user }), ctx({ year: String(y), month: String(m) }))).json();
const tick = (user: TestUser | undefined, y: number, m: number, rowId: string, body: unknown) =>
    patchBill(req(`/api/budget/${y}/${m}/bills/${rowId}`, { method: 'PATCH', user, body }), ctx({ year: String(y), month: String(m), rowId }));

const BILLS = {
    fixedExpenses: [
        { id: 'rent', label: 'Rent', category: 'Housing', amount: 2200, dueDay: 1 },
        { id: 'phone', label: 'Phone', category: 'Other', amount: 45, dueDay: 15 },
        { id: 'card', label: 'Card', category: 'Insurance', amount: 300, dueDay: 31 },
        { id: 'tax', label: 'Tax', category: 'Tax', amount: 400 },
    ],
};
type Row = { id: string; dueDay: number | null; paid: boolean };
const byId = (rows: Row[]) => Object.fromEntries(rows.map(r => [r.id, r]));

describe('due days and paid ticks on fixed expenses', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('saves due days; rows without one have none and nothing is paid yet', async () => {
        await save(alex, 2026, 10, BILLS);
        const rows = byId((await load(alex, 2026, 10)).fixedExpenses);
        expect(rows.rent).toMatchObject({ dueDay: 1, paid: false });
        expect(rows.tax).toMatchObject({ dueDay: null, paid: false });
    });

    it('ticks one bill paid and unpaid, without touching the others', async () => {
        await save(alex, 2026, 10, BILLS);
        expect((await tick(alex, 2026, 10, 'rent', { paid: true })).status).toBe(200);
        let rows = byId((await load(alex, 2026, 10)).fixedExpenses);
        expect([rows.rent.paid, rows.phone.paid]).toEqual([true, false]);

        await tick(alex, 2026, 10, 'rent', { paid: false });
        rows = byId((await load(alex, 2026, 10)).fixedExpenses);
        expect(rows.rent.paid).toBe(false);
    });

    it('saving the Budget page (which sends no due days or ticks) keeps both', async () => {
        await save(alex, 2026, 10, BILLS);
        await tick(alex, 2026, 10, 'rent', { paid: true });
        // What today's Budget page sends: id, label, category, amount only
        await save(alex, 2026, 10, { fixedExpenses: BILLS.fixedExpenses.map(({ id, label, category }) => ({ id, label, category, amount: 999 })) });
        const rows = byId((await load(alex, 2026, 10)).fixedExpenses);
        expect(rows.rent).toMatchObject({ dueDay: 1, paid: true });
        expect(rows.phone).toMatchObject({ dueDay: 15, paid: false });
    });

    it('a due day of null removes it', async () => {
        await save(alex, 2026, 10, BILLS);
        await save(alex, 2026, 10, { fixedExpenses: [{ id: 'rent', label: 'Rent', category: 'Housing', amount: 2200, dueDay: null }] });
        expect((await load(alex, 2026, 10)).fixedExpenses[0].dueDay).toBeNull();
    });

    it('copying to a new month keeps due days and starts every bill unpaid', async () => {
        await save(alex, 2026, 10, BILLS);
        await tick(alex, 2026, 10, 'rent', { paid: true });
        const nov = await load(alex, 2026, 11);
        expect(nov.source).toBe('copied');
        expect(byId(nov.fixedExpenses).rent).toMatchObject({ dueDay: 1, paid: false });

        // First save of the copy from today's page (no due days sent): due days stay, ticks don't carry over
        await save(alex, 2026, 11, { fixedExpenses: nov.fixedExpenses.map(({ id, label, category, amount }: Row & { label: string; category: string; amount: number }) => ({ id, label, category, amount })) });
        expect(byId((await load(alex, 2026, 11)).fixedExpenses).rent).toMatchObject({ dueDay: 1, paid: false });
    });

    it.each([
        [{ dueDay: 0 }, 'Fixed expenses: due day must be 1–31'],
        [{ dueDay: 32 }, 'Fixed expenses: due day must be 1–31'],
        [{ dueDay: 1.5 }, 'Fixed expenses: due day must be 1–31'],
        [{ dueDay: '5' }, 'Fixed expenses: due day must be 1–31'],
        [{ paid: 'yes' }, 'Fixed expenses: paid must be true or false'],
    ])('refuses bad bill fields %j', async (extra, message) => {
        const res = await save(alex, 2026, 10, { fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: 1, ...extra }] });
        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(message);
    });

    it('income rows never store bill fields', async () => {
        await save(alex, 2026, 10, { income: [{ label: 'Salary', category: 'Employment', amount: 5000, dueDay: 5, paid: true }] });
        const stored = await db.raw().collection('monthly_plans').findOne({});
        expect(stored?.income[0]).not.toHaveProperty('dueDay');
        expect(stored?.income[0]).not.toHaveProperty('paid');
    });
});

describe('PATCH a bill', () => {
    it('needs a session, a real month, a boolean, a saved plan and an existing row', async () => {
        const alex = await makeUser('Alex');
        expect((await tick(undefined, 2026, 10, 'rent', { paid: true })).status).toBe(401);
        expect((await tick(alex, 2026, 13, 'rent', { paid: true })).status).toBe(400);
        await save(alex, 2026, 9, BILLS);
        expect((await tick(alex, 2026, 10, 'rent', { paid: true })).status).toBe(409); // October is only a copy
        await save(alex, 2026, 10, BILLS);
        expect((await tick(alex, 2026, 10, 'rent', { paid: 'yes' })).status).toBe(400);
        expect((await tick(alex, 2026, 10, 'nope', { paid: true })).status).toBe(404);
        expect((await tick(alex, 2026, 10, '$bad', { paid: true })).status).toBe(404);
    });

    it("cannot tick another user's bill", async () => {
        const alex = await makeUser('Alex');
        const sam = await makeUser('Sam');
        await save(alex, 2026, 10, BILLS);
        await save(sam, 2026, 10, BILLS);
        await tick(sam, 2026, 10, 'rent', { paid: true });
        expect(byId((await load(alex, 2026, 10)).fixedExpenses).rent.paid).toBe(false);
    });

    it('rows saved before ids existed get a lasting id, so they can be ticked', async () => {
        const alex = await makeUser('Alex');
        await db.raw().collection('monthly_plans').insertOne({
            userId: new ObjectId(alex.userId), year: 2026, month: 10, income: [],
            fixedExpenses: [{ label: 'Rent', category: 'Housing', amount: 2200 }],
        });
        const id = (await load(alex, 2026, 10)).fixedExpenses[0].id;
        expect((await load(alex, 2026, 10)).fixedExpenses[0].id).toBe(id);
        expect((await tick(alex, 2026, 10, id, { paid: true })).status).toBe(200);
    });
});

describe('upcoming bills', () => {
    it('lists overdue and the next 7 days across into next month, from its copy if not saved', async () => {
        const alex = await makeUser('Alex');
        await save(alex, 2026, 10, BILLS);
        await tick(alex, 2026, 10, 'rent', { paid: true });

        const r = await getUpcomingBills(alex.userId, 7, 20261027);
        expect(r.items.map(i => [i.label, i.dueDate, i.status, i.planSaved])).toEqual([
            ['Phone', 20261015, 'overdue', true],
            ['Card', 20261031, 'upcoming', true],
            ['Rent', 20261101, 'upcoming', false], // November's copy: unpaid again
        ]);
        expect(r.unpaid).toEqual({ count: 3, amount: 2545 });
    });

    it('is empty without any plan', async () => {
        const alex = await makeUser('Alex');
        expect((await getUpcomingBills(alex.userId, 7, 20261027)).items).toEqual([]);
    });

    it('the route checks the session and days', async () => {
        const alex = await makeUser('Alex');
        expect((await getUpcoming(req('/api/bills/upcoming'))).status).toBe(401);
        expect((await getUpcoming(req('/api/bills/upcoming?days=0', { user: alex }))).status).toBe(400);
        expect((await getUpcoming(req('/api/bills/upcoming?days=29', { user: alex }))).status).toBe(400);
        expect((await getUpcoming(req('/api/bills/upcoming?days=x', { user: alex }))).status).toBe(400);
        const ok = await getUpcoming(req('/api/bills/upcoming', { user: alex }));
        expect(ok.status).toBe(200);
        expect((await ok.json()).items).toEqual([]);
    });
});

describe('bills on the dashboard', () => {
    it('totals paid and left to pay for the saved month', async () => {
        const alex = await makeUser('Alex');
        const { year, month } = thisMonthParts();
        await save(alex, year, month, BILLS);
        await tick(alex, year, month, 'rent', { paid: true });
        const res = await getDashboard(req(`/api/dashboard/${year}/${month}`, { user: alex }), ctx({ year: String(year), month: String(month) }));
        expect((await res.json()).bills).toMatchObject({ total: 2945, paid: 2200, leftToPay: 745 });
    });
});
