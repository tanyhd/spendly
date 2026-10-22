// All transactions: every daily entry, searchable and filterable, newest first, paged by cursor.
import { ObjectId, type Filter } from 'mongodb';
import { decryptAmount } from '@/lib/crypto';
import { parseDateInt } from '@/lib/period';
import { DAILY_CATEGORIES } from '@/common/constants/categories';
import { collections, toObjectId, type EntryDoc } from './db';
import { toEntry, type Entry } from './entries';

export type TransactionFilter = {
    from?: number;
    to?: number;
    categories?: string[];
    q?: string;
};

export type TransactionPage = {
    items: Entry[];
    nextCursor: string | null;
    /** For the whole filter, not just this page */
    total: { count: number; amount: number };
};

const MAX_Q = 100;
export const MAX_LIMIT = 200;
/** Export cap, so one request can't build an unbounded file */
export const MAX_EXPORT = 20000;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Reads ?from&to&category=Food,Transport&q=lunch from a URL */
export function parseFilter(params: URLSearchParams): Parsed<TransactionFilter> {
    const filter: TransactionFilter = {};
    for (const key of ['from', 'to'] as const) {
        const raw = params.get(key);
        if (!raw) continue;
        const day = parseDateInt(raw);
        if (day === null) return { ok: false, error: `${key} must be a date as YYYYMMDD` };
        filter[key] = day;
    }
    if (filter.from && filter.to && filter.from > filter.to) return { ok: false, error: 'from must be on or before to' };

    const cats = params.get('category');
    if (cats) {
        const list = [...new Set(cats.split(',').map(c => c.trim()).filter(Boolean))];
        const known = DAILY_CATEGORIES.map(c => c.id);
        const unknown = list.find(c => !known.includes(c));
        if (unknown) return { ok: false, error: `Unknown category "${unknown}"` };
        if (list.length) filter.categories = list;
    }

    const q = params.get('q')?.trim();
    if (q) {
        if (q.length > MAX_Q) return { ok: false, error: `Search can be at most ${MAX_Q} characters` };
        filter.q = q;
    }
    return { ok: true, value: filter };
}

export function parseLimit(raw: string | null): Parsed<number> {
    if (raw === null) return { ok: true, value: 50 };
    const n = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    return n >= 1 && n <= MAX_LIMIT ? { ok: true, value: n } : { ok: false, error: `limit must be 1–${MAX_LIMIT}` };
}

// The cursor is the (date, _id) of the last item shown, so paging stays right while entries are added or deleted
export function encodeCursor(e: { date: number; _id: ObjectId | string }) {
    return Buffer.from(`${e.date}_${e._id.toString()}`).toString('base64url');
}

export function decodeCursor(raw: string): { date: number; id: ObjectId } | null {
    const m = /^(\d{8})_([0-9a-f]{24})$/.exec(Buffer.from(raw, 'base64url').toString());
    return m ? { date: Number(m[1]), id: new ObjectId(m[2]) } : null;
}

function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toQuery(userId: string, f: TransactionFilter): Filter<EntryDoc> {
    const query: Filter<EntryDoc> = { userId: toObjectId(userId) };
    if (f.from || f.to) query.date = { ...(f.from && { $gte: f.from }), ...(f.to && { $lte: f.to }) };
    if (f.categories) query.category = { $in: f.categories };
    if (f.q) {
        // The note contains the text, or the category name does ("food" finds every Food entry)
        const matchingCats = DAILY_CATEGORIES.map(c => c.id).filter(c => c.toLowerCase().includes(f.q!.toLowerCase()));
        query.$or = [
            { note: { $regex: escapeRegex(f.q), $options: 'i' } },
            ...(matchingCats.length ? [{ category: { $in: matchingCats } }] : []),
        ];
    }
    return query;
}

export async function listTransactions(
    userId: string, filter: TransactionFilter, limit = 50, cursor?: { date: number; id: ObjectId },
): Promise<TransactionPage> {
    const { entries } = await collections();
    const base = toQuery(userId, filter);
    const paged: Filter<EntryDoc> = cursor
        ? { $and: [base, { $or: [{ date: { $lt: cursor.date } }, { date: cursor.date, _id: { $lt: cursor.id } }] }] }
        : base;

    const [docs, amounts] = await Promise.all([
        entries.find(paged).sort({ date: -1, _id: -1 }).limit(limit + 1).toArray(),
        entries.find(base, { projection: { amount: 1 } }).toArray(),
    ]);
    const page = docs.slice(0, limit);
    const amount = Math.round(amounts.reduce((s, e) => s + decryptAmount(e.amount), 0) * 100) / 100;
    return {
        items: page.map(toEntry),
        nextCursor: docs.length > limit ? encodeCursor(page[page.length - 1]) : null,
        total: { count: amounts.length, amount },
    };
}

/** Every matching entry, newest first, for CSV export (capped at MAX_EXPORT) */
export async function exportTransactions(userId: string, filter: TransactionFilter): Promise<Entry[]> {
    const { entries } = await collections();
    const docs = await entries.find(toQuery(userId, filter)).sort({ date: -1, _id: -1 }).limit(MAX_EXPORT).toArray();
    return docs.map(toEntry);
}
