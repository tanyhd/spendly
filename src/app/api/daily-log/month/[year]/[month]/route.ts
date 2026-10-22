import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { parseYearMonth } from '@/lib/period';
import { getMonthVariableTotals } from '@/services/summaries';

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

    const ym = parseYearMonth(await context.params);
    if (!ym) return NextResponse.json({ message: 'Invalid month' }, { status: 400 });

    const result = await getMonthVariableTotals(auth.userId, ym.year, ym.month);
    return NextResponse.json(result);
}
