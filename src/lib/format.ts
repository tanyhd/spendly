export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
export const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "+2,460.33" / "−1,686.17" / "0.00" */
export function fmtSigned(n: number): string {
    if (n === 0) return fmt(0);
    return `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
}

export function toDateInt(d: Date): number {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function fromDateInt(n: number): Date {
    return new Date(Math.floor(n / 10000), Math.floor((n % 10000) / 100) - 1, n % 100);
}

/** YYYYMMDD int ⇄ "YYYY-MM-DD" (what <input type="date"> uses) */
export function dateIntToIso(n: number): string {
    const s = String(n);
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function isoToDateInt(iso: string): number {
    return parseInt(iso.replace(/-/g, ''), 10);
}

export function todayInt(): number {
    return toDateInt(new Date());
}

export function addDaysInt(n: number, days: number): number {
    const d = fromDateInt(n);
    d.setDate(d.getDate() + days);
    return toDateInt(d);
}

/** "OCT 19" */
export function fmtDayShort(n: number): string {
    const d = fromDateInt(n);
    return `${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getDate()}`;
}

export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

/** "OCT 19–25 2026" / "SEP 28 – OCT 4 2026" */
export function fmtWeekRange(ws: Date): string {
    const end = new Date(ws);
    end.setDate(end.getDate() + 6);
    const sm = MONTHS_SHORT[ws.getMonth()].toUpperCase();
    const em = MONTHS_SHORT[end.getMonth()].toUpperCase();
    if (sm === em) return `${sm} ${ws.getDate()}–${end.getDate()} ${ws.getFullYear()}`;
    return `${sm} ${ws.getDate()} – ${em} ${end.getDate()} ${end.getFullYear()}`;
}

/** "OCT 2026" */
export function fmtMonth(year: number, month: number): string {
    return `${MONTHS_SHORT[month - 1].toUpperCase()} ${year}`;
}

/** "1 entry" / "3 entries" */
export function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`;
}

export function initials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
