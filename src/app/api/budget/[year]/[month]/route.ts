import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getBudget, upsertBudget } from '@/services/mongodb';

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

    const { year: y, month: m } = await context.params;
    const year = parseInt(y);
    const month = parseInt(m);

    let budget = await getBudget(auth.userId, year, month);

    // No data this month — seed recurring fixed expenses from previous month
    if (!budget) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prev = await getBudget(auth.userId, prevYear, prevMonth);

        if (prev?.fixedExpenses) {
            const seeded: Record<string, { amount: number; recurring: boolean }> = {};
            for (const [key, val] of Object.entries(prev.fixedExpenses as Record<string, { amount: number; recurring: boolean }>)) {
                seeded[key] = val.recurring
                    ? { amount: val.amount, recurring: true }
                    : { amount: 0, recurring: false };
            }
            budget = { fixedExpenses: seeded };
        }
    }

    return NextResponse.json(budget ?? null);
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ year: string; month: string }> }
) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { year: y, month: m } = await context.params;
    const year = parseInt(y);
    const month = parseInt(m);
    const body = await request.json();

    await upsertBudget(auth.userId, year, month, body);
    return NextResponse.json({ success: true });
}
