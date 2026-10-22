import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { parseYearMonth } from '@/lib/period';
import { getAnnualData } from '@/services/summaries';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ year: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ym = parseYearMonth({ year: (await context.params).year, month: '1' });
    if (!ym) return NextResponse.json({ message: 'Invalid year' }, { status: 400 });

    const data = await getAnnualData(auth.userId, ym.year);
    return NextResponse.json(data);
}
