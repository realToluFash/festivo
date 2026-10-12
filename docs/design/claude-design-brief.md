# Brief for Claude Design — the Soirely design context

> Paste everything below the line into Claude Design. It is written to stand on
> its own: a designer reading it needs no access to this repository.
>
> Keep this file as the brief is revised, so the design context and the brief it
> came from stay together. What comes back lands in `docs/design/` beside it.

---

## What you are designing

**Soirely** is event management software. One person — an organiser — plans an
event over weeks and then runs it in one night. Weddings, conferences, funerals,
birthdays, launches. Four hundred guests, a seating plan, a menu with dietary
variants, a budget, a running order, a team of staff.

It is sold globally and speaks **English, Spanish, French and Portuguese** from
day one.

You are designing its **design context**: the tokens, typography, components and
layout patterns that every screen will be built from, plus a page on each
surface that displays them all. Not screens — the vocabulary screens are made
of.

## Three surfaces, three completely different situations

This is the part that should shape the design. The same product is used in three
places that have almost nothing in common, and a system that treats them as one
responsive continuum will be wrong in all three.

### Web — planning, at a desk

A person with a keyboard, a wide monitor and a spreadsheet mindset. Four hundred
rows of guests. Drag a guest to a table. Reconcile dietary choices against a
menu. Chase eleven bounced invitations.

**Desktop-first, genuinely** — not a phone layout stretched across a monitor.
Dense tables, a persistent sidebar, keyboard navigation that actually goes
somewhere, and a content area that uses a 2560px screen rather than centring
1200px of it.

The same web application also serves two audiences the organiser is not:

- **A guest.** No account, will never install anything, arrives from a link in
  an email, probably on a phone, possibly elderly, possibly annoyed. Replies to
  an invitation, picks a meal, reads where they are sitting. This has to be the
  simplest thing in the product.
- **Somebody who has never heard of Soirely.** The marketing and sign-up pages.

### Mobile — running the night

A dim room at nine in the evening. One hand free; the other is holding plates, a
clipboard or a phone torch. Noise. A server who needs to know which table is
waiting and which guest has the nut allergy, in one glance, while walking.

Three layouts, and they are **structurally different rather than rescaled**:

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **Phone**            | one thing at a time; controls within a thumb's reach of the bottom |
| **Tablet portrait**  | two columns, detail stacked beneath the list                       |
| **Tablet landscape** | a list beside a detail pane that stays put                         |

A tablet on a stand at a kitchen pass is a real deployment, not an edge case.

**A dark appearance is a product requirement here, not a preference.** A white
screen at full brightness in a dim venue is both unusable and rude to the room.
Treat the night-time appearance as the primary one for this surface and the
light one as the alternate — the opposite of the web.

### Support — an agent console

Seven o'clock on a Saturday. A customer's service floor has stopped working
mid-event. An agent has to read an account's whole history in ten seconds and
act.

Read-heavy, information-dense, keyboard-driven. One timeline per account,
organisation and event — _signed up → verified → joined an organisation →
created an event → sent 412 invitations, 11 bounced → upgraded → started
service_. Search that accepts any identifier the customer happens to have: an
email, a phone number, an event name, a correlation id, an invoice number.

Two queues that must look different at a glance: the normal one, and the one for
a broken event in progress. The second is not a priority flag on the first.

This surface is used all day by a handful of people who will become expert in
it. Optimise for speed and density over friendliness. It should not look like a
different product, but it should not be styled as if an organiser were reading
it either.

## Start by proposing directions — do not start building

**First, propose four distinct visual directions**, each as:

- background and surface hex, ink and muted-ink hex, one accent hex
- a typeface pairing, named
- one line on why it fits _this_ product
- one line on what it would feel wrong for

Then stop and wait for a choice. Build out only the chosen direction.

This matters because the brief is otherwise wide open, and the first instinct is
rarely the best fit for a product that has to feel calm during a crisis.

Make the four genuinely different from one another — different in temperature,
in formality and in typographic voice, not four versions of one idea with the
accent rotated. Events span a funeral and a product launch; there is real range
available.

Avoid, across all four, the aesthetic that tools converge on when unsupervised:
Inter, Roboto or system-ui as a _choice_; purple or blue gradients; a grid of
identical rounded cards with a drop shadow; a palette that could belong to any
SaaS product. Avoid equally the other default — cream background, serif display
type, terracotta accent, italic word-accents — which is a real aesthetic and
overused for exactly this kind of brief.

## What to deliver, once a direction is chosen

### 1. Tokens, as one declaration

Colour, type, spacing, radii, border, shadow, motion, and the per-surface
exceptions. Named by **role, not by appearance** — `surface-raised`, not
`grey-100` — because a dark appearance and a light one have to share the names.

Every colour that carries meaning needs its full set: default, hover, active,
disabled, and the ink that goes on it.

State the contrast ratio for each text-on-background pair. **4.5:1 minimum for
body text, 3:1 for large text and for the focus ring.** The guest surface and
the night-time mobile surface are where this will actually be tested — a
seventy-year-old reading an invitation on a phone in a car, and a server in a
dim room.

### 2. Typography

A scale with a stated purpose per step, not a ratio for its own sake. Say which
step is the table row, which is the body, and which is the one number somebody
reads from two metres away.

**Weights, not families, are how weight is selected.** A custom face ships one
file per weight and is resolved by weight; name the weights you use and keep
them few.

The scale must survive four languages. French and Portuguese run roughly 20–30%
longer than English for the same sentence. **No fixed-width labels, no text
fitted tightly to a button, no truncation as a layout strategy.** Say what
happens when a label does not fit.

Numbers deserve a decision of their own: tabular figures wherever a column of
them is read — counts, money, times, capacities — and proportional elsewhere.

### 3. Components

**Everything below is in scope.** For each one: anatomy, sizes, and every state
it can be in — default, hover, focus-visible, active, selected, disabled,
loading, error, empty — plus one line on what it must never be used for.

The use case beside each is what it is actually for in this product. Design for
that, not for the generic version of the component.

#### Primitives

| Component            | What it is for here                                                                                           | Must handle                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Text and Heading     | The type scale in use; every string a reader sees                                                             | Four locales, 30% longer strings, wrapping rather than truncating                                                                   |
| Icon                 | A set wide enough for guests, seating, menu, schedule, messaging, billing and support                         | One stroke weight, legible at 16px and at 32px, never the only carrier of meaning                                                   |
| Avatar, AvatarGroup  | A guest, an organisation member, a staff member; overlapping sets on a table or a shift                       | Initials fallback, a photo, a group with an overflow count                                                                          |
| Tag                  | A guest group — "bride's side", "vendors", "table 4" — and an applied filter                                  | Removable and static variants, a long name, many in a row                                                                           |
| StatusPill           | The one piece of state a row is read for: an RSVP, an event's lifecycle, a delivery outcome, a ticket's queue | Colour plus shape or glyph, so it survives colour blindness and a greyscale print                                                   |
| DietaryMark          | An allergy or preference on a guest, a dish or a seat                                                         | Legible at a glance in a kitchen, in a set of six, distinguishable without colour. Severity matters: an allergy is not a preference |
| Surface, Card, Panel | The containers everything else sits in                                                                        | Raised and flat, with and without a header, nested one level                                                                        |
| Divider              | Separating rows and sections without a border on everything                                                   | Horizontal, vertical, and with a label in the middle                                                                                |
| Skeleton             | The shape of content that has not arrived                                                                     | Table rows, a card, a list, text lines — each matching its real counterpart's dimensions                                            |
| CopyableId           | A correlation id on an error screen, an invoice number, a message id                                          | Monospaced, truncated in the middle, one tap to copy, confirmation of the copy                                                      |

#### Actions

| Component                     | What it is for here                                                                               | Must handle                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Button                        | Primary, secondary, quiet and destructive, in three sizes                                         | A loading state that does not resize the button, an icon with or without a label, full-width on mobile              |
| IconButton                    | Row actions, toolbar actions, closing things                                                      | A 44px touch target even when the glyph is 16px, and a required accessible name                                     |
| ButtonGroup, SegmentedControl | Switching how the same data is shown — seating as a plan or a list, a schedule by day or by room  | Two to five options, the selected one unambiguous, overflow when labels are long                                    |
| SplitButton                   | An action with a choice attached: "Send invitations" with a channel picker                        | A default action reachable in one press, the menu in two                                                            |
| Menu                          | The `⋯` on every row, and the primary-action overflow                                             | Sections, destructive items set apart, icons, keyboard navigation, and submenus only if genuinely needed            |
| Link                          | Inline navigation, and the only thing in the product that may look like a link                    | Visited state, external indicator, and a focus ring that survives mid-sentence                                      |
| Toolbar                       | What appears when rows are selected: assign a table, change a group, send to these guests, delete | A live count of the selection, a clear-selection affordance, and a position that does not cover the rows it acts on |
| FloatingAction                | The one thing a server does most on a phone during service                                        | One hand, bottom-right or bottom-centre, and never covering the last row of a list                                  |

#### Form inputs

| Component               | What it is for here                                                                              | Must handle                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TextField               | Names, venues, titles, search                                                                    | Prefix and suffix, a character counter where there is a limit, and a caret that matches the text colour rather than the platform default |
| TextArea                | A note on a guest, a message body, an internal support note                                      | Auto-growth to a cap, then its own scroll                                                                                                |
| NumberField, Stepper    | Plus-ones, table capacity, portions, quantities                                                  | Increment by press and by keyboard, a minimum and maximum, and no spinner so small it needs aiming                                       |
| PasswordField           | Sign-up, sign-in, reset                                                                          | A reveal toggle, and a strength indicator that explains rather than scores                                                               |
| OtpField                | Email and phone verification, MFA                                                                | Six boxes, paste of the whole code at once, auto-advance, and auto-submit on completion                                                  |
| PhoneField              | Every guest and every account — this product is international                                    | A country selector with a dial code, formatting as typed, and a valid number that is not E.164 yet                                       |
| CurrencyField           | A budget line, a price, a refund                                                                 | A currency symbol that is not assumed to be a dollar, thousands separators per locale, and negative values                               |
| Select                  | A short closed list: a role, a course, a status                                                  | A placeholder distinct from a chosen value, grouped options, and the native control on mobile                                            |
| Combobox                | A long list that must be searched: pick a guest out of four hundred, a dish, a table, a timezone | Typeahead, no-match, loading while searching, keyboard-only selection, and a chosen value that is not re-searchable by accident          |
| MultiSelect, TokenInput | Message recipients, guest groups on a guest, dietary needs                                       | Tokens that wrap over several lines, removal by keyboard, and a cap with a count                                                         |
| Checkbox, CheckboxGroup | Row selection, opt-ins, multi-choice filters                                                     | An indeterminate state for "some rows on this page"                                                                                      |
| Radio, RadioGroup       | One of a few, where seeing all of them matters — an RSVP answer, a plan tier                     | A description under each option, and a disabled option that says why                                                                     |
| Switch                  | A setting that applies immediately — a channel on or off, a feature for an organisation          | The label saying what being on means, never ambiguous when off, and a pending state while saving                                         |
| DatePicker              | An event date, a deadline                                                                        | A locale-correct first day of the week, disabled days with a reason, and keyboard entry as well as the calendar                          |
| DateRangePicker         | A multi-day event, a reporting period, a delivery log window                                     | A single-day range, an open end, and two months side by side on desktop                                                                  |
| TimePicker              | A schedule item, a service window, a send time                                                   | 12- and 24-hour by locale, and a timezone label where it could be ambiguous                                                              |
| FileDrop                | A guest list to import, a cover image, an attachment on a support ticket                         | Drag-and-drop and a file picker, per-file progress, a rejected type with the reason, and a removal that is undoable before upload        |
| SearchField             | The support console's any-identifier search, and every filter bar                                | Results as you type, a visible way to clear, recent searches, and a return key that has a job                                            |
| ColorSwatch             | A seating section's colour, a tag's colour                                                       | A constrained palette rather than a free picker, and a selection legible on both appearances                                             |
| FormField               | The label, hint, error, required marker and disabled reason around every input above             | An error that replaces nothing and pushes nothing off screen, and a hint that survives alongside an error                                |
| FormLayout              | How a form is arranged: one column, two columns, a fieldset, a footer                            | A docked submit on mobile with a keyboard covering the lower third, and a sticky footer on long forms                                    |

#### Data display

| Component    | What it is for here                                                                        | Must handle                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DataTable    | The core of the web surface: four hundred guests, a delivery log, an audit trail, invoices | Sortable and sticky headers, row selection, inline edit, column visibility, a frozen first column, virtualised scrolling, dense and comfortable row heights, and empty, loading and error states that keep the header |
| ListRow      | The mobile equivalent of a table row, and the web's compact lists                          | A primary line, a secondary line, trailing state, a swipe action on mobile, and a 44px minimum height                                                                                                                 |
| KeyValueList | A guest's details, an invoice's breakdown, an account's facts in the support console       | A missing value shown as such rather than blank, and a long value that wraps                                                                                                                                          |
| Timeline     | An account's history in the support console, and an event's audit trail                    | Dense, grouped by day, with an actor, an action and a source; agent actions distinguishable from the account holder's                                                                                                 |
| Stat         | A count an organiser reads first: accepted, declined, awaiting, seated, served             | A number, a label, a change against a previous period, and a loading state the same size as the value                                                                                                                 |
| Meter        | A plan allowance against usage, an import's progress, RSVP completion                      | Approaching a limit, at it, and over it — three states, not a gradient                                                                                                                                                |
| Chart        | Insights: RSVPs over time, channel mix, spend against budget                               | Bar, line and donut with a categorical palette that works on both appearances and in greyscale, a legend, an empty series, and a single data point                                                                    |
| Calendar     | An organiser's events across a month                                                       | An event spanning days, several on one day, and today                                                                                                                                                                 |
| ScheduleGrid | The run of show, by time and by room or stage                                              | Overlapping items, an item that has overrun, a now-line, and a drag to move an item                                                                                                                                   |
| Pagination   | Anything long enough not to be virtualised                                                 | A page size control, a total count, and a last page that is not a guess                                                                                                                                               |

#### Navigation and structure

| Component      | What it is for here                                                                             | Must handle                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| AppShell       | The signed-in web layout: sidebar, content, and the room for a detail panel                     | A collapsed sidebar, a wide monitor, and a tablet                                                                  |
| SidebarNav     | Where an organiser lives: events, guests, seating, menu, schedule, staffing, messages, settings | Sections, an active item, a count badge, a collapsed icon-only state, and an item the account lacks permission for |
| OrgSwitcher    | Switching between organisations, reachable from anywhere                                        | One organisation, many, a long name, and the current one obvious                                                   |
| PageHeader     | The top of every screen: title, breadcrumb, state, actions, tabs                                | A long title, three actions plus an overflow, and a subtitle that carries live state                               |
| Tabs           | Views of one thing — a guest's details, replies, messages, seat                                 | Overflow by scroll, a count per tab, and a keyboard order that matches the visual one                              |
| Breadcrumb     | Where you are inside an event                                                                   | Truncation in the middle, never at the current page                                                                |
| Accordion      | Long settings pages, a menu's courses, a venue's sections                                       | One open or many, and a header that carries a summary when closed                                                  |
| Steps          | Creating an event, onboarding, importing guests                                                 | A current step, completed steps, a step with an error, and going back without losing work                          |
| CommandPalette | How an expert agent and a power organiser actually navigate                                     | Fuzzy search over actions and records, recent items, and keyboard-only operation                                   |
| BottomTabBar   | The mobile surface's primary navigation during service                                          | Three to five destinations, a badge, and a safe area below it                                                      |
| MobileHeader   | The top of a mobile screen: back, title, one action                                             | A back affordance that is obvious, a long title, and a large-title variant that collapses on scroll                |

#### Overlays

| Component      | What it is for here                                                                                           | Must handle                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal          | A focused task that must not lose the page behind it: assign seats, compose a message                         | Three widths, a scrolling body with a fixed footer, stacking one level, and a close that confirms if there are unsaved changes                                |
| ConfirmDialog  | Deleting an event, removing a guest, cancelling a send in progress                                            | The consequence stated in the body rather than the title, the destructive action not the default focus, and typed confirmation for the genuinely irreversible |
| Drawer         | A record's detail beside the table it came from, so the list keeps its place                                  | Resizable or two fixed widths, and navigation between records without closing                                                                                 |
| BottomSheet    | The mobile equivalent of both: a guest's detail, a seat's actions, a filter                                   | Snap points, a drag handle, a scrolling body, and a keyboard that does not cover its own input                                                                |
| Popover        | A small amount of interactive content anchored to a control: a filter, a date picker, a colour                | Flipping when near an edge, and never clipped by the card it was triggered from                                                                               |
| Tooltip        | A name for an icon-only control, and an abbreviation's expansion                                              | Keyboard focus as well as hover, a touch equivalent, and never the only place information exists                                                              |
| Toast          | The result of something that already happened: saved, sent, imported                                          | An undo for anything bulk, several stacked, a position that does not cover the primary action, and a duration proportional to the message                     |
| Banner         | A condition that persists: a plan limit reached, a verification pending, an event on hold, a degraded channel | Info, success, warning and danger, an action, and dismissible versus not                                                                                      |
| InlineAlert    | The same, scoped to a form or a section rather than a page                                                    | Sitting inside a form without breaking its rhythm                                                                                                             |
| EmptyState     | Every screen in an organiser's first hour, and every filter that matches nothing                              | Three kinds — nothing yet, nothing found, nothing permitted — each with a different action, and never the same illustration for all three                     |
| LoadingOverlay | Blocking a region while something completes                                                                   | A region rather than the page where possible, and a message after three seconds                                                                               |

#### The product's own components

These are what make it this product rather than a generic admin panel, and they
deserve the most thought.

| Component           | What it is for here                                                                                   | Must handle                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GuestRow            | The single most-read row in the product: name, group, RSVP, dietary marks, plus-ones, seat            | A guest with none of those things, a guest with all of them, a very long name with a title — "Chief Mrs Adaeze Okonkwo-Williams" — and a plus-one whose attendance depends on its host              |
| RsvpControl         | Recording or showing a reply: accepted, declined, awaiting, and held because the host has not replied | The held state reading as genuinely different from awaiting, and a guest changing their mind                                                                                                        |
| SeatingCanvas       | A floor plan of tables, rows and loose chairs, with guests dragged onto seats                         | Four zoom levels with different detail at each, pan, a selected seat, an occupied seat, a seat held for a plus-one, a tray of unseated guests, and the whole thing operated by a finger on a tablet |
| TableShape          | One table on that canvas: round, rectangular or custom, with seats around it                          | Capacity against occupancy, a name, a rotation, an overfull table, and a size small enough that only the shape is readable                                                                          |
| CoursePlan          | A menu as courses, dishes and variants                                                                | A dish with three variants, a course with one dish, and a dietary variant marked as such                                                                                                            |
| DishCard            | A dish wherever it is chosen or served                                                                | Its dietary marks, its variant, and a count of how many guests chose it                                                                                                                             |
| ScheduleItem        | One item in the run of show                                                                           | A duration, an owner, a dependency, a current item, an overrun, and an item with no fixed time                                                                                                      |
| StageDisplay        | A screen in the room showing what is happening and what is next                                       | Read from twenty metres, almost no chrome, and a graceful look when nothing is scheduled                                                                                                            |
| PresenterConsole    | What the person holding the microphone sees                                                           | The current item, the next item, a running timer, and a cue — legible at a glance under stage lighting                                                                                              |
| ServiceTable        | A table during service, on a phone in a server's hand                                                 | Its state — waiting, served, requesting, needs attention — readable at arm's length in a dim room in under a second, without relying on colour alone                                                |
| KitchenTicket       | A plate's journey from the pass to the table                                                          | A table, a course, covers, dietary flags that cannot be missed, and elapsed time                                                                                                                    |
| GuestRequest        | Something a guest asks for from their seat                                                            | Urgency, who is handling it, how long it has been waiting, and resolution                                                                                                                           |
| InvitationPreview   | What a guest will actually receive, before it is sent                                                 | The same invitation as an email, an SMS, a WhatsApp message and a web page — four genuinely different renderings                                                                                    |
| GuestPass           | What a guest sees on their own phone: their seat, their meal, their table                             | No account, one hand, bright sunlight outside a venue, and a screenshot that still makes sense                                                                                                      |
| MessageComposer     | Choosing an audience, channels, a template and a trigger                                              | A live estimate of reach, a per-channel breakdown, guests unreachable on every channel, and the cost before sending                                                                                 |
| DeliveryRow         | One attempt to reach one person, in the log                                                           | The channel, the status, the provider's response, and **why a channel was skipped** — expected to be the largest single source of support tickets                                                   |
| ChannelBreakdown    | Where a send actually went                                                                            | Per-channel counts, a channel that was skipped and why, and nobody reachable at all                                                                                                                 |
| PlanUsage           | A plan's allowance against what has been used                                                         | Approaching a limit, at it, over it, and an override granted by support                                                                                                                             |
| AssistantPanel      | Asking the assistant something, on any surface                                                        | A conversation, the assistant working, a tool being run and what it did, an answer declined, the provider busy, and the assistant unavailable here                                                  |
| CheckInScanner      | Arrivals at the door, on a phone                                                                      | A camera view, a successful scan, an unknown code, an already-arrived guest, and a manual fallback by name                                                                                          |
| SupportQueueRow     | A ticket waiting for an agent                                                                         | Two visibly different lanes — a normal request, and a broken event in progress — plus age, account and assignee                                                                                     |
| IdentifierSearch    | The support console's front door                                                                      | Any identifier the customer happens to have, mixed result types in one list, and no match                                                                                                           |
| AuditRow            | Who changed what, when, and from where                                                                | An agent action distinguishable from the account holder's, a before and an after, and a system action with no actor                                                                                 |
| ImpersonationBanner | An agent seeing what a customer sees                                                                  | Impossible to miss, impossible to forget, present on every screen, read-only by default, and one action to leave                                                                                    |

### 4. Layout patterns

Per surface, with the actual grid: the web application shell; the web public
page; the web guest page; the three mobile layouts; the support console shell;
the stage display.

Say where the breakpoints are and what **changes structurally** at each — not
what rescales.

Two platform facts to design within rather than around:

- Android draws the app behind the status and navigation bars. Content is kept
  clear of them by the layout, so say what the safe area does to each pattern.
- A keyboard covering the lower third of a phone screen is the normal state
  while typing. Say where the submit control goes.

### 5. Motion and feedback

Durations and easing, as tokens. What animates and what must not. **Honour
`prefers-reduced-motion`** — state the reduced variant for anything that moves.

Say what a 300ms wait looks like versus a 3-second one, and what an optimistic
action looks like when it turns out to have failed.

### 6. A gallery page per surface — the part that keeps this honest

A single page on **web**, on **support** and in the **mobile app** that renders
every component above in every state, reading from the tokens.

Not a static specimen sheet. A page a developer opens to copy from, a designer
opens to check against, and that visibly breaks when a token changes — which is
the only thing that keeps a design system and a codebase from drifting apart
across sixteen areas of work.

Each entry shows: the component, its states side by side, and the token names it
consumes.

## Non-negotiables

- **Four locales, all equal.** Nothing designed English-first and translated
  later. The supported set may grow, so nothing may assume left-to-right
  structurally.
- **`focus-visible` on everything reachable by keyboard**, with a ring that
  survives on every background in the palette.
- **A skip link** to the content on every full page.
- **`prefers-reduced-motion`** honoured, with the reduced variant stated.
- **Contrast**: 4.5:1 body text, 3:1 large text and focus ring.
- **Meaning never carried by colour alone** — a shape, a glyph or a label as
  well. A kitchen prints things in greyscale and a server may be colour-blind.
- **Touch targets at least 44px** on any surface a finger reaches.
- **Mobile selects a typeface by weight, never by family name** in a style, and
  a text element is never nested inside another text element — two adjacent ones
  instead.
- **A menu, popover or tooltip is a top-level overlay**, never rendered inside a
  card, which clips it.
- **A dark appearance for mobile and a light one for web and support**, sharing
  one set of token names.

## How to answer

1. The four directions, then stop.
2. After a direction is chosen: tokens, then typography, then components, then
   layouts, then motion, then the gallery.
3. For every decision that could have gone the other way, one sentence on why it
   went this way. A design context without reasons gets overridden by the first
   developer who disagrees with it.
