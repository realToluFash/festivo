<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\DoorCode;
use App\Entity\DoorCodeRedemption;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Dict;
use Psl\Type;

/** @extends ServiceEntityRepository<DoorCodeRedemption> */
final class DoorCodeRedemptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DoorCodeRedemption::class);
    }

    public function findOneFor(DoorCode $doorCode, User $user): ?DoorCodeRedemption
    {
        return $this->findOneBy(['doorCode' => $doorCode, 'user' => $user]);
    }

    public function countFor(DoorCode $doorCode): int
    {
        return $this->count(['doorCode' => $doorCode]);
    }

    /**
     * @param list<DoorCode> $doorCodes
     *
     * @return array<string, int> uses by code id
     */
    public function countsFor(array $doorCodes): array
    {
        if ([] === $doorCodes) {
            return [];
        }

        $rows = Type\vec(Type\shape(['id' => Type\string(), 'used' => Type\int()]))->coerce(
            $this->createQueryBuilder('r')
                ->select('IDENTITY(r.doorCode) AS id', 'COUNT(r.id) AS used')
                ->where('r.doorCode IN (:codes)')
                ->setParameter('codes', $doorCodes)
                ->groupBy('r.doorCode')
                ->getQuery()
                ->getArrayResult(),
        );

        return Dict\pull($rows, static fn (array $row): int => $row['used'], static fn (array $row): string => $row['id']);
    }
}
