<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\Organisation\SignInRules\SignInRulesEditor;
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
use DateTimeInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

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
        ]));

        $days = $body['inactivityTimeoutDays'] ?? null;

        if (null !== $days && !Iter\contains(SignInRules::INACTIVITY_DAYS, $days)) {
            throw ApiException::validation([[
                'propertyPath' => 'inactivityTimeoutDays',
                'message' => 'Choose 7 days, 30 days or no limit.',
                'code' => 'choice',
            ]], 'Choose 7 days, 30 days or no limit.');
        }

        $this->signInRulesEditor->change($organisation, $this->user(), $body, $request);

        return new JsonResponse($this->rules($organisation));
    }

    /** @return array<string, mixed> the password-only list only for somebody who can change the rules */
    private function rules(Organisation $organisation): array
    {
        $grants = $this->membershipDirectory->grantsIn($this->user(), $organisation->getId());

        return [
            ...SignInRulesEditor::rulesOf($organisation),
            'inactivityChoices' => SignInRules::INACTIVITY_DAYS,
            'changedAt' => $organisation->getSignInRulesChangedAt()?->format(DateTimeInterface::ATOM),
            'changes' => $this->changes($organisation),
            ...(true === $grants?->holds(Permission::OrganisationManage)
                ? ['passwordOnly' => Vec\map($this->membershipRepository->findActiveWithoutProviderIn($organisation), self::member(...))]
                : []),
        ];
    }

    /** @return list<array<string, mixed>> one per rule changed, newest first, with what it was */
    private function changes(Organisation $organisation): array
    {
        $entries = $this->auditEntryRepository->findLatest(SignInRulesEditor::SUBJECT, $organisation->getId(), SignInRulesEditor::CHANGED, self::CHANGES_SHOWN);
        $changes = [];

        foreach ($entries as $entry) {
            foreach ($entry->changes() as $rule => [$was, $now]) {
                $changes[] = [
                    'at' => $entry->occurredAt()->format(DateTimeInterface::ATOM),
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
        $actor = $entry->actorId();
        $membership = null === $actor ? null : $this->membershipRepository->findActiveByUserId($actor, $organisation->getId());

        return ['name' => $entry->actorLabel(), 'role' => null === $membership ? null : self::role($membership->getRole())];
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
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('Not found.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
