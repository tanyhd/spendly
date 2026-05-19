import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PUBLIC_ROUTES = ['/login', '/register'];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
    const token = request.cookies.get('token')?.value;

    if (!token) {
        if (isPublic) return NextResponse.next();
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        await jwtVerify(token, SECRET);
        if (isPublic) return NextResponse.redirect(new URL('/dashboard', request.url));
        return NextResponse.next();
    } catch {
        const res = NextResponse.redirect(new URL('/login', request.url));
        res.cookies.delete('token');
        return res;
    }
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
