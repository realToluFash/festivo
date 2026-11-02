<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Event;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** After a tzdata change, re-derives the UTC columns of every event not yet over from its stored wall-clock times, with the save path's resolution. */
final readonly class EventTimesRecomputer
{
    private const int BATCH_SIZE = 200;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private NotificationScheduler $notificationScheduler,
    ) {
    }

    /** Without $write, counts what would change and writes nothing. */
    public function recompute(bool $write = true): int
    {
        $events = $this->entityManager->createQueryBuilder()
            ->select('e')
            ->from(Event::class, 'e')
            ->andWhere('e.closesAt > :now')
            ->setParameter('now', $this->clock->now()->setTimezone(new DateTimeZone('UTC')))
            ->orderBy('e.id')
            ->getQuery()
            ->toIterable();

        $changed = 0;

        foreach ($events as $event) {
            if (!$event->rederiveUtc(LocalTimeResolver::resolve(...))) {
                continue;
            }

            if ($write) {
                $this->notificationScheduler->rescheduleForNewZone($event);
            }

            if (0 === ++$changed % self::BATCH_SIZE) {
                $this->flush($write);
            }
        }

        $this->flush($write);

        return $changed;
    }

    private function flush(bool $write): void
    {
        if ($write) {
            $this->entityManager->flush();
        }

        $this->entityManager->clear();
    }
}
