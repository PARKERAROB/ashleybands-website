# Design guide

How Ashley Bands pages look and read. The homepage (`app/page.jsx`) is the reference look: paper
neutrals, Ashley garnet, restrained gold and strong serif headings. Issue #132 set up the pieces
below so new pages start from the same parts.

## Tokens

All tokens live in `app/tokens.css`. `app/layout.jsx` imports it before `app/styles.css`, so every
page and CSS module can use them. Use a token, not a hex value.

| Group | Tokens | Use |
| --- | --- | --- |
| Palette | `--ink`, `--paper`, `--paper-strong`, `--garnet`, `--garnet-dark`, `--gold`, `--gold-text`, `--line`, `--muted`, `--blue`, `--green` | The raw brand colors. |
| Semantic | `--surface`, `--surface-raised`, `--surface-sunken`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--text-on-accent`, `--accent`, `--accent-strong`, `--accent-soft`, `--info`, `--danger`, `--success`, `--warning` (each status also has a `-soft` fill), `--focus` | Prefer these in new work. |
| Type | `--font-display` (DM Serif Display), `--font-body` (Inter), `--font-wordmark` (Cinzel, wordmark only) | Headings use display. Everything else uses body. |
| Type scale | `--step--1` (13-14px), `--step-0` (16-18px), `--step-1` (19-23px), `--step-2` (22-30px), `--step-3` (30-44px), `--step-4` (40-72px) | Fluid sizes with `clamp()`. |
| Space | `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px, `--space-6` 32px, `--space-7` 48px, `--space-8` 64px | Margins, padding, gaps. |
| Shape | `--radius-sm` 6px, `--radius-md` 10px, `--radius-pill`, `--tap-target` 44px | Corners and touch size. |
| Depth | `--shadow`, `--shadow-sm` | Use sparingly. |

Color rules:

- Gold text on a light background uses `--gold-text`. `--gold` is for rules, borders and dark garnet panels.
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

## Page templates

**Info page** (handbook, about, policies). `PageHeader` with a lede and no actions. Then sections with
h2 headings. Use a `Notice` only for the one thing a parent must not miss.

**Action page** (give, sign up, pay, RSVP). `PageHeader` with one primary action. Then the form built
from `Field`s, `MoneyLine` for every amount, and a `Notice tone="success"` after it is done. Say who
receives money and when the deadline is.

**Workspace page** (portal, staff tools). A short `PageHeader` with no eyebrow. Then `StatusChip`s and a
`DataTable` or list for the work. Keep the current state and the next action at the top. Show an
explicit unknown state instead of a blank.

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
