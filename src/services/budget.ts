import { getMonthEntries, getBudget, getRecentTransactions } from './mongodb';
import { decryptAmount } from '@/lib/crypto';

export type CategoryTotal = { category: string; total: number };

/** Shapes as stored in MongoDB (amounts are encrypted strings, or plain numbers in old data) */
export type StoredRow = { label: string; amount: string | number; category: string; recurring?: boolean };
export type StoredEntry = { _id: { toString(): string }; date: number; category: string; amount: string | number; note?: string };
export type BudgetRow = { label: string; amount: number; category: string; recurring?: boolean };
export type BudgetData = {
    income: BudgetRow[];
    fixedExpenses: BudgetRow[];
    /** 'saved' = this month's own plan; 'copied' = last month's rows offered as a starting point */
    source: 'saved' | 'copied';
    copiedFrom?: { year: number; month: number };
} | null;

export type MonthIncomeRow = { label: string; amount: number };
export type MonthFixedRow = { label: string; amount: number };
export type MonthVariableRow = { category: string; total: number };
export type MonthData = {
    income: MonthIncomeRow[];
    fixedExpenses: MonthFixedRow[];
    variable: MonthVariableRow[];
};
export type AnnualData = { months: MonthData[] };

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

export type Transaction = { _id: string; date: number; category: string; note: string; amount: number };

export type DailyTotal = { date: number; total: number };

export type DashboardData = {
    totalIncome: number;
    totalFixed: number;
    totalVariable: number;
    expensesByCategory: CategoryTotal[];
    recentTransactions: Transaction[];
    budgetSaved: boolean;
    fixedByCategory: CategoryTotal[];
    variableByCategory: CategoryTotal[];
    dailyTotals: DailyTotal[];
};

function sortedTotals(totals: Record<string, number>): CategoryTotal[] {
    return Object.entries(totals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
}

export async function getDashboardData(
    userId: string,
    year: number,
    month: number
): Promise<DashboardData> {
    const [rawBudget, allEntries, recentRaw] = await Promise.all([
        getBudget(userId, year, month),
        getMonthEntries(userId, year, month),
        getRecentTransactions(userId, year, month, 10),
    ]);

    const income: BudgetRow[] = rawBudget?.income
        ? rawBudget.income.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
        : [];
    const fixedExpenses: BudgetRow[] = rawBudget?.fixedExpenses
        ? rawBudget.fixedExpenses.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
        : [];

    const totalIncome = income.reduce((s: number, r: BudgetRow) => s + r.amount, 0);

    const catTotals: Record<string, number> = {};
    const fixedTotals: Record<string, number> = {};
    let totalFixed = 0;
    for (const r of fixedExpenses) {
        catTotals[r.category] = (catTotals[r.category] ?? 0) + r.amount;
        fixedTotals[r.category] = (fixedTotals[r.category] ?? 0) + r.amount;
        totalFixed += r.amount;
    }

    const variableTotals: Record<string, number> = {};
    const dayTotals: Record<number, number> = {};
    let totalVariable = 0;
    for (const e of allEntries) {
        const amt = decryptAmount(e.amount);
        catTotals[e.category] = (catTotals[e.category] ?? 0) + amt;
        variableTotals[e.category] = (variableTotals[e.category] ?? 0) + amt;
        dayTotals[e.date] = (dayTotals[e.date] ?? 0) + amt;
        totalVariable += amt;
    }

    const expensesByCategory = sortedTotals(catTotals);
    const dailyTotals = Object.entries(dayTotals)
        .map(([date, total]) => ({ date: Number(date), total }))
        .sort((a, b) => a.date - b.date);

    const recentTransactions = recentRaw.map((e: StoredEntry) => ({
        _id: e._id.toString(),
        date: e.date,
        category: e.category,
        note: e.note ?? '',
        amount: decryptAmount(e.amount),
    }));

    return {
        totalIncome, totalFixed, totalVariable, expensesByCategory, recentTransactions,
        budgetSaved: rawBudget != null,
        fixedByCategory: sortedTotals(fixedTotals),
        variableByCategory: sortedTotals(variableTotals),
        dailyTotals,
    };
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
                ? budget.income.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
                : [],
            fixedExpenses: Array.isArray(budget.fixedExpenses)
                ? budget.fixedExpenses.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
                : [],
            source: 'saved',
        };
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prev = await getBudget(userId, prevYear, prevMonth);

    if (!prev) return null;

    const income: BudgetRow[] = Array.isArray(prev.income)
        ? prev.income.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
        : [];

    const fixedExpenses: BudgetRow[] = Array.isArray(prev.fixedExpenses)
        ? prev.fixedExpenses.map((r: StoredRow) => ({ ...r, amount: decryptAmount(r.amount) }))
        : [];

    if (income.length === 0 && fixedExpenses.length === 0) return null;

    return { income, fixedExpenses, source: 'copied', copiedFrom: { year: prevYear, month: prevMonth } };
}

export async function getAnnualData(userId: string, year: number): Promise<AnnualData> {
    const months = await Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
            const [budget, entries] = await Promise.all([
                getBudget(userId, year, month),
                getMonthEntries(userId, year, month),
            ]);

            const income: MonthIncomeRow[] = budget?.income
                ? budget.income.map((r: StoredRow) => ({ label: r.label, amount: decryptAmount(r.amount) }))
                : [];

            const fixedExpenses: MonthFixedRow[] = budget?.fixedExpenses
                ? budget.fixedExpenses.map((r: StoredRow) => ({ label: r.label, amount: decryptAmount(r.amount) }))
                : [];

            const varTotals: Record<string, number> = {};
            for (const e of entries) {
                varTotals[e.category] = (varTotals[e.category] ?? 0) + decryptAmount(e.amount);
            }
            const variable: MonthVariableRow[] = Object.entries(varTotals)
                .map(([category, total]) => ({ category, total }));

            return { income, fixedExpenses, variable };
        })
    );

    return { months };
}
