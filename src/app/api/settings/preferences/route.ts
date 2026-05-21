import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { upsertSettings } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function PUT(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { displayName, defaultPage } = await req.json();
    await upsertSettings(auth.userId, { displayName, defaultPage });
    return NextResponse.json({ ok: true });
}
