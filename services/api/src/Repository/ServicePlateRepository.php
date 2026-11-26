<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\ServicePlate;
use App\Entity\ServiceTray;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ServicePlate> */
final class ServicePlateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServicePlate::class);
    }

    public function findOneInEvent(Event $event, string $id): ?ServicePlate
    {
        return Uuid::isValid($id) ? $this->findOneBy(['event' => $event, 'id' => Uuid::fromString($id)]) : null;
    }

    /** @return list<ServicePlate> its orders and the plates owed for them, oldest first */
    public function findOfCourse(MenuCourse $course): array
    {
        return $this->findBy(['course' => $course], ['id' => 'ASC']);
    }

    /** @return list<ServicePlate> every plate for the table, of any course, oldest first */
    public function findAtTable(Event $event, string $tableKey): array
    {
        return $this->findBy(['event' => $event, 'tableKey' => $tableKey], ['id' => 'ASC']);
    }

    /** @return list<ServicePlate> */
    public function findOnTray(ServiceTray $tray): array
    {
        return $this->findBy(['tray' => $tray], ['id' => 'ASC']);
    }

    /** @return list<ServicePlate> every plate on any of the trays */
    public function findOnTrays(array $trays): array
    {
        return [] === $trays ? [] : $this->findBy(['tray' => $trays], ['id' => 'ASC']);
    }

    /** @return list<ServicePlate> the guest's orders */
    public function findOrdersOf(Guest $guest): array
    {
        return $this->findBy(['guest' => $guest, 'isOrder' => true]);
    }
}
