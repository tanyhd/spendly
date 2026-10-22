// In-memory MongoDB for service and API-route tests. Real queries, no mocks, and never a real database.
//
//   const db = setupTestDb();          // in a test file: starts before, stops after, wipes between tests
//   await db.raw().collection('users').findOne(...)   // look at what was actually stored
import { MongoMemoryServer } from 'mongodb-memory-server';
import { closeDb, connectToDb } from '@/services/db';
import type { Db } from 'mongodb';

export function setupTestDb() {
    let server: MongoMemoryServer;
    let db: Db;

    beforeAll(async () => {
        server = await MongoMemoryServer.create();
        process.env.MONGODB_URI = server.getUri();
        db = await connectToDb();
    });

    afterEach(async () => {
        const collections = await db.collections();
        await Promise.all(collections.map(c => c.deleteMany({})));
    });

    afterAll(async () => {
        await closeDb();
        await server?.stop();
    });

    return { raw: () => db };
}
