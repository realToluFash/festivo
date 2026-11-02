<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AuditEntry;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<AuditEntry> */
final class AuditEntryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AuditEntry::class);
    }

    /** @return list<AuditEntry> newest first */
    public function findLatest(string $subjectType, Uuid $subjectId, string $action, int $limit): array
    {
        return $this->findBy(
            ['subjectType' => $subjectType, 'subjectId' => $subjectId, 'action' => $action],
            ['occurredAt' => 'DESC', 'id' => 'DESC'],
            $limit,
        );
    }
}
