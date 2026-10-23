// Daily expenses (the Daily Log). Every query is scoped to one user.
import { ObjectId } from 'mongodb';
import { decryptAmount } from '@/lib/crypto';
import { parseDateInt } from '@/lib/period';
import { MAX_AMOUNT } from '@/lib/input';
import { DAILY_CATEGORIES } from '@/common/constants/categories';
import { collections, monthRange, toObjectId, type EntryDoc } from './db';

/** An entry as the API returns it: decrypted, id as string */
export type Entry = { _id: string; date: number; category: string; amount: number; note: string };

export type NewEntry = { date: number; category: string; amount: string; note: string };

export const MAX_NOTE = 200;

type EntryInput = { date: number; category: string; amount: number; note: string };
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Checks a new entry (all fields) or an edit (`partial`: only the fields sent, and no date,
 * since an edit keeps its date). Amount is a number or numeric string, more than 0, rounded to cents.
 */
export function parseEntryInput(body: unknown, partial: true): Parsed<Partial<Omit<EntryInput, 'date'>>>;
export function parseEntryInput(body: unknown, partial?: false): Parsed<EntryInput>;
export function parseEntryInput(body: unknown, partial = false): Parsed<Partial<EntryInput>> {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid entry' };
    const b = body as Record<string, unknown>;
    const out: Partial<EntryInput> = {};

    if (!partial) {
        const date = parseDateInt(b.date);
        if (date === null) return { ok: false, error: 'date must be a real day as YYYYMMDD' };
        out.date = date;
    }
    if (!partial || b.category !== undefined) {
        if (typeof b.category !== 'string' || !DAILY_CATEGORIES.some(c => c.id === b.category)) {
            return { ok: false, error: `Unknown category "${String(b.category ?? '')}"` };
        }
        out.category = b.category;
    }
    if (!partial || b.amount !== undefined) {
        const amount = typeof b.amount === 'number' ? b.amount : typeof b.amount === 'string' ? Number(b.amount) : NaN;
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be greater than 0' };
        if (amount > MAX_AMOUNT) return { ok: false, error: 'Amount is too large' };
        out.amount = Math.round(amount * 100) / 100;
    }
    if (b.note !== undefined && b.note !== null) {
        if (typeof b.note !== 'string') return { ok: false, error: 'Note must be text' };
        const note = b.note.trim();
        if (note.length > MAX_NOTE) return { ok: false, error: `Note can be at most ${MAX_NOTE} characters` };
        out.note = note;
    } else if (!partial) {
        out.note = '';
    }
    return { ok: true, value: out };
}

/** A valid entry id, or null (an id that isn't 24 hex characters can't exist) */
export function parseEntryId(id: string) {
    return ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? id : null;
}

export function toEntry(e: EntryDoc): Entry {
    return { _id: e._id.toString(), date: e.date, category: e.category, amount: decryptAmount(e.amount), note: e.note ?? '' };
}

/** Entries from weekStart to weekEnd (YYYYMMDD, inclusive), oldest first */
export async function getWeekEntries(userId: string, weekStart: number, weekEnd: number): Promise<EntryDoc[]> {
    const { entries } = await collections();
    return entries
        .find({ userId: toObjectId(userId), date: { $gte: weekStart, $lte: weekEnd } })
        .sort({ date: 1, _id: 1 })
        .toArray();
}

/** Entries from start to end (YYYYMMDD, inclusive), any order */
export async function getEntriesInRange(userId: string, start: number, end: number): Promise<EntryDoc[]> {
    const { entries } = await collections();
    return entries.find({ userId: toObjectId(userId), date: { $gte: start, $lte: end } }).toArray();
}

export async function getMonthEntries(userId: string, year: number, month: number): Promise<EntryDoc[]> {
    const { entries } = await collections();
    const { start, end } = monthRange(year, month);
    return entries.find({ userId: toObjectId(userId), date: { $gte: start, $lte: end } }).toArray();
}

/** Newest entries of a month first */
export async function getRecentTransactions(userId: string, year: number, month: number, limit = 10): Promise<EntryDoc[]> {
    const { entries } = await collections();
    const { start, end } = monthRange(year, month);
    return entries
        .find({ userId: toObjectId(userId), date: { $gte: start, $lte: end } })
        .sort({ date: -1, _id: -1 })
        .limit(limit)
        .toArray();
}

/** `data.amount` must already be encrypted */
export async function createEntry(userId: string, data: NewEntry): Promise<EntryDoc> {
    const { entries } = await collections();
    const doc = { userId: toObjectId(userId), ...data, createdAt: new Date() };
    const result = await entries.insertOne(doc as EntryDoc);
    return { ...doc, _id: result.insertedId };
}

/** Only touches the entry if it belongs to the user */
export async function updateEntry(userId: string, id: string, patch: Partial<Pick<EntryDoc, 'category' | 'amount' | 'note'>>) {
    const { entries } = await collections();
    return entries.updateOne({ _id: toObjectId(id), userId: toObjectId(userId) }, { $set: { ...patch, updatedAt: new Date() } });
}

/** Only deletes the entry if it belongs to the user */
export async function deleteEntry(userId: string, id: string) {
    const { entries } = await collections();
    return entries.deleteOne({ _id: toObjectId(id), userId: toObjectId(userId) });
}

/** Encrypted amounts of entries in a date range (all entries when no range); for previews */
export async function getEntryAmounts(userId: string, start?: number, end?: number): Promise<Pick<EntryDoc, 'amount'>[]> {
    const { entries } = await collections();
    const query = start && end
        ? { userId: toObjectId(userId), date: { $gte: start, $lte: end } }
        : { userId: toObjectId(userId) };
    return entries.find(query, { projection: { amount: 1 } }).toArray();
}
