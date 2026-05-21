import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { decryptAmount } from '@/lib/crypto';
import { getMonthEntries } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ year: string; month: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { year: y, month: m } = await context.params;
    const year = parseInt(y);
    const month = parseInt(m);

    const entries = await getMonthEntries(auth.userId, year, month);

    const totals: Record<string, number> = {};
    for (const e of entries) {
        const cat = e.category as string;
        totals[cat] = (totals[cat] ?? 0) + decryptAmount(e.amount);
    }

    const result = Object.entries(totals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);

    return NextResponse.json(result);
}
