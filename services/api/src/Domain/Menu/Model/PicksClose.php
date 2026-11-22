<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

use App\Domain\Event\Model\ReplyDeadline;
use App\Entity\Event;
use App\Enum\PicksCloseSource;
use DateTimeImmutable;

/** The one rule for when a course's picks close (sc-3905): the end of the event's Reply by, else the event's start. Nobody types it, and every event has a start, so it always ends. */
final readonly class PicksClose
{
    public function __construct(
        public DateTimeImmutable $at,
        public PicksCloseSource $source,
    ) {
    }

    public static function of(Event $event): self
    {
        $replyBy = ReplyDeadline::of($event);

        return null === $replyBy
            ? new self($event->getStartsAt(), PicksCloseSource::Start)
            : new self($replyBy->closesAt(), PicksCloseSource::ReplyBy);
    }

    public function passedAt(DateTimeImmutable $now): bool
    {
        return $now >= $this->at;
    }
}
