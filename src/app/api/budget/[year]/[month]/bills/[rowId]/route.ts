import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { parseYearMonth } from '@/lib/period';
import { setBillPaid } from '@/services/budgets';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** Ticks one fixed expense paid or unpaid for the month: body { paid: boolean } */
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ year: string; month: string; rowId: string }> }
) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const params = await context.params;
    const ym = parseYearMonth(params);
    if (!ym) return NextResponse.json({ message: 'Invalid month' }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(params.rowId)) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (typeof body?.paid !== 'boolean') return NextResponse.json({ message: 'paid must be true or false' }, { status: 400 });

    const result = await setBillPaid(auth.userId, ym.year, ym.month, params.rowId, body.paid);
    if (result === 'no-plan') {
        return NextResponse.json({ message: "Save this month's budget before ticking bills" }, { status: 409 });
    }
    if (result === 'no-row') return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    return NextResponse.json({ success: true, paid: body.paid });
}
