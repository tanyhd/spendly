import { dueDate, billStatus, billTotals, upcomingBills, addDays, type Bill } from './bills';

const bill = (id: string, amount: number, dueDay: number | null, paid = false): Bill =>
    ({ id, label: id, category: 'Housing', amount, dueDay, paid });

describe('dueDate', () => {
    it('clamps a due day past the month end to its last day', () => {
        expect(dueDate(2026, 2, 31)).toBe(20260228);
        expect(dueDate(2024, 2, 31)).toBe(20240229);
        expect(dueDate(2026, 4, 31)).toBe(20260430);
        expect(dueDate(2026, 10, 31)).toBe(20261031);
        expect(dueDate(2026, 10, 5)).toBe(20261005);
    });
});

describe('billStatus', () => {
    it('is overdue only when the date passed and it is not paid', () => {
        expect(billStatus(20261020, false, 20261022)).toBe('overdue');
        expect(billStatus(20261020, true, 20261022)).toBe('upcoming');
        expect(billStatus(20261022, false, 20261022)).toBe('today');
        expect(billStatus(20261025, false, 20261022)).toBe('upcoming');
    });
});

describe('billTotals', () => {
    const bills = [bill('Rent', 2200, 1, true), bill('Phone', 45.5, 15), bill('Gym', 60, 28), bill('Tax', 400, null)];

    it('counts every bill, with or without a due day', () => {
        expect(billTotals(bills, 2026, 10, 20261022)).toEqual({ total: 2705.5, paid: 2200, leftToPay: 505.5, overdueCount: 1 });
    });

    it('a past month has unpaid bills, but none overdue', () => {
        expect(billTotals(bills, 2026, 9, 20261022).overdueCount).toBe(0);
    });
});

describe('upcomingBills', () => {
    const oct = { year: 2026, month: 10, planSaved: true, bills: [
        bill('Rent', 2200, 1, true),   // past and paid: not shown
        bill('Phone', 45, 15),         // past and unpaid: overdue
        bill('Gym', 60, 22),           // today
        bill('Card', 300, 28),         // in the window
        bill('Water', 30, 29),         // just outside a 7-day window (22..28)
        bill('Tax', 400, null),        // no due day: never listed
    ] };
    const nov = { year: 2026, month: 11, planSaved: false, bills: [bill('Rent', 2200, 1), bill('Phone', 45, 15)] };

    it('lists overdue, today and the next days, soonest first', () => {
        const r = upcomingBills([oct, nov], 20261022, 7);
        expect(r.range).toEqual({ start: 20261022, end: 20261028 });
        expect(r.items.map(i => [i.label, i.status])).toEqual([['Phone', 'overdue'], ['Gym', 'today'], ['Card', 'upcoming']]);
        expect(r.unpaid).toEqual({ count: 3, amount: 405 });
    });

    it('crosses into next month (the 25th → the 3rd)', () => {
        const r = upcomingBills([oct, nov], 20261027, 7);
        expect(r.range.end).toBe(20261102);
        expect(r.items.map(i => [i.label, i.dueDate, i.planSaved])).toEqual([
            ['Phone', 20261015, true], ['Gym', 20261022, true], ['Card', 20261028, true], ['Water', 20261029, true], ['Rent', 20261101, false],
        ]);
    });

    it('keeps paid bills in the window (to show the tick) but not in the unpaid total', () => {
        const paidCard = { ...oct, bills: [bill('Card', 300, 28, true)] };
        const r = upcomingBills([paidCard], 20261022, 7);
        expect(r.items).toHaveLength(1);
        expect(r.unpaid).toEqual({ count: 0, amount: 0 });
    });

    it('a clamped due day lands in the window (31 → Feb 28)', () => {
        const feb = { year: 2026, month: 2, planSaved: true, bills: [bill('Rent', 1000, 31)] };
        expect(upcomingBills([feb], 20260225, 7).items[0].dueDate).toBe(20260228);
    });

    it('addDays crosses month and year ends', () => {
        expect(addDays(20261231, 1)).toBe(20270101);
        expect(addDays(20260228, 1)).toBe(20260301);
    });
});
