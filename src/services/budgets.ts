// Monthly plans (the Budget page): planned income, fixed expenses and category limits per month.
import { randomUUID } from 'crypto';
import { decryptAmount, encryptAmount } from '@/lib/crypto';
import { INCOME_CATEGORIES, FIXED_CATEGORIES, DAILY_CATEGORIES } from '@/common/constants/categories';
import { collections, toObjectId, type PlanDoc, type PlanRowDoc, type CategoryBudgetDoc } from './db';

export type BudgetRow = { id: string; label: string; amount: number; category: string };

/** A fixed expense is also a bill: it can have a due day and be ticked paid for the month */
export type FixedRow = BudgetRow & { dueDay: number | null; paid: boolean };

/** A monthly spending limit for one daily category */
export type CategoryBudget = { id: string; category: string; amount: number };

export type BudgetData = {
    income: BudgetRow[];
    fixedExpenses: FixedRow[];
    categoryBudgets: CategoryBudget[];
    /** 'saved' = this month's own plan; 'copied' = last month's rows offered as a starting point */
    source: 'saved' | 'copied';
    copiedFrom?: { year: number; month: number };
} | null;

/** Fields a saved plan holds; amounts already encrypted */
export type PlanFields = Pick<PlanDoc, 'income' | 'fixedExpenses' | 'categoryBudgets'>;

/** Rows as the API returns them: decrypted, and every row has an id (older rows get one on read) */
export function decryptRows(rows: PlanRowDoc[] | undefined): BudgetRow[] {
    return Array.isArray(rows)
        ? rows.map(r => ({ id: r.id ?? newRowId(), label: r.label, category: r.category, amount: decryptAmount(r.amount) }))
        : [];
}

export function decryptFixed(rows: PlanRowDoc[] | undefined): FixedRow[] {
    return Array.isArray(rows)
        ? decryptRows(rows).map((row, i) => ({ ...row, dueDay: rows[i].dueDay ?? null, paid: rows[i].paid === true }))
        : [];
}

export function decryptLimits(rows: CategoryBudgetDoc[] | undefined): CategoryBudget[] {
    return Array.isArray(rows)
        ? rows.map(r => ({ id: r.id ?? newRowId(), category: r.category, amount: decryptAmount(r.amount) }))
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
            const row: PlanRowDoc = {
                id: typeof r.id === 'string' && ROW_ID.test(r.id) ? r.id : newRowId(),
                label: name,
                category,
                amount: encryptAmount(Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0),
            };
            // Bill fields: left out = keep what's saved; dueDay null = no due day
            if (key === 'fixedExpenses') {
                if (r.dueDay !== undefined) {
                    if (r.dueDay === null || r.dueDay === '') row.dueDay = null;
                    else if (Number.isInteger(r.dueDay) && (r.dueDay as number) >= 1 && (r.dueDay as number) <= 31) row.dueDay = r.dueDay as number;
                    else return { ok: false, error: 'Fixed expenses: due day must be 1–31' };
                }
                if (r.paid !== undefined) {
                    if (typeof r.paid !== 'boolean') return { ok: false, error: 'Fixed expenses: paid must be true or false' };
                    row.paid = r.paid;
                }
            }
            clean.push(row);
        }
        data[key] = clean;
    }

    // Category limits: daily categories only, one limit each
    if (input.categoryBudgets !== undefined) {
        const rows = input.categoryBudgets;
        if (!Array.isArray(rows)) return { ok: false, error: 'Category budgets must be a list' };
        const allowed = DAILY_CATEGORIES.map(c => c.id);
        const seen = new Set<string>();
        const clean: CategoryBudgetDoc[] = [];
        for (const raw of rows) {
            const r = (raw ?? {}) as Record<string, unknown>;
            const category = typeof r.category === 'string' ? r.category : '';
            const amount = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount ?? ''));
            if (!allowed.includes(category)) return { ok: false, error: `Category budgets: unknown category "${category}"` };
            if (seen.has(category)) return { ok: false, error: `Category budgets: ${category} has more than one limit` };
            if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Category budgets: limits must be 0 or more' };
            seen.add(category);
            clean.push({
                id: typeof r.id === 'string' && ROW_ID.test(r.id) ? r.id : newRowId(),
                category,
                amount: encryptAmount(Math.round(amount * 100) / 100),
            });
        }
        data.categoryBudgets = clean;
    }

    return { ok: true, data };
}

/** A saved plan. Rows saved before ids existed get one here, saved once, so ids never change between reads. */
export async function getBudget(userId: string, year: number, month: number): Promise<PlanDoc | null> {
    const { plans } = await collections();
    const plan = await plans.findOne({ userId: toObjectId(userId), year, month });
    if (!plan) return null;

    const missing = (rows?: { id?: string }[]) => rows?.some(r => !r.id) ?? false;
    if (missing(plan.income) || missing(plan.fixedExpenses) || missing(plan.categoryBudgets)) {
        const withIds = <T extends { id?: string }>(rows?: T[]) => rows?.map(r => (r.id ? r : { ...r, id: newRowId() }));
        const patch = {
            ...(plan.income && { income: withIds(plan.income) }),
            ...(plan.fixedExpenses && { fixedExpenses: withIds(plan.fixedExpenses) }),
            ...(plan.categoryBudgets && { categoryBudgets: withIds(plan.categoryBudgets) }),
        };
        // Only fills ids if the plan hasn't changed since it was read
        await plans.updateOne({ _id: plan._id, updatedAt: plan.updatedAt }, { $set: patch });
        return { ...plan, ...patch };
    }
    return plan;
}

/**
 * Saves the Budget page. A fixed row that leaves out its due day or paid tick keeps the saved
 * one (matched by row id), so saving amounts never un-ticks a bill.
 */
export async function savePlan(userId: string, year: number, month: number, data: PlanFields) {
    if (data.fixedExpenses) {
        // First save of a copied month: due days come from last month; paid ticks never carry over
        const current = await getBudget(userId, year, month);
        const source = current ?? await getBudget(userId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
        const before = new Map(source?.fixedExpenses?.map(r => [r.id, r]) ?? []);
        data = {
            ...data,
            fixedExpenses: data.fixedExpenses.map(r => {
                const b = before.get(r.id);
                return {
                    ...r,
                    ...(r.dueDay === undefined && b?.dueDay != null && { dueDay: b.dueDay }),
                    ...(r.paid === undefined && current && b?.paid !== undefined && { paid: b.paid }),
                };
            }),
        };
    }
    await upsertBudget(userId, year, month, data);
}

export type SetPaidResult = 'ok' | 'no-plan' | 'no-row';

/** Ticks one bill paid or unpaid without saving the whole plan */
export async function setBillPaid(userId: string, year: number, month: number, rowId: string, paid: boolean): Promise<SetPaidResult> {
    const { plans } = await collections();
    const r = await plans.updateOne(
        { userId: toObjectId(userId), year, month, 'fixedExpenses.id': rowId },
        { $set: { 'fixedExpenses.$.paid': paid, updatedAt: new Date() } }
    );
    if (r.matchedCount === 1) return 'ok';
    return (await getBudget(userId, year, month)) ? 'no-row' : 'no-plan';
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
        return {
            income: decryptRows(budget.income),
            fixedExpenses: decryptFixed(budget.fixedExpenses),
            categoryBudgets: decryptLimits(budget.categoryBudgets),
            source: 'saved',
        };
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prev = await getBudget(userId, prevYear, prevMonth);
    if (!prev) return null;

    const income = decryptRows(prev.income);
    // A new month starts with every bill unpaid; due days carry over
    const fixedExpenses = decryptFixed(prev.fixedExpenses).map(r => ({ ...r, paid: false }));
    const categoryBudgets = decryptLimits(prev.categoryBudgets);
    if (income.length === 0 && fixedExpenses.length === 0 && categoryBudgets.length === 0) return null;

    return { income, fixedExpenses, categoryBudgets, source: 'copied', copiedFrom: { year: prevYear, month: prevMonth } };
}
