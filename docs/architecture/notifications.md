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
| `PushSender`                | push to each live device a member registered, through Web Push or Expo                       |
| `push_targets`              | the devices that take push: one row per browser subscription or Expo token                   |

## Registering a type

A type is a class implementing `NotificationTypeInterface`. Autoconfiguration registers it;
nothing else can be scheduled, and scheduling an unregistered name throws.

- **`name()`** is stored on every row, so it is never renamed once something has been sent.
- **`channels()`** may only name a channel the registry has a sender for.
  `NotificationRegistryTest` fails otherwise. Email, in-app and push each have one.
- **`eventRule()`** says how the type treats a paused, finished or deleted event
  (`NotificationEventRule`, epic 36 §9). Only `DeletionNotice` goes while an event is deleted, and
  `AfterConclusion` goes after an event that took place, never one called off.
- **`tooLateAt()`** is the moment after which the row is recorded **Not sent: too late**.
  It is computed once, when the row is scheduled, and stored.
- **`isStillDue()`** is asked at send time with the payload: once for the row before its
  fan-out, and again for each delivery with its recipient. False records the row, or the
  delivery, cancelled. A payment reminder answers false once the payment is made.
- **`thread()`** names the bell item a type's messages share, or null for an item of its
  own. See [Threads](#threads).
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
    Trigger::relativeTo($payment->getDueDate()->format('Y-m-d'), '-P3D', '10:00'),
    Audience::membersWithPermission($organisationId, Permission::BudgetManage),
    ['paymentId' => $payment->getId()->toRfc4122()],
    $event,
);

$scheduler->cancel("payment-reminder:{$payment->getId()}");
```

- **Call it inside the change's own transaction.** The scheduler writes through the open
  connection, so the change and its row commit together or not at all. Nothing is ever sent
  inside a request: an immediate notification is a row due now.
- **A trigger** counts from an exact moment (`Trigger::at`), from a calendar day the caller
  supplies (`Trigger::relativeTo('2026-11-20', '-P3D', '10:00')`), or from the event's start
  or end (`Trigger::relativeToEvent`). Offsets are ISO 8601 durations; days and the time of
  day count on the event's clock (sc-98), and the due time is stored in UTC. A day is never
  a moment: it is the same day on any clock.
- **An event's new date, time or zone** re-schedules every pending row that counts from the
  event (`EventEditor`, `EventTimesRecomputer`). A new zone, or new rules for the zone after
  a tzdata update, also re-schedules a row from a caller's day, with its same day, offset and time of day on the new clock (sc-17127); a new
  date or time leaves it, and an exact moment follows no change. A caller's own date is
  still the caller's to move: schedule again with the same key.
- **The same key again** replaces the pending row. There is never more than one pending row
  per key.
- **A window is not collapsing.** "Changes within 10 minutes send one email" is one row
  under one key, due at the window's end, which each change schedules again.
- **Cancelling a key** removes its pending rows and every delivery of them not yet sent,
  except a call already under way: it is recorded Sent if the provider accepts it, and
  otherwise deleted with the rest, never retried or held for a resume.
- **The source id** is the thing that caused the notification. A retry or a doubled trigger
  with the same source id sends once; a second, deliberate send needs a new one.

## Audiences

An audience is a rule, resolved when the row is sent, so somebody who joined or left in
between is handled as they are then.

- **Members**: `Audience::membersWithPermission`, `membersWithRole` or `members` (named),
  each with an optional `except`, the person who acted. The fan-out reads roles; each
  delivery then asks the member's grants again, as narrowed by sign-in rules, and cancels
  when they no longer hold it.
- **Guests**: `Audience::guests($eventId, $conditions)` is accepted and stored. sc-3942
  adds its resolver with All guests and Choose guests, and sc-3957 adds the conditions to
  it; until sc-3942 merges such a row is recorded Failed.
- **Channels** come from `ChannelSelector`, the one place that applies a member's
  preferences (sc-3980's store; epic 36's product defaults until then). In-app always goes;
  push only rides along with another channel and is never the only way somebody hears.

## The worker

- **One row per claim, most urgent first.** The worker claims an urgent row first, and
  otherwise the oldest due, whatever the type's priority, with `FOR UPDATE SKIP LOCKED`; it
  commits a lease before any provider is called. A row is urgent when its type is, or when
  it is an in-app item. A batch claim would keep an urgent row waiting behind the batch.
- **One bad row never stops the worker.** A type's check, an audience or a resolver that
  throws records that row Failed with the exception's class, and the worker claims the next.
- **A cancel wins over a fan-out in progress.** Each chunk locks its scheduled row and is
  written only while that row is still pending; a cancel locks the row before it deletes
  the pending deliveries, so it either stops the chunk or removes what it wrote.
- **A large send goes out as one row per recipient**, never as one provider call for many.
  The fan-out writes deliveries in chunks of 250 and claims again between chunks, so an
  urgent row is never stuck behind a 1,500-guest send.
- **Every provider call takes the worker's per-call limit**, on every channel. The worker
  sets `default_socket_timeout` to 3 seconds for its own process only, which bounds each SMTP
  read (Symfony Mailer's `SocketStream`). That setting does not reach a client that sets its
  own timeout: `TwilioTextMessageSender` and `WhatsAppCloudSender` set 10 s for the
  request path, so the sender sc-3946 or sc-3950 adds for this worker must pass the
  worker's limit explicitly, as push's two providers are given
  `WorkNotificationsCommand::PROVIDER_CALL_LIMIT`. A call that times out is a failed attempt.
- **Retries**: five attempts, 4, 8, 16 and 32 minutes apart with ±25% jitter, then
  **Failed** with the provider's reason.
- **At least once, said honestly.** The unique idempotency key stops a second delivery row.
  A worker that dies between the provider accepting and the row being marked can send
  twice; the delivery id is passed as the provider's idempotency key where it takes one.
  SMTP takes none, so it is the email's `Message-ID`. Neither push provider takes one, so
  the type's `collapseKey()` goes as theirs (below): a retry replaces the message it
  repeats, and a double send stays possible.
- **Paused events** hold automatic rows (`held = 'paused'`) and recheck them every minute;
  they go on resume unless too late.
- **Deleted events** hold their rows (`held = 'deleted'`) until a restore; see
  [Deleted events](#deleted-events).
- **It exits** after `--time-limit` or `--memory-limit`, on SIGTERM (finishing the row in
  hand), and when the database connection or the entity manager goes. Its container's
  restart is the reconnect. `--once` handles what is due and exits.
- **Heartbeat**: `var/notifications-worker.heartbeat` (`--heartbeat` overrides it; tests
  use their own file), touched on every poll. The container is unhealthy when it is older
  than the health window.

## Push

Push rides along with another channel and never goes to a guest (`ChannelSelector`). It has
one sender, `PushSender`, and two providers behind `PushServiceInterface`:

| Kind   | Provider                                          | Adapter                             |
| ------ | ------------------------------------------------- | ----------------------------------- |
| `web`  | Web Push with VAPID (minishlink/web-push, bcmath) | `Integrations\WebPush\VapidWebPush` |
| `expo` | the Expo push service, over `symfony/http-client` | `Integrations\Expo\ExpoPushService` |

- **The store** is `push_targets`: one row per member and device, unique on its address
  (the Web Push endpoint or the Expo token), with the session that registered it. A device
  registers with `PUT /api/auth/push-targets`; registering an address again moves it to
  whoever did. A Web Push endpoint is taken only on the browsers' push services, since the
  worker posts to it.
- **It is forgotten** when the provider says the device has gone (Web Push 404 or 410, an
  Expo ticket's `DeviceNotRegistered`), when its session ends (`SessionsEnded`, from every
  way a session ends), and with the account, by the foreign key. A session that runs out
  unused is never sent to. Expo's receipts are not polled: no story runs its own sweep.
- **Collapse**: `collapseKey()` is the Web Push `Topic` (hashed to its 32 characters) and
  Expo's `collapseId`, `threadId` and `tag`.
- **One attempt** sends to every live device. It succeeds if any took it, and fails to be
  retried only when none did; a member with no live device is **Failed** at once, as email
  is with no address.
- **An address is a bearer credential**: it is never logged, and no recorded reason quotes
  one.

## Threads

A type with a `thread()` keeps one unread bell item per member and thread
(`notification_items.thread`, unique while unread). An in-app send on a thread rewrites that
item in place and moves it to the top, keeping its id; a send whose subject is empty takes
the unread item away, and the member's clients are told `{removedId, unreadCount}`. Once
read, the item stays as it was, and the next send starts a new one. `thread_from` is the
point the item began, for a type that renders everything since. A push on a thread goes
only while the member's item is there, and carries it.

Event changes (sc-13214, `Domain\Messaging\EventChanges`) are the first: one thread per
event, `event-changes:{eventId}`. `EventChangeRecorder` writes each change told to members
to `event_changes`, from the editor, the lifecycle, the deleter and the restore command, and
schedules four types:

| Type                   | Channels            | When                                                    |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| `event_changes.item`   | in-app              | at once, for each change                                |
| `event_day.item`       | in-app              | at once, for each change on Event day                   |
| `event_changes.notice` | in-app, email, push | 15 minutes after the last edit, or at once on an action |
| `event_day.notice`     | in-app, email, push | the same; its email is off by default                   |

Each pair splits by the member's summary: a change on Event day (from 24 hours before the
earlier start to the later end) goes as `event_day`, which a mute does not silence. The
notice's key is the event's, so a further edit within the 15 minutes moves it on and the
window's start (`since`) is carried over. `EventChangeSummariser` reads what an item or a
notice says: each field from its first value to its last, credited to its last setter,
dropped when it reads the same on both sides or the member set it themselves, and every
action by somebody else. A notice whose summary for a member comes to nothing is cancelled
for that member, and their unread item is taken away.

## The alert

`app:notifications:check` runs every minute outside the worker and writes a `critical` log
line on each of three symptoms. A row is waiting once it is due and nothing holds it: not a
pause or a delete, not a retry's backoff, not a claim in progress.

- **Stopped**: a row has waited more than 5 minutes and nothing was claimed in the last 5.
- **Behind**: the oldest waiting row has waited more than 30 minutes.
- **Failing**: more than 5% of the last hour's sends ended Failed, in an hour of at least 20.

The local stack runs no scheduler, so run it by hand there. sc-1612 routes the lines.

## Deleted events

An event is soft-deleted (sc-3592) and purged 30 days later; its rows go with it under the
foreign key's cascade. The worker reads the event past the soft-delete filter, so a
deletion notice can still go after the delete. An event whose organisation is deleted
counts as deleted too. Its deletion notice still goes. Every other row it would still take
if it were not deleted waits for a restore (`held = 'deleted'`), rechecked every minute; a
row it would not take anyway, such as an automatic row once the event has finished, is
cancelled. A due row is held before fan-out, because a deleted organisation's members are
no longer an audience and a deleted event's guests are read through a live event, so a
fan-out would reach nobody. A held row past its too-late moment is recorded **Not sent:
too late**. Once the event or its organisation is restored, the held rows go within a
minute, each to its audience as it resolves then.

An organisation's rows with no event, scheduled for its members, wait for its restore in
the same way (sc-17126): while the organisation is deleted, a due row is held before
fan-out and a delivery already written is held, and both go within a minute of
`app:restore-organisation`. A row not yet due at the restore goes at its due time. Each row
names its audience's organisation (`organisation_id`), so at the organisation's purge
(`app:prune-deleted`) every row with no event goes with it, deliveries and all, whatever its
state, as an event's rows go with the event. This hold does not read the type's event rule, so a
deletion notice scheduled with no event would wait like any other row and go at the purge
unsent; an organisation-level deletion notice sent through the scheduler needs its own
exception here first.
