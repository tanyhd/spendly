// Read-only views that combine plans and entries: dashboard, annual overview, month totals.
import { decryptAmount } from '@/lib/crypto';
import { todayInt } from '@/lib/format';
import { budgetProgress, suggestLimits, type BudgetProgress, type CategoryLimit } from '@/lib/budgetProgress';
import { billTotals, upcomingBills, type BillTotals } from '@/lib/bills';
import { getBudget, getBudgetForMonth, decryptRows, decryptFixed, decryptLimits } from './budgets';
import { getEntriesInRange, getMonthEntries, getRecentTransactions, toEntry, type Entry } from './entries';
import { buckets, periodLabel, periodRange, samePointInPrevious, type DateRange, type Period } from '@/lib/period';
import { buildInsights, type Insight, type InsightInput } from '@/lib/insights';

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

export type SummaryBar = {
    label: string;
    start: number;
    end: number;
    daily: number;
    /** Monthly figures, so only on month bars (quarter and year views); null on day bars */
    income: number | null;
    fixed: number | null;
    /** Month bars: the month has a saved plan (an unbudgeted month draws as an empty bar); null on day bars */
    budgeted: boolean | null;
};

export type SummaryCategory = {
    category: string;
    spent: number;
    /** Same stretch of the previous period; null when there's nothing to compare (a future period) */
    prevSpent: number | null;
    change: number | null;
};

export type Summary = {
    period: Period;
    label: string;
    range: DateRange;
    /** The stretch of the previous period it's compared with (same number of days while still running) */
    compareRange: DateRange | null;
    timing: 'past' | 'current' | 'future';
    /** Income, fixed, net and savings rate are null for a week: income is planned per month */
    income: number | null;
    fixed: number | null;
    daily: number;
    net: number | null;
    savingsRate: number | null;
    /** "1 of 3 months budgeted"; null for a week */
    months: { budgeted: number; total: number } | null;
    bars: SummaryBar[];
    byCategory: SummaryCategory[];
    pace: { spentSoFar: number; prevSameDay: number } | null;
    /** This month's category limits vs this month's spending, for the current week or month; else null */
    budgets: BudgetProgress | null;
    insights: Insight[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function monthsIn(r: DateRange) {
    const out: { year: number; month: number }[] = [];
    for (let y = Math.floor(r.start / 10000), m = Math.floor(r.start / 100) % 100; y * 100 + m <= Math.floor(r.end / 100);) {
        out.push({ year: y, month: m });
        if (++m > 12) { m = 1; y++; }
    }
    return out;
}

/**
 * The dashboard for a week, month, quarter or year. Income and fixed costs come from saved plans
 * only (as on the dashboard); daily spending from the daily log.
 */
export async function getSummary(userId: string, period: Period, anchor: number, today = todayInt()): Promise<Summary> {
    const range = periodRange(period, anchor);
    const timing = today > range.end ? 'past' : today < range.start ? 'future' : 'current';
    const compareRange = samePointInPrevious(period, anchor, today);
    const isWeek = period === 'week';

    const [entries, prevEntries, plans] = await Promise.all([
        getEntriesInRange(userId, range.start, range.end),
        compareRange ? getEntriesInRange(userId, compareRange.start, compareRange.end) : Promise.resolve([]),
        isWeek ? Promise.resolve([]) : Promise.all(monthsIn(range).map(async m => ({ ...m, plan: await getBudget(userId, m.year, m.month) }))),
    ]);

    const spent = entries.map(e => ({ date: e.date, category: e.category, amount: decryptAmount(e.amount) }));
    const sumIn = (s: number, e: number) => r2(spent.filter(x => x.date >= s && x.date <= e).reduce((t, x) => t + x.amount, 0));
    const planTotals = new Map(plans.map(p => [p.year * 100 + p.month, {
        budgeted: p.plan != null,
        income: decryptRows(p.plan?.income).reduce((t, r) => t + r.amount, 0),
        fixed: decryptRows(p.plan?.fixedExpenses).reduce((t, r) => t + r.amount, 0),
    }]));

    const bars: SummaryBar[] = buckets(period, anchor).map(b => {
        const month = b.start !== b.end ? planTotals.get(Math.floor(b.start / 100)) : undefined;
        return {
            ...b,
            daily: sumIn(b.start, b.end),
            income: month ? r2(month.income) : null,
            fixed: month ? r2(month.fixed) : null,
            budgeted: month ? month.budgeted : null,
        };
    });
    const months = isWeek ? null : { budgeted: plans.filter(p => p.plan != null).length, total: plans.length };

    const daily = sumIn(range.start, range.end);
    const income = isWeek ? null : r2([...planTotals.values()].reduce((t, p) => t + p.income, 0));
    const fixed = isWeek ? null : r2([...planTotals.values()].reduce((t, p) => t + p.fixed, 0));
    const net = income === null || fixed === null ? null : r2(income - fixed - daily);
    const savingsRate = net !== null && income ? Math.round((net / income) * 1000) / 1000 : null;

    const now: Record<string, number> = {};
    for (const x of spent) add(now, x.category, x.amount);
    const before: Record<string, number> = {};
    for (const e of prevEntries) add(before, e.category, decryptAmount(e.amount));
    const byCategory: SummaryCategory[] = [...new Set([...Object.keys(now), ...Object.keys(before)])]
        .map(category => {
            const s = r2(now[category] ?? 0);
            const p = compareRange ? r2(before[category] ?? 0) : null;
            return { category, spent: s, prevSpent: p, change: p === null ? null : r2(s - p) };
        })
        .sort((a, b) => b.spent - a.spent || (b.prevSpent ?? 0) - (a.prevSpent ?? 0));

    const prevTotal = r2(Object.values(before).reduce((t, v) => t + v, 0));
    const pace = timing === 'current' && compareRange ? { spentSoFar: daily, prevSameDay: prevTotal } : null;

    // Category limits and bills belong to this month: shown while viewing the current week or month
    // (limits) or any current period (bills). Limits compare with the whole month's spending.
    let budgets: BudgetProgress | null = null;
    let bills: InsightInput['bills'] = null;
    if (timing === 'current') {
        const y = Math.floor(today / 10000), m = Math.floor(today / 100) % 100;
        const withLimits = period === 'week' || period === 'month';
        const [plan, monthTotals, upcoming] = await Promise.all([
            withLimits ? getBudget(userId, y, m) : Promise.resolve(null),
            period === 'week' ? getMonthVariableTotals(userId, y, m) : Promise.resolve(null),
            getUpcomingBills(userId, 7, today),
        ]);
        const limits = decryptLimits(plan?.categoryBudgets).map(l => ({ category: l.category, amount: l.amount }));
        if (limits.length) {
            const monthSpent = monthTotals ? Object.fromEntries(monthTotals.map(c => [c.category, c.total])) : now;
            budgets = budgetProgress(limits, monthSpent, y, m, today);
        }
        const unpaid = upcoming.items.filter(i => !i.paid);
        const soon = unpaid.filter(i => i.status !== 'overdue');
        bills = {
            overdue: unpaid.filter(i => i.status === 'overdue').map(i => ({ label: i.label, amount: i.amount, daysOverdue: i.daysOverdue })),
            dueSoonCount: soon.length,
            dueSoonAmount: r2(soon.reduce((t, i) => t + i.amount, 0)),
            days: 7,
        };
    }

    return {
        period, label: periodLabel(period, anchor), range, compareRange, timing,
        income, fixed, daily, net, savingsRate, months, bars, byCategory, pace, budgets,
        insights: buildInsights({ period, isCurrent: timing === 'current', budgets, byCategory, pace, bills }),
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
