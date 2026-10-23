import { GET as list } from './route';
import { GET as exportCsv } from './export/route';
import { encryptAmount } from '@/lib/crypto';
import { createEntry } from '@/services/entries';
import { setupTestDb } from '@/test/testDb';
import { makeUser, req, type TestUser } from '@/test/requests';

setupTestDb();

const add = (user: TestUser, date: number, category: string, amount: number, note = '') =>
    createEntry(user.userId, { date, category, amount: encryptAmount(amount), note });

type Item = { _id: string; date: number; category: string; amount: number; note: string };
type Page = { items: Item[]; nextCursor: string | null; total: { count: number; amount: number }; dayTotals: Record<number, number> };

const get = async (user: TestUser | undefined, query = '') => list(req(`/api/transactions${query}`, { user }));
const page = async (user: TestUser, query = ''): Promise<Page> => (await get(user, query)).json();

describe('GET /api/transactions', () => {
    let alex: TestUser;
    beforeEach(async () => {
        alex = await makeUser('Alex');
        await add(alex, 20260905, 'Food', 12.5, 'Lunch with Sam');
        await add(alex, 20261001, 'Transport', 3, 'bus');
        await add(alex, 20261010, 'Food', 40, 'groceries');
        await add(alex, 20261010, 'Shopping', 80, 'shoes (sale)');
        await add(alex, 20261022, 'Food', 8, 'LUNCH');
    });

    it('lists everything newest first, same-day entries newest added first, with totals', async () => {
        const p = await page(alex);
        expect(p.items.map(i => [i.date, i.note])).toEqual([
            [20261022, 'LUNCH'], [20261010, 'shoes (sale)'], [20261010, 'groceries'], [20261001, 'bus'], [20260905, 'Lunch with Sam'],
        ]);
        expect(p.items[0]).toEqual({ _id: expect.any(String), date: 20261022, category: 'Food', amount: 8, note: 'LUNCH' });
        expect(p.total).toEqual({ count: 5, amount: 143.5 });
        expect(p.nextCursor).toBeNull();
    });

    it('filters combine: date range, categories and search', async () => {
        expect((await page(alex, '?from=20261001&to=20261031')).total.count).toBe(4);
        expect((await page(alex, '?category=Food,Shopping')).total).toEqual({ count: 4, amount: 140.5 });
        expect((await page(alex, '?q=lunch')).items.map(i => i.note)).toEqual(['LUNCH', 'Lunch with Sam']); // case-insensitive
        expect((await page(alex, '?q=lunch&from=20261001')).total.count).toBe(1);
        expect((await page(alex, '?q=lunch&category=Transport')).total.count).toBe(0);
    });

    it('search also matches the category name', async () => {
        expect((await page(alex, '?q=shop')).items.map(i => i.category)).toEqual(['Shopping']);
        expect((await page(alex, '?q=food')).total.count).toBe(3);
    });

    it('treats search text literally, not as a pattern', async () => {
        expect((await page(alex, '?q=' + encodeURIComponent('(sale)'))).total.count).toBe(1);
        expect((await page(alex, '?q=.*')).total.count).toBe(0);
        expect((await page(alex, '?q=' + encodeURIComponent('[a-z]+'))).total.count).toBe(0);
    });

    it('pages by cursor with no gaps or repeats, and totals cover the whole filter', async () => {
        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        do {
            const p: Page = await page(alex, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
            expect(p.total.count).toBe(5);
            seen.push(...p.items.map(i => i._id));
            cursor = p.nextCursor;
            pages++;
        } while (cursor);
        expect(pages).toBe(3);
        expect(new Set(seen).size).toBe(5);
    });

    it('day totals cover the whole day, even when it is split across pages', async () => {
        const p1 = await page(alex, '?limit=2');   // Oct 22, then the first of Oct 10's two entries
        expect(p1.items.map(i => i.date)).toEqual([20261022, 20261010]);
        expect(p1.dayTotals).toEqual({ 20261022: 8, 20261010: 120 });
        expect((await page(alex, '?limit=2&q=shoes')).dayTotals).toEqual({ 20261010: 80 }); // within the filter
    });

    it('paging stays right when an entry is added and one deleted mid-way', async () => {
        const first = await page(alex, '?limit=2');
        await add(alex, 20261030, 'Food', 1, 'new, newest');
        const rest = await page(alex, `?limit=10&cursor=${first.nextCursor}`);
        expect([...first.items, ...rest.items].map(i => i.note)).toEqual(['LUNCH', 'shoes (sale)', 'groceries', 'bus', 'Lunch with Sam']);
    });

    it("never shows another user's entries", async () => {
        const sam = await makeUser('Sam');
        await add(sam, 20261022, 'Food', 999, 'lunch');
        expect((await page(alex, '?q=lunch')).total.amount).toBe(20.5);
        expect((await page(sam)).total).toEqual({ count: 1, amount: 999 });
    });

    it.each([
        ['?from=2026-10-01', 'from must be a date as YYYYMMDD'],
        ['?to=20261332', 'to must be a date as YYYYMMDD'],
        ['?from=20261031&to=20261001', 'from must be on or before to'],
        ['?category=Housing', 'Unknown category "Housing"'],
        ['?limit=0', 'limit must be 1–200'],
        ['?limit=500', 'limit must be 1–200'],
        ['?q=' + 'x'.repeat(101), 'Search can be at most 100 characters'],
        ['?cursor=bm9wZQ', 'Invalid cursor'],
    ])('refuses %s', async (query, message) => {
        const res = await get(alex, query);
        expect(res.status).toBe(400);
        expect((await res.json()).message).toBe(message);
    });

    it('needs a session', async () => {
        expect((await get(undefined)).status).toBe(401);
    });
});

describe('GET /api/transactions/export', () => {
    it('downloads the filtered entries as CSV, safely escaped', async () => {
        const alex = await makeUser('Alex');
        await add(alex, 20261001, 'Food', 12.5, 'lunch, "big" one\nwith Sam');
        await add(alex, 20261002, 'Others', 3, '=1+1');
        await add(alex, 20261003, 'Transport', 9, 'not exported');

        const res = await exportCsv(req('/api/transactions/export?category=Food,Others', { user: alex }));
        expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
        expect(res.headers.get('content-disposition')).toBe('attachment; filename="spendly-expenses-all-time-food-others.csv"');
        const bytes = Buffer.from(await res.arrayBuffer());
        expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte order mark, for Excel
        expect(bytes.subarray(3).toString('utf8')).toBe(
            '"Date","Category","Note","Amount"\r\n' +
            '"2026-10-02","Others","\'=1+1",3.00\r\n' +
            '"2026-10-01","Food","lunch, ""big"" one\nwith Sam",12.50\r\n'
        );
    });

    it('names the file after the filter', async () => {
        const alex = await makeUser('Alex');
        const res = await exportCsv(req('/api/transactions/export?from=20261001&to=20261031&q=Lunch%20Big', { user: alex }));
        expect(res.headers.get('content-disposition')).toBe('attachment; filename="spendly-expenses-20261001-20261031-lunch-big.csv"');
    });

    it('needs a session and checks filters', async () => {
        expect((await exportCsv(req('/api/transactions/export'))).status).toBe(401);
        const alex = await makeUser('Alex');
        expect((await exportCsv(req('/api/transactions/export?category=Nope', { user: alex }))).status).toBe(400);
    });
});
