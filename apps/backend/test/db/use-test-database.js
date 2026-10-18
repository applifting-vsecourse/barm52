const { testDatabaseUrl } = require('./database-url');

// Runs before each DB test file. PrismaService reads DATABASE_URL when it is
// constructed, so this points every client the tests create at the test
// database.
process.env.DATABASE_URL = testDatabaseUrl();
