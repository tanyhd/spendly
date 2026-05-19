import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptAmount(amount: number): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(amount), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptAmount(value: string | number): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string' || !value.includes(':')) return parseFloat(value) || 0;
    try {
        const [ivHex, authTagHex, dataHex] = value.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const data = Buffer.from(dataHex, 'hex');
        const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return parseFloat(decrypted.toString('utf8')) || 0;
    } catch {
        return 0;
    }
}
