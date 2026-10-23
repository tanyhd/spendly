import { buildInsights, type InsightInput } from './insights';
import { budgetProgress } from './budgetProgress';

const base: InsightInput = { period: 'month', isCurrent: true, budgets: null, byCategory: [], pace: null, bills: null };
const texts = (i: InsightInput) => buildInsights(i).map(x => x.text);
const noBills = { overdue: [], dueSoonCount: 0, dueSoonAmount: 0, days: 7 };

describe('budget insight', () => {
    it('names the category furthest over budget, with the days left this month', () => {
        // Oct 19 → 13 days left
        const budgets = budgetProgress([{ category: 'Entertainment', amount: 40 }, { category: 'Food', amount: 400 }], { Entertainment: 46.2, Food: 401 }, 2026, 10, 20261019);
        expect(buildInsights({ ...base, budgets })[0]).toEqual({ tone: 'warn', kind: 'budget', text: 'Entertainment is $6.20 over budget with 13 days left.' });
    });

    it('otherwise the one closest to its limit (80%+)', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }, { category: 'Transport', amount: 100 }], { Food: 330, Transport: 90 }, 2026, 10, 20261031);
        expect(texts({ ...base, budgets })).toEqual(['Transport has $10.00 of its $100.00 budget left with 1 day left.']);
    });

    it('a past month has no "days left"', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }], { Food: 450 }, 2026, 9, 20261019);
        expect(texts({ ...base, isCurrent: false, budgets })).toEqual(['Food is $50.00 over budget.']);
    });

    it('says nothing while every category is under 80%', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }], { Food: 100 }, 2026, 10, 20261022);
        expect(buildInsights({ ...base, budgets })).toEqual([]);
    });
});

describe('category change insight', () => {
    it('needs both $20 and 20%', () => {
        const at = (spent: number, prevSpent: number) => texts({ ...base, byCategory: [{ category: 'Food', spent, prevSpent }] });
        expect(at(120, 100)).toEqual(['Food is up 20% ($20.00) vs last month.']);
        expect(at(119, 100)).toEqual([]);        // $19
        expect(at(1100, 1000)).toEqual([]);      // $100 but only 10%
        expect(at(70, 100)).toEqual(['Food is down 30% ($30.00) vs last month.']);
    });

    it('picks the biggest change, good tone when down', () => {
        const r = buildInsights({ ...base, period: 'quarter', isCurrent: false, byCategory: [
            { category: 'Food', spent: 150, prevSpent: 100 },
            { category: 'Shopping', spent: 20, prevSpent: 200 },
        ] });
        expect(r[0]).toEqual({ tone: 'good', kind: 'change', text: 'Shopping is down 90% ($180.00) vs last quarter.' });
    });

    it('new spending in a category', () => {
        expect(texts({ ...base, period: 'week', byCategory: [{ category: 'Health', spent: 60, prevSpent: 0 }, { category: 'Food', spent: 10, prevSpent: 10 }] }))
            .toEqual(['New this week: $60.00 on Health.']);
    });

    it('says nothing when the whole previous period was empty (a new account)', () => {
        expect(buildInsights({ ...base, period: 'year', byCategory: [{ category: 'Shopping', spent: 1243.6, prevSpent: 0 }] })).toEqual([]);
    });

    it('no comparison (a future period) means no change insight', () => {
        expect(buildInsights({ ...base, byCategory: [{ category: 'Food', spent: 500, prevSpent: null }] })).toEqual([]);
    });
});

describe('pace insight', () => {
    it('more, less, or about the same as this point last period', () => {
        expect(texts({ ...base, pace: { spentSoFar: 661.5, prevSameDay: 415.4 } })).toEqual(["You've spent $661.50 so far, $246.10 more than this point last month."]);
        expect(buildInsights({ ...base, period: 'week', pace: { spentSoFar: 64.6, prevSameDay: 80.1 } })[0])
            .toEqual({ tone: 'good', kind: 'pace', text: "You've spent $64.60 so far, $15.50 less than this point last week." });
        expect(texts({ ...base, pace: { spentSoFar: 510, prevSameDay: 500 } })).toEqual(["You've spent $510.00 so far, about the same as this point last month."]);
    });

    it('only for the current period, and only with something to compare', () => {
        expect(buildInsights({ ...base, isCurrent: false, pace: { spentSoFar: 1, prevSameDay: 500 } })).toEqual([]);
        expect(buildInsights({ ...base, pace: { spentSoFar: 100, prevSameDay: 0 } })).toEqual([]);
    });
});

describe('bills insights', () => {
    it('one overdue bill is named', () => {
        expect(texts({ ...base, bills: { ...noBills, overdue: [{ label: 'Taxes', amount: 400, daysOverdue: 4 }] } }))
            .toEqual(["Taxes ($400.00) is 4 days overdue. Tick it once it's paid."]);
        expect(texts({ ...base, bills: { ...noBills, overdue: [{ label: 'Gym', amount: 60, daysOverdue: 1 }] } }))
            .toEqual(["Gym ($60.00) is 1 day overdue. Tick it once it's paid."]);
    });

    it('several overdue bills are counted', () => {
        const overdue = [{ label: 'Taxes', amount: 400, daysOverdue: 4 }, { label: 'Gym', amount: 60, daysOverdue: 1 }];
        expect(texts({ ...base, bills: { ...noBills, overdue } })).toEqual(["2 bills are overdue ($460.00). Tick them once they're paid."]);
    });

    it('bills due soon', () => {
        expect(texts({ ...base, bills: { ...noBills, dueSoonCount: 3, dueSoonAmount: 1066.67 } })).toEqual(['3 bills due in the next 7 days ($1,066.67).']);
    });

    it('only for the current period', () => {
        expect(buildInsights({ ...base, isCurrent: false, bills: { ...noBills, overdue: [{ label: 'Tax', amount: 1, daysOverdue: 1 }] } })).toEqual([]);
    });
});

describe('ordering and limit', () => {
    const budgets = budgetProgress([{ category: 'Food', amount: 100 }], { Food: 150 }, 2026, 10, 20261022);
    const everything: InsightInput = {
        ...base, budgets,
        byCategory: [{ category: 'Food', spent: 150, prevSpent: 50 }],
        pace: { spentSoFar: 150, prevSameDay: 50 },
        bills: { overdue: [{ label: 'Taxes', amount: 400, daysOverdue: 4 }], dueSoonCount: 1, dueSoonAmount: 10, days: 7 },
    };

    it('at most 3, in the wireframe order: budget, overdue, pace', () => {
        expect(buildInsights(everything).map(i => i.kind)).toEqual(['budget', 'bills', 'pace']);
    });

    it('without overdue bills: budget, pace, change', () => {
        expect(buildInsights({ ...everything, bills: { ...everything.bills!, overdue: [] } }).map(i => i.kind)).toEqual(['budget', 'pace', 'change']);
    });

    it('a quarter with no limits: overdue, pace, change', () => {
        expect(buildInsights({ ...everything, period: 'quarter', budgets: null }).map(i => i.kind)).toEqual(['bills', 'pace', 'change']);
    });
});
