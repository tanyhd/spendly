// Fixed, test-only secrets so services can encrypt and sign tokens. Never used outside Jest.
process.env.ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
process.env.JWT_SECRET = 'test-only-jwt-secret-for-spendly-jest';
process.env.MONGODB_DBNAME = 'spendly-test';
// Service tests point MONGODB_URI at an in-memory MongoDB (src/test/testDb.ts); never a real database
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/not-a-real-db';
