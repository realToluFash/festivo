<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Vec;

final class HeadcountTest extends TestCase
{
    /** @return iterable<string, array{0: GuestReply, 1: bool, 2: GuestStanding, 3?: bool}> */
    public static function standings(): iterable
    {
        yield 'a guest Coming' => [GuestReply::Coming, false, GuestStanding::Accepted];
        yield 'a guest Not sure yet' => [GuestReply::Maybe, false, GuestStanding::Maybe];
        yield 'a guest Not coming' => [GuestReply::NotComing, false, GuestStanding::Declined];
        yield 'a guest with no reply' => [GuestReply::NoReply, false, GuestStanding::AwaitingReply];
        yield 'a companion of a host Coming' => [GuestReply::Coming, true, GuestStanding::Accepted];
        yield 'a companion of a host Not sure yet' => [GuestReply::Maybe, true, GuestStanding::HeldHostMaybe];
        yield 'a companion of a host Not coming' => [GuestReply::NotComing, true, GuestStanding::HeldHostNotComing];
        yield 'a companion of a host with no reply' => [GuestReply::NoReply, true, GuestStanding::HeldHostNoReply];
        yield 'a guest nobody has invited' => [GuestReply::NoReply, false, GuestStanding::NotYetInvited, false];
        yield 'a companion of a host nobody has invited' => [GuestReply::NoReply, true, GuestStanding::NotYetInvited, false];
    }

    #[Test]
    #[DataProvider('standings')]
    public function aCompanionStandsAsTheirHostRepliedAndIsAcceptedOnlyWhenTheHostIsComing(GuestReply $reply, bool $companion, GuestStanding $standing, bool $invited = true): void
    {
        self::assertSame($standing, GuestStanding::of($reply, $companion, $invited));
    }

    /** @return iterable<string, array{GuestReply, bool, GuestStanding}> */
    public static function choices(): iterable
    {
        foreach ([true, false] as $coming) {
            $as = $coming ? 'left Coming' : 'marked Not coming';

            yield "host Coming, companion {$as}" => [GuestReply::Coming, $coming, $coming ? GuestStanding::Accepted : GuestStanding::Declined];
            yield "host Not sure yet, companion {$as}" => [GuestReply::Maybe, $coming, GuestStanding::HeldHostMaybe];
            yield "host Not coming, companion {$as}" => [GuestReply::NotComing, $coming, GuestStanding::HeldHostNotComing];
            yield "host with no reply, companion {$as}" => [GuestReply::NoReply, $coming, GuestStanding::HeldHostNoReply];
        }
    }

    #[Test]
    #[DataProvider('choices')]
    public function aCompanionTheGuestMarkedNotComingIsDeclinedOnlyWhileTheirHostIsComingAndHeldOtherwise(GuestReply $reply, bool $coming, GuestStanding $standing): void
    {
        self::assertSame($standing, GuestStanding::of($reply, companion: true, invited: true, notComingByGuest: !$coming));
    }

    #[Test]
    public function everyStandingIsCountedOnceSoTheCountsAddUp(): void
    {
        $everyone = Vec\concat(GuestStanding::cases(), GuestStanding::cases());

        $counts = HeadcountCalculator::counts(...$everyone);

        self::assertSame(16, $counts['onList']);
        self::assertSame(2, $counts['notYetInvited']);
        self::assertSame($counts['invited'], $counts['accepted'] + $counts['maybe'] + $counts['awaitingReply'] + $counts['held'] + $counts['declined']);
        self::assertSame($counts['onList'], $counts['invited'] + $counts['notYetInvited']);
        self::assertSame($counts['held'], $counts['heldBy']['hostNoReply'] + $counts['heldBy']['hostMaybe'] + $counts['heldBy']['hostNotComing']);
        self::assertSame([2, 2, 2], [$counts['heldBy']['hostNoReply'], $counts['heldBy']['hostMaybe'], $counts['heldBy']['hostNotComing']]);
    }
}
