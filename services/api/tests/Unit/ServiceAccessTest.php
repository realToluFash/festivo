<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\EventRole;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Enum\SeededRole;
use App\Enum\ServicePlace;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Vec;

/** sc-4002: who may work the service and who may run it, fixed in code for every role and level. */
final class ServiceAccessTest extends TestCase
{
    #[Test]
    public function everyRoleAndLevelThatRunsTheServiceAlsoWorksIt(): void
    {
        $held = [
            ...Vec\map(SeededRole::cases(), static fn (SeededRole $role): array => [$role->value, $role->defaults()]),
            ...Vec\map(EventRole::cases(), static fn (EventRole $role): array => [$role->value, $role->permissions()]),
        ];

        foreach ($held as [$name, $permissions]) {
            if (Iter\contains($permissions, Permission::ServiceManage)) {
                self::assertContains(Permission::ServiceWork, $permissions, $name);
            }
        }
    }

    #[Test]
    public function ownersAdminsLeadsAndCanEditRunTheServiceAndTheReadingRolesDoNot(): void
    {
        foreach ([SeededRole::Owner->defaults(), SeededRole::Admin->defaults(), EventRole::Lead->permissions(), EventRole::CanEdit->permissions()] as $held) {
            self::assertContains(Permission::ServiceManage, $held);
        }

        foreach ([SeededRole::Member->defaults(), EventRole::CanView->permissions(), EventRole::CanCheckIn->permissions()] as $held) {
            self::assertNotContains(Permission::ServiceWork, $held);
            self::assertNotContains(Permission::ServiceManage, $held);
        }
    }

    /** @return iterable<string, array{0: EventRole, 1: list<Permission>}> */
    public static function serviceLevels(): iterable
    {
        yield 'Can work the floor' => [EventRole::CanWorkFloor, [Permission::EventsRead, Permission::ServiceWork]];
        yield 'Can work the pass' => [EventRole::CanWorkPass, [Permission::EventsRead, Permission::ServiceWork]];
        yield 'Can run the floor' => [EventRole::CanRunFloor, [Permission::EventsRead, Permission::ServiceWork, Permission::ServiceManage]];
    }

    /** @param list<Permission> $permissions */
    #[Test]
    #[DataProvider('serviceLevels')]
    public function aServiceLevelHoldsTheServiceAndTheEventsCardAndNothingElseOfTheEvent(EventRole $level, array $permissions): void
    {
        self::assertSame($permissions, $level->permissions());
        self::assertTrue($level->isServiceLevel());

        $grants = Grants::fromOutside($level);
        self::assertSame([PermissionArea::Events, PermissionArea::Service], Vec\filter(PermissionArea::cases(), $grants->opens(...)));
    }

    #[Test]
    public function theFloorIsRefusedThePassAndThePassTheFloor(): void
    {
        $this->assertAt(Grants::fromOutside(EventRole::CanWorkFloor), ServicePlace::Floor, true);
        $this->assertAt(Grants::fromOutside(EventRole::CanWorkFloor), ServicePlace::Pass, false);
        $this->assertAt(Grants::fromOutside(EventRole::CanWorkPass), ServicePlace::Pass, true);
        $this->assertAt(Grants::fromOutside(EventRole::CanWorkPass), ServicePlace::Floor, false);
    }

    #[Test]
    public function runningTheFloorAnOwnerAnAdminALeadAndCanEditOpenBoth(): void
    {
        foreach ([Grants::fromOutside(EventRole::CanRunFloor), Grants::everything(), Grants::only(SeededRole::Admin->defaults()), Grants::onEvent(EventRole::Lead), Grants::onEvent(EventRole::CanEdit), Grants::fromOutside(EventRole::CanEdit)] as $grants) {
            $this->assertAt($grants, ServicePlace::Floor, true);
            $this->assertAt($grants, ServicePlace::Pass, true);
        }
    }

    #[Test]
    public function viewingAndCheckingGuestsInOpenNeither(): void
    {
        foreach ([Grants::onEvent(EventRole::CanView), Grants::onEvent(EventRole::CanCheckIn), Grants::fromOutside(EventRole::CanCheckIn), Grants::only(SeededRole::Member->defaults())] as $grants) {
            $this->assertAt($grants, ServicePlace::Floor, false);
            $this->assertAt($grants, ServicePlace::Pass, false);
        }
    }

    #[Test]
    public function aMemberReadingOnlyUntilLinkedIsNotOfferedTheService(): void
    {
        self::assertFalse(Grants::onEvent(EventRole::Lead)->readingOnly()->allows(Permission::ServiceWork));
    }

    private function assertAt(Grants $grants, ServicePlace $place, bool $opens): void
    {
        try {
            $grants->requireServiceAt($place);
            self::assertTrue($opens, $place->value . ' should be refused');
        } catch (ApiException $refused) {
            self::assertFalse($opens, $place->value . ' should open');
            self::assertSame(403, $refused->getCode());
        }
    }
}
