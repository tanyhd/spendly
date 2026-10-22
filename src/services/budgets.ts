// Monthly plans (the Budget page): planned income and fixed expenses per month.
import { decryptAmount } from '@/lib/crypto';
import { collections, toObjectId, type PlanDoc, type PlanRowDoc } from './db';

export type BudgetRow = { label: string; amount: number; category: string; recurring?: boolean };

export type BudgetData = {
    income: BudgetRow[];
    fixedExpenses: BudgetRow[];
    /** 'saved' = this month's own plan; 'copied' = last month's rows offered as a starting point */
    source: 'saved' | 'copied';
    copiedFrom?: { year: number; month: number };
} | null;

/** Fields a saved plan holds; amounts already encrypted */
export type PlanFields = Pick<PlanDoc, 'income' | 'fixedExpenses'>;

export function decryptRows(rows: PlanRowDoc[] | undefined): BudgetRow[] {
    return Array.isArray(rows) ? rows.map(r => ({ ...r, amount: decryptAmount(r.amount) })) : [];
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
