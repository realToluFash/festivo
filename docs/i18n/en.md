# English at Soirely

Kept by `/soirely-linguist`. Read it before writing a string in English, and add to it
whenever you decide something a second string will need.

## Variant and register

British English (en-GB). Plain, warm and direct. No contractions in error bodies: "cannot",
not "can't". British spelling: organisation, cancelled, colour. Sentence case for every
label and heading. No serial comma: "Ana, Ben and Cleo". Join a list through `listFormat`
from `@soirely/domain`, never `new Intl.ListFormat(locale)`.

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
| Passkey                              | Settled 24 Nov 2026 (sc-86976): "passkey", lower case in running text, one word. Its factors are "passkeys" and "authenticator app"; together they are "two-factor methods". Removing either is "remove".                                                    |
| Carry on                             | Settled 17 Oct 2026: "… to carry on" is the house phrase for resuming (20 strings). Not "continue", which is the button.                                                                                                                                     |
| Signed out (a device)                | Settled 17 Oct 2026: "is signed out" for the state, "has been signed out" in emails. Never "logged out".                                                                                                                                                     |
| Phone number, mobile number          | Settled 18 Oct 2026: "phone number" for any number on the account (card, list, add button, cap), which may be a landline; "mobile number" only for the field we text a code to (`contacts.phoneLabel`, `verifyPhone.numberLabel`).                           |
| Alternative (address, number)        | Settled 18 Oct 2026: any address or number on the account that is not primary, verified or not. The card's plural is "Other addresses" / "Other numbers"; one of them is "an alternative address" or "an alternative number". Never "secondary" or "backup". |
| Schedule                             | Settled 19 Oct 2026 (epic 33, sc-3895 #4106): the list the organiser builds, and its page. Never "agenda", "itinerary" or "running order".                                                                                                                   |
| Run of show                          | Settled 19 Oct 2026: the screen for running the event on the day, app and web, the web switch included. Never a bare "Run".                                                                                                                                  |
| Now, Next, Later                     | Settled 19 Oct 2026: Run of show's cards and list, and the cue screen's "Later". "Later" replaced the drawn "Then". Own keys, never a stepper's "Next".                                                                                                      |
| Done, Skip, Start now                | Settled 19 Oct 2026: finishing, skipping and starting an item. States in a list: "Done", "Skipped", "Not started". "Done" is its own key, not the app's `close`. Screen readers: "Done: {{title}}".                                                          |
| Move, Move after this                | Settled 19 Oct 2026: moving an item (sc-3894). "Move after this" replaced "Place after", because "Place" is the noun on the same page.                                                                                                                       |
| Place (a track)                      | Settled 19 Oct 2026: where an item happens. "Track" stays internal; never "venue", "room" or "stage".                                                                                                                                                        |
| Show to guests, Fixed time           | Settled 19 Oct 2026: the schedule item form's switches.                                                                                                                                                                                                      |
| Your cues, You're on, You're up next | Settled 19 Oct 2026 (sc-3896): "Your cues, {{name}}" with the full name; "You're on" only while the cue runs, "You're up next" before.                                                                                                                       |
| Coming up                            | Settled 19 Oct 2026: the room screen's heading (sc-3897). "Times as of {{time}}" when offline, time from Intl. Widened 27 Oct 2026 (sc-15756) to Event View's panel of an event's next dates.                                                                |
| All dates (an event's dates)         | Settled 27 Oct 2026 (sc-3624 #16015): the screen of every date on an event, /app/events/<id>/dates. Replaced "Full schedule", which clashed with Schedule. "Loading the dates…", "The dates did not load." es, fr, pt: a calendar of dates, not Schedule.    |
| Passed, Next up, Overdue             | 27 Oct 2026 (sc-15756): a date's standing on All dates. Owners: "Event", "You", "Automatic".                                                                                                                                                                 |
| The day, Programme                   | Settled 19 Oct 2026 (sc-3899): the guest page heading, "The day" for one day, "Programme" when items span several days.                                                                                                                                      |
| That's everything                    | Settled 19 Oct 2026: the end of the run of show, then "Finished {{count}} min behind plan.", "… ahead of plan." or "Finished on plan.", three whole keys. Replaced "That's the whole night".                                                                 |
| Try again (button)                   | Settled 1 Nov 2026, sc-26974: every button that runs a failed request again, web and app. The sending form is "Trying again…".                                                                                                                               |
| Owner / Admin / Member               | Settled 5 Nov 2026 (sc-29914, sc-29915, sc-29912): the organisation's three roles, on every surface. Running text says "an admin", "owners and admins". Replaces "Administrator", the retired seeded role; the stored value stays `administrator`.           |

## Never translated

- Soirely
- A person's name or title: Chief, Alhaji, Dr., Mrs.

## Decided phrasings

- **24 Nov 2026. The apostrophe** (sc-89577 #89774, sc-89866 #89870). On every screen, on the web and in the app, an English apostrophe is the typographic ’ (U+2019), never the straight ' (U+0027), as the Unicode Standard prefers for an apostrophe in text. A string is never written with both. The emails keep the straight one, as every line in `emails.en.json` (21 Oct). About 68 web and 53 app strings still carry ' (events, owner claims, the calendar feed, event deletion, `passwordCard.setCodeIntro`, the rest of `waysCard` and `membersScreen`). Most are pinned by their tests, so they move with the tests in a developer's story, one per epic, not in a translation ticket; a string rewritten for any other reason takes ’ in the same change. es, fr and pt follow their own guides.
- **24 Nov 2026. Door codes on the web: People's card and the redeem page** (sc-79697 for sc-72, `web:doorCodes.*`, `web:redeem.*`). Kept as sc-72 built it, except `noneLine`: it said each person gives "their name and mobile number", and the redeem page asks a name and nothing else until sc-4235, so it says "their full name". Two more wait on [dev], because `Redeem.test.tsx` pins them: `memberTitle` refuses, so it should read "You are already a member of {{organisation}}", like `join.refused.invitation_accepted.line` and `door_codes.member`; `endsLine` should be "Your access ends when the event does.", like `eventPeople`'s "Their access ends when the event does.", not "concludes". es, fr and pt are written to that meaning already. `line.refused` and `refused` are `door_codes.invalid`'s sentence, and `capBlank`, `capRange`, `past` and `failMake` are `door_codes.*`'s, word for word. `{{until}}`, `{{at}}` and `{{when}}` are a 24-hour time, with a short day before it whenever that is not today, so a locale writes them after a colon or with a preposition that reads before either. `Esc` is the key's label: fr writes it "Échap" as AZERTY keyboards do; es and pt keep "Esc". "You’re in" and "You’ll be signed out" keep their contractions: neither is an error body.
- **24 Nov 2026. Two-factor with a passkey on the web** (sc-86976 for sc-86885, `web:passkey.*`, `twoFactor.lost*`, `lostTwoFactor.start*`, `emails:twoFactor.added|removed|factor.*`, the `*Passkeys`/`*PasskeysApp` recovery emails). Kept as sc-86885 built it, with the wording settled on sc-86885 #87308 and #87333 and sc-86888 #86965. The lost-two-factor lines name the factors the person has: app only as before, passkeys only, or passkeys and the authenticator. "Confirm it’s you" and "This browser can’t use passkeys." keep their contractions: neither is an error body, and tests pin both. `{factor}` in the added and removed emails opens the sentence ("A passkey in {provider}"), so each locale writes it capitalised and agrees the verb with it.
- **23 Nov 2026. The guest's page on the event's day: Your code and Where** (sc-84598 for sc-24381, `web:guest.yourCode|where`). Kept as sc-24381 built it: `Invitation.test.tsx` pins both headings by name. "Your code" heads the door-code card, so it stays the guest's code, never a **door code** (the crew's, sc-72). "Where" heads the start time, venue, address and Open in maps; the time is there to get the guest moving, so the heading names the place, not "When and where".
- **22 Nov 2026. The guest's door code and scanning it at the door** (sc-80603 for sc-1301, `web:guest.door*`, `mobile:checkIn.scan.*`, `mobile:locales ios.NSCameraUsageDescription`). Kept as sc-1301 built it: `Invitation.test.tsx` pins the guest page's block and `ScanModel.test.ts` the offline strip. What the guest shows is "your code for the door", never a **door code**, which is the crew's sign-in code (sc-72); es, fr and pt keep the two apart. A code is **scanned** ("Scan a code"). A held companion at the door is "Held · until their host is coming", as the app's demo says, the same state as `guestList.heldLine`. **Settings** in `cameraOffBody` and `openSettings` is the device's own app: es and pt name it as iOS and Android do (Ajustes, Definições); fr says "les réglages de l’appareil", since iOS says Réglages and Android Paramètres. The strip's `{{time}}` is Intl's 24-hour time with no article before it. `doorLine` has no plural and shows for one companion or several, so it must not count; "your companions" fails at one (qa5, #84852). The number-neutral English, "It lets you and anyone coming with you in.", waits on [dev] to move the pins in `Invitation.test.tsx` and `demo/guest.test.ts` with it.
- **22 Nov 2026. See picks: the host sees the picks and chooses for a guest** (sc-4042 for sc-3909, `web:seePicks.*`). Kept as sc-3909 built it: `SeePicksArea.test.tsx` and the demo's `kitchenParts.test.ts` pin the header, the counts-only line, the permission lines, "1 pick · 25% of the room" and "You still can choose for any guest." (the word order reads better as "You can still choose", asked of [dev] on sc-3909). **Needs the host** is the state for people nothing can be decided for until the host steps in, and **Kitchen’s choice** the state of a guest who let the kitchen choose; both are names, capitalised in running text, and the kitchen sheet (sc-3911) will reuse them. **The room** is everyone coming, the denominator of every share ("50% of the room"); a place held for an unnamed companion is outside it. The permissions are named as the role editor names them, **Guests read** and **Guests manage**. The host's override is recorded against the guest's **record**, their needs as noted. `refused` and `noSkip` keep "can’t" while the test pins them. `{{allergens}}` arrives joined by Intl's conjunction from `guestNeeds.allergen.*`, capitalised, so es, fr and pt put it after a colon. `{{names}}` (`whoOverride`, `overrideWhoTitle`) and `{{courses}}` (`notChosenOn`) arrive joined with a bare comma in code, and the dialogs use first names: both asked of [dev] on sc-3909.
- **22 Nov 2026. A guest picks a meal for each person coming** (sc-4042 for sc-3907, `web:guestMeal.*`). Kept as dev2 built it: `Invitation.test.tsx` and the demo's `MealParty.test.tsx` pin the reason lines, contractions included ("hasn’t said … can’t be picked", "isn’t checked"), so they stay until a [dev] change moves the tests. A guest's pick of a **variant** is "way" on the guest page only; the host's screens keep "variant", and es, fr and pt say variante on both. The code lower-cases {{course}} wherever it sits inside a sentence (`which`, `noCourse`, `skipped`, `choose*`, `change*`), so es, fr and pt join it with a preposition and no article or quote: es and pt "de {{course}}", fr "en {{course}}" ("Rien en {{course}} pour moi", never "Pas de", which would need d’ before a vowel). `refusedClosed`, `progress` and `legend*` take the name as typed, so es and pt quote it there, as `eventMenu.picksClosedCourse` does. "The host" is generic on the guest page: el anfitrión, l’hôte, o anfitrião. {{hosts}} gets no agreeing verb ("This is what {{hosts}} will get" is written as "what will be sent to {{hosts}}"). In French a {{name}} never follows "de", since a name starting with a vowel would need d’: "Plats pour {{name}}", "Pour {{name}}, l’allergie (…)".
- **21 Nov 2026. Staff rates: the page, a rate, own rates and the Budget's Staff line** (sc-79848 for sc-101, `web:staffRates.*`, `validation.staff_pay_*|staff_rate_*|staff_fee_*`). Settled as sc-101 built them: `StaffRatesArea.test.tsx` and the demo pin the English. A job's or a person's **rate** is by the hour; a **flat fee** is for the event, once for each person, however many shifts they work. The page is **Staff rates**, named as it is on the Budget's Staff line. A **place** is one person's room on a shift, "filled" or "not filled yet", as Jobs and shifts says. The permission is named **Manage the budget**, capitalised as a name. `{{names}}` in `notCounted`, `keepOwn` and `oncePaid` arrives joined by Intl's conjunction, so each locale writes the list as one subject or after a colon. The web's checks are the API's refusals word for word.
- **21 Nov 2026. Door codes: making, stopping and redeeming one, and its audit lines** (sc-79291 for sc-72, `messages:door_codes.*`, `errors:door_code_invalid`, `audit.what.door_code.*`, `audit.field.useCap|expiresAt|stoppedAt|signedIn`). A **door code** is the one name on both sides, the host's and the crew's; es, fr and pt say "código de acceso", "code d’accès" and "código de acesso". `expiry_past` and `member` refuse, so they now read "has not" and "You are". `door_codes.invalid` and `errors:door_code_invalid` keep "doesn’t" for now: `DoorCodesTest.php` pins it, and "That code does not work. Check it with whoever gave it to you." is asked of [dev] on sc-72. `too_many`'s {when} arrives as an ISO timestamp (`DATE_ATOM`), not the full instant the other limits state, also asked of [dev]; the locales write it as `limits.join_requests` does, for the full instant. 500 is typed into `use_cap_range`, which needs no grouping in any locale.
- **20 Nov 2026. Payment reminders: the message, its overdue last reminder and the Settings card** (sc-76423 for sc-95, `payment_reminder.*`, `audit.what.organisation.payment_reminders_changed`, `audit.field.paymentReminderDays`, `validation.payment_reminder_days`, `web:paymentReminders.*`). The message, the card and the "then silence" summary are kept as dev built them: `PaymentRemindersTest.php`, `PaymentReminders.test.tsx` and the demo pin them. The audit field now reads as the Settings field does, "Days before a payment is due", and the action is "Changed when payment reminders go out for {target}". The title is the push line and the email subject, so each locale keeps the count first.
- **20 Nov 2026. Marking a payment paid, cancelling one and adding one already made, and the Budget card's due line** (sc-75129 for sc-88, `web:quotes.card*|markPaid|datePaid*|paidLine*|markedPaid|already*|cancel*|restore|noLongerChased|addAsPaid|addedBy*|deleted|…`, the API's `payments.*`, `validation.payment_paid_*|payment_reference_*|payment_reason_*|payment_made_*`, `errors:payment_already_paid|payment_cancelled`). Kept as settled in sc-88 #75117; the API's blank-date line now reads "Enter the date it was paid.", as the web does. `noCostsToAgree` ("the quote agrees none") reads stiffly but `BudgetArea.test.tsx` and the demo pin it, so a rewording is a `[dev]` change. The card lines get `{{what}}` lower-cased, as `wasDue` does, so es, fr and pt open on a noun of their own and put it after a colon. Undo deletes a payment added as already paid, which `addedBy*` says outright.
- **20 Nov 2026. A price's margin on the Budget page: Cost, Charged at, the below-cost advice and the markup refusals** (sc-30767 for sc-92, `web:budget.margin.*`, the API's `validation.budget_markup_*|budget_client_price_*`). Kept as dev4 built it in #3156; `BudgetArea.test.tsx` and `budgetMargin.test.ts` pin the words. **Markup** is a share of cost added on top; **margin** is a share of the client price, and the two never stand in for each other (`dialog.note` says so with numbers). A cost row reads "Cost {{cost}} · Charged at {{charged}} · {{how}}", `how.*` lower-case after the middot. "at cost, chosen" (a markup of 0 someone set) must read apart from "no markup set" (nothing set anywhere): es, fr and pt say the choice outright ("por elección", "par choix", "por opção"). The Enterprise chip and the who-sees chip are `nowrap`, so their wording stays near the English length in every locale.
- **20 Nov 2026. Quotes and payment schedules on the Budget page, and the vendor archive refusal** (sc-73977 for sc-87, `web:quotes.*`, `web:vendors.usedOn_*|archiveRefused|owingLink`, the API's `validation.quote_*|payment_*|money_*`, `quotes.vendor_already_quoted|revision_unchanged`, `vendors.archive_refused`, `errors:vendor_already_quoted|quote_unchanged|vendor_owed`). Kept as dev1 built it in #3180 and #3181: every string is the 7 Nov and 17 Oct sc-87 entries below, word for word. `wasDue` gets the payment's description lower-cased by the code ("The deposit, …"), so es, fr and pt open on a noun of their own and put `{{what}}` after a colon rather than agree with it. "Due next" heads the card's next payments and "Everything due" the sheet of all unpaid ones; "Overdue" is `timeline.overdue`'s word.
- **20 Nov 2026. The audit log's Changes row** (sc-74730 for sc-611, the API's `audit.field.*` and `audit.value.*` in `messages+intl-icu`). Kept as dev1 built it: `AuditLogTest.php` pins the row. A row reads "Field: before → after", so each value is a bare word that fits after a colon with no sentence around it. The access levels and member states are the words the People and Members screens already show; "Left or removed" is one state for both, a person no longer in the organisation. "None" is a role since deleted, or an empty value. Free and Enterprise are the plans, Enterprise never translated.
- **19 Nov 2026. The audit log, its action words, its export and the export-ready email** (sc-73564 for sc-611, `web:auditLog.*`, `web:dataControl.auditLine|lockedLine|leftLine`, `mobile:auditLog.*`, `mobile:dataAndControl.rows.audit*`, the API's `audit.*` in `messages` and `messages+intl-icu`, `emails:auditExportReady.*`). Kept as dev1 built it: `AuditLog.test.tsx`, `auditLog.test.ts`, the demo tests and `AuditLogTest.php` pin the page, the filters, the export dialog, the action words and the email. **Audit log** is the page's name and a feature, and one entry is **an entry**; the six types are named the same in the filter, the detail and the export file. Each action word is a past-tense verb with no subject, since Who is its own column ("Created {target}"), or names {target} as the subject when they acted themselves ("{target} left"). {target} falls back to `audit.unnamed`, so a line must read with it. `web:auditLog.exportLine|tooMany` and `messages:audit.export_too_many` type 10,000 and 1,000,000 into the string, while the app formats them through a slot: a [dev] question on sc-611, and meanwhile each locale writes the number as its `Intl` does. `preparingLine`'s "We’ll" and the footer's "You're getting this" keep their contractions: they explain, they refuse nothing.
- **19 Nov 2026. The Group field's example fits a 320 px phone** (sc-73302, qa4 #73086 on sc-72530, `web:guestGroups.placeholder`). "Like Family or Work", in place of "Like Bride’s side or Work": the French, Spanish and Portuguese for a bride's side ran past the field's edge at 320 px, and Soirely's events are not all weddings. The example names two groups any host might keep. A placeholder vanishes on the first character, so it carries nothing the person needs (the 15 Nov Search rule); es, fr and pt introduce it with their short form for "for example" and keep it no wider than the English.
- **19 Nov 2026. The event's Budget page on the web** (sc-72045 for sc-85, `web:budget.*`, the API's `budget.currency_changed` and `errors:budget_line_currency_changed`). Kept as dev4 built it in #3100; `BudgetArea.test.tsx` and `budgetArea.test.ts` pin the card, the live lines and the refusals. The two figures are **settled** and **if all come**, as in Add guest; the card's range is "{{low}} to {{high}}" and `rangeLine` names them "the lower figure" and "the upper", on the one screen that shows both. A cost is **removed** and **put back** (Undo), never deleted or restored. A live line is one sentence and its consequence, "{{name}} was added in another tab, so the settled total went up by {{amount}}.", the consequence a key of its own (`live.same|up|down`) in `{{change}}`. `{{name}}` is the cost's own label, typed by the host, so es, fr and pt agree nothing with it: es opens impersonal ("Se ha añadido {{name}}"), fr and pt open on the noun, as their vendor messages do ("Coût {{name}} retiré.", "Custo {{name}} removido."). `{{facts}}` is a list of `knowsHeads|knowsTables|knowsDays` joined by Intl's conjunction list and capitalised in code, so each fact starts lower case in every locale. The count before `source.*` is a bare number ("42, said yes, from the guest list"), so each locale writes the source without a verb that agrees with it.
- **19 Nov 2026. Only our organisation, the Managed by sheet and the notice email** (sc-72486 for sc-563, `web|mobile:emailDomains.only*|card.*|onlyAsk.*|confirm*|*Says|*Line`, `web|mobile:managed.*`, `membersScreen.alsoMemberOf_*`, `emails:managedNotice.*`, `messages:email_domains.managed|only_ours_*`, `errors:domain_managed`). Kept as dev2 built it: the web, app and demo tests pin the states, the Ask and the sheet. **Only our organisation** is the switch's name, capitalised as a name in running text ("Only our organisation starts on …"); es, fr and pt quote it in a sentence, since their words for "only" read as part of the sentence otherwise. What it does is "limit {{domain}} accounts to {{organisation}}"; once on, the accounts "belong to" the organisation. "Access to a single event still works" means another organisation can still give the person access to one of its events. `only_ours_unproved` now reads "Only our organisation needs a domain this organisation has proved." (was "is for a domain"). The notice footer keeps the house contraction.

- **19 Nov 2026. What adding guests would cost, in Add guest, and the what-if refusals** (sc-71630 for sc-86, `web:decisionAnswer.*`, the API's `validation.what_if_*`). Kept as dev3 built it, with two wordings taken in #3109, together with their tests. "If all come" stays the short form beside a figure, as the state word "Over if all come"; a sentence still says "if everyone comes". `upperOnly` is in the budget's own words, "If everyone comes, it would be {{upper}}. Settled, it stays {{settled}}, because new guests have not replied.", over "the upper figure", a name the Budget page never uses; and `what_if_too_large` is "… or fewer in total.", because it also fires on the sum of several entries of one kind (dev3, #71839). es, fr and pt already say "in total". `{change}` is the raw key (guests, tables, staff_hours, days), left as it is in every locale: only an API caller reads these. Under the headline "+{{amount}} if all come", `upperOnly` carries the condition over rather than saying it again: "Once they are invited, that would make {{upper}} in total. …" (ux, #72711, sc-72857). {{upper}} is the new total, not the rise, so it stays even where the two match on a budget that starts at €0.

- **19 Nov 2026. Email domains, Data and control in the app and the two domain emails** (sc-70819 for sc-560, `web:emailDomains.*`, `web:dataControl.domain*|control|enterprise`, `web:companyDomains.proved`, `mobile:settings.dataAndControl*`, `mobile:dataAndControl.*`, `mobile:emailDomains.*`, `emails:domainListingStopped.*|domainRecordGone.*`, `messages:email_domains.*`, `errors:email_domain_taken`). Kept as dev4 built it: the web, app and API tests pin the foot, the waiting and stopped lines and the email subjects. "Prove" is what the organisation does to a domain and "Verify" is the button that checks the record now; the other locales may say both with one verb, since pressing Verify is what makes a domain proved. The footers are the approver footer word for word, contraction included. `{{when}}`, `{{at}}` and `{deadline}` are the API's full instant.
- **19 Nov 2026. Stations on an event's Staff: places, seating sections, the floor lead and the walking order** (sc-71331 for sc-3910, `web:stations.*`, the API's `messages:stations.*`). Kept as dev3 built it, `StationsArea.test.tsx`, the demo's `Stations.test.tsx`, `RosterArea.test.tsx` and `StaffPlanTest.php` pinning it. A **station** is anywhere somebody works: a **place** (the Pass, Door, Bar, Kitchen, or one the organiser adds) or a **seating section** from the seating plan. The **Pass** is the fixed place every tray starts at, a capitalised name in running text ("goes to the Pass"). A station has a **lead**; the **floor lead** leads anyone whose station has none, and is the same words as the suggested job `staff.job_suggested.floor_lead`. The **walking order** is the order of **stops** a waiter takes through the kitchen stations, the Pass first. "Places" here are locations; the slots in a shift are also "places" in English (`jobs.*`), which es, fr and pt keep apart (plazas / places / vagas against Lugares / Lieux / Locais). The tooLong pair is the jobs' sentence, "Keep the name to {{max}} characters or fewer.", in both catalogues. Not yet changed, because the tests pin it: "dishes" as a verb (`dishes`, `dishedAt`, `dishedAtLabel`, `dishesItems_*`, `walkEmpty`, `saidDished`), which the 15 Nov roster entry retired; proposed to dev3 on sc-3910 as "What each station serves", "Served from", "{{count}} dish(es)", "Every dish is served from the Pass." and "{{item}} is served from {{name}}.", items being the menu's **dishes**. es, fr and pt already say it that way.
- **19 Nov 2026. Events from outside in the org menu and the outside switcher** (sc-71337 for sc-68438, `outsideEvent.yourEvents|fromOutside|yourOrganisations|underWay|here|backTo|continue` in `web:` and `mobile:`). Kept as built. "Under way" is the row's mark while the event runs, as Run of show's "Last item under way"; es, fr and pt write it as "Happening now" is written. "Back to {{name}}" takes the organisation's or the event's name; "Continue" when there is nowhere to go back to.
- **19 Nov 2026. An outsider's event Overview** (sc-69719 for sc-71, `outsideEvent.until|guestsLine|onEvent_*` in `web:` and `mobile:`). Kept as dev1 built it. `until` closes the level line, "Guest · Bar staff · until Sat 22 Nov, 23:30", lower case after the dot, and `{{when}}` comes whole from Intl. An outsider sees guests' **names and replies only**, never their contact details. People on an event are "on this event".

- **19 Nov 2026. Data and control, Export all data and the export-ready email** (sc-67949 for sc-612, `web:settings.sectionDataAndControl`, `web:dataControl.*`, `web:exportAllData.*`, the API's `errors:export_*`, `messages:organisation.export_*|limits.organisation_export`, `emails:organisationExport.*`). Kept as dev3 built it, with one edit: `errors:export_not_ready` and `messages:organisation.export_not_ready` refuse, so "This export is not ready yet." **Data and control** is the Settings section's name and a place, so es, fr and pt translate it and keep it the same in the section list, the title and the loading lines. The export is "the export", what it downloads "the archive"; it **downloads once**, and its link "ends". `{{when}}`, `{{until}}` and `{when}`, `{deadline}` are the API's full instant ("Sunday 18 Oct at 14:52 WAT", `time.dateAt`), so a sentence puts "on" before it, or nothing after a comma. `dataControl.exportFailed` ("Didn’t finish") and `exportAllData.failedLine` ("doesn’t count toward") should read "Did not finish" and "does not count towards": `ExportAllData.test.tsx` pins both, and that waits on [dev3] on sc-612. The status lines' "we’ll" and the footer's "You're getting this" keep their contractions: they explain, they refuse nothing. Audit log is named as its page, a feature, in `foot`.
- **19 Nov 2026. Someone from outside the organisation on an event's People** (sc-68421 for sc-71, `web:eventPeople.addPrompt|findAny|fromOutside|outsideTag|outsideEnds|notJoined|leadOff|removeOutsideLine|unusable|onAlready|pickAnother|jobLabel|jobHelp`, the same in `mobile:` with `findAnyone` and `removeLineOutside`, the API's `people.address_required|address_unusable|lead_members_only`). Kept as dev1 built it. Someone **from outside** {{organisation}} is the heading and the line under their name, against "Member of"; the row's tag is "Outside {{organisation}}". "Mobile" here is a mobile number, because the invitation can go by SMS. `leadOff` and `lead_members_only` are one sentence, and so are `unusable` and `address_unusable`. `unusable` keeps "isn’t" for now, against the no-contractions rule for errors, because `EventPeople.test.tsx`, `Demo.test.tsx` and `OutsideAccessTest.php` pin it; "That is not an email address or a mobile number we can use." is asked of [dev] on sc-71. The **job label** is free text beside a name and grants nothing; it is not a roster job. `jobHelp` ends in a character count, "{{length}} of {{most}}", which has no plural.
- **18 Nov 2026. Jobs and shifts on an event, and coverage** (sc-68779 for sc-3908, `web:jobs.*`, `web:roster.noJobOption|noShiftOption|onShifts|onShiftsHint|moreShifts`, the API's `staff.job_*|shift_*|works_as|on_shifts|job_suggested.*`, `errors:staff_job_staffed|staff_shift_full|staff_works_as|staff_shift_overlap|staff_on_shifts`). Kept as dev4 built it, `JobsShiftsArea.test.tsx`, the demo's `shifts.ts` and `StaffPlanTest.php` pinning it. A **job** is what a person does on the event (Waiter, Bar), a **shift** a stretch of time on one job with a number of **places**, and **coverage** whether every place is filled; a person is **assigned** to a shift and **unassigned** from it, never "removed", which is for a job. The view toggle is **Strip** and **Table**. The five access levels are "Can …" phrases, each with a one-line hint of what the person does. The suggested jobs are nouns for the work, not the worker where the trade says otherwise (Bar, Door, Kitchen, Sound). `staff.shift_too_long` and `jobs.tooLong` refuse, so they say "A shift cannot be longer than 24 hours. Check the dates." (dev4, #3008, with its tests and the demo's `shifts.ts`). `roster.shiftHelp` and `roster.removeShifts` are gone (#3008). `jobs.removeAsk` never shows at 0 and `removeAskSub` never for a job with no shifts: such a job is removed straight away, with no question. At 0, the coverage summary has its own line, `summaryShort_zero` "Every job is covered at all times." (19 Nov, qa5 #69038), not "0 jobs are short at some point, 2 covered."; no count, so it reads the same with one job or twenty.
- **18 Nov 2026. Changing an archived vendor** (sc-82, pm's #68699, settled before it is built; the API's 409 `conflict`, shown at the top of Edit vendor, one key for both): "This vendor is archived, so your changes were not saved. To edit it, restore it under Archived." Won over pm's working "This vendor is archived. Restore it from Archived to edit it.", because the house refusal says what was not saved and then what to do (as the payment schedule's "so none of yours were saved"), and the person who meets it pressed Save on a form that was open when somebody else archived the vendor. "Under Archived", the tab named as a place, as the directory's "It is under Archived."; "restore", the **Restore** button's verb. No `{{name}}` slot: the form's title names the vendor. No "while you were editing": the API says it to any caller, and it stays true for all of them.
- **18 Nov 2026. Vendors in Settings: the directory, its form, its refusals and its toasts** (sc-68021 for sc-82, `web:settings.sectionVendors`, `web:vendors.*`, the API's `validation.vendor_*`). Kept as dev4 built it, following the 17 Oct vendor form entry; `Vendors.test.tsx` and the demo's pin the archived toast and "1 to 25 of 28, A to Z". A **vendor** is a business an organisation buys from, kept once in the directory and chosen on an event's quote; never "supplier", and never "provider", which is the sign-in provider of single sign-on. Archive and Restore are the Menu library's words, with its tab **Archived** named as a place ("It is under Archived."). The toasts put `{{name}}` first ("{{name}} is added."), a vendor's own name, so es, fr and pt agree nothing with it and may lead with the word for vendor. The categories are nouns for a kind of business: **Hire** is equipment hire (tables, chairs, marquees), never staff, which is **Staffing**. Each `*TooLong` key and its API refusal are one sentence, per the house rule.
- **18 Nov 2026. The free-plan email and the Enterprise-only refusal** (sc-68011 for sc-581, `emails:planDowngraded.*`, `errors:plan_required`, `messages:access.plan_required`). Kept as dev2 built it: `OrganisationPlanTest` pins the subject, the switched-off line, "- Email domains" and the come-back line. The footer is the approver footer word for word, "You're getting this because you're an owner or admin of {organisation}." The plans are **the free plan** and **Enterprise**, the plan's own name, never translated; Soirely is contacted "about Enterprise", by name. The three settings are named as their pages are: Email domains, Audit log, Delete guest data after an event. es, fr and pt name each as a feature (a noun, not an order) in the email's list, since they follow "these were switched off". `{day}` is `time.dateAt`, weekday first, with the time and zone.
- **18 Nov 2026. A cost line's refusals (sc-67958 for sc-83, `validation.budget_*`).** Settled as sc-83 wrote them, with four changes. Below 0 takes the ceiling's shape, "The rate cannot be below 0. Enter 0 or more."; another currency takes sc-88's, "Enter the price in {currency}, the currency this event uses.", so the code is named once; "Say the currency" is "Enter the currency"; and an unknown basis says what to choose, "Choose how the cost is counted: per head, per table, staff time, per day or fixed.", over "That is not a way a cost can be counted", which named a head and a day as things to choose. Rate is the field on every line but a fixed one, whose field is Amount; Staff rates is a screen name (sc-101).
  Dated, newest first: the wording, where it is used, and why it won over the alternative.

- **18 Nov 2026. The run-of-show card on the lock screen, and the Event day note** (sc-66956 for sc-66580, `mobile:runOfShowCard.*`, the API's `run_of_show.card.*`, `web:`/`mobile:notificationSettings.note.event_day`). Kept as dev built it, `runOfShowCard.test.ts` and `lockCard.test.ts` pinning the card, except the Event day note, which said "the event changed in its last 24 hours": the bell holds a change from 24 hours before the start until the end (`EventDayItem`), so it now says so, and opens with a noun as the other notes do. The card is Now and Next, "Next: … · about {{time}}", "As of {{time}}" and "That’s everything." as on Run of show; a queued press stays a **press** (16 Nov). The `_hour1` keys and `=1` branches exist for es and pt's article before 01:xx; en and fr repeat their `other` text.
- **17 Nov 2026. Sharing tables with guests, and Your table on the guest's page** (sc-66074 for sc-4022, `web:seating.share.*`, `web:guest.table.*`, the API's `timeline.share_tables|tables_shared` and `validation.share_by_*`). Kept as dev1 built it; `SeatingArea.test.tsx` and `Invitation.test.tsx` pin the card, both asks and the guest's card. The host **shares tables**, never "publishes" a plan; a guest who is coming is counted by the reply (Coming), and es, fr and pt name them by it. **Share by** is a deadline field like Reply by, and es, fr and pt name it as Reply by is named ("Plazo para compartir", "Date limite de partage", "Prazo para partilhar"), quoted in `refusedEmpty`. **Save the date** saves the field: es, fr and pt write "save the date" literally, never the wedding card. `unseated_*` and `askShareUnseated_*` keep "doesn’t" and "They’ll": they explain, they refuse nothing; the three refusals have none. "Your guest" is the unnamed companion, as `guestKitchen.yourGuest`. `{{day}}` is the house short weekday from `Intl`, so each locale puts its own preposition before it.
- **17 Nov 2026. Exporting the guest list as a spreadsheet** (sc-63653 for sc-3784, `web:guestExport.*`, `mobile:guestExport.*`, the API's `guest_export.*`). Kept as dev2 built it; `GuestsArea.test.tsx` and `GuestExportTest.php` pin the dialog, the twelve headings, "Not yet invited" and the file name. The file's reply, allergen, diet and access words are exactly the screen's (`guestList.reply.*`, `guestNeeds.allergen|dietName|accessName.*`) in every locale, so a host reads the same word in the list and in the file. `guestExport.fileName` (web) and `guest_export.file` (API) are one name and change together. `noNeeds` and `safety` keep their contractions: they explain, they refuse nothing; `failed` has none. "Excel (.xlsx)" and "CSV" are the same in every locale.
- **17 Nov 2026. Deleting many items with guests in them** (sc-63723 for sc-57680, `web:seating.movedToTray_*|movedToTrayDone_*`). Kept as dev3 built it: under "Delete 3 tables?" the ask says "5 guests will be moved to Without a seat.", and after "3 tables deleted." the message adds "5 guests moved to Without a seat.", with Undo. Neither shows at 0: `nobodyInThem` and the plain message cover that. The demo's `seatingWords.ts` says the same. es, fr and pt name who moves, the seated guests, as `deletePlanSeated_*` does, and keep the tray's name bare.
- **17 Nov 2026. Seating a guest at a table** (sc-61445 for sc-4013, `web:seating.arrangeTab|seatTab|showUnsure|withoutSeat|trayCount|moreUnsure_*|nobodyComing|everyoneSeated|searchByName|groupCount|noGroup|noMatch|clearSearch|notSureYet|noReply|partyTitle_*|pick*|seated*|tableFull|tableShort_*|seatJust|swap*|race|undoRefused|taken|held|legend|seatN|unseatAll|tableEmpty|movedAll_*|moveAll|rename|roomForAll|freeLine|emptyTable|floorPlan|tablesView|view|allSections`, `web:guestList.seatedLine`, the API's `seating.table_full|table_short|seat_taken|undo_stale|table_below_seated|row_below_seated|seat_in_use|guest_not_waiting|companion_of`, `validation.seating_no_such_chair`). Kept as dev3 built it; `SeatingArea.test.tsx` pins the switch, the more line, the legend and the chair names. A guest with no seat is in **Without a seat**, the tray's name, also in the delete lines. The host **seats** a guest and **picks** a table; a guest's companions are their **party**, counted with the guest ("{{name}} + 2"). "Nobody has said they’re coming yet." keeps its contraction: an empty state, not a refusal. The reply words (Not sure yet, No reply) are `guestList.reply`'s, and es, fr and pt quote them inside a sentence. es, fr and pt call a party "{{name}} and their companions", never a group, which is the Groups feature. `freeLine` counts with a bare number after a colon or in brackets in es, fr and pt, since the number has no plural key. `roomForAll` has `_one` and `_other` since sc-64380: one guest is “Tables with a free seat for them.”, several “Tables with room for all {{count, number}}.” `trayCount`, `groupCount` and `partyTitle_*` are slots only, the same in every locale.
- **17 Nov 2026. A dish's items and a course's own** (sc-62831 for sc-34230, `web:dishItems.*`, the API's `validation.items_*|item_*|own_items_limit`). Kept as dev2 built it, `MenuArea.test.tsx` pinning nearly every line, except `ownHelp`, now "Added to every plate of this course, after the dish’s items: a bread roll, for example." in place of "Items of the course’s own, on every plate…", which read as a fragment. An **item** is one thing on the plate, named by the host and never translated; a course's are "Served with this course" and "Course item {{n}}". es, fr and pt call a course's items accompaniments (acompañamiento, accompagnement, acompanhamento), since "served with this course" doubles the course's own word in fr and pt (service, serviço). `item_name_taken` means unique, so they say "a different name", never "its own name", which in pt is a proper noun. `noItems` follows `eventMenu.addedTo`, so they name the dish as its subject. The refusals keep the web's sentence in the API's catalogue, as the house rule asks; `long` keeps "can be at most", not the house "Shorten the … to", because the test and the API pair pin it.
- **17 Nov 2026. A choice inside a dish** (sc-4042 for sc-3904, `web:dishChoices.*`, `web:eventMenu.libraryFailed|libraryFailedBody`, the API's `validation.choice_*|option_*`, `menu.choice_*|option_picked`). Kept as dev built it; `MenuArea.test.tsx` pins the draft lines and "Choice 1, no question yet". A **choice** is what the host adds to a dish, named by its **question**, with **options**; what a guest makes is a **pick**, never a choice. The optional choice's extra answer is "None for me". es, fr and pt call the choice by its question (pregunta, question, pergunta): the planned "write it by its options" collided with the options themselves, and "choice" in those languages is the guest's pick. The draft lines keep "can’t": they explain, they refuse nothing.
- **17 Nov 2026. The room screen and Show on a screen** (sc-62010 for sc-3897, `web:roomScreen.*`, `web:showOnScreen.*`). Kept as dev3 built it; `RoomScreen.test.tsx`, `ScheduleArea.test.tsx` and the demo's `roomScreen.ts` pin it. The link is a **screen link**, one per place, and changing it is **replace**, never reset, so it does not read as the calendar feed's Reset link. "Coming up" and "Now" head the room screen as on Run of show. es, fr and pt drop "screen" from the Copy button (the row already names the place and the dialog the screen), so three pills fit a row at 1280; the status lines keep it. "Copy the new link to that screen" means put the link on that screen, and es, fr and pt say open it there.
- **17 Nov 2026. Who else is on the seating plan** (sc-60777 for sc-4719, `web:seating.onPlan|andOthers_*|moreOnPlan_*|onThisPlan|personCanView|canView|reconnecting|choseToo|chosenBy|seatChosenBy|joinedPlan|leftPlan`). Kept as dev1 built it; `SeatingArea.test.tsx` and the demo's `Seating.test.tsx` pin every one. "Can’t see who else is here. Reconnecting…" keeps its contraction: a status line that recovers by itself, like `retrying`, not a refusal. `chosenBy` and `seatChosenBy` chain into one accessible name ("Table 1, chosen by Kemi Adeyemi and Priya Shah, seat 2 chosen by Julien Moreau"), so es, fr and pt write both with a noun ("elección de", "choix de", "escolha de") that agrees with nothing, since `{{name}}` may be a table, a row or a seat. `choseToo` names the item "this"; es, fr and pt say "this item" (elemento, élément), as `chosenCount_*` does.
- **17 Nov 2026. The Menu's read-only line for a Member's role on the event** (sc-59651 for sc-59617, `web:eventMenu.lockOnEvent`). Kept as built, in step with `eventMenu.lock`; `MenuArea.test.tsx` pins it. The event role names are verb phrases ("Can view"), so es, fr and pt quote `{{role}}` in the apposition, as they quote an event role in any sentence.
- **16 Nov 2026. Running the day: Done, Skip, Start now, the offline presses and the end** (sc-59333 for sc-3895, `web:night.*`, `mobile:night.*`, the API's `run_of_show.track_busy|idempotency_key_*|pressed_at_invalid`). Kept as dev4 built it, with five edits that wait on [dev4], because `NightArea.test.tsx` and `nightModel.test.ts` pin the English: `nothingToday` "Nothing is planned for today.", `openSchedule` "Open the schedule" (the page is Schedule, the link names the thing, lower case as in "Nothing is on the schedule yet."), `nothingElse` "Nothing else is planned for {{place}}.", `addedOnWeb` "To add items, use Soirely on the web.", the house shape of every app line that sends someone to the web, and `viewOnlyLine` "You can follow the run of show here, but not change it.", since the copy carries no night (7 Nov). The keys stay `night.*`; only the words lose it. "Press" stays the noun for a queued Done, Skip or Start now in English ("1 press waiting to send.", "Connected. Presses sent."); es, fr and pt say action, which reads as a thing waiting rather than a key. "Finish the current item first" is one sentence on the screen and in the server's `track_busy`. Where the web passes a time with no `_hour1` key (`nowSince`, `alreadyStarted`, `lastFinished`, `rowDone`, `workedOut`, `progressEnds`), es and pt write the time as a label or in brackets, never after an article.
- **16 Nov 2026. The hosts' thank-you to their guests** (sc-60164 for sc-6476, `web:thankYou.*`, `mobile:thankYou.*`, the API's `validation.event_thank_you_too_long`). Kept as dev2 built it, in the words the design settled. The noun is **thank-you**, hyphenated and lower-case mid-sentence ("Edit thank-you", "Thank-you saved."), never "thank-you note" or "message", because the hosts write one line, not a letter. The help says who sees it and how it is signed ("signed with the hosts’ names") rather than "from your hosts", which es and pt would have to agree with the hosts' number and gender. The two failures name what did not happen first ("Not saved.", "Not ended."), then what to do, then that the text is safe. The signature and the count are slots only, the same in every locale.
- **16 Nov 2026. An event's menu: its courses, the dishes on each, and the refusals** (sc-58053 for sc-3902, `web:eventMenu.*`, the API's `validation.course_*`, `menu.course_limit|course_picked|dish_picked|same_one_dish` and their `errors:menu_*`). Kept as dev4 built it; `MenuArea.test.tsx` and the demo (`menuCourses.ts`) pin it, including `failedChange|failedRemove|failedDelete`, settled from ux's proposals in #58061. A course is a **course** and a dish a **dish**, as in the Menu library. The same-dish refusal quotes its option, “Everyone gets the same” needs exactly one dish., in curly double quotes, identical in `web:eventMenu.sameNeedsOne`, `messages:menu.same_one_dish` and `errors:menu_same_one_dish` (dev4, #2643, `MenuArea.test.tsx` pinning it). `saved` takes a course's name or a dish's, so es, fr and pt agree with neither. `skipOn` gets the course's name in lower case (“No starter for me”), and each locale is written so that an article or elision never depends on it.
- **16 Nov 2026. Choosing many on the Floor plan** (sc-57613 for sc-4717, `web:seating.selectAll|selectKind|kindsGroup|sectionsGroup|all*|none|chooseBar|addToChoice|addHint|rules|rule*|escKeeps|align*|tip*|done*|space*|spaced*|grid*|columns*|gap*|apply|edgeRefused|renumber*|startAt|startRange|tableNumbered|sectioned*|unsectioned*|duplicatedMany_*|delete*Ask_*|delete*Go_*|deleteMany|nobodyInThem|keepThem|deletedEmpty*|stepChanged|undo|undone|guestsSeated_*`, the API's `validation.seating_renumber_taken|seating_copy_outside_room|seating_arrange_twice`). Kept as dev built it; `SeatingArea.test.tsx` pins the status lines and the clash. Every count sentence is its own key per kind, Tables or Items, so es, fr and pt agree the participle with the noun. "Add to choice" is a toggle named for what it does, and the picked things stay **chosen**. Align names the edge (Left, Centre, Right, Top, Middle, Bottom): Centre lines up down the room, Middle across it. `tableNumbered` must read exactly as the API's `seating.table_default_name` in each locale, since renumbering writes that name. `renumberClash` and `validation.seating_renumber_taken` keep "didn’t" for now: the test pins it, and the contraction in an error is a [dev] finding on sc-4717.
- **16 Nov 2026. The Language row in Your account on the web** (sc-57225 for sc-39509, `web:account.languageFoot|languageSaved`). Kept as dev2 built it; `AccountDesk.test.tsx` and the demo pin both. The foot says what the choice reaches, every signed-in device and the emails, and that it applies at once; the saved line repeats the reach. `{{language}}` is the language's own name ("Français") and the page has already redrawn in it, so es, fr and pt put it after a colon, as on the guest's page (14 Nov), and refer back to it as "this language".
- **16 Nov 2026. The Floor plan's key names** (sc-56854 for sc-56839, `web:seating.keyName.shift|delete|esc|ctrl`, with `placing*` and `shiftClick`, which name them). English kept as dev2 built it: Shift, Delete, Esc, Ctrl, as a UK keyboard prints them, capitalised in running text too. Each locale writes a key as its own keyboard prints it, and the placing and Shift-click lines name a key exactly as `keyName.*` does, so the strip and the sentence agree. The Mac's ⌘ is drawn by code, not translated.
- **16 Nov 2026. Moving, turning and resizing on the Floor plan** (sc-56592 for sc-5028, `web:seating.saved|saving|retrying|snap|across|down|overlaps|outside|lengthLike*|stepRefused|movedTo|turnedTo|tip|keys|key*|placing*|placeCentre|stopPlacing|placeAnother|chosenCount_*|moveTogether|shiftClick`, the API's `validation.seating_arrange_*|seating_seat_does_not_turn|seating_outside_room|seating_row_outside_room` and `seating.no_such_item`). Kept as dev4 built it; `SeatingArea.test.tsx` and `SeatingFurnitureTest.php` pin most of them. What the host has picked is **chosen** ("2 chosen", "Keys for the chosen item"), never "selected". Position is **Across** and **Down**, from the room's top-left corner, never X and Y. The keys strip pairs a key with a lower-case verb phrase ("turns 15°", "asks first", "lets go") read as a sentence with the key as its subject. "Couldn’t save. Trying again…" is a passing status on the save line, not an error body, so the contraction stays. Something placed "would sit outside the room", conditional, because the change has not been made.
- **16 Nov 2026. The day on a guest's page** (sc-55400 for sc-3899, `web:guest.theDay|programme|timesIn`). Kept as dev2 built it; `GuestProgramme.test.tsx` pins all three. "The day" heads one day's items and "Programme" several days', as settled on 19 Oct. "Times in {{timeZone}}." keeps its full stop on purpose: on the guest's page it is a line of its own under the heading, and every other line there ends with one; `web:eventPage.timesIn` and `mobile:eventForm.timesIn` are help under a time-zone field, and stay without. The slot is the event's zone as its id ("Europe/London"), so es, fr and pt name the zone ("fuseau", "fuso horário") before it, as `eventPage.timesIn` does.
- **16 Nov 2026. The seating plan's folded Add menu** (sc-56121 for sc-55937, `web:seating.add|menuRow`). Kept as built; `SeatingArea.test.tsx` and the demo pin both. At a narrow desk the bar's button is a bare "Add": the menu below it says what. "Row of chairs" names the thing placed, beside "Round table" and "Single seat", as a planner would; the row's own name and count stay in seats ("Row of 12 seats"). es, fr and pt use their seat word, not a chair, so the menu and the row panel agree.
- **16 Nov 2026. An event's pages handing over to the app in a phone browser** (sc-55864 for sc-55397, `web:handoff.line|anyway`). Kept as dev3 built it; `EventHandoff.test.tsx` pins both. The line says where the page lives ("it is in the Soirely app"), not an order to install anything, so es, fr and pt say the reader will find it in the app. "Show this page anyway" is the only way out, so every locale keeps "this page" and the concessive word last.
- **15 Nov 2026. Pasting a guest's reply from your own chat** (sc-54804 for sc-54450, `mobile:guestList.paste.*`). Kept as dev4 built it. "Paste a reply" is the button and "Whose reply is this?" the screen's title, which is also the record form's back label, so it stays a short question. "Their message" labels the quote of what the guest wrote; es and pt write "the message received" rather than a possessive that reads as the host's. `everyone` points at the search field by what it does ("find a guest", "search for the person"), not by quoting its label, since es, fr and pt label that field differently from English. `rowLine` is two slots and a separator, left identical in every locale: the reply word and sc-3788's Invitation line carry the language.
- **15 Nov 2026. Building the schedule on the web** (sc-54069 for sc-3893, `web:schedule.*`, the API's `validation.schedule_*`, `run_of_show.item_limit|version_required|changed_since`, `timeline.run_of_show_begins`, `errors:schedule_item_limit`). Kept as dev3 built it with ux's words for the failed saves (#54071): `ScheduleArea.test.tsx` pins the page. An entry is an **item**, where it happens a **place**, the person running it its **owner**, never "track", "slot" or "host". Each place is drawn as its own **table** (`newPlace`, `moves`), which es, fr and pt write as a data table (tabla, tableau, tabela), never the seating plan's mesa, table, mesa. A place is Espacio / Espace / Espaço in es, fr and pt, kept apart from the event's venue (Lugar, Lieu, Local) and the seating plan's zona / zone. The item's title is quoted in es, fr and pt notices, since it is free text. The time-zone line is not a label: `{{zone}}` is the browser's long generic name, which already begins with the word for time in every locale ("hora de Reino Unido", "heure : Royaume-Uni"), so it is a sentence that takes the name as its object, as in English ("Los horarios se indican en {{zone}}.").
- **15 Nov 2026. The Roster on the event's Staff page** (sc-4286 for sc-3906, `web:roster.*`, the API's `validation.staff_name_*`, `staff.number_shared|finished_keeps`, `errors:staff_number_shared`). Kept as dev2 built it, `RosterArea.test.tsx` and `Roster.test.tsx` pinning it, except `roster.sub`: "what each place dishes" is now "what each station serves", because Station is the column's name and "dishes" as a verb does not travel. A person on the roster is never agreed with: es, fr and pt put the verb or "you" first ("Se ha añadido a {{name}}", "Vous avez ajouté {{name}}", "Adicionou {{name}}"), and "Keep them" is "don't remove". Terms: Staff is Personal / Équipe / Equipa (as `eventNav.staff`), the Roster is "lista del personal / liste du personnel / lista da equipa", Job is Puesto / Fonction / Função, Station is Zona / Poste / Posto, Shift is Turno / Service / Turno, a staff link is Enlace / Lien / Ligação.
- **15 Nov 2026. Adding tables to a seating plan** (sc-53509 for sc-4000, `web:seating.addTable|addBar|shape*|kind*|menu*|tableSize|countPlaces_*|tableLine|tableName_*|inSection|chair*|empty|unusable|mark*|added|duplicated|squeeze|sizeReset*|section|shape|seats|places|diameter|ends|rotation|endsLine|headLine|headEndsLine|table*|seatsRange|placesRange|endsRange|duplicate|deleteTable|deleteNamedGo|nobodyHere|changedTable|itemsOutside_*`, the API's `seating.table_default_name|items_outside`, `validation.seating_table_*`). Kept as dev3 built it: `SeatingArea.test.tsx` and `SeatingTablesTest.php` pin the menu row, the table's name, the ends line, the refusals and the notices. The four shapes are Round, Rectangular, Head and Cocktail tables; a cocktail table's standing spots are "places", never "seats", in the count, the field and its refusal. `kind*` is the shape read inside a table's screen-reader name, lower case after the name. `itemsOutside_one` and `seating.items_outside` say "Move it first." for one item and "Move them first." for more (dev3, #2444). es, fr and pt say each item "would" sit outside a room of that size, since the room has not shrunk yet, and agree the pronoun with the count.
- **15 Nov 2026. The Search field reads one word** (sc-53041, qa5 #53932, ux #54001, `web:search.field.*`, `mobile:search.field.*`). All seven field variants are "Search", in every layout: the long placeholder truncated on the phone in every locale, and the hint under the field (`search.hint.*`) already names what can be found. A placeholder vanishes on the first character, so it carries nothing the person needs. This replaces the seven whole field variants below; the hint keeps them.
- **15 Nov 2026. Search across events, guests and members** (sc-53041 for sc-39534, `web:search.*`, `mobile:search.*`). Kept as dev2 built it; no English changed. The field and hint name only what the person may find, so each has seven whole variants and no list is built in code. A result is a "match", read only by a screen reader (`matches_*`, `headingCount_*`); es, fr and pt say "result", their usual word, and need no verb. A member's standing reuses the Members screen's words (`membersScreen.state.*`, `filter.invited`), and an event's line reuses Events' `days`, `calledOffOn` and `venueToBeConfirmed`, so a search result reads as the row it opens. `keys` names the keys as each locale's keyboard prints them.
- **15 Nov 2026. Record a reply** (sc-51870 for sc-3787, `web:guestList.recordReply|recordFor|howTold|toldHow.*|toldInLine.*|whoComing|recordPlaces_*|recordFoot|choose*|replaceAsk*|replaceTheirs|keepTheirs|replyRecorded|recordedOn`, `mobile:guestList.*` alike plus `theirReply`, `web:guest.recordedFor`, the API's `guest.reply_is_theirs`, `validation.guest_reply_choose|guest_how_choose`, `errors:reply_is_theirs`). Kept as dev1 built it: `GuestsArea.test.tsx`, `Guests.test.tsx`, `Invitation.test.tsx` and `GuestAnswersTest.php` pin the form, the replace question, the recorded line and the refusals. `replaceAsk` keeps the reply word bare ("replied Coming themselves"), as the tests pin; es, fr and pt quote it, as `unmarkRefused` does. "Themselves" means from the guest's own link, as against recorded by a host. `toldInLine` is used only in the recorded line, after the recorder's name between commas, as `howMid` is in the Invitation line.
- **15 Nov 2026. A view-only person on a passed Draft and a Paused event** (sc-51800 for sc-50996, `web:events.nextResumeReader`, `eventLive.endPassedReader`, `eventPause.noticeReader`). Kept as sc-50996 wrote it; `Events.test.tsx`, `GuestsArea.test.tsx` and the demo pin it. A reader is never the one to resume or change dates, so the lines are impersonal ("until it is resumed", "Someone who can edit this event"); es, fr and pt name no one and agree nothing with the reader.
- **15 Nov 2026. Answering by a date, and Reply by** (sc-30739 for sc-3780, `web:guest.replyBy|answerIs*|recordedOn|closedBy*`, `web:eventReplyBy.*`, `mobile:replyBy.*`, `guestList.askedToDecide*|repliesClosed*|reopened|letThemChange`, `guest.replies_open`, `timeline.replies_close`). Kept as sc-3780 built it, with one edit: `guest.replies_open` says "change their reply", the host's word, since only a host presses Let them change their reply. The closed card's heading is "Your answer is Coming." when the host recorded it, `Invitation.test.tsx` pinning it. `reopened` keeps "They can answer", as `replyBy.test.ts` pins it. `soonerLine`, `nowLine` and `startMoves` keep their contractions: they explain a confirm, they refuse nothing. `repliesClosed` names a "Record a reply" control that no catalogue has yet; es, fr and pt quote a name for it.
- **15 Nov 2026. Marking many guests as invited at a desk** (sc-50013 for sc-46880, `web:guestSelect.*`). Kept as dev3 built it, with one edit: `notLive` refuses, so "guests cannot be marked as invited", no contraction, once #2315 read the test through `t()`. `alreadyNamed_*` keeps "who stays/stay as recorded" beside `keptAsRecorded_*`'s "kept as recorded": the relative clause leads into the names list, and `GuestsArea.test.tsx` pins it. The web demo (`apps/web/src/demo/guestsMark.ts`) still says "can’t"; that is ux's copy and its test pins it. es, fr and pt carried no contraction and stand.
- **14 Nov 2026. Duplicate's empty start, read aloud, and Make live's alert in the app** (sc-48857 for sc-48601, `mobile:eventForm.notChosen`, `mobile:eventLive.confirmLine`). Kept as sc-48601 built it. "Not chosen" is heard after the box's label, "Starts date, Not chosen", for a date or a time alike, so es, fr and pt use a phrase that agrees with neither. `confirmLine` is the web's `confirmGuests` and `confirmFinal` on one line and keeps "can't": it explains a confirm, it refuses nothing. es, fr and pt name the event in the second sentence, since on one line "it" would follow the guests.
- **14 Nov 2026. Guests in groups, and Groups at a desk** (sc-48422 for sc-3775, `web:guestGroups.*`, the API's `validation.guest_group_*`). Kept as dev4 built it. A group is one per guest, and its companions follow the guest into it, so `deleteLine` counts guests and says their companions go with them. "No group" is a choice of its own, on the chips and in Groups, and is quoted in es, fr and pt wherever a sentence names it. Two refusals, `web:guestGroups.taken` and `validation.guest_group_name_taken`, drop their contraction: "There is already a group called {{name}}.", changed by dev4 in #2239 (sc-3775) with the two tests that pinned "There’s"; es, fr and pt carry none. The web demo's copy (`apps/web/src/demo/guestGroups.ts`) is ux's to follow. `madeOnSave` keeps "It’s": it explains, it refuses nothing. `{{name}}` is a host's own group name, so no locale agrees a word with it: es, fr and pt put "the group" before it.

- **14 Nov 2026. A guest tells the kitchen their needs on their own page** (sc-48201 for sc-3778, `web:guestKitchen.*`, `web:guestNeeds.changedByGuest`). Kept as sc-3778 built it, `Invitation.test.tsx` pinning it. "The kitchen and your server" is the people at the table, so es, fr and pt say the kitchen and the floor staff, as `guestNeeds.noteHint` does. `alsoNoted` counts host entries, and one entry can be a couple, so no locale agrees a verb with `{{hosts}}`: each says who noted it as a label. `{{label}}` is an access need, whose gender varies, so `willRemove` and `removed` put it after a colon. `changeAnswer` is an accessible name, worded like the visible `guest.change` in each locale.
- **14 Nov 2026. Send on WhatsApp, and the invitation the guest reads** (sc-48234 for sc-26025, `web:guestList.sendOnWhatsApp*|sendLine|sentOnWhatsApp|notSent|ifNotOpened|whatsAppMessage_*`). Kept as sc-26025 built it, the tests pinning it. `ifNotOpened` keeps its "didn’t": it explains, it does not refuse. In the message, `{{greeting}}` is the guest's full name, and "Yusuf Ibrahim, Amara Okafor and Tomi Bello would love you to come…" reads as three hosts; so since #2223 (sc-26025) the message opens "Hello {{greeting}}," on a line of its own, and the hosts start the next line. Kept as the developer wrote it (sc-48750): "Hello", not "Dear", because it arrives on WhatsApp from someone the guest knows. `whatsAppSend.test.ts` pins only that the guest's name comes before the first host with no letter between, so es, fr and pt open with their own hello and the same break, and agree nothing with the guest's gender. The event name follows the guides' "the event {{event}}" pattern, since it takes no article.
- **14 Nov 2026. Saving a guest offline in the app** (sc-47376 for sc-3785, `mobile:guestList.offlineRefused|offlineRefusedLine`). A refusal, so no contractions: "You are offline. Nothing was saved.", then "Your changes stay in this form. Save again once you are connected.". "Save" is the form's button, named as it reads. es, fr and pt say the device has no connection rather than that the host is connected, so nothing agrees with the host's gender.
- **14 Nov 2026. A guest's allergies, diet and access needs** (sc-47679 for sc-3777, `web:guestNeeds.*`, `validation.guest_need_*` from the API). Kept as sc-3777 built it, the tests pinning it. The allergen names are the fourteen of the EU and UK allergen rules (Annex II of Regulation 1169/2011), in their short British form: Cereals containing gluten, Soya, Sulphur dioxide and sulphites, Tree nuts. They are the one name for each allergen everywhere, and sc-4042's menu allergens take the same words in every locale. "Say which" is the error under an empty Other, not a label.
- **14 Nov 2026. Who's coming with you?, and Places for companions** (sc-47095 for sc-3779, `web:guest.withYou*`, `web:guestList.placesFor|fewerPlaces|morePlaces|namedOf|placesRefused|thisGuest|namedByGuest|companionsNamed_*`, the API's `validation.guest_places_full`). Kept as dev1 built it: `Invitation.test.tsx` pins the heading, `withYouPlaces`, "That’s you", "Named on your invitation", "Add someone · 1 place left", "Their name", "Type their name", "Change {{name}}’s name", "{{name}} is coming" and "You and … · 2 people". One fault the English cannot fix alone: `withYouPlaces` counts places, not hosts, so one host reads "Funmi have saved places"; asked dev1 on sc-3779 for the hosts' count. es, fr and pt are worded so that nothing agrees with the hosts. A place with a name is "named" ("1 of 2 named"), and the guest who filled it is "the guest", never "their companion".
- **14 Nov 2026. Not yet invited, Mark as invited and a guest's Invitation line** (sc-46819 for sc-3788, `web:guestList.reply.notYetInvited|invited*|copyFirst|markAsInvited|markLine|howInvited*|markNotSaved|how.*|howMid.*|markNotInvited|unmarked|unmarkRefused|readOnlyInvited`, the API's `guest.replied`, `guest.not_marked_by_hand`, `validation.guest_invitation_how_required`, `errors:guest_replied|guest_not_marked_by_hand`). Kept as dev1 built it, with one edit. The ticket meant to give `howMid` its own preposition ("by WhatsApp"), but `GuestsArea.test.tsx` pins "Invited by Folake Adeyemi, WhatsApp, Nov 13", so the channel stays a bare noun between commas, and `invitedHow` follows it: "Invited, WhatsApp, 9 Oct", not "Invited WhatsApp". `readOnlyInvited` names "a host or organiser role", which Soirely does not have (guests.manage is the Lead's and Can edit's), but `GuestsArea.test.tsx` pins it, so the English waits on dev1 (asked on sc-3788); es, fr and pt already name Lead and Can edit. `unmarkRefused` keeps the reply word bare, as the test pins; es, fr and pt quote it. `howMid` is used only in the Invitation line, so es, fr and pt give it the preposition English could not and agree nothing with the guest's gender.
- **14 Nov 2026. An invitation that never arrived, on Members** (sc-47041 for sc-46109, `web:membersScreen.notDelivered.*`). Kept as dev2 built it: "Not delivered" takes the place of "Sent {{sent}}" in the dates line, and the rest follows `membersScreen.dates.*`. `<word>` wraps only the words that mean "not delivered", so es, fr and pt agree them with the invitation inside the tag.
- **14 Nov 2026. An address we could not deliver to, on Your account** (sc-47208 for sc-44949, `web:account.undeliverable|changeEmail|changeEmailFor`, the same in `mobile:`). Kept as sc-44949 built it. "We couldn’t deliver email to {{address}}." keeps its contraction: a standing line on Your account that explains a state and refuses nothing, worded so by the AC and pinned by `AccountDesk.test.tsx`. "Change email" is the action; its accessible name adds ", instead of {{address}}" because two lines can show at once, and it starts with the visible words (WCAG 2.5.3).
- **14 Nov 2026. A guest's language, on their page and on the host's guest form** (sc-45625 for sc-3790, `web:guest.languageSwitched|languageNotSaved`, `web:guestList.languageNotSet|languageHint|languageNotSetLine|languageChose`, the API's `validation.guest_language_unknown`). Kept as sc-3790 wrote it: `GuestsArea.test.tsx` pins the hint, the Not set line and "They chose Português on their page, and that wins.". "Not set" is the Language field's empty choice and is told apart from `guestList.none`, "None", because Not set still decides something: the browser's language, then the organisation's. Each locale's `languageSwitched` and `languageNotSaved` names its own language, since the page is already in it when they show. `{{language}}` in `languageChose` is the language's own name ("Português"), in `languageNotSetLine` its name in the reader's language (`languageNames`), so es, fr and pt put both after a colon, where a capital reads as a label. The refusal lists the four in their own names, as the picker shows them.
- **14 Nov 2026. Finding a guest, and the counts above the list** (sc-46741 for sc-3772, `web:guestList.all|comingOf|countComing_*|countInvited_*|havent_*|haventLine|haventWho|countGuests_*|countCompanions_*|everyoneReplied|find|clearSearch|shown|clear|noMatch|noMatchLine|figure|showAll_*|heldLine`). Kept as dev2 built it, which is the 8 Nov card: `GuestsArea.test.tsx` pins "4 coming of 9 invited" and "4 haven’t replied (3 guests and 1 companion).", and "haven’t" explains, it refuses nothing. The card's first line is now two plural keys joined by `comingOf`, so es, fr and pt order the two halves as their sentence needs rather than "{{coming}} of {{invited}} invited". "Clear the search" keeps its article, against `eventsSearch.clearSearch`'s "Clear search": it is the field's clear button read aloud, the test does not pin it, and the difference is not worth a change to settled copy. `heldLine` is `heldCompanion` without "Companion · ", the row's name being the companion's own. `figure` and `haventLine` carry no words.
- **13 Nov 2026. A refusal for a called-off or finished event** (sc-44798, `errors:event_concluded`). "The event has ended or been called off.", as pm proposed: the title of a problem type must be true of every occurrence, and since sc-3591 it also refuses a called-off guest's reply, so it never says the end has passed. "Over" was rejected, read as "it took place". Parallel to "The event is paused."
- **13 Nov 2026. A guest's details, editing them, and a colleague's change** (sc-43485 for sc-3773, `web:guestList.pick|details|edit|none|mobileNumber|companionLine|heldCompanion|added|addedBy|moreCompanions_*|notFound*|backToGuests|editGuest|save|saving|saved|notSaved|keepsLink|removed|duplicateLine|saveAnyway|changeName|conflict*|theirs|yours|useTheirs|keepMine|discard*|keepEditing|replyHeading|repliedOn`, the API's `validation.guest_companion_unknown`, `guest.version_required|changed_since`). Kept as sc-3773 wrote it, which is the demo's wording; the 412 is the 8 Nov one. `repliedOn` stays lower case, a caption after the reply word, as the demo and `GuestsArea.test.tsx` have it. `notFound` should read "This guest is not on this list", no contraction, since it reports a refusal, but `GuestsArea.test.tsx` matches "isn’t": that waits on `[dev]`; es, fr and pt carry no contraction. `version_required` stays as it is in `event.`, `seating.` and `guest.`: it speaks to an integrator, never seen in our own clients, which always send `If-Match`, and the header name stays as written in every locale (25 Oct). "Someone else" stays in `conflict` and `changed_since`, as the test pins it; `seating.changed_since`'s "Somebody else" is as good.
- **13 Nov 2026. A guest's own invitation link, and a link that reached the wrong person** (sc-43781 for sc-1526, `web:guest.closing|tell*|goBack`, `web:guestList.copyLink*|replace*|linkCopied|invitationLink|clipboardRefused|keepIt|notReplaced|linkReplaced|flagged*|pausedLine|finishedLine`). Kept as dev2 built it, with one edit: `clipboardRefused` is "did not", since it reports a refusal. `closing` keeps "your answer" because `Invitation.test.tsx` pins it, though "reply" is the guest page's word; es, fr and pt say «respuesta», « réponse », "resposta", which is both. "Straight away" stays in the replace lines (the app demo pins it), meaning what `requestLink.replaceBody` says. `pausedLine` and `finishedLine` keep "can’t": they explain, as "Guests can't reply …" does. `tellLine` is the same sentence for one host and several: "They" is the hosts, so es, fr and pt agree with the count. es, fr and pt write the hand-off without gendering the person who opened the link: the link reached them "by mistake".
- **13 Nov 2026. A guest answers on their own page and changes it** (sc-43807 for sc-1439, `web:guest.yourAnswer|yes|no|maybe|coming|notComing|notSure|answered*|greet*|companions*|change|newAnswer|answerNow|keep|back|check|answerLine|changeShort|send|nothingSent|notSent|notSentTap|same|unsent|closed|didNotAnswer`, `web:guestList.replied`, the API's `guest.replies_closed`, `validation.guest_answer_unknown`). Kept as dev2 wrote it, with three edits: `notSent` and `notSentTap` report a failure, so "was not sent"; `notSentTap` says "choose it again", not "tap", which is wrong on a desk and to a screen reader; `nothingSent` says "select", not "press" (8 Nov). The three buttons, the greetings, `same`, `unsent` and `didNotAnswer` keep their contractions: they are warm or they explain, they do not refuse. The demo (`apps/web/src/demo/guest.ts`) still says "wasn’t sent" and "press"; that is ux's copy and its tests pin it. es, fr and pt quote the answer word inside a sentence ("You answered Coming on …", `same`, the API's refusal) and agree with nobody's gender.
- **11 Nov 2026. Members in the app, summary first** (sc-37811 for sc-37693, `mobile:membersScreen.card.*|waiting*|whenWord.*|request.*|role*|makeOwner*|remove*`, `mobile:ownerClaim.claimOpen|withdrewCard|copyNamed|copiedNamed|theirs*|stopped*|closedLine|stop*|passesToYou|withdrawFoundBody`). Kept as dev1 wrote it; it matches the design demo word for word. "Waiting" is the requests' section and the card's count, "Former" the filter a turned-down or removed person is listed under. `whenWord.*` is the caption under a person's date, so es, fr and pt write it as a label ("Date de la demande"), not a clause. `stopAskBody` says what `stopBody` says, and `theirsUnfound` what `pausedUnfound` says. The straight apostrophes in `roleScreenTitle`, `request.title` and `request.keepsWaiting` follow the demo's; es, fr and pt never use the possessive there.
- **10 Nov 2026. An event's People in the app** (sc-30138 for sc-29914, `mobile:eventPeople.failedTitle|failedLine|discard*|addFailedOne|addFailedMany_*|addedThenRefused`). Kept as dev1 wrote it. `failedTitle` and `failedLine` are the web's `eventPeople.failed` split for the app's error card. The discard sheet is the demo's: "Nobody is added to this event." and "Keep editing", since the app's sheet discards any change, not only ticks. `addFailedOne` and `addFailedMany` keep "couldn’t" and "they’re", as `changeFailed` does: they say what is left ticked and what to press, and `kit/eventPeople.test.ts` pins them. "Add" is the sheet's button, `addConfirm`. `addedThenRefused` is two whole sentences, the announcement then the refusal, so each locale keeps the order.
- **10 Nov 2026. The Calendar on the desktop web** (sc-36920 for sc-30413, `web:calendar.moreItems_*|chosen|barStatus|barLabel|markLabel`). Kept as sc-30413 wrote it. The day cell's chip is "+{{count, number}} more", one word after the figure so it fits a desktop cell in every language. `chosen` is a filter's name and its value for the screen reader, "Show: Events only". `barLabel` and `markLabel` are read aloud, so their parts are joined with commas, never " · ", which `barStatus` keeps on the bar itself.
- **10 Nov 2026. Creating an organisation in the app, the three-step walk** (sc-36766 for sc-30412, `mobile:createOrganisation.whatTitle|whereTitle|readyTitle|fromDevice|allCountries|noneYet|discard*`). Kept as dev1 wrote it. Each step's title is a short question, and "What’s it called?" keeps its contraction: a warm question, not a refusal. "From this device" is a group heading, a tag on a row and, lowered, a phrase in the screen reader's "Time zone, from this device, …", so it agrees with nothing. "None yet" stands in for a currency.
- **10 Nov 2026. Today's first run** (sc-37259 for sc-29090, `mobile:todayScreen.firstIntro`, `web:today.firstIntro`). "Give it a name, a date and a place. Your events, and what’s coming, show here." Copy promises only what the screen draws: Needs you is not built (sc-29884), so the line names the host's events and what is coming, never what needs them. When Needs you is drawn on Today, this line can say so again.
- **10 Nov 2026. An event's page in the app** (sc-36555 for sc-30413, `mobile:eventPage.datesLine*|datesLocked|venueLine|noHosts*|type|currency*|nameAndCover|eventName|cover*|defaultCover|yourPhoto|pauseLine|callOffLine|endLine`). Kept as sc-30413 wrote it. Each line under a row's title is "Label · detail", with the web's label: "Dates", "Venue", "Hosted by", "Cover". `datesLocked` is `web:eventEdit.scheduleLocked` after "Dates · " and keeps its "can't", since it explains; `noHostsLine` is `eventHosts.none` without its first sentence. `pauseLine`, `callOffLine` and `endLine` join on one line what `eventPause.body|nothingLost` and `eventEnd.callOffBody|endBody|final` said, word for word, and keep their contractions: they explain a confirm, they do not refuse.
- **9 Nov 2026. The app's Organisation page** (sc-36126 for sc-30412, `mobile:orgGeneral.*`, `ownership.*`, `companyDomains.*`, `requestLink.lead`). Kept as dev1 wrote it. `ownership.transferredLine` should read "You are an admin.", lower case in running text per the glossary, but `organisationSave.test.ts` pins "Admin"; [dev] is asked on sc-30412 to change both. `orgGeneral.editTitle` is also the back label of the sheet's pickers, so every locale keeps it short. "Proved" tags a domain also proved under Email domains (sc-560).
- **9 Nov 2026. The service floor's words** (sc-4005, epic 35 §4, §6, §7; settled in #36036,
  #36039 and #36042). An order's stages are **To serve** → **Dishing** → **Checked** → **On
  its way** → **Served**, each its own key, and each count by stage a plural key ("3 checked",
  "12 to serve"); no client joins a count to a word or changes its case. **Preparing** and
  **Ready** are an item's at a station only, the kitchen's own words, never the order's, so
  one word never means two things on one screen. **Dishing** is the tray started along the
  stations; **Checked** is the tray check passed, never read as checked in, because the door
  says "Check-in" and a guest not yet arrived reads **Not here yet**. **To serve** replaces
  Asked for and sits beside **To follow** (an owed item on the next tray) without clashing.
  The boards' sort reads **Owed plates first**, not "Late plates first", because "late" has
  left the product's words; its key goes in with the board that draws it. The working words
  stay as written: "Ready in about {n} min", **Waiting on the kitchen** (a held guest),
  **What's ready, now**, **Wait for all**, **On**, **Not on**, **Bring after**, **To
  follow**, **Sent back** with **Wrong dish**, **Not right**, **Dropped** and **Allergy
  concern**, **Nothing for this course** and **Left**. Rejected: **Dished** (two letters from
  Dishing on a chip read mid-service), **Tray ready** and **Ready to go** (Ready back in the
  order's words). Gone: **Asked for**, **Carried**, **Called up** and **Cleared**;
  **Unavailable** moves to sc-4015.
- **12 Nov 2026. The floor lead's plan and list** (sc-4026, epic 35; settled in #42289 and
  #42291). A table where a guest has arrived and no course is fired reads **Not fired yet**:
  fire is the product's verb (sc-4009's **Fire {course}**, "Fired at {time}"), so the tile
  agrees with the button that changes it, and it pairs with **Not here yet** without
  clashing. It never takes a course name before it. Flagged guests show as **{n} flagged**
  beside the flag icon, a plural key, short because the icon carries "guest". A screen reader
  reads that count as **{n} flagged guests still to serve**, its own plural key, because the
  icon is not read (WCAG 2.2 §1.1.1); the spoken text keeps the visible "{n} flagged"
  (§2.5.3). Neither phrase is joined to the icon's name in code. Rejected: one key for both
  with the icon's name added in code.
- **9 Nov 2026. The app's Notification settings page** (sc-34901 for sc-30411,
  `mobile:notificationSettings.*`). Kept as dev1 wrote it. The header says how you hear ("You
  hear by push only"), the rows say it without a verb ("Push only", "Off"), and "Saving…" and
  "Saved" sit beside a row as tags, so "Saved" takes no full stop. `pushBlocked` drops "Turn
  them on in your device's settings" because the card now carries the "Open device settings"
  step, and keeps "won't", as 29 Oct. `locked.email` takes the "cannot" that Account &
  security's note carried, so the note now lists only what you hear about.
- **9 Nov 2026. Security on the desktop web** (sc-35456 for sc-30411, `web:security.*`). Kept as dev1 wrote it; the shared keys read as `mobile:security.*`. `setupTitle` stays "Set up two-factor" for now because `SecurityDesk.test.tsx` pins it, though the 19 Oct phrasing and the app say "Turn on two-factor"; es, fr and pt already say turn on, and [dev] is asked to change the English with its test. `setupKey` names the key for a screen reader only. `sendAgain` is the link under "Nothing there?", as on the app's sent page.
- **9 Nov 2026. The app's Security page** (sc-34792 for sc-30411, `mobile:security.*`). Kept as dev1 wrote it, except `setupTitle`, now "Turn on two-factor", as the 19 Oct phrasing and the web's `twoFactorCard.setupTitle`; "Set up two-factor" stays only after account recovery. Row lines after " · " keep their lower case, as every row line.
- **9 Nov 2026. The web's reset sent page and the lost-both support line** (sc-33788 for
  sc-29067, `web:recovery.nothingThere`, `sentAgain`, `lostBothIntro`). Kept as dev2 wrote
  them; `RecoverPassword.test.tsx` pins all three. `nothingThere` ends on its own link, "send it
  again", so the link is the verb; `sentAgain` is a short status beside it, shorter than the
  app's toast because the page still shows the sent body. `lostBothIntro` keeps its contractions:
  it explains, it is not an error. Its meaning in every locale: confirming starts only after the
  password; without the password, it is Soirely support.
- **8 Nov 2026. The app's reset sent screen and its toast** (sc-33809 for sc-29071,
  `mobile:recovery.intro`, `sentFor`, `spam`, `sentAgain`, `openMail`, `signsOut`, `changed`).
  Kept as dev2 wrote them, from the board. "Open Mail" names iOS's Mail; on Android the same
  button opens the default email app, so es, fr and pt say "open your email" rather than an
  app's name. `spam` ends on "send it again" to match the Send it again button under it, and
  `sentAgain` replaces it once that button is used. `changed` is a toast: two short sentences,
  the result first.
- **8 Nov 2026. A two-factor sign-in that ran out** (sc-29979, `signIn.codeTimedOutTitle`,
  web and app). "That sign-in timed out", then `endedBody` "Sign in again to carry on." The
  app joins the two as one line with a full stop, so the title takes none. "That" names the
  attempt the person just made, not their session: they were never signed in.
- **8 Nov 2026. A sign-up that ran out** (sc-32449 for sc-29923, `register.timedOut`, web
  and app). "Your sign-up timed out, so we did not keep the password. Enter it again to get a
  new code." Kept as built: "timed out", as the sign-in; "the password", the one just typed;
  "a new code", as Send a new code. The demos and tests pin this sentence, so a reword waits
  on [dev].
- **8 Nov 2026. Guests A: a guest's reply, the two counts, and the 412** (sc-3773, pm's #31841,
  settled in #32403). The reply state is "Not sure yet" everywhere, the guest's own words,
  never "Maybe": "Not sure yet · asked to decide by {{date}}", "Not sure yet · replied
  {{date}}". Two measures: "haven't replied" (everyone without an answer of their own,
  companions included) and "No reply" (guests only); never swap them. "Companions" is the
  field and the count's noun, never "plus-ones". The card: "{{coming}} coming of {{invited}}
  invited", "{{count}} haven't replied ({{guests}} guests and {{companions}} companions).",
  "Replies close tomorrow, {{date}}.", "Write to them", "Open check-in", "Check-in opened at
  {{time}}. Anyone on the list can be marked as arrived, whatever their reply." A group's
  overflow is "Show all {{count}}", with no state slot, because the heading names it. "Their
  conversation", "Their own page, where they reply." Replacing a link reuses
  `requestLink.replaceBody`'s "stops working as soon as you replace it". The 412: "Theirs" and
  "Yours", **Use theirs** and **Keep mine**: "Use theirs fills the form with their version and
  drops your changes. Keep mine saves your changes over theirs." Each count is its own plural
  key, and "Replies close" has a whole sentence per case (today, tomorrow, on a date, closed).
  When replies close (#32762): "Replies close today." with no date, "Replies close tomorrow,
  {{date}}.", "Replies close on {{date}}.", "Replies closed on {{date}}.", the day reckoned in
  the event's zone. Nobody left to reply is "Everyone has replied.", companions included.

- **8 Nov 2026. A payment schedule's shape fields, its sums and its failed save** (sc-1332,
  pm's #32327 from ux's demo, sc-31779 #1485). Field labels: "Percentage of the quote" (won
  over the earlier boards' "Share of the quote": "share" reads as a part of something, not a
  number to type, and es, fr and pt say percentage anyway), "Days before the event", "Days
  after the event", labels with no full stop. Help: "Above 0 and up to 100, with up to two
  decimal places." and "A whole number from 0 to 730." Refusals: "Enter a percentage above 0
  and up to 100, with up to two decimal places." and "Enter a whole number of days from 0 to
  730." (20 Nov, pm's #75237: a percentage of 0 is refused, so "from 0 to 100" is no longer
  the copy.) A percentage in range whose row comes to 0 once rounded to the currency's minor
  unit is refused at that row's percentage field: "This payment would come to less than
  {{smallest}}. Enter a higher percentage.", `{{smallest}}` the event currency's smallest
  amount from `Intl.NumberFormat` at its ISO 4217 minor unit (£0.01, ¥1). "This payment", the
  row the field sits in, true for the last row's remainder too; "would come to", since nothing
  was saved. "Above 0", not "From 0.01", so no decimal is written into a string. "Decimal
  places", the house term since sc-83, not the demo's bare "decimals". A row with no
  description yet, in its amount line: "No description yet", a label with no full stop.
  Before saving, when the percentages do not come to 100, one key each: "The percentages come
  to {{total}}, so {{gap}} of the quote is not scheduled. You can still save these payments,
  and the vendor's page will show the difference."; "The percentages come to {{total}}, so
  the schedule is {{gap}} over the quote. You can still save these payments, and the vendor's
  page will show the difference." They mirror the vendor page's "{{amount}} of the quote is
  not scheduled yet." and "The schedule is {{amount}} over the quote.", and name the
  button's verb. Won over the demo's "it saves, and the vendor’s page says so", where "it"
  had no clear subject. `{{total}}` from `Intl.NumberFormat` with `style: 'percent'`, never a
  "%" typed into the string; `{{gap}}` an amount in the event's currency. The failed save,
  all or nothing, a plural family on `{{count}}`, the rows on the form: "None of these
  payments were saved, because they could not be sent. Your rows are kept as you filled them
  in; select Save {{count}} payments to send them again." (other) and "This payment was not
  saved, because it could not be sent. Your row is kept as you filled it in; select Save 1
  payment to send it again." (one). The button reads "Save {{count}} payments" / "Save 1
  payment" (pm, 8 Nov, ux's #33189), so both lines name it as it reads and say "save", not
  the earlier "Add". "Select", not
  "press", which is a key's verb and wrong for a tap or a screen reader; "send them again",
  not "all of them", because nothing was saved, so there is no part to leave out. The row's
  timing, a plural family on `{{count}}` with its own wording for 0 (a `_zero` key, as two
  catalogues already have, so French, which counts 0 as one, still reads it): before,
  "On the event's start date" (0), "1 day before the event" (one), "{{count}} days before
  the event" (other); after, "On the event's end date" (0), "1 day after the event",
  "{{count}} days after the event". For 0, "start date" and "end date", not "on the day of
  the event", because a multi-day event has two days that 0 can mean, and before counts from
  its start, after from its end. Capitalised, as every segment after a "·" in a row line is
  ("Set to the date quoted", "Marked by"). A description over 100 characters reuses sc-87's
  "Shorten what the payment is for to {{count}} characters or fewer."

- **7 Nov 2026. The app's Today screen** (`mobile:todayScreen.*`, sc-31788 for sc-29090). Kept
  as sc-29090 wrote it. A lower-case key (`tomorrow`, `dayOf`, `inDays`) sits after a date or
  inside a line; its capitalised twin (`tomorrowCapital`, `dayOfCapital`, `inDaysCapital`) opens
  a card's chip, so the two are never merged. "Live now" and "Live · …" mean happening now, the
  Events list's "Happening now", not the Live state, so es, fr and pt write them as
  "Happening now" and never as published. The agenda's "{{name}} starts / ends / continues" may
  become a label and a colon in other languages, which need no article before an event's name.
  "Good evening" runs from 18:00 (`greetingAt`). "Next up" names the next event; the Now
  block's "Next" is the next item on the run of show.

- **7 Nov 2026. The app's other ways in** (`mobile:steps.invited*`, `invitationFor`, `join`,
  `startOwnInstead`, `mobile:requestToJoin.messageOptional`, `signedOutLine`, sc-30119 for
  sc-29070). Kept as sc-29070 wrote them, except `signedOutLine`, now "Sign in or create an
  account to ask. You will come back here.", the web's `requestToJoin.signedOut` without its
  organisation, which the title above already names (rejected: "You come back here after.").
  "You’re invited" keeps its contraction: a warm title, not an error. es, fr and pt say the
  reader has an invitation rather than "is invited", so nothing agrees with the reader's gender.

- **7 Nov 2026. What sc-87's demo adds: payments saved and removed, Revise, read-only and the
  archive refusal** (pm's #31444 from ux's #31427, settled before the board is drawn). Saved
  lines take the quote's shape, one string with slots: "Payment added: {{description}},
  {{amount}}, due on {{date}}."; "Payment changed: {{description}}, {{amount}}, due on
  {{date}}."; "Payment removed: {{description}}, {{amount}}." No vendor slot: payments are
  only ever saved on that vendor's page, whose title names it. "Changed", the button's verb,
  not "amended". "Due on", as "quoted on", because es, fr and pt need the preposition. Live
  announcements: "Payment added.", "Payment changed.", "Payment removed." Removing asks in the
  row: "Remove this payment?" with **Keep** and **Remove**, as the AC has them. Revise form
  intro, the Correct intro's mirror: "Revising saves this quote with a new amount or date
  quoted. The current quote is kept as an earlier quote, under Show the earlier quote. To
  change only what it covers, its quote number or its budget lines, correct the quote
  instead." Won over ux's "Revising keeps the current quote as an earlier quote, under Show
  the earlier quote.", which did not say what Revise is for, on which the 17 Oct refusal of an
  unchanged Revise rests. Read-only, on the Budget page and the vendor's page: "Quotes and
  payment schedules are read-only because this organisation's plan no longer includes them.
  Nothing has been removed." It ends a sentence, so it reads whole with **See plans** after it
  or without it (only `billing.manage` sees the link). "This organisation's plan", as the 17 Oct
  refusal, not "Your plan": a Lead or an Admin does not hold the plan. Rejected: "kept to
  read", which no other string says. A title, if the card keeps one, is "Read-only", hyphenated
  as an adjective. The archive refusal, in Edit vendor: "{{vendor}} was not archived, because
  the events below still have payments to it that are not paid or cancelled. Once each one is
  paid or cancelled, you can archive the vendor." Each link under it reads "Payments to
  {{vendor}} on {{event}}", which says where it goes when read alone in a screen reader's list
  of links (rejected: "<event>, its payments to <vendor>"). "The events below", not a count, so
  one event and many read the same without plural keys. The API's 409 detail cannot say
  "below", so it has its own key: "{{vendor}} was not archived, because one or more events
  still have payments to it that are not paid or cancelled."

- **7 Nov 2026. A payment schedule's shapes, and someone else adding payments first**
  (sc-1332, pm's #30379, settled before the board is drawn). The 409 when another person adds
  a scheduled payment while a shape is being chosen, on the form and as the API's detail
  under one key: "Payments were added to this vendor's schedule while you were filling this
  in, so none of yours were saved. Check the payments it has now before adding more." Won
  over the story's "Payments were added to this vendor while you were choosing. Nothing was
  saved.": payments belong to the vendor's schedule on this event, not to the vendor;
  "choosing" missed the person who had already edited the rows; and the house refusal says
  what was not saved and what to do, as sc-87's second quote does. "None of yours", not
  "nothing", because the other person's payments were saved. No name slot: the API need not
  say who. Kept as the story has them: the radio options **Deposit and balance**, **Three
  instalments**, **In full before the event**, **In full after the event**, **Enter rows
  yourself**; the prefilled descriptions Deposit, Second instalment, Balance, Payment in full
  (Three instalments reads Deposit, Second instalment, Balance); "Set to the date quoted", a
  label with no full stop. "Needs the event's date" was dropped on 7 Nov (pm): every event has
  a start date, so its state cannot happen. A blank description reuses sc-87's "Enter what the
  payment is for." rather than a near-copy reading "this payment".

- **7 Nov 2026. Choosing a quote's vendor, and the vendor page's empty states** (sc-87, pm's
  #30377, settled before the board is drawn). In the Vendor field: an option already quoted
  reads "Already quoted on this event", a label with no full stop. Typed text that matches
  nothing reads "No vendor matches “{{typed}}”.", the time zone picker's shape, and with
  nothing to offer at all "There are no vendors to choose from.", which stays true when every
  vendor is archived (rejected: "No vendors yet.", which is not). The second line, for an owner
  or admin, is "Add the vendor on the Vendors page first.", linking to the directory, and reads
  under either first line; for an event's Lead it is "Ask an owner or admin to add the
  vendor.", which says what to do rather than only what the Lead cannot (rejected: "Only an
  Owner or Admin can add a vendor."). Roles in running text are lower case, per the glossary.
  The second quote from one vendor, on the form and as the API's 409 detail under one key:
  "That vendor already has a quote on this event, so this quote was not saved. To give a new
  price, revise that quote." No name slot, as with "That vendor is no longer one of this
  organisation's vendors". The vendor page's difference: "The schedule matches the quote.";
  "{{amount}} of the quote is not scheduled yet."; "The schedule is {{amount}} over the
  quote.", `{{amount}}` from `Intl.NumberFormat` in the event's currency, never a sign or a
  colour alone. Empty states: "No quotes on this event yet." beside **Add a quote**, and "No
  payments scheduled yet." "Nothing is due." stays sc-93's.
- **7 Nov 2026. "On the day", never "on the night"** (sc-29384, from the owner's 3 Nov decision).
  Events happen at any hour, so the copy says "on the day" and carries no night, dusk or sunset
  imagery: `verifyPhone.doneBody`, `steps.mobileIntro`, `completeProfile.mobileHelp`,
  `rolesScreen.means.run_of_show`, and the web tagline, now the app's "Plan the event. Run the
  day." in every locale. es, fr and pt say "el día del evento", "le jour de l’événement" and "no
  dia do evento". Kept: `eventForm.clocksSkip` and `clocksSkipNextDay` say "the clocks go forward
  that night", which describes the clock change, not the event. "Good evening" is a greeting by
  the hour and stays.
- **5 Nov 2026. An event's People refusals** (`errors:own_event_role`, `messages:people.*`,
  sc-30009 for sc-29912). Kept as dev2 wrote them. The event role Lead is "the event's lead" in
  running text, lower case, as "an owner, an admin".
- **4 Nov 2026. An invitation's refusal lines on the desktop web** (`web:join.refused.*.line`,
  `web:requestToJoin.deadLine`, sc-29487 for sc-29066). Each line sits under its refusal's
  title and should not restate it. Proposed to `[dev]` on sc-29066, since `Join.test.tsx` pins
  the English: "The invitation to {{organisation}} can no longer be accepted." (not "… no longer
  exists", which the title says), "the person who invited you" for "whoever invited you", and
  "If you have changed your mind, ask {{inviter}} …". The other locales already read that way.
- **4 Nov 2026. The app's new-account steps** (`mobile:steps.*`, sc-29126 for sc-29069).
  The step bar's screen-reader label is "Step {{step}} of {{steps}}", and the top bar's way past
  an optional step is "Skip". The mobile step says "cannot", not "can't", as every other
  sentence on these steps does.
- **1 Nov 2026. Events and an event's own navigation** (sc-26732 for sc-22103,
  `web:events.*`, `mobile:eventsScreen.*`, `eventNav.*` web and app). Settled as sc-22103 wrote
  it, except one line: `staffComing` reads "Staffing for this event is coming.", since "The staff
  … are coming" reads as people on their way. The areas are Overview, Guests, Menu, Seating,
  Messages, Schedule, Staff, Budget and Reports; a figure the product lacks is "Coming soon". The
  Draft and Paused next-step lines explain, so they keep "can't"; the end-passed line refuses,
  so it says "cannot".
- **1 Nov 2026. How soon an event ends, and the Overview's coming cards** (sc-26608 for
  sc-25008, `events.endsIn`, `eventsScreen.endsIn`, `eventPage.onTrack`, `replies`, `needsYou`,
  `team`). "Ends {{time}}", where {{time}} is `Intl.RelativeTimeFormat`'s whole phrase ("in 3
  hours", "tomorrow", "this minute"), so the verb is the only word we write; each locale puts
  its verb before the phrase. `thenSoon` ("{{when}} ·") is punctuation and stays as it is in
  every locale. The card headings are "On track", "Replies", "Needs you" and "Team on this
  event": short, sentence case, above "Coming soon" until the cards are built.

- **31 Oct 2026. Who's here, for the floor lead** (sc-3918, settled on pm's #24454 and #24466).
  Empty states say what is true, not what is missing: "Everyone due by {time} has clocked in."
  and "Nobody has clocked in yet."; with nobody to move, "Everyone here is already on
  {station}." The polite announcement is "{name} clocked in at {time}." A load failure is the
  house "The list of who is here did not load.", followed by "Check your connection and try
  again." where a retry is drawn. The Job line has three forms, each ending in a full stop:
  "{job} shifts end at {time}. Theirs runs from now until then.", "{job} has no shift tonight.
  Theirs runs from now until the event ends at {time}." and "{job} has no shift tonight. Theirs
  runs for 24 hours, until {time} tomorrow." No {day} slot: the 24-hour cap keeps every end
  today or tomorrow, and only the third form can be ambiguous, so only it says "tomorrow".
  {time} is 24-hour from `Intl`. With sc-3906: "Nothing was changed. {name} was not added. Try
  again." When the event has ended under an open Someone's at the door (`409 event_concluded`
  only): "The event has ended, so nobody can be added.", with Close the only act. It offers no
  retry, since none can work, and keeps no contraction, as the API's "The event's end has
  passed." does.
- **30 Oct 2026. A build too old to use** (sc-22881 for sc-22620, `updateRequired.*`, app).
  "Update Soirely to carry on", the house "to carry on"; the body says what happened ("no
  longer works") and reassures ("Updating keeps everything you have saved"); the button is the
  bare verb "Update". Never "upgrade", "outdated" or "unsupported", which blame the person.
- **30 Oct 2026. The end moving with the start** (sc-22161 for sc-22144, `eventForm.endMoved`,
  web and app). Spoken only, politely, when a new start carries the end: "Ends moved with the
  start, to {{day}}, {{time}}." Settled as sc-22144 wrote it; `Events.test.tsx` pins it. "Ends"
  names the field the reader has just heard, as its legend says. No article before `{{time}}`
  in any locale, since "a las" and "às" fail at 01:00; es, fr and pt name the day and the time
  after a colon.
- **29 Oct 2026. Being told an event changed** (sc-21005 for sc-13214,
  `messages+intl-icu:eventChanges.*`, the bell, the push and the email). Settled as sc-13214
  wrote it; `EventChangesTest` pins the titles, subjects, lines and footer. A title is the act
  in the past with the person's full name, "{name} paused the event", and doubles as the
  email's sentence with a full stop added, so it carries none. The subject is the state then
  the event, "Paused: {event}", "Back on: {event}" for a resume. A change line is "The … is now
  {new} (was {old})."; a removed venue is "to be confirmed", as the event page says. Support is
  "Soirely support", by name. One line waits on [dev]: `email.footer` should open "You're
  getting this because you are on {event} at {organisation}.", the house footer, but the test
  matches "You get this because". es, fr and pt are written to the settled footer already.
- **29 Oct 2026. Notifications: the bell, Mute this event and Notification settings** (sc-14815
  for sc-3980, `notifications.*`, `eventMute.*`, `notificationSettings.*` web and app,
  `messages:notifications.*`). Settled as sc-3980 wrote it, except the failures. A load failure
  is the house "… did not load." ("Your notifications did not load."); the API's refusals and
  Account & security's note say "cannot", one sentence with `not_switchable`. The push-blocked
  line explains, so it keeps "won't"; the app's says "your device's settings", since it also
  runs on an iPad. Four web lines wait on [dev], because tests match their English, and their
  app twins wait with them so both clients read alike: `allReadNotSaved` should read "Could not
  mark them all read. Try again.", `muteNotSaved`/`eventMute.notSaved` "Not saved. Try again.",
  `muteNotLoaded`/`eventMute.notLoaded` "Could not check whether this event is muted.", and
  `pushNotSaved`/`emailNotSaved` "The push switch was not saved. Try again." (email likewise).
  es, fr and pt are written to the settled meaning already. The categories are proper labels,
  capitalised in running text ("only Event day pushes"); "Mute this event" is the switch, and
  its state "Muted". "Push" is the channel, a "push" one alert.
- **27 Oct 2026. Duplicating an event** (sc-15883 for sc-3593, `web:eventDuplicate.*`). Settled
  as sc-3593 wrote it; `DuplicateEvent.test.tsx` pins it. The act is "Duplicate", the button that
  confirms it "Create draft", and the new event is "the copy" until it exists, then "Draft". The
  panel lists "Copied" and "Not copied"; the length is "Length", the event's duration. A refusal
  starts "Not created.", as "Not made live." does. `{{duration}}` arrives in the reader's words
  from Intl ("1 hour", "2 hours"), and `hoursAndMinutes` is where es, fr and pt put their "and".
- **27 Oct 2026. Pausing and resuming an event** (sc-15439 for sc-3586, `eventPause.*` web and
  app). Settled as sc-3586 wrote it. The act is "Pause", the way back "Resume", the way out of
  the confirmation "Keep it live", never "Cancel". A refusal starts "Not paused." or "Not
  resumed.", as "Not ended." does. The explanation "Guests can't reply …" keeps its contraction,
  as `scheduleLocked` does: it explains, it does not refuse. "Check-in" is guests arriving at
  the door, "service" the food and drink on the day; es, fr and pt name the door, never a
  hotel or airport check-in.
- **27 Oct 2026. An event's hosts** (sc-15427 for sc-6713, `web:eventHosts.*`,
  `eventLive.needsHost*|addHosts` web and app, `messages:validation.event_host*`,
  `messages:event.host_required|last_host`, `errors:event_host_required`). Settled as sc-6713
  wrote it, except the last-host lines (#15501): the rule holds for any event that has been made
  live, Live, Paused or Finished alike, so they say why from the guest's side, "Guests can see
  this event, so …", never "A live event …". The refusals take "cannot". One line waits on [dev2]:
  `eventHosts.lastHost` should read "Guests can see this event, so it needs at least one host.
  You can still change this name.", but `Events.test.tsx` matches the old line; es, fr and pt
  already say the settled one. A host is a name as guests read it, perhaps a couple on one row
  ("Chief and Mrs Adeyemi"), so es, fr and pt keep a name out of any agreement: "removed",
  "moved" and "already a host" are written around the name.
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
- **7 Nov 2026. The ceiling line in what a decision costs (sc-90 in sc-86's answer).** The
  not-yet-made form of the rate-edit warning: "This would take the event over its ceiling."
  or "This would take {{category}} over its ceiling.", then "Settled, it would be {{total}}
  against {{ceiling}}." or "If everyone comes, it would be {{total}} against {{ceiling}}."
  Won over the change as a slot ("Adding 4 guests takes …"), because the caller already names
  the change above the answer and a slot holding each caller's noun phrase leaves es, fr and
  pt no way to agree with it; and over keeping "You can still save it", because nothing is
  being saved yet. Which of event or category it names follows the rate-edit rule.
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
- **27 Oct 2026. The two-factor-due subject opens on the feature and the deadline**
  (`emails:signInRules.twoFactorDue.subject`, sc-15219): "Two-factor due by {deadline}:
  {organisation}". "{organisation} requires two-factor from {deadline}" was cut before the
  deadline in a 390 px inbox (qa2, #15218); the organisation goes last, as sc-14100 and sc-9219.
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
- **8 Nov 2026. Messages' empty pane on an event that cannot send** (sc-3942, sc-32077, on
  pm's #33225; web and app). A Draft, or an event finished more than 30 days ago, reads "Pick a
  conversation." It keeps the verb of the live line, "Pick a conversation, or write to your
  guests below.", so the two states of one pane differ only in what is off. It carries no
  reason: the reason already shows once, under **New** on the web and above the composer in
  the app. es, fr and pt write both lines with one verb, as English does.
- **27 Oct 2026. Events Home's tabs and empty states** (sc-15981 for sc-3594, `events.tab*|empty*|
startedToday|calledOffOn|showMore|moreShown|moreFailed`, `eventsScreen.*` the same plus
  `nextUp|showingMore`). Kept as sc-3594 wrote it. The tabs are **Upcoming**, **Drafts** and
  **Past**; each empty state is a short title and one line saying what will show there. A
  cancelled past event reads "Called off on {{date}}", the act sc-3585 named. The two
  `moreFailed` keep their second sentence different on purpose: each repeats its own screen's
  load failure, web "Try again in a moment." as `events.failed`, the app "Check your connection
  and try again." as `eventsScreen.failedLoad`. es, fr and pt follow the same split.
- **27 Oct 2026. The details page names the sign-in rule, not the role** (sc-16443 for
  sc-16265, `orgGeneral.readOnlyUntilLinked|readOnlyUntilTwoFactor|refusedByRule`, web and
  app). Kept as sc-16265 wrote it. Each line opens with the rule in the banner's words
  (`signInRules.unlinkedBody`, `gateBody`, without "now", since the page states the rule rather
  than announcing it) and ends with the role line's "you can see these but not change them", so
  the page reads the same whichever reason holds it back. A save the rule refuses says only
  "Nothing was saved.": the line under the details already says why.
- **27 Oct 2026. A called-off event's milestone** (sc-16725 for sc-16709,
  `messages:timeline.event_called_off`). "{name} called off", as pm wrote it, beside
  "{name} starts" and "{name} ends"; the act stays "Call off" (sc-3585).
- **1 Nov 2026. The organisation's Calendar** (sc-25787 for sc-3625, `calendar.*`,
  `nav.calendar`, `frame.calendar`, web and app). Kept as dev2 wrote it. "Calendar" alone is the
  organisation's Calendar; an event's own dates stay "All dates". "Agenda" is the Calendar's
  list view only, beside "Month", and never the Schedule. A milestone is an event's dated step
  (`timeline.*`); the filter reads "Events and milestones" | "Events only". A range is
  "{{from}} to {{to}}" in words around two `formatWallDay` values, since Hermes has no
  `formatRange`.
- **1 Nov 2026. Subscribing to the Calendar** (sc-25960 for sc-3626, `calendarFeed.*`, web and
  app; `messages:calendar_feed.*`; `messages+intl-icu:limits.calendar_feed`). The link is "your
  private link", reset (never "regenerate" or "revoke"). Two errors lost their contractions:
  "Your link did not load. Try again.", the house "did not load", and "Could not copy here."
  `confirmBody` keeps "you'll": it explains, it does not refuse. The feed's status words are the
  Events list's (Draft, Live, Paused, Finished) plus "Called off" and "Deleted", each a word
  about the event.
- **A refused control's screen-reader word** (`mobile:forms.invalid`, sc-31909): "Invalid", heard
  after the control's name ("Email, Invalid") and before its refusal line as the hint. One word,
  capitalised as a state the platform announces; never seen, so it has no layout to fit.
- **8 Nov 2026. Starting a seating plan** (sc-33304 for sc-3998, `web:seating.*`,
  `messages:seating.*`, `messages:validation.seating_*`, settled with pm on sc-3998 #32429 and
  #32766). A refused save ends "Your change was not saved." everywhere. A failed load is "Could
  not load the seating plan." then "Check your connection and try again. …". Delete the plan
  reads "This also deletes {{counts}}." ({{counts}} a list of plural phrases for what goes:
  sections, tables, rows, single seats), then "{{count}} seated guests move to Without a seat;
  the guest list does not change.", or only "The guest list does not change." with nobody
  seated. Its row line is "Asks first, and lists what it deletes." ("names what goes" did not
  translate). The units line says "the units used where {{organisation}} is based", with no
  possessive on a name. The API's section limit names "a seating plan" in full, since "the
  plan" is the subscription in the same catalogues; on the Seating screen "A plan" is enough.
  The 8 colour names are words a host reads beside a swatch, never the swatch alone.
- **9 Nov 2026. Personalisation** (sc-34920 for sc-30441, `web:personalisation.*`,
  `mobile:personalisation.*`, `mobile:settings.personalisation*`,
  `messages:validation.colour_scheme_unknown`). Kept as dev2 wrote it. A person's choice is
  "your colours", never "theme" or "palette"; the eight are "colour schemes" only in the API's
  refusal. The web says "every page", the app "every screen". "Black tie" is the scheme's name,
  for the formal dress code, and each locale names it from its own dress code rather than
  keeping the English. The refusal keeps "isn't" for now because
  `AccountColourSchemeTest` pins the English; it should read "That is not one of …", which
  waits on [dev2].
- **10 Nov 2026. Agreeing to WhatsApp** (sc-3950, settled on #36816 before any key exists).
  The guest "agrees" to WhatsApp and a host "records" that they did; never "consent" or "opt
  in" on screen. Under the tick **Send me updates on WhatsApp**: "Soirely sends them on behalf
  of {{organisation}}. Reply STOP at any time to end them." ("on behalf of" names the business
  the guest agrees to hear from; "for" reads as "to" in es and pt). The reach line's parts, each
  a plural family joined through `listFormat`: "{{count}} have no mobile number", "{{count}}
  stopped WhatsApp" (STOP or the switch, so not "texted STOP" as on SMS), "{{count}} haven't
  agreed to WhatsApp"; one is "1 has …", "1 stopped …", "1 hasn't …". The host's **WhatsApp**
  row under **Mobile number**, labels with no full stop: "Has not agreed to WhatsApp"; "Agreed
  to WhatsApp on {{date}}" (the guest's own); and three whole keys for a host's record, "Agreed
  to WhatsApp in person, recorded by {{name}} on {{date}}", "… by phone, …", "… in writing, …",
  {{name}} the host's full name. Opted out, sc-3969's "Unsubscribed from WhatsApp on {date}"
  and "Only the guest can change this." Under the **WhatsApp** switch in **Your messages**,
  shown whether it is on or off and recorded when it is turned on: "Soirely sends updates on
  WhatsApp on behalf of {{organisation}}. Reply STOP at any time to end them." It names
  "updates on WhatsApp" because the row's label is only **WhatsApp**, so the tick's "them"
  would point at nothing (settled on #36834). Turning it on saves "WhatsApp messages from {{organisation}} are on.", with no
  "again": WhatsApp starts off, so the first turn-on and a return read the same; email and texts
  keep "… are on again." The host's record, over **How?**: "For {{name}}, on {{number}}. It will
  show as recorded by you." ("will": nothing is recorded until Save). In **Who it reached**, a
  `not_sent` reason is "Has not agreed to WhatsApp", the details row's words, or "Stopped
  WhatsApp", with no full stop (settled on #36939).
- **11 Nov 2026. Add to my authenticator app** (sc-40162 for sc-40025, `mobile:twoFactorCard.addToApp`).
  The button speaks as the member, "my", like "I have saved these codes somewhere safe"; the lines
  around it describe the screen, "your authenticator app". Kept as the AC names it. It opens the
  device's authenticator with the key, so "Add", never "Open" or "Copy".
- **13 Nov 2026. The host's guest list and Add guest** (sc-43267 for sc-1468, `web:guestList.*`, `eventDelete.removesGuests_*`, the API's `validation.guest_*`, `guest.already_listed`, `errors:guest_already_listed`). Kept as dev1 wrote it. A companion with no name yet is "Guest of {{host}}", and "Guest of {{host}} · {{nth}}" from the second. A refused add starts "Not added." and says nothing was saved, as "Not saved." does. A limit is the same sentence on the screen and from the API. The duplicate panel's "{{name}} is already on the list" has no full stop, as a panel heading.
- **23 Nov 2026. The single-events line for a member of one organisation** (sc-85143 for sc-85006,
  `web|mobile:accessPaused.untouchedSingleEvents`, `signInRules.overdueSingleEvents`). Each is its
  sibling (`untouched`, `overdueElsewhere`) with the other organisations taken out, so each keeps its
  sibling's phrasing: "your access to single events" on the paused card, "single-event access" on the
  overdue page. Kept as sc-85006 built them; `AccessPaused.test.tsx`, `SignInRules.test.tsx` and
  `demo/OrgSwitcher.test.tsx` pin both.
