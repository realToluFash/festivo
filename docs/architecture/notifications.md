# Notifications

One clock, one outbox and one worker carry everything the product tells anybody (sc-104,
epic 36). No story runs its own sweep, timer or queue. If a consumer needs something this
page does not offer, that is a finding about this machine, and it belongs on sc-104's epic,
not in a second path.

The code is `App\Domain\Messaging`.

## The pieces

| Piece                       | What it is                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `NotificationTypeInterface` | one registered type: audience kind, category, priority, channels, too-late rule, event rule  |
| `NotificationRegistry`      | the list of every type, and the sender for each channel                                      |
| `NotificationScheduler`     | schedules, replaces and cancels rows; re-schedules an event's rows when its times change     |
| `scheduled_notifications`   | the clock and the outbox: what is due, when, for which audience                              |
| `notification_deliveries`   | the log: one row per person per channel, with epic 36's idempotency key                      |
| `NotificationWorker`        | claims the most urgent due row, one at a time, and fans it out or sends it                   |
| `app:notifications:work`    | the worker process, one container (sc-5930)                                                  |
| `app:notifications:check`   | the alert check, every minute from `config/crontab`                                          |
| `EventActionNotices`        | who hears of each `EventAction`: a type, the story that will add one, or nothing by decision |

## Registering a type

A type is a class implementing `NotificationTypeInterface`. Autoconfiguration registers it;
nothing else can be scheduled, and scheduling an unregistered name throws.

- **`name()`** is stored on every row, so it is never renamed once something has been sent.
- **`channels()`** may only name a channel the registry has a sender for.
  `NotificationRegistryTest` fails otherwise. Today only email has one; in-app and push come
  with sc-3980.
- **`eventRule()`** says how the type treats a paused, finished or deleted event
  (`NotificationEventRule`, epic 36 §9). Only `DeletionNotice` goes after a delete.
- **`tooLateAt()`** is the moment after which the row is recorded **Not sent: too late**.
  It is computed once, when the row is scheduled, and stored.
- **`isStillDue()`** is asked at send time with the payload. False records the row
  cancelled. A payment reminder answers false once the payment is made.
- **`collapseKey()`**: rows due together for one person on one channel that share a key go
  out as one message, rendered from every payload at once.
- **`render()`** writes the message in the recipient's language.

A type that answers an event action also replaces its `Notice::awaiting('sc-N')` entry in
`EventActionNotices` with `Notice::type(...)`. A new `EventAction` case cannot merge without
an entry: the match there is exhaustive and the registry test walks `cases()`.

## Scheduling and cancelling

```php
$scheduler->schedule(
    'payment.reminder',                         // the registered type
    "payment-reminder:{$payment->getId()}",     // the cancellation key
    "payment:{$payment->getId()}:due",          // the source id, part of the idempotency key
    Trigger::relativeTo($payment->getDueAt(), '-P3D', '10:00'),
    Audience::membersWithPermission($organisationId, Permission::BudgetManage),
    ['paymentId' => $payment->getId()->toRfc4122()],
    $event,
);

$scheduler->cancel("payment-reminder:{$payment->getId()}");
```

- **Call it inside the change's own transaction.** The scheduler writes through the open
  connection, so the change and its row commit together or not at all. Nothing is ever sent
  inside a request: an immediate notification is a row due now.
- **A trigger** counts from a date the caller supplies (`Trigger::at`, `Trigger::relativeTo`)
  or from the event's start or end (`Trigger::relativeToEvent`). Offsets are ISO 8601
  durations; days and the time of day count on the event's clock (sc-98), and the due time
  is stored in UTC.
- **An event's new date, time or zone** re-schedules every pending row that counts from the
  event (`EventEditor`, `EventTimesRecomputer`). A caller's own date is the caller's to move:
  schedule again with the same key.
- **The same key again** replaces the pending row. There is never more than one pending row
  per key.
- **Cancelling a key** removes its pending rows and every delivery of them not yet sent.
- **The source id** is the thing that caused the notification. A retry or a doubled trigger
  with the same source id sends once; a second, deliberate send needs a new one.

## Audiences

An audience is a rule, resolved when the row is sent, so somebody who joined or left in
between is handled as they are then.

- **Members**: `Audience::membersWithPermission`, `membersWithRole` or `members` (named),
  each with an optional `except`, the person who acted. The fan-out reads roles; each
  delivery then asks the member's grants again, as narrowed by sign-in rules, and cancels
  when they no longer hold it.
- **Guests**: `Audience::guests($eventId, $conditions)` is accepted and stored. It is
  resolved by sc-3957's resolver; until that exists such a row is recorded Failed.
- **Channels** come from `ChannelSelector`, the one place that applies a member's
  preferences (sc-3980's store; epic 36's product defaults until then). In-app always goes;
  push only rides along with another channel and is never the only way somebody hears.

## The worker

- **One row per claim, most urgent first.** The claim orders by priority, then due time,
  with `FOR UPDATE SKIP LOCKED`, and commits a lease before any provider is called. A row is
  urgent when its type is, or when it is an in-app item. A batch claim would keep an urgent
  row waiting behind the batch.
- **A large send goes out as one row per recipient**, never as one provider call for many.
  The fan-out writes deliveries in chunks of 250 and claims again between chunks, so an
  urgent row is never stuck behind a 1,500-guest send.
- **Every provider call takes the worker's per-call limit**, on every channel. The worker
  sets `default_socket_timeout` to 3 seconds for its own process only, which bounds each SMTP
  read (Symfony Mailer's `SocketStream`). That setting does not reach a client that sets its
  own timeout: `TwilioTextMessageSender` and `WhatsAppCloudSender` set 10 s for the
  request path, so the sender sc-3946 or sc-3950 adds for this worker must pass the
  worker's limit explicitly. A call that times out is a failed attempt.
- **Retries**: five attempts, 4, 8, 16 and 32 minutes apart with ±25% jitter, then
  **Failed** with the provider's reason.
- **At least once, said honestly.** The unique idempotency key stops a second delivery row.
  A worker that dies between the provider accepting and the row being marked can send
  twice; the delivery id is passed as the provider's idempotency key where it takes one.
  SMTP takes none, so it is the email's `Message-ID`.
- **Paused events** hold automatic rows (`held = 'paused'`) and recheck them every minute;
  they go on resume unless too late.
- **It exits** after `--time-limit` or `--memory-limit`, on SIGTERM (finishing the row in
  hand), and when the database connection or the entity manager goes. Its container's
  restart is the reconnect. `--once` handles what is due and exits.
- **Heartbeat**: `var/notifications-worker.heartbeat`, touched on every poll. The container
  is unhealthy when it is older than the health window.

## The alert

`app:notifications:check` runs every minute outside the worker and writes a `critical` log
line on each of three symptoms. A row is waiting once it is due and nothing holds it: not a
pause, not a retry's backoff, not a claim in progress.

- **Stopped**: a row has waited more than 5 minutes and nothing was claimed in the last 5.
- **Behind**: the oldest waiting row has waited more than 30 minutes.
- **Failing**: more than 5% of the last hour's sends ended Failed, in an hour of at least 20.

The local stack runs no scheduler, so run it by hand there. sc-1612 routes the lines.

## Deleted events

An event is soft-deleted (sc-3592) and purged 30 days later; its rows go with it under the
foreign key's cascade. The worker reads the event past the soft-delete filter, so a
deletion notice can still go after the delete. An event whose organisation is deleted
counts as deleted. Events have no `deleted_at` yet; sc-3592 adds it to
`NotificationWorker::eventState()` when it adds the column. A deleted organisation's members are no longer an audience, so a notice
to them must be resolved before the organisation goes.
