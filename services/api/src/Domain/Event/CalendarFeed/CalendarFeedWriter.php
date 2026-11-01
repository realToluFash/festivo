<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use App\Deletion\RestoreWindow;
use App\Domain\Event\EventVenue;
use App\Domain\Event\Timeline\EventDates;
use App\Domain\Event\Timeline\EventTimeline;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\EventPhase;
use App\Enum\FeedEntryStatus;
use App\Http\Access\Grants;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Math;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * An organisation's events and the milestones the areas add to them as one iCalendar (RFC 5545) for one reader (sc-3626). It holds only names, times, venue lines, status words and links: nothing about guests and no money.
 */
final readonly class CalendarFeedWriter
{
    /** "Your calendar app checks for changes every few hours." */
    private const string REFRESH = 'PT4H';

    public function __construct(
        private EventTimeline $eventTimeline,
        private TranslatorInterface $translator,
        private string $webOrigin,
    ) {
    }

    /** @param list<Event> $events every event of the organisation, deleted ones included */
    public function write(Organisation $organisation, array $events, Grants $grants, DateTimeImmutable $now): string
    {
        $entries = [];
        $instants = [];
        $keptAfter = RestoreWindow::openForDeletionsAfter($now);

        foreach ($events as $event) {
            $status = FeedEntryStatus::of($event->getDeletedAt(), $event->getEndedAt(), $event->getStartsAt(), $keptAfter);

            if (null === $status) {
                continue;
            }

            $zone = new DateTimeZone($event->getTimeZone());
            $milestones = FeedEntryStatus::Confirmed === $status ? $this->areaMilestones($event, $grants) : [];
            $entries = [...$entries, ...$this->event($event, $zone, $status, $now)];

            foreach ($milestones as $milestone) {
                $entries = [...$entries, ...$this->milestone($event, $zone, $milestone->key, $milestone->at, $milestone->title, $milestone->note, $milestone->action?->link)];
            }

            $instants[$zone->getName()] = [
                ...$instants[$zone->getName()] ?? [],
                $event->getStartsAt()->getTimestamp(),
                $this->endOf($event)->getTimestamp(),
                ...Vec\map($milestones, static fn (Milestone $milestone): int => $milestone->at->getTimestamp()),
            ];
        }

        $zones = [];

        foreach (Dict\sort_by_key($instants) as $name => $times) {
            $zones = [...$zones, ...TimeZoneDefinition::lines(new DateTimeZone($name), new DateTimeImmutable('@' . Math\min($times))->modify('-1 day'), new DateTimeImmutable('@' . Math\max($times))->modify('+1 day'))];
        }

        return ICalendarLines::join([
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Soirely//Calendar feed//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' . ICalendarLines::text($organisation->getName()),
            'REFRESH-INTERVAL;VALUE=DURATION:' . self::REFRESH,
            'X-PUBLISHED-TTL:' . self::REFRESH,
            ...$zones,
            ...$entries,
            'END:VCALENDAR',
        ]);
    }

    /** @return list<Milestone> its timeline less the event's own dates, which its DTSTART and DTEND already say, so it shows once in a calendar app (sc-3626) */
    private function areaMilestones(Event $event, Grants $grants): array
    {
        return Vec\filter($this->eventTimeline->of($event, $grants), static fn (Milestone $milestone): bool => !Str\starts_with($milestone->key, EventDates::KEY_PREFIX));
    }

    /** @return list<string> */
    private function event(Event $event, DateTimeZone $zone, FeedEntryStatus $status, DateTimeImmutable $now): array
    {
        $tzid = ';TZID=' . $zone->getName();
        $word = $this->statusWord($event, $now);
        $link = $this->link('/app/events/' . $event->getId()->toRfc4122());
        $summary = EventPhase::Paused === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now) && null === $event->getDeletedAt()
            ? $this->translator->trans('calendar_feed.paused_summary', ['{name}' => $event->getName()])
            : $event->getName();
        $venue = $this->venueLine($event);

        return [
            'BEGIN:VEVENT',
            'UID:event-' . $event->getId()->toRfc4122() . '@soirely',
            'DTSTAMP:' . ICalendarLines::utc($event->getUpdatedAt()),
            'CREATED:' . ICalendarLines::utc($event->getCreatedAt()),
            'LAST-MODIFIED:' . ICalendarLines::utc($event->getUpdatedAt()),
            'SEQUENCE:' . $event->getVersion(),
            'DTSTART' . $tzid . ':' . ICalendarLines::local($event->getStartsAt(), $zone),
            'DTEND' . $tzid . ':' . ICalendarLines::local($this->endOf($event), $zone),
            'SUMMARY:' . ICalendarLines::text($summary),
            ...(null === $venue ? [] : ['LOCATION:' . ICalendarLines::text($venue)]),
            'DESCRIPTION:' . ICalendarLines::text($this->translator->trans('calendar_feed.status_line', ['{status}' => $word]) . "\n" . $this->translator->trans('calendar_feed.open_line', ['{link}' => $link])),
            'URL:' . $link,
            'STATUS:' . $status->value,
            'TRANSP:OPAQUE',
            'END:VEVENT',
        ];
    }

    /** @return list<string> */
    private function milestone(Event $event, DateTimeZone $zone, string $key, DateTimeImmutable $at, string $title, ?string $note, ?string $path): array
    {
        $link = $this->link($path ?? '/app/events/' . $event->getId()->toRfc4122() . '/dates');
        $description = (null === $note ? '' : $note . "\n") . $this->translator->trans('calendar_feed.open_line', ['{link}' => $link]);

        return [
            'BEGIN:VEVENT',
            'UID:milestone-' . $event->getId()->toRfc4122() . '-' . Str\lowercase(\rawurlencode($key)) . '@soirely',
            'DTSTAMP:' . ICalendarLines::utc($event->getUpdatedAt()),
            'SEQUENCE:' . $event->getVersion(),
            'DTSTART;TZID=' . $zone->getName() . ':' . ICalendarLines::local($at, $zone),
            'SUMMARY:' . ICalendarLines::text($title),
            'DESCRIPTION:' . ICalendarLines::text($description),
            'URL:' . $link,
            'STATUS:' . FeedEntryStatus::Confirmed->value,
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        ];
    }

    /** Ended early after its start, it ends when it was ended, as its own timeline says (sc-16709). */
    private function endOf(Event $event): DateTimeImmutable
    {
        $endedAt = $event->getEndedAt();

        return null !== $endedAt && $endedAt > $event->getStartsAt() && $endedAt < $event->getEndsAt() ? $endedAt : $event->getEndsAt();
    }

    private function statusWord(Event $event, DateTimeImmutable $now): string
    {
        $key = match (true) {
            null !== $event->getDeletedAt() => 'deleted',
            EventPhase::calledOff($event->getEndedAt(), $event->getStartsAt()) => 'called_off',
            default => match (EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now)) {
                EventPhase::Draft => 'draft',
                EventPhase::Live, EventPhase::HappeningNow => 'live',
                EventPhase::Paused => 'paused',
                EventPhase::Finished => 'finished',
            },
        };

        return $this->translator->trans('calendar_feed.status.' . $key);
    }

    private function venueLine(Event $event): ?string
    {
        $venue = EventVenue::of($event);

        if (null === $venue) {
            return null;
        }

        $parts = Vec\filter_nulls([$venue->name, $venue->address?->formatted]);

        return Str\join($parts, ', ');
    }

    private function link(string $path): string
    {
        return Str\trim_right($this->webOrigin, '/') . $path;
    }
}
