import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount } from '@/lib/crypto';
import { updateEntry, deleteEntry, parseEntryInput, parseEntryId } from '@/services/entries';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

const notFound = () => NextResponse.json({ message: 'Entry not found' }, { status: 404 });

/** Edits category, amount and/or note; the date stays */
export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const id = parseEntryId((await context.params).id);
    if (!id) return notFound();

    const parsed = parseEntryInput(await req.json().catch(() => null), true);
    if (!parsed.ok) return NextResponse.json({ message: parsed.error }, { status: 400 });

    const { category, amount, note } = parsed.value;
    const result = await updateEntry(auth.userId, id, {
        ...(category !== undefined && { category }),
        ...(amount !== undefined && { amount: encryptAmount(amount) }),
        ...(note !== undefined && { note }),
    });
    if (result.matchedCount === 0) return notFound();
    return NextResponse.json({ success: true });
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const id = parseEntryId((await context.params).id);
    if (!id) return notFound();

    const result = await deleteEntry(auth.userId, id);
    if (result.deletedCount === 0) return notFound();
    return NextResponse.json({ success: true });
}
