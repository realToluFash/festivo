<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;
use Psl\Vec;

/** What a person holds on one event (sc-29912), the same in every organisation. Can view and Can check guests in are sc-71's levels; the three service levels are for someone from outside alone (sc-4002). */
enum EventRole: string
{
    case Lead = 'lead';
    case CanEdit = 'can_edit';
    case CanView = 'can_view';
    case CanCheckIn = 'can_check_in';
    case CanWorkFloor = 'can_work_floor';
    case CanWorkPass = 'can_work_pass';
    case CanRunFloor = 'can_run_floor';

    /** The levels that open the service and the event's card and nothing else of the event, never offered for a member (sc-4002, sc-95382). */
    public const array SERVICE_LEVELS = [self::CanWorkFloor, self::CanWorkPass, self::CanRunFloor];

    /** @return list<Permission> guest contact details go with guests.manage, so neither read-only role reaches them; Can check guests in adds the door alone (sc-1454) */
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
            self::CanCheckIn => [...$reads, Permission::PeopleRead, Permission::GuestsCheckIn],
            self::CanWorkFloor, self::CanWorkPass => [Permission::EventsRead, Permission::ServiceWork],
            self::CanRunFloor => [Permission::EventsRead, Permission::ServiceWork, Permission::ServiceManage],
        };
    }

    /** @return list<PermissionArea> what the level opens held from outside an organisation (sc-71): Can edit every area but Budget, the reading levels Overview, Guests, Schedule, Seating and People, the service levels the event's card and the service (sc-95382) */
    public function areasFromOutside(): array
    {
        return match ($this) {
            self::Lead, self::CanEdit => Vec\filter(PermissionArea::cases(), static fn (PermissionArea $area): bool => PermissionArea::Budget !== $area),
            self::CanView, self::CanCheckIn => [PermissionArea::Events, PermissionArea::Guests, PermissionArea::RunOfShow, PermissionArea::Seating, PermissionArea::People],
            self::CanWorkFloor, self::CanWorkPass, self::CanRunFloor => [PermissionArea::Events, PermissionArea::Service],
        };
    }

    public function isServiceLevel(): bool
    {
        return Iter\contains(self::SERVICE_LEVELS, $this);
    }

    /** Where on the night it works: Can work the floor never the pass, Can work the pass never the floor; anyone else holding the service works both (sc-4002). */
    public function worksAt(ServicePlace $place): bool
    {
        return match ($this) {
            self::CanWorkFloor => ServicePlace::Floor === $place,
            self::CanWorkPass => ServicePlace::Pass === $place,
            default => true,
        };
    }

    /** @return list<self> the roles holding it */
    public static function holding(Permission $permission): array
    {
        return Vec\filter(self::cases(), static fn (self $role): bool => Iter\contains($role->permissions(), $permission));
    }
}
