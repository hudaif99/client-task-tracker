# Client & Task Tracker

A full-stack learning project for managing clients and their tasks.

## Features

- Email/password signup, sign-in, and sign-out.
- Each account manages its own clients and tasks.
- Create, rename, and delete clients, with confirmation before deleting their tasks.
- Create and edit tasks, change their status, and set optional due dates.
- Pending/completed filters, task pagination, and overdue/today indicators.

## Stack

- **Frontend:** Next.js, React, TypeScript.
- **Backend:** Express, Node.js, TypeScript, Better Auth.
- **Database:** PostgreSQL, with `pg` and SQL migrations.
- **Package manager:** npm.

## Local setup

Requires Node.js 24+, npm, and a configured local PostgreSQL database.
Commands below use PowerShell, from the project root.

Install dependencies:

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
```

Configure the environment files using the included templates:

- `backend/.env`: PostgreSQL settings for `client_tracker_app`, a private random
  `BETTER_AUTH_SECRET` of at least 32 characters, and
  `BETTER_AUTH_URL=http://127.0.0.1:4000`.
- `backend/.env.migrations`: PostgreSQL settings for `client_tracker_migrator`.
- `frontend/.env.local`: `API_BASE_URL=http://127.0.0.1:4000`.

Database roles and schema must be prepared separately. Migrations are in
`backend/migrations`. The ownership migration includes a one-time assignment to
the original practice account; review that requirement before setting up a new
database. Existing applied migrations must remain unchanged.

Start the backend and frontend in separate terminals:

```powershell
npm.cmd --prefix backend run dev
```

```powershell
npm.cmd --prefix frontend run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The backend runs at
`http://127.0.0.1:4000`. Use `127.0.0.1` consistently for authentication cookies.

## Checks

```powershell
npm.cmd --prefix backend run typecheck
npm.cmd --prefix backend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
```

This project is intended for local learning. Public deployment requires further
configuration, including email verification and password-reset delivery.
