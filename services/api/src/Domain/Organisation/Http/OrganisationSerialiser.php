<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Http;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Enum\Permission;
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
        ];
    }

    /** @return array<string, mixed> a seeded role is named by its key, which each client words itself */
    public static function membership(Membership $membership): array
    {
        $role = $membership->getRole();

        return self::organisation($membership->getOrganisation()) + [
            'role' => [
                'id' => $role->getId()->toRfc4122(),
                'seededAs' => $role->getSeededAs()?->value,
                'name' => $role->getName(),
            ],
            // The same as GET /api/orgs/{id}/permissions, so a client hides what it cannot use without asking twice.
            'permissions' => Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value),
        ];
    }
}
