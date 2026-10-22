// Plain-sentence insights for the dashboard. Rule-based and pure, so every threshold is testable.
import { fmt, plural } from './format';
import type { Period } from './period';
import type { BudgetProgress } from './budgetProgress';

export type Insight = { tone: 'good' | 'warn' | 'info'; kind: 'budget' | 'change' | 'pace' | 'bills'; text: string };

export type CategoryChange = { category: string; spent: number; prevSpent: number | null };

export type InsightInput = {
    period: Period;
    /** The period contains today */
    isCurrent: boolean;
    /** Category limits for the month (month view only) */
    budgets: BudgetProgress | null;
    byCategory: CategoryChange[];
    pace: { spentSoFar: number; prevSameDay: number } | null;
    bills: { overdueCount: number; overdueAmount: number; dueSoonCount: number; dueSoonAmount: number; days: number } | null;
};

export const MAX_INSIGHTS = 3;
/** A category change counts only if it's at least this many dollars… */
export const CHANGE_MIN_DOLLARS = 20;
/** …and at least this share of the previous amount */
export const CHANGE_MIN_PCT = 0.2;
/** Pace within this share of the previous period reads as "about the same" */
export const PACE_SAME_PCT = 0.05;

const money = (n: number) => `$${fmt(Math.abs(n))}`;

/** "last month", or "this point last month" while the period is still running */
function previous(period: Period, isCurrent: boolean) {
    return `${isCurrent ? 'this point ' : ''}last ${period}`;
}

function budgetInsight(b: BudgetProgress | null): Insight | null {
    if (!b) return null;
    const over = b.byCategory.filter(c => c.status === 'over').sort((x, y) => x.left - y.left)[0];
    if (over) {
        return { tone: 'warn', kind: 'budget', text: `${over.category} is ${money(over.left)} over its ${money(over.limit)} budget.` };
    }
    const near = b.byCategory.filter(c => c.status === 'warning').sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0))[0];
    if (near) {
        return { tone: 'warn', kind: 'budget', text: `${near.category} has ${money(near.left)} left of its ${money(near.limit)} budget.` };
    }
    return null;
}

function changeInsight(cats: CategoryChange[], period: Period, isCurrent: boolean): Insight | null {
    const big = cats
        .filter(c => c.prevSpent !== null)
        .map(c => ({ ...c, change: c.spent - c.prevSpent! }))
        .filter(c => Math.abs(c.change) >= CHANGE_MIN_DOLLARS
            && (c.prevSpent === 0 || Math.abs(c.change) / c.prevSpent! >= CHANGE_MIN_PCT))
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))[0];
    if (!big) return null;

    const vs = previous(period, isCurrent);
    if (big.prevSpent === 0) {
        return { tone: 'info', kind: 'change', text: `${money(big.spent)} on ${big.category}, nothing at ${vs}.` };
    }
    const pct = Math.round((Math.abs(big.change) / big.prevSpent!) * 100);
    const up = big.change > 0;
    return {
        tone: up ? 'warn' : 'good',
        kind: 'change',
        text: `${big.category} is ${up ? 'up' : 'down'} ${money(big.change)} (${pct}%) on ${vs}.`,
    };
}

function paceInsight(pace: InsightInput['pace'], period: Period): Insight | null {
    if (!pace || pace.prevSameDay <= 0) return null;
    const diff = pace.spentSoFar - pace.prevSameDay;
    const so = `${money(pace.spentSoFar)} spent so far`;
    if (Math.abs(diff) / pace.prevSameDay < PACE_SAME_PCT) {
        return { tone: 'info', kind: 'pace', text: `${so}, about the same as this point last ${period}.` };
    }
    return diff < 0
        ? { tone: 'good', kind: 'pace', text: `${so}, ${money(diff)} less than this point last ${period}.` }
        : { tone: 'warn', kind: 'pace', text: `${so}, ${money(diff)} more than this point last ${period}.` };
}

function billsInsight(b: InsightInput['bills']): Insight | null {
    if (!b) return null;
    if (b.overdueCount > 0) {
        return { tone: 'warn', kind: 'bills', text: `${plural(b.overdueCount, 'bill', 'bills')} overdue · ${money(b.overdueAmount)}.` };
    }
    if (b.dueSoonCount > 0) {
        return {
            tone: 'info', kind: 'bills',
            text: `${plural(b.dueSoonCount, 'bill', 'bills')} due in the next ${plural(b.days, 'day', 'days')} · ${money(b.dueSoonAmount)}.`,
        };
    }
    return null;
}

/**
 * At most 3, most important first: budget over/near, biggest category change, spending pace, bills.
 * Overdue bills jump ahead of the pace line since they need doing something about.
 */
export function buildInsights(input: InsightInput): Insight[] {
    const budget = budgetInsight(input.budgets);
    const change = changeInsight(input.byCategory, input.period, input.isCurrent);
    const pace = input.isCurrent ? paceInsight(input.pace, input.period) : null;
    const bills = input.isCurrent ? billsInsight(input.bills) : null;
    const overdue = bills?.tone === 'warn' ? bills : null;
    const dueSoon = bills?.tone === 'info' ? bills : null;
    return [budget, change, overdue, pace, dueSoon].filter((i): i is Insight => i !== null).slice(0, MAX_INSIGHTS);
}
