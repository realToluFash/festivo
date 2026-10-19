<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Http\MemberSerialiser;
use App\Domain\Organisation\Invitations\InvitationSender;
use App\Domain\Organisation\Roles\RoleManager;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\InvitationRepository;
use App\Repository\MembershipRepository;
use App\Repository\MembershipTransitionRepository;
use App\Repository\OrganisationRepository;
use DateTimeImmutable;
use Psl\Dict;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Organisation > Members (sc-67): every membership in every state, and the invitations. */
final readonly class MembersController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private MembershipRepository $membershipRepository,
        private MembershipTransitionRepository $membershipTransitionRepository,
        private InvitationRepository $invitationRepository,
        private InvitationSender $invitationSender,
        private RoleManager $roleManager,
        private TranslatorInterface $translator,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/members', name: 'orgs_members', methods: ['GET'])]
    #[InOrganisation(Permission::MembersRead)]
    public function list(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $caller = $this->user();
        $history = Dict\group_by(
            $this->membershipTransitionRepository->findInOrganisation($organisation),
            static fn (MembershipTransition $step): string => $step->getMembership()->getId()->toRfc4122(),
        );
        $invitations = $this->invitationRepository->findForOrganisation($organisation);
        $accepted = Dict\group_by(
            Vec\filter($invitations, static fn (Invitation $invitation): bool => null !== $invitation->getAcceptedBy()),
            static fn (Invitation $invitation): string => $invitation->getAcceptedBy()?->getId()->toRfc4122() ?? '',
        );
        $now = new DateTimeImmutable();

        return new JsonResponse([
            'members' => Vec\map(
                $this->membershipRepository->findInOrganisation($organisation),
                static fn (Membership $membership): array => MemberSerialiser::member(
                    $membership,
                    $history[$membership->getId()->toRfc4122()] ?? [],
                    $accepted[$membership->getUser()->getId()->toRfc4122()] ?? [],
                    $caller,
                ),
            ),
            'invitations' => Vec\map($invitations, static fn (Invitation $invitation): array => MemberSerialiser::invitation($invitation, $now)),
        ]);
    }

    /** Sending to an address with one pending re-sends it: a new link, and the old one stops working. */
    #[Route('/api/orgs/{organisationId}/members/invite', name: 'orgs_members_invite', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function invite(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'roleId' => Type\string(),
        ]));

        $invitation = $this->invitationSender->invite($organisation, $body['email'], $this->role($organisation, $body['roleId']), $this->user(), $request);

        return new JsonResponse(
            ['invitation' => MemberSerialiser::invitation($invitation, new DateTimeImmutable())],
            Response::HTTP_CREATED,
        );
    }

    #[Route('/api/orgs/{organisationId}/invitations/{invitationId}', name: 'orgs_invitations_revoke', methods: ['DELETE'])]
    #[InOrganisation(Permission::MembersManage)]
    public function revoke(string $organisationId, string $invitationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $invitation = Uuid::isValid($invitationId)
            ? $this->invitationRepository->findOneBy(['id' => $invitationId, 'organisation' => $organisation])
            : null;

        if (null === $invitation) {
            throw ApiException::notFound('Not found.');
        }

        $this->invitationSender->revoke($invitation, $this->user());

        return new JsonResponse(['invitation' => MemberSerialiser::invitation($invitation, new DateTimeImmutable())]);
    }

    private function role(Organisation $organisation, string $roleId): Role
    {
        try {
            return $this->roleManager->find($organisation, $roleId);
        } catch (ApiException) {
            throw ApiException::validation([[
                'propertyPath' => 'roleId',
                'message' => $this->translator->trans('roles.replacement_invalid'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('Not found.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
