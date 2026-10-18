// `pnpm backend test:db`: tests that need a real Postgres, in *.db-spec.ts
// files. They run against their own database (`quacker_test` in the dev
// container, or TEST_DATABASE_URL), never the dev one. `pnpm backend test`
// stays database-free: its testRegex, `\.spec\.ts$`, doesn't match these files.
const { jest: unitConfig } = require('./package.json');

module.exports = {
  ...unitConfig,
  testRegex: '\\.db-spec\\.ts$',
  // Only TypeScript goes through ts-jest; the setup files below are plain JS.
  transform: { '^.+\\.ts$': 'ts-jest' },
  globalSetup: '<rootDir>/test/db/global-setup.js',
  setupFiles: ['<rootDir>/test/db/use-test-database.js'],
  // Real round trips to Postgres, some of them deliberately contended.
  testTimeout: 30000,
};
