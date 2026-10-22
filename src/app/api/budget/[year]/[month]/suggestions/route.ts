import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { parseYearMonth } from '@/lib/period';
import { getSuggestedLimits } from '@/services/summaries';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** Suggested category limits for "Suggest from my spending": last 3 months' average, rounded up to $10 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ year: string; month: string }> }
) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ym = parseYearMonth(await context.params);
    if (!ym) return NextResponse.json({ message: 'Invalid month' }, { status: 400 });

    return NextResponse.json({ suggestions: await getSuggestedLimits(auth.userId, ym.year, ym.month) });
}
