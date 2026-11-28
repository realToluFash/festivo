<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AuditExport;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\AuditExportStatus;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
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

    /** @return list<AuditExport> exports still preparing whose latest try has not been seen working since `$quietSince`, or that were never tried */
    public function findDue(DateTimeImmutable $quietSince): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.status = :preparing')
            ->andWhere('e.workedAt IS NULL OR e.workedAt <= :quietSince')
            ->setParameter('preparing', AuditExportStatus::Preparing)
            ->setParameter('quietSince', $quietSince, Types::DATETIME_IMMUTABLE)
            ->orderBy('e.askedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Counts a try as this one's, once: false when the export is no longer preparing, has had its tries, or another try was working after `$quietSince`. */
    public function claimTry(AuditExport $export, DateTimeImmutable $at, DateTimeImmutable $quietSince): bool
    {
        $claimed = $this->getEntityManager()->getConnection()->executeStatement(
            <<<'SQL'
                UPDATE audit_exports SET attempts = attempts + 1, worked_at = :at, updated_at = :at
                WHERE id = :id AND status = :preparing AND attempts < :most AND (worked_at IS NULL OR worked_at <= :quietSince)
                SQL,
            ['at' => $at, 'id' => $export->getId()->toRfc4122(), 'preparing' => AuditExportStatus::Preparing->value, 'most' => AuditExport::MOST_ATTEMPTS, 'quietSince' => $quietSince],
            ['at' => Types::DATETIME_IMMUTABLE, 'quietSince' => Types::DATETIME_IMMUTABLE],
        );

        if (1 === $claimed) {
            $this->getEntityManager()->refresh($export);
        }

        return 1 === $claimed;
    }

    /** The try numbered `$attempt` is still writing, so no run takes it for stopped. */
    public function working(AuditExport $export, int $attempt, DateTimeImmutable $at): void
    {
        $this->getEntityManager()->getConnection()->executeStatement(
            <<<'SQL'
                UPDATE audit_exports SET worked_at = :at
                WHERE id = :id AND status = :preparing AND attempts = :attempt
                SQL,
            ['at' => $at, 'id' => $export->getId()->toRfc4122(), 'preparing' => AuditExportStatus::Preparing->value, 'attempt' => $attempt],
            ['at' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** Marks it Ready with its file, once: false when another try already finished it. */
    public function claimReady(AuditExport $export, string $fileKey, DateTimeImmutable $at): bool
    {
        return $this->claimFinish($export, <<<'SQL'
            UPDATE audit_exports SET status = :status, file_key = :key, ready_at = :at, updated_at = :at
            WHERE id = :id AND status = :preparing
            SQL, AuditExportStatus::Ready, $at, ['key' => $fileKey]);
    }

    /** Marks it failed, unless another try finished it first. */
    public function claimFailed(AuditExport $export, DateTimeImmutable $at): bool
    {
        return $this->claimFinish($export, <<<'SQL'
            UPDATE audit_exports SET status = :status, updated_at = :at
            WHERE id = :id AND status = :preparing
            SQL, AuditExportStatus::Failed, $at);
    }

    /** Marks it failed when its last try has stopped: every try had, and none has been seen working since `$quietSince`. */
    public function claimStopped(AuditExport $export, DateTimeImmutable $at, DateTimeImmutable $quietSince): bool
    {
        return $this->claimFinish($export, <<<'SQL'
            UPDATE audit_exports SET status = :status, updated_at = :at
            WHERE id = :id AND status = :preparing AND attempts >= :most AND worked_at <= :quietSince
            SQL, AuditExportStatus::Failed, $at, ['most' => AuditExport::MOST_ATTEMPTS, 'quietSince' => $quietSince], ['quietSince' => Types::DATETIME_IMMUTABLE]);
    }

    /**
     * @param array<string, int|string|DateTimeImmutable> $more
     * @param array<string, string>                       $moreTypes
     */
    private function claimFinish(AuditExport $export, string $sql, AuditExportStatus $status, DateTimeImmutable $at, array $more = [], array $moreTypes = []): bool
    {
        $claimed = $this->getEntityManager()->getConnection()->executeStatement(
            $sql,
            [...$more, 'status' => $status->value, 'at' => $at, 'id' => $export->getId()->toRfc4122(), 'preparing' => AuditExportStatus::Preparing->value],
            [...$moreTypes, 'at' => Types::DATETIME_IMMUTABLE],
        );

        $this->getEntityManager()->refresh($export);

        return 1 === $claimed;
    }
}
