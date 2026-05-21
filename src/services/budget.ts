import { getMonthEntries, getBudget } from './mongodb';
import { decryptAmount } from '@/lib/crypto';

export type CategoryTotal = { category: string; total: number };

export type BudgetRow = { label: string; amount: number; category: string; recurring?: boolean };
export type BudgetData = { income: BudgetRow[]; fixedExpenses: BudgetRow[] } | null;

export async function getMonthVariableTotals(
    userId: string,
    year: number,
    month: number
): Promise<CategoryTotal[]> {
    const entries = await getMonthEntries(userId, year, month);

    const totals: Record<string, number> = {};
    for (const e of entries) {
        totals[e.category] = (totals[e.category] ?? 0) + decryptAmount(e.amount);
    }

    return Object.entries(totals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
}

export async function getBudgetForMonth(
    userId: string,
    year: number,
    month: number
): Promise<BudgetData> {
    const budget = await getBudget(userId, year, month);

    if (budget) {
        return {
            income: Array.isArray(budget.income)
                ? budget.income.map((r: any) => ({ ...r, amount: decryptAmount(r.amount) }))
                : [],
            fixedExpenses: Array.isArray(budget.fixedExpenses)
                ? budget.fixedExpenses.map((r: any) => ({ ...r, amount: decryptAmount(r.amount) }))
                : [],
        };
    }

    // Carry forward from previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prev = await getBudget(userId, prevYear, prevMonth);

    if (!prev) return null;

    const income: BudgetRow[] = Array.isArray(prev.income)
        ? prev.income.map((r: any) => ({ ...r, amount: decryptAmount(r.amount) }))
        : [];

    const fixedExpenses: BudgetRow[] = Array.isArray(prev.fixedExpenses)
        ? prev.fixedExpenses.map((r: any) => ({
            ...r,
            amount: r.recurring ? decryptAmount(r.amount) : 0,
          }))
        : [];

    if (income.length === 0 && fixedExpenses.length === 0) return null;

    return { income, fixedExpenses };
}
