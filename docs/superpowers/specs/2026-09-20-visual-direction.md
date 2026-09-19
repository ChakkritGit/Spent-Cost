# Visual direction

Date: 2026-09-20
Supersedes the placeholder palette in `2026-09-19-expense-tracker-design.md`.

The client supplied two reference screens: a light, green-accented finance
dashboard — white cards on an off-white ground, a left sidebar, a row of stat
cards, a gradient bar chart, a donut with a total in the middle, and pastel
status pills. The direction is theirs and is followed. What follows is how it
lands on *this* product rather than on the reference's.

## What this product actually is

One person, on a phone, checking whether something is due and how much of a
debt is left. Not a team, not a back office. The reference is a B2B
transactions console; its job is scanning many rows. This app's job is
answering two questions fast: **what do I owe, and how far have I got.**

That difference decides where the boldness goes (below) and why the bottom
navigation stays on phones instead of becoming a collapsed sidebar.

## Color

```
--bg            #f2f5f2   off-white page ground, faint green cast
--card          #ffffff   every surface that holds content
--fg            #0f1a14   deep green-black, not a tinted near-black
--muted         #6b7c72   secondary text, axis labels
--line          #e4eae5   hairline borders
--accent        #16a34a   primary action, active nav, progress fill
--accent-bright #4ade80   the light end of the bar gradient only
--accent-soft   #dcfce7   pill grounds, chart tints, progress track
```

Status colours encode state and appear nowhere decoratively:

```
paid      bg #dcfce7  text #15803d   จ่ายแล้ว
due       bg #fef3c7  text #b45309   ค้างจ่าย
overdue   bg #ffe4e6  text #be123c   เกินกำหนด
```

`--accent` is green 600 rather than the reference's brighter green so that
white text on a filled button and green text on white both clear 4.5:1. The
bright green survives as the gradient's top end, where it carries no text.

## Type

**IBM Plex Sans Thai**, one family, weights 400/500/600, loaded through
`next/font/google` so it self-hosts and adds no third-party request.

This is the one place the reference cannot be copied. Its typeface is
Latin-only; used here, every Thai word would fall through to a system font and
the page would change letterforms mid-sentence. IBM Plex Sans Thai draws Thai
and Latin from one hand, so `Netflix` and `หนี้รถ` sit in the same row without
a seam — which matters because they literally do sit in the same row, in every
list in this app. Its slightly engineered character suits money, and its
figures are even-width.

Numerals keep `font-variant-numeric: tabular-nums` so columns of baht line up.

## Layout

```
lg and up                          phone
┌──────────┬─────────────────┐     ┌─────────────────┐
│ รายจ่าย   │ ภาพรวม  ‹ ก.ย. › │     │ ภาพรวม  ‹ ก.ย. › │
│          ├─────────────────┤     ├─────────────────┤
│ ภาพรวม    │ ┌──┐┌──┐┌──┐┌──┐│     │ ┌─────┐ ┌─────┐ │
│ รายการ    │ │  ││  ││  ││  ││     │ │     │ │     │ │
│ ปฏิทิน     │ └──┘└──┘└──┘└──┘│     │ └─────┘ └─────┘ │
│ ตั้งค่า     │ ┌────────┐┌───┐│     │ ┌─────┐ ┌─────┐ │
│          │ │  bars  ││ ◕ ││     │ └─────┘ └─────┘ │
│          │ └────────┘└───┘│     │ ┌─────────────┐ │
│          │ ┌─────────────┐│     │ │    bars     │ │
│          │ │   entries   ││     │ └─────────────┘ │
└──────────┴─────────────────┘     ├─────────────────┤
                                   │ ภาพรวม รายการ … │  ← bottom nav
                                   └─────────────────┘
```

Sidebar 240px from `lg`. Below that the existing bottom nav stays — it is
already measured to fit Thai labels on one line at 375px with a 44px target,
and a thumb-reachable bar beats a hamburger for an app opened to check one
number.

Cards are white, `rounded-2xl`, one hairline `--line` border, **no drop
shadow**. The reference leans on near-invisible shadows under identical cards;
borders read cleaner at this density and avoid the sameness that makes every
card look equally important. Radii differ by role — cards 16px, buttons 10px,
pills full — so hierarchy is legible without colour doing all the work.

Content is left-aligned throughout. Figures are right-aligned in any column
that repeats, so magnitudes compare vertically.

## Where the boldness goes

One element carries it: **debt progress**.

The reference's closest analogue is a decorative "Financial Health" ring. Here
the equivalent is the thing the user actually opens the app to see, so it gets
the weight: on the dashboard, `หนี้คงเหลือ` is set large with a thin track
beneath it showing how much of the total has been repaid; on the plans screen
every debt carries its own bar with paid-of-total underneath.

Everything else stays quiet: no card hover lifts, no entrance animations, no
gradient washes used as decoration. The bar chart's gradient is the only
gradient, and it encodes magnitude.

Motion is limited to what answers an action — a progress bar easing to its new
width when a payment is marked paid, and nothing on page load.

## Copy

Sentence case, plain verbs, no ALL-CAPS labels and no eyebrow text. Buttons
name what happens: `เพิ่มรายการ`, `สร้างรายการเดือนหน้า`, `ปลดล็อก`. Empty
states say what to do next, not that something is empty.
