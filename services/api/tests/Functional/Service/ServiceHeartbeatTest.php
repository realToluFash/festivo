<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Service\ServiceHeartbeat;
use App\Entity\Event;
use App\Enum\EventStatus;
use App\Tests\Double\Messaging\RecordingHub;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

/** sc-4028: a heartbeat on the service topic every 10 seconds while service is on, and none while it is off. */
final class ServiceHeartbeatTest extends ServiceTestCase
{
    #[Test]
    public function aServiceThatIsOnGetsAPrivateBeatCarryingOnlyItsTypeAndTime(): void
    {
        $this->makeLive();
        $this->arrive('Adaeze Obi');
        $this->fire();

        self::assertSame(1, self::service(ServiceHeartbeat::class)->beat());

        $beats = $this->beats();
        self::assertCount(1, $beats);
        self::assertSame(['events/' . $this->event->getId()->toRfc4122() . '/service'], $beats[0]->getTopics());
        self::assertTrue($beats[0]->isPrivate());
        self::assertSame(['type' => 'heartbeat', 'at' => '2027-03-06T19:00:00.000+00:00'], Json\decode($beats[0]->getData()));
        self::assertSame('on', $this->read()['phase']);
    }

    #[Test]
    public function noBeatBeforeServiceStarts(): void
    {
        $this->makeLive();

        self::assertSame(0, self::service(ServiceHeartbeat::class)->beat());
        self::assertSame([], $this->beats());
        self::assertSame('notStarted', $this->read()['phase']);
    }

    #[Test]
    public function noBeatOnceServiceHasEnded(): void
    {
        $this->makeLive();
        $this->arrive('Adaeze Obi');
        $this->fire();
        self::mockTime(new DateTimeImmutable('2027-03-07T01:00:00Z'));

        self::assertSame(0, self::service(ServiceHeartbeat::class)->beat());
        self::assertSame([], $this->beats());
        self::assertSame('ended', $this->read()['phase']);
    }

    /** @return list<Update> */
    private function beats(): array
    {
        return Vec\filter(self::service(RecordingHub::class)->published, static fn (Update $update): bool => Str\contains($update->getData(), 'heartbeat'));
    }

    private function makeLive(): void
    {
        $event = self::em()->find(Event::class, $this->event->getId()) ?? self::fail('no event');

        if (EventStatus::Live !== $event->getStatus()) {
            $event->makeLive(new DateTimeImmutable('2027-03-06T12:00:00Z'));
            self::em()->flush();
        }

        self::service(RecordingHub::class)->published = [];
    }
}
