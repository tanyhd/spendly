// Daily expenses (the Daily Log). Every query is scoped to one user.
import { decryptAmount } from '@/lib/crypto';
import { collections, monthRange, toObjectId, type EntryDoc } from './db';

/** An entry as the API returns it: decrypted, id as string */
export type Entry = { _id: string; date: number; category: string; amount: number; note: string };

export type NewEntry = { date: number; category: string; amount: string; note: string };

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
