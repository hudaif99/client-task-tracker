# One-server HTTPS learning deployment

This is a single-process practice deployment: Caddy receives public traffic,
Next.js and Express listen only on loopback, and PostgreSQL stays private.
Do not open ports 3000, 4000 or 5432 in the EC2 security group. Allow HTTP/HTTPS;
restrict SSH to your own IP. Public signup remains enabled by the user's choice.
Email verification and password-reset delivery are still absent; use practice data.

## Application configuration

Keep all existing database credentials and the existing auth secret on the VPS.
Edit only the nonsecret settings below, substituting your real HTTPS hostname.
Never commit the real environment files.

`backend/.env`:

```dotenv
BETTER_AUTH_URL=https://tracker.example
TRUST_LOOPBACK_PROXY=true
```

`frontend/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
APP_ORIGIN=https://tracker.example
```

The two public origins must match exactly. On local development, leave
`APP_ORIGIN` unset, use `BETTER_AUTH_URL=http://127.0.0.1:4000`, and leave
`TRUST_LOOPBACK_PROXY` unset or false. HTTP is allowed only for that local auth URL.

Next.js server reads use `API_BASE_URL`. Browser auth requests use
`APP_ORIGIN/api/auth/*` and `/api/me`; browser client/task requests use
`APP_ORIGIN/api/clients/*`. The Caddyfile strips `/api` only for client/task
API routes, leaving frontend `/clients/:id` pages distinct from the API.
The server passes only the public URLs to interactive components.

`TRUST_LOOPBACK_PROXY=true` trusts forwarded addresses only from loopback peers.
Express must remain bound to `127.0.0.1`. The Caddyfile overwrites
`X-Forwarded-For` with the connecting client's address so public callers cannot
choose their own login rate-limit identity. Do not put another proxy/CDN in
front without reviewing this trust chain. The existing in-memory auth rate
limiter supports one backend process; counters reset when that process restarts.

## Deploy an agreed, committed revision

The user reviews, commits and pushes changes. On the VPS, verify that the working
tree is clean and use `git pull --ff-only`; stop if there are unexpected changes.
Configure the env files above before rebuilding.

Use the repository's `npm ci`, backend `npm run typecheck` and `npm test`, and
frontend `npm run lint`, `npm test` and `npm run build` as appropriate. Stop the
frontend service before rebuilding in its running directory to avoid serving
a partially replaced build, then start it again after a successful build.
Restart the backend service to load its new code/env. The service names used in
this lesson are `client-tracker-backend` and `client-tracker-frontend`.

Back up `/etc/caddy/Caddyfile`. Copy the contents of this directory's Caddyfile
there, replacing `tracker.example` with your hostname. Validate before reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy manages certificate issuance/renewal and redirects HTTP to HTTPS. Ensure
the hostname resolves to the current EC2 public IP. An auto-assigned address may
change after stopping and starting EC2; update DNS if it does. Rebooting the
instance is different from an EC2 stop/start.

## Live checkpoints (user-executed)

Close the SSH tunnel and open the HTTPS site. The old tunnel login cookie belongs
to `127.0.0.1`; sign in again on the HTTPS hostname with your existing account.
Verify signup, sign-in/out, client/task creation, editing, due dates, refresh and
deletion confirmation using practice data. Verify another account cannot read or
change the first account's clients/tasks. Do not share cookies or raw auth responses.

Inspect the browser's Network tab: browser API requests must target the HTTPS
hostname, never `127.0.0.1:4000`. Cookie-authenticated server reads must still work.
Check that an unauthenticated `GET /api/clients` returns 401 and that
`GET /clients/:id` routes to the frontend, not directly to Express.

Check service status and logs using `systemctl status` and `journalctl -u`.
The units currently pin Node to `/home/ubuntu/.nvm/versions/node/v24.22.1/bin/node`;
update and verify both units when moving to another Node version.

## Verification of this code increment

Backend typecheck and 47 tests passed; frontend lint, 39 tests and production build
passed. HTTP tests and Turbopack required an unrestricted rerun after the Windows
sandbox blocked localhost access/path resolution. The final diff check passed.
An isolated production-preview browser check used an in-memory API and browser
proxy interception to exercise sign-in, client creation, task creation/status,
reload and sign-out. Browser API requests used the public test origin and there
were no page exceptions. A 401 after sign-out was expected. No real DB writes,
migrations, commits, pushes or VPS app deployment were performed by the assistant.
This does not validate the actual Caddy routing or real HTTPS cookies; those
remain the user-executed deployment checks above. Local ignored test aids are
under `output/playwright/hosting-*`.

## Fresh database and remaining operations

The original ownership migration requires the original local account. Do not run
the entire historical migration chain against an empty database without the fresh
bootstrap steps. In this lesson the user applied the first 12 migrations, verified
zero clients/accounts, then transactionally created the ownership column/FK/index
and INSERT grant and recorded `1792413217388_add-client-ownership` in `pgmigrations`.
The remaining due-date migration was then applied normally. Existing migration
files were not edited. Do not repeat that bootstrap on this already initialized DB.

The user verified both runtime/migrator logins and selected runtime privileges.
A restore rehearsal, off-server backups, update rollback procedure, and email
delivery remain separate learning checkpoints. A working website does not verify
these operations. Keep database setup, migration, backup and restore execution
user-controlled.
