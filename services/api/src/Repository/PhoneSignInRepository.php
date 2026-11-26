<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\DoorCode;
use App\Entity\PhoneSignIn;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Vec;

/** @extends ServiceEntityRepository<PhoneSignIn> */
final class PhoneSignInRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PhoneSignIn::class);
    }

    public function findOneByHandleHash(string $handleHash): ?PhoneSignIn
    {
        return $this->findOneBy(['handleHash' => $handleHash]);
    }

    /** @return list<DateTimeImmutable> when each send on the code since then started, oldest first */
    public function sentForDoorCodeSince(DoorCode $doorCode, DateTimeImmutable $since): array
    {
        /** @var list<array{createdAt: DateTimeImmutable}> $rows */
        $rows = $this->createQueryBuilder('s')
            ->select('s.createdAt')
            ->where('s.doorCode = :doorCode')
            ->andWhere('s.createdAt >= :since')
            ->setParameter('doorCode', $doorCode)
            ->setParameter('since', $since, Types::DATETIME_IMMUTABLE)
            ->orderBy('s.createdAt', 'ASC')
            ->getQuery()
            ->getArrayResult();

        return Vec\map($rows, static fn (array $row): DateTimeImmutable => $row['createdAt']);
    }

    /** @return int how many were deleted, their codes with them */
    public function deleteExpired(DateTimeImmutable $now): int
    {
        return (int) $this->getEntityManager()
            ->createQuery('DELETE FROM ' . PhoneSignIn::class . ' s WHERE s.openUntil <= :now')
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->execute();
    }
}
