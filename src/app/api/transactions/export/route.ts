import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { toCsv } from '@/lib/csv';
import { todayInt } from '@/lib/format';
import { exportTransactions, parseFilter } from '@/services/transactions';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

const isoDate = (d: number) => `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100).padStart(2, '0')}-${String(d % 100).padStart(2, '0')}`;

/** The same filters as /api/transactions, as a CSV download */
export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const filter = parseFilter(request.nextUrl.searchParams);
    if (!filter.ok) return NextResponse.json({ message: filter.error }, { status: 400 });

    const items = await exportTransactions(auth.userId, filter.value);
    const csv = toCsv([['Date', 'Category', 'Note', 'Amount'], ...items.map(e => [isoDate(e.date), e.category, e.note, e.amount])]);
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="spendly-transactions-${todayInt()}.csv"`,
            'Cache-Control': 'no-store',
        },
    });
}
