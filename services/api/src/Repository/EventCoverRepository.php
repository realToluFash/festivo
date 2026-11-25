<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\EventCover;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

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

    /** @return list<string> every cover its events hold, a deleted event's included until the purge removes it */
    public function photoKeysOf(Uuid $organisationId): array
    {
        return Type\vec(Type\string())->coerce($this->getEntityManager()->getConnection()->fetchFirstColumn(
            'SELECT c.photo_key FROM event_covers c JOIN events e ON e.id = c.event_id WHERE e.organisation_id = :organisation',
            ['organisation' => $organisationId->toRfc4122()],
        ));
    }
}
