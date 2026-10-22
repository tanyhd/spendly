// Plain-sentence insights for the dashboard. Rule-based and pure, so every threshold is testable.
// Wording follows the Tier 1 wireframe.
import { fmt, plural } from './format';
import type { Period } from './period';
import type { BudgetProgress } from './budgetProgress';

export type Insight = { tone: 'good' | 'warn' | 'info'; kind: 'budget' | 'change' | 'pace' | 'bills'; text: string };

export type CategoryChange = { category: string; spent: number; prevSpent: number | null };

export type OverdueBill = { label: string; amount: number; daysOverdue: number };

export type InsightInput = {
    period: Period;
    /** The period contains today */
    isCurrent: boolean;
    /** This month's category limits (week and month views) */
    budgets: BudgetProgress | null;
    byCategory: CategoryChange[];
    pace: { spentSoFar: number; prevSameDay: number } | null;
    bills: { overdue: OverdueBill[]; dueSoonCount: number; dueSoonAmount: number; days: number } | null;
};

export const MAX_INSIGHTS = 3;
/** A category change counts only if it's at least this many dollars… */
export const CHANGE_MIN_DOLLARS = 20;
/** …and at least this share of the previous amount */
export const CHANGE_MIN_PCT = 0.2;
/** Pace within this share of the previous period reads as "about the same" */
export const PACE_SAME_PCT = 0.05;

const money = (n: number) => `$${fmt(Math.abs(n))}`;

function budgetInsight(b: BudgetProgress | null): Insight | null {
    if (!b) return null;
    const left = b.timing === 'current' ? ` with ${plural(b.daysLeft, 'day', 'days')} left` : '';
    const over = b.byCategory.filter(c => c.status === 'over').sort((x, y) => x.left - y.left)[0];
    if (over) {
        return { tone: 'warn', kind: 'budget', text: `${over.category} is ${money(over.left)} over budget${left}.` };
    }
    const near = b.byCategory.filter(c => c.status === 'warning').sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0))[0];
    if (near) {
        return { tone: 'warn', kind: 'budget', text: `${near.category} has ${money(near.left)} of its ${money(near.limit)} budget left${left}.` };
    }
    return null;
}

function changeInsight(cats: CategoryChange[], period: Period): Insight | null {
    const big = cats
        .filter(c => c.prevSpent !== null)
        .map(c => ({ ...c, change: c.spent - c.prevSpent! }))
        .filter(c => Math.abs(c.change) >= CHANGE_MIN_DOLLARS
            && (c.prevSpent === 0 || Math.abs(c.change) / c.prevSpent! >= CHANGE_MIN_PCT))
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))[0];
    if (!big) return null;

    if (big.prevSpent === 0) {
        return { tone: 'info', kind: 'change', text: `New this ${period}: ${money(big.spent)} on ${big.category}.` };
    }
    const pct = Math.round((Math.abs(big.change) / big.prevSpent!) * 100);
    const up = big.change > 0;
    return {
        tone: up ? 'warn' : 'good',
        kind: 'change',
        text: `${big.category} is ${up ? 'up' : 'down'} ${pct}% (${money(big.change)}) vs last ${period}.`,
    };
}

function paceInsight(pace: InsightInput['pace'], period: Period): Insight | null {
    if (!pace || pace.prevSameDay <= 0) return null;
    const diff = pace.spentSoFar - pace.prevSameDay;
    const so = `You've spent ${money(pace.spentSoFar)} so far`;
    if (Math.abs(diff) / pace.prevSameDay < PACE_SAME_PCT) {
        return { tone: 'info', kind: 'pace', text: `${so}, about the same as this point last ${period}.` };
    }
    return diff < 0
        ? { tone: 'good', kind: 'pace', text: `${so}, ${money(diff)} less than this point last ${period}.` }
        : { tone: 'warn', kind: 'pace', text: `${so}, ${money(diff)} more than this point last ${period}.` };
}

function overdueInsight(b: InsightInput['bills']): Insight | null {
    if (!b?.overdue.length) return null;
    if (b.overdue.length === 1) {
        const [o] = b.overdue;
        return {
            tone: 'warn', kind: 'bills',
            text: `${o.label} (${money(o.amount)}) is ${plural(o.daysOverdue, 'day', 'days')} overdue. Tick it once it's paid.`,
        };
    }
    const total = b.overdue.reduce((t, o) => t + o.amount, 0);
    return { tone: 'warn', kind: 'bills', text: `${b.overdue.length} bills are overdue (${money(total)}). Tick them once they're paid.` };
}

function dueSoonInsight(b: InsightInput['bills']): Insight | null {
    if (!b?.dueSoonCount) return null;
    return {
        tone: 'info', kind: 'bills',
        text: `${plural(b.dueSoonCount, 'bill', 'bills')} due in the next ${plural(b.days, 'day', 'days')} (${money(b.dueSoonAmount)}).`,
    };
}

/**
 * At most 3, most important first: budget over/near, overdue bills, spending pace, biggest
 * category change, bills due soon (the wireframe order). Bills and pace only apply to the period that contains today.
 */
export function buildInsights(input: InsightInput): Insight[] {
    const now = input.isCurrent;
    return [
        budgetInsight(input.budgets),
        now ? overdueInsight(input.bills) : null,
        now ? paceInsight(input.pace, input.period) : null,
        changeInsight(input.byCategory, input.period),
        now ? dueSoonInsight(input.bills) : null,
    ].filter((i): i is Insight => i !== null).slice(0, MAX_INSIGHTS);
}
