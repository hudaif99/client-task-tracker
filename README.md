# Client & Task Tracker

A small learning project for building a full-stack web application.

## Agreed architecture

- Frontend: Next.js App Router, React, and strict TypeScript.
- Backend: a separate Express application on Node.js, with strict TypeScript.
- Database: local PostgreSQL, SQL queries through `pg`, and SQL migrations through `node-pg-migrate`.
- Package manager: npm, with separate lockfiles for frontend and backend.
- Both projects use ES modules (`import`/`export`).
- The frontend reads clients and tasks through Server Components. Client Components send create, rename, and delete requests from the browser to Express. Database access and business operations belong in Express.
- The generated frontend includes Tailwind CSS and Cache Components. Authentication setup is in progress; final visual design and hosting remain undecided.
- The Tailwind loader targets `globals.css` only, keeping Next.js's native `.module.css` handling intact.

The agreed access model for this practice app is individual ownership: each signed-in user owns their clients, and tasks inherit access through their client. Express must enforce this ownership on every protected read and write using the authenticated identity. The user chose email/password sign-in first and installed Better Auth 1.7.11. Backend auth-options.ts/auth.ts now define the local auth configuration using the existing app pool, 15–128-character passwords, and explicit auth table names. Auth is now mounted in Express at /api/auth/*; client/task ownership enforcement is implemented. Email/password sign-in, sign-out, and frontend session forwarding are implemented; the user verified browser sign-in, session persistence, task-page navigation, sign-out, signed-out redirects and account isolation. Signup UI is implemented at /sign-up; the user accepted the signup checkpoint after testing it. The user applied the ownership migration and verified all 7 existing clients belong to their account, with zero unassigned.

Backend .env requires a private BETTER_AUTH_SECRET and BETTER_AUTH_URL=http://127.0.0.1:4000. Auth trusts the local frontend at http://127.0.0.1:3000; use that hostname consistently when auth flows are enabled. Rate limiting is enabled in memory for this single-process lesson. Email verification and password-reset delivery must be configured before public sign-ups. The compiler includes Web API types and only the SQLite declarations from the bun-types dev dependency because Better Auth references those declarations; runtime remains Node.js with PostgreSQL and full declaration checking.

From backend, `npm.cmd run auth:generate` uses read-only metadata inspection and Better Auth's SQL compiler to write ignored generated/auth-schema.sql. This is a bootstrap-only generator for four absent auth tables: auth_user (identity), auth_account (credential hashes), auth_session (sessions), and auth_verification (verification/reset records). It never applies SQL and refuses existing-table changes. The user applies reviewed SQL through node-pg-migrate. The user applied 1792409482349_create-auth-tables.sql and verified all four auth tables belong to client_tracker_migrator. The user also applied 1792409800804_grant-auth-access.sql and verified SELECT/INSERT/UPDATE on all four auth tables, with DELETE limited to auth_session/auth_verification. Backend typecheck and 30 tests passed for this preparation step.

## Database accounts and settings

The development database is `client_tracker_dev`. Roles are provisioned manually:

- `postgres`: administrator for initial database and account setup.
- `client_tracker_migrator`: database owner, used for schema and permission migrations.
- `client_tracker_app`: application login, allowed to read/delete clients, insert their names and owner IDs, update their names, read tasks, insert task client IDs and titles, and update task titles and status. Task status, identity, and creation time are supplied by PostgreSQL defaults on creation.

Backend `.env` contains the application account's PostgreSQL settings. Backend `.env.migrations` contains the migration account's settings. These files are ignored by Git; example files contain placeholders only.

Frontend `.env.local` sets `API_BASE_URL=http://127.0.0.1:4000`. PostgreSQL credentials belong only in the backend.

Express enables CORS for `http://localhost:3000` and `http://127.0.0.1:3000`, with GET/POST/PATCH/DELETE and the Content-Type header. Credentialed CORS is enabled for these exact origins. CORS governs browser response access; it is separate from authentication. Update the allowed origins when deployment URLs are chosen.

Database changes are recorded in `backend/migrations`. Keep applied migrations unchanged; create a new migration for subsequent changes. Apply them from the backend folder with `npm.cmd run migrate -- up`.

## Run locally

After installing dependencies in each folder and configuring the local database:

1. In `backend`, run `npm.cmd run dev` (listens on `127.0.0.1:4000`).
2. In `frontend`, run `npm.cmd run dev` (normally port 3000).

This is a local learning application. Backend authentication and ownership checks are implemented; frontend auth integration and production readiness remain pending.

## Ownership enforcement

Every `/clients` route, including nested task routes, checks the session before accessing data. Missing/invalid sessions return 401; session lookup failures return 500 without accessing client/task data. Responses use `Cache-Control: no-store`. Another user's resource returns the same 404 as a missing resource, without disclosing task counts.

New clients take `owner_id` from the session, ignoring body-supplied owner IDs. Client SQL includes the owner; task SQL checks the owning parent. Deletion locks the owned client before counting tasks and retains the existing confirmation and transaction behavior. Browser writes reject untrusted Origin headers and cross-site fetch metadata; requests without Origin remain supported for local PowerShell lessons.

The ownership migration requires a valid owner, indexes `(owner_id, id DESC)`, permits INSERT(owner_id) for the runtime role but not owner reassignment, and restricts deletion of accounts that still own clients. No account-deletion workflow is implemented.

The frontend forwards Better Auth cookies on uncached server reads and includes credentials on browser writes. Signed-out page reads redirect to /sign-in. Mutations receiving 401 retain visible drafts, block further submission, and offer a sign-in link with a reminder to copy unsaved text. Sign-in/out use full document navigation to discard the current client router cache. Use http://127.0.0.1:3000 consistently; the localhost sign-in page links to that hostname while preserving the frontend port.

`backend/src/app.ts` builds the Express app with supplied database/auth dependencies so HTTP tests can run without PostgreSQL. `server.ts` supplies the real dependencies and starts the server. Tests cover unauthenticated access, two simulated owners, forged IDs, owned operations, deletion confirmation, and session/origin failures. They do not prove live PostgreSQL permissions, locking or cascade behavior.

## Frontend sign-in checkpoint

Open http://127.0.0.1:3000/sign-in and use an existing practice account. Sign-in posts directly to Express and then confirms the expected public identity through /api/me; auth response tokens are never stored, logged or rendered. Sign-out calls Express and checks that the browser session is absent before navigating away. This browser check alone does not prove server-side revocation; the user previously verified revocation separately by replaying the old session cookie. Network/uncertain results offer session checks without automatically repeating auth writes. Signup UI is available at /sign-up. Password reset and email verification UI are deferred.

Next.js development mode explicitly allows 127.0.0.1 through allowedDevOrigins in next.config.ts. This keeps its development endpoints working on the hostname used for auth cookies. Without it, the page could display while React handlers failed to attach. The fix was checked on the running dev server using an intercepted fake sign-in response; real account verification remains user-executed.

Frontend lint, build (including TypeScript), and 25 unit tests passed. An isolated production preview with an in-memory API passed browser checks for signed-out redirects, wrong credentials, rate limiting, keyboard focus, lost/malformed-response recovery, HttpOnly cookies, server cookie forwarding, reload, six mutation-401 paths preserving drafts, sign-out recovery, account switching, inaccessible tasks, canonical hostname and a 320px viewport. Desktop/mobile screenshots were inspected. Only fake accounts/data were used; no real database writes or migrations were run. The preview was stopped. The user subsequently verified real browser sign-in with 7 clients, session persistence after reload, task-page navigation, sign-out, protected-page redirects while signed out, and an empty client list after signing into the second practice account. The user subsequently verified authenticated browser client/task creation and reload persistence, plus absence of the new client from the original account; see the signup checkpoint.

## Signup checkpoint

/sign-up uses the existing Express email/password signup endpoint with name, email, password and confirmation fields. Passwords must match exactly and meet the configured 15-128-character limits. Only name/email/password are sent. A matching public /api/me identity confirms sign-in before a full navigation to the client list. There are no new dependencies or migrations.

Rejected submissions preserve fields. Uncertain creation clears passwords and locks account creation, offering a session check and sign-in with the same email. A missing session cannot prove that creation failed, so it never silently unlocks or repeats signup. Auth response tokens are not read or stored.

Frontend lint, build including TypeScript, and 27 tests passed. Fake-account browser checks covered validation, rejections, duplicate prevention, uncertain outcomes, matching session recovery, empty clients, reload/sign-out, keyboard and 320px layout; screenshots were inspected. A separate development-mode fixture check verified hydration and submission. No real database/auth writes were run by the assistant. The user subsequently reported "Everything looks fine on my test" after receiving the real signup/automatic sign-in/empty-list checkpoint. This records acceptance of the signup increment, not separate live confirmation of every validation/error scenario. The user subsequently confirmed creating New account practice and persistence after reload, its absence from the original account, and creation of Practice task with the requested reload check. Basic owned client/task creation is user-verified. The user also confirmed task rename/completed status after reload, the extra deletion warning for a practice client with 2 tasks, preservation on Cancel, and final client deletion. These are user-reported results; no new SQL cascade check was performed. Cross-account task-update/deletion write attempts remain simulated-test coverage.

## Task due-date backend checkpoint

The user applied 1792561553004_add-task-due-date.sql and verified a nullable date column plus runtime INSERT/UPDATE permission. Task creation optionally accepts due_date as YYYY-MM-DD or null; omission means no due date. PATCH accepts due_date alone or with title/status: omission preserves the existing date and null clears it. Real calendar dates in years 0001-9999 are accepted, including past dates. Invalid values reject the entire write with HTTP 400 / INVALID_TASK_DUE_DATE.

Task GET/POST/PATCH responses include due_date as YYYY-MM-DD or null. SQL explicitly formats date values before pg parses them, avoiding timezone shifts. Existing title/status-only edits preserve due dates. Backend typecheck and 44 tests passed using simulated data; the user subsequently verified live due-date writes through the page. Frontend due-date controls are now implemented: optional date during creation, saved date/no-date display, and an inline editor with Save due date, Clear date and Cancel.

Frontend lint, build including TypeScript, and 31 tests passed for the date controls. Isolated fake-data browser checks covered setting/clearing/reload, Cancel/focus, duplicate prevention, filter/cursor preservation, response validation, failure recovery, optional date creation, partial native date inputs and 320px layout. Screenshots were inspected. Drafts survive recoverable failures; uncertain writes require explicit checking before another save. No real records were written by these checks. The user confirmed live UI checks for setting an existing task date and reloading, clearing/saving/reloading with the requested title/status preservation, and creating Due date practice with 1 November 2026 followed by reload. The optional due-date increment is complete. These write results were reported by the user. Browser paste protection remains enabled; console commands are unnecessary.

## Due indicators

Pending tasks due before the browser's local calendar day show Overdue; tasks due today show Due today. Completed, undated and future tasks have no notice. A shared per-list browser clock refreshes at midnight and when the page regains focus/visibility. It avoids deriving local dates from UTC or the server timezone and keeps SSR/hydration consistent. No database migration is required.

Frontend lint, build including TypeScript, and 33 tests passed. Isolated browser checks with fake data passed in Asia/Kolkata and America/Los_Angeles, including local-date boundaries, midnight rollover, date/status refresh, focus/visibility recovery, light/dark styling and 320px layout. Screenshots were inspected. No real database writes occurred. The user subsequently replied "yes works" after the real-page checkpoint for yesterday -> Overdue, today -> Due today, and Completed -> notice disappears. The due-indicator increment is accepted; timezone and midnight behavior are supported by the automated fixture checks described above.

## Current API

- `/api/auth/*`: Better Auth's email/password/session endpoints. `GET /api/auth/ok` returns `{ "ok": true }`. JSON bodies are limited to 2 KB; payloads using other media types are rejected. The installed Node adapter's parsed-body support is covered by HTTP tests. Auth routes return `Cache-Control: no-store` and receive a server-derived connection IP for rate limiting. The direct local server overwrites the internal IP header; configure actual trusted proxies before deploying behind one.
- `GET /api/me`: returns `{ "data": { "id": "...", "name": "...", "email": "..." } }` for a valid session cookie, or HTTP 401 with `UNAUTHENTICATED`. It reads the session without renewing it or using a cookie cache, returns no session token, and is not cached. HTTP 500 uses `AUTH_SESSION_FAILED`.

Current auth checkpoint: backend typecheck and 32 tests passed, including simulated HTTP transport/session tests. Live checks passed for health, auth readiness, missing session rejection, an empty session read, credentialed CORS and origin restrictions, and existing client reads. No real auth records were created by these checks. The user created a practice account in PowerShell and confirmed /api/me returns the same identity using trackerSession. The user also verified sign-out revoked the previous session (replaying its cookie returned 401), then signed in again and confirmed the same identity. The backend authentication lifecycle is user-verified. Ownership migration 1792413217388_add-client-ownership.sql is now user-applied and verified (7 total clients, 7 assigned to the intended account, 0 unassigned). Never display or share passwords, raw auth responses, or cookie values. All client/task endpoints now require a session and enforce ownership. Latest backend typecheck and 38 tests passed using simulated auth/database fixtures; the user verified 7 own clients, 401 without a session, 0 clients for a second account, 404 for direct access to the first account's client/tasks, and a rejected cross-account rename with the original name unchanged. The user subsequently accepted owned task updates and client deletion with task confirmation/cancellation. Cross-account task-update/deletion write attempts remain unverified live.

- `DELETE /clients/:id`: permanently removes the specified client and returns HTTP 200 with `{ "data": { "id": ..., "name": ... } }`. Clients without tasks need no body. With tasks, the first request returns 409 with `{ "error": { "code": "CLIENT_TASKS_CONFIRMATION_REQUIRED", "message": "...", "taskCount": 2 } }` without deleting anything. After an additional user confirmation, send `application/json` with `{ "confirmTaskDeletion": true, "expectedTaskCount": 2 }`. A changed count returns another 409, including when it drops to zero. Invalid IDs/confirmation bodies return 400; missing clients return 404. An unexpected failure returns `CLIENT_DELETE_UNCONFIRMED`; refresh the list before retrying.

Tasks belong to clients through `tasks.client_id` with `ON DELETE CASCADE`; titles require 1–200 characters with non-whitespace content, and status is `pending` or `completed`. The foreign key column is indexed. Task creation and listing are available through the API and client tasks pages; task title editing is available through the API and inline page controls. Client deletion locks the parent row with `FOR UPDATE`, then counts tasks and deletes within one transaction on one pooled connection. The lock blocks new foreign-key references until the transaction finishes. No lock is held while waiting for user confirmation. PostgreSQL cascades the deletion atomically. Database writes made directly in SQL Shell bypass the API confirmation, so use the API for ordinary client deletion.

- `GET /health`: confirms the Express process responds; it does not check PostgreSQL.
- `PATCH /clients/:clientId/tasks/:taskId`: accepts `application/json` with a title, status, due_date, or a combination, such as `{ "title": "Revise proposal" }` or `{ "status": "completed" }`. At least one supported field is required (`INVALID_TASK_UPDATE` otherwise). Each supplied field is validated before writing; titles use the same trimming and 1–200 character rules as creation. Explicit null title/status values are invalid; null due_date clears the date. Omitted fields keep their existing values, using COALESCE for title/status and an explicit presence flag for due_date. Updates filter by both task ID and client ID, and return HTTP 200 with `{ "data": { ... } }`. Status is assigned explicitly, not toggled. Invalid IDs/titles/status/due dates return 400; a missing task or one outside the specified client returns 404 with `TASK_NOT_FOUND`. Other body fields are ignored. Unexpected failures return `TASK_UPDATE_UNCONFIRMED`; refresh the list before retrying. Concurrent edits to the same field use the last saved value. Current inline title controls send title-only updates; the due-date editor sends only due_date and validates the exact returned date.
- `GET /clients/:clientId/tasks`: returns `{ "data": [...], "pagination": { "nextBeforeId": 42 } }` with up to 50 of that client's tasks, newest ID first. Optional `?status=pending` or `?status=completed` filters in PostgreSQL before the page limit; omitted status or `status=all` includes both statuses. Optional `before=42` returns IDs strictly below 42, preserving the same client/status scope. The query reads one extra row to detect an older page; `nextBeforeId` is the last returned ID when more tasks exist, otherwise null. It is a position boundary, not proof that a task with that ID still exists. Invalid/empty/repeated status values return 400 with `INVALID_TASK_FILTER`; invalid/empty/repeated cursor IDs return `INVALID_TASK_CURSOR`. Invalid client IDs return 400, missing clients return 404, and existing clients with no matching tasks return an empty array with a null cursor. Client existence and tasks are read separately; a simultaneous deletion can result in an empty list. Pages reflect current data: changed statuses or deletions may alter later results; this is not a frozen snapshot.
- `POST /clients/:clientId/tasks`: accepts `application/json` such as `{ "title": "Prepare proposal" }` and returns HTTP 201 with `{ "data": { "id": ..., "client_id": ..., "title": ..., "status": "pending", "created_at": ... } }`. The title is trimmed, limited to 1–200 Unicode characters, and rejects null characters. Only the URL supplies the client ID; body fields such as status and ID are ignored. The foreign key ensures that the client exists, including during concurrent deletion; a missing client returns 404. Invalid titles or due dates return 400. Omitted/null due_date creates an undated task; a valid YYYY-MM-DD sets the date. Task responses include due_date as a string or null. Unexpected insert failures return `TASK_CREATE_UNCONFIRMED`; check the task list before retrying.
- `GET /clients`: returns `{ "data": [...] }`, ordered by descending ID so new clients appear first, with a maximum of 50 records. Pagination remains a later increment.
- `GET /clients/:id`: returns `{ "data": { "id": ..., "name": ..., "created_at": ... } }` for one client, including clients outside the home page's latest 50. Invalid IDs return 400; missing clients return 404.
- `POST /clients`: accepts an `application/json` body such as `{ "name": "Acme" }`. Trims the name, requires 1–120 Unicode code points, and rejects null characters. PostgreSQL generates the ID and creation time. Duplicate names are allowed.
- `PATCH /clients/:id`: accepts the same name body, updates only that client's name, and returns HTTP 200 with `{ "data": { ... } }`. IDs must be canonical positive decimal integers in the PostgreSQL `integer` range (1–2147483647). Invalid IDs/names return 400 and a missing client returns 404. The ID and creation time remain unchanged. An unexpected update failure returns `CLIENT_UPDATE_UNCONFIRMED`; refresh the list to check the result before retrying.

Creation returns HTTP 201 and `{ "data": { ... } }`. Invalid names or JSON return 400; oversized bodies return 413; unsupported media types or encodings return 415. JSON request bodies are limited to 2 KB. Errors use `{ "error": { "code": "...", "message": "..." } }`.

An unexpected insert failure returns `CLIENT_CREATE_UNCONFIRMED`. Check the client list before retrying, since a connection failure can occur after a write commits.

The create form disables submission while saving and refreshing. Confirmed saves clear the name and refresh the list. Rejections preserve input. An uncertain result preserves and locks the entry, with actions to refresh the list and deliberately start a new entry; it never automatically retries the write.

Each client has an inline Edit form. Save sends PATCH with the row's ID, validates the returned ID, and refreshes the list after confirmation. Cancel discards the draft without sending a request. Rejected requests preserve the draft; unconfirmed updates lock Save and offer a list refresh. Close the editor after checking the saved name before starting another edit. Concurrent edits currently use the last saved name; revisit conflict detection before supporting multiple users.

## Verification commands

Task lists now have Older tasks and Newest tasks links, using a `before` cursor in the URL. Older preserves the selected status filter; Newest and changing filters reset the cursor. Refresh, browser history, and confirmed saves keep the current page URL. Mutation URLs contain neither cursor nor filter. Older pages explain that newly created tasks appear on the newest page under Pending or All. Invalid and exhausted cursors have a Newest recovery link. No migration was needed.

Pagination verification passed backend typecheck and 28 tests; frontend lint, build (including TypeScript), and 23 tests. SELECT-only generated PostgreSQL rows exercised 11 pages, client/status isolation, ID gaps, ordering, exact 0/49/50/51-row boundaries, and exhausted cursors. An isolated production preview with 121 in-memory tasks exercised three browser pages, filters, reload/history, invalid/repeated cursors, keyboard, mutation URL/page preservation, and 320px layout. Three browser writes were intercepted. Live API/page checks were read-only. No database objects or records were created by these checks, and the temporary preview was stopped. The user subsequently accepted this step with "looks ok" after being given the manual cursor/Newest checkpoint; this does not independently verify every manual assertion.

The task page has All/Pending/Completed links backed by URL query parameters, so reload and browser Back/Forward preserve the selected view. The Server Component passes the selected filter to Express while all mutation URLs stay unfiltered. Saved changes refresh the same URL. A status change that leaves the selected filter moves keyboard focus to the Tasks heading before refreshing. Completed explains that new tasks start pending. Empty and invalid-filter views offer clear feedback. No schema or permission changes were needed.

Filter checks passed with read-only live API requests, frontend/backend input tests, browser navigation and 320px layout checks, and intercepted create/title/status writes. The user subsequently confirmed the manual checks for moving a task from Pending to Completed and preserving the selected filter after reload. No real database writes were made by the assistant's checks.

Each task also has an inline title editor with Edit, Save title, and Cancel. It sends only the trimmed title to Express and checks the response's task ID, client ID, and exact saved title before closing and refreshing. Cancel discards the draft and restores focus to Edit. Validation rejections preserve the draft. Unconfirmed saves keep and lock the draft with refresh and an explicit Continue editing after checking action; no write retries automatically. Missing tasks stay locked until refreshed. The input ID includes the client/task IDs and React useId to avoid collisions across preserved pages.

Title-editor browser checks covered cancellation, keyboard focus, validation, Enter submission, duplicate prevention, success, rejected/missing/uncertain responses, recovery, Unicode limits, and a 320px viewport. All writes were intercepted. The user verified real title saves through the API and subsequently confirmed the page checks passed after being asked to check saving/reload persistence, unchanged status, and Cancel.

Each task shows a Mark completed or Mark pending button. It posts the chosen status via PATCH and refreshes the server-rendered list only after validating the returned task/client IDs and requested status. Changes are blocked during saving and refresh. Unconfirmed responses lock further changes and offer refresh plus a deliberate Continue after checking action; no write is retried automatically. A missing-task response stays locked and offers refresh. Controls use `aria-disabled` with handler guards to keep keyboard focus while preventing duplicate requests.

The home page links to `/clients/[clientId]`. This dynamic route validates its ID, then fetches the client and the requested 50-task page in parallel at request time with no caching. It displays a loading state, empty list, client-not-found page, or retry message as appropriate. The task form posts only the title; confirmed saves clear the field and refresh server data. Rejections preserve input; a removed client disables further saves. Uncertain results preserve and lock the draft with refresh and deliberate new-entry actions. No write retries automatically. Form IDs include the client ID to keep labels distinct across Next.js-preserved pages.

The Delete button opens an inline confirmation naming the client and explaining permanent removal. Cancel is focused first and sends no request. Confirmation disables repeated submissions and refreshes the list after a validated success or known missing-client response. Unconfirmed deletion locks the button and offers refresh; it never retries automatically. Editing and deletion controls are mutually exclusive for each row.

When the API reports existing tasks, the page displays their count and requires a separate “Delete client and tasks” click. It sends the displayed count back and asks again if it changes. Cancel and reopening clear the prior task confirmation.

From `backend`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run db:check
```

`test` covers client/title input validation and the task-deletion transaction branches with a simulated database connection, including confirmation, changed counts, rollback, and connection release. These tests do not verify actual PostgreSQL locks or cascade behavior. `db:check` separately verifies the migration connection using a read-only query. Live database writes and concurrency/cascade behavior are checked manually during the guided lessons.

From `frontend`:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
```

Frontend tests check API response validation and the difference between confirmed saves, rejected requests, and uncertain results, without writing to PostgreSQL.

Task-page tests also check route-ID validation, task/client matching, allowed statuses, and task-creation response handling. Browser checks covered Tasks navigation, existing and empty lists, invalid/missing clients, blank and long titles, Enter submission, pending/duplicate submission, success clearing and focus, rejection, uncertain results, malformed and wrong-client responses, deleted-client handling, recovery, 320px layout, and navigation between clients. All task POST requests were intercepted. Real browser saves remain a manual learning checkpoint.

Status-response unit tests check matching task/client IDs and requested status, known rejection/missing errors, and unexpected responses. Browser checks use intercepted PATCH responses to cover both status choices, pending state, duplicate clicks, Enter submission, focus, mismatched task/client/status, malformed responses, network failure, explicit recovery, missing tasks, and 320px layout. The user subsequently confirmed that the real status buttons work. They also confirmed real task creation/listing through the page and persistence after reload. See HANDOFF.md for the current learning checkpoint and continuation guidance.

Browser verification has covered pending state, duplicate submission, confirmed and rejected saves, uncertain responses, recovery, keyboard focus, and a 320px viewport using intercepted POST responses. Desktop and mobile screenshots are stored under the ignored `output/playwright/` folder. Real saves remain a manual check during the lesson.

Rename browser checks also cover Cancel, blank/long names, pending and duplicate submission, confirmation, validation rejection, missing clients, connection failure, refresh recovery, keyboard focus, and 320px layout using intercepted PATCH responses. These checks do not write to PostgreSQL.

Delete browser checks cover confirmation, Cancel, pending and duplicate submission, confirmed/missing responses, mismatched IDs, unreadable responses, connection failure, refresh recovery, keyboard focus, and 320px layout using intercepted DELETE responses. Real deletion remains a manual check during the lesson.

Task-deletion browser checks use simulated responses to verify the extra count warning, cancellation, fresh confirmation after count changes, the confirmation JSON body, success, connection failure, keyboard focus, and 320px layout. A read-only rolled-back transaction also verified parent locking and task reads as `client_tracker_app`; it did not exercise concurrent inserts or cascade deletion.












