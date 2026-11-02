<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Entity\Event;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;

/** Whether, when and where: what of an event its members are told of when it moves (sc-13214). Taken before a change and after it. */
final readonly class EventDetails
{
    /** In the order their lines are shown (sc-3980). */
    public const array FIELDS = ['date', 'startTime', 'endTime', 'timeZone', 'venue'];

    public function __construct(
        public DateTimeImmutable $startsAt,
        public DateTimeImmutable $endsAt,
        public string $timeZone,
        public ?string $venueName,
        public ?string $venueAddress,
    ) {
    }

    public static function of(Event $event): self
    {
        return new self($event->getStartsAt(), $event->getEndsAt(), $event->getTimeZone(), $event->getVenueName(), $event->getVenueAddress());
    }

    /**
     * On the event's own clock. An end on another day than the start keeps its date, so its line can carry the weekday (sc-4235).
     *
     * @return array{date: string, startTime: string, endTime: string, timeZone: string, venue: ?array{name: ?string, address: ?string}}
     */
    public function fields(): array
    {
        $starts = $this->startsAt->setTimezone(new DateTimeZone($this->timeZone));
        $ends = $this->endsAt->setTimezone(new DateTimeZone($this->timeZone));

        return [
            'date' => $starts->format('Y-m-d'),
            'startTime' => $starts->format('H:i'),
            'endTime' => $ends->format('Y-m-d') === $starts->format('Y-m-d') ? $ends->format('H:i') : $ends->format('Y-m-d H:i'),
            'timeZone' => $this->timeZone,
            'venue' => null === $this->venueName && null === $this->venueAddress ? null : ['name' => $this->venueName, 'address' => $this->venueAddress],
        ];
    }

    /** @return array<string, array{0: mixed, 1: mixed}> each field that differs, before and after */
    public static function moved(self $before, self $after): array
    {
        $was = $before->fields();
        $is = $after->fields();

        return Dict\map_with_key(
            Dict\filter_with_key($is, static fn (string $field, mixed $value): bool => $was[$field] !== $value),
            static fn (string $field, mixed $value): array => [$was[$field], $value],
        );
    }
}
