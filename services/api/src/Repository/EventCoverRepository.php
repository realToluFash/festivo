<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\EventCover;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<EventCover> */
final class EventCoverRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EventCover::class);
    }

    public function findOneForEvent(Event $event): ?EventCover
    {
        return $this->findOneBy(['event' => $event]);
    }

    /**
     * @param list<Event> $events
     *
     * @return array<string, EventCover> by event id
     */
    public function findForEvents(array $events): array
    {
        if ([] === $events) {
            return [];
        }

        $covers = [];
        foreach ($this->findBy(['event' => $events]) as $cover) {
            $covers[$cover->getEvent()->getId()->toRfc4122()] = $cover;
        }

        return $covers;
    }
}
