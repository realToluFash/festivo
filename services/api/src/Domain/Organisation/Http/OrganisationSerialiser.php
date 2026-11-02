<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Http;

use App\Domain\Organisation\SignInRules\SignInRulesEditor;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Enum\Permission;
use App\Http\Access\Grants;
use DateTimeInterface;
use Psl\Vec;

final readonly class OrganisationSerialiser
{
    /** @return array<string, mixed> */
    public static function organisation(Organisation $organisation): array
    {
        return [
            'id' => $organisation->getId()->toRfc4122(),
            'name' => $organisation->getName(),
            'countryCode' => $organisation->getCountryCode(),
            'currency' => $organisation->getCurrency(),
            'timezone' => $organisation->getTimezone(),
            'contactAddress' => $organisation->getContactAddress(),
            'locale' => $organisation->getLocale(),
        ];
    }

    /**
     * @param ?array{at: string, written: string, overdue: bool} $twoFactorDue SignInRules::twoFactorDue()
     *
     * @return array<string, mixed> a seeded role is named by its key, which each client words itself
     */
    public static function membership(Membership $membership, Grants $grants, ?array $twoFactorDue): array
    {
        $role = $membership->getRole();
        $organisation = $membership->getOrganisation();
        $name = static fn (Permission $permission): string => $permission->value;

        return self::organisation($organisation) + [
            'role' => [
                'id' => $role->getId()->toRfc4122(),
                'seededAs' => $role->getSeededAs()?->value,
                'name' => $role->getName(),
            ],
            // The same as GET /api/orgs/{id}/permissions, so a client hides what it cannot use without asking twice.
            'permissions' => Vec\map(Vec\filter($role->getPermissions(), $grants->allows(...)), $name),
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
