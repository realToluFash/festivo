<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\ServiceTray;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ServiceTray> */
final class ServiceTrayRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceTray::class);
    }

    public function findOneInEvent(Event $event, string $id): ?ServiceTray
    {
        return Uuid::isValid($id) ? $this->findOneBy(['event' => $event, 'id' => Uuid::fromString($id)]) : null;
    }

    /**
     * @param list<string> $ids
     *
     * @return list<ServiceTray> oldest first
     */
    public function findIn(array $ids): array
    {
        return [] === $ids ? [] : $this->findBy(['id' => $ids], ['id' => 'ASC']);
    }
}
