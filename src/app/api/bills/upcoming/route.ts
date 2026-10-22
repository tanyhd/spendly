import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getUpcomingBills } from '@/services/summaries';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** Bills due in the next ?days=7 days (today included, 1–28) plus this month's overdue ones */
export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const raw = request.nextUrl.searchParams.get('days') ?? '7';
    const days = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
    if (!(days >= 1 && days <= 28)) return NextResponse.json({ message: 'days must be 1–28' }, { status: 400 });

    return NextResponse.json(await getUpcomingBills(auth.userId, days));
}
