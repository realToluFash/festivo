<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<VerificationChallenge> */
final class VerificationChallengeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, VerificationChallenge::class);
    }

    /** Unrevoked, not newest: `created_at` has second precision and cannot order two in one second. */
    public function findLiveFor(EmailAddress $address): ?VerificationChallenge
    {
        return $this->findOneBy(['emailAddress' => $address, 'revokedAt' => null]);
    }

    /** By id rather than `created_at`: a v7 id orders two challenges issued in the same second. */
    public function findNewestFor(EmailAddress $address): ?VerificationChallenge
    {
        return $this->findOneBy(['emailAddress' => $address], ['id' => 'DESC']);
    }

    /** @return list<VerificationChallenge> */
    public function findUnrevokedFor(EmailAddress $address): array
    {
        return $this->findBy(['emailAddress' => $address, 'revokedAt' => null]);
    }
}
