@AGENTS.md

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.
<!-- convex-ai-end -->

<!-- package-manager-preference-start -->
## Package Manager
- Always use `pnpm dlx` instead of `npx`
- Use `pnpm` for all package operations
<!-- package-manager-preference-end -->

## Design
This app is a PWA — always design and review UI mobile-first. Assume a ~375-430px viewport unless told otherwise; check any UI/UX change (including mockups) at that width before wider breakpoints.

## Testing the app as a signed-in user
A dedicated Clerk dev-instance test user exists for automated/agentic testing via [Clerk Testing Tokens](https://clerk.com/docs/testing/overview) — no real password is ever typed into the browser by a human or by Claude.
- Credentials live in `.env` as `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD` (gitignored, never commit them or print their values).
- `pnpm test:e2e` runs the Playwright suite in `e2e/`.
- `e2e/auth.ts` exports `signIn(page)` — a Playwright helper that logs this test user in (including the second-factor email code, auto-accepted as `424242` on `+clerk_test` addresses in dev mode). Use it as the entry point for any new Playwright spec that needs an authenticated session.
