// Read-only views that combine plans and entries: dashboard, annual overview, month totals.
import { decryptAmount } from '@/lib/crypto';
import { todayInt } from '@/lib/format';
import { budgetProgress, suggestLimits, type BudgetProgress, type CategoryLimit } from '@/lib/budgetProgress';
import { billTotals, upcomingBills, type BillTotals } from '@/lib/bills';
import { getBudget, getBudgetForMonth, decryptRows, decryptFixed, decryptLimits } from './budgets';
import { getMonthEntries, getRecentTransactions, toEntry, type Entry } from './entries';

export type CategoryTotal = { category: string; total: number };
export type DailyTotal = { date: number; total: number };
export type Transaction = Entry;

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
    /** Category limits vs this month's daily spending; null when the saved plan has no limits */
    budgets: BudgetProgress | null;
    /** The saved plan's fixed expenses as bills: paid vs left to pay */
    bills: BillTotals;
};

export type MonthIncomeRow = { label: string; amount: number };
export type MonthFixedRow = { label: string; amount: number };
export type MonthVariableRow = { category: string; total: number };
export type MonthData = { income: MonthIncomeRow[]; fixedExpenses: MonthFixedRow[]; variable: MonthVariableRow[] };
export type AnnualData = { months: MonthData[] };

function add(totals: Record<string, number>, key: string | number, amount: number) {
    totals[key] = (totals[key] ?? 0) + amount;
}

function sortedTotals(totals: Record<string, number>): CategoryTotal[] {
    return Object.entries(totals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
}

/** Daily-log spending of a month by category, largest first */
export async function getMonthVariableTotals(userId: string, year: number, month: number): Promise<CategoryTotal[]> {
    const totals: Record<string, number> = {};
    for (const e of await getMonthEntries(userId, year, month)) add(totals, e.category, decryptAmount(e.amount));
    return sortedTotals(totals);
}

/** Everything the dashboard shows for a month. Only a saved plan counts (a copy of last month doesn't). */
export async function getDashboardData(userId: string, year: number, month: number, today = todayInt()): Promise<DashboardData> {
    const [plan, allEntries, recent] = await Promise.all([
        getBudget(userId, year, month),
        getMonthEntries(userId, year, month),
        getRecentTransactions(userId, year, month, 10),
    ]);

    const income = decryptRows(plan?.income);
    const fixedExpenses = decryptFixed(plan?.fixedExpenses);
    const limits = decryptLimits(plan?.categoryBudgets).map(l => ({ category: l.category, amount: l.amount }));
    const totalIncome = income.reduce((s, r) => s + r.amount, 0);

    const catTotals: Record<string, number> = {};
    const fixedTotals: Record<string, number> = {};
    let totalFixed = 0;
    for (const r of fixedExpenses) {
        add(catTotals, r.category, r.amount);
        add(fixedTotals, r.category, r.amount);
        totalFixed += r.amount;
    }

    const variableTotals: Record<string, number> = {};
    const dayTotals: Record<number, number> = {};
    let totalVariable = 0;
    for (const e of allEntries) {
        const amt = decryptAmount(e.amount);
        add(catTotals, e.category, amt);
        add(variableTotals, e.category, amt);
        add(dayTotals, e.date, amt);
        totalVariable += amt;
    }

    const dailyTotals = Object.entries(dayTotals)
        .map(([date, total]) => ({ date: Number(date), total }))
        .sort((a, b) => a.date - b.date);

    return {
        totalIncome, totalFixed, totalVariable,
        expensesByCategory: sortedTotals(catTotals),
        recentTransactions: recent.map(toEntry),
        budgetSaved: plan != null,
        fixedByCategory: sortedTotals(fixedTotals),
        variableByCategory: sortedTotals(variableTotals),
        dailyTotals,
        budgets: limits.length > 0 ? budgetProgress(limits, variableTotals, year, month, today) : null,
        bills: billTotals(fixedExpenses, year, month, today),
    };
}

/** Bills coming up from today, across this month and next (a month without a saved plan uses its copy) */
export async function getUpcomingBills(userId: string, days: number, today = todayInt()) {
    const y = Math.floor(today / 10000), m = Math.floor(today / 100) % 100;
    const next = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
    const months = await Promise.all([{ year: y, month: m }, next].map(async ({ year, month }) => {
        const plan = await getBudgetForMonth(userId, year, month);
        return { year, month, bills: plan?.fixedExpenses ?? [], planSaved: plan?.source === 'saved' };
    }));
    return upcomingBills(months, today, days);
}

/** Suggested limits for a month: average daily-category spending over the 3 months before it */
export async function getSuggestedLimits(userId: string, year: number, month: number): Promise<CategoryLimit[]> {
    const months = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(year, month - 2 - i, 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
    const totals = await Promise.all(months.map(async m => {
        const t: Record<string, number> = {};
        for (const e of await getMonthEntries(userId, m.year, m.month)) add(t, e.category, decryptAmount(e.amount));
        return t;
    }));
    return suggestLimits(totals);
}

/** All 12 months of a year: saved income and fixed rows, and daily-log totals by category */
export async function getAnnualData(userId: string, year: number): Promise<AnnualData> {
    const months = await Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map(async month => {
            const [plan, entries] = await Promise.all([getBudget(userId, year, month), getMonthEntries(userId, year, month)]);
            const varTotals: Record<string, number> = {};
            for (const e of entries) add(varTotals, e.category, decryptAmount(e.amount));
            return {
                income: decryptRows(plan?.income).map(r => ({ label: r.label, amount: r.amount })),
                fixedExpenses: decryptRows(plan?.fixedExpenses).map(r => ({ label: r.label, amount: r.amount })),
                variable: Object.entries(varTotals).map(([category, total]) => ({ category, total })),
            };
        })
    );
    return { months };
}
