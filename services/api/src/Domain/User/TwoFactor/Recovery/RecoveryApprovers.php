<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/** Who may answer a request to get back in (sc-509): an owner or admin of one of the person's organisations, never the person. */
final readonly class RecoveryApprovers
{
    /** By the seeded role, not its permissions: an organisation can change what Administrator holds, not this duty. */
    public const array ROLES = [SeededRole::Owner, SeededRole::Administrator];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** @return list<User> */
    public function for(User $user): array
    {
        $approvers = [];

        foreach ($this->approverMemberships($user) as $membership) {
            $approvers[$membership->getUser()->getId()->toRfc4122()] = $membership->getUser();
        }

        return Vec\values($approvers);
    }

    /** @return list<Organisation> the person's own in which somebody else can approve, oldest membership first */
    public function askedFor(User $user): array
    {
        $asked = [];

        foreach ($this->approverMemberships($user) as $membership) {
            $asked[$membership->getOrganisation()->getId()->toRfc4122()] = true;
        }

        return Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => isset($asked[$organisation->getId()->toRfc4122()]),
        );
    }

    /** @return list<Organisation> the person's own, oldest membership first */
    public function organisationsOf(User $user): array
    {
        return Vec\map($this->membershipRepository->findActiveFor($user), static fn (Membership $membership): Organisation => $membership->getOrganisation());
    }

    /** @return list<Organisation> the ones the approver answers for that the person belongs to */
    public function sharedBy(User $approver, User $user): array
    {
        $mine = [];

        foreach ($this->membershipRepository->findActiveFor($approver) as $membership) {
            if (Iter\contains(self::ROLES, $membership->getRole()->getSeededAs())) {
                $mine[$membership->getOrganisation()->getId()->toRfc4122()] = true;
            }
        }

        return Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => isset($mine[$organisation->getId()->toRfc4122()]),
        );
    }

    /** @return list<Membership> */
    private function approverMemberships(User $user): array
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

        return Type\vec(Type\instance_of(Membership::class))->coerce($memberships);
    }
}
