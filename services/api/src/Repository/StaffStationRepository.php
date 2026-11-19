<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\StaffStation;
use App\Enum\StationKind;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<StaffStation> */
final class StaffStationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, StaffStation::class);
    }

    public function findOneInEvent(Event $event, Uuid $id): ?StaffStation
    {
        return $this->findOneBy(['event' => $event, 'id' => $id]);
    }

    /** @return list<StaffStation> the Pass first, then the places in their order */
    public function findPlaces(Event $event): array
    {
        return $this->findBy(['event' => $event, 'kind' => [StationKind::Pass, StationKind::Place]], ['position' => 'ASC', 'id' => 'ASC']);
    }

    /** @return list<StaffStation> every section's row, its section's or a removed one's */
    public function findSections(Event $event): array
    {
        return $this->findBy(['event' => $event, 'kind' => StationKind::Section], ['id' => 'ASC']);
    }

    public function findOneOfSection(SeatingSection $section): ?StaffStation
    {
        return $this->findOneBy(['section' => $section]);
    }
}
