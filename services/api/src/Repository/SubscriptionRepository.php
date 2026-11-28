<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CatalogueVersion;
use App\Entity\Subscription;
use App\Enum\SubscriptionStatus;
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

    public function countOn(CatalogueVersion $version): int
    {
        return $this->count(['catalogueVersion' => $version]);
    }

    /** @return list<Subscription> those not on `$to`, and only those on `$from` when it is given */
    public function findToMove(CatalogueVersion $to, ?CatalogueVersion $from): array
    {
        $query = $this->createQueryBuilder('s')
            ->andWhere('s.catalogueVersion != :to')
            ->setParameter('to', $to->getId(), 'uuid')
            ->orderBy('s.id', 'ASC');

        if (null !== $from) {
            $query->andWhere('s.catalogueVersion = :from')->setParameter('from', $from->getId(), 'uuid');
        }

        /** @var list<Subscription> */
        return $query->getQuery()->getResult();
    }

    /** @return list<Subscription> those a provider bills and has not cancelled, for the nightly reconciliation (sc-3933) */
    public function findPaying(): array
    {
        /** @var list<Subscription> */
        return $this->createQueryBuilder('s')
            ->andWhere('s.externalRef IS NOT NULL')
            ->andWhere('s.status != :cancelled')
            ->setParameter('cancelled', SubscriptionStatus::Cancelled->value)
            ->orderBy('s.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
