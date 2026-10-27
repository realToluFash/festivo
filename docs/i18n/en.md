# English at Soirely

Kept by `/soirely-linguist`. Read it before writing a string in English, and add to it
whenever you decide something a second string will need.

## Variant and register

British English (en-GB). Plain, warm and direct. No contractions in error bodies: "cannot",
not "can't". British spelling: organisation, cancelled, colour. Sentence case for every
label and heading.

The rules every locale shares are in `.claude/skills/locale-parity`.

**A limit checked on screen and by the server says the same sentence in both catalogues.** The
field's key (`web` or `mobile`) and the API's refusal (`messages` or `errors`) carry the same
words, with the limit as a slot in each, because a stale page or another client meets the
server's check instead and must read what the screen would have said. Reword one and the other
changes in the same pull request; where a test pins the server's text, it waits on [dev] and
the entry below says so. Over a text limit the sentence is "Shorten the {field} to {{count}}
characters or fewer." Translate the pair as one sentence. sc-2150 found three pairs that
differed (`rolesScreen.nameTooLong` against `roles.name_too_long` in en, es and fr).

## Glossary

One way to say each recurring thing, everywhere. Seeded from the catalogues as they stood on
17 October 2026; the linguist reviews each row and marks it settled in Notes.

| Term                                 | Notes                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings                             |                                                                                                                                                                                                                                                              |
| Organisation                         |                                                                                                                                                                                                                                                              |
| Sign in                              |                                                                                                                                                                                                                                                              |
| Sign out                             |                                                                                                                                                                                                                                                              |
| Email                                |                                                                                                                                                                                                                                                              |
| Password                             |                                                                                                                                                                                                                                                              |
| Continue                             |                                                                                                                                                                                                                                                              |
| Cancel                               |                                                                                                                                                                                                                                                              |
| Two-factor authentication            | Settled 19 Oct 2026: "two-factor" alone in running text and labels; enabling it is "turn on" (see Decided phrasings).                                                                                                                                        |
| Recovery code                        |                                                                                                                                                                                                                                                              |
| Carry on                             | Settled 17 Oct 2026: "… to carry on" is the house phrase for resuming (20 strings). Not "continue", which is the button.                                                                                                                                     |
| Signed out (a device)                | Settled 17 Oct 2026: "is signed out" for the state, "has been signed out" in emails. Never "logged out".                                                                                                                                                     |
| Phone number, mobile number          | Settled 18 Oct 2026: "phone number" for any number on the account (card, list, add button, cap), which may be a landline; "mobile number" only for the field we text a code to (`contacts.phoneLabel`, `verifyPhone.numberLabel`).                           |
| Alternative (address, number)        | Settled 18 Oct 2026: any address or number on the account that is not primary, verified or not. The card's plural is "Other addresses" / "Other numbers"; one of them is "an alternative address" or "an alternative number". Never "secondary" or "backup". |
| Schedule                             | Settled 19 Oct 2026 (epic 33, sc-3895 #4106): the list the organiser builds, and its page. Never "agenda", "itinerary" or "running order".                                                                                                                   |
| Run of show                          | Settled 19 Oct 2026: the night's screen, app and web, the web switch included. Never a bare "Run".                                                                                                                                                           |
| Now, Next, Later                     | Settled 19 Oct 2026: Run of show's cards and list, and the cue screen's "Later". "Later" replaced the drawn "Then". Own keys, never a stepper's "Next".                                                                                                      |
| Done, Skip, Start now                | Settled 19 Oct 2026: finishing, skipping and starting an item. States in a list: "Done", "Skipped", "Not started". "Done" is its own key, not the app's `close`. Screen readers: "Done: {{title}}".                                                          |
| Move, Move after this                | Settled 19 Oct 2026: moving an item (sc-3894). "Move after this" replaced "Place after", because "Place" is the noun on the same page.                                                                                                                       |
| Place (a track)                      | Settled 19 Oct 2026: where an item happens. "Track" stays internal; never "venue", "room" or "stage".                                                                                                                                                        |
| Show to guests, Fixed time           | Settled 19 Oct 2026: the schedule item form's switches.                                                                                                                                                                                                      |
| Your cues, You're on, You're up next | Settled 19 Oct 2026 (sc-3896): "Your cues, {{name}}" with the full name; "You're on" only while the cue runs, "You're up next" before.                                                                                                                       |
| Coming up                            | Settled 19 Oct 2026: the room screen's heading (sc-3897) only. "Times as of {{time}}" when offline, time from Intl.                                                                                                                                          |
| The day, Programme                   | Settled 19 Oct 2026 (sc-3899): the guest page heading, "The day" for one day, "Programme" when items span several days.                                                                                                                                      |
| That's everything                    | Settled 19 Oct 2026: the end of the run of show, then "Finished {{count}} min behind plan.", "… ahead of plan." or "Finished on plan.", three whole keys. Replaced "That's the whole night".                                                                 |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **26 Oct 2026. Deleting an event** (sc-14417 for sc-3592, `eventDelete.*` web and app,
  `messages:event.delete_name_mismatch`). Settled as sc-3592 wrote it; `DeleteEvent.test.tsx`
  pins it. The act is "Delete event", the dialog "Delete {{event}}?", the way out "Keep it". It
  follows deleting an organisation: `mismatch` and the API's refusal are one sentence, the check
  made twice, and the restore window closes on "gone for good". The reader's team is "your whole
  team"; guests are "Guests following their link", as for calling off. The app's `failed` is
  `ownership.failed` word for word. es, fr and pt name "support" in full, as
  `ownership.deleteWindow` does, and agree `deleted` with "event", never with the name.
- **26 Oct 2026. Happening now, ending or calling off an event** (sc-14189 for sc-3585,
  `web:events.happeningNow`, `mobile:eventsScreen.happeningNow`, `eventEnd.*` web and app,
  `eventEdit.scheduleLocked|scheduleConcluded`, `messages:event.already_over|schedule_concluded`).
  Settled as sc-3585 wrote it. Before the start the act is "Call off" (it won't go ahead); from
  the start it is "End now"; afterwards the event is "Finished", as sc-3584 settled. A refusal
  starts "Not ended.", as "Not made live." does. The confirmation's way out is "Keep it on", for
  both acts, never "Cancel", which in es, fr and pt is the same word as calling off. The read-only
  help line (`scheduleLocked`) explains, so it keeps "can't"; the refusal of a save that changes
  the dates anyway (`scheduleConcluded`) and the API's say "cannot". es, fr and pt write the two
  as one sentence. Guests are "Guests following their link", the people who open the invitation.
- **26 Oct 2026. Making a draft event live, and the event states** (sc-13956, sc-3584,
  `eventLive.*` web and app, `events.live|paused|finished`, `eventsScreen.*`,
  `messages:event.state_invalid`, `event.concluded`, `messages+intl-icu:event.plan_limit`).
  Settled as sc-3584 wrote it; `Events.test.tsx` pins most of it. An event is "Draft", "Live",
  "Paused" or "Finished"; the act is "Make live", and a refusal starts "Not made live.", as a
  refused save starts "Not saved.". A colleague is "somebody else". The plan limit is one
  sentence on screen and from the API, with the limit as a plural. One line waits on [dev]:
  `endPassed` should read "… so it cannot be made live. …", as `messages:event.concluded` does,
  since a refusal takes no contraction, but the test matches "can't". The role permission
  `rolesScreen…events` still says "publish … conclude", the older words; es, fr and pt already
  write making live as publishing (_publicar_, _publier_), so the states read _Publicado_,
  _Publié_, and the permission and the button agree in those three.
- **26 Oct 2026. The Google-or-Apple refusal's title** (sc-13612, `errors:oauth_only_unlinked`).
  One 403 code answers an Owner requiring Google or Apple before linking their own and a member
  stranded read-only, so its title states the shared fact, "No Google or Apple account is
  linked.", and each `detail` says what to do. "Read-only" stays on the stranded member's banner
  (`unlinkedTitle`), the only place it is true. es, fr and pt name the account, as their details do.
- **26 Oct 2026. An event's venue, and the app's event list** (`web:eventForm.venue*`,
  `web:eventPage.venue*`, `addVenue`, `openInMaps`, `messages:validation.event_venue_*`,
  `mobile:eventsScreen.*`, sc-3589 and sc-1593 via sc-13205). Settled as built, except two lines
  that wait on [dev], because `Events.test.tsx` matches their English: `venueLookupDown` should
  read "Suggestions are not available right now. …", no contraction, as it reports a failure;
  `venueZoneOffer` should read "The venue is in {{zone}}. Use that time zone?", since "Use it?"
  leaves the reader to work out what "it" is. es, fr and pt are written to the settled meaning
  already. A venue is "Venue" in every label; its address is "Address". The two length limits
  say the same sentence on the web and from the API, the house "Shorten the … to {{most}}
  characters or fewer.".
- **26 Oct 2026. An event's cover** (sc-13587, `web:eventCover.*`, `messages:validation.cover_*`).
  The section is "Cover" and the dialog "Cover photo"; the person's own image is "photo"
  throughout, and "image" only in "Describe the image", the screen reader's word. The API's
  description limit now reads as the web's, "Shorten the description to {count} characters or
  fewer.", replacing "… characters at most." The refusals read "That file is not a photo we can
  use. Choose a JPEG, PNG, WebP or HEIC." and "The photo did not upload. Try again." (web and API
  alike), and the created line "The event is saved without its photo. {{reason}}", with no comma:
  no contractions in an error, as the house rule has it (changed in the catalogues and
  `Events.test.tsx` by [dev] in #634, sc-3590). Every
  locale's created line must read with any refusal after it as `{{reason}}`.
- **26 Oct 2026. An event's type** (`web:eventForm.type`, `typePlaceholder`, `typeMissing`,
  `web:eventTypes.*`, `messages:validation.event_type_required`, sc-3588 via sc-13205). The
  field is "Type", its prompt "Choose what kind of event", and the refusal, on screen and from
  the server alike, "Choose what kind of event it is.". The fourteen labels stand as built:
  sentence case, a noun phrase, no article. "Anniversary" means a couple's (a firm's is
  "Corporate event"), which is how es, fr and pt can tell it from "Birthday". "Gala or
  fundraiser" keeps both words: a gala alone misses the charity dinner. Any new type keeps to
  about 22 characters, the width of the narrow web select.

- **25 Oct 2026. Settings > Members on the web, the invitation link and the invitation email
  (sc-67, sc-68, sc-11160, sc-2922, `web:membersScreen.*`, `web:join.*`, `invitations.*` web and
  app, `emails:invitation.*`, `messages:invitations.*`).** Settled as sc-67 wrote them. The web
  twins of the app's Members keys say what the app says: `onlyOwner` now reads "so their role
  cannot change and they cannot be removed …", as sc-4259 settled. `ownRole` keeps "You can't"
  and "General" (the web's section; the app says "Organisation"), because `Members.test.tsx`
  matches "You can't change your own role"; it should read "You cannot change your own role."
  and waits on [dev]. `beyondGrant` reads "you cannot change their role or their access" since
  sc-13023 (#582), so it holds on the suspension cards too, where restoring is what it rules out. es, fr and pt write the web twins as the app's, word for
  word, and write `ownRole` without the contraction. An invitation is "withdrawn" in prose and
  "Revoke" stays the manager's button; the invitee reads "Withdrawn". "Works until" is the
  invitation's life, never "valid until".
- **25 Oct 2026. Deleting an organisation (sc-68, sc-3215, `errors:owner_required`,
  `messages:organisation.owner_required`, `delete_name_mismatch`, `emails:organisationDeleted.*`).**
  Settled as sc-68 wrote it; `OrganisationDeletionTest` and `OwnershipCard.test.tsx` pin the
  refusals, the subject and the restore line. `delete_name_mismatch` is the same sentence as
  `ownership.deleteMismatch`, the check made twice, and `organisationDeleted.restore` repeats
  `ownership.deleteWindow`, the sentence the owner read before deleting. `errors:owner_required`
  is the code's own, any act; `organisation.owner_required` names the act. The footer says "you
  were a member": the organisation no longer exists when it is read.
- **25 Oct 2026. The sign-in rules refusals (sc-10594, sc-10716, `messages:sign_in_rules.*`).**
  `inactivity_choice` stays: "Choose 7 days, 30 days or no limit." The other two are the
  Owner's own state, as the page's `needsOwn*` says it, and should read "Turn on two-factor for
  yourself before requiring it." and "Link Google or Apple for yourself before requiring it.",
  but `SignInRulesTest::eachRefusalReadsInEnglishAsItDidBefore` pins the English, so that waits on
  `[dev]`. es, fr and pt already say it the page's way, after the `errors:` title.
- **25 Oct 2026. The API's refusals in the request's language (sc-10700, sc-10809, `messages:*`).**
  Settled as sc-10700 wrote them, with three changes. `event.currency_in_use` says "against this
  event", as its screen twin `eventEdit.currencyInUse`. `access.two_factor_required` says "requires
  two-factor for this", the verb `two_factor_overdue` uses, over "asks for two-factor before this".
  `provider.unlink_first` says "the account that is linked now". Field and header names an
  integrator sends (`idToken`, `recoveryCode`, `If-Match`, `context`, the assistant's roles) stay as
  written in every locale. Where a refusal's screen already words the same sentence (the lock-outs,
  `lostTwoFactor.*`, `signIn.timedOutBody_*`), es, fr and pt say what the screen says.
- **25 Oct 2026. A time the clocks skip (sc-10638, sc-10675, `eventForm.clocksSkip`,
  `clocksSkipNextDay`).** Settled as sc-10638 wrote it; `Events.test.tsx` pins it. "There is no
  {{time}} on {{day}} in {{zone}}: the clocks go forward that night. It will be saved as
  {{savedAs}}." The next-day line adds "on {{savedDay}}". "The clocks go forward" also covers
  Lord Howe's half hour; rejected "daylight saving time", which reads American and is a term
  es, fr and pt each say differently.
- **25 Oct 2026. Editing an event's details (sc-9704, sc-3587, `eventEdit.*`,
  `errors:precondition_failed`, `precondition_required`, `event_currency_in_use`).** Settled as
  sc-3587 wrote it; `Events.test.tsx` pins most of it. "Edit details" opens and heads the form,
  "Save changes" saves it. A refused save starts "Not saved." and says what is kept. A
  colleague is "somebody else", in the notice and the dialog alike. The currency refusal is
  checked on screen and by the server, so `errors:event_currency_in_use` now says "against this
  event", as `eventEdit.currencyInUse` does.
- **24 Oct 2026. Suspending a member by hand and restoring them (sc-3575, sc-8735,
  `membersScreen.suspend*`, `restore*`, `seats*`, `ownerNoSuspend`, `accessConflict`,
  `emails:memberSuspended.*`, `memberRestored.*`, `memberAccess.footer`, `messages:members.*`).**
  Settled as sc-3575 wrote it. "Suspend" is the act and "Restore access" the way back; a seat
  is "a team seat" on "the plan". Three refusals keep their contractions for now because
  `Members.test.tsx` pins them: `ownerNoSuspend` should read "Owners cannot be suspended",
  `accessConflict` "your change was not made", and `seatsSuspendedFree` "Suspended members do
  not take a seat". They wait on [dev2]. es, fr and pt write `ownerNoSuspend` and
  `members.suspend_owner` as one sentence, as a limit checked twice.
- **24 Oct 2026. The claim that lapsed (sc-9151, sc-9219, `emails:ownerClaim.lapsed.*`).**
  The subject leads with the outcome, "Claim lapsed: {organisation}", as sc-14100: the long
  sentence ran past one row of a 360dp inbox at 473px (QA, 26 Oct). The heading still names
  the claimant, "{claimant} did not become the owner of {organisation}. The claim lapsed", as
  "is now the owner"; `{claimant}` can be a bare address, so it is never a possessive. Each
  reason ends ", so ownership did not pass.", as the web `recordRemoved`; the role is "an
  Administrator", and the date "Lapsed on {deadline}.", as "Withdrawn on".
- **24 Oct 2026. The rest of a role's holders (sc-9068, `rolesScreen.moreHolders_*`, web
  and app).** "and {{count}} more", kept: it closes the list of five names it follows, and the
  button reveals them in place, so "Show" would only lengthen it. The count is never below 1.
- **24 Oct 2026. A request refused for its shape (sc-8708, sc-8716,
  `messages:validation.invalid_shape`, `validation.request_shape`).** Kept as sc-8708 wrote
  them: "This field cannot take that value. Check it and try again." under the field, and "The
  request does not have the expected shape." as the 422 `detail`. The field sentence also
  answers a required field left out (the refresh call with no token), so the other locales
  word it as the value the field will not take, never as a format. The API tests pin both
  English sentences, so a reword waits on [dev].
- **24 Oct 2026. Withdrawing your own claim (sc-8204, sc-8556, `ownerClaim.withdraw*`,
  `youWithdrew*`, `emails:ownerClaim.withdrawn.*`, `messages:owner_claims.not_claimant`).** The
  claimant "withdraws" their claim; anybody else "stops" one. The confirm is "Withdraw your
  claim?" with Withdraw / Keep my claim, the button "Withdraw my claim" in the first person, as
  the person acts on their own claim. `withdrawBody` keeps "won't": it is a confirm, not an
  error. `withdrawEnded` and `owner_claims.not_claimant` match the claim's other refusals. The
  email date reads "Withdrawn on {deadline}.", as "Stopped on" and "Ownership passed on".
- **24 Oct 2026. Getting an owner back (sc-6640, sc-8216, `ownerClaim.*`, web and app,
  `emails:ownerClaim.*`, `messages:owner_claims.*`, `errors:owner_claim_*`).** Settled as sc-6640
  wrote it. The act is "become the owner"; what is under way is "the claim", which "lapses",
  is "stopped", or "passes" ownership. The record is "the DNS record", or "the record" once
  named. Who restores ownership is "Soirely support". The administrators' email footer names
  the role, "an Administrator of {organisation}", as the refusals do. Contractions came out of
  `lapsed`, `recordRemoved`, `failed` ("That did not work.") and `owner_claims.own` /
  `owner_claim_own` ("You cannot stop your own claim.").
- **24 Oct 2026. The only owner left suspended (sc-7831, `accessPaused.stillOnlyOwner`,
  `membersScreen.suspendedOnlyOwner`, `onlyOwnerNotRemovable`, `onlyOwnerRestoreNeedsAddress`,
  `membersScreen.history.suspendedAddressGone`).** `onlyOwnerNotRemovable` is a refusal, so
  "cannot": "{{name}} is the only owner, so they cannot be removed." The history line shows for
  every domain reason (address gone, domain closed, managed elsewhere), so it reads "Suspended:
  their company email address no longer gives access", true for each and naming nobody. Both
  wait on [dev2], because `Members.test.tsx` matches the current English; es, fr and pt are
  written from the settled wording.
- **23 Oct 2026. Ownership and leaving (sc-68, sc-7715, `ownership.*`, web and app,
  `messages:organisation.transfer_owner_required`, `emails:ownershipTransferred.*`).** Settled
  as sc-68 wrote it. The act is "transfer ownership"; in prose ownership is "handed" to a
  member, and the old owner "becomes an Administrator", the role's own name. Deleting closes
  on "gone for good" after Soirely support's restore window, "until {{deadline}}" in the
  server's `deadline` words. `onlyOwnerBody` no longer repeats its title ("You are the only
  owner"), which sits above it in the same notice: it is now "Make somebody else an owner,
  then you can leave." es, fr and pt name the role, never "the owner", so nothing agrees with
  the person: "the new owner" (`theNewOwner`, the email subject) becomes "the chosen person"
  or "a change of owner".
- **21 Oct 2026. A domain member paused (sc-564, sc-6703, `accessPaused.*`,
  `membersScreen.suspended*`, `restore*`, `emails:domainSuspended.*`).** The person reads
  "Paused", the admins "Suspended": both are the AC's words, kept apart on purpose. The next
  step says "make it primary", the glossary's word, over the drafted "make it your main
  address". The email footer says "an admin" though owners get it too; es, fr and pt say
  "owner or administrator", as `twoFactorRecovery.approver.footer`, and the English waits on
  [dev] because `DomainSuspensionTest` matches the text.
- **21 Oct 2026. Request link (sc-562, sc-6460, `requestLink.*`, `requestToJoin.*`,
  `messages:request_link.*`, `errors:request_link_dead`, `join_request_*`).** Settled as sc-562
  wrote it, as domain joining: the act is "ask to join", the setting "Requests to join", and
  "Somebody who can manage members answers each request". The refusals take "cannot":
  "You cannot ask to join {organisation} again yet." The dead link should read "This link does
  not work" and "This link does not work any more. Ask the organisation for a new one." in
  `requestToJoin.deadTitle`, `deadBody`, `messages:request_link.dead` and
  `errors:request_link_dead`, but the web and API tests match the contraction, so that waits on
  `[dev2]`; es, fr and pt carry no contraction already. "We'll email you" stays: the sent and
  waiting lines are confirmations, not errors. A cooling-off date is "from {{date}}", Intl's day.

- **21 Oct 2026. Creating an event on the web (sc-1486, sc-6302, `events.*`, `eventForm.*`,
  `eventPage.*`, `rolesScreen.createEvents*`, `messages:validation.event_*`).** Settled as
  sc-1486 wrote it, except three lines that wait on `[dev]`, because the web and API tests match
  their English: `eventPage.notFound` should be "This event is not available", no contraction,
  as a refusal; `eventForm.nameTooLong` and `validation.event_name_too_long` the house "Shorten
  the name to {{most}} characters or fewer." (`{count}` in the API's); and `problems_*`
  sc-90's "{{count}} field needs fixing, so nothing was sent." es, fr and pt are written to the
  settled meaning already. An event "starts" and "ends" (the form's legends "Starts", "Ends");
  the refusal for an end before the start says "The end is before the start", and other
  locales may say "the event ends before it starts". The permission is "Create events", its
  states "Allowed" and "Not allowed". `firstRunAskOwner` asks the person to talk to an owner,
  not to request a permission by name. The app's copy of the Roles block carries the same four
  `rolesScreen.createEvents*` lines.
- **21 Oct 2026. Two-factor for everyone (sc-609, sc-5702, `signInRules.everyone*`, `due*`,
  `overdue*`, `twoFactorCard.keptByRule`, `emails:signInRules.twoFactorDue.*`).** Settled as
  sc-609 wrote it, except three lines that wait on `[dev2]`, because the web tests match their
  English: `dueSetUp` should be "Turn it on now" and `overdueBody` "{{organisation}} requires
  two-factor, and the time to turn it on has passed.", as "turn on" is the verb (19 Oct) and the
  title already says "to carry on"; `keptByRule` is a refusal, so "cannot", as
  `errors:two_factor_kept_by_rule`. es, fr and pt are written to the settled meaning already.
  A deadline is "from {{deadline}}" and "until {{deadline}}", the server's `time.dateAt`. The
  emails keep straight apostrophes, as every other line in `emails.en.json`.
- **26 Oct 2026. Two-factor for everyone, the artboard's lines (sc-13182, sc-13026,
  `signInRules.everyoneOn`, `everyoneOff`, `everyoneWithoutBody_*`, `everyoneStillWithout_*`,
  `emails:signInRules.twoFactorDue.*`).** Settled as sc-13026 wrote them. The web lines keep
  their contractions: they explain, they do not refuse. Somebody without two-factor "sees a
  banner" until their deadline; other locales name it as their banner word, not "notice".
  "Required from" in the email's facts is the deadline's label; a locale whose "from" will not
  stand before a colon may say "Deadline", as the body already says "You have until".
- **21 Oct 2026. Company domain joining (sc-561, sc-4434, `domainJoining.*`,
  `companyDomains.*`, `messages:domain_joining.*`).** Settled as sc-561 wrote it. The act is
  "ask to join", the button "Ask to join", and "Somebody there approves you before you see
  anything." says why the wait. "Somebody" stays here, against "someone" in the Roles lines,
  because the web tests match the text; reword them together if ever. `domain_public` says
  "cannot" (ux on sc-561 #4417). `asked` and `switcherAsked` start lower case: each follows
  "Waiting for approval · ". A domain with "Stopped" against it is one another organisation
  proved on Enterprise; the row's working state is "People at it can ask to join".

- **21 Oct 2026. Members in the app (sc-4259, `mobile:membersScreen.*`).** A refusal on a
  member says "cannot": "You cannot change your own role." and "… so their role cannot change
  and they cannot be removed …" ("their role", not "this role", which reads as the role
  itself being locked). The foot of the list tells the manager what to do, "To invite
  somebody, use Soirely on the web.", over the drawn "Invitations are sent from Soirely on
  the web.", which states a fact without the action. The landscape pane says "Choose
  somebody in the list …", as `settings.choose`. The row line's pieces (`you`, `when.*`)
  stay lower case, since they follow a role after " · ". The web's twins (sc-2922) still say
  "can't"; settle them the same way there.
- **21 Oct 2026. Invitations waiting on Complete your profile (sc-4188, `completeProfile.invitations*`,
  `orStartOwn`, `joined*`, `organisationOrInvitation`, web and app).** Settled as sc-3353 wrote
  them. "Accept one to join that organisation" reads as the organisation of the one you
  accept; "its organisation" is no clearer and the web tests match the text. The button is
  named as printed, "Save and continue takes you there.", without quotes, as the house names
  a button in running text. "Nothing is waiting" follows every invitation answered without
  joining, so the other locales may say "no invitation is waiting" outright.
- **21 Oct 2026. The organisation's language is labelled "Language for invitations" (sc-3311,
  sc-6696, `orgGeneral.language`, web and app).** "Language" alone reads as the person's own
  interface language; the field only sets the invitation emails sent to people without an
  account, and the PM allowed the longer label. The same label heads the read-only row. A refused save is "Nothing was
  saved." followed by the server's `permission_required` words, unchanged.
- **19 Oct 2026. Two-factor is "turned on", the first time (sc-3030, sc-609, sc-69 #3210).**
  "Turn on two-factor" is the button wherever a person enables it, and a sentence says "turn
  it on" (`twoFactorCard.turnOn`, `signInRules.gateTurnOn`, `needsOwnTurnOn`, `twoFactorOn`,
  sc-609's blocked screen and email). "Set up two-factor again" stays only after account
  recovery, where it was on before (`lostTwoFactor.*`). Won over "set it up", which made one
  act two verbs on one page.
- **19 Oct 2026. A member a sign-in rule holds back "can read but not change anything"
  (sc-3030, `signInRules.unlinkedBody`, `seeProviderBody`, `strandedBody`, `effectStranded`,
  `emails:signInRules.changed.link`).** One phrase, always with "anything", so the banner, the
  owner's preview and the email say the same. Won over "read and not change", which reads as
  a choice, and over a bare "read but not change", which leaves the verb hanging. "Anyone",
  never "anybody", as "someone" over "somebody".
- **18 Oct 2026. A sentence that ends on a name the host typed (sc-2251, #2550,
  `rolesScreen.describeCustom`, `describeCustomReadOnly` and every line like them).** The
  name goes where the sentence wants it, at the end as well, so "Made by {{name}}." stays. A
  name that carries its own full stop, such as "Galas Ltd." or a guest's "Jr.", gets a second
  one from the string ("… Ltd.."). As in print, only the name's stop should show. Dropping
  the string's own stop is the renderer's job, for every value on web, in the app and in what
  the API renders: sc-2573, filed from #2562. A value that ends in ".", "!", "?" or "…" takes
  no full stop from the string after it. Any other character after the value stays, as print
  keeps an abbreviation's stop before it ("Galas Ltd., Lagos"). Until sc-2573 lands the
  doubled stop shows, and no line is reworded to avoid it. Won over putting the name
  first ("{{name}} made this role."), which fixes one line of eight and the next string not at
  all, and in es, fr and pt often leaves a participle or adjective to agree with a name of
  unknown gender. Also won over quoting the name, which reads as if the name were in doubt.
- **18 Oct 2026. Verifying an alternative from Account (sc-2304, sc-2244, `VerifyEmail-*` and
  `VerifyPhone-*` with `from` = `account`, `Account-*` `verified_alt`).** Settled as ux drew
  it. The headings are sign-up's "Email verified" and "Number verified". The body: "{{address}}
  is verified. It stays an alternative address until you make it primary in Account." and
  "{{number}} is verified. It stays an alternative number until you make it primary in
  Account."; when verifying makes the number primary (sc-2244), "{{number}} is verified and is
  now your primary number.", the shape of `contacts.promotedPhone`. Account's done line is the
  short "{{address}} is verified." / "{{number}} is verified.", because the person has just
  read the long one. The way out is "Back to Account", on the top link and the button alike;
  the link's arrow is the component's icon, hidden from screen readers, never a character in
  the string. "Not your address?" and "Wrong number?" link to "Remove it in Account", the
  shape of "Wrong number? Change it". An address and a number are always two keys, never one
  key with the noun in a slot: "it" and "verified" agree with the noun in es and fr
  (dirección and adresse are feminine, número and numéro masculine). "Alternative" won over
  "other", the card's plural ("Other addresses can reach you"), because "an other address" is
  not English and "one of your other addresses" is wrong when there is only one; and over
  "secondary" or "backup", which rank it or promise it can recover the account.
- **18 Oct 2026. A role's line for a viewer who cannot edit roles (sc-2251,
  `rolesScreen.describeSeededReadOnly`, `describeCustomReadOnly`).** Shown to anyone without
  `members.manage`. Seeded: "Built in, so it cannot be removed. Someone who can change
  {{area}} decides what it holds.", where `{{area}}` is the grid's own label for the members
  area, so it reads "… change Members and roles …". Custom: "Made by {{name}}.", `{{name}}`
  the organisation. Neither line names an action the screen has hidden. Won over the drawn
  "Someone who can manage roles", because the screen never says "manage" and the viewer
  cannot find it on the grid. The grid calls it Members and roles at Change, and the locked
  row already says "someone who can change {{area}}". The area is a slot, never typed into
  the string, so the line cannot drift if the label is renamed.
- **18 Oct 2026. The re-proof's step two after a provider sign-in (sc-2197, `Security-*`
  `reproof_code`).** The status box reads "Signed in with {{provider}}", and the address that
  provider vouched for goes alone on a second line. Neither line takes a full stop. Under the
  code field: "A wrong code doesn't send you back to {{provider}}. Your {{provider}} sign-in
  lasts {{count}} minutes.", and the `_one` form ends "… lasts a minute.". `{{count}}` is the
  proof window, as in `waysCard.proofExpired_*`. "Lasts" won over the drawn "counts for",
  an idiom that does not carry into es, fr or pt, and "Your {{provider}} sign-in lasts" pairs
  with the expired line, "Your {{provider}} sign-in was more than {{count}} minutes ago". The
  provider is named again rather than "your sign-in there", because every other language needs
  a noun to point back to. The contraction stays because this is a hint, not an error.
  Step one's `waysCard.proveLink` and `proveUnlink` count the same window: "… You won't be
  asked again for {{count}} minutes.", and the `_one` form ends "… for a minute.", so no
  locale keeps a literal 5 (pm folded them into sc-2197, #2280).

- **18 Oct 2026. The Roles refusals (sc-66, sc-2150, `messages:roles.*`).** Error bodies
  take no contractions: "Owner is built in and cannot be changed or removed. It always has
  everything." ("changed", not "edited", as the screen's grid says "change"). A built-in role
  says what is still allowed: "Built-in roles cannot be renamed. You can still change what this
  one holds." and "Built-in roles cannot be removed, but you can change what they hold. If
  nobody needs this one, leave it unassigned." "Someone", not "somebody", as in the locked row.
  An unknown permission is a stale page: "Soirely has no permission by that name. Reload the
  page and try again." Over the limit, the house phrase "Shorten the name to {count}
  characters or fewer." is wanted over "That is longer than {count} characters.", which says
  what is wrong but not what to do; the API test pins the old text, so that change waits on
  [dev] (sc-2150, PR #187). Translate it in the wanted shape. The Roles screen's own check,
  `web:rolesScreen.nameTooLong`, says the same: "Shorten the name to {{most}} characters or
  fewer.", replacing "Keep the name to {{most}} characters."
- **18 Oct 2026. Primary and other addresses (sc-113, `contacts.*`, `Account-*`).** The
  primary signs in; any other address or number only reaches the person: "Other addresses can
  reach you, but they cannot sign you in." / "Other numbers can reach you too." Never write a
  line that implies a verified alternative will sign in or get account mail: the add hint is
  "We email a code to prove it is yours. Until then it stays unverified." (the phone's says
  "We text"). The cap reads the same in the card and from the server: "An account holds
  {{most}} email addresses. Remove one to add another." Done line: "{{address}} has been
  removed." Won over "only reaches you", which reads as "reaches only you", and over "You can
  link", which states the cap as a permission rather than a rule.
- **18 Oct 2026. A grid row the viewer cannot change (sc-66, `Roles-*` v30, `caller_limited`).**
  Under the locked row: "Only someone who can change {{area}} can set this. It stays as it is
  when you save." The inset above the grid, plural on `{{count}}` locked areas: "You can change
  only what your role, {{role}}, holds. {{areas}} stays as it is when you save." / "… {{areas}}
  stay as they are when you save." `{{areas}}` comes from `Intl.ListFormat` (conjunction) in
  the reader's locale, from the grid's own area labels. Won over the drawn "A save leaves it as
  it is" and "saving leaves it alone", because "a save" as a noun and "leave it alone" do not
  carry into es, fr or pt, and over "your own role". The row and the inset close on the same
  sentence, so they say the same thing the same way; the verb agrees with the list, so the
  inset is a plural pair, never one key.
- **18 Oct 2026. A cost line's rate or amount, too many decimals (sc-83, `CostLine`).** Two
  keys, one per field label: "That has too many decimal places for this event's currency.
  Enter the rate like {{example}}." on a rated line, and "… Enter the amount like
  {{example}}." on a `fixed` line, whose field is labelled Amount. `{{example}}` as sc-88's,
  at the currency's minor unit ("12" for JPY, "12.50" for GBP, "12.500" for KWD). Won over
  "rate" on every line, because a refusal names the field the person is looking at (as
  sc-90's "Enter the ceiling like", and sc-88's "Enter the amount in {{currency}}"), and over
  one key with the field as a slot, because "rate" and "amount" take different articles and
  genders in es, fr and pt, so a slot would leave them no way to agree.
- **18 Oct 2026. The budget ceiling's form and warnings (sc-90, `Ceiling`).** Too many
  decimals, one key for every currency: "That has too many decimal places for this event's
  currency. Enter the ceiling like {{example}}.", with `{{example}}` built as sc-88's (from
  20000, or 20000.5 when the currency has a minor unit: "20,000" for JPY, "20,000.50" for GBP,
  "20,000.500" for KWD). Not a number: "Enter the ceiling as a number, like {{example}}."
  Below 0: "The ceiling cannot be below 0. Enter 0 or more." Another currency: "Enter the
  ceiling in {{currency}}, the currency this event uses." (sc-88's shape). Announced on Save:
  "One field needs fixing, so nothing was sent." / "{{count}} fields need fixing, so nothing
  was sent." (plural keys). Saved: "Ceiling saved." The rate-edit warning names the ceiling:
  "{{rate}} takes the event over its ceiling." or "{{rate}} takes {{category}} over its
  ceiling.", then "Settled, it would be {{total}} against {{ceiling}}. You can still save it."
  or "If everyone comes, it would be {{total}} against {{ceiling}}. You can still save it."
  The four state words stay as drawn (Within, Close, Over if all come, Over); sentences say
  "if everyone comes", never "if everybody still to answer says yes". Won over the drawn
  "British pounds use at most 2 decimal places", which puts a currency's plural name into
  prose (agreement in es, fr and pt), needs a sentence per decimal count, and breaks sc-88's
  rule that the example shows the rule and the words never name a decimal count; and over
  "Settled would be", which is not a sentence. "Close" is a state word, not the dialog's
  close button: its own key.
- **17 Oct 2026. "A device that has not signed in to your Soirely account before has just
  signed in."** (`emails:newDevice.body`). Won over "Your Soirely account was signed in to on
  a device it hasn't seen before": "signed in to on" stacks two prepositions, and an account
  does not "see" devices. The device is the subject, so each locale can keep one plain verb.
  The next lines give the time, the device and the address, so the sentence names none of them.
- **17 Oct 2026. Share-link passphrase (sc-94, `ShareLinks`, `SharedBudget-*`).** "Make the
  passphrase at least {{count}} characters long, or leave it empty."; over the limit, "Shorten
  the passphrase to {{count}} characters or fewer."; locked, "Too many wrong passphrases have
  been tried on this link. Try again at {{time}}.", and without a usable `Retry-After`, "… Wait
  a moment, then try again." "At", not the drawn "after", because every lock-out in the product
  says "Try again at {{time}}". The organiser's note reads "While any line has a client price,
  it shows no payments either.": "while", not "once", because payments come back when the event
  returns to all at cost.
- **17 Oct 2026. Attendance not recorded (sc-89, `PlannedActual`).** "Attendance was not
  recorded"; "Nobody was checked in at the door, so there is no count of who came and no cost
  per head. {{amount}} was paid to vendors."; "Check guests in at the door next time, and this
  will show the cost per head of those who came." "Cost per head" is the page's term. The
  drawn "what each guest who came really cost" was rejected, because "really" casts doubt on
  the other figures.
- **17 Oct 2026. Vendor form (sc-82, `Vendors`).** The phone reuses the account's settled hint
  (`verifyPhone.numberHelp`) and its too-short and too-long keys. Only the invalid key is new,
  "That is not a phone number for {{country}}. Check it and try again.", because a vendor's
  number may be a landline. Website hint: "You can leave off https://. It is added when you
  save."; other scheme: "Enter a web address that starts with https:// or http://, or leave
  that part off." Blank: "Enter the vendor's name.", "Choose the category." Limits take the
  house "Shorten the {field} to {{count}} characters or fewer.", and email shape reuses
  `forms.emailShape`. Reuse a settled key wherever the same component says the same thing.

- **17 Oct 2026. "That does not look like an email address. Check it has an @ and a domain."**
  (`orgGeneral.contactInvalid` and `forms.emailShape`, web and app, and the API's
  `validation.contact_address_invalid`; sc-1585). The house rule: no contractions in an error body.
  Kept "look like" over "That is not an email address", which is blunter and reads as an accusation.
  The web keys are pinned by tests, so that half is with [dev2] on sc-1585.
- **17 Oct 2026. Dates on screens follow the locale (CLDR), the owner's call (sc-87,
  #1700).** `{{date}}` and every date a screen shows come from `Intl.DateTimeFormat` with the
  reader's locale, in the event's time zone: en-GB "Tuesday 23 September", en-US "Tuesday,
  Sep 23". Boards are drawn in en-US and say the format follows the locale. Never write a
  date, or its order, into a string. Rejected: one house style for every locale.
- **17 Oct 2026. Quotes: added, revised and corrected (sc-87, `Quote-*`).** Saved lines, each
  one string with slots, never parts joined in code: "Quote added: {{vendor}}, {{amount}},
  quoted on {{date}}."; "Quote revised: {{vendor}}, {{amount}}, quoted on {{date}}." with
  "The earlier quote is kept under Show the earlier quote." under it; "Quote corrected:
  {{vendor}}, quote {{reference}}." and, with no quote number, its own key "Quote corrected:
  {{vendor}}." (never "no quote number" in the slot), with "The amount, the date quoted and the
  schedule are unchanged." under it. Live announcements: "Quote added.", "Quote revised.",
  "Quote corrected." Correct form intro: "Correct what this quote covers, its quote number or
  its budget lines. No earlier version is kept. To change the amount or the date quoted,
  revise the quote, which keeps this one as an earlier quote." "Quoted on", not the bare
  "quoted {{date}}": es, fr and pt need the preposition anyway. The intro says what the form
  does first, with no colon-led list, which reads badly in a screen reader.
- **17 Oct 2026. Quote and payment refusals (sc-87, `Quote-*`, `Engagement-*`).** Revise with
  the amount and the date quoted unchanged, on the form and as the server's detail under one
  key: "Change the amount or the date quoted to revise this quote. To change anything else,
  correct the quote instead." (it sends nothing, so not "was not saved"). "The date quoted
  cannot be in the future. Choose today or an earlier date."; "The date due cannot be before
  the quote from {{vendor}} on {{date}}. Choose that date or a later one." (sc-88's date-paid
  shape); "{{line}} is already agreed in the quote from {{vendor}}, so this quote was not
  saved. Untick it in that quote first.", and the row that cannot be ticked reads "Agreed in
  the quote from {{vendor}}"; "That vendor is no longer one of this organisation's vendors,
  so the quote was not saved." (never echoes a name, because a vendor id from another
  organisation must not read back that vendor's name); "Quotes and payment schedules are
  read-only on this organisation's plan, so nothing has changed." Form checks: "Choose the
  vendor."; "Enter what the quote covers."; "Enter the date quoted."; "Enter what the
  payment is for." ("the payment", not "it": the message is read away from its label);
  "Enter the date due."; "Shorten what the quote covers to {{count}} characters or fewer.",
  and the same for the quote number and "what the payment is for". The amount and currency
  checks are sc-88's shared keys.

- **17 Oct 2026. Adding a payment already made (sc-88, `AddPaid-*`).** Title "Add a payment
  already made", button "Add as paid", kept as drawn: the title says what the person did, the
  button what happens. Refusals: "Choose the vendor it was paid to."; "Enter what it was
  for."; "Shorten the description to {{count}} characters or fewer." (the house over-limit
  shape; "description" because the field is the payment's description everywhere else it
  shows); and "The date paid cannot be before the quote from {{vendor}} on {{date}}. Choose
  that date or a later one." (also the server's detail for sc-87's payment dated before the
  quote). Won over the drawn "before Bloom Lagos's quote of Monday, Sep 1": a possessive on a
  name breaks on names ending in s and cannot be carried into es, fr or pt, and it said what
  was wrong but not what to do. `{{date}}` comes from `Intl.DateTimeFormat` in the event's
  time zone; in en-GB that reads "Monday 1 September", never "Monday, Sep 1".
- **17 Oct 2026. "Shorten the reference to {{count}} characters or fewer."** (sc-88,
  Reference, refused on Mark paid at 101 after trimming). The house shape for a text field
  over its limit: "Shorten the {field} to {{count}} characters or fewer.", so the cancel
  reason (200) reads the same. The limit is a `{{count}}` slot, not a number in the words, so
  the copy cannot drift from the rule. Won over "The reference can be at most 100
  characters", which states the rule without saying what to do, and over "Reference is too
  long", which says neither the limit nor the fix.
- **17 Oct 2026. "Enter the amount as a number above 0, like {{example}}."** (sc-88, Amount
  paid). One message for every currency, with one slot. The code builds `{{example}}` with
  `Intl.NumberFormat` in the viewer's locale at the event currency's ISO 4217 minor unit, from
  3500 when it has none and 3500.5 otherwise: "3,500" for JPY, XOF and CLP, "3,500.50" for GBP, EUR, USD and BRL, "3,500.500" for
  KWD and BHD, and "3.500,50" in es, fr and pt. No currency symbol: the field shows it as its
  prefix. Won over a variant per decimal count, which is three keys in four locales for one
  rule and makes the person count decimal places, and over the drawn "like 3,500 or
  3,500.50", which promises decimals a zero-decimal currency refuses and writes a number into
  the string. The example shows the rule; the words never name a decimal count.
- **17 Oct 2026. Marking paid refused (sc-88, shown on sc-1331's "Due now" sheet).**
  "{{name}} has already marked this paid, so nothing has changed." (no name: "This has already
  been marked paid, so nothing has changed."); "This payment has been cancelled, so it cannot be
  marked paid."; "Enter the amount in {{currency}}, the currency this event uses."; "The date paid
  cannot be in the future. Choose today or an earlier date."; "Payments cannot be marked paid on
  this organisation's plan, so nothing has changed." Won over "… a moment ago", which the server
  cannot know. "So nothing has changed" is the house close for a refused change. Never ask for
  an upgrade in a refusal.
- **17 Oct 2026. "From the reminder sent {{date}} · {{payments}} across {{count}} events"**
  (sc-1331 subline). Two counts take two plural keys, and the one-event form drops "across 1
  event". "1 payment" keeps its numeral because it is a count line, not prose.
- **17 Oct 2026. "Your {{provider}} sign-in was more than {{count}} minutes ago, so nothing
  has changed yet. Continue with {{provider}} again to carry on."** (`waysCard.proofExpired_*`,
  web and mobile). A past sign-in is something that "was … ago", not something "… old".
  "Nothing has changed yet" says the requested change is still waiting, not lost. The `_one`
  form reads "more than a minute ago". Asked on sc-510; the keys are with [dev].
- **17 Oct 2026. "Your other device is signed out." / "Your {{count}} other devices are signed out."**
  (`web:devices.everywhereDone_*`, matching `passwordCard.done_*`). A `_one` form names no
  number: "your 1 other device" reads as a machine wrote it. The same goes for
  `devices.everywhereBody_one`. The slot parity guard compares a key across all four
  catalogues, so dropping `{{count}}` from a `_one` form is a [dev] change to all four at once
  (asked on sc-1193).
- **17 Oct 2026. "Asks you to confirm it is you first."** (`web:devices.everywhereHint`). Won
  over "Asks for your password first", which is untrue for an account that signs in only with
  Google or Apple. Name the act of confirming, not the factor, wherever the factor varies.
  The key changes with its test, so it is with [dev] on sc-1193.
- **17 Oct 2026. "Every other device has been signed out."** (`emails:password.changed.devices`,
  and `recovery.changed.body` already uses it). Won over "Your other devices have been signed
  out", which assumes there were some: the email goes even when none were signed in.
- **17 Oct 2026. "… so first check that nobody is using it at an event."** (`web:devices.signInAgain`).
  Won over "check it is not in the middle of an event": a person is at an event, not a device,
  and "in the middle of" does not translate cleanly.
- **17 Oct 2026. "was {{name}}" for a time zone's former name** (`timeZone.was`,
  `timeZone.countryWas`: "India · was Calcutta"). Kept over "formerly", which is clearer but
  nearly three times as long on a phone row that already carries the country. Each locale
  writes its own natural word (es/pt "antes", fr "anciennement"); the name is always the slot.
- **17 Oct 2026. "Choose the country code, then type the number any way you like."**
  (`verifyPhone.numberHelp`). Settled as written by PM on sc-945; it is true for every way the
  code can start, and es/pt already read naturally from it.
- **27 Oct 2026. Delivery states and reasons for a message to guests** (sc-3942, settled on
  pm's #15426). The field is **Message**, not "Body". Over a limit, the house sentence with the
  limit as a slot: "Shorten the subject to {{count}} characters or fewer." and "Shorten the
  message to {{count}} characters or fewer."; the slot is formatted with `Intl` ("10,000"),
  never written in. An empty choice reads "Choose at least one guest.", the picker's own verb.
  A spam complaint is the state **Reported as spam**, beside Sent, Delivered, Bounced and Not
  sent; never "Complained", and never a reason under Bounced. A later send skipped for it
  (`complained`) reads "Reported an earlier email as spam", reusing the state's verb so the
  host connects the two. Won over "… from this organisation …", which every reason the host
  sees already implies and which overruns a phone row. Other skip reasons read as short
  phrases in the same row: "No email address", "Address is bouncing".
