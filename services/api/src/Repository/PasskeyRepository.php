<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Passkey;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Passkey> */
final class PasskeyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Passkey::class);
    }

    /** @return list<Passkey> newest first */
    public function findFor(User $user): array
    {
        return Vec\values($this->findBy(['user' => $user], ['createdAt' => 'DESC', 'id' => 'DESC']));
    }

    public function countFor(User $user): int
    {
        return $this->count(['user' => $user]);
    }

    public function findOneOf(User $user, #[SensitiveParameter] string $credentialId): ?Passkey
    {
        return $this->findOneBy(['user' => $user, 'credentialId' => $credentialId]);
    }

    public function findOneById(User $user, Uuid $id): ?Passkey
    {
        return $this->findOneBy(['user' => $user, 'id' => $id]);
    }
}
