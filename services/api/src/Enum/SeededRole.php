<?php

declare(strict_types=1);

namespace App\Enum;

use Elao\Enum\Attribute\ReadableEnum;
use Elao\Enum\ReadableEnumInterface;
use Elao\Enum\ReadableEnumTrait;
use Psl\Iter;

/** An organisation's three roles, the same in every organisation and never edited (sc-29912), in the order they are listed. */
#[ReadableEnum(prefix: 'seeded_role.', useValueAsDefault: true)]
enum SeededRole: string implements ReadableEnumInterface
{
    use ReadableEnumTrait;

    case Owner = 'owner';
    case Admin = 'administrator';
    case Member = 'member';

    /** @return list<Permission> */
    public function defaults(): array
    {
        $held = [];

        foreach (Permission::cases() as $permission) {
            if (Iter\contains($permission->defaultRoles(), $this)) {
                $held[] = $permission;
            }
        }

        return $held;
    }
}
