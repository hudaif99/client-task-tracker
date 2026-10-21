import pg from "pg";

const required = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
] as const;

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing ${name} in .env.migrations`);
  }
}

const port = Number(process.env.PGPORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PGPORT must be a valid port number");
}

const client = new pg.Client({
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});

try {
  await client.connect();

  const result = await client.query<{
    database: string;
    username: string;
  }>(
    "SELECT current_database() AS database, current_user AS username"
  );

  console.log(result.rows[0]);
} catch (error) {
  console.error("Database connection check failed.");

  if (error instanceof Error) {
    console.error(error.message);
  }

  process.exitCode = 1;
} finally {
  await client.end();
}