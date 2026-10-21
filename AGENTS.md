# Project guidance

## Context and source of truth

- This is a new SaaS/business application intended to use Next.js, TypeScript, Node.js, and PostgreSQL. The folder name is provisional; product requirements are not yet defined.
- The backend shape (Next.js server features or a separate service), ORM/query builder, authentication, tenancy model, UI library, hosting, and package manager are undecided. Agree on these when needed; do not add a second backend or assume Supabase hosting merely because a skill mentions it.
- Before editing, inspect relevant code, this file, any more specific instructions, package manifests, lockfiles, and configuration. Follow established project patterns and the user's current request.
- Once Next.js is installed, read the relevant documentation matching the installed version, including `node_modules/next/dist/docs/` when present. Preserve Next.js-managed instruction blocks in this file and any other managed agent files; add project rules outside those blocks.
- Use repository scripts and the package manager indicated by the project. This directory has no application yet: do not invent runnable scripts, API contracts, environment variables, or infrastructure.

## Working process

- Understand the requested outcome and acceptance criteria before substantial implementation. Ask focused questions only for consequential choices that inspection cannot resolve; use judgment for routine details.
- For substantial features, agree on a short plan and deliver small, reviewable increments. Each increment should have a useful result and appropriate verification.
- Keep changes focused. Preserve unrelated work and existing behavior outside the requested scope.
- For a bug, reproduce it where feasible, inspect affected callers, trace the failing boundary, and identify the cause before choosing a fix. If evidence is insufficient, gather it rather than layering guesses.
- Keep progress updates short. Report the result, evidence, and remaining limitations without claiming unverified success.

## Simple, complete implementation

- Prefer existing project components and patterns, then native/platform or standard-library features, then installed dependencies, then focused new code. Keep established project behavior consistent.
- Choose readable solutions. Introduce abstractions, configuration, and dependencies only for a concrete requirement; avoid clever compression and flexibility for hypothetical future needs.
- Trace the change through callers, contracts, exports, configuration, fixtures, and tests. Complete the required integration; a smaller diff must still satisfy the whole task.
- Simplification must retain validation, data-loss safeguards, security, accessibility, and required behavior. Remove redundant code only after checking its responsibilities.
- Document an unavoidable shortcut's limitation and a concrete revisit trigger near the affected code. Do not defer required behavior or protections as technical debt.

## TypeScript and application architecture

- Enable strict TypeScript when scaffolding. Prefer precise types and narrow `unknown` at untrusted boundaries; avoid unexplained `any`, non-null assertions, and suppressed compiler errors.
- TypeScript types do not validate runtime input. Validate request bodies, route/search parameters, uploaded data, environment configuration, and external responses at appropriate boundaries using the project's chosen approach.
- Keep modules focused and business rules independently testable. Separate transport handling, domain decisions, and persistence where that separation has a concrete benefit.
- Prefer Server Components for server data and rendering; use Client Components for interaction, browser APIs, and client state. Keep the client boundary narrow and serialize only the data it needs.
- Keep state close to its owner. Derive values when possible; avoid redundant state, effects, global stores, and memoization without a clear need.
- Handle expected failures explicitly. Use consistent error shapes once the API conventions are chosen, useful user-facing messages, and actionable server diagnostics without sensitive content.
- Optimize based on access patterns and measurements. Avoid request waterfalls, N+1 queries, unnecessary client dependencies, and premature caching. Define freshness and invalidation before caching mutable or user-specific data.

## Trust boundaries and security

- Keep database clients, credentials, tokens, and privileged operations in server-only modules. Never expose secrets through public environment variables, client props, bundles, logs, screenshots, or committed files.
- Authenticate and authorize every protected server operation, including Server Actions and route handlers. Check access to the specific resource and operation; hidden UI controls and authentication alone are insufficient.
- Treat client-provided IDs, prices, ownership, roles, and other authority-bearing fields as untrusted. Derive authoritative values on the server.
- Reuse the chosen authentication library and established session protections; do not invent password storage or cryptography. Apply request-abuse, upload, and outbound-request controls where the feature requires them.
- Avoid unsafe HTML rendering. Validate and sanitize content at the appropriate boundary when rich HTML is an explicit requirement.
- Scope caches and data reads correctly for the user or tenant. If multitenancy is adopted, enforce isolation in every data path and test cross-tenant access attempts.

## PostgreSQL and data integrity

- Design schemas around real requirements. Use appropriate data types, primary/foreign keys, uniqueness, nullability, and check constraints to enforce invariants.
- Use parameterized SQL or the chosen query builder's safe bindings. Never concatenate untrusted input into SQL; allowlist dynamic identifiers when needed.
- Use transactions for operations that must succeed together. Consider concurrent updates, retries, idempotency, and locking when duplicate or competing writes could corrupt the result.
- Manage schema changes through versioned migrations. Review generated SQL for data loss, long locks, backfills, and compatibility with existing data. Test risky changes against representative non-production data.
- Require explicit authorization before destructive database operations or changes to production data. Do not treat a development reset as a migration strategy.
- Choose indexes from actual filters, joins, sorting, and query plans. Bound list queries, use suitable pagination, and configure connection pooling for the selected deployment model.
- Apply least-privilege database access. Use and test row-level security when the selected access model requires it; do not assume policies or a privileged server connection automatically enforce application authorization.

## Interface and product quality

- Establish a compact design system: semantic color tokens, typography, spacing, component variants, and interaction conventions. Reuse it across screens.
- Optimize business screens for clear hierarchy, readable data, predictable navigation, and efficient tasks. Use restrained motion and decoration that serve the product brief.
- Include loading, empty, validation, error, success, and disabled states where relevant. Preserve user input on recoverable failures and prevent accidental duplicate submissions.
- Support narrow and wide viewports. Keep tables and dense content usable without accidental page overflow.
- Use semantic elements, accessible names, keyboard-operable controls, visible focus, appropriate focus management, sufficient contrast, and reduced-motion preferences.
- Write clear labels and action-specific buttons. Explain errors with a recovery action; do not expose internal implementation details in product copy.

## Skills: use the relevant workflow

These are user-level Codex skills, installed separately from this repository. If one is unavailable in a future environment, report that limitation and follow the project rules with the available tools.

| Skill | Use when |
| --- | --- |
| `vercel-react-best-practices` | Writing or reviewing React/Next.js components, data fetching, rendering, bundles, or performance changes. Apply rules relevant to the installed versions and actual problem. |
| `supabase-postgres-best-practices` | Designing or changing PostgreSQL schemas, SQL, migrations, indexes, policies, connection management, or query performance. Apply general PostgreSQL guidance to the chosen host; use Supabase-specific rules only if applicable. |
| `frontend-design` | Establishing a visual direction or building/redesigning substantial UI. Follow the agreed product brief and existing design system. |
| `web-design-guidelines` | Reviewing UI, accessibility, interaction, or responsive quality. Use the current referenced guidelines and report actionable findings. |
| `security-best-practices` | The user explicitly requests secure-by-default implementation, security guidance, or a security review. This routing does not replace the security requirements above. |
| `playwright` | Exercising real browser flows, inspecting screenshots, or debugging UI behavior. Confirm browser/tool prerequisites and adapt documented shell commands to the current OS. |

## Verification and completion

- Choose checks according to changed behavior and risk. Use actual repository scripts for type checking, linting, tests, and builds; read their outputs before reporting results.
- Add focused checks for new non-trivial logic and meaningful regression coverage for fixes when practical. Test boundary conditions and failure paths where they matter; avoid tests that merely mirror implementation or unnecessary suites for small cosmetic changes.
- For protected operations, test unauthenticated, unauthorized, and authorized requests, including direct server calls where relevant. Test cross-tenant access if tenancy exists.
- For important database changes, verify constraints, transaction rollback, migration behavior with existing data, and concurrency/idempotency scenarios where applicable.
- Verify affected critical flows in the running application. Use browser interactions and screenshots for functional and visual checks, including relevant viewport and keyboard behavior.
- Interactive browser checks are not a durable regression suite. Add repeatable automated end-to-end tests for agreed critical flows, and run them in CI once the test setup exists.
- Review the final diff and affected code outside it for broken callers, unintended changes, and secret exposure. Prioritize correctness, data integrity, security, and regressions before optional cleanup. Report what changed, checks actually run, and anything unverified or failing. Distinguish pre-existing failures from regressions; never weaken checks to manufacture a pass.

## Repository discipline

- Keep secrets out of version control. Provide placeholder-only environment examples once actual configuration keys are defined, and ignore local secret files.
- Use the existing lockfile and package manager. Explain material dependency additions; do not update unrelated packages.
- Do not hand-edit generated artifacts when their source or generator should be changed. Preserve managed Next.js instruction blocks.
- Do not discard, reset, or overwrite unrelated user changes. Do not stage, commit, push, publish, or deploy unless the user requests it.
- Keep setup and architecture documentation accurate as decisions are made. Record consequential decisions and verification commands once they exist, rather than leaving this file as an invented specification.
