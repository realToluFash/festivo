<?php

declare(strict_types=1);

namespace App\Enum;

use Elao\Enum\Attribute\ReadableEnum;
use Elao\Enum\ReadableEnumInterface;
use Elao\Enum\ReadableEnumTrait;
use Psl\Iter;

/** The five roles every organisation is given at creation (sc-66), in the order they are listed. */
#[ReadableEnum(prefix: 'seeded_role.', useValueAsDefault: true)]
enum SeededRole: string implements ReadableEnumInterface
{
    use ReadableEnumTrait;

    case Owner = 'owner';
    case Administrator = 'administrator';
    case EventManager = 'event_manager';
    case Coordinator = 'coordinator';
    case ReadOnly = 'read_only';

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
