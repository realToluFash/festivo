<?php

declare(strict_types=1);

namespace App\Tests\Unit\Messaging;

use App\Domain\Messaging\Model\EventAnchor;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Trigger;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class TriggerTest extends TestCase
{
    #[Test]
    public function aCallersDateCountsOnTheEventsClock(): void
    {
        $event = new EventTimes(new DateTimeImmutable('2026-12-05 18:00', new DateTimeZone('America/New_York')), new DateTimeImmutable('2026-12-05 23:00', new DateTimeZone('America/New_York')), 'America/New_York');

        $due = Trigger::relativeTo('2026-11-20', '-P3D', '10:00')->dueAt($event);

        self::assertSame('2026-11-17 15:00', $due->format('Y-m-d H:i'));
        self::assertSame('UTC', $due->getTimezone()->getName());
    }

    #[Test]
    public function theDayBeforeAtTenStaysAtTenAcrossAClockChange(): void
    {
        $zone = new DateTimeZone('Europe/London');
        $event = new EventTimes(new DateTimeImmutable('2026-10-25 12:00', $zone), new DateTimeImmutable('2026-10-25 16:00', $zone), 'Europe/London');

        $due = Trigger::relativeToEvent(EventAnchor::EventStart, '-P1D', '10:00')->dueAt($event);

        self::assertSame('2026-10-24 10:00', $due->setTimezone($zone)->format('Y-m-d H:i'));
    }

    #[Test]
    public function anEventTriggerFollowsTheEventsNewTimes(): void
    {
        $trigger = Trigger::relativeToEvent(EventAnchor::EventEnd, 'PT2H');
        $zone = new DateTimeZone('Africa/Lagos');

        $moved = $trigger->dueAt(new EventTimes(new DateTimeImmutable('2026-12-12 18:00', $zone), new DateTimeImmutable('2026-12-12 23:00', $zone), 'Africa/Lagos'));

        self::assertSame('2026-12-13 00:00', $moved->format('Y-m-d H:i'));
        self::assertTrue($trigger->followsEvent());
        self::assertFalse(Trigger::at(new DateTimeImmutable())->followsEvent());
    }

    #[Test]
    public function aStoredTriggerReadsBackTheSame(): void
    {
        $trigger = Trigger::relativeTo('2026-11-20', '-P7D', '09:30');

        self::assertEquals($trigger, Trigger::fromArray($trigger->toArray()));
        self::assertEquals(Trigger::at(new DateTimeImmutable('2026-11-17T09:00:00+00:00')), Trigger::fromArray(Trigger::at(new DateTimeImmutable('2026-11-17T09:00:00+00:00'))->toArray()));
    }

    #[Test]
    public function aCallersDayWithNoEventCountsInUtc(): void
    {
        self::assertSame('2026-11-17 10:00', Trigger::relativeTo('2026-11-20', '-P3D', '10:00')->dueAt(null)->format('Y-m-d H:i'));
    }

    #[Test]
    public function aDayThatIsNotACalendarDateIsRefused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Trigger::relativeTo('2026-11-20T00:00:00+01:00', '-P3D');
    }

    #[Test]
    public function anOffsetThatIsNotADurationIsRefused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Trigger::relativeTo('2026-11-20', '7 days before');
    }

    /** @param array<string, ?string> $stored */
    #[Test]
    #[DataProvider('mismatchedRows')]
    public function aStoredRowWhoseFieldsDisagreeWithItsAnchorIsRefused(array $stored): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/^A trigger anchored on /');

        Trigger::fromArray($stored);
    }

    /** @return iterable<string, array{array<string, ?string>}> */
    public static function mismatchedRows(): iterable
    {
        $row = ['anchor' => 'date', 'moment' => null, 'day' => '2026-11-20', 'offset' => '-P3D', 'timeOfDay' => null];

        yield 'a day anchor with no day' => [['day' => null] + $row];
        yield 'a moment anchor with no moment' => [['anchor' => 'moment', 'day' => null] + $row];
        yield 'a moment anchor with a day' => [['anchor' => 'moment', 'moment' => '2026-11-17T09:00:00+00:00'] + $row];
        yield 'an event anchor with a day' => [['anchor' => 'event_start'] + $row];
    }
}
