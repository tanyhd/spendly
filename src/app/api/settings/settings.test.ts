import bcrypt from 'bcrypt';
import { GET as getSettings } from './route';
import { PUT as savePreferences } from './preferences/route';
import { PUT as changePassword } from './password/route';
import { GET as previewClear, DELETE as clearData } from './data/route';
import { POST as addEntry } from '../daily-log/route';
import { PUT as saveBudget } from '../budget/[year]/[month]/route';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, ctx, type TestUser } from '@/test/requests';

const db = setupTestDb();

const entry = (user: TestUser, date: number, amount: number) =>
    addEntry(req('/api/daily-log', { method: 'POST', user, body: { date, category: 'Food', amount, note: '' } }));
const budget = (user: TestUser, y: number, m: number) =>
    saveBudget(req(`/api/budget/${y}/${m}`, { method: 'PUT', user, body: { income: [{ label: 'Salary', category: 'Employment', amount: 1 }], fixedExpenses: [] } }), ctx({ year: String(y), month: String(m) }));
const preview = async (user: TestUser, q: string) => (await previewClear(req(`/api/settings/data?${q}`, { user }))).json();
const clear = async (user: TestUser, body: unknown) => (await clearData(req('/api/settings/data', { method: 'DELETE', user, body }))).json();

describe('preferences', () => {
    it('defaults to the dashboard, saves display name and default page, and returns the registered name', async () => {
        const alex = await makeUser('Alex Tan');
        expect(await (await getSettings(req('/api/settings', { user: alex }))).json()).toEqual({ displayName: '', defaultPage: 'dashboard', name: 'Alex Tan' });

        await savePreferences(req('/api/settings/preferences', { method: 'PUT', user: alex, body: { displayName: 'AT', defaultPage: 'daily-log' } }));
        expect(await (await getSettings(req('/api/settings', { user: alex }))).json()).toMatchObject({ displayName: 'AT', defaultPage: 'daily-log' });
    });
});

describe('change password', () => {
    let alex: TestUser;
    beforeEach(async () => {
        alex = await makeUser('Alex');
        await db.raw().collection('users').updateOne({ email: alex.email }, { $set: { password: await bcrypt.hash('oldpass123', 10) } });
    });

    const change = (body: unknown) => changePassword(req('/api/settings/password', { method: 'PUT', user: alex, body }));

    it('changes the password when the current one is right', async () => {
        expect((await change({ currentPassword: 'oldpass123', newPassword: 'newpass123' })).status).toBe(200);
        const user = await db.raw().collection('users').findOne({ email: alex.email });
        expect(await bcrypt.compare('newpass123', user!.password)).toBe(true);
    });

    it.each([
        [{ currentPassword: 'wrongpass1', newPassword: 'newpass123' }, 'Current password is incorrect'],
        [{ currentPassword: 'oldpass123', newPassword: 'short' }, 'New password must be at least 8 characters'],
        [{ currentPassword: '', newPassword: 'newpass123' }, 'Missing fields'],
    ])('refuses bad input (%#)', async (body, message) => {
        const res = await change(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(message);
    });
});

describe('clear data', () => {
    let alex: TestUser;
    beforeEach(async () => {
        alex = await makeUser('Alex');
        await entry(alex, 20261019, 10);   // week Oct 19–25
        await entry(alex, 20261025, 5.5);
        await entry(alex, 20261012, 20);   // earlier week, same month
        await entry(alex, 20260915, 7);    // September
        await budget(alex, 2026, 10);
        await budget(alex, 2026, 9);
    });

    it('previews exactly what each clear would delete, with $ totals', async () => {
        expect(await preview(alex, 'type=week&weekStart=20261019&weekEnd=20261025')).toEqual({ entries: 2, total: 15.5, budgets: 0 });
        expect(await preview(alex, 'type=month&year=2026&month=10')).toEqual({ entries: 3, total: 35.5, budgets: 1 });
        expect(await preview(alex, 'type=all')).toEqual({ entries: 4, total: 42.5, budgets: 2 });
        expect((await previewClear(req('/api/settings/data?type=nope', { user: alex }))).status).toBe(400);
    });

    it('clears a week (entries only) and reports the count', async () => {
        expect(await clear(alex, { type: 'week', weekStart: 20261019, weekEnd: 20261025 })).toMatchObject({ deletedEntries: 2, deletedBudgets: 0 });
        expect(await preview(alex, 'type=all')).toMatchObject({ entries: 2, budgets: 2 });
    });

    it('clears a month: its entries and its budget', async () => {
        expect(await clear(alex, { type: 'month', year: 2026, month: 10 })).toMatchObject({ deletedEntries: 3, deletedBudgets: 1 });
        expect(await preview(alex, 'type=all')).toEqual({ entries: 1, total: 7, budgets: 1 });
    });

    it('clears everything but keeps the account', async () => {
        expect(await clear(alex, { type: 'all' })).toMatchObject({ deletedEntries: 4, deletedBudgets: 2 });
        expect(await db.raw().collection('users').countDocuments({ email: alex.email })).toBe(1);
    });

    it("never touches another user's data", async () => {
        const sam = await makeUser('Sam');
        await entry(sam, 20261019, 99);
        await clear(alex, { type: 'all' });
        expect(await preview(sam, 'type=all')).toEqual({ entries: 1, total: 99, budgets: 0 });
    });
});
