import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount } from '@/lib/crypto';
import { upsertBudget } from '@/services/mongodb';
import { getBudgetForMonth } from '@/services/budget';

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
    const data = await getBudgetForMonth(auth.userId, parseInt(y), parseInt(m));
    return NextResponse.json(data ?? null);
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

    const encrypted = {
        ...body,
        ...(Array.isArray(body.income) && {
            income: body.income.map((item: any) => ({ ...item, amount: encryptAmount(parseFloat(item.amount) || 0) })),
        }),
        ...(Array.isArray(body.fixedExpenses) && {
            fixedExpenses: body.fixedExpenses.map((item: any) => ({ ...item, amount: encryptAmount(parseFloat(item.amount) || 0) })),
        }),
    };

    await upsertBudget(auth.userId, year, month, encrypted);
    return NextResponse.json({ success: true });
}
