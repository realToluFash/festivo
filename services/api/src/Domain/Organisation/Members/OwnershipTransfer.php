<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Audit\Auditor;
use App\Domain\Organisation\Deletion\OrganisationDeleter;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\User\SignInMethods\RecentProof;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\SeededRole;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An owner hands the organisation on (sc-68): the new owner holds Owner, the previous one Administrator. */
final readonly class OwnershipTransfer
{
    public const string TRANSFERRED = 'organisation.ownership_transferred';

    public function __construct(
        private OrganisationDeleter $organisationDeleter,
        private RecentProof $recentProof,
        private MembershipRepository $membershipRepository,
        private RoleAssignment $roleAssignment,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private AfterResponse $afterResponse,
        private OwnershipTransferMailer $ownershipTransferMailer,
        private TranslatorInterface $translator,
    ) {
    }

    /** `$proof` is the caller's from /api/auth/proof: nobody who picks up a signed-in device gives the organisation away. */
    public function transfer(Organisation $organisation, User $by, string $membershipId, #[SensitiveParameter] ?string $proof, ?string $asked = null): Membership
    {
        $this->organisationDeleter->ownerOf($organisation, $by);
        $to = $this->candidate($organisation, $membershipId, $by);
        $this->recentProof->require($by, $proof);

        $previous = $this->membershipRepository->findActive($by, $organisation->getId()) ?? throw ApiException::notFound('Not found.');
        $before = $to->getRole();
        $this->roleAssignment->assign($to, $this->role($organisation, SeededRole::Owner));
        $this->entityManager->flush();
        $this->roleAssignment->assign($previous, $this->role($organisation, SeededRole::Administrator));
        $this->auditor->record(self::TRANSFERRED, 'Organisation', $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'owner' => [$by->getId()->toRfc4122(), $to->getUser()->getId()->toRfc4122()],
            'newOwnerRoleId' => [$before->getId()->toRfc4122(), $to->getRole()->getId()->toRfc4122()],
        ]);
        $this->entityManager->flush();

        $this->afterResponse->defer(fn () => $this->ownershipTransferMailer->sendTransferred($organisation, $by, $to->getUser(), $asked));

        return $to;
    }

    private function candidate(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = Uuid::isValid($membershipId) ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation]) : null;
        $chosen = null !== $membership
            && $membership->isActive()
            && !$membership->getUser()->getId()->equals($by->getId());

        if (!$chosen) {
            throw ApiException::validation([[
                'propertyPath' => 'membershipId',
                'message' => $this->translator->trans('members.choose_new_owner'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        return $membership;
    }

    private function role(Organisation $organisation, SeededRole $seeded): Role
    {
        return $this->entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded])
            ?? throw new ApiException(ErrorCode::InternalError, 'The organisation is missing a seeded role.');
    }
}
