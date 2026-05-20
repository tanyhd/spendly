import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount, decryptAmount } from '@/lib/crypto';
import { getWeekEntries, createEntry } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function GET(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const weekStartParam = req.nextUrl.searchParams.get('weekStart');
    if (!weekStartParam) return NextResponse.json({ message: 'weekStart required' }, { status: 400 });

    const weekStartInt = parseInt(weekStartParam);
    const y = Math.floor(weekStartInt / 10000);
    const mo = Math.floor((weekStartInt % 10000) / 100) - 1;
    const dy = weekStartInt % 100;
    const endDate = new Date(y, mo, dy + 6);
    const weekEndInt = endDate.getFullYear() * 10000 + (endDate.getMonth() + 1) * 100 + endDate.getDate();

    const entries = await getWeekEntries(auth.userId, weekStartInt, weekEndInt);
    return NextResponse.json(
        entries.map((e: any) => ({
            _id: e._id.toString(),
            date: e.date,
            category: e.category,
            amount: decryptAmount(e.amount),
            note: e.note ?? '',
        }))
    );
}

export async function POST(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { date, category, amount, note } = await req.json();
    const entry = await createEntry(auth.userId, {
        date,
        category,
        amount: encryptAmount(parseFloat(amount) || 0),
        note: note ?? '',
    });

    return NextResponse.json({
        _id: entry._id.toString(),
        date: entry.date,
        category: entry.category,
        amount: parseFloat(amount) || 0,
        note: entry.note,
    }, { status: 201 });
}
