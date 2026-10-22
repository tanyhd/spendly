import { POST as register } from './register/route';
import { POST as login } from './login/route';
import { GET as me } from './me/route';
import { POST as logout } from './logout/route';
import { setupTestDb } from '@/test/testDb';
import { req } from '@/test/requests';

const db = setupTestDb();

const NEW_USER = { name: 'Alex Tan', email: 'alex@example.test', password: 'password123' };

function tokenFrom(res: Response) {
    return /token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? '';
}

describe('POST /api/auth/register', () => {
    it('creates the user with a hashed password and signs them in', async () => {
        const res = await register(req('/api/auth/register', { method: 'POST', body: NEW_USER }));
        expect(res.status).toBe(200);
        expect(tokenFrom(res)).not.toBe('');

        const stored = await db.raw().collection('users').findOne({ email: NEW_USER.email });
        expect(stored?.name).toBe('Alex Tan');
        expect(stored?.password).not.toBe(NEW_USER.password);
        expect(stored?.password).toMatch(/^\$2[aby]\$/);
    });

    it.each([
        [{ ...NEW_USER, name: '' }, 400, 'All fields are required'],
        [{ ...NEW_USER, password: 'short' }, 400, 'Password must be at least 8 characters'],
    ])('rejects invalid input (%#)', async (body, status, message) => {
        const res = await register(req('/api/auth/register', { method: 'POST', body }));
        expect(res.status).toBe(status);
        expect((await res.json()).message).toBe(message);
    });

    it('refuses an email that is already registered', async () => {
        await register(req('/api/auth/register', { method: 'POST', body: NEW_USER }));
        const res = await register(req('/api/auth/register', { method: 'POST', body: NEW_USER }));
        expect(res.status).toBe(409);
        expect((await res.json()).message).toBe('Email already in use');
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await register(req('/api/auth/register', { method: 'POST', body: NEW_USER }));
    });

    it('signs in with the right password', async () => {
        const res = await login(req('/api/auth/login', { method: 'POST', body: { email: NEW_USER.email, password: NEW_USER.password } }));
        expect(res.status).toBe(200);
        expect(tokenFrom(res)).not.toBe('');
    });

    it.each([
        ['wrong password', { email: NEW_USER.email, password: 'wrongpass1' }],
        ['unknown email', { email: 'nobody@example.test', password: NEW_USER.password }],
    ])('gives the same error for a %s', async (_case, body) => {
        const res = await login(req('/api/auth/login', { method: 'POST', body }));
        expect(res.status).toBe(401);
        expect((await res.json()).message).toBe('Invalid email or password');
    });
});

describe('GET /api/auth/me', () => {
    it('returns the signed-in user, preferring their display name', async () => {
        const reg = await register(req('/api/auth/register', { method: 'POST', body: NEW_USER }));
        const token = tokenFrom(reg);
        const user = { token, userId: '', email: NEW_USER.email, name: NEW_USER.name };

        expect(await (await me(req('/api/auth/me', { user }))).json()).toMatchObject({ name: 'Alex Tan', email: NEW_USER.email });

        await db.raw().collection('user_settings').insertOne({ userId: (await db.raw().collection('users').findOne({}))!._id, displayName: 'AT' });
        expect((await (await me(req('/api/auth/me', { user }))).json()).name).toBe('AT');
    });

    it('is 401 without a valid session', async () => {
        expect((await me(req('/api/auth/me'))).status).toBe(401);
        expect((await me(req('/api/auth/me', { user: { token: 'garbage', userId: '', email: '', name: '' } }))).status).toBe(401);
    });
});

describe('POST /api/auth/logout', () => {
    it('clears the session cookie', async () => {
        const res = await logout();
        expect(res.headers.get('set-cookie')).toMatch(/token=;.*Max-Age=0/i);
    });
});
