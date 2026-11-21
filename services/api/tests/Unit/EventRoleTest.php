<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\EventRole;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Vec;

/** sc-29912: what each role on an event opens, the same in every organisation. */
final class EventRoleTest extends TestCase
{
    #[Test]
    public function aLeadHoldsTheBudgetTheMarginAndPeople(): void
    {
        foreach ([Permission::BudgetRead, Permission::BudgetManage, Permission::BudgetMargin, Permission::PeopleManage, Permission::GuestsManage] as $permission) {
            self::assertContains($permission, EventRole::Lead->permissions(), $permission->value);
        }
    }

    #[Test]
    public function canEditChangesTheEventButNotItsBudgetOrPeople(): void
    {
        $held = EventRole::CanEdit->permissions();

        self::assertContains(Permission::GuestsManage, $held);
        self::assertContains(Permission::EventsManage, $held);
        self::assertSame([], Vec\filter($held, static fn (Permission $permission): bool => PermissionArea::Budget === $permission->area()));
        self::assertNotContains(Permission::PeopleManage, $held);
    }

    #[Test]
    public function neitherReadingRoleChangesAnythingButTheDoorSeesContactDetailsOrTheBudget(): void
    {
        foreach ([EventRole::CanView, EventRole::CanCheckIn] as $role) {
            $held = $role->permissions();

            self::assertSame(EventRole::CanCheckIn === $role ? [Permission::GuestsCheckIn] : [], Vec\values(Vec\filter($held, static fn (Permission $permission): bool => $permission->isChange())), $role->value);
            self::assertNotContains(Permission::GuestsManage, $held, $role->value);
            self::assertSame([], Vec\filter($held, static fn (Permission $permission): bool => PermissionArea::Budget === $permission->area()), $role->value);
        }
    }

    #[Test]
    public function canCheckGuestsInReadsEveryAreaCanViewReadsAndChecksGuestsIn(): void
    {
        self::assertSame([...EventRole::CanView->permissions(), Permission::GuestsCheckIn], EventRole::CanCheckIn->permissions());
        self::assertNotContains(Permission::GuestsCheckIn, EventRole::CanView->permissions());
        self::assertContains(Permission::GuestsCheckIn, EventRole::CanEdit->permissions());
        self::assertContains(Permission::GuestsCheckIn, EventRole::Lead->permissions());
    }

    #[Test]
    public function noEventRoleReachesTheOrganisation(): void
    {
        foreach (EventRole::cases() as $role) {
            foreach ($role->permissions() as $permission) {
                self::assertFalse($permission->isAdministrative(), $role->value . ' ' . $permission->value);
                self::assertNotSame(PermissionArea::Vendors, $permission->area(), $role->value);
                self::assertNotSame(Permission::EventsCreate, $permission, $role->value);
            }
        }
    }
}
