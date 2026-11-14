<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Enum\SeededRole;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use ValueError;

/** sc-66: a permission nobody holds is a feature nobody can reach, so each one starts somewhere on purpose. */
final class PermissionRegistryTest extends TestCase
{
    /** Kept for Owner on purpose: handing over the organisation's billing is the owner's alone. */
    private const array OWNER_ONLY = [Permission::BillingManage];

    #[Test]
    public function everyPermissionStartsOnASeededRoleBesidesOwnersAll(): void
    {
        foreach (Permission::cases() as $permission) {
            self::assertContains(SeededRole::Owner, $permission->defaultRoles(), $permission->value);

            if (!Iter\contains(self::OWNER_ONLY, $permission)) {
                self::assertNotSame([SeededRole::Owner], $permission->defaultRoles(), $permission->value . ' reaches no role but Owner');
            }
        }
    }

    #[Test]
    public function anOwnerOnlyPermissionIsOneOnPurpose(): void
    {
        foreach (self::OWNER_ONLY as $permission) {
            self::assertSame([SeededRole::Owner], $permission->defaultRoles(), $permission->value);
        }
    }

    #[Test]
    public function aPermissionIsASnakeCaseAreaAndVerb(): void
    {
        foreach (Permission::cases() as $permission) {
            self::assertMatchesRegularExpression('/^[a-z_]+\.[a-z_]+$/', $permission->value);
            self::assertStringStartsWith($permission->area()->value . '.', $permission->value);
        }
    }

    /** The registry is an enum, so an unregistered name fails before any request: a policy takes a case, not a string. */
    #[Test]
    public function anUnregisteredNameIsNoPermission(): void
    {
        self::assertNull(Permission::tryFrom('budget.everything'));
        $this->expectException(ValueError::class);
        Permission::from('budget.everything');
    }

    #[Test]
    public function everyAreaIsReadThroughOneOfItsOwnPermissions(): void
    {
        foreach (PermissionArea::cases() as $area) {
            self::assertSame($area, $area->reading()->area(), $area->value);
        }
    }
}
