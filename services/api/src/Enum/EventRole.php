<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;
use Psl\Vec;

/** What a person holds on one event (sc-29912), the same in every organisation. Can view and Can check guests in are sc-71's levels. */
enum EventRole: string
{
    case Lead = 'lead';
    case CanEdit = 'can_edit';
    case CanView = 'can_view';
    case CanCheckIn = 'can_check_in';

    /** @return list<Permission> guest contact details go with guests.manage, so neither read-only role reaches them */
    public function permissions(): array
    {
        $onTheEvent = Vec\filter(
            Permission::cases(),
            static fn (Permission $permission): bool => !$permission->isAdministrative() && !Iter\contains([PermissionArea::Vendors, PermissionArea::People], $permission->area()) && Permission::EventsCreate !== $permission,
        );
        $reads = Vec\filter($onTheEvent, static fn (Permission $permission): bool => !$permission->isChange() && PermissionArea::Budget !== $permission->area());

        return match ($this) {
            self::Lead => [...$onTheEvent, Permission::PeopleRead, Permission::PeopleManage],
            self::CanEdit => [...Vec\filter($onTheEvent, static fn (Permission $permission): bool => PermissionArea::Budget !== $permission->area()), Permission::PeopleRead],
            self::CanView => [...$reads, Permission::PeopleRead],
            self::CanCheckIn => [Permission::EventsRead, Permission::GuestsRead, Permission::PeopleRead],
        };
    }

    /** @return list<self> the roles holding it */
    public static function holding(Permission $permission): array
    {
        return Vec\filter(self::cases(), static fn (self $role): bool => Iter\contains($role->permissions(), $permission));
    }
}
