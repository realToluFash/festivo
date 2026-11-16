<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PasswordResetToken;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PasswordResetToken> */
final class PasswordResetTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PasswordResetToken::class);
    }

    public function findOneByHash(string $tokenHash): ?PasswordResetToken
    {
        return $this->findOneBy(['tokenHash' => $tokenHash]);
    }

    /** Once a password is set, every other link the account was sent stops working too. */
    public function spendAllFor(User $user, DateTimeImmutable $now): void
    {
        $this->getEntityManager()
            ->createQuery('UPDATE ' . PasswordResetToken::class . ' t SET t.usedAt = :now WHERE t.user = :user AND t.usedAt IS NULL')
            ->setParameter('now', $now, Types::DATETIME_IMMUTABLE)
            ->setParameter('user', $user)
            ->execute();
    }
}
