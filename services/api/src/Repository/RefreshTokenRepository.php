<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\RefreshToken;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<RefreshToken> */
final class RefreshTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RefreshToken::class);
    }

    public function findOneByHash(string $tokenHash): ?RefreshToken
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    /** @return list<RefreshToken> */
    public function findChain(Uuid $chainId): array
    {
        return $this->findBy(['chainId' => $chainId]);
    }

    /** @return list<RefreshToken> */
    public function findUsableFor(User $user): array
    {
        return $this->createQueryBuilder('t')
            ->andWhere('t.user = :user')
            ->andWhere('t.revokedAt IS NULL')
            ->andWhere('t.expiresAt > CURRENT_TIMESTAMP()')
            ->setParameter('user', $user)
            ->orderBy('t.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
