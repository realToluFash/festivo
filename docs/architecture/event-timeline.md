# Event timeline

An event has one timeline: a dated list of milestones that every area adds to through one
contract (sc-3624, epic 29). Event View's **Coming up** and **Full schedule**, the **Next
up** line on Events Home and the organisation's **Calendar** all read it. No screen works out
a milestone for itself, so the three can never disagree about what is next.

The code is `App\Domain\Event\Timeline`, served at `GET /api/events/<id>/timeline`.

## The pieces

| Piece                      | What it is                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `MilestoneSourceInterface` | one area's milestones for one event, read on every request                          |
| `Milestone`                | a date-time, a title, an optional note, an owner, the area, an optional action      |
| `EventTimeline`            | merges every source, drops the areas the reader cannot see, sorts earliest first    |
| `EventDates`               | the first source: the event's own start, and its end when it runs over one day      |
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
- **An action** is a label and a path into the area, for a milestone the reader can act on.
- **Two milestones at the same instant** keep the order their sources were read in.

`EventDates` is the worked example: the start is always there, titled "{name} starts", and
the end, "{name} ends", only when `EventDayCount` says the event touches more than one date.

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

## Next up

`nextUp(milestones, now)` in `packages/domain` is the earliest milestone at or after `now`.
An overdue `you` milestone stays Next up until the area stops returning it, because a missed
deadline should not vanish from the screen. When every milestone has passed there is none.
A milestone is **Passed** once its instant is behind `now` and it is not Next up.
