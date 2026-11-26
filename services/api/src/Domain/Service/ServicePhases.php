<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\Event;
use App\Enum\EventPhase;
use App\Enum\ServicePhase;
use App\Repository\ServiceFiringRepository;
use DateTimeImmutable;
use Psl\Vec;

/** Service is on from the first course fired until the event stops Happening now; sc-4009's Start service and End service replace this reading. */
final readonly class ServicePhases
{
    public function __construct(
        private ServiceFiringRepository $serviceFiringRepository,
    ) {
    }

    public function of(Event $event, DateTimeImmutable $now): ServicePhase
    {
        if (!$this->serviceFiringRepository->anyOn($event)) {
            return ServicePhase::NotStarted;
        }

        return self::happening($event, $now) ? ServicePhase::On : ServicePhase::Ended;
    }

    /** @return list<Event> */
    public function on(DateTimeImmutable $now): array
    {
        return Vec\filter($this->serviceFiringRepository->findEventsFiredBy($now), static fn (Event $event): bool => self::happening($event, $now));
    }

    private static function happening(Event $event, DateTimeImmutable $now): bool
    {
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);

        return EventPhase::HappeningNow === $phase || EventPhase::Paused === $phase;
    }
}
