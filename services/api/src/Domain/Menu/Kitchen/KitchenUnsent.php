<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Domain\Event\Timeline\Interfaces\TimelineOpenedInterface;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Entity\Event;
use App\Entity\KitchenFinalNumbers;
use App\Repository\KitchenCopyRepository;
use App\Repository\KitchenFinalNumbersRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/** Since when the sheet has held a change no copy has (sc-30692). Marked after every write that can move it, and checked again when one event's timeline is read, which is how a close that passes is seen; the events list and the calendar feed only read what is stored. */
final readonly class KitchenUnsent implements TimelineOpenedInterface
{
    public function __construct(
        private KitchenFinalNumbersRepository $kitchenFinalNumbersRepository,
        private KitchenCopyRepository $kitchenCopyRepository,
        private KitchenSinceCopy $kitchenSinceCopy,
        private MenuSerialiser $menuSerialiser,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** A course that has closed since the last write changed the sheet with nothing to announce it. */
    public function opened(Event $event): void
    {
        try {
            $this->check($event, true);
        } catch (Throwable $e) {
            // The next read of the timeline checks again.
            $this->logger->error('The kitchen sheet could not be compared with its latest copy.', ['eventId' => $event->getId()->toRfc4122(), 'exception' => $e::class]);
        }
    }

    /**
     * @param bool $onRead no write announced this change, so a course close passed since the copy is when it happened
     */
    public function check(Event $event, bool $onRead): void
    {
        $now = $this->clock->now();

        if (null !== $event->getEndedAt() || $now >= $event->getStartsAt()) {
            return;
        }

        $copy = $this->kitchenCopyRepository->findLatestForEvent($event);

        if (null === $copy) {
            return;
        }

        $final = $this->kitchenFinalNumbersRepository->findOneForEvent($event) ?? new KitchenFinalNumbers($event);
        $differs = [] !== $this->kitchenSinceCopy->of($event, $copy)['lines'];

        if ($differs === (null !== $final->getDiffersSince())) {
            return;
        }

        $from = $onRead ? $this->closedSince($event, $copy->getRecordedAt(), $now) ?? $now : $now;
        $final->setDiffersSince($differs ? $from : null);
        $this->entityManager->persist($final);
        $this->entityManager->flush();
    }

    private function closedSince(Event $event, DateTimeImmutable $since, DateTimeImmutable $now): ?DateTimeImmutable
    {
        $closes = Vec\filter(
            Vec\map(
                Vec\filter_nulls(Vec\map(
                    $this->menuSerialiser->menu($event)['courses'],
                    static fn (array $course): ?string => Type\nullable(Type\shape(['at' => Type\string()], true))->coerce($course['picksClose'] ?? null)['at'] ?? null,
                )),
                static fn (string $at): DateTimeImmutable => new DateTimeImmutable($at),
            ),
            static fn (DateTimeImmutable $at): bool => $at > $since && $at <= $now,
        );

        return Vec\sort_by($closes, static fn (DateTimeImmutable $at): int => $at->getTimestamp())[0] ?? null;
    }
}
