// Bills are the fixed expenses on the Budget page. Pure, so it can be tested for any date.
import { addDaysInt } from './format';

export type Bill = { id: string; label: string; category: string; amount: number; dueDay: number | null; paid: boolean };

export type BillStatus = 'overdue' | 'today' | 'upcoming';

export type UpcomingBill = {
    rowId: string;
    label: string;
    category: string;
    amount: number;
    dueDate: number;
    paid: boolean;
    status: BillStatus;
    year: number;
    month: number;
    /** false when the month's plan is only a copy of last month (ticking paid needs it saved first) */
    planSaved: boolean;
};

export type BillTotals = { total: number; paid: number; leftToPay: number; overdueCount: number };

const cents = (n: number) => Math.round(n * 100) / 100;

/** The bill's date in a month; a due day past the month's end falls on its last day (31 → Feb 28) */
export function dueDate(year: number, month: number, dueDay: number) {
    const last = new Date(year, month, 0).getDate();
    return year * 10000 + month * 100 + Math.min(dueDay, last);
}

/** Overdue = due date passed and not paid; a paid bill is never overdue */
export function billStatus(due: number, paid: boolean, today: number): BillStatus {
    if (due === today) return 'today';
    return due < today && !paid ? 'overdue' : 'upcoming';
}

/**
 * Totals for one month. Bills without a due day still count. Overdue only applies to the
 * current month: an unpaid bill in a past month is just unpaid.
 */
export function billTotals(bills: Bill[], year: number, month: number, today: number): BillTotals {
    const total = cents(bills.reduce((s, b) => s + b.amount, 0));
    const paid = cents(bills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0));
    const isCurrent = Math.floor(today / 100) === year * 100 + month;
    const overdueCount = isCurrent
        ? bills.filter(b => b.dueDay != null && !b.paid && dueDate(year, month, b.dueDay) < today).length
        : 0;
    return { total, paid, leftToPay: cents(total - paid), overdueCount };
}

export type MonthBills = { year: number; month: number; bills: Bill[]; planSaved: boolean };

/**
 * Bills due from today through the next `days` days (today included), plus this month's overdue
 * ones, soonest first. Bills without a due day are left out.
 */
export function upcomingBills(months: MonthBills[], today: number, days: number) {
    const end = addDaysInt(today, days - 1);
    const thisMonthKey = Math.floor(today / 100);
    const items: UpcomingBill[] = [];
    for (const { year, month, bills, planSaved } of months) {
        for (const b of bills) {
            if (b.dueDay == null) continue;
            const due = dueDate(year, month, b.dueDay);
            const status = billStatus(due, b.paid, today);
            const inWindow = due >= today && due <= end;
            const overdueNow = status === 'overdue' && year * 100 + month === thisMonthKey;
            if (!inWindow && !overdueNow) continue;
            items.push({
                rowId: b.id, label: b.label, category: b.category, amount: b.amount,
                dueDate: due, paid: b.paid, status, year, month, planSaved,
            });
        }
    }
    items.sort((a, b) => a.dueDate - b.dueDate || a.label.localeCompare(b.label));
    const unpaid = items.filter(i => !i.paid);
    return {
        range: { start: today, end },
        items,
        unpaid: { count: unpaid.length, amount: cents(unpaid.reduce((s, i) => s + i.amount, 0)) },
    };
}
