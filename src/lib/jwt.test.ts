import { signToken, verifyToken } from './jwt';

describe('session tokens', () => {
    const payload = { userId: 'u1', email: 'a@example.test', name: 'Alex' };

    it('signs and verifies a token with the user payload', async () => {
        const token = await signToken(payload);
        expect(await verifyToken(token)).toMatchObject(payload);
    });

    it('rejects a token that was tampered with', async () => {
        const [h, , s] = (await signToken(payload)).split('.');
        const forged = Buffer.from(JSON.stringify({ ...payload, userId: 'someone-else' })).toString('base64url');
        await expect(verifyToken(`${h}.${forged}.${s}`)).rejects.toThrow();
    });

    it('rejects garbage', async () => {
        await expect(verifyToken('not-a-token')).rejects.toThrow();
    });
});
