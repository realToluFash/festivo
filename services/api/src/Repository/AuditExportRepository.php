<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AuditExport;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\AuditExportStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<AuditExport> */
final class AuditExportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AuditExport::class);
    }

    public function findOneIn(Organisation $organisation, string $id): ?AuditExport
    {
        return Uuid::isValid($id) ? $this->findOneBy(['organisation' => $organisation, 'id' => $id]) : null;
    }

    public function findPreparingFor(Organisation $organisation, User $user): ?AuditExport
    {
        return $this->findOneBy(['organisation' => $organisation, 'askedBy' => $user, 'status' => AuditExportStatus::Preparing], ['askedAt' => 'DESC']);
    }
}
