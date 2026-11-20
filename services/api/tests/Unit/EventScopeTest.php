<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

final class EventScopeTest extends TestCase
{
    #[Test]
    public function anOwnerOrAdminHoldsAPermissionOnEveryEventOrOnNone(): void
    {
        self::assertNull(new EventScope(null, Grants::only([Permission::EventsRead]))->eventsHolding(Permission::EventsRead));
        self::assertSame([], new EventScope(null, Grants::only([Permission::EventsRead]))->eventsHolding(Permission::GuestsRead));
    }

    #[Test]
    public function aMemberHoldsItOnlyOnTheEventsWhoseRoleGrantsIt(): void
    {
        $guests = Uuid::v7();
        $eventOnly = Uuid::v7();
        $organisation = new Organisation('Ìrè Events', 'NG', 'NGN', 'Africa/Lagos', 'hello@ire.events', 'en');
        $member = new Membership($organisation, new User('Kemi', null, AccountOrigin::SelfRegistered), new Role($organisation, SeededRole::Member), MembershipStatus::Active, new DateTimeImmutable());
        $scope = new EventScope($member, Grants::only([]), [
            $guests->toRfc4122() => Grants::only([Permission::EventsRead, Permission::GuestsRead]),
            $eventOnly->toRfc4122() => Grants::only([Permission::EventsRead]),
        ]);

        self::assertEquals([$guests, $eventOnly], $scope->eventsHolding(Permission::EventsRead));
        self::assertEquals([$guests], $scope->eventsHolding(Permission::GuestsRead));
        self::assertSame([], $scope->eventsHolding(Permission::MembersRead));
    }
}
