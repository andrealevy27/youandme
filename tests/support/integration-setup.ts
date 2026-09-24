/**
 * Integration tests run against a real Postgres database (default: youandme_test).
 * NEVER point TEST_DATABASE_URL at a database with data you care about — tables are truncated.
 */
const url = process.env.TEST_DATABASE_URL ?? "postgres://youandme:youandme@localhost:5432/youandme_test";
if (!/test/.test(url)) throw new Error(`Refusing to run integration tests against a non-test database: ${url}`);
process.env.DATABASE_URL = url;
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.PAYMENTS_PROVIDER = "dev";
process.env.AI_PROVIDER = "none";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
