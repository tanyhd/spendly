import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { encryptAmount } from '@/lib/crypto';
import { updateEntry, deleteEntry } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const { category, amount, note } = await req.json();

    const patch: Record<string, any> = {};
    if (category !== undefined) patch.category = category;
    if (amount !== undefined) patch.amount = encryptAmount(parseFloat(amount) || 0);
    if (note !== undefined) patch.note = note;

    await updateEntry(auth.userId, id, patch);
    return NextResponse.json({ success: true });
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    await deleteEntry(auth.userId, id);
    return NextResponse.json({ success: true });
}
