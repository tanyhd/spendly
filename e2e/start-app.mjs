// Starts Spendly for the end-to-end tests on a throwaway in-memory MongoDB, never Atlas.
// Playwright runs this (see playwright.config.ts); you can also run it by hand to poke around:
//
//   node e2e/start-app.mjs          → http://localhost:3100, empty database, test-only secrets
//
// It builds into .next-e2e so it can run next to your own `npm run dev` on port 3000.
import { spawn } from 'child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = process.env.E2E_PORT ?? '3100';
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
    throw new Error(`Refusing to run end-to-end tests against a non-local database: ${uri}`);
}
console.log(`[e2e] in-memory MongoDB at ${uri}`);

// Real environment variables win over .env.local, so these replace the Atlas settings for this server only
const env = {
    ...process.env,
    MONGODB_URI: uri,
    MONGODB_DBNAME: 'spendly-e2e',
    JWT_SECRET: 'e2e-only-jwt-secret',
    ENCRYPTION_KEY: '00000000000000000000000000000000000000000000000000000000000000e2',
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_TELEMETRY_DISABLED: '1',
};

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', port], { env, stdio: 'inherit' });

async function shutdown(code) {
    child.kill();
    await mongo.stop();
    process.exit(code ?? 0);
}
child.on('exit', code => shutdown(code));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(0));
