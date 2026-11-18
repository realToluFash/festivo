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
}
