import { getMonthVariableTotals, getBudgetForMonth } from '../budget';
import { getMonthEntries, getBudget } from '../mongodb';

jest.mock('../mongodb', () => ({
    getMonthEntries: jest.fn(),
    getBudget: jest.fn(),
}));

// decryptAmount passes numbers through as-is — mock avoids loading the real
// module which requires ENCRYPTION_KEY in the environment.
jest.mock('@/lib/crypto', () => ({
    decryptAmount: (v: any) => (typeof v === 'number' ? v : parseFloat(v) || 0),
    encryptAmount: (v: number) => String(v),
}));

const mockGetMonthEntries = getMonthEntries as jest.MockedFunction<typeof getMonthEntries>;
const mockGetBudget = getBudget as jest.MockedFunction<typeof getBudget>;

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getMonthVariableTotals
// ---------------------------------------------------------------------------

describe('getMonthVariableTotals', () => {
    it('returns empty array when there are no entries', async () => {
        mockGetMonthEntries.mockResolvedValue([]);
        expect(await getMonthVariableTotals('u1', 2026, 5)).toEqual([]);
    });

    it('groups entries by category and sums their amounts', async () => {
        mockGetMonthEntries.mockResolvedValue([
            { category: 'Food', amount: 50 },
            { category: 'Food', amount: 30 },
            { category: 'Transport', amount: 20 },
        ]);
        const result = await getMonthVariableTotals('u1', 2026, 5);
        expect(result).toContainEqual({ category: 'Food', total: 80 });
        expect(result).toContainEqual({ category: 'Transport', total: 20 });
    });

    it('sorts categories by total descending', async () => {
        mockGetMonthEntries.mockResolvedValue([
            { category: 'Transport', amount: 20 },
            { category: 'Food', amount: 80 },
            { category: 'Shopping', amount: 50 },
        ]);
        const result = await getMonthVariableTotals('u1', 2026, 5);
        expect(result.map(r => r.category)).toEqual(['Food', 'Shopping', 'Transport']);
    });

    it('passes the correct userId, year, and month to the db', async () => {
        mockGetMonthEntries.mockResolvedValue([]);
        await getMonthVariableTotals('u1', 2026, 5);
        expect(mockGetMonthEntries).toHaveBeenCalledWith('u1', 2026, 5);
    });
});

// ---------------------------------------------------------------------------
// getBudgetForMonth
// ---------------------------------------------------------------------------

describe('getBudgetForMonth', () => {
    it('returns the saved budget when one exists for the month', async () => {
        mockGetBudget.mockResolvedValue({
            income: [{ label: 'Salary', amount: 5000, category: 'Employment' }],
            fixedExpenses: [{ label: 'Rent', amount: 1500, category: 'Housing' }],
        });
        const result = await getBudgetForMonth('u1', 2026, 5);
        expect(result?.income[0].amount).toBe(5000);
        expect(result?.fixedExpenses[0].amount).toBe(1500);
    });

    it('returns null when no budget exists for the month or the previous month', async () => {
        mockGetBudget.mockResolvedValue(null);
        expect(await getBudgetForMonth('u1', 2026, 5)).toBeNull();
    });

    it('carries forward income with full amounts from the previous month', async () => {
        mockGetBudget
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                income: [{ label: 'Salary', amount: 5000, category: 'Employment' }],
                fixedExpenses: [],
            });
        const result = await getBudgetForMonth('u1', 2026, 5);
        expect(result?.income[0].amount).toBe(5000);
    });

    it('carries forward fixed expenses with full amounts from the previous month', async () => {
        mockGetBudget
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                income: [],
                fixedExpenses: [{ label: 'Rent', amount: 1500, category: 'Housing' }],
            });
        const result = await getBudgetForMonth('u1', 2026, 5);
        expect(result?.fixedExpenses[0].amount).toBe(1500);
    });

    it('looks at December of the prior year when the current month is January', async () => {
        mockGetBudget.mockResolvedValue(null);
        await getBudgetForMonth('u1', 2026, 1);
        expect(mockGetBudget).toHaveBeenNthCalledWith(2, 'u1', 2025, 12);
    });

    it('returns null when the previous month has empty income and expenses', async () => {
        mockGetBudget
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ income: [], fixedExpenses: [] });
        expect(await getBudgetForMonth('u1', 2026, 5)).toBeNull();
    });
});
