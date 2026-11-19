<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Subscription;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use LogicException;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Subscription> */
final class SubscriptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Subscription::class);
    }

    /** Every organisation has one from the moment it is created (sc-3927), so none is a fault, not Free. */
    public function findCurrentOf(Uuid $organisationId): Subscription
    {
        return $this->findOneBy(['organisation' => $organisationId])
            ?? throw new LogicException('An organisation has no subscription.');
    }
}
