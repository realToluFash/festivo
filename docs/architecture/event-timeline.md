# Event timeline

An event has one timeline: a dated list of milestones that every area adds to through one
contract (sc-3624, epic 29). Event View's **Coming up** and **All dates**, the **Next
up** line on Events Home and the organisation's **Calendar** all read it. No screen works out
a milestone for itself, so the three can never disagree about what is next.

The code is `App\Domain\Event\Timeline`, served at `GET /api/events/<id>/timeline`.

## The pieces

| Piece                      | What it is                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `MilestoneSourceInterface` | one area's milestones for one event, read on every request                          |
| `Milestone`                | a date-time, a title, an optional note, an owner, the area, an optional action      |
| `EventTimeline`            | merges every source, drops the areas the reader cannot see, sorts earliest first    |
| `EventDates`               | the first source: the event's own dates, as they happened                           |
| `nextUp()`                 | `packages/domain`: the one rule for which milestone is **Next up**, on every client |

## Adding an area's milestones

A source is a class implementing `MilestoneSourceInterface`. Autoconfiguration registers it,
and the timeline, the route and the clients do not change.

- **Read, never copied.** A source computes its milestones from the area's own data when the
  timeline is read. There is no milestone table: a stored copy goes stale the day the area's
  date moves and somebody forgets the copy (decided 19 Oct, sc-3624).
- **Every milestone names its area**, a `PermissionArea`. The timeline returns it only to a
  member whose role holds that area's read permission (`PermissionArea::reading()`), so a
  member without access to an area never sees its dates, on any screen.
- **Owner** is who it falls to: `event` for the event's own dates, `you` for something the
  organiser has to do, `automatic` for something Soirely does for them.
- **Title and note are written in the request's language**, from the API's catalogue. The
  note is one line, or none.
- **A title never carries its date or time.** Each screen shows those from `at`, in the
  event's zone and the reader's locale, so a time in the title would show twice and could
  disagree with the date line (decided 27 Oct, sc-3624).
- **An action** is a label and a path into the area, for a milestone the reader can act on.
  Neither client renders it yet: the first area that returns one adds it to both rows.
- **Coming up is held at two rows' height**, the most `EventDates` returns, so Finished and
  a failed load take the same room as the milestones and nothing below moves. The panel
  shows four: the first area that adds a milestone raises that floor to four rows, in
  `.coming-up-rows` (`apps/web/src/styles.css`, three widths) and `rows`/`rowsPhone`
  (`apps/mobile/src/components/Timeline.tsx`).
- **Two milestones at the same instant** keep the order their sources were read in.

`EventDates` is the worked example: the start is always there, titled "{name} starts", and
the end, "{name} ends", only when `EventDayCount` says the event touches more than one date.

## Once an event is Ended

The event's own milestones say what happened to it, not only what was planned (sc-16709):

- **Called off**, ended before its start: one milestone, "{name} called off", at the moment
  it was called off. Its start and end never happen, so neither is listed. Its page still
  shows the planned dates.
- **Ended early**, after its start: its start as planned, and its end, when it has one, at
  the moment it ended. That moment is the event's `concludedAt` (sc-3585).
- An event that ran its course, or a Live or Paused one past its end, keeps its planned dates.

So every date of the event's own has passed once it is Ended, and nothing of its own is
**Next up**. **Every other area decides in its own story** what its milestones do once the
event is Ended: a payment due after the event may still be owed, while meal picks closing
after a call-off are not. A source that says nothing keeps returning its dates as before.

## What the route serves

```json
{
  "timeZone": "Europe/Madrid",
  "milestones": [
    {
      "at": "2026-10-24T18:00:00+02:00",
      "title": "Boda en Madrid starts",
      "note": null,
      "owner": "event",
      "area": "events",
      "action": null
    }
  ]
}
```

`at` carries the offset in force in the event's zone on that date, as the event's own
`startsAt` does (sc-1486), so an event crossing a change of clocks has two offsets. It needs
**events.read**; another organisation's event is a 404, as every event route is.

`GET /api/orgs/<id>/events` carries the same `milestones` on every event it lists, read for
the same reader, so Events Home's **Next up** is the timeline's without one request per card
(sc-3594).

## Next up

`nextUp(milestones, now)` in `packages/domain` is the earliest milestone at or after `now`.
An overdue `you` milestone stays Next up until the area stops returning it, because a missed
deadline should not vanish from the screen. When every milestone has passed there is none.
A milestone is **Passed** once its instant is behind `now` and it is not Next up.
