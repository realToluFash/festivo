<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organisation;
use App\Entity\SsoProvider;
use App\Enum\SsoStanding;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SsoProvider> */
final class SsoProviderRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SsoProvider::class);
    }

    public function findStanding(Organisation $organisation, SsoStanding $standing): ?SsoProvider
    {
        return $this->findOneBy(['organisation' => $organisation, 'standing' => $standing]);
    }

    /** The provider people sign in through now: the current one once it is on, the staying one while a change waits. */
    public function findLive(Organisation $organisation): ?SsoProvider
    {
        $current = $this->findStanding($organisation, SsoStanding::Current);

        return true === $current?->isOn() ? $current : $this->findStanding($organisation, SsoStanding::Staying);
    }

    /** @return list<SsoProvider> */
    public function findForOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation]);
    }
}
