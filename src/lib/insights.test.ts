import { buildInsights, type InsightInput } from './insights';
import { budgetProgress } from './budgetProgress';

const base: InsightInput = { period: 'month', isCurrent: true, budgets: null, byCategory: [], pace: null, bills: null };
const texts = (i: InsightInput) => buildInsights(i).map(x => x.text);

describe('budget insight', () => {
    it('names the category furthest over budget', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }, { category: 'Fun', amount: 50 }], { Food: 440, Fun: 60 }, 2026, 10, 20261022);
        expect(buildInsights({ ...base, budgets })[0]).toEqual({ tone: 'warn', kind: 'budget', text: 'Food is $40.00 over its $400.00 budget.' });
    });

    it('otherwise the one closest to its limit (80%+)', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }, { category: 'Transport', amount: 100 }], { Food: 330, Transport: 90 }, 2026, 10, 20261022);
        expect(texts({ ...base, budgets })).toEqual(['Transport has $10.00 left of its $100.00 budget.']);
    });

    it('says nothing while every category is under 80%', () => {
        const budgets = budgetProgress([{ category: 'Food', amount: 400 }], { Food: 100 }, 2026, 10, 20261022);
        expect(buildInsights({ ...base, budgets })).toEqual([]);
    });
});

describe('category change insight', () => {
    it('needs both $20 and 20%', () => {
        const at = (spent: number, prevSpent: number) => texts({ ...base, byCategory: [{ category: 'Food', spent, prevSpent }] });
        expect(at(120, 100)).toEqual(['Food is up $20.00 (20%) on this point last month.']);
        expect(at(119, 100)).toEqual([]);        // $19
        expect(at(1100, 1000)).toEqual([]);      // $100 but only 10%
        expect(at(70, 100)).toEqual(['Food is down $30.00 (30%) on this point last month.']);
    });

    it('picks the biggest change, good tone when down', () => {
        const r = buildInsights({ ...base, isCurrent: false, byCategory: [
            { category: 'Food', spent: 150, prevSpent: 100 },
            { category: 'Shopping', spent: 20, prevSpent: 200 },
        ] });
        expect(r[0]).toEqual({ tone: 'good', kind: 'change', text: 'Shopping is down $180.00 (90%) on last month.' });
    });

    it('new spending in a category', () => {
        expect(texts({ ...base, period: 'week', byCategory: [{ category: 'Health', spent: 60, prevSpent: 0 }] }))
            .toEqual(['$60.00 on Health, nothing at this point last week.']);
    });

    it('no comparison (a future period) means no change insight', () => {
        expect(buildInsights({ ...base, byCategory: [{ category: 'Food', spent: 500, prevSpent: null }] })).toEqual([]);
    });
});

describe('pace insight', () => {
    it('more, less, or about the same as this point last period', () => {
        expect(texts({ ...base, pace: { spentSoFar: 420, prevSameDay: 500 } })).toEqual(['$420.00 spent so far, $80.00 less than this point last month.']);
        expect(texts({ ...base, pace: { spentSoFar: 600, prevSameDay: 500 } })).toEqual(['$600.00 spent so far, $100.00 more than this point last month.']);
        expect(texts({ ...base, pace: { spentSoFar: 510, prevSameDay: 500 } })).toEqual(['$510.00 spent so far, about the same as this point last month.']);
    });

    it('only for the current period, and only with something to compare', () => {
        expect(buildInsights({ ...base, isCurrent: false, pace: { spentSoFar: 1, prevSameDay: 500 } })).toEqual([]);
        expect(buildInsights({ ...base, pace: { spentSoFar: 100, prevSameDay: 0 } })).toEqual([]);
    });
});

describe('bills insight', () => {
    const bills = { overdueCount: 0, overdueAmount: 0, dueSoonCount: 3, dueSoonAmount: 2459, days: 7 };

    it('bills due soon, or overdue ones first', () => {
        expect(texts({ ...base, bills })).toEqual(['3 bills due in the next 7 days · $2,459.00.']);
        expect(buildInsights({ ...base, bills: { ...bills, overdueCount: 1, overdueAmount: 45 } })[0])
            .toEqual({ tone: 'warn', kind: 'bills', text: '1 bill overdue · $45.00.' });
    });

    it('only for the current period', () => {
        expect(buildInsights({ ...base, isCurrent: false, bills })).toEqual([]);
    });
});

describe('ordering and limit', () => {
    const budgets = budgetProgress([{ category: 'Food', amount: 100 }], { Food: 150 }, 2026, 10, 20261022);
    const everything: InsightInput = {
        ...base, budgets,
        byCategory: [{ category: 'Food', spent: 150, prevSpent: 50 }],
        pace: { spentSoFar: 150, prevSameDay: 50 },
        bills: { overdueCount: 0, overdueAmount: 0, dueSoonCount: 1, dueSoonAmount: 10, days: 7 },
    };

    it('at most 3: budget, change, pace (due-soon bills drop off)', () => {
        expect(buildInsights(everything).map(i => i.kind)).toEqual(['budget', 'change', 'pace']);
    });

    it('overdue bills go before pace', () => {
        const r = buildInsights({ ...everything, bills: { ...everything.bills!, overdueCount: 2, overdueAmount: 90 } });
        expect(r.map(i => i.kind)).toEqual(['budget', 'change', 'bills']);
    });
});
