// The database the DB tests run against. They empty every table they touch, so
// anything not named *_test is refused: a stray TEST_DATABASE_URL must never
// point them at the dev database.
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://quacker:quacker@localhost:5433/quacker_test';

const testDatabaseUrl = () => {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run DB tests against "${name}": the name must end in _test.`,
    );
  }
  return url;
};

module.exports = { testDatabaseUrl };
