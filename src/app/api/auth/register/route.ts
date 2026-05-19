import { NextResponse } from 'next/server';
import { findUserByEmail, createUser, createObjectId } from '@/services/mongodb';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return NextResponse.json({ message: 'Email already in use' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = createObjectId();
        const userId = id.toString();

        // Sign token before insert — if this fails, nothing is written to DB
        const token = await signToken({ userId, email, name });

        // Insert only after token is ready — if this fails, token was never sent
        await createUser(id, email, name, hashedPassword);

        const res = NextResponse.json({ name, email });
        res.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return res;
    } catch (error) {
        console.error('[register]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
