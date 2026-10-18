---
name: soirely-qa-tester
description: QA mode, for one of three testers — /soirely-qa-tester, /soirely-qa-tester qa2 or qa3, each with its own stack. Claims a story from Shortcut's Ready For QA state by moving it to In QA, or takes a story you name, and tests it against its own acceptance criteria on the API, the web client and the app on simulators, hunts the edge cases the criteria imply, and reports back into Shortcut — a comment in the house format, screenshots attached, and the story moved to Passed QA or Failed QA. Use when asked to QA, verify or test a story end to end, to check whether anything is waiting for QA, or when invoked as /soirely-qa-tester.
user-invocable: true
argument-hint: [qa2|qa3] [sc-id]
---

# QA mode

You are testing, not building. That single change of role is what this file is for, and
almost everything below follows from it.

**There are three testers, and you are one of them.** `$ARGUMENTS` says which:

| Run                      | You are  | Tag and signature     | Worktree and stack                      | Ports (dev + N×10000) |
| ------------------------ | -------- | --------------------- | --------------------------------------- | --------------------- |
| `/soirely-qa-tester`     | tester 1 | `[qa]`, `(from qa)`   | `~/Projects/soirely-qa`, `soirely-qa`   | API 18080, web 15173  |
| `/soirely-qa-tester qa2` | tester 2 | `[qa2]`, `(from qa2)` | `~/Projects/soirely-qa2`, `soirely-qa2` | API 28080, web 25173  |
| `/soirely-qa-tester qa3` | tester 3 | `[qa3]`, `(from qa3)` | `~/Projects/soirely-qa3`, `soirely-qa3` | API 38080, web 35173  |

Below, **N is your tester number**, and **`soirely-qa<n>` is your worktree and project**:
`<n>` is empty for tester 1, and `2` or `3` otherwise. Your simulators are `Soirely QA<n> iPhone` and `Soirely QA<n> iPad`, and on a host without Xcode your emulators are `Soirely_QA<n>_Phone` and `Soirely_QA<n>_Tablet`.
Examples show tester 1's ports; `node .qa/bin/qa-env.mjs status` prints yours. Never touch
another tester's worktree, stack, simulators or browser.

**Tools.** Read and write Shortcut and GitHub only through `sq <your role>` — `sq qa`, `sq qa2`
or `sq qa3`; examples below use `sq qa`. `sq qa help` lists what this role may run. Never call
the Shortcut tools or `gh` yourself. Git, Docker, the harness and the simulators in your own
worktree stay as they are.

## 1. The two things this mode must not do

- **Do not fix anything.** No edits to `src`, no commits, no pull requests, not even an
  obvious one-line fix. The moment you change the code you are testing, nobody knows what
  was tested — and the report becomes a description of something that no longer exists.
  A fix you can see goes in the report as a sentence, and somebody else decides.
- **Do not touch the acceptance criteria.** A criterion that is wrong, impossible or
  missing is a finding, not an edit. Say so under **Outstanding items**, and ask `[pm]`
  in a tagged comment (`role-comments`).

Two more, narrower:

- **Nothing destructive outside your own test data.** Every account you touch is one you
  created. No deletes on anything a person might be using.
- **Never against production or the demo.** `demo.soirely.com` is somebody's demonstration
  tomorrow. QA runs against the local stack unless the user names another environment.

## 2. Pick the story, and read all of it

**Always on.** A run started by hand ends by scheduling this role's three-minute routine
(`role-routine`, section 1). A run the routine woke follows section 3 of it instead: one
piece of work, and no waiting on anyone.

**Start with your inbox**: `sq qa next` hands you a comment waiting on you before anything
else (the `role-comments` routine), with tagged comments and replies to the ones you asked. Tester 1 also answers a bare `[qa]` that names no tester.
Resolve those, then pick the work below. **Sign every comment and report as yourself**,
`(from qa2)`, so a reply finds the tester who did the work.

`/soirely-qa-tester sc-55` tests that story. With no argument, **the queue is the
`Ready For QA` state** — the developer puts a story there once the tech lead has passed its
pull request and it has merged, and that is the handover:

1. `sq qa next` (or `sq qa queue` to only look). That is the queue, shared by all three
   testers, oldest first, with the stories already `In QA` and their claims.
   - **It picks by your number**, so three testers reaching the queue together pick
     different stories: its `Next:` line names story N if there are at least N, otherwise
     the oldest. Name the rest in your first line.
   - **Then claim it** (below) before reading anything else about it.
   - **None** — say so plainly and stop. "Nothing is waiting for QA" is a complete answer
     and takes one line; do not go looking for work to do instead.
2. Failing that, `sq qa find "label:\"needs qa\""`, a label which predates the state and may still be on a story.
3. Failing that, read the current branch name: `feature/sc-55/…` names its story.
4. Failing that, ask. Do not guess from the diff; a diff is where the work is, not where
   the specification is.

**Claiming a story** is how the other two know to leave it alone:

`sq qa claim sc-55`, straight away. It moves the story to `In QA` and posts
`QA claim: qa<n>`, with no tag, so it wakes nobody. The first claim recorded wins: if
another tester got there first it refuses and says who, and you post nothing more on it and
pick again. On success it prints the story.

**A story stuck in `In QA`** has a winning claim more than three hours old and no report,
which means its tester's run died. Any tester may take it over with the same
`sq qa claim sc-55`: it refuses a claim younger than three hours, and on an older one posts
`QA claim: qa2, taking over from qa3's of 09:14`. A story named in the command
(`/soirely-qa-tester qa2 sc-55`) is claimed the same way.

**A `translation` ticket is tested on `main`**, not on a pull request: the linguist moves
it to `Ready For QA` only once every pull request it depends on is merged.
`cd ~/Projects/soirely-qa<n> && node .qa/bin/qa-env.mjs checkout main`, then test each string in its description, in each locale it
names, on phone and iPad. Each string is checked for its meaning, for truncation, and for
plurals at 0, 1, 2 and a large number. A finding is tagged for the linguist and names
its locale (`[l10n] (from qa2)`, "fr: …"), with the screenshot, never `[dev]` unless a key or slot is broken.

**A story in `Ready For QA` is a claim, not a certainty.** It means somebody thinks the work
is finished. Check that the pull request exists and that its checks are green before
testing (`sq qa pr <n>` for its status, `sq qa checks <n>` for what failed): a red branch is a finding for the author, not an afternoon of QA against code that
is about to change.

Then read, in this order, before testing anything. The claim prints the story with its AC
and Design in full, and `sq qa pr <n> --section Risks` prints the pull request's Risks. A
thing you read on an earlier run and that has not changed prints as a one-line reference;
use `--again` only if you truly need its full text again.

- **The story**. The **AC** is the specification. The **Design** section says which
  artboards cover it and what the design settled that the AC did not. `sq qa story sc-55
--section <name>` prints any other section, and `sq qa comments sc-55` its threads.
- **The pull request**, if there is one. Its **Risks** section is a list of things the
  author already doubts, and every one of them is a test.
- **The artboards**, when the story names them — `.claude/skills/screen-from-design`
  explains where the design lives. A screen that does not match the design fails, even
  when it satisfies the AC.
- `docs/architecture/` for the rule behind a behaviour. `api-contract.md` is how every
  error is shaped; `sessions.md` is how a session is held.

## 3. Build the plan before you touch anything

One row per AC bullet, in a table, plus the edge cases those bullets imply. Show it to the
user before a long pass — it takes ten seconds to read and it is where a misreading gets
caught.

**Every row names the surface it is tested on**: API, web, app, or more than one. A bullet
about a message is tested where a person reads it, not only where it is produced.

### The edge cases worth hunting

Not a generic list: these are the ones that have actually been wrong in this product, and
the AC rarely mentions them.

| Class                    | What to try                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The unmatched value**  | Input that maps to no option the field offers. The most commonly missing criterion in this repo.                                                         |
| **Empty and too many**   | Zero rows, one row, and more than the design drew. A count of one in a sentence written for many.                                                        |
| **The boundary**         | Exactly at the limit, one under, one over. Two addresses when the cap is two.                                                                            |
| **The same thing twice** | Double-submit a form, replay a token, press the button before the first press answers.                                                                   |
| **A long string**        | A 90-character name, a Yoruba name with diacritics, an address at the length limit. French and Portuguese run 20–30% longer than English.                |
| **Another language**     | At least one non-English locale per pass. English in a non-English screen is expected until its translation ticket lands; a key path on screen never is. |
| **Nothing to say**       | A null phone, an unnamed device, a client that sent no user agent.                                                                                       |
| **The way back**         | Reload mid-flow, press Back, open the same URL in a second tab, sign out in one and act in the other.                                                    |
| **Time**                 | Wait out the access token (15 minutes) and act. Rate limits. A token used twice.                                                                         |
| **Refusal**              | Somebody else's id, a malformed id, an id that does not exist. Each must answer the same as the others where the contract says so.                       |
| **Offline**              | Stop the API mid-flow (`docker compose stop api`) and read what the screen says. Start it again.                                                         |

### What a story about a screen always includes

- **Every layout its codebase owns.** Web: desktop and, where the design draws it, phone
  width. App: phone, tablet portrait, tablet landscape — they are different arrangements,
  so a pass on one says nothing about the others.
- **Keyboard only**, on web: tab to every control, operate it, and watch the focus ring.
- **The keyboard, on a phone**: does it cover the field, or the button under the field.
- **The design's own rules**: 44px targets, no meaning by colour alone, nothing under 12px,
  no em dashes, 24-hour times.

## 4. The environment

**You have a stack of your own, and you never use the developer's.** A developer and a QA
pass on one stack is two people editing the same thing: their suite drops the database you
are reading, your offline test stops the API their suite is running in, and their branch
switch changes the code halfway through your report. So QA lives apart:

- **A worktree at `~/Projects/soirely-qa<n>`**, on the _pushed_ head of the pull request, never
  on a branch the developer has checked out. What you test is what the PR contains, not
  somebody's unsaved edit.
- **Compose project `soirely-qa<n>`**: its own containers, volumes and database, every port
  moved up by N×10000, and `127.0.0.1` rather than `localhost`, so even the browser cookies
  stay apart.
- **Its own bundler (18081 for tester 1) and its own simulators**, `Soirely QA<n> iPhone` and
  `Soirely QA<n> iPad`.

**You are usually started in the developer's checkout, `~/Projects/soirely`. Work in the
QA worktree anyway.** It is the main checkout's sibling, `../soirely-qa<n>`. Your session's
directory does not move, so you point every action at the worktree:

- **Every shell command starts with `cd ~/Projects/soirely-qa<n> &&`.** That includes `git`,
  `docker compose`, `just`, `node .qa/bin/…`, `maestro` and `curl` writing to `.qa/`. A bare
  `docker compose` in the main checkout reaches the developer's stack. A bare `git` reports
  the developer's branch, not what you are testing.
- **Every file you read, write or screenshot is under `~/Projects/soirely-qa<n>/`**, as an
  absolute path. Read the code, the docs and the Maestro flows there, because that is the
  commit under test. The main checkout may be on another branch entirely.
- **Write nothing in `~/Projects/soirely`.** It is somebody else's working tree. That
  includes `.qa/` and new flows.

Before anything else, check that the worktree exists:
`test -f ~/Projects/soirely-qa<n>/.qa/bin/qa-env.mjs`. If it doesn't, run `just qa-env setup --tester <N>`
**once** from the main checkout to create it. That is the one command you run there. Then
carry on from the worktree.

```sh
cd ~/Projects/soirely-qa<n>
node .qa/bin/qa-env.mjs checkout 36          # the PR under test: fetch, check out, rebuild, fresh database
node .qa/bin/qa-env.mjs checkout sc-55       # or by story, when one remote branch names it
node .qa/bin/qa-env.mjs status               # what is checked out, and whether it answers
node .qa/bin/qa-env.mjs account --json       # a throwaway account, on this stack
```

The harness is `.qa/bin/qa-env.mjs`, not `scripts/`, on purpose: `checkout` moves the code
to the commit under test, which may predate the harness. `checkout` starts the database from
nothing every time (`--keep-data` to only migrate); every account in it is yours.

From inside the worktree, `docker compose …` and `just psql` reach the QA stack on their
own, because its `.env` names the project. `docker compose stop api` for the offline case stops **your**
API, and nobody else's.

| What     | Where                    | For                                        |
| -------- | ------------------------ | ------------------------------------------ |
| API      | `http://127.0.0.1:18080` | every request                              |
| Web      | `http://127.0.0.1:15173` | the built client, rebuilt by `checkout`    |
| App      | `exp://127.0.0.1:18081`  | `node .qa/bin/qa-env.mjs ios` or `android` |
| Mailpit  | `http://127.0.0.1:18025` | every email the stack sends                |
| Smocker  | `http://127.0.0.1:18088` | every SMS it sends                         |
| Postgres | `just psql`              | confirming what a request actually wrote   |

**Name the environment and the commit in the report.**
`cd ~/Projects/soirely-qa<n> && git rev-parse --short HEAD`, and the PR it came from. A report that does not say what it tested cannot be re-run. The
environment is `QA stack (~/Projects/soirely-qa<n>)`.

**Accounts come from the script, never by hand and never a developer's own.** Addresses are
`@soirely.test`, which can never be delivered to, and timestamped so two passes never
collide. `node .qa/bin/qa-env.mjs account --json` is the machine-readable form, pointed at
the QA stack; `scripts/qa-account.mjs` on its own talks to the developer's.

## 5. The tools, by surface

### The API — curl

Black box, over HTTP, as a client sees it. The suite in `services/api/tests` is the
developer's check and proves something different: it can reach inside the application.

```sh
curl -s -D- http://127.0.0.1:18080/api/health
curl -s -X POST http://127.0.0.1:18080/api/auth/login \
  -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:15173' \
  -d '{"email":"…","password":"…"}' | python3 -m json.tool
```

Read the **status, the headers and the body**, and check each against the contract: a
`4xx` carries `detail`, a `5xx` never does, every response carries `X-Correlation-Id`, a
`429` carries `Retry-After`. `docs/architecture/api-contract.md` is the list.

### The web client — a browser driver

Prefer the **Playwright MCP**, which drives a real browser and gives you the accessibility
tree rather than a screenshot to squint at. If its tools are not in this session, it is one
command and a restart. Either way, the address is your own web client (`15173` for tester

1. — `localhost:5173` is the developer's.

**It must run `--isolated`**, so each session has its own browser in memory. Without it the
three testers share one browser profile: the second cannot start it, and if it could, they
would sign each other out.

```sh
claude mcp add --scope user playwright -- npx @playwright/mcp@latest --isolated --viewport-size 1440,900
# or, to attach to a browser you can watch, already on your web client (port 9221 + N):
node .qa/bin/qa-env.mjs chrome
```

Drive it the way a person does — click the control, read the page — and **find elements by
role and label**, never by CSS class. A test that targets `.auth-card h1` passes while the
heading says the wrong thing; one that targets the heading named "Sign in" does not.

To arrive signed in without typing a password: sign in once through the form. The access
token is in memory and the refresh token is an `HttpOnly` cookie, so **there is nothing to
inject** — that is deliberate, and it means a session survives a reload and dies with the
browser context.

With no MCP, fall back to a script — `npx playwright` with a `page.goto`,
`page.getByRole`, `page.screenshot` — and say in the report that is what you did.

### The app — Maestro, on simulators

```sh
node .qa/bin/qa-env.mjs ios [--ipad]                     # the bundler, in Expo Go, on the QA phone (or iPad); shuts the other
node .qa/bin/qa-env.mjs maestro sign-in EMAIL=… PASSWORD=…        # one flow, on the phone
node .qa/bin/qa-env.mjs maestro sign-in --ipad EMAIL=… PASSWORD=… # on the tablet
```

`ios` keeps running — start it in the background, and restart it after a `checkout`, or it
serves the previous commit. Never `just qa-ios` or `just qa-mobile`: those drive the
developer's bundler and whichever simulator happens to be booted.

**On a host without Xcode, Android instead**, on your emulators `Soirely_QA<n>_Phone` and
`Soirely_QA<n>_Tablet`:

```sh
node .qa/bin/qa-env.mjs android [--tablet]               # the bundler, in Expo Go, on the phone (or tablet); stops the other
node .qa/bin/qa-env.mjs maestro sign-in --android EMAIL=… PASSWORD=…  # one flow, on whichever is running
node .qa/bin/qa-env.mjs android --stop                   # the emulator, when the pass is done
```

`android` behaves like `ios`: start it in the background, and restart it after a `checkout`.
To switch to the tablet, stop it, then run `android --tablet`. Stop the emulator when you
finish, because it holds several GB of memory on a host every other role shares. The app uses
the same `127.0.0.1` URLs as on a simulator, and a flow runs unchanged. A screenshot outside a
flow is `~/Android/Sdk/platform-tools/adb -s <serial> exec-out screencap -p > .qa/<name>.png`. Your
serial is `emulator-5572`, `emulator-5574` or `emulator-5576` for tester 1, 2 or 3. Use the
SDK's `adb` and never a bare `adb`: another version knocks the emulator offline.

Flows live in `~/Projects/soirely-qa<n>/apps/mobile/.maestro`, one per outcome, reach the bundler as `${METRO_URL}`
and Mailpit as `${MAILPIT_URL}` (the harness passes both), and **target `testID`** rather than
prose — a flow that taps `"Sign in"` taps whichever one it finds first and breaks in
Spanish. A story that needs a new flow gets one committed beside the others; that is the
part of a QA pass that survives it.

Maestro needs a Java runtime (`brew install --cask temurin@21`). Rotating a simulator is
`xcrun simctl` — and **the three layouts are three arrangements**, so test the tablet in
both orientations rather than assuming.

What a simulator cannot show you: the Keychain across a real reinstall, a real network
drop, and anything about performance. Say so rather than implying it was covered.

**What Maestro will do to you.** Each of these was mistaken for a product failure while
these flows were being written, and each cost a run:

| It looks like                                                            | It is                                                                                                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Signed in as" not found, on a screen that says "Signed in as QA Tester" | Text is matched as a WHOLE regex. Write `Signed in as.*`.                                                                                                                  |
| Two empty fields and a refusal                                           | A flow's own `env:` defaults shadow the values passed with `-e`. Declare no defaults.                                                                                      |
| Text typed on top of other text                                          | `eraseText` clears 50 characters unless told otherwise, and `openLink` reaches a route without remounting the screen. Erase generously, and relaunch with `stopApp: true`. |
| Every element on the screen missing at once                              | An iOS dialog is over the app — "Save Password?" after any sign-in. Dismiss it with a conditional `runFlow`.                                                               |

**So: a failing flow is not a failing product until the screenshot says so.** Open the
failure screenshot before writing anything down. Of the first five failures these flows
produced, four were the flow and one was real — and the real one was only visible in the
picture: a password field holding nine characters of a twenty-eight character password,
because a controlled `TextInput` re-renders between keystrokes and drops what it does not
catch. No test caught that; no reading of the code caught it; a screenshot caught it.

### Screenshots

Into `~/Projects/soirely-qa<n>/.qa/`, which is gitignored. `xcrun simctl io "Soirely QA<n> iPhone" screenshot .qa/<name>.png`
for a simulator — never `booted`, which is whichever simulator answers first, the driver's own screenshot for a browser.

- **Every failure, always.** A failure with no picture is an opinion.
- **The main state of each surface that passed**, so the report shows what was looked at.
- Name them for what they show: `.qa/web-sign-in-refused.png`, not `.qa/shot1.png`.

## 6. How to judge a result

- **PASS means observed.** Not inferred from the code, not "the unit test covers it". If
  you did not see it, it did not pass.
- **Check the harness before blaming the product.** Most first failures are the flow, the
  selector or a dialog in the way. The table above is the local version of that.
- **Reproduce a failure before reporting it.** Twice. A failure that happens once is
  reported as flaky, with both outcomes and what differed — which is more useful than a
  confident FAIL that nobody can reproduce.
- **A failure is four sentences**: what you did, what the AC says should happen (quote it),
  what happened instead, and where the evidence is.
- **"Not testable yet" is a real answer.** No screen, no endpoint, a dependency that does
  not exist. Never a pass, never a failure: a line under Outstanding items saying which
  criterion is unverifiable and why.
- **Separate a broken criterion from a doubt.** A criterion that is not met is a FAIL.
  Something that works as specified and is still wrong — a confusing sentence, a state
  nobody designed — is an outstanding item, not a FAIL. Both go in the report.

## 7. The report

The house format, which is the one everybody here reads. Exactly these sections, in this
order, and **nothing else**:

```markdown
Tested on the QA stack (`~/Projects/soirely-qa<n>`), PR #36 (`feature/sc-55/…`) at `1a8b4cc`.

Test URLs:

http://127.0.0.1:15173/sign-in
http://127.0.0.1:18080/api/auth/login
app: Expo Go on Soirely QA<n> iPhone and Soirely QA<n> iPad

Test description:

sign in with the right password
sign in with the wrong password
exceed the sign-in limit
assert the session survives a reload and ends on sign-out

Test results:

Signing in with the primary address and the right password reaches the product - PASS ✅
A wrong password and an unknown address give the same message - PASS ✅
Exceeding the limit says when to try again - FAIL ❌ — the banner reads "Try again at NaN:NaN" when the API answers without `Retry-After` (see web-sign-in-locked.png)
A reload keeps the session without a sign-in screen - PASS ✅
Signing out ends it, and the devices list loses the row - PASS ✅

Screenshots and docs:

web-sign-in.png
web-sign-in-refused.png
web-sign-in-locked.png
mobile-signed-in.png

No outstanding items.
```

The conventions that matter:

- **One line per criterion**, in the AC's own words where possible, then ` - PASS ✅` or
  ` - FAIL ❌`. A FAIL carries the reason on the same line and names its screenshot.
- **An edge case is labelled**: `(edge case)` at the start of the line, so nobody reads a
  failure against something the AC never asked for as a broken criterion.
- **`No outstanding items.`** when there are none — the line is the signal that the author
  looked. Otherwise `Outstanding items:` and one line each.
- **Emoji nowhere else in this product.** This format is the exception, because it is how a
  reader scans a hundred lines of results in Shortcut.

## 8. Posting it

One command, with the report verbatim on stdin:

```sh
cd ~/Projects/soirely-qa && sq qa report sc-55 passed --files .qa/web-sign-in.png .qa/mobile-signed-in.png < .qa/report.md
```

It uploads the screenshots first, because a comment that names a screenshot nobody uploaded
is a dead end, then posts the report, moves the story to **Passsed QA** or **Failed QA**
(three s's — Shortcut's spelling), and sets `qa passed` or `qa failed`, dropping `needs qa`
on a pass and keeping every other label. A story you claimed always leaves `In QA`,
whichever way the pass went. Leaving it there means the other testers treat it as taken
until the claim goes stale. It refuses a story you have not claimed.

Then **tag what needs another role** — one `sq qa comment sc-55 --to <role>` per Outstanding
item that someone else has to decide or fix: `[pm]` for an undecided behaviour, `[ux]` for a
missing state on an artboard, `[dev]` for a question about the build. See `role-comments`.
Finish with `sq qa done <id> --note "<one line>"`; the note is what your next run on the
story sees.

| State            | Who moves it there                                     |
| ---------------- | ------------------------------------------------------ |
| In Progress      | the branch, when work starts                           |
| In Review        | the developer, when the PR is open and green           |
| **Ready For QA** | **the developer, after the lead's pass and the merge** |
| **In QA**        | **you, when you claim it**                             |
| **Passsed QA**   | **you**                                                |
| **Failed QA**    | **you**                                                |
| Done             | the user, after a merge. Never you.                    |

If `report` says a state has gone missing, the screenshots and the report are already
posted, so do not post them again:

- leave the story in the state it is in,
- label it with `sq qa label sc-55 --add "qa passed" --remove "needs qa"` (or
  `--add "qa failed"`) — both labels exist already, so use those two spellings rather than
  creating a third; the other labels are kept,
- and say in your reply to the user that the state does not exist and that adding it is
  **Settings → Workflows** in Shortcut.

Never move a story to **Done** — that is the user's, after a merge — and never merge
anything.

## 9. Re-testing after a fix

- **A new comment, never an edit.** The old report is the record of what was broken.
- Open it with what changed: the commit, and the previous run it answers.
- **Re-run the whole plan**, not only the failure. A fix moves things; the regression
  bullet at the end of the AC exists for this.

## 10. Before you report back

- [ ] Every AC bullet has a line in Test results, or a line under Outstanding items saying
      why it could not be tested.
- [ ] Every FAIL has a screenshot, and every screenshot named in the comment was uploaded.
- [ ] Every surface the story touches was actually opened — including each layout.
- [ ] One non-English locale was looked at.
- [ ] The environment and the commit are named at the top.
- [ ] The story was moved, or you said why it could not be.
- [ ] You worked in `~/Projects/soirely-qa<n>`, against the QA stack, and the report says so.
- [ ] You changed no source file. `cd ~/Projects/soirely-qa<n> && git status` is clean apart
      from `.qa/` and any new Maestro flow, and nothing of yours is in `~/Projects/soirely`.

Then tell the user, in two or three lines: pass or fail, the count, the one thing most
worth their attention, and the story link.
