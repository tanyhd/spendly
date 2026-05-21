import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getSettings } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function GET(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const s = await getSettings(auth.userId);
    return NextResponse.json({
        displayName: s.displayName ?? '',
        defaultPage: s.defaultPage ?? 'dashboard',
    });
}
