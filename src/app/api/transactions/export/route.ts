import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { toCsv } from '@/lib/csv';
import { dateIntToIso } from '@/lib/format';
import { exportTransactions, parseFilter, type TransactionFilter } from '@/services/transactions';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** "spendly-expenses-20260801-20261031-food-transport-lunch.csv": says what's in it */
function fileName(f: TransactionFilter) {
    const parts = ['spendly-expenses'];
    parts.push(f.from || f.to ? `${f.from ?? 'start'}-${f.to ?? 'today'}` : 'all-time');
    if (f.categories) parts.push(...f.categories.map(c => c.toLowerCase()));
    if (f.q) parts.push(f.q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30));
    return `${parts.filter(Boolean).join('-')}.csv`;
}

/** The same filters as /api/transactions, as a CSV download */
export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const filter = parseFilter(request.nextUrl.searchParams);
    if (!filter.ok) return NextResponse.json({ message: filter.error }, { status: 400 });

    const items = await exportTransactions(auth.userId, filter.value);
    const csv = toCsv([['Date', 'Category', 'Note', 'Amount'], ...items.map(e => [dateIntToIso(e.date), e.category, e.note, e.amount])]);
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileName(filter.value)}"`,
            'Cache-Control': 'no-store',
        },
    });
}
