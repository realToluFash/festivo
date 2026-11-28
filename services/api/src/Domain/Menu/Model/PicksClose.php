<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

use App\Domain\Event\Model\ReplyDeadline;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Enum\PicksCloseSource;
use DateTimeImmutable;
use DateTimeZone;

/** The one rule for when a course's picks close (sc-3905): the end of the course's choose-by date (sc-1362), else of the event's Reply by, else the event's start. Each date ends at 23:59:59 in the event's zone. */
final readonly class PicksClose
{
    public function __construct(
        public DateTimeImmutable $at,
        public PicksCloseSource $source,
    ) {
    }

    public static function of(Event $event, ?MenuCourse $course = null): self
    {
        $chooseBy = $course?->getChooseBy();

        if (null !== $chooseBy) {
            return new self(new DateTimeImmutable($chooseBy->format('Y-m-d') . ' 23:59:59', new DateTimeZone($event->getTimeZone())), PicksCloseSource::ChooseBy);
        }

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
