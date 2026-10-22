import { encryptAmount, decryptAmount } from './crypto';

describe('amount encryption', () => {
    it('round-trips amounts, including decimals and zero', () => {
        for (const n of [0, 12.5, 1234.56, 0.01]) {
            expect(decryptAmount(encryptAmount(n))).toBe(n);
        }
    });

    it('stores ciphertext, not the number, and a fresh IV each time', () => {
        // A distinctive amount: random hex can't contain a "." so the plain value can't show up by chance
        const a = encryptAmount(1234.56);
        const b = encryptAmount(1234.56);
        expect(a).not.toContain('1234.56');
        expect(a).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
        expect(a).not.toBe(b);
    });

    it('reads old plain values left from before encryption', () => {
        expect(decryptAmount(15)).toBe(15);
        expect(decryptAmount('15.5')).toBe(15.5);
    });

    it('returns 0 instead of throwing for tampered or garbage values', () => {
        const [iv, tag, data] = encryptAmount(99).split(':');
        expect(decryptAmount(`${iv}:${tag}:${data.replace(/.$/, c => (c === '0' ? '1' : '0'))}`)).toBe(0);
        expect(decryptAmount('not:a:value')).toBe(0);
        expect(decryptAmount('')).toBe(0);
    });
});
