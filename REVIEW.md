# Focused review: existing tracker behavior

Reviewed 2026-10-21 against baseline `a6655b2`. Scope: authentication,
ownership, error handling, uncertain-write recovery, and data integrity.
The initial review changed no application code, dependencies, or database
objects. The subsequently approved fix is recorded below.

## Finding 1 — P2: mismatched save responses can be treated as success

- `frontend/lib/clients.ts:25` accepts a created client without comparing its
  name to the submitted name. `frontend/app/create-client-form.tsx:66` then
  clears the draft on that success result.
- `frontend/lib/clients.ts:59` checks a renamed client's ID but does not compare
  its name to the submitted name. `frontend/app/client-row.tsx:118` then reports
  success and closes the editor.
- `frontend/lib/tasks.ts:95` checks a created task's client, status, and due date,
  but does not compare its title to the submitted title.
  `frontend/app/clients/[clientId]/create-task-form.tsx:72` then clears the draft.

Reproduced directly with the existing parsers and fake response objects: a
different returned client name is accepted for creation and rename, and a
different returned task title is accepted for creation. Existing task title,
status, and due-date update parsers already compare the requested field.

Impact: an unexpected successful response can show a save as confirmed even
though it does not confirm the entered value. This is a response-validation
gap, not evidence of incorrect writes in the current Express implementation.

Resolved after user approval: all three parsers now require the submitted
trimmed name/title and compare it exactly. Their callers supply the value sent
in the request. A mismatch follows the existing uncertain-save path, preserving
the draft and blocking another submit. Three regression tests cover mismatches,
exact Unicode matching, and dated/undated task creation; existing cases were
updated for the required arguments.

Fix verification: frontend lint, typecheck, all 36 tests, and production build
passed. The initial sandbox build hit a Windows path access restriction; the
unchanged build passed outside it. Isolated production-preview browser checks
covered matching/mismatched client creation, client rename, and dated/undated
task creation, including trimmed request values, retained drafts/dates, blocked
resubmission, and normal successful completion. No page errors occurred.
Every browser write was intercepted; no real database writes occurred. The
preview and browser were stopped. Local check scripts remain ignored under
output/playwright/response-check-*. No dependencies were added or commits made.

## Checks and protections inspected

- All client/task endpoints pass through session middleware. Missing sessions
  and lookup failures stop access before resource queries.
- Client queries scope to the session owner; task queries check the parent
  owner. Client creation derives ownership from the session. Another owner's
  resource returns 404 without revealing its task count.
- Protected reads are uncached. Server page reads forward Better Auth cookies;
  browser writes include credentials. Auth navigation replaces the document.
- Cookie-authenticated resource writes reject untrusted origins and cross-site
  fetch metadata. Auth routes delegate their own checks to Better Auth.
- Mutation failures preserve uncertainty rather than automatically retrying a
  write. Existing controls provide refresh and deliberate recovery actions.
- Deletion uses one connection and a transaction, locks the owned parent before
  counting tasks, rechecks the confirmation count, and rolls back on failure.
- Migration source defines ownership, foreign keys, cascade deletion, required
  fields, title/status/date constraints, and supporting foreign-key indexes.

No authentication or ownership bypass was confirmed in this review.

## Initial review verification and limits

- Backend typecheck passed; all 44 existing tests passed on rerun. The initial
  sandbox run failed 11 HTTP tests because localhost connections were denied
  with EACCES; the unchanged suite passed outside that restriction.
- Frontend lint, typecheck, and all 33 existing tests passed.
- The mismatch reproduction used in-memory objects only. HTTP tests use fake
  sessions and database connections. No real database writes or migrations ran.
- No fresh browser run, production build, live session/revocation test, database
  permission check, or PostgreSQL concurrency/cascade test was performed.
  Migration source review does not verify the current live schema.
- README.md:13 and README.md:45 still describe authentication as pending, despite
  the completed checkpoints. Correct these statements in a documentation pass.
- This is a local development review, not a production-readiness assessment.
  Existing public-signup, email delivery, and deployment limitations remain.

## Browser regression scope to agree after reviewing the finding

Suggested small scope: session/sign-out and account isolation; client/task
creation and editing; deletion confirmation/cancellation; and lost-response
recovery without duplicate writes. Use isolated simulated data. Agree on the
scope and tooling before adding dependencies or CI.
