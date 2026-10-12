# Brief for Claude Design — the Soirely design context

> Paste everything below the line into Claude Design. It is written to stand on
> its own: a designer reading it needs no access to this repository.
>
> **The first exchange only needs this file down to the end of "Start by
> proposing directions".** That step returns four directions and nothing else,
> so the 197-component inventory below it is noise until one is chosen. Paste
> the rest when it is.
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

**And render each direction as the same small specimen**, so the four can
actually be compared rather than imagined: a page heading, a line of body text,
a primary button, a quiet button, one dense table row of three guests with a
status pill each, and one form field with its label. The same six things, four
times, on one page. A direction described in prose cannot be chosen between;
the same specimen four times can.

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

It is in two parts: a **shared library** every surface draws on, then the
components belonging to each **area of work** — grouped the way the product
itself is divided, so the set can be checked for completeness one area at a
time rather than as one list of two hundred:

> accounts and sign-in · organisations and access · events · guests · venue and
> seating · menu and dietary · run of show · staffing · service floor ·
> messaging · plans and billing · the assistant · support · insights ·
> marketing

If something is missing from an area, say so — this inventory is drawn from what
the product is being built to do, so it will be wrong at the edges.

**Deliver it in batches, in this order, and stop after each one.** Part A first
and whole, because everything in Part B composes from it. Then the areas, in
this order: guests, venue and seating, messaging, events, run of show, service
floor, organisations and access, accounts and sign-in, plans and billing, menu
and dietary, the assistant, staffing, support, insights, marketing. That order
is the order they get built in, and a batch that is actually finished is worth
more than all of it sketched.

---

**Part A — the shared library.** The vocabulary every surface draws on.

#### Primitives

| Component            | What it is for here                                                                                             | Must handle                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Text and Heading     | The type scale in use; every string a reader sees                                                               | Four locales, 30% longer strings, wrapping rather than truncating                        |
| Icon                 | A set wide enough for guests, seating, menu, schedule, messaging, billing and support                           | One stroke weight, legible at 16px and at 32px, never the only carrier of meaning        |
| Avatar, AvatarGroup  | A guest, an organisation member, a staff member; overlapping sets on a table or a shift                         | Initials fallback, a photo, a group with an overflow count                               |
| Tag                  | A guest group — "bride's side", "vendors", "table 4" — and an applied filter                                    | Removable and static variants, a long name, many in a row                                |
| StatusPill           | The one piece of state a row is read for: an RSVP, an event's lifecycle, a delivery outcome, a membership state | Colour plus shape or glyph, so it survives colour blindness and a greyscale print        |
| Surface, Card, Panel | The containers everything else sits in                                                                          | Raised and flat, with and without a header, nested one level                             |
| Divider              | Separating rows and sections without a border on everything                                                     | Horizontal, vertical, and with a label in the middle                                     |
| Skeleton             | The shape of content that has not arrived                                                                       | Table rows, a card, a list, text lines — each matching its real counterpart's dimensions |
| CopyableId           | A correlation id on an error screen, an invoice number, a message id, a join code                               | Monospaced, truncated in the middle, one tap to copy, confirmation of the copy           |
| QrCode               | A guest's pass, an organisation's join code, a staff briefing where fifteen people scan at once                 | Printed and on screen, with the code also readable as text for anyone who cannot scan    |
| Countdown            | Time until a schedule item, time a plate has been waiting, a resend cooldown                                    | Counting down and overrunning, and a reduced-motion variant that does not tick           |

#### Actions

| Component                     | What it is for here                                                                                             | Must handle                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Button                        | Primary, secondary, quiet and destructive, in three sizes                                                       | A loading state that does not resize the button, an icon with or without a label, full-width on mobile              |
| IconButton                    | Row actions, toolbar actions, closing things                                                                    | A 44px touch target even when the glyph is 16px, and a required accessible name                                     |
| ButtonGroup, SegmentedControl | Switching how the same data is shown — seating as a plan or a list, a schedule by day or by room                | Two to five options, the selected one unambiguous, overflow when labels are long                                    |
| SplitButton                   | An action with a choice attached: "Send invitations" with a channel picker                                      | A default action reachable in one press, the menu in two                                                            |
| Menu                          | The `⋯` on every row, and the primary-action overflow                                                           | Sections, destructive items set apart, icons, keyboard navigation, and submenus only if genuinely needed            |
| Link                          | Inline navigation, and the only thing in the product that may look like a link                                  | Visited state, external indicator, and a focus ring that survives mid-sentence                                      |
| Toolbar                       | What appears when rows are selected: assign a table, change a group, send to these guests, delete               | A live count of the selection, a clear-selection affordance, and a position that does not cover the rows it acts on |
| FloatingAction                | The one thing a server does most on a phone during service                                                      | One hand, bottom-right or bottom-centre, and never covering the last row of a list                                  |
| DragHandle, SortableList      | Reordering anything a person decides the order of: courses, schedule items, template blocks, sidebar favourites | A keyboard alternative to dragging, a drop indicator, an invalid drop, and a long list that scrolls while dragging  |

#### Form inputs

| Component               | What it is for here                                                                                                                      | Must handle                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TextField               | Names, venues, titles, search                                                                                                            | Prefix and suffix, a character counter where there is a limit, and a caret that matches the text colour rather than the platform default                                                |
| TextArea                | A note on a guest, a message body, an internal support note                                                                              | Auto-growth to a cap, then its own scroll                                                                                                                                               |
| NumberField, Stepper    | Plus-ones, table capacity, portions, quantities                                                                                          | Increment by press and by keyboard, a minimum and maximum, and no spinner so small it needs aiming                                                                                      |
| PasswordField           | Sign-up, sign-in, reset                                                                                                                  | A reveal toggle, and a strength indicator that explains rather than scores                                                                                                              |
| OtpField                | Email and phone verification, and the second factor at sign-in                                                                           | Six boxes, paste of the whole code at once, auto-advance, and auto-submit on completion                                                                                                 |
| PhoneField              | Every guest and every account — this product is international                                                                            | A country selector with a dial code, formatting as typed, and a valid number that is not E.164 yet                                                                                      |
| CurrencyField           | A budget line, a price, a refund                                                                                                         | A currency symbol that is not assumed to be a dollar, thousands separators per locale, and negative values                                                                              |
| AddressField            | A venue, an organisation's address, a billing address                                                                                    | Suggestions as you type from a geocoder, a chosen result shown as structured parts, and **typing it out by hand when nothing matches** — autocomplete is an aid and never a requirement |
| Select                  | A short closed list: a role, a course, a status                                                                                          | A placeholder distinct from a chosen value, grouped options, and the native control on mobile                                                                                           |
| Combobox                | A long list that must be searched: pick a guest out of four hundred, a dish, a table, a timezone                                         | Typeahead, no-match, loading while searching, keyboard-only selection, and a chosen value that is not re-searchable by accident                                                         |
| MultiSelect, TokenInput | Message recipients, guest groups on a guest, dietary needs                                                                               | Tokens that wrap over several lines, removal by keyboard, and a cap with a count                                                                                                        |
| Checkbox, CheckboxGroup | Row selection, opt-ins, multi-choice filters                                                                                             | An indeterminate state for "some rows on this page"                                                                                                                                     |
| Radio, RadioGroup       | One of a few, where seeing all of them matters — an RSVP answer, a plan tier                                                             | A description under each option, and a disabled option that says why                                                                                                                    |
| Switch                  | A setting that applies immediately — a channel on or off, a feature for an organisation                                                  | The label saying what being on means, never ambiguous when off, and a pending state while saving                                                                                        |
| DatePicker              | An event date, a deadline                                                                                                                | A locale-correct first day of the week, disabled days with a reason, and keyboard entry as well as the calendar                                                                         |
| DateRangePicker         | A multi-day event, a reporting period, a delivery log window                                                                             | A single-day range, an open end, and two months side by side on desktop                                                                                                                 |
| TimePicker              | A schedule item, a service window, a send time                                                                                           | 12- and 24-hour by locale, and a timezone label where it could be ambiguous                                                                                                             |
| FileDrop                | A guest list to import, a cover image, an attachment on a support ticket                                                                 | Drag-and-drop and a file picker, per-file progress, a rejected type with the reason, and a removal that is undoable before upload                                                       |
| SearchField             | The support console's any-identifier search, and every filter bar                                                                        | Results as you type, a visible way to clear, recent searches, and a return key that has a job                                                                                           |
| FilterBar               | Narrowing a long list: guests by group and RSVP, a delivery log by channel and outcome                                                   | Several filters applied at once shown as removable tags, a saved view, and a clear-all                                                                                                  |
| ColorSwatch             | A seating section's colour, a guest group's colour                                                                                       | A constrained palette rather than a free picker, and a selection legible on both appearances                                                                                            |
| LocalePicker            | Choosing a language — and it is on the **public and guest pages too**, because somebody who cannot read the page cannot sign up or reply | Each language named in its own language, plus a "follow my device" option distinct from the four                                                                                        |
| FormField               | The label, hint, error, required marker and disabled reason around every input above                                                     | An error that replaces nothing and pushes nothing off screen, and a hint that survives alongside an error                                                                               |
| FormLayout              | How a form is arranged: one column, two columns, a fieldset, a footer                                                                    | A docked submit on mobile with a keyboard covering the lower third, and a sticky footer on long forms                                                                                   |

#### Data display

| Component      | What it is for here                                                                        | Must handle                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DataTable      | The core of the web surface: four hundred guests, a delivery log, an audit trail, invoices | Sortable and sticky headers, row selection, inline edit, column visibility, a frozen first column, virtualised scrolling, dense and comfortable row heights, and empty, loading and error states that keep the header |
| ListRow        | The mobile equivalent of a table row, and the web's compact lists                          | A primary line, a secondary line, trailing state, a swipe action on mobile, and a 44px minimum height                                                                                                                 |
| KeyValueList   | A guest's details, an invoice's breakdown, an account's facts in the support console       | A missing value shown as such rather than blank, and a long value that wraps                                                                                                                                          |
| Timeline       | An account's history in the support console, and an event's audit trail                    | Dense, grouped by day, with an actor, an action and a source; agent actions distinguishable from the account holder's                                                                                                 |
| Stat           | A count an organiser reads first: accepted, declined, awaiting, seated, served             | A number, a label, a change against a previous period, and a loading state the same size as the value                                                                                                                 |
| Meter          | A plan allowance against usage, an import's progress, RSVP completion                      | Approaching a limit, at it, and over it — three states, not a gradient                                                                                                                                                |
| Chart          | Insights: RSVPs over time, channel mix, spend against budget, a sign-up funnel             | Bar, line, donut and funnel with a categorical palette that works on both appearances and in greyscale, a legend, an empty series, and a single data point                                                            |
| Calendar       | An organiser's events across a month                                                       | An event spanning days, several on one day, and today                                                                                                                                                                 |
| Pagination     | Anything long enough not to be virtualised                                                 | A page size control, a total count, and a last page that is not a guess                                                                                                                                               |
| VersionHistory | A seating layout, a menu, a message template — anything a person will want back            | A list of versions with who and when, a preview of one, a restore that is itself undoable, and the current version marked                                                                                             |
| AuditRow       | Who changed what, when, and from where                                                     | An agent action distinguishable from the account holder's, a before and an after, and a system action with no actor                                                                                                   |

#### Navigation and structure

| Component      | What it is for here                                                                             | Must handle                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| AppShell       | The signed-in web layout: sidebar, content, and the room for a detail panel                     | A collapsed sidebar, a wide monitor, and a tablet                                                                  |
| SidebarNav     | Where an organiser lives: events, guests, seating, menu, schedule, staffing, messages, settings | Sections, an active item, a count badge, a collapsed icon-only state, and an item the account lacks permission for |
| OrgSwitcher    | Switching between organisations, reachable from anywhere                                        | One organisation, many, a long name, the current one obvious, and a billing account that pays for several          |
| PageHeader     | The top of every screen: title, breadcrumb, state, actions, tabs                                | A long title, three actions plus an overflow, and a subtitle that carries live state                               |
| Tabs           | Views of one thing — a guest's details, replies, messages, seat                                 | Overflow by scroll, a count per tab, and a keyboard order that matches the visual one                              |
| Breadcrumb     | Where you are inside an event                                                                   | Truncation in the middle, never at the current page                                                                |
| Accordion      | Long settings pages, a menu's courses, a venue's sections, a public FAQ                         | One open or many, and a header that carries a summary when closed                                                  |
| Steps          | Creating an event, onboarding, importing guests, setting up a second factor                     | A current step, completed steps, a step with an error, and going back without losing work                          |
| SetupChecklist | An organiser's first hour: what is done and what is next                                        | Progress, a dismissed state, and an item that cannot be done yet with the reason                                   |
| CommandPalette | How an expert agent and a power organiser actually navigate                                     | Fuzzy search over actions and records, recent items, and keyboard-only operation                                   |
| ShortcutHelp   | The keyboard map, for the surfaces used all day                                                 | Grouped by area, and reachable by a shortcut itself                                                                |
| BottomTabBar   | The mobile surface's primary navigation during service                                          | Three to five destinations, a badge, and a safe area below it                                                      |
| MobileHeader   | The top of a mobile screen: back, title, one action                                             | A back affordance that is obvious, a long title, and a large-title variant that collapses on scroll                |

#### Overlays

| Component      | What it is for here                                                                                                                       | Must handle                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal          | A focused task that must not lose the page behind it: assign seats, compose a message                                                     | Three widths, a scrolling body with a fixed footer, stacking one level, and a close that confirms if there are unsaved changes                                |
| ConfirmDialog  | Deleting an event, removing a guest, cancelling a send in progress, transferring ownership                                                | The consequence stated in the body rather than the title, the destructive action not the default focus, and typed confirmation for the genuinely irreversible |
| Drawer         | A record's detail beside the table it came from, so the list keeps its place                                                              | Resizable or two fixed widths, and navigation between records without closing                                                                                 |
| BottomSheet    | The mobile equivalent of both: a guest's detail, a seat's actions, a filter                                                               | Snap points, a drag handle, a scrolling body, and a keyboard that does not cover its own input                                                                |
| Popover        | A small amount of interactive content anchored to a control: a filter, a date picker, a colour                                            | Flipping when near an edge, and never clipped by the card it was triggered from                                                                               |
| Tooltip        | A name for an icon-only control, and an abbreviation's expansion                                                                          | Keyboard focus as well as hover, a touch equivalent, and never the only place information exists                                                              |
| Toast          | The result of something that already happened: saved, sent, imported                                                                      | An undo for anything bulk, several stacked, a position that does not cover the primary action, and a duration proportional to the message                     |
| UndoBar        | The heavier undo: four hundred guests imported wrongly, a bulk reassignment                                                               | A window long enough to notice the mistake, a count of what it would reverse, and a state after the window has closed                                         |
| Banner         | A condition that persists: a plan limit reached, verification pending, an event on hold, a degraded channel, an impersonation in progress | Info, success, warning and danger, an action, and dismissible versus not                                                                                      |
| InlineAlert    | The same, scoped to a form or a section rather than a page                                                                                | Sitting inside a form without breaking its rhythm                                                                                                             |
| EmptyState     | Every screen in an organiser's first hour, and every filter that matches nothing                                                          | Three kinds — nothing yet, nothing found, nothing permitted — each with a different action, and never the same illustration for all three                     |
| LoadingOverlay | Blocking a region while something completes                                                                                               | A region rather than the page where possible, and a message after three seconds                                                                               |

#### System states

The ones every surface needs and nobody designs until they happen.

| Component         | What it is for here                                                          | Must handle                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ErrorPage         | Not found, not permitted, and something broke                                | **The correlation id, visible and copyable** — it is how a support conversation starts; and a route out that is not the browser's back button |
| OfflineBanner     | A venue basement with no signal, during service                              | What still works, what is queued, and recovery without losing the queued work                                                                 |
| ConnectionStatus  | Whether live updates are actually arriving — the service floor depends on it | Live, reconnecting and stale, with the age of the data when stale; support reads this state too                                               |
| MaintenanceNotice | A planned window                                                             | Said before it starts, not during                                                                                                             |
| TimezoneNotice    | Where a date could be read in the wrong zone                                 | Which zone is being shown, and that it is the event's rather than the reader's                                                                |
| PermissionDenied  | A control the account cannot use, in place                                   | Why, and who can grant it — never a disabled control with no explanation                                                                      |

---

**Part B — the areas of work.** The components that exist only because
this product is what it is.

#### Accounts and sign-in

| Component          | What it is for here                                         | Must handle                                                                                                                         |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AuthLayout         | The shell every sign-in, sign-up and recovery screen shares | A language picker, a narrow phone, and a branded but uncluttered frame                                                              |
| OAuthButtons       | Signing in with Google or Apple                             | Brand-correct marks and wording, a platform-native variant on iOS, and a failure that does not lose the typed email                 |
| VerificationPrompt | "We sent a code to…" for email and phone                    | A resend with a visible cooldown, a wrong-code count, an expired code, and changing the address without starting again              |
| MfaSetup           | Turning on a second factor                                  | A secret as a QR code and as text, backup codes shown once with a copy and a download, and a confirmation step that proves it works |
| MfaChallenge       | The second factor at sign-in                                | A backup code as an alternative, a remembered device, and a lost-device route that does not dead-end                                |
| SessionRow         | Active sessions, so somebody can end one                    | Device, place, last used, the current session marked, and revoking all others                                                       |
| LinkedIdentityRow  | Which providers are linked to this account                  | Unlinking the last sign-in method refused with the reason                                                                           |
| AccountStateNotice | Not verified yet, or dormant after being invited            | What to do next, and no dead end                                                                                                    |

#### Organisations and access

Eight ways into an organisation, one state machine — `invited`,
`pending_approval`, `active`, `suspended`, `left`. Each channel differs only in
who starts it and where it lands, and the design should make that one idea
rather than eight.

| Component            | What it is for here                                       | Must handle                                                                                                             |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| MemberRow            | A person in an organisation                               | Role, membership state, when they joined, how they got in, and the last owner being undeletable                         |
| MembershipStateBadge | Where somebody is in that state machine                   | All five states, visually distinct, with `pending_approval` not reading as `invited`                                    |
| RoleBadge            | What a role grants, at a glance                           | A custom role, and a role that no longer exists on a historic record                                                    |
| PermissionMatrix     | Roles against permissions, edited                         | Many rows and columns on a laptop, an inherited permission, one that cannot be removed, and an unsaved change           |
| InviteComposer       | Inviting people you can name                              | Several addresses at once, a role per invitation, a seat limit reached, and an address already a member                 |
| PendingInviteRow     | An invitation that has not been accepted                  | Its delivery state — sent, bounced, opened — plus resend and revoke                                                     |
| JoinCodePanel        | A code or QR for people you cannot name                   | An expiry, a use limit, a usage count, rotating it, revoking it, and whether it lands in `active` or `pending_approval` |
| JoinRequestRow       | Somebody asking to be let in                              | Approve, decline, what they said, and bulk approval for a briefing where fifteen people scanned at once                 |
| DomainRule           | A verified company domain that joins people automatically | Verification state, the DNS record to add, and whether it auto-approves                                                 |
| OwnershipTransfer    | Handing an organisation over                              | The consequences listed, the recipient confirming, and what happens to a store-bought subscription                      |
| SeatUsage            | Team seats used against the plan                          | At the limit, and over it after a downgrade                                                                             |

#### Events

| Component             | What it is for here                                              | Must handle                                                                                                                     |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| EventCard             | An event in a list                                               | Date or date range, venue, a cover image or none, guest count, and lifecycle state                                              |
| EventLifecycleControl | Draft, active, ongoing, paused, concluded, and the moves between | Only the legal moves offered, the consequence of each stated, and a live event never made unusable                              |
| EventStateBanner      | An event that is paused or concluded, on every screen inside it  | Visible without being in the way, and the same message to a guest in their own words                                            |
| EventWizard           | Creating one                                                     | Resumable, a multi-day event, a hard limit reached at creation with the upgrade offered, and a draft that is obviously not live |
| CoverImagePicker      | The image a guest sees first                                     | A crop that works at both the card and the banner aspect, and a good-looking default when there is none                         |

#### Guests

| Component         | What it is for here                                                                                       | Must handle                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GuestRow          | The single most-read row in the product: name, group, RSVP, dietary marks, plus-ones, seat                | A guest with none of those things, a guest with all of them, a very long name with a title — "Chief Mrs Adaeze Okonkwo-Williams" — and a plus-one whose attendance depends on its host |
| RsvpControl       | Recording or showing a reply: accepted, declined, awaiting, and **held because the host has not replied** | The held state reading as genuinely different from awaiting, and a guest changing their mind                                                                                           |
| DietaryMark       | An allergy or preference on a guest, a dish or a seat                                                     | Legible at a glance in a kitchen, in a set of six, distinguishable without colour. **Severity matters: an allergy is not a preference**                                                |
| PlusOneEditor     | A guest's companions                                                                                      | Named and unnamed, a cap, and the held state inherited from the host                                                                                                                   |
| GuestGroupManager | The groups a list is organised by                                                                         | Renaming one that is in use, merging two, and a colour                                                                                                                                 |
| ColumnMapper      | A spreadsheet's columns against the fields they mean                                                      | A guessed mapping, an unmapped required field, and a column deliberately ignored                                                                                                       |
| ImportStagingGrid | Fixing the rows **before** anything is created                                                            | Per-cell errors with reasons, fixing in place, a duplicate against existing guests, a row excluded, and a count of what will be created                                                |
| ImportRunRow      | The history of imports, because one will go wrong                                                         | What it created, who ran it, and **undoing the whole run**                                                                                                                             |
| DuplicateMerge    | Two records that are one person                                                                           | Which value wins per field, what happens to their RSVP and seat, and a merge that is undoable                                                                                          |
| AttendanceControl | Did they turn up                                                                                          | Arrived, not arrived, and arrived without an invitation                                                                                                                                |

#### Venue and seating

The seating plan is the most complex thing in the product and needs the most
design. It is edited with a mouse on a desk and operated with a finger on a
tablet, and the same layout is later read live during service.

| Component       | What it is for here                                                                  | Must handle                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| SeatingCanvas   | The floor plan: sections, tables, rows and loose chairs, with guests placed on seats | Four zoom levels with different detail at each, pan, a finger on a tablet, a very large room, and an empty room   |
| Seat            | The atom everything else is made of                                                  | Empty, occupied, held for a plus-one, blocked, selected, and the occupant's name at the zoom levels where it fits |
| TableShape      | One table: round, rectangular or custom                                              | Capacity against occupancy, a name, rotation, an overfull table, and a size at which only the shape is readable   |
| ChairRow        | Ceremony seating — rows rather than tables                                           | A row with an aisle, a curved row, and numbering that matches what is printed on the chairs                       |
| LooseChair      | A chair that belongs to no table                                                     | Placed anywhere, and still assignable                                                                             |
| Section         | A named, coloured area of the room                                                   | Overlapping sections refused, a renamed section in use, and the colour legible on both appearances                |
| SeatingToolbar  | The editing controls                                                                 | Add, duplicate, rotate, align, delete, undo — and a tool that is active                                           |
| AlignmentGuide  | Feedback while dragging                                                              | Snapping to another object and to a grid, and a way to override it                                                |
| ZoomControl     | Getting around a large room                                                          | Zoom to fit, zoom to selection, a minimap, and the current level stated                                           |
| UnseatedTray    | Guests not yet placed                                                                | Four hundred of them, searchable, grouped, dragged out, and a count that is the headline number                   |
| CapacitySummary | Seats against guests                                                                 | Short of seats, surplus, and a table over its own capacity                                                        |
| PrintablePlan   | The version a venue prints and pins up                                               | Greyscale, A4 and A3, seat numbers and guest names legible at print size, and a legend                            |

#### Menu and dietary

| Component          | What it is for here                                          | Must handle                                                                                                                               |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CoursePlan         | The whole menu as courses in order                           | Reordering, a course with one dish, and a service time per course                                                                         |
| Course             | One course                                                   | A name, its position, its service time, and its dishes                                                                                    |
| DishCard           | A dish wherever it is chosen or served                       | Its dietary marks, its variants, and a count of how many guests chose it                                                                  |
| VariantBuilder     | A dish's variants — the vegetarian main, the smaller portion | A variant that is itself a dietary accommodation, a default variant, and a variant with no takers                                         |
| DietaryTagPicker   | Marking a dish or a guest                                    | A constrained set rather than free text, severity, and a note for the one case the set does not cover                                     |
| GuestChoiceSummary | What the kitchen needs to know                               | Counts per dish and variant, per table and for the room, guests who have not chosen, and allergies called out separately from preferences |
| MenuChangeNotice   | The menu changed after guests had already chosen             | Who is affected, what their choice was, and asking them again without losing the original answer                                          |

#### Run of show

| Component        | What it is for here                                             | Must handle                                                                                            |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ScheduleGrid     | The running order, by time and by room or stage                 | Overlapping items, an item that has overrun, a now-line, and dragging an item to move it               |
| ScheduleItem     | One item                                                        | A duration, an owner, a dependency, the current item, an overrun, and an item with no fixed time       |
| CueList          | What the person running the night reads down                    | The current cue, the next, a cue that has been called, and a note only staff see                       |
| StageDisplay     | A screen in the room showing what is happening and what is next | **Read from twenty metres**, almost no chrome, and a graceful look when nothing is scheduled           |
| PresenterConsole | What the person holding the microphone sees                     | The current item, the next item, a running timer, a cue — legible at a glance **under stage lighting** |

#### Staffing

Distinct from organisation membership: a hired waiter works one night and is not
in your company.

| Component         | What it is for here                                           | Must handle                                                                                                           |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| StaffRow          | Somebody working this event                                   | Their job, their shift, their access state, and no account at all                                                     |
| ShiftAssignment   | Who is on, when                                               | Overlapping shifts, an unfilled shift, and a change on the night                                                      |
| StationAssignment | Which tables or sections somebody is responsible for          | Unassigned tables, one person on several sections, and a reassignment mid-service                                     |
| EventAccessGrant  | Access that is bounded by the event rather than by membership | Granted without an account, expiring with the event, revoked immediately, and **issued in an emergency on the night** |

#### Service floor

Everything here is read in a dim room, at arm's length, by somebody holding
something else.

| Component      | What it is for here                                                    | Must handle                                                                                                                |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ServiceTable   | A table during service                                                 | Its state — waiting, served, requesting, needs attention — readable **in under a second**, without relying on colour alone |
| LiveFloorPlan  | The seating layout rendered with service state rather than for editing | State per table at a glance, a tap to open one, and no editing affordances at all                                          |
| KitchenTicket  | A plate's journey from the pass to the table                           | Table, course, covers, **dietary flags that cannot be missed**, and elapsed time                                           |
| CourseProgress | Which course the room is on                                            | Tables ahead and behind, and a room deliberately out of step                                                               |
| GuestRequest   | Something a guest asks for from their seat                             | Urgency, who is handling it, how long it has waited, and resolution                                                        |

#### Messaging

One machine: a message has an audience, channels, a template and a trigger.

| Component            | What it is for here                                   | Must handle                                                                                                                                           |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AudienceBuilder      | Who a message goes to                                 | Conditions combined with and/or, a live count as it is built, a saved audience, and an audience that matches nobody                                   |
| ChannelPicker        | Which channels carry it                               | A channel the plan does not include, a channel out of credits, and **push as a companion that rides along rather than one ranked against the others** |
| TemplateEditor       | Writing the message                                   | Merge fields inserted and shown as tokens rather than raw braces, an invalid field, a per-channel length limit, and the same template in four locales |
| MessagePreview       | What a person will actually receive                   | The same message as an email, an SMS, a WhatsApp message, an in-app item and a web page — **five genuinely different renderings**                     |
| SendSchedule         | When it goes                                          | Now, at a time, or on a trigger such as publishing or a countdown to the event; and a timezone that is the recipient's problem, not the sender's      |
| SendSummary          | The last screen before it goes                        | Reach, a per-channel breakdown, the cost, guests reachable on no channel at all, and a confirmation proportional to how many people it will reach     |
| DeliveryRow          | One attempt to reach one person                       | The channel, the status, the provider's response, and **why a channel was skipped** — expected to be the largest single source of support tickets     |
| ChannelBreakdown     | Where a send actually went                            | Per-channel counts, a skipped channel with the reason, and nobody reachable                                                                           |
| NotificationFeedItem | The in-app channel, which is a channel like any other | Read and unread, an action, and grouping when several arrive together                                                                                 |
| NotificationBell     | That the feed has something in it                     | A count, a count that is large, and a cleared state                                                                                                   |

#### Plans and billing

A subscription belongs to an **organisation**; a billing account pays for it and
may pay for several. Entitlements are per organisation; credits pool at the
billing account. A paywall must never ruin somebody's wedding.

| Component             | What it is for here                                    | Must handle                                                                                                                                     |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PlanComparison        | Choosing or changing a tier                            | The current plan marked, an upgrade and a downgrade, what a downgrade would lose, and a public version for the marketing site                   |
| PaymentMethodCard     | How an account pays                                    | A card, Apple, Google, an invoice arrangement; the default; one expiring; and one that failed                                                   |
| PaymentMethodPicker   | Adding one                                             | Several rails offered without the differences between them leaking into the product, and local methods that are not cards                       |
| StorePurchaseNotice   | What is different about buying through Apple or Google | Said **at the point of purchase**: it belongs to that store account, cannot be consolidated with other organisations, and cannot be transferred |
| InvoiceRow            | The payment history                                    | Paid, failed, refunded, a download, and a period that spans a plan change                                                                       |
| TaxIdField            | A business buyer's VAT or tax identifier               | Per-country formats, validation that can be deferred, and the price changing as a result                                                        |
| CreditBalance         | Pooled credits for messages and assisted requests      | A balance, a top-up, consumption since the last top-up, and running out                                                                         |
| MeterUsage            | What has been consumed against what is allowed         | Approaching a limit, at it, over it, and an override granted by support                                                                         |
| LimitReachedDialog    | A hard limit, hit at the moment of creation            | **Name the limit, say the number, offer the upgrade** — never a generic refusal, and never at runtime during an event                           |
| ChannelDegradedBanner | Out of credits                                         | Which channel is affected and which still work — email goes, SMS waits — and that the event itself is unaffected                                |
| ReadOnlyBanner        | A downgrade or non-payment                             | Read-only rather than gone, what is still possible, and how to restore it                                                                       |

#### The assistant

Reachable on every surface, in the context of whatever is on screen.

| Component            | What it is for here                                                                        | Must handle                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AssistantEntryPoint  | How it is opened from a screen, already knowing what that screen is about                  | Present without dominating, and absent entirely where the assistant is switched off                                                                  |
| AssistantPanel       | The conversation                                                                           | A docked panel on the web, a sheet on mobile, a long conversation, and a new one                                                                     |
| AssistantMessage     | One turn                                                                                   | A question, an answer, markdown with lists and tables, a long answer, and a copy action                                                              |
| AssistantSuggestions | What to ask, before anybody has asked anything                                             | Suggestions for this screen, and the questions this person asked recently                                                                            |
| AssistantActivity    | What it is doing while it is doing it                                                      | Thinking, and **what it looked at** — "read the guest list, checked table capacities" — because an answer with no visible basis is not trusted       |
| AssistantProposal    | A change it suggests rather than makes: a seating plan, a running order, a drafted message | A preview beside what is there now, **accept or discard**, accepting part of it, and nothing changing until somebody says so                         |
| AssistantUnavailable | The three ways it cannot answer                                                            | Not available here, busy right now and worth retrying, and declined — three distinct messages, because one of them is worth retrying and two are not |
| AssistantCostNotice  | What this is spending                                                                      | Credits used by a request, approaching the allowance, and out                                                                                        |

#### Support

Seven o'clock on a Saturday, with a customer's event in progress.

| Component           | What it is for here                                                                                                                                                         | Must handle                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SupportQueueRow     | A ticket waiting                                                                                                                                                            | **Two visibly different lanes** — a normal request, and a broken event in progress — plus age, account, assignee and a breach of the response target              |
| IdentifierSearch    | The console's front door                                                                                                                                                    | Any identifier the customer happens to have — email, phone, event name, correlation id, message id, invoice number — mixed result types in one list, and no match |
| AccountTimeline     | An account's whole history, read in ten seconds                                                                                                                             | Dense, grouped, filterable by kind, and an entry that links to the thing it happened to                                                                           |
| AgentActionPanel    | What an agent can actually do: resend, force-verify, reset, clear a second factor, unlock, restore, undo an import, refund, credit, override an entitlement, extend a trial | Each action's consequence stated, a required reason, a confirmation proportional to the damage, and an action the agent's role does not permit                    |
| EntitlementOverride | Unblocking a customer mid-event without a deploy                                                                                                                            | A scope, an expiry, a reason, and visibility to the customer or not                                                                                               |
| ImpersonationBanner | An agent seeing what a customer sees                                                                                                                                        | **Impossible to miss, impossible to forget**, present on every screen, read-only by default, and one action to leave                                              |
| RestorePanel        | Getting something back: an event, a guest, a layout, a menu, an import                                                                                                      | What will be restored and what will not, a recovery window with time left, and the window having closed                                                           |

#### Insights

| Component     | What it is for here                   | Must handle                                                             |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| ReportHeader  | The period a report covers            | A comparison against the previous period, a preset range, and an export |
| ReportSection | A group of related figures and charts | Printing, an empty period, and a figure that cannot be calculated yet   |

#### Marketing

For somebody who has never heard of Soirely.

| Component       | What it is for here              | Must handle                                                                                       |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Hero            | The first screen                 | One sentence that says what this is, a phone, and four locales with a 30% longer headline         |
| FeatureSection  | What it does                     | Alternating and stacked arrangements, an image or none, and three to six of them in sequence      |
| PublicPricing   | What it costs, before signing up | The tiers, what is metered, a currency the reader recognises, and an annual-versus-monthly switch |
| SocialProof     | Why to believe it                | A quote with an attribution, logos, and a good appearance with only one of them                   |
| CtaBand         | The ask                          | Repeated down a page without feeling repeated                                                     |
| MarketingFooter | Everything else                  | Legal links, the language picker, and a long list on a phone                                      |

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
across this many areas of work.

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
2. After a direction is chosen: tokens, then typography, then the components in
   the batches above, then layouts, then motion, then the gallery. Stop after
   each batch rather than delivering everything thinly.
3. For every decision that could have gone the other way, one sentence on why it
   went this way. A design context without reasons gets overridden by the first
   developer who disagrees with it.
