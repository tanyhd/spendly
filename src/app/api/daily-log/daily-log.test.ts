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

describe('daily-log input checks', () => {
    let alex: TestUser;
    beforeEach(async () => { alex = await makeUser('Alex'); });

    const post = (body: unknown) => create(req('/api/daily-log', { method: 'POST', user: alex, body }));
    const GOOD = { date: 20261022, category: 'Food', amount: 12.5, note: 'Lunch' };

    it.each([
        [{ ...GOOD, date: '2026-10-22' }, 'date must be a real day as YYYYMMDD'],
        [{ ...GOOD, date: 20261332 }, 'date must be a real day as YYYYMMDD'],
        [{ ...GOOD, date: 20250229 }, 'date must be a real day as YYYYMMDD'],
        [{ ...GOOD, date: undefined }, 'date must be a real day as YYYYMMDD'],
        [{ ...GOOD, category: 'Housing' }, 'Unknown category "Housing"'],
        [{ ...GOOD, category: { $ne: '' } }, 'Unknown category "[object Object]"'],
        [{ ...GOOD, amount: 0 }, 'Amount must be greater than 0'],
        [{ ...GOOD, amount: -5 }, 'Amount must be greater than 0'],
        [{ ...GOOD, amount: 'abc' }, 'Amount must be greater than 0'],
        [{ ...GOOD, amount: 1e9 }, 'Amount is too large'],
        [{ ...GOOD, note: 'x'.repeat(201) }, 'Note can be at most 200 characters'],
        [{ ...GOOD, note: 42 }, 'Note must be text'],
    ])('refuses a bad new entry (%#) and stores nothing', async (body, message) => {
        const res = await post(body);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(message);
        expect(await db.raw().collection('daily_entries').countDocuments()).toBe(0);
    });

    it('accepts a numeric string amount, rounds to cents, trims the note and stores no other fields', async () => {
        const res = await post({ ...GOOD, amount: '12.345', note: '  Lunch  ', userId: 'someone-else', extra: true });
        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({ amount: 12.35, note: 'Lunch' });
        const stored = await db.raw().collection('daily_entries').findOne({});
        expect(Object.keys(stored!).sort()).toEqual(['_id', 'amount', 'category', 'createdAt', 'date', 'note', 'userId']);
        expect(stored?.userId.toString()).toBe(alex.userId);
    });

    it('a missing note is empty', async () => {
        expect(await (await post({ date: 20261022, category: 'Food', amount: 1 })).json()).toMatchObject({ note: '' });
    });

    it('checks edits the same way, and an edit cannot move the date', async () => {
        const e = await (await post(GOOD)).json();
        const put = (body: unknown) => update(req(`/api/daily-log/${e._id}`, { method: 'PUT', user: alex, body }), ctx({ id: e._id }));
        expect((await put({ amount: 0 })).status).toBe(400);
        expect((await put({ category: 'Rent' })).status).toBe(400);
        expect((await put({ note: 'x'.repeat(201) })).status).toBe(400);
        expect((await put({ date: 20200101, note: 'moved?' })).status).toBe(200);
        expect((await week(alex, 20261019))[0]).toMatchObject({ date: 20261022, note: 'moved?', amount: 12.5 });
    });

    it('a bad or unknown entry id is 404, not a server error', async () => {
        for (const id of ['x', 'not-an-object-id', '0123456789abcdef01234567']) {
            expect((await update(req(`/api/daily-log/${id}`, { method: 'PUT', user: alex, body: { note: 'a' } }), ctx({ id }))).status).toBe(404);
            expect((await remove(req(`/api/daily-log/${id}`, { method: 'DELETE', user: alex }), ctx({ id }))).status).toBe(404);
        }
    });

    it("another user's entry is 404 to edit or delete", async () => {
        const e = await (await post(GOOD)).json();
        const sam = await makeUser('Sam');
        expect((await update(req(`/api/daily-log/${e._id}`, { method: 'PUT', user: sam, body: { note: 'a' } }), ctx({ id: e._id }))).status).toBe(404);
        expect((await remove(req(`/api/daily-log/${e._id}`, { method: 'DELETE', user: sam }), ctx({ id: e._id }))).status).toBe(404);
    });

    it('a bad weekStart is 400', async () => {
        expect((await getWeek(req('/api/daily-log?weekStart=abc', { user: alex }))).status).toBe(400);
        expect((await getWeek(req('/api/daily-log?weekStart=20261340', { user: alex }))).status).toBe(400);
    });

    it('month, dashboard and annual routes refuse a bad month or year', async () => {
        const { GET: dash } = await import('../dashboard/[year]/[month]/route');
        const { GET: annual } = await import('../annual-overview/[year]/route');
        expect((await getMonthTotals(req('/api/daily-log/month/2026/13', { user: alex }), ctx({ year: '2026', month: '13' }))).status).toBe(400);
        expect((await dash(req('/api/dashboard/x/1', { user: alex }), ctx({ year: 'x', month: '1' }))).status).toBe(400);
        expect((await annual(req('/api/annual-overview/20', { user: alex }), ctx({ year: '20' }))).status).toBe(400);
    });
});
