import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { clearMonthData, clearWeekData, clearAllUserData } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function DELETE(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { type, year, month, weekStart, weekEnd } = await req.json();
    if (type === 'week' && weekStart && weekEnd) {
        await clearWeekData(auth.userId, parseInt(weekStart), parseInt(weekEnd));
    } else if (type === 'month' && year && month) {
        await clearMonthData(auth.userId, parseInt(year), parseInt(month));
    } else if (type === 'all') {
        await clearAllUserData(auth.userId);
    } else {
        return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
