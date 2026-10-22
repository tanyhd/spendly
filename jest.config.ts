import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
    testEnvironment: 'node',
    // Tests live next to the code they cover (foo.test.ts) or in __tests__/
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    setupFiles: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // Each test file that needs a database starts its own in-memory MongoDB; the first run downloads it
    testTimeout: 60_000,
    // Coverage counts every source file, not only those the tests load, so untested code shows as 0%
    collectCoverageFrom: ['src/**/*.{ts,tsx,js}', '!src/**/*.test.ts', '!src/test/**'],
};

// jose (JWT library) ships only as ES modules, so Jest must transform it like our own code.
// next/jest sets its own ignore list, so adjust it after the config is built.
export default async function jestConfig() {
    const built = await createJestConfig(config)();
    return {
        ...built,
        // next/jest's patterns already exempt a few packages: "(geist|next...)" → add jose to that list
        transformIgnorePatterns: (built.transformIgnorePatterns ?? []).map(p => p.replace('(geist|', '(jose|geist|')),
    };
}
