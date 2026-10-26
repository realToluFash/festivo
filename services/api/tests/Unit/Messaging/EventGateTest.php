<?php

declare(strict_types=1);

namespace App\Tests\Unit\Messaging;

use App\Domain\Messaging\EventGate;
use App\Domain\Messaging\Model\EventState;
use App\Domain\Messaging\Model\EventVerdict;
use App\Enum\EventStatus;
use App\Enum\NotificationEventRule;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class EventGateTest extends TestCase
{
    private const string NOW = '2026-11-01 12:00';

    /** @return iterable<string, array{NotificationEventRule, ?EventState, EventVerdict}> */
    public static function cases(): iterable
    {
        $live = self::state(EventStatus::Live, '+10 days');
        $paused = self::state(EventStatus::Paused, '+10 days');
        $finished = self::state(EventStatus::Live, '-10 days');
        $longFinished = self::state(EventStatus::Live, '-40 days');
        $deleted = new EventState(EventStatus::Live, new DateTimeImmutable('2026-11-11 18:00'), new DateTimeImmutable('2026-11-11 23:00'), null, true);

        yield 'live, automatic' => [NotificationEventRule::Automatic, $live, EventVerdict::Send];
        yield 'paused, automatic waits' => [NotificationEventRule::Automatic, $paused, EventVerdict::Hold];
        yield 'paused, a payment reminder waits' => [NotificationEventRule::AfterConclusion, $paused, EventVerdict::Hold];
        yield 'paused, a host message goes' => [NotificationEventRule::HostMessage, $paused, EventVerdict::Send];
        yield 'paused, a change notice goes' => [NotificationEventRule::ChangeNotice, $paused, EventVerdict::Send];
        yield 'finished, automatic stops' => [NotificationEventRule::Automatic, $finished, EventVerdict::Cancel];
        yield 'finished, a payment reminder goes on' => [NotificationEventRule::AfterConclusion, $finished, EventVerdict::Send];
        yield 'finished, a host message within 30 days' => [NotificationEventRule::HostMessage, $finished, EventVerdict::Send];
        yield 'finished, a host message after 30 days' => [NotificationEventRule::HostMessage, $longFinished, EventVerdict::Cancel];
        yield 'deleted, automatic stops' => [NotificationEventRule::Automatic, $deleted, EventVerdict::Cancel];
        yield 'deleted, a payment reminder stops' => [NotificationEventRule::AfterConclusion, $deleted, EventVerdict::Cancel];
        yield 'deleted, the deletion notice goes' => [NotificationEventRule::DeletionNotice, $deleted, EventVerdict::Send];
        yield 'purged, the deletion notice has nothing left' => [NotificationEventRule::HostMessage, null, EventVerdict::Cancel];
    }

    #[Test]
    #[DataProvider('cases')]
    public function eachTypeFollowsEpic36sModel(NotificationEventRule $rule, ?EventState $event, EventVerdict $expected): void
    {
        self::assertSame($expected, EventGate::verdict($rule, $event, new DateTimeImmutable(self::NOW)));
    }

    private static function state(EventStatus $status, string $startsIn): EventState
    {
        $starts = new DateTimeImmutable(self::NOW)->modify($startsIn);

        return new EventState($status, $starts, $starts->modify('+5 hours'), null, false);
    }
}
