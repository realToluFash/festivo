<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Organisation;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Event> */
final class EventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Event::class);
    }

    /** @return list<Event> soonest first, then by name */
    public function findInOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['startsAtUtc' => 'ASC', 'name' => 'ASC', 'id' => 'ASC']);
    }

    public function countInOrganisation(Organisation $organisation): int
    {
        return $this->count(['organisation' => $organisation]);
    }

    public function findOrganisationIdOf(Uuid $eventId): ?Uuid
    {
        $id = $this->createQueryBuilder('e')
            ->select('IDENTITY(e.organisation)')
            ->andWhere('e.id = :id')
            ->setParameter('id', $eventId, 'uuid')
            ->getQuery()
            ->getOneOrNullResult();

        return \is_array($id) && \is_string($id[1] ?? null) ? Uuid::fromString($id[1]) : null;
    }
}
