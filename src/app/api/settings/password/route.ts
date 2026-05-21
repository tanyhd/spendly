import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { verifyToken } from '@/lib/jwt';
import { getUserById, updateUserPassword } from '@/services/mongodb';

async function getAuth(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    try { return await verifyToken(token); } catch { return null; }
}

export async function PUT(req: NextRequest) {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
        return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }
    if (newPassword.length < 8) {
        return NextResponse.json({ message: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const user = await getUserById(auth.userId);
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(auth.userId, hashed);

    return NextResponse.json({ ok: true });
}
