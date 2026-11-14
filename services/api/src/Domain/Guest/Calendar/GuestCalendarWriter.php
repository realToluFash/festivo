<?php

declare(strict_types=1);

namespace App\Domain\Guest\Calendar;

use App\Domain\Event\CalendarFeed\CalendarFeedWriter;
use App\Domain\Event\CalendarFeed\ICalendarLines;
use App\Domain\Event\CalendarFeed\TimeZoneDefinition;
use App\Domain\Guest\Link\InvitationLinks;
use App\Entity\Guest;
use App\Enum\FeedEntryStatus;
use App\Enum\GuestReply;
use DateTimeZone;
use Psl\Str;
use SensitiveParameter;

/**
 * One guest's invitation as one iCalendar (sc-3627): the event's VTIMEZONE always, and its VEVENT only while the guest's answer is Coming, so changing the answer takes the entry out of their calendar and changing it back returns it under the same UID. Nothing about any other guest.
 */
final readonly class GuestCalendarWriter
{
    private const string REFRESH = 'PT4H';

    public function __construct(
        private string $webOrigin,
    ) {
    }

    public function write(Guest $guest, FeedEntryStatus $status, #[SensitiveParameter] string $token): string
    {
        $event = $guest->getEvent();
        $zone = new DateTimeZone($event->getTimeZone());
        $end = CalendarFeedWriter::endOf($event);
        $venue = CalendarFeedWriter::venueLine($event);
        $link = Str\trim_right($this->webOrigin, '/') . InvitationLinks::PATH . $token;
        $entry = GuestReply::Coming !== $guest->getReply() ? [] : [
            'BEGIN:VEVENT',
            'UID:guest-' . $guest->getId()->toRfc4122() . '@soirely',
            'DTSTAMP:' . ICalendarLines::utc($event->getCalendarChangedAt()),
            'CREATED:' . ICalendarLines::utc($event->getCreatedAt()),
            'LAST-MODIFIED:' . ICalendarLines::utc($event->getCalendarChangedAt()),
            'SEQUENCE:' . $event->getCalendarSequence(),
            'DTSTART;TZID=' . $zone->getName() . ':' . ICalendarLines::local($event->getStartsAt(), $zone),
            'DTEND;TZID=' . $zone->getName() . ':' . ICalendarLines::local($end, $zone),
            'SUMMARY:' . ICalendarLines::text($event->getName()),
            ...(null === $venue ? [] : ['LOCATION:' . ICalendarLines::text($venue)]),
            'DESCRIPTION:' . ICalendarLines::text($link),
            'URL:' . $link,
            'STATUS:' . $status->value,
            'TRANSP:OPAQUE',
            'END:VEVENT',
        ];

        return ICalendarLines::join([
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Soirely//Guest calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' . ICalendarLines::text($event->getName()),
            'REFRESH-INTERVAL;VALUE=DURATION:' . self::REFRESH,
            'X-PUBLISHED-TTL:' . self::REFRESH,
            ...TimeZoneDefinition::lines($zone, $event->getStartsAt()->modify('-1 day'), $end->modify('+1 day')),
            ...$entry,
            'END:VCALENDAR',
        ]);
    }
}
