import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount } from '@/lib/crypto';
import { parseDateInt } from '@/lib/period';
import { addDays } from '@/lib/bills';
import { getWeekEntries, createEntry, parseEntryInput, toEntry } from '@/services/entries';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

/** ?weekStart=YYYYMMDD → that Monday–Sunday week, oldest first */
export async function GET(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const weekStartParam = req.nextUrl.searchParams.get('weekStart');
    if (!weekStartParam) return NextResponse.json({ message: 'weekStart required' }, { status: 400 });
    const weekStart = parseDateInt(weekStartParam);
    if (weekStart === null) return NextResponse.json({ message: 'weekStart must be a real day as YYYYMMDD' }, { status: 400 });

    // Seven days from the given day (the page always sends a Monday)
    const entries = await getWeekEntries(auth.userId, weekStart, addDays(weekStart, 6));
    return NextResponse.json(entries.map(toEntry));
}

export async function POST(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const parsed = parseEntryInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

    const { date, category, amount, note } = parsed.value;
    const entry = await createEntry(auth.userId, { date, category, amount: encryptAmount(amount), note });
    return NextResponse.json(toEntry(entry), { status: 201 });
}
