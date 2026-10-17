<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/** Who may answer a request to get back in (sc-509): an owner or admin of one of the person's organisations, never the person. */
final readonly class RecoveryApprovers
{
    /** Admin joins when sc-66 seeds it. */
    public const array ROLES = [SeededRole::Owner];

    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** @return list<User> */
    public function for(User $user): array
    {
        $memberships = $this->entityManager->createQueryBuilder()
            ->select('m', 'u', 'o')
            ->from(Membership::class, 'm')
            ->innerJoin('m.user', 'u')
            ->innerJoin('m.organisation', 'o')
            ->innerJoin('m.role', 'role')
            ->innerJoin(Membership::class, 'theirs', 'WITH', 'theirs.organisation = m.organisation AND theirs.user = :user AND theirs.status = :active')
            ->where('m.status = :active')
            ->andWhere('m.user <> :user')
            ->andWhere('role.seededAs IN (:roles)')
            ->setParameter('user', $user)
            ->setParameter('active', MembershipStatus::Active)
            ->setParameter('roles', self::ROLES)
            ->getQuery()
            ->getResult();

        $approvers = [];

        foreach (Type\vec(Type\instance_of(Membership::class))->coerce($memberships) as $membership) {
            $approvers[$membership->getUser()->getId()->toRfc4122()] = $membership->getUser();
        }

        return Vec\values($approvers);
    }

    /** @return list<Organisation> the person's own, oldest membership first */
    public function organisationsOf(User $user): array
    {
        $memberships = $this->entityManager->getRepository(Membership::class)->findBy(
            ['user' => $user, 'status' => MembershipStatus::Active],
            ['createdAt' => 'ASC'],
        );

        return Vec\map($memberships, static fn (Membership $membership): Organisation => $membership->getOrganisation());
    }

    /** @return list<Organisation> the ones the approver answers for that the person belongs to */
    public function sharedBy(User $approver, User $user): array
    {
        $mine = [];

        foreach ($this->entityManager->getRepository(Membership::class)->findBy(['user' => $approver, 'status' => MembershipStatus::Active]) as $membership) {
            if (Iter\contains(self::ROLES, $membership->getRole()->getSeededAs())) {
                $mine[$membership->getOrganisation()->getId()->toRfc4122()] = true;
            }
        }

        return Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => isset($mine[$organisation->getId()->toRfc4122()]),
        );
    }
}
