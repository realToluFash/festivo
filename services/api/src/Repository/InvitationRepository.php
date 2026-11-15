<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Invitation;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Enum\InvitationStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Invitation> */
final class InvitationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Invitation::class);
    }

    public function findOneByHash(string $tokenHash): ?Invitation
    {
        return $this->withOrganisation()->andWhere('i.tokenHash = :hash')->setParameter('hash', $tokenHash)->getQuery()->getOneOrNullResult();
    }

    public function findWithOrganisation(Uuid $id): ?Invitation
    {
        return $this->withOrganisation()->andWhere('i.id = :id')->setParameter('id', $id, 'uuid')->getQuery()->getOneOrNullResult();
    }

    /** The one row the partial index allows, lapsed or not. */
    public function findPending(Organisation $organisation, string $normalisedEmail): ?Invitation
    {
        return $this->findOneBy(['organisation' => $organisation, 'email' => $normalisedEmail, 'status' => InvitationStatus::Pending]);
    }

    /** @return list<Invitation> newest first */
    public function findForOrganisation(Organisation $organisation): array
    {
        return $this->findBy(['organisation' => $organisation], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    /**
     * @param list<string> $normalisedEmails
     *
     * @return list<Invitation> still pending for any of these addresses, in organisations that still exist
     */
    public function findPendingTo(array $normalisedEmails): array
    {
        if ([] === $normalisedEmails) {
            return [];
        }

        return $this->createQueryBuilder('i')
            ->addSelect('o')
            ->innerJoin('i.organisation', 'o')
            ->andWhere('i.email IN (:emails)')
            ->andWhere('i.status = :pending')
            ->setParameter('emails', $normalisedEmails)
            ->setParameter('pending', InvitationStatus::Pending)
            ->orderBy('i.createdAt', 'DESC')
            ->addOrderBy('i.id', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<Invitation> */
    public function findPendingWithRole(Role $role): array
    {
        return $this->findBy(['role' => $role, 'status' => InvitationStatus::Pending]);
    }

    /** The soft-delete filter sits on the join, so an organisation deleted but restorable comes back null, as a purged one does, rather than as a proxy that cannot load. */
    private function withOrganisation(): QueryBuilder
    {
        return $this->createQueryBuilder('i')->addSelect('o')->leftJoin('i.organisation', 'o');
    }
}
