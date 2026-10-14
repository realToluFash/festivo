# Brief for Claude Design — the Soirely design context

> Paste everything below the line into Claude Design. It is written to stand on
> its own: a designer reading it needs no access to this repository.
>
> It describes the product and how we see it working for the people who use it.
> It deliberately does **not** specify components, tokens, type scales or any
> other design decision — those are the designer's to make, and an earlier
> version of this brief that prescribed them is in the repository's history if
> it is ever wanted.
>
> Keep this file as the brief is revised, so the design context and the brief it
> came from stay together. What comes back lands in `docs/design/` beside it.

---

## 1. What Soirely is

**Soirely is event management software.** One person — an organiser — plans an
event over weeks, then runs it in a single night. Weddings, conferences,
funerals, birthdays, product launches.

Planning means building a guest list of several hundred people and chasing their
replies; laying out a venue and seating everyone on it; building a menu with
courses, variants and dietary accommodations; writing a running order; hiring and
briefing staff; and messaging everybody across email, SMS, WhatsApp and push.

Running it means a dim room, plates moving, guests arriving, and a running order
that has already slipped ten minutes.

An organiser belongs to an **organisation** — a company, an agency, a family —
which owns its events, its team and its subscription. Several people work the
same event with different permissions.

It is sold globally and speaks **English, Spanish, French and Portuguese** from
day one.

**You are designing its design context** — the visual and interaction language
every screen will be built from, and an interactive reference we can click
through and build against. Not screens. What the screens will be made of, and
how it behaves.

## 2. Where it runs

Three surfaces with different jobs. They share a foundation, not a layout.

### A. The web, on a computer — the planning surface

Mouse, keyboard, a laptop or a desktop monitor. **All of event management lives
here**, plus billing, which lives nowhere else.

Design this for a mouse and a keyboard properly. It should not look like a
widened app, and you have real latitude: if this and the app end up
substantially different, that is the right outcome rather than a failure to
unify.

### B. The apps, on a phone or tablet — the night, and planning on the move

Native iOS and Android, touch. **All of event management lives here too** — the
same work, for a finger instead of a mouse, and for the room instead of the desk.
Phone, tablet portrait and tablet landscape are three structurally different
arrangements rather than one rescaled.

A tablet on a stand at a kitchen pass is a real deployment.

### C. The web, on a phone or tablet — deliberately small

**Event management is not here. It is in the app.** The narrow web carries only
billing, the person's own account settings, and organisation settings.

Somebody who opens an event-management link on a phone browser is sent to the
app, and that handoff is something to design rather than an error — unembarrassed
about what it is, and able to return them to the exact thing they were reaching.

Two audiences have no app at all, so both must work fully in a phone browser:

- **A guest** — no account, will never install anything, arrives from an email
  link, probably on a phone, possibly elderly, possibly annoyed.
- **Somebody who has never heard of Soirely** — the public pages.

_(That last point is our reading rather than a given: those audiences have no app
to be sent to. Say if you see it differently.)_

### Two contexts, which do not map onto the surfaces one for one

- **At a desk, planning.** Weeks out. A keyboard, a wide monitor, a spreadsheet
  mindset, an afternoon to spend. Density is a feature.
- **In the room, running it.** Nine in the evening, a dim venue, one hand free
  because the other is holding plates. Glanceable, large targets, no precision
  available.

The desk only ever serves the first. **The apps serve both** — the same tablet is
used on a sofa three weeks out and in a dimly lit room on the night — so the apps
cannot simply be optimised for the room.

**One appearance, not two.** There is no dark mode — not in the apps, not on the
web. The apps are nonetheless used in a dimly lit room, so legibility in those
conditions is a real constraint on the single appearance you design.

## 3. Above all else: it has to be obvious

This outranks everything else in the brief. **Nobody using this has been
trained**, and three different people have to succeed without help:

- **An organiser who has never seen it**, planning their first event, who will
  not read documentation and will give up on a product that makes them feel
  stupid.
- **A waiter handed a device at nine in the evening**, who has never seen it,
  will use it for one night, and is being introduced to it in the worst possible
  conditions — loud, dim, busy, and already behind.
- **A guest who will use it exactly once**, may be elderly, did not choose to be
  here, and is mildly irritated at being asked for anything.

If something needs explaining to any of those three, it is wrong. The test is
not whether an explanation could be provided — it is whether one is needed.

What we mean by it, concretely:

- **The next thing to do is always apparent.** Every screen answers "what now?"
  without being asked.
- **Nothing depends on having been told.** No gesture that has to be learned, no
  control whose meaning is only available by hovering over it, no capability
  reachable only by already knowing it is there.
- **Learning one screen teaches the rest.** The same thing looks and behaves the
  same way everywhere. This is most of what makes software feel easy, and it is
  the first thing to go when screens are designed one at a time.
- **The product's words are the user's words.** Guests, tables, courses,
  invitations, replies. Nothing anybody sees should borrow a word that only makes
  sense to the people who built it.
- **Mistakes are cheap.** People explore when undoing is easy and freeze when it
  is not. Prefer something recoverable afterwards over something confirmed
  beforehand.
- **No dead ends.** Every refusal, error, empty screen and limit says what to do
  next rather than only what happened.
- **The state is always legible.** Where am I, what is selected, has it saved,
  and is what I am looking at current — answerable at a glance, never by
  deduction.
- **The common case is in front of you; the rest is within reach.** Not
  everything at once, and not everything buried.
- **Responsive counts as intuitive.** Something that answers immediately feels
  simple even when the thing it is doing is not.

And when the two are in tension: **we would rather have something plain that
needs no explanation than something clever that needs a little.**

## 4. How we see the product working overall

Our view, and the part we most want argued with.

**Two levels of context, always present.** Everything lives inside an
organisation, and almost everything inside an event. Somebody working two
weddings and a conference switches many times a day, from anywhere, without
losing their place.

**Lateral movement, not a funnel.** Inside an event the areas of work are peers.
Seat a guest, notice a dietary conflict, open the menu, come back. People move
between them constantly and in no fixed order.

**Hundreds of rows is the normal case.** Four hundred guests is not a stress
test, it is Tuesday. Reading, sorting, filtering and correcting long lists of
people is the single most common thing anybody does in this product — on a
computer and, harder, on a phone.

**Bulk work is the default, not an advanced mode.** Organisers do things to
eighty people at once. Afterwards they want it undone rather than confirmed
beforehand, wherever that is possible.

**Things change because the room changed.** During service the screen updates
because a plate moved, not because somebody refreshed. It has to be clear when
what is shown is live and when it has gone stale — a venue basement with no
signal is a normal Saturday, and silently showing old state during service is
the worst thing this product could do.

**Assistance proposes; it never acts.** There is an assistant available
throughout, which drafts things. A person always sees what it suggests next to
what is already there, and accepts or discards it.

**Nothing may interrupt an event in progress.** A limit is refused when
something is created, never mid-event. An unpaid account goes read-only rather
than shut off. Running out of message credits degrades one channel, not the
night.

## 5. How we see each part working

Fifteen areas of work. For each one: **everything somebody can do there** — so
the design is not built for a smaller product than we intend or a larger one —
plus where it mostly happens and what makes it hard.

Treat the scope as real but not sacred. **If you can see a better way for any of
this to work, propose it.** We would rather hear it now than discover it after
the design is built around our version. We will check whether it is feasible and
come back to you.

### Accounts and sign-in

**What somebody does here**

- Signs up with an email address and a password, or with Google or Apple
- Verifies their email address with a code, and their phone number with a code
- Finishes a profile the sign-up did not collect — their name, their business,
  their country, their phone
- Signs in; stays signed in across devices; signs out of one device or all of
  them
- Turns on a second factor, sees it once as something to scan and something to
  copy, and keeps a set of one-time backup codes
- Recovers: a forgotten password, a new phone, a lost authenticator, an email
  address that no longer exists
- Sees which providers are linked to the account and unlinks one
- Chooses their language, which then follows them to every device
- Sees the sessions currently signed in and ends one

**Where** Every surface. Signing in is the one thing the narrow web does besides
settings and billing.

**What makes it hard** Most people do this once and then not for months, so the
**return paths matter more than the first run**. Somebody who has forgotten
everything should still get back in without emailing us, and should never reach a
dead end — which means every refusal has to say what to do next, not just what
went wrong. Some organisations will require sign-in through their provider only,
and some will time sessions out; a person hitting either of those needs to
understand why rather than think it is broken.

### Organisations and access

**What somebody does here**

- Creates an organisation, or belongs to several and switches between them
  constantly
- Joins one, in any of **eight ways**: creating it; an emailed invitation; a join
  code; a QR code scanned by fifteen people at once at a staff briefing; a
  verified company email domain that lets colleagues in automatically; asking to
  join and waiting for approval; being part of a staff list somebody imported;
  or a corporate directory that adds and removes people without anybody
  intervening
- Is, at any moment, **invited**, **awaiting approval**, **active**,
  **suspended**, or **gone** — and moves between those states
- Invites people, several at a time, each with a role; sees whether the
  invitation arrived, bounced or was opened; resends or revokes it
- Approves or declines people asking to join, including in bulk after a briefing
- Manages a join code: its expiry, how many times it may be used, how many times
  it has been, rotating it, revoking it
- Verifies a domain, and decides whether it admits people or only queues them
- Sees every member, their role, how they got in, and when
- Creates and edits roles, deciding what each one may do
- Suspends somebody, removes them, or changes their role
- Hands the organisation to somebody else, or leaves it
- Deletes the organisation
- Sets organisation-wide rules: sign-in through a provider only, how long a
  session lasts

**Where** A computer, almost entirely. The narrow web can manage members and
settings; the apps only need enough to see who is who.

**What makes it hard** We see the eight routes in as **one journey entered at
different points**, not eight separate flows — design them that way and a ninth
is cheap. The permission model is the other difficulty: an administrator has to
understand what a role actually grants before handing it out, and somebody locked
out of their own organisation is a call we would rather not take. The last owner
cannot be removed, and the reason has to be apparent at the moment somebody
tries.

### Events

**What somebody does here**

- Creates an event: a name, a type, a date or a span of several days, a venue
  address, a cover image a guest will see, and a timezone
- Keeps it a **draft** while building it, then makes it **live**
- Watches it become **ongoing** on the day, **pauses** it if something happens,
  **resumes**, and sees it **concluded** afterwards
- Edits any of it, before and during
- Sees all their events together, and which one needs them today
- Deletes one, which takes the guests, the seating, the menu and the history with
  it
- Duplicates a past event as the starting point for the next one

**Where** Created on a computer; lived in on both.

**What makes it hard** An organiser running three events at once needs to know
which needs them **today** without opening each. And the states have consequences
guests can see: a paused event and a concluded one both need something sensible
to show somebody who follows an old link, in their own language, without
mentioning anything internal.

### Guests

The heart of planning, and where most of the time goes.

**What somebody does here**

- Adds guests one at a time, or **imports hundreds** from a spreadsheet somebody
  else maintains
- During an import: picks which column means what, sees every row that is wrong
  and **fixes it before anything is created**, drops rows, spots people who are
  already on the list, and sees exactly how many will be created
- Afterwards: sees the history of imports and **reverses an entire run** that
  went wrong
- Holds, per guest: a full name — often carrying a title, so "Chief Mrs Adaeze
  Okonkwo-Williams" is a normal guest and not an edge case — an email address, a
  phone number, the groups they belong to, dietary needs, a note, their reply,
  their seat, and whether they turned up
- Organises guests into **groups** — "bride's side", "vendors", "table four" —
  renames and merges them
- Records **companions**: named or unnamed, capped per guest, and **whose
  attendance depends on their host's**. If the host has not accepted, the
  companion is not coming either
- Sends invitations, then spends weeks chasing: who has not answered, who
  bounced, who said maybe, who needs asking again
- Corrects somebody's reply on their behalf, because they replied by text message
  to a friend
- Merges two records that turn out to be one person
- Finds anybody instantly out of several hundred
- Works in bulk: selects eighty people and assigns a group, seats them, messages
  them, or deletes them
- On the night, records arrivals — including somebody who turns up without an
  invitation
- Holds a conversation with a guest who replies with a question

**Where** A computer for building and chasing; the apps for reviewing, for the
door, and for quick corrections.

**What makes it hard** Everything about long lists: several hundred rows, read
and re-read, sorted and filtered by reply, group, dietary need and seat — on a
computer, and **on a phone, which is the hardest thing in this brief.** Imports
go wrong in every imaginable way and must be survivable in both directions. The
**companion dependency** has to be visible rather than inferred: a held reply is
not the same as an awaited one, and showing them alike is how somebody caters for
forty people who are not coming.

### Venue and seating

Laying out a room, then putting people in it.

**What somebody does here**

- Builds the room: named **sections**, **tables** of different shapes and
  capacities, **rows of chairs** for a ceremony, and **loose chairs** that belong
  to nothing
- Arranges all of it spatially — moving, rotating, duplicating, aligning,
  resizing — at several levels of zoom, with different detail visible at each
- Seats people: dragging them from the ones not yet seated onto a particular
  chair, or filling a table at once
- Sees, per seat, whether it is empty, taken, **held for a companion**, or
  unusable
- Sees what is left: how many are unseated, how many seats spare, which table is
  over its capacity
- Asks for a plan to be drafted for them, and accepts, edits or discards it
- Reads it as a list rather than a picture, when that is faster
- Gets a previous version back after wrecking the current one
- Prints it for the venue to pin up, and shares a view of it with staff
- Lets a guest look up their own seat

**Where** Built on a computer weeks ahead; adjusted on a tablet on the day; read
live during service; printed for the venue.

**What makes it hard** It is **spatial and direct**, and has to be as workable
with a finger on a tablet as with a mouse — including dragging one person onto
one chair among four hundred. The real problem is social rather than logistical:
families together, two people apart, somebody with a wheelchair near a door, an
allergy near the right service. And a layout somebody spent an afternoon on must
be recoverable, because it is the easiest thing in the product to destroy by
accident.

### Menu and dietary

**What somebody does here**

- Builds **courses** in order, each with a name and when it is served
- Adds **dishes** to a course, and **variants** of a dish for people who need one
- Marks dishes with dietary information, and separately marks guests with their
  own needs
- Keeps a library of dishes to reuse between events
- Collects each guest's **choice** per course, or chooses on their behalf
- Sees what the kitchen needs: counts per dish and variant, for the room and per
  table, who has not chosen, and **allergies listed separately from preferences**
- Changes the menu after people have already chosen, and deals with the
  consequences

**Where** A computer to build; the apps to read during service; the guest's own
phone to choose.

**What makes it hard** **An allergy is not a preference.** One is a seriousness
that has to reach the kitchen and the person carrying the plate without being
missed; the other is a nicety. That distinction has to survive being printed in
black and white and glanced at across a loud room. And a menu changing after
people have chosen is a real situation: somebody has to see who is affected and
ask them again without losing the original answer.

### Run of show

**What somebody does here**

- Builds the schedule: items with a time, a duration, an owner, and what they
  depend on — across one day or several, and across more than one room or stage
- Reorders it, and moves an item when the day shifts
- On the night, follows it: what is happening now, what is next, **how far behind
  the night is running**
- Marks an item started, done, or skipped
- Reads their own cues, if they are the one holding the microphone
- Shows the room a screen with what is happening and what is coming

**Where** Built on a computer; run from the apps; shown on whatever screen the
room has.

**What makes it hard** Three different people need three different things from
the same schedule at the same moment: whoever is running the night, whoever is
speaking, and the room itself. The speaker's view has to be **legible at a glance
under stage lighting**, and the room's screen **readable from twenty metres**. An
overrun is the normal state, not an exception.

### Staffing

Deliberately not the same as being in the organisation: a waiter hired for
Saturday is not in your company.

**What somebody does here**

- Adds people who are working this event, with the job they are doing
- Assigns **shifts** — who is on, and when
- Assigns **stations** — these tables, that section, the door, the pass
- Briefs them: what they need to know before the night
- Gives them access **without requiring them to have an account**, bounded by the
  event and gone afterwards
- Sees who has been briefed and who has not
- On the night, reassigns somebody because another did not turn up, and **grants
  access in seconds**
- Holds a conversation with the team, or one person on it

**Where** Arranged on a computer; used from the apps.

**What makes it hard** The people on this list are the least likely in the whole
product to have used it before, may be using a borrowed device, and are being
onboarded at the worst possible moment. Whatever they see has to be
self-explanatory on first contact and show them only their own job. And on the
night, access is an emergency: somebody standing in a doorway cannot wait for an
invitation email.

### Service floor

The night itself.

**What somebody does here**

- Sees the room as it is: every table and what it needs
- Follows a plate from the kitchen to the table — ready, collected, delivered
- Sees, per table, which course it is on and how long it has been waiting
- Reads a ticket at the pass: the table, the course, how many covers, and **the
  dietary flags, which cannot be missed**
- Takes requests from guests sitting at a table, and resolves them
- Sees which tables are theirs rather than everybody's
- Knows whether what they are looking at is **live or stale**

**Where** The apps, overwhelmingly — a phone in one hand, or a tablet on a stand
at the pass. There is a view on the web for whoever is at a laptop.

**What makes it hard** Everything about the circumstances: a dim room, noise, one
hand free, plates in the other, walking. **What a table needs has to be readable
at arm's length in under a second**, and a kitchen printout is black and white,
so colour alone cannot be carrying it. Everything updates as the room changes,
and the signal is patchy — showing stale state silently during service is the
worst thing this product could do.

### Messaging

One machine. A message has an **audience**, a set of **channels**, a
**template** and a **trigger**. An invitation is a message triggered by
publishing; a reminder by a clock; an announcement by a person.

**What somebody does here**

- Chooses who it goes to, by building up conditions — this group, who has not
  replied, who is seated in that section — and sees the count change as they do
- Saves an audience to use again
- Chooses channels: email, SMS, WhatsApp, an in-app item, and push, which **rides
  along with another channel rather than being chosen instead of one**
- Writes it once, dropping in things that differ per person — their name, their
  table, their meal
- Writes it in four languages, or has it sent in each recipient's own
- Sees what each channel will actually look like to the person receiving it,
  which is four genuinely different things
- Sees, before sending: how many it reaches, what it costs, and **who it cannot
  reach at all**
- Sends it now, at a time, or on a trigger
- Afterwards: **did it arrive?** Per person, per channel, with the provider's
  answer, and **why a channel was skipped** — no number, out of credits,
  unsubscribed, no consent
- Resends to the people it failed for, on the same channel or another
- Keeps templates to reuse, including ones that need approving by WhatsApp before
  they can be used
- Reads and answers replies, from guests and from staff

**Where** Composed on a computer; read and answered from the apps; received
anywhere.

**What makes it hard** **"My guests never got it" is the thing we expect to be
asked about most**, and the answer has to be visible without asking us — which
makes the delivery record as important as the composer, and the _why it was
skipped_ the most important part of it. Sending to four hundred people is also
irreversible and costs money, so the last step before it goes carries real
weight.

### Plans and billing

**What somebody does here**

- Sees what their organisation is on, what that includes, and what it costs
- Compares tiers and changes between them, seeing what a downgrade would cost
  them before committing
- Pays: by card, through Apple or Google, or on an invoice — and sees which
  method is the one in use, which is expiring, and which failed
- Pays for **several organisations at once** on one account
- Adds a tax identifier, which changes the price
- Sees invoices and payment history, and downloads one
- Watches usage against allowances — guests, team members, active events,
  messages, assisted requests, storage
- Buys **credits**, which pool across everything that costs money
- Hits a **hard limit at the moment of creating something**, sees which limit and
  what the number is, and is offered the way past it
- Runs out of credits, and finds that **one channel is held back rather than the
  event stopping**
- Falls behind on payment, and finds things **read-only rather than gone**

**Where** A computer only, including the narrow web. App stores take a share of
anything bought inside an app, so plans are sold on the web and the app signs in
to what was bought there. That is worth saying at the point of purchase, because
a subscription bought through a store belongs to that store account, cannot be
pooled with other organisations, and cannot be handed over.

**What makes it hard** **A paywall must never ruin somebody's wedding.** Every
refusal happens when something is created, never during a live event; a card
expiring on Saturday afternoon does not stop the service floor. And the three
kinds of limit behave differently — refused, warned, or present-but-unavailable —
which has to be legible without anybody learning the distinction.

### Assistance

**What somebody does here**

- Opens an assistant from anywhere, which already knows what is on screen and
  which event they are in
- Asks for something to be drafted: a seating plan, a running order, a message to
  the people who have not replied, a summary of where the event stands
- Asks a question about their own event and gets an answer drawn from it
- Sees **what it looked at** to answer
- Sees a **proposal next to what is already there**, and accepts it, accepts part
  of it, or discards it — **nothing changes on its own**
- Sees what it is spending, and what happens when the credits run out
- Is told plainly when it cannot help: not here, busy, or declining

**Where** Everywhere, in whatever form suits the surface.

**What makes it hard** Trust. An answer with no visible basis does not get
believed, and an assistant that changes something by itself gets switched off. It
also costs money per use, so the cost cannot be a surprise. And it will sometimes
be wrong, so discarding has to be as easy as accepting.

### Insights

**What somebody does here**

- Sees how an event is going: replies over time, how many are coming, how many
  have not answered, dietary needs totalled, seats filled
- Compares against a previous period, or a previous event
- Sees which channels actually reach people and which are wasted
- Finds the people who need chasing, and acts on that list without leaving
- Exports it, or prints it

**Where** A computer mostly; headline numbers worth having in the apps.

**What makes it hard** It has to answer questions an organiser actually asks
rather than show what is easy to count, and every figure should lead somewhere —
"eleven bounced" is a list of eleven people to fix, not a statistic.

### The public pages

**What somebody does here**

Two audiences who have never signed in.

**Somebody who has never heard of Soirely** — finds out what this is in one
screen, in their own language; sees what it costs **before being asked for
anything**; reads enough to believe it; gets in touch; signs up.

**A guest** — opens a link from an email, probably on a phone, and:

- Sees the invitation as the organiser designed it
- Replies: coming, not coming, or not yet sure
- Names who they are bringing
- Chooses a meal per course, and says what they cannot eat
- Finds out where they are sitting
- Shows something at the door
- Asks the organiser a question
- Changes their mind later

**Where** The web, on whatever device they happen to hold. Neither audience will
ever install anything.

**What makes it hard** **The guest path has to be the simplest thing in the
product.** One task at a time, nothing to learn, no sense of being at the edge of
a large system, and no account. They may be elderly, they may be irritated at
being asked, and they will do this exactly once. It is also the part of the
product most people will ever see — a guest list of four hundred is four hundred
first impressions, and the organiser's reputation is in it.

## 6. How we see support working

A separate internal application, designed now because retrofitting it is worse.

**The situation.** Seven o'clock on a Saturday. A customer's service floor has
stopped working and there are two hundred people in a room. An agent has
minutes, and the customer is not calm.

**Who uses it.** A handful of people, all day, every day, who will be expert
within a week. They read far more than they type, keep several conversations
open, and will learn every shortcut it offers. Optimise for their speed over
their first impression. It should feel like the same company's product without
being styled as though a customer were reading it.

**What an agent does here**

- Works a **queue** of two kinds of thing which must not look alike: ordinary
  requests, and **an event failing while it is happening**. The second is not a
  priority flag on the first
- Sees how long something has been waiting, whose it is, and whether it has
  missed the time it was promised in
- **Finds the right account from whatever the customer happens to have** — an
  email address, a phone number, the name of an event, a reference from an error
  message, an invoice number — where the answer might be a person, an
  organisation, an event or a single message
- Reads **one history**, top to bottom: signed up, verified, joined an
  organisation, created an event, sent 412 invitations of which 11 bounced,
  upgraded, started service. Dense enough to scan, detailed enough to land on one
  moment and ask what that was
- Sees, per area, the things that actually go wrong:
  - **sign-in** — what is verified, which providers are linked, failed attempts,
    whether a code was delivered
  - **access** — members, roles, pending invitations and whether they arrived
  - **events** — the state, and every change of state
  - **guests** — delivery per guest, and the history of imports
  - **seating and menu** — previous versions, and what guests had chosen
  - **service** — whether the customer's screens are actually connected, what was
    recently sent to them, and a plate's history
  - **messaging** — the delivery record, the channel breakdown, and **why a
    channel was skipped**
  - **billing** — the subscription, payments, usage, and how it was paid for
  - **assistance** — what was asked and what was answered
- **Acts.** Resends a code; forces a verification through; sends a password
  reset; **clears a second factor** for somebody who lost the device; unlocks an
  account that locked itself; changes an email address; restores an owner;
  changes a role; resends or revokes an invitation; **undoes a deletion**;
  reverses a state change; **restores a deleted event**; reverses an entire
  import; merges two guests; restores a seating layout or a menu to a previous
  version; corrects a reply; **issues emergency access to an event on the
  night**; forces a stuck screen to reconnect; corrects a state the room has
  moved past; resends a message on another channel; refunds; credits;
  **grants a temporary exception so a customer is unblocked mid-event without
  waiting for us to ship anything**; extends a trial
- **Looks at the product as the customer**, read-only by default
- **Escalates** to somebody more senior, with what they have found
- Leaves notes colleagues will read, separately from anything the customer sees

**What makes it hard** The actions above are genuinely powerful, and the design
has to carry that: what it will do, why the agent is doing it, and a weight of
confirmation proportional to how hard it would be to undo. **Nothing here should
be one careless click away, and nothing should take six.** Seeing the product as
the customer is the most dangerous thing in the console — whoever is doing it
must be unable to forget, and able to stop in one action. Everything is recorded
with who did it and why, and an agent's action must stay distinguishable from the
customer's own for as long as the record exists.

## 7. What we have not decided

Genuine gaps rather than hidden requirements. Do not design around them silently;
if the design needs an answer, say so and we will decide.

- **A budget.** The previous product had one — planned spend against actual, per
  line. It is not currently one of the fifteen areas above. Insights mentions
  money only where it is already known.
- **Where two-way conversations live.** Guests reply to messages and staff ask
  questions; we are not yet certain whether that is one inbox, a thread per
  person, or part of each area.
- **Whether an organiser can design the invitation itself** beyond an image and
  the words, or whether we choose how it looks.
- **How much of the product a guest ever sees** besides their own invitation,
  reply, meal and seat.

## 8. What we need back

**Four directions first, then stop.** Before anything is built out, propose
**four distinct visual directions** for the product. For each: enough to judge
it — the palette, the typographic voice, and a line on why it fits _this_
product and what it would feel wrong for.

Render all four the same way, using the same few real fragments of this product,
so they can be compared rather than imagined. Pick the fragments you think show
a direction best; use the same ones for all four.

Then wait for a choice. Build out only the chosen direction.

Make the four genuinely different — in temperature, formality and typographic
voice, not one idea with the accent rotated. This product spans a funeral and a
product launch; there is real range available. And avoid, across all four, the
aesthetic that tools converge on when unsupervised: Inter or system-ui as a
_choice_, purple-blue gradients, identical rounded cards with a drop shadow, a
palette that could belong to any SaaS product. Avoid equally the other default —
cream, serif display type, terracotta accent — which is a real aesthetic and
overused for exactly this kind of brief.

**Then the design context itself**, in whatever form and order you think is
right. We are not going to tell you what it should contain; what we need is that
it is complete enough to build from without a developer inventing the parts you
left out, and that it covers the three surfaces in section 2 and the support
console in section 6.

**It must be interactive.** A picture of a dropdown tells us nothing about the
part we have to get right, which is how it behaves. Things should open, close,
sort, drag, validate, load, fail and recover. We would rather have fewer things
that work than everything flat.

**A few assembled flows**, clickable end to end, so the language can be judged
in use rather than in isolation. Our suggestions, though you may have better
ones: adding guests to a list and fixing a bad import; seating people in a room;
sending a message to a group and then finding out what happened to it; replying
to an invitation as a guest on a phone; working a table during service.

**Something we can check against.** A reference we can open while building, that
shows what exists and in what states, and that visibly breaks when something
underneath changes — that last part is what stops a design and a codebase
drifting apart.

## 9. What our stack can and cannot do

The web is **React**; the apps are **React Native**. Everything in the design
will be built twice, once in each, so a few things that are free on the web are
not available to us:

- **No CSS grid, floats or sticky positioning** in the apps. Flexbox only.
- **No pseudo-elements.** Decoration generated by `::before` does not exist on
  mobile; anything visible has to be a real element.
- **Shadows are not the same on both.** Do not let anything depend on a shadow
  matching exactly across them.
- **Type is chosen by weight, not by naming a family** in a style — our mobile
  font layer maps a weight to a file and naming a family bypasses it.
- **Text cannot nest inside text** on our mobile stack; it crashes.
- **Anything that overlays — a menu, a sheet, a tooltip — has to sit above
  everything**, not inside the card that opened it, because a card that rounds
  its corners also clips its contents.
- **Animate position and opacity.** Both platforms do those cheaply and very
  little else.

Hover belongs to a mouse rather than to a platform, so anything revealed by
hovering on a computer needs an equivalent in the apps that is always present.

## 10. Requirements, not preferences

- **Four languages, equally.** English, Spanish, French and Portuguese, none of
  them an afterthought. French and Portuguese run 20–30% longer than English.
  The set may grow, so nothing should structurally assume left-to-right.
- **Fully operable by keyboard**, with focus always visible — including anything
  designed around dragging, which needs a keyboard path of its own.
- **Legible**: 4.5:1 for body text, 3:1 for large text and focus indication. The
  guest pages and the apps in a dimly lit room are where this is actually
  tested.
- **Meaning never carried by colour alone.** A kitchen prints in black and
  white, and a server may be colour-blind.
- **Reachable by a finger** — nothing smaller than 44px where a finger is used,
  including on the web, since laptops have touchscreens.
- **Movement is optional.** Anything that animates needs a version for people
  who have asked their device for less of it.
- **Nothing that could interrupt a live event.**

## How to answer

1. The four directions, compared the same way. Then stop.
2. After one is chosen, build it out in whatever order you think is right,
   stopping often enough that we can redirect you rather than discovering at the
   end that we disagreed early.
3. For every decision that could have gone the other way, one sentence on why it
   went this way. A design context without reasons gets overridden by the first
   developer who disagrees with it.
4. **Where this brief is wrong, say so.** It was written by the people building
   the product, not by a designer — sections 4, 5 and 6 are our view of how it
   should work, and that is exactly the part we want argued with.
5. **Judge your own work against section 3.** For any flow you deliver, say what
   somebody seeing it for the first time would do, and where they might
   hesitate. Where you are unsure, say that too — it is more useful to us than a
   confident answer.
6. **If you can see a better way for any of it to work, propose it** rather than
   designing our version well. Say what you would change and what it would
   improve; we will find out whether it is feasible and come back to you. A scope
   described above is what we currently intend, not a decision we are attached
   to — the only ones we cannot move are section 3 and section 10.
