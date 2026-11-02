<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\JoinOfferDismissal;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Vec;

/** @extends ServiceEntityRepository<JoinOfferDismissal> */
final class JoinOfferDismissalRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, JoinOfferDismissal::class);
    }

    /** @return list<string> the organisations this account said Not now to */
    public function findOrganisationIdsDismissedBy(User $user): array
    {
        return Vec\map(
            $this->findBy(['user' => $user]),
            static fn (JoinOfferDismissal $dismissal): string => $dismissal->getOrganisation()->getId()->toRfc4122(),
        );
    }
}
