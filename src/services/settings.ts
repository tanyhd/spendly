// User preferences, and clearing data (Settings → Data management).
import { collections, monthRange, toObjectId, type SettingsDoc } from './db';

export async function getSettings(userId: string): Promise<Partial<SettingsDoc>> {
    const { settings } = await collections();
    return (await settings.findOne({ userId: toObjectId(userId) })) ?? {};
}

export async function upsertSettings(userId: string, patch: Pick<SettingsDoc, 'displayName' | 'defaultPage'>) {
    const { settings } = await collections();
    await settings.updateOne(
        { userId: toObjectId(userId) },
        { $set: { ...patch, updatedAt: new Date() } },
        { upsert: true }
    );
}

export type ClearResult = { deletedEntries: number; deletedBudgets: number };

/** Daily entries for one week; budgets are not touched */
export async function clearWeekData(userId: string, weekStart: number, weekEnd: number): Promise<ClearResult> {
    const { entries } = await collections();
    const r = await entries.deleteMany({ userId: toObjectId(userId), date: { $gte: weekStart, $lte: weekEnd } });
    return { deletedEntries: r.deletedCount, deletedBudgets: 0 };
}

/** Daily entries and the saved plan for one month */
export async function clearMonthData(userId: string, year: number, month: number): Promise<ClearResult> {
    const { entries, plans } = await collections();
    const { start, end } = monthRange(year, month);
    const [e, p] = await Promise.all([
        entries.deleteMany({ userId: toObjectId(userId), date: { $gte: start, $lte: end } }),
        plans.deleteOne({ userId: toObjectId(userId), year, month }),
    ]);
    return { deletedEntries: e.deletedCount, deletedBudgets: p.deletedCount };
}

/** All entries and plans; the account, name and password stay */
export async function clearAllUserData(userId: string): Promise<ClearResult> {
    const { entries, plans } = await collections();
    const [e, p] = await Promise.all([
        entries.deleteMany({ userId: toObjectId(userId) }),
        plans.deleteMany({ userId: toObjectId(userId) }),
    ]);
    return { deletedEntries: e.deletedCount, deletedBudgets: p.deletedCount };
}
