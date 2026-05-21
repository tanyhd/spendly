import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getSettings } from '@/services/mongodb';

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value;
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        const settings = await getSettings(payload.userId);
        const name = settings.displayName?.trim() || payload.name;
        return NextResponse.json({ userId: payload.userId, name, email: payload.email });
    } catch {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
}
