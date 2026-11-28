<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\DomainJoining\DomainSuspender;
use App\Domain\Organisation\EmailDomains\ManagedAccounts;
use App\Domain\Organisation\Handover\WorkHandover;
use App\Domain\Organisation\Http\MemberSerialiser;
use App\Domain\Organisation\Invitations\InvitationDeliveries;
use App\Domain\Organisation\Invitations\InvitationSender;
use App\Domain\Organisation\Members\JoinRequests;
use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Members\MemberSuspension;
use App\Domain\Organisation\Members\OwnershipTransfer;
use App\Domain\Organisation\OwnerClaims\OwnerClaimHandler;
use App\Domain\Organisation\Roles\RoleManager;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Event;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Input;
use App\Repository\InvitationRepository;
use App\Repository\MembershipRepository;
use App\Repository\MembershipTransitionRepository;
use App\Repository\OrganisationRepository;
use Closure;
use DateTimeImmutable;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Organisation > Members (sc-67): its memberships a page at a time (sc-49170), the invitations, and the moves on them (sc-68). */
final readonly class MembersController
{
    private const array SHOWN = [
        'all' => [MembershipStatus::Active, MembershipStatus::Suspended],
        'active' => [MembershipStatus::Active],
        'waiting' => [MembershipStatus::PendingApproval],
        'suspended' => [MembershipStatus::Suspended],
        'former' => [MembershipStatus::LeftOrRemoved],
    ];

    private const int PAGE = 50;

    private const int MOST = 500;

    private const int FACES = 5;

    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private MembershipRepository $membershipRepository,
        private ManagedAccounts $managedAccounts,
        private MembershipTransitionRepository $membershipTransitionRepository,
        private InvitationRepository $invitationRepository,
        private InvitationSender $invitationSender,
        private RoleManager $roleManager,
        private MemberActions $memberActions,
        private OwnershipTransfer $ownershipTransfer,
        private TranslatorInterface $translator,
        private MembershipDirectoryInterface $membershipDirectory,
        private DomainSuspender $domainSuspender,
        private MemberSuspension $memberSuspension,
        private JoinRequests $joinRequests,
        private UserMailer $userMailer,
        private OwnerClaimHandler $ownerClaimHandler,
        private InvitationDeliveries $invitationDeliveries,
        private WorkHandover $workHandover,
    ) {
    }

    /** The counts, the card's faces and Waiting are the whole organisation's on every page, the invitations only on a first page (sc-49170). */
    #[Route('/api/orgs/{organisationId}/members', name: 'orgs_members', methods: ['GET'])]
    #[InOrganisation(Permission::MembersRead)]
    public function list(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $caller = $this->user();
        $query = Input::query($request, Type\shape([
            'show' => Type\optional(Type\string()),
            'after' => Type\optional(Type\string()),
            'limit' => Type\optional(Type\string()),
        ]));
        $statuses = self::SHOWN[$query['show'] ?? 'all'] ?? throw new ShapeRefusal('show');
        $limit = Str\to_int($query['limit'] ?? (string) self::PAGE) ?? throw new ShapeRefusal('limit');

        if ($limit < 1 || $limit > self::MOST) {
            throw new ShapeRefusal('limit');
        }

        $this->joinRequests->expireDue($organisation);
        $this->domainSuspender->removeExpired($organisation);
        $this->ownerClaimHandler->settleDue($organisation);
        $decides = true === $this->membershipDirectory->grantsIn($caller, $organisation->getId())?->holds(Permission::MembersManage);
        $after = null === ($query['after'] ?? null) ? null : $this->listedMember($organisation, $query['after'], $decides);
        $page = $this->membershipRepository->findListedPage($organisation, $statuses, $decides, $after, $limit);
        $counts = $this->membershipRepository->countListedByStatus($organisation, $decides);
        $rows = $this->memberRows($organisation, $caller);
        $last = Iter\last($page);
        $whole = null === $after
            ? ['invitations' => $this->invitationRows($this->invitationRepository->findForOrganisation($organisation))]
            : [];

        return new JsonResponse([
            'members' => $rows($page),
            'next' => $limit === Iter\count($page) && null !== $last ? $last->getId()->toRfc4122() : null,
            'counts' => Dict\map(self::SHOWN, static fn (array $shown): int => Math\sum(Vec\map(
                $shown,
                static fn (MembershipStatus $status): int => $counts[$status->value] ?? 0,
            ))),
            'owners' => $this->membershipRepository->countActiveOwnersIn($organisation),
            'faces' => $rows($this->membershipRepository->findListedPage($organisation, self::SHOWN['all'], $decides, null, self::FACES)),
            'waiting' => $decides
                ? $rows($this->membershipRepository->findListedPage($organisation, self::SHOWN['waiting'], true, null, null))
                : [],
            ...$whole,
        ]);
    }

    /** One person's row as it now is, for a change to somebody past the rows a read again brings (sc-49170). */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}', name: 'orgs_members_one', methods: ['GET'])]
    #[InOrganisation(Permission::MembersRead)]
    public function one(string $organisationId, string $membershipId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $caller = $this->user();
        $decides = true === $this->membershipDirectory->grantsIn($caller, $organisation->getId())?->holds(Permission::MembersManage);
        $membership = Uuid::isValid($membershipId) ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation]) : null;

        if (null === $membership || !$membership->isListedTo($decides)) {
            throw ApiException::notFound('access.not_found');
        }

        return new JsonResponse(['member' => $this->memberRows($organisation, $caller)([$membership])[0]]);
    }

    /** Sending to an address with one pending re-sends it: a new link, and the old one stops working. Into Owner, `proof` comes from /api/auth/proof. */
    #[Route('/api/orgs/{organisationId}/members/invite', name: 'orgs_members_invite', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function invite(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape([
            'email' => Type\string(),
            'roleId' => Type\string(),
            'proof' => Type\optional(Type\nullable(Type\string())),
        ]));

        $invitation = $this->invitationSender->invite($organisation, $body['email'], $this->role($organisation, $body['roleId']), $this->user(), $request, $body['proof'] ?? null);

        return new JsonResponse(
            ['invitation' => $this->invitation($invitation)],
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
            throw ApiException::notFound('access.not_found');
        }

        $this->invitationSender->revoke($invitation, $this->user());

        return new JsonResponse(['invitation' => $this->invitation($invitation)]);
    }

    /** Takes effect on the member's next request: grants are read from the membership every time. Into Owner, `proof` comes from /api/auth/proof. */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}', name: 'orgs_members_change_role', methods: ['PATCH'])]
    #[InOrganisation(Permission::MembersManage)]
    public function changeRole(Request $request, string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape([
            'roleId' => Type\string(),
            'proof' => Type\optional(Type\nullable(Type\string())),
        ]));
        $membership = $this->memberActions->find($organisation, $membershipId, $this->user());
        $this->memberActions->changeRole($membership, $this->role($organisation, $body['roleId']), $this->user(), $body['proof'] ?? null);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** `handTo` names the membership that takes the events they lead (sc-614), and is required while there are any. */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}', name: 'orgs_members_remove', methods: ['DELETE'])]
    #[InOrganisation(Permission::MembersManage)]
    public function remove(Request $request, string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $this->memberActions->remove($this->memberActions->find($organisation, $membershipId, $this->user()), $this->user(), $this->handTo($request));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/members/{membershipId}/work', name: 'orgs_members_work', methods: ['GET'])]
    #[InOrganisation(Permission::MembersManage)]
    public function work(string $organisationId, string $membershipId): JsonResponse
    {
        $membership = $this->memberActions->find($this->organisation($organisationId), $membershipId, $this->user());

        return new JsonResponse(self::workList($this->workHandover->heldBy($membership)));
    }

    #[Route('/api/orgs/{organisationId}/members/{membershipId}/handover', name: 'orgs_members_handover', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function handOver(Request $request, string $organisationId, string $membershipId): Response
    {
        $membership = $this->memberActions->find($this->organisation($organisationId), $membershipId, $this->user());
        $this->memberActions->handOver($membership, $this->user(), $this->handTo($request));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** Takes effect on the member's next request, as a removal does: only an active membership grants anything. */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}/suspend', name: 'orgs_members_suspend', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function suspend(string $organisationId, string $membershipId): Response
    {
        $this->memberActions->suspend($this->organisation($organisationId), $membershipId, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** Refused `restore_needs_address` while a member whose address went has no verified primary one at the domain again (checked first), and `plan_limit_reached` while the plan's team seats are taken. */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}/restore', name: 'orgs_members_restore', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function restore(string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $this->memberActions->restore($this->memberActions->find($organisation, $membershipId, $this->user()), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** Somebody awaiting approval becomes an active member in the role chosen (sc-392). */
    #[Route('/api/orgs/{organisationId}/members/{membershipId}/approve', name: 'orgs_members_approve', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function approve(Request $request, string $organisationId, string $membershipId): Response
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['roleId' => Type\string()]));
        $this->joinRequests->approve($organisation, $membershipId, $this->role($organisation, $body['roleId']), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/members/{membershipId}/turn-down', name: 'orgs_members_turn_down', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function turnDown(string $organisationId, string $membershipId): Response
    {
        $this->joinRequests->turnDown($this->organisation($organisationId), $membershipId, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/work', name: 'orgs_own_work', methods: ['GET'])]
    #[InOrganisation(null)]
    public function ownWork(string $organisationId): JsonResponse
    {
        $membership = $this->membershipRepository->findActive($this->user(), $this->organisation($organisationId)->getId())
            ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(self::workList($this->workHandover->heldBy($membership)));
    }

    /** With no `handTo`, the events the caller leads go to every other owner (sc-614). */
    #[Route('/api/orgs/{organisationId}/leave', name: 'orgs_leave', methods: ['POST'])]
    #[InOrganisation(null)]
    public function leave(Request $request, string $organisationId): Response
    {
        $this->memberActions->leave($this->organisation($organisationId), $this->user(), $this->handTo($request));

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

    /** @return Closure(list<Membership>): list<array<string, mixed>> */
    private function memberRows(Organisation $organisation, User $caller): Closure
    {
        $locale = $this->userMailer->formattingLocaleFor($caller);
        $written = fn (DateTimeImmutable $at): string => $this->userMailer->deadline($at, $caller, $locale);

        $seesOthers = Iter\contains([SeededRole::Owner, SeededRole::Admin], $this->membershipRepository->findActive($caller, $organisation->getId())?->getRole()->getSeededAs());

        return /** @param list<Membership> $memberships */ function (array $memberships) use ($organisation, $caller, $written, $seesOthers): array {
            // Who invited each of these, from their invitations only: an organisation grown by invitation has one per member.
            $invitations = $this->invitationRepository->findAcceptedBy($organisation, Vec\map($memberships, static fn (Membership $membership): User => $membership->getUser()));
            $accepted = Dict\group_by(
                $invitations,
                static fn (Invitation $invitation): string => $invitation->getAcceptedBy()?->getId()->toRfc4122() ?? '',
            );
            $sentAt = $this->invitationDeliveries->sentAt($invitations);
            $history = Dict\group_by(
                $this->membershipTransitionRepository->findForMemberships($memberships),
                static fn (MembershipTransition $step): string => $step->getMembership()->getId()->toRfc4122(),
            );

            $alsoMemberOf = $seesOthers ? $this->managedAccounts->otherMembershipsOf(Vec\map($memberships, static fn (Membership $membership): User => $membership->getUser()), $organisation) : [];

            return Vec\map($memberships, fn (Membership $membership): array => MemberSerialiser::member(
                $membership,
                $history[$membership->getId()->toRfc4122()] ?? [],
                $accepted[$membership->getUser()->getId()->toRfc4122()] ?? [],
                $caller,
                $written,
                $this->memberSuspension->describe($membership, $caller),
                $sentAt,
                $alsoMemberOf[$membership->getUser()->getId()->toRfc4122()] ?? null,
            ));
        };
    }

    /**
     * @param list<Invitation> $invitations
     *
     * @return list<array<string, mixed>>
     */
    private function invitationRows(array $invitations): array
    {
        $now = new DateTimeImmutable();
        $sentAt = $this->invitationDeliveries->sentAt($invitations);
        $undelivered = $this->invitationDeliveries->undelivered($invitations);

        return Vec\map($invitations, static fn (Invitation $invitation): array => MemberSerialiser::invitation(
            $invitation,
            $now,
            $sentAt[$invitation->getId()->toRfc4122()] ?? null,
            Iter\contains($undelivered, $invitation->getId()->toRfc4122()),
        ));
    }

    private function listedMember(Organisation $organisation, string $id, bool $decides): Membership
    {
        $membership = Uuid::isValid($id) ? $this->membershipRepository->findOneBy(['id' => $id, 'organisation' => $organisation]) : null;

        return null !== $membership && $membership->isListedTo($decides) ? $membership : throw new ShapeRefusal('after');
    }

    private function handTo(Request $request): ?string
    {
        if ('' === Str\trim($request->getContent())) {
            return null;
        }

        return Input::body($request, Type\shape(['handTo' => Type\optional(Type\nullable(Type\string()))]))['handTo'] ?? null;
    }

    /**
     * @param list<Event> $events
     *
     * @return array{events: list<array{id: string, title: string}>}
     */
    private static function workList(array $events): array
    {
        return ['events' => Vec\map($events, static fn (Event $event): array => ['id' => $event->getId()->toRfc4122(), 'title' => $event->getName()])];
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
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }

    /** @return array<string, mixed> */
    private function invitation(Invitation $invitation): array
    {
        return MemberSerialiser::invitation(
            $invitation,
            new DateTimeImmutable(),
            $this->invitationDeliveries->sentAt([$invitation])[$invitation->getId()->toRfc4122()] ?? null,
            [] !== $this->invitationDeliveries->undelivered([$invitation]),
        );
    }
}
