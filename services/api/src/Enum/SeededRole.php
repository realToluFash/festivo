<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;

/** The five roles every organisation is given at creation (sc-66), in the order they are listed. */
enum SeededRole: string
{
    case Owner = 'owner';
    case Administrator = 'administrator';
    case EventManager = 'event_manager';
    case Coordinator = 'coordinator';
    case ReadOnly = 'read_only';

    /** The English label, which a custom role's name may not repeat in any case. */
    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Owner',
            self::Administrator => 'Administrator',
            self::EventManager => 'Event manager',
            self::Coordinator => 'Coordinator',
            self::ReadOnly => 'Read-only',
        };
    }

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
