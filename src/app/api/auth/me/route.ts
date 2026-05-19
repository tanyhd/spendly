import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value;
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        return NextResponse.json({ userId: payload.userId, name: payload.name, email: payload.email });
    } catch {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
}
