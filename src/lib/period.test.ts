import {
    parseYearMonth, parseDateInt, periodRange, previousRange, daysIn, elapsed, samePointInPrevious,
    periodLabel, buckets, daysLeftInMonth, isPeriod,
} from './period';

describe('parseYearMonth', () => {
    it('accepts real months', () => {
        expect(parseYearMonth({ year: '2026', month: '10' })).toEqual({ year: 2026, month: 10 });
        expect(parseYearMonth({ year: '2026', month: '1' })).toEqual({ year: 2026, month: 1 });
    });

    it.each([
        { year: '2026', month: '13' }, { year: '2026', month: '0' }, { year: '26', month: '1' },
        { year: '2026', month: 'x' }, { year: '1999', month: '1' }, {},
    ])('rejects %j', p => {
        expect(parseYearMonth(p)).toBeNull();
    });
});

describe('parseDateInt', () => {
    it('accepts real calendar days only', () => {
        expect(parseDateInt('20261022')).toBe(20261022);
        expect(parseDateInt(20240229)).toBe(20240229);
        expect(parseDateInt('20250229')).toBeNull(); // not a leap year
        expect(parseDateInt('20261301')).toBeNull();
        expect(parseDateInt('2026-10-22')).toBeNull();
        expect(parseDateInt(undefined)).toBeNull();
    });
});

describe('periodRange', () => {
    it('weeks run Monday to Sunday, across month and year ends', () => {
        expect(periodRange('week', 20261022)).toEqual({ start: 20261019, end: 20261025 });
        expect(periodRange('week', 20261025)).toEqual({ start: 20261019, end: 20261025 }); // Sunday
        expect(periodRange('week', 20261231)).toEqual({ start: 20261228, end: 20270103 });
    });

    it('months use their real length, including leap Februaries', () => {
        expect(periodRange('month', 20261022)).toEqual({ start: 20261001, end: 20261031 });
        expect(periodRange('month', 20240210)).toEqual({ start: 20240201, end: 20240229 });
        expect(periodRange('month', 20250210)).toEqual({ start: 20250201, end: 20250228 });
    });

    it('quarters and years', () => {
        expect(periodRange('quarter', 20261022)).toEqual({ start: 20261001, end: 20261231 });
        expect(periodRange('quarter', 20260515)).toEqual({ start: 20260401, end: 20260630 });
        expect(periodRange('year', 20261022)).toEqual({ start: 20260101, end: 20261231 });
    });
});

describe('previousRange', () => {
    it('steps back one period, across year ends', () => {
        expect(previousRange('week', 20261022)).toEqual({ start: 20261012, end: 20261018 });
        expect(previousRange('month', 20260115)).toEqual({ start: 20251201, end: 20251231 });
        expect(previousRange('month', 20260331)).toEqual({ start: 20260201, end: 20260228 });
        expect(previousRange('quarter', 20260215)).toEqual({ start: 20251001, end: 20251231 });
        expect(previousRange('year', 20261022)).toEqual({ start: 20250101, end: 20251231 });
    });
});

describe('elapsed and samePointInPrevious', () => {
    it('counts days inclusively', () => {
        expect(daysIn({ start: 20261001, end: 20261031 })).toBe(31);
        expect(daysIn({ start: 20261022, end: 20261022 })).toBe(1);
        expect(daysIn({ start: 20260301, end: 20260331 })).toBe(31); // across the clock change
    });

    it('is the part of the range up to today', () => {
        expect(elapsed({ start: 20261001, end: 20261031 }, 20261022)).toEqual({ start: 20261001, end: 20261022 });
        expect(elapsed({ start: 20261001, end: 20261031 }, 20261105)).toEqual({ start: 20261001, end: 20261031 });
        expect(elapsed({ start: 20261101, end: 20261130 }, 20261022)).toBeNull();
    });

    it('compares 22 days into October with September 1–22', () => {
        expect(samePointInPrevious('month', 20261022, 20261022)).toEqual({ start: 20260901, end: 20260922 });
    });

    it('caps at the end of a shorter previous month', () => {
        expect(samePointInPrevious('month', 20260331, 20260331)).toEqual({ start: 20260201, end: 20260228 });
    });

    it('uses the whole previous period once the current one is over', () => {
        expect(samePointInPrevious('month', 20260915, 20261022)).toEqual({ start: 20260801, end: 20260831 });
    });

    it('compares Thursday with last Monday–Thursday', () => {
        expect(samePointInPrevious('week', 20261022, 20261022)).toEqual({ start: 20261012, end: 20261015 });
    });

    it('is null for a period that has not started', () => {
        expect(samePointInPrevious('month', 20261115, 20261022)).toBeNull();
    });
});

describe('labels and buckets', () => {
    it('labels each period', () => {
        expect(periodLabel('week', 20261022)).toBe('OCT 19–25 2026');
        expect(periodLabel('month', 20261022)).toBe('OCT 2026');
        expect(periodLabel('quarter', 20261022)).toBe('Q4 2026');
        expect(periodLabel('year', 20261022)).toBe('2026');
    });

    it('splits a week into 7 days and a month into its days', () => {
        const w = buckets('week', 20261022);
        expect(w.map(b => b.label)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
        expect(w[0]).toEqual({ start: 20261019, end: 20261019, label: 'MON' });
        expect(buckets('month', 20240205)).toHaveLength(29);
    });

    it('splits a quarter into 3 months and a year into 12', () => {
        expect(buckets('quarter', 20261022)).toEqual([
            { start: 20261001, end: 20261031, label: 'OCT' },
            { start: 20261101, end: 20261130, label: 'NOV' },
            { start: 20261201, end: 20261231, label: 'DEC' },
        ]);
        expect(buckets('year', 20261022).map(b => b.label)).toHaveLength(12);
    });

    it('counts days left in the month, today included', () => {
        expect(daysLeftInMonth(20261022)).toBe(10);
        expect(daysLeftInMonth(20261031)).toBe(1);
        expect(daysLeftInMonth(20240201)).toBe(29);
    });

    it('recognises period names', () => {
        expect(isPeriod('quarter')).toBe(true);
        expect(isPeriod('decade')).toBe(false);
    });
});
