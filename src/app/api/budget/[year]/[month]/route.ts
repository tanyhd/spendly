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

    // No data this month — seed from previous month
    if (!budget) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prev = await getBudget(auth.userId, prevYear, prevMonth);

        if (prev) {
            type FixedItem = { id: string; label: string; amount: number; recurring: boolean; category: string };
            type IncomeItem = { id: string; label: string; amount: number; category: string };

            const seededFixed = Array.isArray(prev.fixedExpenses)
                ? (prev.fixedExpenses as FixedItem[]).map(item => ({
                    ...item,
                    amount: item.recurring ? item.amount : 0,
                }))
                : undefined;

            const seededIncome = Array.isArray(prev.income)
                ? (prev.income as IncomeItem[])
                : undefined;

            if (seededFixed || seededIncome) {
                budget = {
                    ...(seededIncome && { income: seededIncome }),
                    ...(seededFixed && { fixedExpenses: seededFixed }),
                };
            }
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
