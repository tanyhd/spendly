import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export interface JwtPayload {
    userId: string;
    email: string;
    name: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
    return await new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JwtPayload;
}
