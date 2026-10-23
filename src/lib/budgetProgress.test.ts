import { budgetProgress, suggestLimits, overText } from './budgetProgress';

const LIMITS = [{ category: 'Food', amount: 400 }, { category: 'Transport', amount: 100 }];

describe('budgetProgress (left to spend)', () => {
    it('totals limits and spending, and splits out spending with no limit', () => {
        const p = budgetProgress(LIMITS, { Food: 150, Transport: 30, Shopping: 75.5 }, 2026, 10, 20261022);
        expect(p).toMatchObject({ totalLimit: 500, spent: 180, left: 320, unbudgetedSpent: 75.5, timing: 'current' });
    });

    it('daily allowance = what is still available ÷ days left, today included', () => {
        // Oct 22 → 10 days left (22..31)
        expect(budgetProgress(LIMITS, { Food: 180 }, 2026, 10, 20261022)).toMatchObject({ daysLeft: 10, dailyAllowance: 32 });
        // First day: the whole month
        expect(budgetProgress(LIMITS, {}, 2026, 10, 20261001)).toMatchObject({ daysLeft: 31, dailyAllowance: 16.13 });
        // Last day: everything still available is for today (Food is over, Transport has 100)
        expect(budgetProgress(LIMITS, { Food: 450 }, 2026, 10, 20261031)).toMatchObject({ daysLeft: 1, left: 50, available: 100, overBy: 50, dailyAllowance: 100 });
    });

    it('overspending one category does not use up another: it shows separately', () => {
        // Food 200 over its 400; Transport untouched with 100 left
        const over = budgetProgress(LIMITS, { Food: 600 }, 2026, 10, 20261022);
        expect(over).toMatchObject({ left: -100, available: 100, overBy: 200, dailyAllowance: 10 });
    });

    it('has no allowance once every category is at or over its limit, and never a negative one', () => {
        const all = budgetProgress(LIMITS, { Food: 450, Transport: 100 }, 2026, 10, 20261022);
        expect(all).toMatchObject({ available: 0, overBy: 50, dailyAllowance: 0 });
    });

    it('the live-test case: under overall, but one category over', () => {
        const p = budgetProgress([{ category: 'Food', amount: 100 }, { category: 'Fun', amount: 40 }], { Food: 70.95, Fun: 80.38 }, 2026, 10, 20261022);
        expect(p).toMatchObject({ left: -11.33, available: 29.05, overBy: 40.38 });
        expect(p.dailyAllowance).toBeCloseTo(2.91, 2);
    });

    it('marks categories ok, warning (80%+) and over', () => {
        const p = budgetProgress(LIMITS, { Food: 319, Transport: 80 }, 2026, 10, 20261022);
        expect(p.byCategory.map(c => [c.category, c.status])).toEqual([['Food', 'ok'], ['Transport', 'warning']]);
        const over = budgetProgress(LIMITS, { Food: 401, Transport: 100 }, 2026, 10, 20261022);
        expect(over.byCategory.map(c => c.status)).toEqual(['over', 'warning']); // exactly on budget is a warning, not over
        expect(over.byCategory[0]).toMatchObject({ left: -1 });
    });

    it('a past month shows the final result with no allowance', () => {
        expect(budgetProgress(LIMITS, { Food: 360 }, 2026, 9, 20261022)).toMatchObject({ timing: 'past', daysLeft: 0, dailyAllowance: null, left: 140 });
    });

    it('a future month has the whole limit spread over all its days', () => {
        expect(budgetProgress(LIMITS, {}, 2026, 11, 20261022)).toMatchObject({ timing: 'future', daysLeft: 30, dailyAllowance: 16.67 });
    });

    it('a $0 limit with spending counts as over', () => {
        const p = budgetProgress([{ category: 'Shopping', amount: 0 }], { Shopping: 5 }, 2026, 10, 20261022);
        expect(p.byCategory[0]).toMatchObject({ status: 'over', pct: null });
        expect(budgetProgress([{ category: 'Shopping', amount: 0 }], {}, 2026, 10, 20261022).byCategory[0].status).toBe('ok');
    });

    it('handles cents without floating-point noise', () => {
        const p = budgetProgress([{ category: 'Food', amount: 0.3 }], { Food: 0.1 + 0.2 }, 2026, 10, 20261022);
        expect(p.left).toBe(0);
    });
});

describe('suggestLimits', () => {
    it('averages over months that had spending and rounds up to $10', () => {
        expect(suggestLimits([{ Food: 300, Transport: 41 }, { Food: 360 }, {}])).toEqual([
            { category: 'Food', amount: 330 },
            { category: 'Transport', amount: 30 }, // 41 / 2 = 20.5 → 30
        ]);
    });

    it('suggests nothing without history', () => {
        expect(suggestLimits([{}, {}, {}])).toEqual([]);
        expect(suggestLimits([])).toEqual([]);
    });
});

describe('overText', () => {
    it('names the one category over, or counts several', () => {
        expect(overText(budgetProgress(LIMITS, { Food: 100 }, 2026, 10, 20261022))).toBeNull();
        expect(overText(budgetProgress(LIMITS, { Food: 1440.5 }, 2026, 10, 20261022))).toBe('OVER BY 1,040.50 IN FOOD');
        expect(overText(budgetProgress(LIMITS, { Food: 410, Transport: 120 }, 2026, 10, 20261022))).toBe('OVER BY 30.00 IN 2 CATEGORIES');
    });
});
