<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Http;

use App\Domain\Organisation\SignInRules\SignInRulesEditor;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Enum\Permission;
use App\Http\Access\Grants;
use App\Repository\SubscriptionRepository;
use DateTimeInterface;
use Psl\Vec;

final readonly class OrganisationSerialiser
{
    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
    ) {
    }

    /** @return array<string, mixed> */
    public function organisation(Organisation $organisation): array
    {
        $subscription = $this->subscriptionRepository->findCurrentOf($organisation->getId());

        return [
            'id' => $organisation->getId()->toRfc4122(),
            'name' => $organisation->getName(),
            'countryCode' => $organisation->getCountryCode(),
            'currency' => $organisation->getCurrency(),
            'timezone' => $organisation->getTimezone(),
            'contactAddress' => $organisation->getContactAddress(),
            'locale' => $organisation->getLocale(),
            // sc-581: what the organisation's plan unlocks is Plan::unlocks(); a client shows the lock from this.
            'plan' => $subscription->getPlan()->value,
            'subscription' => [
                'status' => $subscription->getStatus()->value,
                'periodEnd' => $subscription->getPeriodEnd()?->format(DateTimeInterface::ATOM),
            ],
        ];
    }

    /**
     * @param ?array{at: string, written: string, overdue: bool} $twoFactorDue SignInRules::twoFactorDue()
     * @param list<Permission>                                   $onAnEvent    EventScope::onAnEvent()
     *
     * @return array<string, mixed> a seeded role is named by its key, which each client words itself
     */
    public function membership(Membership $membership, Grants $grants, ?array $twoFactorDue, array $onAnEvent): array
    {
        $role = $membership->getRole();
        $organisation = $membership->getOrganisation();
        $name = static fn (Permission $permission): string => $permission->value;

        return $this->organisation($organisation) + [
            'role' => [
                'id' => $role->getId()->toRfc4122(),
                'seededAs' => $role->getSeededAs()->value,
            ],
            // The same as GET /api/orgs/{id}/permissions, so a client hides what it cannot use without asking twice.
            'permissions' => Vec\map(Vec\filter($role->getPermissions(), $grants->allows(...)), $name),
            // sc-3901: a page an event role opens, such as the Menu library, is reached the way the API lets the member in.
            'onAnEvent' => Vec\map($onAnEvent, $name),
            // sc-69: what waits on two-factor, and whether only reading is open until Google or Apple is linked.
            'withheldUntilTwoFactor' => Vec\map($grants->withheld(), $name),
            'readOnlyUntilLinked' => $grants->isReadOnly(),
            'withheldUntilLinked' => Vec\map($grants->withheldUntilLinked(), $name),
            // sc-609: the deadline for two-factor of everyone, while this member has none.
            'twoFactorDue' => $twoFactorDue,
            'signInRules' => [
                ...SignInRulesEditor::rulesOf($organisation),
                'changedAt' => $organisation->getSignInRulesChangedAt()?->format(DateTimeInterface::ATOM),
            ],
        ];
    }
}
