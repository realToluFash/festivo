<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffJob;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<StaffJob> */
final class StaffJobRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffJob::class);
    }

    public function loads(): string
    {
        return StaffJob::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?StaffJob
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<StaffJob> in the event's order */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['position' => 'ASC', 'id' => 'ASC']);
    }
}
