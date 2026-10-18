const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { testDatabaseUrl } = require('./database-url');

// Runs once before the DB tests. `prisma migrate deploy` creates the database
// when it is missing and applies any pending migrations. Unlike `migrate reset`
// it never runs the seed.
module.exports = () => {
  try {
    execFileSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: path.resolve(__dirname, '../..'),
        // prisma.config.ts loads .env, but dotenv leaves variables that are
        // already set alone, so this URL wins over the dev one.
        env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    // Quiet when it works; the whole output when it doesn't.
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
};
