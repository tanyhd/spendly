import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { listTransactions, parseFilter, parseLimit, decodeCursor } from '@/services/transactions';

async function getAuth(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** ?from&to (YYYYMMDD) &category=Food,Transport &q=lunch &cursor &limit=50 → newest first */
export async function GET(request: NextRequest) {
    const auth = await getAuth(request);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const filter = parseFilter(params);
    if (!filter.ok) return NextResponse.json({ message: filter.error }, { status: 400 });
    const limit = parseLimit(params.get('limit'));
    if (!limit.ok) return NextResponse.json({ message: limit.error }, { status: 400 });

    const rawCursor = params.get('cursor');
    const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
    if (cursor === null) return NextResponse.json({ message: 'Invalid cursor' }, { status: 400 });

    return NextResponse.json(await listTransactions(auth.userId, filter.value, limit.value, cursor));
}
