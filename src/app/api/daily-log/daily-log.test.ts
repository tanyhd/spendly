import { GET as getWeek, POST as create } from './route';
import { PUT as update, DELETE as remove } from './[id]/route';
import { GET as getMonthTotals } from './month/[year]/[month]/route';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, ctx, type TestUser } from '@/test/requests';

const db = setupTestDb();

async function add(user: TestUser, date: number, category: string, amount: number, note = '') {
    const res = await create(req('/api/daily-log', { method: 'POST', user, body: { date, category, amount, note } }));
    expect(res.status).toBe(201);
    return res.json();
}

async function week(user: TestUser, weekStart: number) {
    return (await getWeek(req(`/api/daily-log?weekStart=${weekStart}`, { user }))).json();
}

describe('daily log', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    it('adds an entry and stores the amount encrypted, the note as typed', async () => {
        const entry = await add(alex, 20261019, 'Food', 12.5, 'Lunch');
        expect(entry).toMatchObject({ date: 20261019, category: 'Food', amount: 12.5, note: 'Lunch' });

        const stored = await db.raw().collection('daily_entries').findOne({});
        expect(typeof stored?.amount).toBe('string');
        expect(stored?.amount).not.toContain('12.5');
        expect(stored?.note).toBe('Lunch');
    });

    it('returns Monday to Sunday of the requested week, decrypted and in date order', async () => {
        await add(alex, 20261025, 'Food', 3);       // Sunday
        await add(alex, 20261019, 'Transport', 2);  // Monday
        await add(alex, 20261026, 'Food', 99);      // next Monday: excluded
        await add(alex, 20261018, 'Food', 99);      // previous Sunday: excluded
        const list = await week(alex, 20261019);
        expect(list.map((e: { date: number }) => e.date)).toEqual([20261019, 20261025]);
        expect(list[0].amount).toBe(2);
    });

    it('handles a week that crosses into the next month', async () => {
        await add(alex, 20261101, 'Food', 5); // Sunday of the week starting Oct 26
        expect((await week(alex, 20261026)).length).toBe(1);
    });

    it('needs weekStart', async () => {
        expect((await getWeek(req('/api/daily-log', { user: alex }))).status).toBe(400);
    });

    it('edits category, amount and note; the date stays', async () => {
        const e = await add(alex, 20261019, 'Food', 12.5, 'Lunch');
        const res = await update(req(`/api/daily-log/${e._id}`, { method: 'PUT', user: alex, body: { category: 'Transport', amount: 7, note: 'Taxi' } }), ctx({ id: e._id }));
        expect(res.status).toBe(200);
        expect((await week(alex, 20261019))[0]).toMatchObject({ date: 20261019, category: 'Transport', amount: 7, note: 'Taxi' });
    });

    it('deletes an entry', async () => {
        const e = await add(alex, 20261019, 'Food', 12.5);
        await remove(req(`/api/daily-log/${e._id}`, { method: 'DELETE', user: alex }), ctx({ id: e._id }));
        expect(await week(alex, 20261019)).toEqual([]);
    });

    it('sums the month by category, largest first', async () => {
        await add(alex, 20261001, 'Food', 10);
        await add(alex, 20261031, 'Food', 15);
        await add(alex, 20261015, 'Transport', 30);
        await add(alex, 20261101, 'Food', 100); // November: excluded
        const totals = await (await getMonthTotals(req('/api/daily-log/month/2026/10', { user: alex }), ctx({ year: '2026', month: '10' }))).json();
        expect(totals).toEqual([{ category: 'Transport', total: 30 }, { category: 'Food', total: 25 }]);
    });

    describe('privacy between users', () => {
        it("never shows, edits or deletes another user's entries", async () => {
            const sam = await makeUser('Sam');
            const mine = await add(alex, 20261019, 'Food', 12.5, 'Lunch');

            expect(await week(sam, 20261019)).toEqual([]);

            await update(req(`/api/daily-log/${mine._id}`, { method: 'PUT', user: sam, body: { amount: 999 } }), ctx({ id: mine._id }));
            await remove(req(`/api/daily-log/${mine._id}`, { method: 'DELETE', user: sam }), ctx({ id: mine._id }));
            expect((await week(alex, 20261019))[0]).toMatchObject({ amount: 12.5, note: 'Lunch' });
        });
    });

    it('is 401 for every endpoint without a session', async () => {
        expect((await getWeek(req('/api/daily-log?weekStart=20261019'))).status).toBe(401);
        expect((await create(req('/api/daily-log', { method: 'POST', body: {} }))).status).toBe(401);
        expect((await update(req('/api/daily-log/x', { method: 'PUT', body: {} }), ctx({ id: 'x' }))).status).toBe(401);
        expect((await remove(req('/api/daily-log/x', { method: 'DELETE' }), ctx({ id: 'x' }))).status).toBe(401);
        expect((await getMonthTotals(req('/api/daily-log/month/2026/10'), ctx({ year: '2026', month: '10' }))).status).toBe(401);
    });
});
