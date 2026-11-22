<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\DoorCode;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<DoorCode> */
final class DoorCodeRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DoorCode::class);
    }

    public function loads(): string
    {
        return DoorCode::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?DoorCode
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @param string $code normalised */
    public function findOneByCode(string $code): ?DoorCode
    {
        return $this->findOneBy(['code' => $code]);
    }

    /** @return list<DoorCode> the newest first */
    public function findOnEvent(Uuid $eventId): array
    {
        return $this->findBy(['event' => $eventId], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }
}
