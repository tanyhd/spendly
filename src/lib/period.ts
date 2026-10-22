// Date ranges for summaries: weeks (Monday–Sunday), months, quarters and years, all as
// inclusive YYYYMMDD ints in local time, like the rest of the app.
import { MONTHS_SHORT, fmtWeekRange, fromDateInt, getWeekStart, toDateInt } from './format';

export type Period = 'week' | 'month' | 'quarter' | 'year';
export const PERIODS: Period[] = ['week', 'month', 'quarter', 'year'];

/** Inclusive range, YYYYMMDD */
export type DateRange = { start: number; end: number };

export function isPeriod(v: unknown): v is Period {
    return typeof v === 'string' && (PERIODS as string[]).includes(v);
}

/** Validates route params like { year: '2026', month: '10' } */
export function parseYearMonth(p: { year?: string; month?: string }): { year: number; month: number } | null {
    if (!/^\d{4}$/.test(p.year ?? '') || !/^\d{1,2}$/.test(p.month ?? '')) return null;
    const year = Number(p.year), month = Number(p.month);
    return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : null;
}

/** Validates a YYYYMMDD string or number that is a real calendar date */
export function parseDateInt(v: unknown): number | null {
    const s = String(v ?? '');
    if (!/^\d{8}$/.test(s)) return null;
    const n = Number(s);
    return toDateInt(fromDateInt(n)) === n ? n : null;
}

function lastDayOfMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function ymd(year: number, month: number, day: number) {
    return year * 10000 + month * 100 + day;
}

/** The period that contains `anchor` */
export function periodRange(period: Period, anchor: number): DateRange {
    const d = fromDateInt(anchor);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    switch (period) {
        case 'week': {
            const ws = getWeekStart(d);
            const we = new Date(ws);
            we.setDate(we.getDate() + 6);
            return { start: toDateInt(ws), end: toDateInt(we) };
        }
        case 'month':
            return { start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) };
        case 'quarter': {
            const qStart = Math.floor((m - 1) / 3) * 3 + 1;
            return { start: ymd(y, qStart, 1), end: ymd(y, qStart + 2, lastDayOfMonth(y, qStart + 2)) };
        }
        case 'year':
            return { start: ymd(y, 1, 1), end: ymd(y, 12, 31) };
    }
}

/** The period just before the one containing `anchor` */
export function previousRange(period: Period, anchor: number): DateRange {
    const start = fromDateInt(periodRange(period, anchor).start);
    start.setDate(start.getDate() - 1); // the day before this period starts is in the previous one
    return periodRange(period, toDateInt(start));
}

/** Number of days in an inclusive range */
export function daysIn(r: DateRange) {
    return Math.round((fromDateInt(r.end).getTime() - fromDateInt(r.start).getTime()) / 86_400_000) + 1;
}

/**
 * How far `today` is into the range: the whole range if it's over, null if it hasn't started.
 * Used to compare a period that is still running with the same point in the previous one.
 */
export function elapsed(r: DateRange, today: number): DateRange | null {
    if (today < r.start) return null;
    return { start: r.start, end: Math.min(today, r.end) };
}

/**
 * The previous period cut to the same number of days as have passed in the current one,
 * never past the previous period's own end (31 days into March compares with all of February).
 */
export function samePointInPrevious(period: Period, anchor: number, today: number): DateRange | null {
    const current = periodRange(period, anchor);
    const soFar = elapsed(current, today);
    if (!soFar) return null;
    const prev = previousRange(period, anchor);
    if (today > current.end) return prev; // finished periods compare whole with whole
    const end = fromDateInt(prev.start);
    end.setDate(end.getDate() + daysIn(soFar) - 1);
    return { start: prev.start, end: Math.min(toDateInt(end), prev.end) };
}

export function periodLabel(period: Period, anchor: number): string {
    const r = periodRange(period, anchor);
    const d = fromDateInt(r.start);
    switch (period) {
        case 'week': return fmtWeekRange(d);
        case 'month': return `${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
        case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
        case 'year': return String(d.getFullYear());
    }
}

export type Bucket = DateRange & { label: string };

const DOW_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** The bars a period's chart is split into: days for a week or month, months for a quarter or year */
export function buckets(period: Period, anchor: number): Bucket[] {
    const r = periodRange(period, anchor);
    const start = fromDateInt(r.start);
    if (period === 'week' || period === 'month') {
        return Array.from({ length: daysIn(r) }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const day = toDateInt(d);
            return { start: day, end: day, label: period === 'week' ? DOW_SHORT[i] : String(d.getDate()) };
        });
    }
    const months = period === 'quarter' ? 3 : 12;
    return Array.from({ length: months }, (_, i) => {
        const y = start.getFullYear(), m = start.getMonth() + 1 + i;
        return { start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)), label: MONTHS_SHORT[m - 1].toUpperCase() };
    });
}

/** Days left in the month containing `today`, today included */
export function daysLeftInMonth(today: number) {
    const d = fromDateInt(today);
    return lastDayOfMonth(d.getFullYear(), d.getMonth() + 1) - d.getDate() + 1;
}
