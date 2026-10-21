import pg from "pg";

const required = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing ${name} in application settings`);
  }
}

const port = Number(process.env.PGPORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PGPORT must be a valid port number");
}

if (process.env.PGUSER !== "client_tracker_app") {
  throw new Error("The application must use client_tracker_app");
}

export const db = new pg.Pool({
  port,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
});

db.on("error", (error) => {
  console.error("Idle database connection failed:", error.message);
});