<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffRate;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<StaffRate> */
final class StaffRateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffRate::class);
    }

    /** @return list<StaffRate> */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
    }

    public function findOfJob(StaffJob $job): ?StaffRate
    {
        return $this->findOneBy(['job' => $job]);
    }

    public function findOfPerson(StaffMember $person): ?StaffRate
    {
        return $this->findOneBy(['person' => $person]);
    }

    public function anyOnEvent(Event $event): bool
    {
        return null !== $this->findOneBy(['event' => $event]);
    }
}
