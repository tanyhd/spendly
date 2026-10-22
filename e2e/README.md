# Tests

Spendly has two kinds of automated tests. Run both before pushing; GitHub runs them on every push too
(`.github/workflows/ci.yml`).

| Command | What it runs | Needs |
|---|---|---|
| `npm test` | **Jest**: unit tests (`src/lib`, `src/common`) and API/service tests (`src/app/api/**`) against an in-memory MongoDB | Nothing |
| `npm run test:e2e` | **Playwright**: real browsers (desktop 1280 and phone 390) using the app the way people do | Nothing |
| `npm run test:coverage` | Jest with a coverage report in `coverage/` | Nothing |
| `npm run test:e2e:ui` | Playwright's viewer: pick a test, watch it, step through each action | Nothing |
| `npm run test:e2e:headed` | Opens real browser windows (desktop only, one at a time). Add `SLOW_MO=400` to slow it down | Nothing |

Neither touches Atlas or your `.env.local` database:

- **Jest** sets test-only secrets in `jest.setup.js`, and each test file that needs a database starts its own
  in-memory MongoDB (`src/test/testDb.ts`), wiped between tests.
- **Playwright** starts the app with `e2e/start-app.mjs`: an in-memory MongoDB plus `next dev` on port 3100 with
  test-only secrets, building into `.next-e2e` so it can run next to your own `npm run dev` on port 3000.
  It refuses to start if the database address isn't local. If something is already on port 3100 it's reused.

The first run downloads a MongoDB binary (about 100 MB, cached afterwards).

## The end-to-end tests

Every test signs up its own throwaway user (`e2e.…@example.test`), so tests don't share data and can run in parallel.

| File | Covers |
|---|---|
| `auth.spec.ts` | Sign up through the form, password mismatch, wrong password, sign in to the chosen default page, sign out, redirects |
| `shell.spec.ts` | Navigation on desktop and phone, keys 1–5, add expense from anywhere (N / +) with validation, Esc, light mode from the account menu |
| `daily-log.spec.ts` | This week's days and totals, add from a day's + ADD, edit with the date locked, delete with UNDO, week navigation |
| `budget.spec.ts` | Template → save → saved after reload, copy of last month, unsaved-changes check on month switch and on leaving the page |
| `dashboard.spec.ts` | Get-started strip, month totals, fixed-expenses message, negative savings, month picker |
| `annual.spec.ts` | Empty year, year totals, CSV export contents, collapsing a table section |
| `settings.spec.ts` | Display name, appearance (light / system), change password, clear-data previews, clear week, delete all |
| `game.spec.ts` | The login-page game starts, launches and quits; the theme button |

A failed test keeps a screenshot and trace in `test-results/`; `npx playwright show-report e2e-report` opens the report.

## Adding tests with a feature

- Logic with no database (calculations, formatting, date maths): a `*.test.ts` next to the file.
- Anything that reads or writes data: an API test next to the route, using `setupTestDb()` and `makeUser()` from
  `src/test/`. Include a check that another user can't see or change the data.
- Anything a person clicks through: a Playwright spec in `e2e/`, run on desktop and phone.
