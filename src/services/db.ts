import os from 'os';
import { MongoClient, ObjectId, type Db } from 'mongodb';

// ── Stored document shapes ──────────────────────────────────────────────────
// Amounts are AES-GCM strings (see lib/crypto); very old rows may still hold plain numbers.

export type StoredAmount = string | number;

export type UserDoc = {
    _id: ObjectId;
    email: string;
    name: string;
    password: string; // bcrypt hash
    createdAt: Date;
};

export type EntryDoc = {
    _id: ObjectId;
    userId: ObjectId;
    date: number; // YYYYMMDD
    category: string;
    amount: StoredAmount;
    note?: string;
    createdAt: Date;
    updatedAt?: Date;
};

export type PlanRowDoc = { label: string; category: string; amount: StoredAmount; recurring?: boolean };

export type PlanDoc = {
    _id: ObjectId;
    userId: ObjectId;
    year: number;
    month: number;
    income?: PlanRowDoc[];
    fixedExpenses?: PlanRowDoc[];
    updatedAt?: Date;
};

export type SettingsDoc = {
    _id: ObjectId;
    userId: ObjectId;
    displayName?: string;
    defaultPage?: string;
    updatedAt?: Date;
};

// ── Connection ──────────────────────────────────────────────────────────────
// One shared connection per server instance. The promise (not the client) is cached so
// concurrent first requests share it, and it lives on globalThis so dev hot reloads reuse it.
type Cache = { promise: Promise<Db> | null; client: MongoClient | null };
const g = globalThis as unknown as { __spendlyMongo?: Cache };
const cache: Cache = g.__spendlyMongo ?? (g.__spendlyMongo = { promise: null, client: null });

/** "mongodb+srv://user:secret@host/" → "mongodb+srv://host/" (never log credentials) */
function redact(uri: string) {
    return uri.replace(/\/\/[^@/]+@/, '//');
}

export async function connectToDb(): Promise<Db> {
    if (!cache.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('Missing env var: MONGODB_URI');
        // Hand the driver Node's os module: by default it loads it with a dynamic import(),
        // which Jest can't run, and the connection handshake then goes out empty
        const client = new MongoClient(uri, { runtimeAdapters: { os } });
        cache.client = client;
        cache.promise = client.connect()
            .then(() => {
                console.log(`Connected to MongoDB at ${redact(uri)}, db: ${process.env.MONGODB_DBNAME}`);
                return client.db(process.env.MONGODB_DBNAME);
            })
            .catch(err => {
                cache.promise = null; // let the next request retry
                throw err;
            });
    }
    return cache.promise;
}

/** Closes the shared connection (used by tests so the process can exit) */
export async function closeDb() {
    const client = cache.client;
    cache.promise = null;
    cache.client = null;
    if (client) await client.close();
}

/** Typed handles to every collection */
export async function collections() {
    const db = await connectToDb();
    return {
        users: db.collection<UserDoc>('users'),
        entries: db.collection<EntryDoc>('daily_entries'),
        plans: db.collection<PlanDoc>('monthly_plans'),
        settings: db.collection<SettingsDoc>('user_settings'),
    };
}

export function createObjectId() {
    return new ObjectId();
}

export function toObjectId(id: string) {
    return new ObjectId(id);
}

/** First and last day of a month as YYYYMMDD. "Day 31" also covers shorter months. */
export function monthRange(year: number, month: number) {
    return { start: year * 10000 + month * 100 + 1, end: year * 10000 + month * 100 + 31 };
}
