# Billing

**A subscription belongs to an organisation.** Everything else here follows from that.

## Why the organisation and not the person

The tempting alternative — one plan per owner, covering every organisation they own —
breaks in ways that are hard to unpick once there are live subscriptions:

- Ownership transfers, and the plan belongs to somebody who has left
- Two people co-own, and neither plan obviously applies
- A member of org A who owns org B has entitlements leaking sideways
- Limits turn ambiguous: _ten events_ across all orgs, or each?

The organisation is the thing that owns events, outlives its members, and can be handed
over or sold. That is what a subscription hangs on.

## Who pays is not what you can do

```
BillingAccount  ──pays for──▶  Subscription  ──grants──▶  Organisation
 payment method,                plan, period,              entitlements are
 invoices, tax id,              status, source             evaluated HERE
 currency
```

One billing account can pay for several organisations. **An entitlement check never looks
at the billing account.** It reads the organisation's own plan.

Keeping these apart is what lets an agency consolidate three organisations onto one
invoice without any feature check learning about invoices. Systems that conflate them end
up asking "who pays for this?" in order to answer "may I click this button?".

`BillingAccount` exists from the first migration even while it is one-to-one with an
organisation. Adding a layer above live subscriptions later is a genuinely painful
migration; adding it now is one table.

## Entitlements per org, credits pooled

- **Entitlements are per organisation.** Pooled limits create contention and arguments —
  "marketing used all our events" is not a conversation the product should cause.
- **Credits pool at the billing account.** Messages and AI requests are fungible. Buy
  credits once, spend them wherever. This is how people already think about topping up.

## Three kinds of limit

| Kind        | Examples                                                      | At the boundary                                           |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| **Hard**    | team seats, active events                                     | refuse **at creation**, name the limit, offer the upgrade |
| **Metered** | messages (SMS and WhatsApp, in credits), AI requests, storage | allow, record, warn on approach                           |
| **Feature** | service floor, branding, API                                  | present but gated — never half-working                    |

**One meter.** Anything consumable reports to it. The previous build billed AI requests
twice because the first meter was called "usage", and whoever needed metering later
searched for "credit", found nothing, and wrote a second one. If you are about to write a
counter, it already exists.

## A paywall must never ruin somebody's wedding

This outranks everything above. It is also commercially correct: the moment the product
fails somebody in front of two hundred guests, the account and its word of mouth are gone.

- Limits are enforced **at creation** — when the event is made or the member invited. Never
  at runtime.
- A live event stays live regardless of billing state. A card that expires on Saturday
  afternoon does not stop the service floor.
- Running out of credits degrades a **channel**, not the event. Email still goes; SMS waits.
- Downgrade or non-payment makes things **read-only**. Never deleted, never inaccessible.

## Payment rails

The rail is a detail stored beside the subscription, never something a feature check reads:

```
Subscription
  ├─ plan, period, status        ← entitlement checks read this
  └─ source: paddle | stripe | apple | google | invoice | manual
     └─ external_ref
```

Each rail gets an adapter normalising into that one shape. Apple's receipt model and
Stripe's webhook model are genuinely different work; **nothing downstream branches on
source**. Get this wrong and every feature check grows an `if (apple)` arm.

### Selling on the web, not in the app

Apple and Google require in-app purchase for digital goods consumed in the app — 15–30%.
A product whose customer subscribes on the web and signs in on mobile is the standard
multiplatform-service pattern, and keeps that margin.

This also fits what the product is: planning happens on the web, where billing already
lives. Mobile is for the night.

Two consequences of a store-purchased subscription, worth stating in the UI at the point
of purchase rather than discovering later:

- It belongs to an Apple or Google account, **not** to a billing account, so it cannot be
  consolidated with other organisations
- It **cannot be transferred** when that person leaves

### Starting rail

A **merchant of record** — the MoR is the legal seller, takes the payment, and pays out as
a vendor. Two reasons, in this order:

1. **It absorbs global sales tax and VAT.** Selling digital services into the EU makes you
   liable for VAT across twenty-seven jurisdictions. That is worth more than the fee
   difference.
2. It brings local payment methods — SEPA, iDEAL, PayPal, Boleto — that would otherwise be
   an integration each.

A direct Stripe account becomes attractive on EU incorporation: lower fees, Link included,
more control, and EU VAT handled through OSS as a single quarterly return. That is a
**second `source`**, not a rewrite. The abstraction above is what makes it so.

## What support needs

Every one of these is a ticket somebody will raise:

- The subscription, its rail, and its full payment history
- Current meter usage against the plan
- **A temporary entitlement override** — unblock a customer mid-event without a deploy
- Refund and credit, both audited

A failed charge during an event is a support problem, never a product failure the guest
can see.

## Changed, 19 Oct: owner decisions on epic 37

The owner approved the prices and limits recorded in epic 37, "Decided, 19 Oct: prices and
limits" (memo sc-3928 #4131). Two lines above changed with them, and one rule is new:

- **Guests per event is not a limit on any plan, Free included** (#3835). The Hard row read
  "guests per event, team seats, active events", and the first bullet of "A paywall must never
  ruin somebody's wedding" read
  "when the event is made, the guest added, the member invited". A guest who is not messaged
  costs nothing measurable, and a cap would refuse a host mid-list.
- **WhatsApp is on every plan, Free included, paid per message in credits** (#4152, #4169).
  The Feature row read "service floor, WhatsApp channel, branding, API", and the Metered row
  read "messages, AI requests, storage". The credit is the only gate, so a plan never
  carries a WhatsApp flag.
- **SMS and WhatsApp are priced by destination**: credits per message = ⌈provider cost ÷
  0.0063⌉, about a 30% margin in the smallest pack, with the table by country in #4131. SMS
  is charged per segment, and WhatsApp by the category Meta charged for the message. AI is
  13 credits per delivered proposal on the model in force (claude-opus-5-5); questions about
  the host's own event cost 0 (sc-3928 #4278). Guest email takes no credits and has no quota.
