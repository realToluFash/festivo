<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Http\MemberSerialiser;
use App\Domain\Organisation\Invitations\InvitationSender;
use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Members\OwnershipTransfer;
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

/** Settings > Organisation > Members (sc-67): every membership in every state, the invitations, and the moves on them (sc-68). */
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
        private MemberActions $memberActions,
        private OwnershipTransfer $ownershipTransfer,
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

    /** Takes effect on the member's next request: grants are read from the membership every time. */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}', name: 'orgs_members_change_role', methods: ['PATCH'])]
    #[InOrganisation(Permission::MembersManage)]
    public function changeRole(Request $request, string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['roleId' => Type\string()]));
        $membership = $this->memberActions->find($organisation, $membershipId, $this->user());
        $this->memberActions->changeRole($membership, $this->role($organisation, $body['roleId']), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/members/{membershipId}', name: 'orgs_members_remove', methods: ['DELETE'])]
    #[InOrganisation(Permission::MembersManage)]
    public function remove(string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $this->memberActions->remove($this->memberActions->find($organisation, $membershipId, $this->user()), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/leave', name: 'orgs_leave', methods: ['POST'])]
    #[InOrganisation(null)]
    public function leave(string $organisationId): Response
    {
        $this->memberActions->leave($this->organisation($organisationId), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** `proof` comes from /api/auth/proof, which takes the password and, when it is on, the two-factor code. */
    #[Route('/api/orgs/{organisationId}/ownership', name: 'orgs_ownership_transfer', methods: ['POST'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function transfer(Request $request, string $organisationId): Response
    {
        $body = Input::body($request, Type\shape([
            'membershipId' => Type\string(),
            'proof' => Type\optional(Type\nullable(Type\string())),
        ]));
        $this->ownershipTransfer->transfer($this->organisation($organisationId), $this->user(), $body['membershipId'], $body['proof'] ?? null, $request->getLocale());

        return new Response(null, Response::HTTP_NO_CONTENT);
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
