import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount, decryptAmount } from '@/lib/crypto';
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

    if (!budget) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prev = await getBudget(auth.userId, prevYear, prevMonth);

        if (prev) {
            const prevIncome = Array.isArray(prev.income)
                ? prev.income.map((item: any) => ({ ...item, amount: decryptAmount(item.amount) }))
                : null;
            const prevFixed = Array.isArray(prev.fixedExpenses)
                ? prev.fixedExpenses.map((item: any) => ({ ...item, amount: decryptAmount(item.amount) }))
                : null;

            if (prevIncome || prevFixed) {
                budget = {
                    ...(prevIncome && { income: prevIncome }),
                    ...(prevFixed && { fixedExpenses: prevFixed.map((item: any) => ({ ...item, amount: item.recurring ? item.amount : 0 })) }),
                };
            }
        }
    } else {
        if (Array.isArray(budget.income))
            budget.income = budget.income.map((item: any) => ({ ...item, amount: decryptAmount(item.amount) }));
        if (Array.isArray(budget.fixedExpenses))
            budget.fixedExpenses = budget.fixedExpenses.map((item: any) => ({ ...item, amount: decryptAmount(item.amount) }));
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
