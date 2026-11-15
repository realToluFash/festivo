<?php

declare(strict_types=1);

namespace App\Domain\Event\Model;

use App\Entity\Event;
use DateTimeImmutable;
use DateTimeZone;

/** The one rule for whether replies have closed by Reply by (sc-3780): from 23:59:59 on that day in the event's zone, whatever the clocks do that day. */
final readonly class ReplyDeadline
{
    public function __construct(
        public string $day,
        public DateTimeZone $zone,
    ) {
    }

    public static function of(Event $event): ?self
    {
        $day = $event->getReplyBy();

        return null === $day ? null : new self($day->format('Y-m-d'), new DateTimeZone($event->getTimeZone()));
    }

    public function closesAt(): DateTimeImmutable
    {
        return new DateTimeImmutable($this->day . ' 23:59:59', $this->zone);
    }

    public function passedAt(DateTimeImmutable $now): bool
    {
        return $now >= $this->closesAt();
    }

    /** The day replies closed: the day a save closed them, or Reply by itself; null while they are open. */
    public static function closedOn(Event $event, DateTimeImmutable $now): ?string
    {
        $deadline = self::of($event);

        if (null === $deadline || !$deadline->passedAt($now)) {
            return null;
        }

        return $event->getRepliesClosedOn()?->format('Y-m-d') ?? $deadline->day;
    }
}
