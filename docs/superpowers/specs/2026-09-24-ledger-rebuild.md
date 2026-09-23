# Ledger rebuild

Date: 2026-09-24
Status: approved (direction A, all seven changes below)
Supersedes the look in `2026-09-20-visual-direction.md`. The data model, RLS
and the money rules in `2026-09-19-expense-tracker-design.md` stand.

Mockups: https://claude.ai/artifact/N5tUh9JdFMsmtFSf3zYNGd (row "แนว A").

## Look — "สมุดบัญชี"

The owner's own site language (chakkritton.com): paper, ink, one electric
blue, 1px square rules, mono labels, condensed Thai headlines.

```
--paper   #f8f9fa   dark #050505
--surface #ffffff   dark #0e0e11
--ink     #0a0a0a   dark #ededed   (also every 1px rule)
--muted   #5c5f66   dark #9a9ca3
--hair    #d9dbe0   dark #26272c   (row separators)
--brand   #0000ff   dark #7a7aff   (fills, the headline figure)
--on-brand #ffffff  dark #050505
--warn    #9a3412   dark #fb923c   (due)
--danger  #b3122e   dark #ff5c7a   (overdue, delete)
```

Type: Noto Sans Thai with the `wdth` axis — headlines at 72% width, 800;
body at 100%. JetBrains Mono for labels, dates and figures in rows. No radius
anywhere. No shadows.

State is shape as well as colour: paid = filled square, due = outlined square,
overdue = red square.

## What changes from the current app

Functions stay. The UI is rewritten, and these seven were approved with it:

1. The + button opens a bottom sheet (native `<dialog>`) for a one-off entry,
   instead of scrolling to a form at the foot of the dashboard.
2. Category is picked from chips of categories already used, or typed new.
3. Plans get an edit button (`savePlan` already takes an id).
4. A debt takes `paid_before` — what was repaid before the app. Migration
   `0002_paid_before.sql`; it counts toward progress and the dashboard totals.
5. Tapping a calendar day lists that day's entries (`?d=`).
6. The PIN screen has its own keypad.
7. Deleting a plan with paid history asks in a panel with "ลบถาวร", instead of
   tap-again-within-3s.

Entries also open in the same sheet to edit (the credit-card case: fix the
amount before ticking it paid) and to delete — the row's own delete button
moves there.

## Code

Same stack. Kept as they are, because they are tested and security-bearing:
`lib/month.ts`, `lib/validate.ts`, `lib/pin.ts`, `lib/auth-paths.ts`,
`proxy.ts`, the Supabase clients, the auth callback. `lib/money.ts` and
`lib/data.ts` gain `paid_before`.

Server Actions return `{ error }` instead of throwing: a thrown message is
replaced by a generic digest in production, so the Thai messages in
`validate.ts` never reached the screen.

Everything under `components/` and every page is rewritten to the look above.
The donut becomes a stacked category bar with a legend (same data,
`byCategory`), which reads better in square rules.

## Verification

tsc, eslint, vitest, `next build`, and a Playwright pass at 375px in both
themes over a throwaway fixture page (never committed) for overflow, contrast
and tap targets. A signed-in sweep needs the owner's session.
