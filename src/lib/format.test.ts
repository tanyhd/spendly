import {
    fmt, fmtSigned, toDateInt, fromDateInt, dateIntToIso, isoToDateInt, addDaysInt, fmtDayShort,
    getWeekStart, fmtWeekRange, fmtMonth, plural, initials,
} from './format';

describe('money', () => {
    it('always shows 2 decimals with thousands separators', () => {
        expect(fmt(0)).toBe('0.00');
        expect(fmt(1234.5)).toBe('1,234.50');
        expect(fmt(216.666666)).toBe('216.67');
    });

    it('signs net amounts with + and a real minus sign, and leaves zero unsigned', () => {
        expect(fmtSigned(2460.33)).toBe('+2,460.33');
        expect(fmtSigned(-1686.17)).toBe('−1,686.17');
        expect(fmtSigned(0)).toBe('0.00');
    });
});

describe('date ints (YYYYMMDD)', () => {
    it('round-trips a Date', () => {
        const d = new Date(2026, 9, 22);
        expect(toDateInt(d)).toBe(20261022);
        expect(fromDateInt(20261022).getTime()).toBe(d.getTime());
    });

    it('converts to and from the date input format', () => {
        expect(dateIntToIso(20260105)).toBe('2026-01-05');
        expect(isoToDateInt('2026-01-05')).toBe(20260105);
    });

    it('adds days across month and year ends', () => {
        expect(addDaysInt(20261031, 1)).toBe(20261101);
        expect(addDaysInt(20260101, -1)).toBe(20251231);
        expect(addDaysInt(20240228, 1)).toBe(20240229); // leap year
    });

    it('formats a short day label', () => {
        expect(fmtDayShort(20261019)).toBe('OCT 19');
    });
});

describe('weeks (Monday to Sunday)', () => {
    it('finds the Monday of the week, including when the day is a Sunday', () => {
        expect(toDateInt(getWeekStart(new Date(2026, 9, 22)))).toBe(20261019); // Thursday
        expect(toDateInt(getWeekStart(new Date(2026, 9, 25)))).toBe(20261019); // Sunday
        expect(toDateInt(getWeekStart(new Date(2026, 9, 19)))).toBe(20261019); // Monday itself
    });

    it('labels a week, spanning months when needed', () => {
        expect(fmtWeekRange(new Date(2026, 9, 19))).toBe('OCT 19–25 2026');
        expect(fmtWeekRange(new Date(2026, 9, 26))).toBe('OCT 26 – NOV 1 2026');
        expect(fmtWeekRange(new Date(2025, 11, 29))).toBe('DEC 29 2025 – JAN 4 2026'); // both years when it crosses New Year
    });

    it('labels a month', () => {
        expect(fmtMonth(2026, 1)).toBe('JAN 2026');
    });
});

describe('text helpers', () => {
    it('pluralises', () => {
        expect(plural(1, 'entry', 'entries')).toBe('1 entry');
        expect(plural(0, 'entry', 'entries')).toBe('0 entries');
        expect(plural(3, 'entry', 'entries')).toBe('3 entries');
    });

    it('makes initials from up to two words', () => {
        expect(initials('Alex Tan')).toBe('AT');
        expect(initials('alex  tan lee')).toBe('AT');
        expect(initials('')).toBe('?');
        expect(initials(undefined)).toBe('?');
    });
});
