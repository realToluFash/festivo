<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\Event;
use App\Enum\EventPhase;
use App\Enum\ServicePhase;
use App\Repository\ServiceFiringRepository;
use DateTimeImmutable;
use Psl\Vec;

/** Service is on from the first course fired until the event is Finished, and a pause leaves it as it was (sc-4028, decided 26 Nov); sc-4009's Start service and End service replace this reading. */
final readonly class ServicePhases
{
    public function __construct(
        private ServiceFiringRepository $serviceFiringRepository,
    ) {
    }

    public function of(Event $event, DateTimeImmutable $now): ServicePhase
    {
        if (self::finished($event, $now)) {
            return ServicePhase::Ended;
        }

        return $this->serviceFiringRepository->anyOn($event) ? ServicePhase::On : ServicePhase::NotStarted;
    }

    /** @return list<Event> */
    public function on(DateTimeImmutable $now): array
    {
        return Vec\filter($this->serviceFiringRepository->findEventsFiredBy($now), static fn (Event $event): bool => !self::finished($event, $now));
    }

    private static function finished(Event $event, DateTimeImmutable $now): bool
    {
        return EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
    }
}
