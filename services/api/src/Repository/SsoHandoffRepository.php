<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SsoHandoff;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<SsoHandoff> */
final class SsoHandoffRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SsoHandoff::class);
    }

    /** True for one caller only, however many arrive at once. */
    public function claim(SsoHandoff $handoff): bool
    {
        return 1 === $this->getEntityManager()->getConnection()->executeStatement(
            'DELETE FROM organisation_sso_handoffs WHERE id = :id',
            ['id' => $handoff->getId()->toRfc4122()],
        );
    }
}
