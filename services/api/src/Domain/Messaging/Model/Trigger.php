<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Psl\Regex;
use Psl\Str;
use Psl\Type;

/** Days and the time of day count on the event's own clock (sc-98), so "the day before at 10:00" stays 10:00 across a DST change. */
final readonly class Trigger
{
    private function __construct(
        public EventAnchor $anchor,
        public ?DateTimeImmutable $date,
        public string $offset,
        public ?string $timeOfDay,
    ) {
        if (null === Regex\first_match($offset, '/^-?P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/')) {
            throw new InvalidArgumentException('A trigger offset is an ISO 8601 duration, such as -P7D.');
        }

        if (null !== $timeOfDay && null === Regex\first_match($timeOfDay, '/^([01]\d|2[0-3]):[0-5]\d$/')) {
            throw new InvalidArgumentException('A trigger time of day is HH:MM.');
        }
    }

    public static function at(DateTimeImmutable $moment): self
    {
        return new self(EventAnchor::Date, $moment, 'PT0S', null);
    }

    /** A date that belongs to something else, a payment's due date say. */
    public static function relativeTo(DateTimeImmutable $date, string $offset, ?string $timeOfDay = null): self
    {
        return new self(EventAnchor::Date, $date, $offset, $timeOfDay);
    }

    /** Re-scheduled whenever the event's date, time or zone changes. */
    public static function relativeToEvent(EventAnchor $anchor, string $offset, ?string $timeOfDay = null): self
    {
        if (EventAnchor::Date === $anchor) {
            throw new InvalidArgumentException('An event trigger counts from its start or its end.');
        }

        return new self($anchor, null, $offset, $timeOfDay);
    }

    public function followsEvent(): bool
    {
        return EventAnchor::Date !== $this->anchor;
    }

    /** @return array<string, ?string> */
    public function toArray(): array
    {
        return [
            'anchor' => $this->anchor->value,
            'date' => $this->date?->format(\DATE_ATOM),
            'offset' => $this->offset,
            'timeOfDay' => $this->timeOfDay,
        ];
    }

    /** @param array<array-key, mixed> $stored */
    public static function fromArray(array $stored): self
    {
        $shape = Type\shape([
            'anchor' => Type\backed_enum(EventAnchor::class),
            'date' => Type\nullable(Type\string()),
            'offset' => Type\string(),
            'timeOfDay' => Type\nullable(Type\string()),
        ])->coerce($stored);

        return new self($shape['anchor'], null === $shape['date'] ? null : new DateTimeImmutable($shape['date']), $shape['offset'], $shape['timeOfDay']);
    }

    /** In UTC. An event anchor needs the event's times; a bare date with no event is counted in UTC. */
    public function dueAt(?EventTimes $event): DateTimeImmutable
    {
        $zone = new DateTimeZone($event->timeZone ?? 'UTC');
        $from = match ($this->anchor) {
            EventAnchor::Date => $this->date,
            EventAnchor::EventStart => $event?->startsAt,
            EventAnchor::EventEnd => $event?->endsAt,
        } ?? throw new InvalidArgumentException('This trigger counts from an event, and has none.');

        $local = $from->setTimezone($zone);
        $interval = new DateInterval(Str\trim_left($this->offset, '-'));
        $local = Str\starts_with($this->offset, '-') ? $local->sub($interval) : $local->add($interval);

        if (null !== $this->timeOfDay) {
            $local = $local->setTime((int) Str\slice($this->timeOfDay, 0, 2), (int) Str\slice($this->timeOfDay, 3, 2));
        }

        return $local->setTimezone(new DateTimeZone('UTC'));
    }
}
