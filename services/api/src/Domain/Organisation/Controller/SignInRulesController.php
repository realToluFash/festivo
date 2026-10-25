<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\Organisation\SignInRules\SignInRulesEditor;
use App\Domain\User\Mail\UserMailer;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\AuditEntryRepository;
use App\Repository\MembershipRepository;
use App\Repository\OrganisationRepository;
use DateInterval;
use DateTimeInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Sign-in rules (sc-69): every member reads them; organisation.manage changes them. */
final readonly class SignInRulesController
{
    private const int CHANGES_SHOWN = 20;

    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private MembershipRepository $membershipRepository,
        private AuditEntryRepository $auditEntryRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private SignInRulesEditor $signInRulesEditor,
        private SignInRules $signInRules,
        private UserMailer $userMailer,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/sign-in-rules', name: 'orgs_sign_in_rules', methods: ['GET'])]
    #[InOrganisation(null)]
    public function show(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->rules($this->organisation($organisationId)));
    }

    #[Route('/api/orgs/{organisationId}/sign-in-rules', name: 'orgs_sign_in_rules_update', methods: ['PATCH'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function update(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape([
            'providerOnly' => Type\optional(Type\bool()),
            'inactivityTimeoutDays' => Type\optional(Type\nullable(Type\int())),
            'administratorsNeedTwoFactor' => Type\optional(Type\bool()),
            'everyoneNeedsTwoFactor' => Type\optional(Type\bool()),
        ]));

        $days = $body['inactivityTimeoutDays'] ?? null;

        if (null !== $days && !Iter\contains(SignInRules::INACTIVITY_DAYS, $days)) {
            $refusal = $this->translator->trans('sign_in_rules.inactivity_choice');

            throw ApiException::validation([[
                'propertyPath' => 'inactivityTimeoutDays',
                'message' => $refusal,
                'code' => 'choice',
            ]], $refusal);
        }

        $this->signInRulesEditor->change($organisation, $this->user(), $body, $request);

        return new JsonResponse($this->rules($organisation));
    }

    /** @return array<string, mixed> the password-only and no-two-factor lists only for somebody who can change the rules, and never naming them */
    private function rules(Organisation $organisation): array
    {
        $grants = $this->membershipDirectory->grantsIn($this->user(), $organisation->getId());
        $limit = $this->signInRules->inactivityLimit($this->user());

        return [
            ...SignInRulesEditor::rulesOf($organisation),
            'inactivityChoices' => SignInRules::INACTIVITY_DAYS,
            'ownTwoFactor' => $this->signInRules->hasTwoFactor($this->user()),
            'ownProvider' => $this->signInRules->isLinked($this->user()),
            'changedAt' => $organisation->getSignInRulesChangedAt()?->format(DateTimeInterface::ATOM),
            'twoFactorDeadline' => $this->twoFactorDeadline($organisation),
            'changes' => $this->changes($organisation),
            // The shortest across the caller's organisations, which may be another's (sc-69).
            'inactivityLimit' => null === $limit ? null : [
                'organisationId' => $limit->organisation->getId()->toRfc4122(),
                'organisation' => $limit->organisation->getName(),
                'days' => $limit->days,
            ],
            ...(true === $grants?->holds(Permission::OrganisationManage)
                ? ['passwordOnly' => Vec\map(
                    Vec\filter(
                        $this->membershipRepository->findActiveWithoutProviderIn($organisation),
                        fn (Membership $membership): bool => !$membership->getUser()->getId()->equals($this->user()->getId()),
                    ),
                    self::member(...),
                ),
                    'withoutTwoFactor' => Vec\map(
                        Vec\filter(
                            $this->membershipRepository->findActiveWithoutTwoFactorIn($organisation),
                            fn (Membership $membership): bool => !$membership->getUser()->getId()->equals($this->user()->getId()),
                        ),
                        self::member(...),
                    ),
                ]
                : []),
        ];
    }

    /** @return array{at: string, written: string} from now while off, for the warning before saving */
    private function twoFactorDeadline(Organisation $organisation): array
    {
        $deadline = ($organisation->getTwoFactorRequiredSince() ?? $this->clock->now())->add(new DateInterval(SignInRules::TWO_FACTOR_GRACE));

        return [
            'at' => $deadline->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($deadline, $this->user(), $this->userMailer->shownLocaleFor($this->user())),
        ];
    }

    /** @return list<array<string, mixed>> one per rule changed, newest first, with what it was */
    private function changes(Organisation $organisation): array
    {
        $entries = $this->auditEntryRepository->findLatest(SignInRulesEditor::SUBJECT, $organisation->getId(), SignInRulesEditor::CHANGED, self::CHANGES_SHOWN);
        $changes = [];

        foreach ($entries as $entry) {
            foreach ($entry->getChanges() as $rule => [$was, $now]) {
                $changes[] = [
                    'at' => $entry->getOccurredAt()->format(DateTimeInterface::ATOM),
                    'by' => $this->by($entry, $organisation),
                    'rule' => $rule,
                    'now' => $now,
                    'was' => $was,
                ];
            }
        }

        return $changes;
    }

    /** @return array{name: ?string, role: ?array<string, mixed>} the role they hold now, null once they have left */
    private function by(AuditEntry $entry, Organisation $organisation): array
    {
        $actor = $entry->getActorId();
        $membership = null === $actor ? null : $this->membershipRepository->findActiveByUserId($actor, $organisation->getId());

        return ['name' => $entry->getActorLabel(), 'role' => null === $membership ? null : self::role($membership->getRole())];
    }

    /** @return array<string, mixed> */
    private static function member(Membership $membership): array
    {
        return [
            'userId' => $membership->getUser()->getId()->toRfc4122(),
            'name' => $membership->getUser()->getName(),
            'role' => self::role($membership->getRole()),
        ];
    }

    /** @return array<string, mixed> a seeded role by its key, which each client words itself */
    private static function role(Role $role): array
    {
        return ['id' => $role->getId()->toRfc4122(), 'seededAs' => $role->getSeededAs()?->value, 'name' => $role->getName()];
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
}
