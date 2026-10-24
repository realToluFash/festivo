<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use DateTimeImmutable;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Vec;

final class MembershipStatusTest extends TestCase
{
    /** @return iterable<string, array{MembershipStatus, MembershipStatus, bool}> */
    public static function transitions(): iterable
    {
        yield 'approved' => [MembershipStatus::PendingApproval, MembershipStatus::Active, true];
        yield 'suspended' => [MembershipStatus::Active, MembershipStatus::Suspended, true];
        yield 'restored' => [MembershipStatus::Suspended, MembershipStatus::Active, true];
        yield 'left while active' => [MembershipStatus::Active, MembershipStatus::LeftOrRemoved, true];
        yield 'removed while suspended' => [MembershipStatus::Suspended, MembershipStatus::LeftOrRemoved, true];
        yield 'removed while waiting' => [MembershipStatus::PendingApproval, MembershipStatus::LeftOrRemoved, true];
        yield 'rejoined' => [MembershipStatus::LeftOrRemoved, MembershipStatus::Active, true];
        yield 'suspended before approval' => [MembershipStatus::PendingApproval, MembershipStatus::Suspended, false];
        yield 'back to waiting' => [MembershipStatus::Active, MembershipStatus::PendingApproval, false];
        yield 'suspended once gone' => [MembershipStatus::LeftOrRemoved, MembershipStatus::Suspended, false];
        yield 'asking again once gone' => [MembershipStatus::LeftOrRemoved, MembershipStatus::PendingApproval, true];
        yield 'active to active' => [MembershipStatus::Active, MembershipStatus::Active, false];
    }

    #[Test]
    #[DataProvider('transitions')]
    public function onlyTheDeclaredTransitionsArePossible(MembershipStatus $from, MembershipStatus $to, bool $declared): void
    {
        self::assertSame($declared, $from->canBecome($to));
    }

    #[Test]
    public function theModelRefusesAnUndeclaredTransitionWhoeverAsks(): void
    {
        $membership = $this->membership(MembershipStatus::PendingApproval);

        $this->expectException(LogicException::class);
        $membership->setStatus(MembershipStatus::Suspended, new DateTimeImmutable());
    }

    #[Test]
    public function aMembershipBeginsOnlyWhereAChannelEntersIt(): void
    {
        $this->expectException(LogicException::class);
        $this->membership(MembershipStatus::Suspended);
    }

    #[Test]
    public function onlyActiveCountsAsActive(): void
    {
        $membership = $this->membership(MembershipStatus::Active);
        $membership->setStatus(MembershipStatus::Suspended, new DateTimeImmutable());

        self::assertFalse($membership->isActive());
    }

    #[Test]
    public function aRoleIsHeldWhileActiveOrSuspendedAndNoOtherTime(): void
    {
        self::assertSame(
            [MembershipStatus::Active, MembershipStatus::Suspended],
            Vec\filter(MembershipStatus::cases(), static fn (MembershipStatus $status): bool => $status->holdsRole()),
        );
    }

    #[Test]
    public function reinstatementKeepsWhenTheMemberJoinedAndReturningRestartsIt(): void
    {
        $membership = $this->membership(MembershipStatus::PendingApproval);
        self::assertNull($membership->getJoinedAt());

        $membership->setStatus(MembershipStatus::Active, new DateTimeImmutable('2026-10-01'));
        $membership->setStatus(MembershipStatus::Suspended, new DateTimeImmutable('2026-10-05'));
        $membership->setStatus(MembershipStatus::Active, new DateTimeImmutable('2026-10-09'));
        self::assertEquals(new DateTimeImmutable('2026-10-01'), $membership->getJoinedAt());

        $membership->setStatus(MembershipStatus::LeftOrRemoved, new DateTimeImmutable('2026-10-12'));
        $membership->setStatus(MembershipStatus::Active, new DateTimeImmutable('2026-10-20'));
        self::assertEquals(new DateTimeImmutable('2026-10-20'), $membership->getJoinedAt());
    }

    private function membership(MembershipStatus $status): Membership
    {
        $organisation = new Organisation('Ìrè Events', 'NG', 'NGN', 'Africa/Lagos', 'hello@ire.events', 'en');

        return new Membership($organisation, new User('Kemi', null, AccountOrigin::SelfRegistered), Role::seeded($organisation, SeededRole::Coordinator), $status, new DateTimeImmutable());
    }
}
