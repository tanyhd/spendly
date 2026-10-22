// Builds requests for calling API route handlers directly in tests, signed in as a given user.
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/jwt';
import { createUser } from '@/services/users';
import { createObjectId } from '@/services/db';

export type TestUser = { userId: string; email: string; name: string; token: string };

let counter = 0;

/** Creates a user in the test DB and a valid session token for them */
export async function makeUser(name = 'Test User'): Promise<TestUser> {
    const id = createObjectId();
    const email = `user${++counter}.${Date.now()}@example.test`;
    await createUser(id, email, name, 'not-a-real-hash');
    const userId = id.toString();
    return { userId, email, name, token: await signToken({ userId, email, name }) };
}

/** A request to `path` with an optional JSON body and the user's session cookie */
export function req(path: string, opts: { method?: string; body?: unknown; user?: TestUser | null } = {}) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.user) headers.cookie = `token=${opts.user.token}`;
    return new NextRequest(`http://localhost${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
}

/** Route context for dynamic segments, e.g. ctx({ year: '2026', month: '10' }) */
export function ctx<T extends Record<string, string>>(params: T) {
    return { params: Promise.resolve(params) };
}
