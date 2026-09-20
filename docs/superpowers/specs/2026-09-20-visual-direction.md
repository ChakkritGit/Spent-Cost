# Visual direction

Date: 2026-09-20 (v2 — replaces the green/desktop direction)
Supersedes the palette in `2026-09-19-expense-tracker-design.md` and the first
version of this file.

## Why this is v2

The client first supplied two desktop finance-console screens (light, green,
dense tables) and the shell was built to those. They then looked at the running
app, said it did not read as the design or as minimal, and supplied a third
reference: a **phone** app — dark hero card carrying the headline number, a
purple primary with an orange action accent, large radii, soft shadows, a
centre floating action button in the tab bar.

The phone reference wins. It is also the better fit: this is a PWA one person
opens on a phone to check what they owe, not a console someone scans rows in.

**What went wrong in v1, recorded so it is not repeated.** v1's spec argued for
hairline borders instead of shadows and against "identical rounded cards",
reasoning from a general anti-pattern about generated designs. That reasoning
was applied *over* an explicit client direction. The result was correct,
accessible, and flat — cards that read as wireframe rather than designed, and a
"hero" that was a white card with a slightly larger number on an off-white
ground. When the client has supplied a reference, the reference wins; general
taste rules only fill the axes the reference leaves free.

## Color

Every pair below was computed, not guessed.

```
--bg            #f1f2f4   page ground, cool light grey
--card          #ffffff   card surfaces
--hero          #23252f   the one dark surface: the headline figure
--hero-fg       #ffffff   on --hero — 15.25:1
--hero-muted    #a8abb8   labels on --hero — 6.67:1
--fg            #14151a   body text on --bg — 16.27:1
--muted         #6b6f7d   secondary text on --card — 5.01:1
--line          #e4e6ea   hairlines, only where a shadow would be wrong
--accent        #6d28d9   primary fill: buttons, progress, active nav
--accent-fg     #ffffff   on --accent — 7.10:1
--accent-soft   #ede9fe   tints, progress tracks
--action        #ea580c   the FAB and the selected day only
--action-fg     #ffffff   on --action — 3.56:1, large glyphs only
--action-text   #c2410c   orange AS TEXT on white — 5.18:1
```

**The orange rule.** The reference puts white text on orange. Measured, that is
2.80:1 on `#f97316` and 3.56:1 on `#ea580c` — below the 4.5:1 bar for text.
So orange is allowed as a *surface* only under a large glyph (the FAB's `+`,
which clears the 3:1 UI-component bar), and anywhere orange must carry words it
appears as `--action-text` on a light ground instead. The look survives; the
label stays readable.

Status pills, all computed:

```
paid      bg #ede9fe  text #5b21b6   7.57:1   จ่ายแล้ว
due       bg #ffedd5  text #9a3412   6.38:1   ค้างจ่าย
overdue   bg #ffe4e6  text #9f1239   6.68:1   เกินกำหนด
```

Dark theme keeps the roles: ground `#15161b`, card `#1d1f27`, hero stays
`#23252f` (it is already dark — it gains a hairline instead of contrast),
accent `#a78bfa` with `#1e1b3a` text on it, action `#fb923c` with dark text.
Recompute each pair before shipping; do not carry these numbers on trust.

## Type

**IBM Plex Sans Thai** stays — unchanged from v1 and for the same reason. Every
list in this app puts `Netflix` beside `หนี้รถ` in one row, and a Latin-only
face would change letterforms mid-row. Weights 400/500/600/700; v1 used no 700
and that is part of why it read flat.

Scale, phone-first:

```
hero figure     36px / 700 / tabular-nums
section heading 18px / 600
card figure     22px / 600 / tabular-nums
body            15px / 400
label           13px / 500 / --muted
```

v1 set nearly everything at 14px and 12px. The headline number must dominate
its card, not merely be the largest thing on it.

## Layout and surface

```
phone                              lg and up
┌─────────────────┐                ┌──────────┬──────────────────┐
│ ภาพรวม    ‹ก.ย.›│                │ รายจ่าย   │ ภาพรวม    ‹ ก.ย. › │
│ ╭─────────────╮ │                │          │ ╭──────────────╮ │
│ │ หนี้คงเหลือ   │ │ ← dark hero   │ ภาพรวม    │ │  dark hero   │ │
│ │ ฿488,000    │ │                │ รายการ    │ ╰──────────────╯ │
│ │ ▓▓▓▓▓░░░░░  │ │                │ ปฏิทิน     │ ┌────┐┌────┐     │
│ ╰─────────────╯ │                │ ตั้งค่า     │ └────┘└────┘     │
│ ┌─────┐ ┌─────┐ │                │          │ ┌────────┐┌────┐ │
│ └─────┘ └─────┘ │                │          │ │  bars  ││ ◕  │ │
│ ┌─────────────┐ │                │          │ └────────┘└────┘ │
│ │    bars     │ │                └──────────┴──────────────────┘
│ └─────────────┘ │
├──────┬───┬──────┤
│ ▫ ▫  │ + │ ▫ ▫  │ ← FAB raised above the bar
└──────┴───┴──────┘
```

- Cards: `rounded-3xl` (24px), white, **soft shadow, no border**. The one dark
  card carries the headline figure and is the page's anchor.
- Radii differ by role so hierarchy reads without colour: cards 24px, buttons
  14px, pills full, the FAB a circle.
- Padding: cards `p-5`, page gutter `px-4`, stack gap `gap-4`. v1 used `p-4`
  and `gap-3` throughout and it read cramped.
- Shadow: one soft elevation for cards, a stronger one for the FAB. Two levels,
  not five — that is what keeps it minimal while still looking made.
- The bottom bar stays (it is measured: Thai labels fit on one line at 375px
  with a 44px target) and gains the centre FAB, which opens the add-entry form.
- The `lg` sidebar stays.

## Where the boldness goes

One place, as before, but this time it is actually bold: **the dark hero card
carrying `หนี้คงเหลือ`**, its figure at 36/700 in white on `#23252f`, with the
repayment track beneath it and `ชำระไปแล้ว X จาก Y` in `--hero-muted`.

Everything else is quiet: no card hover lifts, no entrance animation, no
gradient used as decoration. The bar chart's active month is the only other
saturated moment — that bar in `--accent`, the rest in a neutral tint, values
above the bars as the reference does.

Motion answers actions only: the progress track easing to its new width when a
payment is marked paid. Nothing on page load.

## Copy

Sentence case, plain verbs, no ALL-CAPS labels, no eyebrow text. Buttons name
what happens. Empty states say what to do next — a rule v1 stated and three
screens then broke, each needing its own fix round. Check it once per screen
this time.
