import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/services/mongodb';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        const user = await findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
        }

        const token = await signToken({ userId: user._id.toString(), email: user.email, name: user.name });

        const res = NextResponse.json({ name: user.name, email: user.email });
        res.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
