<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Double\RecordingLogger;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Json;
use Psr\Log\LogLevel;
use RuntimeException;

/** A refused publish is a warning naming the topic, never the write's failure, except for a caller that retries (sc-81423). */
final class RealtimePublisherTest extends TestCase
{
    #[Test]
    public function aRefusedPublishIsOneWarningNamingTheTopicAndNoneOfTheUpdate(): void
    {
        $hub = new RecordingHub();
        $hub->failuresLeft = 1;
        $logger = new RecordingLogger();

        new RealtimePublisher($hub, $logger)->publish(RealtimeTopic::EventGuests, 'the-event', ['name' => 'Adaeze Okafor', 'amount' => 125000]);

        self::assertSame([['level' => LogLevel::WARNING, 'message' => 'The hub refused an update; its subscribers catch up on their next fetch.']], $logger->records);
        self::assertSame([['topic' => 'events/the-event/guests', 'exception' => RuntimeException::class]], $logger->contexts);
        self::assertStringNotContainsString('Adaeze', Json\encode($logger->contexts));
        self::assertSame([], $hub->published);
    }

    #[Test]
    public function aPublishTheHubTakesLogsNothing(): void
    {
        $hub = new RecordingHub();
        $logger = new RecordingLogger();

        new RealtimePublisher($hub, $logger)->publish(RealtimeTopic::EventGuests, 'the-event', []);

        self::assertCount(1, $hub->published);
        self::assertSame([], $logger->records);
    }

    #[Test]
    public function aCallerThatRetriesStillSeesTheRefusal(): void
    {
        $hub = new RecordingHub();
        $hub->failuresLeft = 1;
        $logger = new RecordingLogger();

        $this->expectException(RuntimeException::class);

        try {
            new RealtimePublisher($hub, $logger)->publishOrFail(RealtimeTopic::UserNotifications, 'someone', []);
        } finally {
            self::assertSame([], $logger->records);
        }
    }
}
