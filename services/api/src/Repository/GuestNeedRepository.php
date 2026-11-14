<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestNeed;
use App\Enum\NeedKind;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Psl\Vec;

/** @extends ServiceEntityRepository<GuestNeed> */
final class GuestNeedRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GuestNeed::class);
    }

    /**
     * @param list<Guest> $guests
     *
     * @return list<GuestNeed>
     */
    public function findFor(array $guests): array
    {
        if ([] === $guests) {
            return [];
        }

        /** @var list<GuestNeed> */
        return $this->createQueryBuilder('n')
            ->where('n.guest IN (:guests)')
            ->setParameter('guests', $guests)
            ->getQuery()
            ->getResult();
    }

    public function removeFor(Guest $guest): void
    {
        $this->createQueryBuilder('n')
            ->delete()
            ->where('n.guest = :guest')
            ->setParameter('guest', $guest->getId(), 'uuid')
            ->getQuery()
            ->execute();
    }

    /**
     * Everyone on the event's list with each code, counted once however the guest is related to it (sc-99).
     *
     * @return list<array{kind: NeedKind, code: string, people: int}>
     */
    public function countByCode(Event $event): array
    {
        $rows = $this->createQueryBuilder('n')
            ->select('n.kind AS kind', 'n.code AS code', 'COUNT(DISTINCT g.id) AS people')
            ->innerJoin('n.guest', 'g')
            ->where('g.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->groupBy('n.kind', 'n.code')
            ->getQuery()
            ->getArrayResult();

        return Vec\map($rows, static function (mixed $row): array {
            $row = Type\shape(['kind' => Type\instance_of(NeedKind::class), 'code' => Type\string(), 'people' => Type\int()])->coerce($row);

            return ['kind' => $row['kind'], 'code' => $row['code'], 'people' => $row['people']];
        });
    }
}
