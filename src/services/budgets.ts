// Monthly plans (the Budget page): planned income and fixed expenses per month.
import { randomUUID } from 'crypto';
import { decryptAmount, encryptAmount } from '@/lib/crypto';
import { INCOME_CATEGORIES, FIXED_CATEGORIES } from '@/common/constants/categories';
import { collections, toObjectId, type PlanDoc, type PlanRowDoc } from './db';

export type BudgetRow = { id: string; label: string; amount: number; category: string };

export type BudgetData = {
    income: BudgetRow[];
    fixedExpenses: BudgetRow[];
    /** 'saved' = this month's own plan; 'copied' = last month's rows offered as a starting point */
    source: 'saved' | 'copied';
    copiedFrom?: { year: number; month: number };
} | null;

/** Fields a saved plan holds; amounts already encrypted */
export type PlanFields = Pick<PlanDoc, 'income' | 'fixedExpenses'>;

/** Rows as the API returns them: decrypted, and every row has an id (older rows get one on read) */
export function decryptRows(rows: PlanRowDoc[] | undefined): BudgetRow[] {
    return Array.isArray(rows)
        ? rows.map(r => ({ id: r.id ?? newRowId(), label: r.label, category: r.category, amount: decryptAmount(r.amount) }))
        : [];
}

export function newRowId() {
    return randomUUID().slice(0, 8);
}

const ROW_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_LABEL = 80;
const MAX_ROWS = 100;

export type PlanInputResult = { ok: true; data: PlanFields } | { ok: false; error: string };

/**
 * Validates a Budget page save and keeps only known fields, so a request can't write
 * anything else into the plan (like another userId). Amounts come back encrypted.
 */
export function parsePlanInput(body: unknown): PlanInputResult {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid budget' };
    const input = body as Record<string, unknown>;

    const sections = [
        { key: 'income', label: 'Income', categories: INCOME_CATEGORIES.map(c => c.id) },
        { key: 'fixedExpenses', label: 'Fixed expenses', categories: FIXED_CATEGORIES.map(c => c.id) },
    ] as const;

    const data: PlanFields = {};
    for (const { key, label, categories } of sections) {
        const rows = input[key];
        if (rows === undefined) continue;
        if (!Array.isArray(rows)) return { ok: false, error: `${label} must be a list` };
        if (rows.length > MAX_ROWS) return { ok: false, error: `${label} can have at most ${MAX_ROWS} rows` };

        const clean: PlanRowDoc[] = [];
        for (const raw of rows) {
            const r = (raw ?? {}) as Record<string, unknown>;
            const name = typeof r.label === 'string' ? r.label.trim() : '';
            const category = typeof r.category === 'string' ? r.category : '';
            const amount = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount ?? ''));
            if (name.length > MAX_LABEL) return { ok: false, error: `${label}: labels can be at most ${MAX_LABEL} characters` };
            if (!(categories as readonly string[]).includes(category)) return { ok: false, error: `${label}: unknown category "${category}"` };
            if (r.amount !== undefined && r.amount !== '' && (!Number.isFinite(amount) || amount < 0)) {
                return { ok: false, error: `${label}: amounts must be 0 or more` };
            }
            clean.push({
                id: typeof r.id === 'string' && ROW_ID.test(r.id) ? r.id : newRowId(),
                label: name,
                category,
                amount: encryptAmount(Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0),
            });
        }
        data[key] = clean;
    }
    return { ok: true, data };
}

export async function getBudget(userId: string, year: number, month: number): Promise<PlanDoc | null> {
    const { plans } = await collections();
    return plans.findOne({ userId: toObjectId(userId), year, month });
}

export async function upsertBudget(userId: string, year: number, month: number, data: PlanFields) {
    const { plans } = await collections();
    await plans.updateOne(
        { userId: toObjectId(userId), year, month },
        { $set: { ...data, updatedAt: new Date() } },
        { upsert: true }
    );
}

/** Saved plans: one month when year/month are given, otherwise all */
export async function countBudgets(userId: string, year?: number, month?: number) {
    const { plans } = await collections();
    const query = year && month ? { userId: toObjectId(userId), year, month } : { userId: toObjectId(userId) };
    return plans.countDocuments(query);
}

/**
 * The month's plan for the Budget page: the saved plan, or last month's rows as a copy
 * (not saved), or null when neither exists (the page then shows its starter template).
 */
export async function getBudgetForMonth(userId: string, year: number, month: number): Promise<BudgetData> {
    const budget = await getBudget(userId, year, month);
    if (budget) {
        return { income: decryptRows(budget.income), fixedExpenses: decryptRows(budget.fixedExpenses), source: 'saved' };
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prev = await getBudget(userId, prevYear, prevMonth);
    if (!prev) return null;

    const income = decryptRows(prev.income);
    const fixedExpenses = decryptRows(prev.fixedExpenses);
    if (income.length === 0 && fixedExpenses.length === 0) return null;

    return { income, fixedExpenses, source: 'copied', copiedFrom: { year: prevYear, month: prevMonth } };
}
