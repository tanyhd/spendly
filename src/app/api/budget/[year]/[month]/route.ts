import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { parseYearMonth } from '@/lib/period';
import { getBudgetForMonth, savePlan, parsePlanInput } from '@/services/budgets';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ year: string; month: string }> }
) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ym = parseYearMonth(await context.params);
    if (!ym) return NextResponse.json({ message: 'Invalid month' }, { status: 400 });

    const data = await getBudgetForMonth(auth.userId, ym.year, ym.month);
    return NextResponse.json(data ?? null);
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ year: string; month: string }> }
) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const ym = parseYearMonth(await context.params);
    if (!ym) return NextResponse.json({ message: 'Invalid month' }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = parsePlanInput(body);
    if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

    await savePlan(auth.userId, ym.year, ym.month, parsed.data);
    return NextResponse.json({ success: true });
}
