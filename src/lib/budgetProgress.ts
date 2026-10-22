// "Left to spend" for category budgets. Pure, so it can be tested for any day of any month.
import { daysLeftInMonth } from './period';

export type CategoryLimit = { category: string; amount: number };

export type CategoryProgress = {
    category: string;
    limit: number;
    spent: number;
    /** Negative when over budget */
    left: number;
    /** spent ÷ limit (1 = exactly on budget); null for a $0 limit, where a share means nothing */
    pct: number | null;
    status: 'ok' | 'warning' | 'over';
};

export type BudgetProgress = {
    totalLimit: number;
    /** Spending in categories that have a limit */
    spent: number;
    left: number;
    /** Spending in categories without a limit, shown separately rather than hidden */
    unbudgetedSpent: number;
    /** 'current' month: daily allowance applies; 'past': final result; 'future': nothing spent yet */
    timing: 'past' | 'current' | 'future';
    daysLeft: number;
    /** left ÷ days left (today included); 0 once nothing is left; null for past months */
    dailyAllowance: number | null;
    byCategory: CategoryProgress[];
};

/** At or above this share of a limit, a category shows as a warning */
export const WARNING_PCT = 0.8;

const cents = (n: number) => Math.round(n * 100) / 100;

export function budgetProgress(
    limits: CategoryLimit[],
    spentByCategory: Record<string, number>,
    year: number,
    month: number,
    today: number,
): BudgetProgress {
    const monthKey = year * 100 + month;
    const todayKey = Math.floor(today / 100);
    const timing = monthKey < todayKey ? 'past' : monthKey > todayKey ? 'future' : 'current';
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysLeft = timing === 'current' ? daysLeftInMonth(today) : timing === 'future' ? daysInMonth : 0;

    const limited = new Set(limits.map(l => l.category));
    const byCategory: CategoryProgress[] = limits.map(({ category, amount }) => {
        const spent = cents(spentByCategory[category] ?? 0);
        const pct = amount > 0 ? spent / amount : null;
        const status: CategoryProgress['status'] = pct === null
            ? (spent > 0 ? 'over' : 'ok')
            : pct > 1 ? 'over' : pct >= WARNING_PCT ? 'warning' : 'ok';
        return { category, limit: amount, spent, left: cents(amount - spent), pct, status };
    });

    const totalLimit = cents(limits.reduce((s, l) => s + l.amount, 0));
    const spent = cents(byCategory.reduce((s, c) => s + c.spent, 0));
    const left = cents(totalLimit - spent);
    const unbudgetedSpent = cents(
        Object.entries(spentByCategory).filter(([c]) => !limited.has(c)).reduce((s, [, v]) => s + v, 0)
    );

    return {
        totalLimit, spent, left, unbudgetedSpent, timing, daysLeft,
        dailyAllowance: timing === 'past' ? null : cents(Math.max(0, left) / Math.max(1, daysLeft)),
        byCategory,
    };
}

/**
 * Suggested monthly limits: average spending per category over the given months, counting only
 * months that had any spending (so a new user isn't told to budget a third of what they spend),
 * rounded up to the next $10.
 */
export function suggestLimits(months: Record<string, number>[]): CategoryLimit[] {
    const active = months.filter(m => Object.values(m).some(v => v > 0));
    if (active.length === 0) return [];
    const totals: Record<string, number> = {};
    for (const m of active) for (const [c, v] of Object.entries(m)) totals[c] = (totals[c] ?? 0) + v;
    return Object.entries(totals)
        .filter(([, v]) => v > 0)
        .map(([category, v]) => ({ category, amount: Math.ceil(v / active.length / 10) * 10 }))
        .sort((a, b) => b.amount - a.amount);
}
