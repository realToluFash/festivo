<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SchedulePress;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SchedulePress> */
final class SchedulePressRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SchedulePress::class);
    }

    /** @return list<SchedulePress> in the order they were pressed, the key breaking ties, leaving out those set aside */
    public function findStandingOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event, 'setAside' => false], ['pressedAt' => 'ASC', 'idempotencyKey' => 'ASC']);
    }

    public function findOneByKey(User $by, string $key): ?SchedulePress
    {
        return $this->findOneBy(['pressedBy' => $by, 'idempotencyKey' => $key]);
    }
}
