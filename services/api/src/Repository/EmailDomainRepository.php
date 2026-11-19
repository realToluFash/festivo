<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EmailDomain;
use App\Entity\Organisation;
use DateInterval;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<EmailDomain> */
final class EmailDomainRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EmailDomain::class);
    }

    /** @return list<EmailDomain> in the order they were added */
    public function findForOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['addedAt' => 'ASC', 'id' => 'ASC']);
    }

    public function findOneInOrganisation(Organisation $organisation, string $domain): ?EmailDomain
    {
        return $this->findOneBy(['organisation' => $organisation, 'domain' => $domain]);
    }

    /** The one organisation's proof of it, if any; the join leaves a deleted organisation's out. */
    public function findProvedOf(string $domain): ?EmailDomain
    {
        /** @var ?EmailDomain */
        return $this->createQueryBuilder('d')
            ->select('d', 'o')
            ->innerJoin('d.organisation', 'o')
            ->where('d.domain = :domain')
            ->andWhere('d.provedAt IS NOT NULL')
            ->setParameter('domain', $domain)
            ->getQuery()
            ->getOneOrNullResult();
    }

    public function hasProvedIn(Organisation $organisation): bool
    {
        return [] !== $this->provedIn($organisation);
    }

    /** @return list<EmailDomain> waiting, or missing its record, and looked up an hour ago; past its checks or its put-back instant; or due its 30-day re-check */
    public function findDue(DateTimeImmutable $now, string $every): array
    {
        $lookedUpBefore = $now->sub(new DateInterval($every));

        /** @var list<EmailDomain> */
        return $this->createQueryBuilder('d')
            ->select('d', 'o')
            ->innerJoin('d.organisation', 'o')
            ->where('d.provedAt IS NULL AND d.failedAt IS NULL AND (d.checkedAt <= :lookedUpBefore OR d.addedAt <= :checksStartedBefore)')
            ->orWhere('d.provedAt IS NOT NULL AND d.missingSince IS NULL AND d.foundAt <= :foundBefore')
            ->orWhere('d.missingSince IS NOT NULL AND (d.checkedAt <= :lookedUpBefore OR d.missingSince <= :missingBefore)')
            ->setParameter('lookedUpBefore', $lookedUpBefore)
            ->setParameter('checksStartedBefore', $now->sub(new DateInterval(EmailDomain::CHECKS_FOR)))
            ->setParameter('foundBefore', $now->sub(new DateInterval(EmailDomain::RECHECK_EVERY)))
            ->setParameter('missingBefore', $now->sub(new DateInterval(EmailDomain::PUT_BACK_WITHIN)))
            ->orderBy('d.checkedAt', 'ASC')
            ->addOrderBy('d.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<EmailDomain> */
    private function provedIn(Organisation $organisation): array
    {
        /** @var list<EmailDomain> */
        return $this->createQueryBuilder('d')
            ->where('d.organisation = :organisation')
            ->andWhere('d.provedAt IS NOT NULL')
            ->setParameter('organisation', $organisation)
            ->getQuery()
            ->getResult();
    }
}
