import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { todayInt } from '@/lib/format';
import { isPeriod, parseDateInt } from '@/lib/period';
import { getSummary } from '@/services/summaries';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** ?period=week|month|quarter|year &anchor=YYYYMMDD (any day in the period; default today) */
export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const period = params.get('period') ?? 'month';
    if (!isPeriod(period)) return NextResponse.json({ message: 'period must be week, month, quarter or year' }, { status: 400 });

    const rawAnchor = params.get('anchor');
    const anchor = rawAnchor ? parseDateInt(rawAnchor) : todayInt();
    if (anchor === null) return NextResponse.json({ message: 'anchor must be a real day as YYYYMMDD' }, { status: 400 });

    return NextResponse.json(await getSummary(auth.userId, period, anchor));
}
