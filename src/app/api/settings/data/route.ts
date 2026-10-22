import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { decryptAmount } from '@/lib/crypto';
import type { EntryDoc } from '@/services/db';
import { clearMonthData, clearWeekData, clearAllUserData } from '@/services/settings';
import { getEntryAmounts } from '@/services/entries';
import { countBudgets } from '@/services/budgets';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

// Preview of what a clear would delete: ?type=week&weekStart=&weekEnd= | ?type=month&year=&month= | ?type=all
export async function GET(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const p = req.nextUrl.searchParams;
    const type = p.get('type');
    let entries: Pick<EntryDoc, 'amount'>[];
    let budgets: number;

    if (type === 'week' && p.get('weekStart') && p.get('weekEnd')) {
        entries = await getEntryAmounts(auth.userId, parseInt(p.get('weekStart')!), parseInt(p.get('weekEnd')!));
        budgets = 0;
    } else if (type === 'month' && p.get('year') && p.get('month')) {
        const year = parseInt(p.get('year')!);
        const month = parseInt(p.get('month')!);
        [entries, budgets] = await Promise.all([
            getEntryAmounts(auth.userId, year * 10000 + month * 100 + 1, year * 10000 + month * 100 + 31),
            countBudgets(auth.userId, year, month),
        ]);
    } else if (type === 'all') {
        [entries, budgets] = await Promise.all([getEntryAmounts(auth.userId), countBudgets(auth.userId)]);
    } else {
        return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const total = entries.reduce((s, e) => s + decryptAmount(e.amount), 0);
    return NextResponse.json({ entries: entries.length, total, budgets });
}

export async function DELETE(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { type, year, month, weekStart, weekEnd } = await req.json();
    let result;
    if (type === 'week' && weekStart && weekEnd) {
        result = await clearWeekData(auth.userId, parseInt(weekStart), parseInt(weekEnd));
    } else if (type === 'month' && year && month) {
        result = await clearMonthData(auth.userId, parseInt(year), parseInt(month));
    } else if (type === 'all') {
        result = await clearAllUserData(auth.userId);
    } else {
        return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
}
