# Design handoff — the shared half

Every per-epic handoff in this folder says to read this first. It carries everything that
is the same whatever epic you are working on. The per-epic file carries only what differs:
the stories, the artboards that look relevant, the layouts, and the traps specific to that
area.

Read this, then the per-epic file, then start.

---

## What you are doing

An epic's stories need screens. Some are already drawn in the design project; the rest are
not. Your job is to find out which is which, design the missing ones **in the existing
design's language**, and link each story to the artboard that covers it.

Two things to hold onto throughout:

- **The design is the language; the ticket is the content.** The language is **[fd]**, the
  approved design (see **The house style, which is not negotiable**). You are not inventing
  a look, and you are not inventing product behaviour. Every screen you draw must be in the
  established visual language, and must show exactly what its story's AC says — no more.
- **You are not the designer.** What you build is a proposal to be reviewed, and every
  ticket you touch has to say so. Do not present it as the design.
- **Start from the epic's proposal boards.** Every epic page carries, for each screen, a
  proposal board (see **Three boards per screen**). A new drawing for that epic takes its
  context from those boards: their shell, layout, components and words. Not from [fd]
  alone, not from older boards, and not from today's app. The owner set this on 30 Oct
  2026, together with the migration rule: every ticket's functionality and AC stand as
  they are; a story that moves a built screen to the new design changes how it looks and
  is laid out, never what it does.

## Read these first, in this order. Do not draw anything until you have.

1. **`.claude/skills/screen-from-design/SKILL.md`** in this repository. The rules for this
   work: where the design is, the order to read it, the four layouts and which codebase
   owns each, and what to do when the design does not cover something.
2. The design project, via the `DesignSync` tool's read methods (`list_files`, then
   `get_file`). Project id `b64da70f-d60f-4ad6-90a4-efe6d387caa8`. Read:
   - **`CLAUDE.md`** — what is settled, and what was **discarded**
   - **`design-context/01-foundations.md`**
   - the artboards your per-epic file names as candidates
3. **`docs/design/tokens.mjs`** in this repository — the tokens, one source, with usage
   notes and four settled decisions.
4. **The worked example: page `29 · Events` of Soirely — Redesign,
   https://claude.ai/artifact/5cRzwbgmEK6wqbxp4j1zqx**: Events home and Event view, each
   as its three boards. Read `project/canvas.json`, then `EventsHome.dc.html`,
   `EventsHome-fd.dc.html` and `EventsHome-App.dc.html`. **Match their style, their density,
   and their level of finish.** Reading them will teach you more than this file can
   describe. Your own epic's page is the next thing to read: its proposal boards are where
   your drawing starts.
5. **`docs/design/claude-design-brief.md`**, section 5, for the area your epic covers. It
   says what somebody does there and what makes it hard.
6. The epic itself: `epics-get-by-id`, `stories-search` with that epic, then each story
   with `stories-get-by-id`.

## Step one: a coverage audit. Report it and stop.

`list_files` on the design project gives the artboard names. They are human names, not
story names, and one artboard usually covers several stories.

| Story   | What it needs | Artboard | Covers it?                  |
| ------- | ------------- | -------- | --------------------------- |
| sc-NN … | …             | …        | fully / partly / not at all |

For "partly", say which part is missing. For "not at all", say so plainly.

Expect this to be the useful part. **Report the table and wait for a go-ahead before
building anything.**

## Step two: build the missing screens

**Every epic lives in one artifact, Soirely — Redesign:
https://claude.ai/artifact/5cRzwbgmEK6wqbxp4j1zqx**, one page per epic. Add your boards to
your own epic's page, and add that page first when the epic has none. The owner set this on
30 Oct 2026. Inside the page, one artboard per screen, named for what it is
(`SignIn.dc.html`, `GuestList.dc.html`). Several stories may share an artboard, and one
story may need several.

### Adding to the artifact

1. Read the artifact before changing it (`Artifact` with `action: "read"`), and update it
   by its URL.
2. **Never create an artifact with `type_url`**, for any epic. A second artifact splits the
   design and the stories' links.
3. Each epic's page has the id `e<epic number>` (`e26`, `e27`, `e29`) and the name
   `<epic number> · <area>`, the area as that epic's handoff file titles it
   (`27 · Accounts and sign-in`). Every board names its page.
4. Update `project/canvas.json` first: the page, if it is new, then a `boards` entry and an
   `order` slot for every artboard you intend to write. Then the artboards, publishing as
   you go.
5. **Other sessions publish to the same artifact.** Before changing a board, read its live
   copy; if it differs from yours, fold their changes in so nothing of theirs is lost.
   Publish only the files you changed, in patch mode, on the live version. Change
   `canvas.json` with text edits, never by rewriting it whole: it holds other sessions'
   boards and notes.

### Three boards per screen

The owner set this on 30 Oct 2026, with Events as the first page. Each screen on an epic's
page is three boards side by side, on the same row:

| x    | Board                  | Title ends                                                            |
| ---- | ---------------------- | --------------------------------------------------------------------- |
| 0    | `<Screen>.dc.html`     | the proposal · [fd]'s way, the app's functionality                    |
| 4300 | `<Screen>-fd.dc.html`  | [fd] as drawn · reference, not the proposal                           |
| 8600 | `<Screen>-App.dc.html` | the app today · drawn from the code, for comparison, not the proposal |

The page's title note reads `<epic> · <area> · left: the proposal ([fd]'s way, the app's
functionality) · middle: [fd] as drawn · right: the app today`, with `maxW` 12762.

**The proposal.** [fd] decides **how** the screen is built: layout, shell, navigation,
components, look. The app decides **what** is on it: the code (`apps/web` for desktop,
`apps/mobile` for the tablets and phone) and the epic's stories' AC, features still to come
included. Every field, required or optional mark, limit, refusal, state, dialog and flow is
drawn with [fd]'s components; where [fd] has no pattern, extend its nearest one. Never copy
today's app's look. Sort every element [fd] draws:

- **(a) in the code**: keep it.
- **(b) in a story's AC, not built yet**: keep it, with the small dashed grey pill
  **"AC, not yet built"**.
- **(c) in neither**: take it out, and close the gap with [fd]'s own layout (the next card
  moves up, a grid loses a column). No holes, and nothing invented in its place.

Where [fd]'s words and the code's disagree, the code's words go in [fd]'s place. A recorded
pm or owner decision, in the epic's or story's dated sections, beats both.

**A code check adds; it never takes [fd] away.** Checking boards against the code means
adding the functionality they lack inside [fd]'s layout. It never means restyling a board
to look like today's app, or removing an [fd] element the sorting above keeps. That went
wrong once on Events, and the owner rejected it.

**[fd] as drawn.** [fd]'s own frames for that screen and nothing else, changed only as
much as the canvas needs: inline tokens, `support.js`, `$preview`. No floor fixes, and no
"not by the designer" mark: it is [fd]'s drawing.

**The app today.** Desktop from the web, the tablets and phone from the React Native app:
today's look, layout and words, its main states as Tweaks, and its interactivity where the
code has it. Name the source files in each frame's label, draw its house-rule breaks as
they are, and list them. A screen the app has not built gets a small board saying so, with
the routes checked.

### The house style, which is not negotiable

The approved design is **[fd]**, the Claude Design project
`b64da70f-d60f-4ad6-90a4-efe6d387caa8`
(https://claude.ai/design/p/b64da70f-d60f-4ad6-90a4-efe6d387caa8). The owner approved it on
30 Oct 2026 as the look for the whole app, now and going forward. Each screen starts from
[fd]'s page for its area and extends it for what its story's AC needs; a screen with no page
there is drawn in [fd]'s language. An epic, a story or a brief that asks for a new look, a
direction or a restyle does not override it: that is the owner's call, asked on the story
before anything is drawn.

**The signed-out sign-in flow is the one exception** (owner, 1 Nov 2026; sc-26511,
sc-26512): every screen in `AuthPage` (web) and `AuthFrame` (app) keeps its look from main at
`8126d8aa`, with [fd]'s **‹** back controls and sc-22092's components. A new signed-out
screen uses that frame and is not drawn in [fd]. `SignIn.dc.html` and `GetBackIn.dc.html`
on page 27 are superseded and design nothing.

Take exact values from `docs/design/tokens.mjs`.

- **Instrument Sans** for everything a person reads; **JetBrains Mono** only for step
  numbers, keyboard shortcuts, and codes a person reads or copies character by character
  (recovery codes, an authenticator setup key, a join code), never for money or counts.
  A six-digit code typed into a field stays Instrument Sans with `tabular-nums`. Load both
  from Google Fonts in `<helmet>`. Money and counts use Instrument Sans with
  `font-variant-numeric: tabular-nums`.
- **`#4B5563` is the label ink** (7.6:1 on white): form labels, card subheads and
  secondary icons, where the designer's screens use it. Secondary text stays `#5F6673`.
- **Green `#1E9A64` is the only accent**, wherever no label sits on it: selected, done, and
  the focus ring. Amber `#B7791F` is attention, red `#C2410C` is broken only, grey is
  not-yet. **No action is red.**
- **The primary button's label is white on `#178556`** (4.64:1), and on the web `#176B47`
  (6.50:1) on hover. White on `#1E9A64` is 3.58:1, which fails.
- **The destructive button is the outlined one**: a secondary button's white fill, 1px
  `#D9DCE2` edge and `#15171C` label (17.93:1), told apart by its word. It is named for what
  it ends, never OK, Yes or Confirm. One that opens a confirm ends with an ellipsis
  (**Sign out…**); the confirming one inside the confirm is the same button named again with
  none (**Sign it out**), and the dismissive one is a text action (**Keep it signed in**).
- **Button order**: in a row the dismissive one first and the confirming one last; stacked,
  as in a sheet on the phone, the confirming one on top.
- **A text field's edge is `#80868F`** at rest and focused (3.67 on white, 3.39 on the page,
  3.20 on the header band). Focused, the ring sits outside it: 2px `#1E9A64` at a 2px
  offset. On an error the edge is `#C2410C`. A secondary button's and a chip's edge stay
  `#D9DCE2`: their word identifies them.
- **Paused** is `#1F4E8C` on `#E9F0F9` (7.24:1). Every chip's word is at least 4.5:1 on its
  chip.
- Page `#F5F6F8`. Cards white, 1px `#E6E8EC` border, radius 16 on desktop and 18 on phone.
  Insets `#F6F7F9` with a 1px `#ECEEF2` border. Header bars tinted `#E9F0F9`.
- Ink `#15171C`, secondary `#5F6673`. **`#9CA3AF` fails 4.5:1: decoration and disabled
  only, never information.**
- **Buttons are pills, 44px tall**, desktop included. In the app on every device, and on the
  web up to 40rem, a primary or destructive button is 48, and so is a secondary button
  stacked full width with one. A text-only action, a word with no fill and no edge, keeps
  44 wherever it sits. Rows, checkboxes, steppers and icon buttons get 44px hit areas too.
  A control drawn at 36 carries 4px of slop on every side to reach 44.
- **Motion** is 120, 200 and 320 ms with `cubic-bezier(0.2, 0, 0, 1)`, and no transition is
  longer than 500 ms. With less motion asked for, it is a fade of at most 200 ms or none.
- **Light mode only.** There is no dark appearance in this product.
- Status always pairs a **shape with a word**. Never colour alone — a kitchen prints in
  black and white and a server may be colour-blind.
- **Nothing a person reads is below 12px.**
- Copy: sentence case, full stops, middle dot `·` as separator, **no em dashes**, no emoji,
  24-hour times, dates as "Friday, Aug 7", money in the event's currency. Buttons are verbs
  that say what happens, never "Submit" or "OK".
- **Every card ends with a next step** — a next-up line or a footer action.

### Forms check before they send

A form never sends a request it already knows will be refused. Draw this for **every** form, as its own state (`blank`, and `invalid_<field>` where a format check applies):

- Required fields carry no mark; optional ones carry an "Optional" pill.
- The primary button stays **enabled**. A disabled button cannot say what is missing; a pressed one can.
- Pressing it with a required field empty, or in a shape the client can check for certain, **sends nothing**. Each failing field gets the red border and its own message under it ("Enter your email address."), `aria-invalid` and `aria-describedby`, and focus moves to the first failing field.
- A message clears as soon as the field becomes valid. After the first press, fields re-check as the person leaves them.
- Check on the client only what is certain there: empty, an email's shape, a length or digit count the AC states, a number inside its stated limits, a date that must be in the future. Never what only the server knows (taken, breached, wrong password); those stay the server's refusals.
- The server still checks everything. A field error it returns uses the same words in the same place.
- **It must work in Play, not only as a Tweak state.** Each input records what is typed, and the primary button runs the check: clear a field, press the button, and the error appears with focus on the field; type, and it clears. A Tweak state shows the look; it does not show the behaviour, and a reviewer testing the artboard will find a form that does nothing.

**If the story's AC does not say which fields are required, or what counts as valid, ask PM on that story** (`[pm] (from ux)`, per `role-comments`) with your proposed list. Draw your proposal meanwhile and say so in the Design section.

### Mechanics that fail silently if you get them wrong

- Keep `<script src="./support.js"></script>` in the head exactly as the type's skeleton
  has it.
- `$preview` must equal the artboard's frame `w`×`h` in `canvas.json`.
- Desktop screens are PAGEs: `"expand": "fill"` on the board entry and a **fluid** root —
  no fixed px width. Phone is fixed at 390×844, tablet portrait 834×1194, tablet landscape
  1280×880. **Open:** every board drawn so far uses 1194×834 for tablet landscape. Until the
  owner settles which, match the boards already on your epic's page.
- **Every board owes motion and the system states.** Motion per the spec on page
  `26 · Foundation` (`Motion.dc.html`), with a Reduce motion switch; a `system` Tweak for
  the network, error and loading states on `SystemStates.dc.html`.
- An artboard is a row of frames side by side, padding 56, gap 64, with a `frame` Tweak.
- Give an artboard whose controls actually work `"is_interactive": true`. Leave it off
  static ones.
- **Accessible as drawn**: real `<button>`, `<a href>`, `<input>` + `<label>` even in a
  mockup. `aria-label` on icon-only buttons. Never `role` or `onClick` on a `div` or
  `span`. Decorative SVG gets `aria-hidden="true"`.
- Anything designed around dragging needs a **click-click** path — pick, then place.
  Dragging alone is not an accessible interaction.
- **Do not verify.** Do not render it, screenshot it, open it in a browser, or read your
  own files back to check. This is both the type's instruction and a standing rule on this
  project. If you think a check is needed, ask first.

## Step three: link it to the stories

For each story:

1. `stories-add-external-link` with the artifact URL, so the link is a first-class field
   rather than buried in prose.
2. Append one section to the description, leaving everything already there untouched:

```markdown
# Design

**Artboard:** `<name>.dc.html`, the proposal (beside it on the page: `<name>-fd.dc.html`,
[fd] as drawn, and `<name>-App.dc.html`, the app today) · page `<epic number> · <area>` ·
<artifact url>

**Layouts:** <desktop · tablet landscape · tablet portrait · phone>, and why that set.

**What the design settles that this AC did not say:** two to five bullets.

**Where the design and this AC disagree:** each one, stated. Do not resolve them.

**Status:** drawn for this ticket in the established language, **not by the designer.**
Needs review before it is treated as the specification.
```

`stories-update` **replaces** the description field, so pass the existing text plus your
section. A partial value deletes the rest.

## What NOT to do. Each has already gone wrong on this project.

- **Do not invent product behaviour.** The screen shows what the code and the AC say. If a
  screen obviously needs something neither mentions, put it in the disagreements bullet
  rather than drawing it as settled.
- **Do not restyle [fd] to match today's app.** Today's app is the comparison board, never
  the look. A check against the code adds what is missing inside [fd]'s layout.
- **Do not change what a built screen does while moving it to the new design.** The
  ticket's functionality and AC stand; only the look and layout move.
- **Do not put a number on a screen that the product could not know.** Every figure is
  either derived from something real or it does not belong. A fabricated count reads as a
  feature and gets built. In the budget artifact every quantity carries a line naming its
  source; do the same.
- **Do not use the `Foyer` design system, or any Design System artifact.** The design
  project's `CLAUDE.md` records that earlier explorations were discarded and are not to be
  revived. Foyer is one. It is complete, polished and dead — spruce and marigold,
  Instrument Serif, a dark theme, 34px controls. **Everything about it is wrong for this
  product.** If you find yourself reading it, stop.
- **Do not treat an artboard's fixtures as spec.** The `<script type="text/x-dc">` block's
  `renderVals()` holds demo names and counts. Sample data, never requirements.
- **Do not reword existing AC.** Add your section; a wrong AC item is a disagreement, not
  an edit.
- **Do not write to the design project.** Read methods only. Writing belongs to the
  `/design-sync` skill, which only the user starts.
- **Do not change a story's workflow state**, mark anything Done, or create or close
  stories.
- **Do not commit or open a pull request.** This work lives in the artifact and in
  Shortcut.
- **Do not build a screen for a story the design already covers.** Link the existing
  artboard instead. Two drawings of one screen is the drift this exercise exists to prevent.

## Rules that hold in every epic

- **Four locales**, and French and Portuguese run 20–30% longer than English. No
  fixed-width labels, nothing fitted tightly to a button.
- **Nothing may interrupt a live event.** A limit is refused when something is created,
  never mid-event.
- **Stale state is declared during service.** A figure with no age and no connection state
  is the worst failure this product can have.
- **Assistance proposes, never acts.** A suggestion sits beside what is already there and
  is accepted or discarded.
- **Held is never shown like No reply.** A companion whose host has not accepted is its own
  state.

## How to report back

1. The coverage table. Then stop.
2. After the go-ahead: the artifact link, which artboards you drew and which stories each
   covers, and the disagreements you found, grouped so they can be decided together.
3. **Anything the design shows that no story asks for.** A screen drawn and not ticketed
   matters as much as a story with no screen.
4. Say plainly that you did not verify the artifact visually, because you were told not to.
5. Tell the user the artifact is **private until they share it** from the page's Share
   menu, since you cannot change its sharing.
6. Where you were unsure, say so rather than choosing. An uncertainty named is worth more
   than a confident guess.
