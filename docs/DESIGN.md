# Design guide

How Ashley Bands pages look and read. The homepage (`app/page.jsx`) is the reference look: paper
neutrals, Ashley garnet, restrained gold and strong serif headings. Issue #132 set up the pieces
below so new pages start from the same parts.

## Decisions

Rob reviewed the guide against screenshots of the live pages on 2026-09-28 (#153):

- **Colors:** paper neutrals, Ashley garnet and restrained gold stay the band's colors.
- **Page titles:** every page title is garnet DM Serif Display. No black or sans page titles.
- **Section headings:** large section headings (h2) use DM Serif Display. Small headings (h3 and below,
  card and event titles) use bold Inter.
- **Band name:** Cinzel is only for the band's name, "The Bands of Ashley High School" or "Bands of AHS",
  in the top bar, the footer and any title that is the name itself. Never use it for other headings.
- **Parts:** the callout panel, level card and day list below replace the hand-built versions on pages.

Pages that do not follow these yet are converted in batches under #153.

## Tokens

All tokens live in `app/tokens.css`. `app/layout.jsx` imports it before `app/styles.css`, so every
page and CSS module can use them. Use a token, not a hex value.

| Group | Tokens | Use |
| --- | --- | --- |
| Palette | `--ink`, `--paper`, `--paper-strong`, `--garnet`, `--garnet-dark`, `--gold`, `--gold-text`, `--line`, `--muted`, `--blue`, `--green` | The raw brand colors. |
| Semantic | `--surface`, `--surface-raised`, `--surface-sunken`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-on-accent`, `--text-on-accent-muted`, `--accent`, `--accent-strong`, `--accent-soft`, `--info`, `--danger`, `--success`, `--warning` (each status also has a `-soft` fill), `--focus` | Prefer these in new work. |
| Type | `--font-display` (DM Serif Display), `--font-body` (Inter), `--font-wordmark` (Cinzel, band name only) | Page titles and h2s use display. Small headings and everything else use body. |
| Type scale | `--step--1` (13-14px), `--step-0` (16-18px), `--step-1` (19-23px), `--step-2` (22-30px), `--step-3` (30-44px), `--step-4` (40-72px) | Fluid sizes with `clamp()`. |
| Space | `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px, `--space-6` 32px, `--space-7` 48px, `--space-8` 64px | Margins, padding, gaps. |
| Shape | `--radius-sm` 6px, `--radius-md` 10px, `--radius-pill`, `--tap-target` 44px | Corners and touch size. |
| Depth | `--shadow`, `--shadow-sm` | Use sparingly. |

Color rules:

- Gold text on a light background uses `--gold-text`. `--gold` is for rules, borders and dark garnet panels.
- On `--garnet-dark`, use `--gold` for labels, `--paper-strong` for headings and `--text-on-accent-muted` for body text.
- Do not add other fonts. Georgia and system fonts are fallbacks only.
- Garnet on paper and ink on paper both pass contrast easily. Status colors pass 4.5:1 on paper and on their own `-soft` fill.
- Keyboard focus is global (`:focus-visible` in `app/styles.css`, colored by `--focus`). Do not remove outlines.

`scripts/design-tokens.test.mjs` (`npm run test:design`, also in `test:public-content` and CI) fails if a
CSS file in `components/ui/` has a raw hex color, or uses a `var(--name)` that `app/tokens.css` does not define.

## Shared parts

Import from `@/components/ui` or from the single file. All are server components. Each has one CSS module.

### PageHeader

One heading treatment for every public page: optional eyebrow, a serif garnet h1, a lede, optional body
text and actions. Pass `className` to set the page's width and outer spacing.

```jsx
<PageHeader
  eyebrow="Official Dates"
  title="Band Calendar"
  lede="Subscribe once and new dates show up on your phone."
  actions={<ButtonLink href="/calendar.ics" variant="secondary">Download (.ics)</ButtonLink>}
/>
```

### Button and ButtonLink

`variant` is `primary`, `secondary` or `quiet`. Both are at least 44px tall. `ButtonLink` uses
`next/link` for site pages and a plain `<a>` for files, anchors, `mailto:` and other sites.

```jsx
<ButtonLink href="/sponsors/give">Give now</ButtonLink>
<ButtonLink href="#tiers" variant="secondary">See sponsorship levels</ButtonLink>
<Button type="submit">Save</Button>
```

Use one primary action per screen area.

### Notice

`tone` is `info`, `deadline`, `archived`, `error` or `success`. The title must say the point in words.

```jsx
<Notice tone="deadline" title="Forms are due [date].">
  <p>Turn them in to Mr. Parker.</p>
</Notice>
```

Use `archived` on a past event page so a parent knows it is not current.

### Field

Wraps one `<input>`, `<select>` or `<textarea>`. It connects the label, hint and error for screen readers.

```jsx
<Field label="Student first name" hint="As it appears on the school roster." error={errors.first} required>
  <input name="first" autoComplete="off" />
</Field>
```

### StatusChip

`status` is `needed`, `done`, `closed`, `waiting` or `info`. The label is visible text.

```jsx
<StatusChip status="needed" />
<StatusChip status="done">Paid</StatusChip>
```

### DataTable

A simple table with an optional caption. It scrolls sideways on a phone instead of breaking the page.

```jsx
<DataTable
  caption="Uniform pieces"
  columns={[{ key: "item", label: "Item", rowHeader: true }, { key: "cost", label: "Cost", align: "end" }]}
  rows={[{ item: "Gloves", cost: "$5" }]}
/>
```

### EventCard

Answers a parent's questions in a fixed order: when, where, who, wear, bring, cost, then one next step.
Rows you leave out are not shown.

```jsx
<EventCard
  title="[Event name]"
  when="[Day, date, time]. Call time [time]."
  where="[Place]"
  wear="[Uniform]"
  next={{ href: "/calendar", label: "Add it to your calendar" }}
/>
```

Take real dates and details from the calendar source.

### MoneyLine

Any time a page asks for money: what it is for, the amount, who receives it, and how the receipt works.

```jsx
<MoneyLine
  purpose="Carnegie trip gift"
  amount="$5 or more"
  receiver="Ashley High School Band Boosters"
  receipt="PayPal emails your receipt."
/>
```

### CalloutPanel

The dark garnet panel for the one message a section should end on: a gold eyebrow, a serif heading in
light text, body text and optional actions. `split` puts the heading left and the body right on wider
screens. Inside the panel a primary button turns gold and a secondary button turns light, so use the
normal `Button` and `ButtonLink`.

```jsx
<CalloutPanel
  eyebrow="Carnegie Hall 2027"
  title="Help the band get to New York."
  actions={<ButtonLink href="/support-carnegie">Give to the trip</ButtonLink>}
>
  <p>Every gift lowers the cost for every student who goes.</p>
</CalloutPanel>
```

Use at most one per screen area. It is not a Notice: a deadline or error still uses `Notice`.

### LevelCard and LevelGrid

One giving or price level: the name in bold body type, the amount in the display serif, what it
includes, and one action. `featured` outlines one card in gold, with an optional `tag`. Put the cards in
a `LevelGrid` so they line up and stack on a phone.

```jsx
<LevelGrid>
  <LevelCard name="Partner" amount="$500" action={{ href: "/sponsors/give?amount=500", label: "Give $500" }}>
    <ul><li>Bold name listing in the concert program</li></ul>
  </LevelCard>
  <LevelCard name="Premier" amount="$1,500" featured tag="Best value" action={{ href: "/sponsors/give?amount=1500", label: "Give $1,500" }}>
    <ul><li>Logo on the equipment trailer</li></ul>
  </LevelCard>
</LevelGrid>
```

Take amounts and benefits from their source. Add a `MoneyLine` where the page takes the money.

### DayList

Events grouped by day: a serif day heading with an optional date beside it, then one row per event
with time, place, an optional note and a Details link. `compact` lays the days side by side on wider
screens, for the home page strip. Pass `empty` for the no-events message.

```jsx
<DayList
  days={[{ key: "2026-10-01", label: "Thursday, October 1", events: [
    { key: "rehearsal", title: "[Event name]", time: "[Time]", place: "[Place]", href: "/calendar#[anchor]" }
  ] }]}
  empty={<p>Nothing on the band calendar this week. <a href="/calendar">See the full calendar</a>.</p>}
/>
```

Build `days` from the calendar source (`lib/thisWeek.mjs`), never from dates typed into a page.

## Icons

Use `lucide-react` for every icon. Do not hand-draw SVG icons or use emoji as icons.

```jsx
import { CalendarDays, MapPin } from "lucide-react";

<CalendarDays size={20} aria-hidden="true" />
```

- Size icons at 16, 20 or 24px. Color comes from `currentColor`, so set it with a token on the parent.
- An icon beside text is decoration: add `aria-hidden="true"`. An icon-only button needs an `aria-label`.
- Never let an icon carry meaning alone. Keep the word next to it.
- Older inline SVGs and text arrows still exist. Replace them when you touch that page.

## Page templates

**Info page** (handbook, about, policies). `PageHeader` with a lede and no actions. Then sections with
h2 headings. Use a `Notice` only for the one thing a parent must not miss.

**Action page** (give, sign up, pay, RSVP). `PageHeader` with one primary action. Then the form built
from `Field`s, `MoneyLine` for every amount, and a `Notice tone="success"` after it is done. Say who
receives money and when the deadline is.

**Workspace page** (portal, staff tools). A short `PageHeader` with no eyebrow. Then `StatusChip`s and a
`DataTable` or list for the work. Keep the current state and the next action at the top. Show an
explicit unknown state instead of a blank.

**Headings on any page.** One h1 from `PageHeader`. Large section headings (h2) in the display serif,
garnet or ink. Small headings (h3 and below) in bold Inter. Cinzel only where the band's name is the text.

**Room display** (the unlisted band room board, #154, `app/room/[slug]`). One screen, no scrolling at
1920x1080 or 3840x2160. Sizes scale from one viewport unit (`--u` in its CSS module) instead of the
fluid type steps, and lucide icons size in `em` so they grow with the text. Garnet top bar, paper panels,
tap targets at least 44px. Check with `npm run preview:shots -- /room/<slug> --viewports display,display4k,phone`.

## Voice

- Write for a parent who knows nothing about the band.
- Short, plain sentences. One idea per sentence.
- No em dashes. Use a period, a comma or a colon.
- Say "Mr. Parker" and "Ashley."
- Headings carry the sections. A heading should make sense on its own.
- Do not put an eyebrow on every section. Use one on the page header at most, and only when it adds context the title lacks.
- Never invent a date, price, place or policy. If it is not confirmed, say so.

## Starting a new event page

1. Put the dates in the calendar source first (see CLAUDE.md). Do not type dates only into the page.
2. Create `app/<event>/page.jsx` as a server component with `metadata` (title and description, no em dashes).
3. Start with `PageHeader`: the event name as the title and one sentence on what it is and who it is for.
4. Add an `EventCard` with only the facts you have confirmed.
5. If money is involved, add a `MoneyLine` for each amount.
6. Add a `Notice tone="deadline"` for any form or payment due date.
7. Style anything extra in a co-located CSS module that uses tokens. No hex values, no inline styles.
8. Check it at phone and desktop width: `npm run preview:shots -- /<event>`.
9. When the event is over, add `Notice tone="archived"` at the top or retire the page.
