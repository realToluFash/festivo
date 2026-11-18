<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organisation;
use App\Entity\OrganisationExport;
use App\Enum\OrganisationExportStatus;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<OrganisationExport> */
final class OrganisationExportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OrganisationExport::class);
    }

    public function findLatestIn(Organisation $organisation): ?OrganisationExport
    {
        return $this->findOneBy(['organisation' => $organisation], ['askedAt' => 'DESC', 'id' => 'DESC']);
    }

    /** The newest export that counts toward the daily limit: one that did not fail. */
    public function findLatestCountedIn(Organisation $organisation): ?OrganisationExport
    {
        return $this->createQueryBuilder('e')
            ->where('e.organisation = :organisation')
            ->andWhere('e.status <> :failed')
            ->setParameter('organisation', $organisation)
            ->setParameter('failed', OrganisationExportStatus::Failed)
            ->orderBy('e.askedAt', 'DESC')
            ->addOrderBy('e.id', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function findOneIn(Organisation $organisation, string $id): ?OrganisationExport
    {
        return Uuid::isValid($id) ? $this->findOneBy(['organisation' => $organisation, 'id' => $id]) : null;
    }

    /** @return list<OrganisationExport> exports still preparing whose last try is older than `$triedBefore`, or never tried */
    public function findDue(DateTimeImmutable $triedBefore): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.status = :preparing')
            ->andWhere('e.attemptedAt IS NULL OR e.attemptedAt <= :before')
            ->setParameter('preparing', OrganisationExportStatus::Preparing)
            ->setParameter('before', $triedBefore, Types::DATETIME_IMMUTABLE)
            ->orderBy('e.askedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Counts a try as this one's, once: false when the export is no longer preparing or another try started after `$triedBefore`. */
    public function claimTry(OrganisationExport $export, DateTimeImmutable $at, DateTimeImmutable $triedBefore): bool
    {
        $claimed = $this->getEntityManager()->getConnection()->executeStatement(
            <<<'SQL'
                UPDATE organisation_exports SET attempts = attempts + 1, attempted_at = :at, updated_at = :at
                WHERE id = :id AND status = :preparing AND (attempted_at IS NULL OR attempted_at <= :before)
                SQL,
            ['at' => $at, 'id' => $export->getId()->toRfc4122(), 'preparing' => OrganisationExportStatus::Preparing->value, 'before' => $triedBefore],
            ['at' => Types::DATETIME_IMMUTABLE, 'before' => Types::DATETIME_IMMUTABLE],
        );

        if (1 === $claimed) {
            $this->getEntityManager()->refresh($export);
        }

        return 1 === $claimed;
    }

    /** Marks the download used, once: false when another request already did. */
    public function claimDownload(OrganisationExport $export, DateTimeImmutable $at): bool
    {
        $claimed = $this->getEntityManager()->getConnection()->executeStatement(
            <<<'SQL'
                UPDATE organisation_exports SET downloaded_at = :at, updated_at = :at
                WHERE id = :id AND downloaded_at IS NULL
                SQL,
            ['at' => $at, 'id' => $export->getId()->toRfc4122()],
            ['at' => Types::DATETIME_IMMUTABLE],
        );

        if (1 === $claimed) {
            $this->getEntityManager()->refresh($export);
        }

        return 1 === $claimed;
    }

    /** Marks it Ready with its archive, once: false when another try already finished it. */
    public function claimReady(OrganisationExport $export, string $archiveKey, DateTimeImmutable $at): bool
    {
        return $this->claimFinish($export, <<<'SQL'
            UPDATE organisation_exports SET status = :status, archive_key = :key, ready_at = :at, updated_at = :at
            WHERE id = :id AND status = :preparing
            SQL, OrganisationExportStatus::Ready, $at, ['key' => $archiveKey]);
    }

    /** Marks it Didn't finish once it has had its tries, unless another try finished it first. */
    public function claimFailed(OrganisationExport $export, DateTimeImmutable $at): bool
    {
        return $export->getAttempts() >= OrganisationExport::MOST_ATTEMPTS
            && $this->claimFinish($export, <<<'SQL'
                UPDATE organisation_exports SET status = :status, updated_at = :at
                WHERE id = :id AND status = :preparing
                SQL, OrganisationExportStatus::Failed, $at);
    }

    /** @param array<string, string> $more */
    private function claimFinish(OrganisationExport $export, string $sql, OrganisationExportStatus $status, DateTimeImmutable $at, array $more = []): bool
    {
        $claimed = $this->getEntityManager()->getConnection()->executeStatement(
            $sql,
            [...$more, 'status' => $status->value, 'at' => $at, 'id' => $export->getId()->toRfc4122(), 'preparing' => OrganisationExportStatus::Preparing->value],
            ['at' => Types::DATETIME_IMMUTABLE],
        );

        $this->getEntityManager()->refresh($export);

        return 1 === $claimed;
    }
}
