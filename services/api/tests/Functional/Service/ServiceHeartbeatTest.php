<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Service\ServiceHeartbeat;
use App\Entity\Event;
use App\Enum\EventStatus;
use App\Tests\Double\Messaging\RecordingHub;
use Closure;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

/** sc-4028: a heartbeat on the service topic every 10 seconds while service is on, none while it is off, and each change of phase. */
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

    #[Test]
    public function aPauseLeavesServiceOnAndItsBeat(): void
    {
        $this->makeLive();
        $this->arrive('Adaeze Obi');
        $this->fire();
        $this->changeEvent(static fn (Event $event) => $event->pause(new DateTimeImmutable('2027-03-06T19:00:00Z')));

        self::assertSame(1, self::service(ServiceHeartbeat::class)->beat());
        self::assertSame('on', $this->read()['phase']);
    }

    #[Test]
    public function anEventFinishedWithNoCourseFiredHasEndedService(): void
    {
        $this->makeLive();
        $this->changeEvent(static fn (Event $event) => $event->end(new DateTimeImmutable('2027-03-06T19:00:00Z')));

        self::assertSame(0, self::service(ServiceHeartbeat::class)->beat());
        self::assertSame('ended', $this->read()['phase']);
    }

    #[Test]
    public function eachChangeOfPhaseIsPublishedOnTheTopicTheEndIncluded(): void
    {
        $heartbeat = self::service(ServiceHeartbeat::class);
        $this->makeLive();
        $on = $heartbeat->look([]);
        self::assertSame([], $on);

        $this->arrive('Adaeze Obi');
        $this->fire();
        self::service(RecordingHub::class)->published = [];
        $on = $heartbeat->look($on);
        $on = $heartbeat->look($on);

        $id = $this->event->getId()->toRfc4122();
        self::assertSame([$id => true], $on);
        self::assertSame([['type' => 'phase', 'phase' => 'on', 'at' => '2027-03-06T19:00:00.000+00:00']], $this->phases());

        $this->changeEvent(static fn (Event $event) => $event->end(new DateTimeImmutable('2027-03-06T19:00:00Z')));
        self::service(RecordingHub::class)->published = [];

        self::assertSame([], $heartbeat->look($on));
        self::assertSame([['type' => 'phase', 'phase' => 'ended', 'at' => '2027-03-06T19:00:00.000+00:00']], $this->phases());
    }

    #[Test]
    public function theEndByTheClockIsPublishedTooThoughNoWriteMakesIt(): void
    {
        $heartbeat = self::service(ServiceHeartbeat::class);
        $this->makeLive();
        $this->arrive('Adaeze Obi');
        $this->fire();
        $on = $heartbeat->look([]);
        self::service(RecordingHub::class)->published = [];
        self::mockTime(new DateTimeImmutable('2027-03-07T01:00:00Z'));

        self::assertSame([], $heartbeat->look($on));
        self::assertSame([['type' => 'phase', 'phase' => 'ended', 'at' => '2027-03-07T01:00:00.000+00:00']], $this->phases());
    }

    /** @return list<mixed> */
    private function phases(): array
    {
        return Vec\map(
            Vec\filter(self::service(RecordingHub::class)->published, static fn (Update $update): bool => Str\contains($update->getData(), '"phase"')),
            static fn (Update $update): mixed => Json\decode($update->getData()),
        );
    }

    /** @param Closure(Event): void $change */
    private function changeEvent(Closure $change): void
    {
        $event = self::em()->find(Event::class, $this->event->getId()) ?? self::fail('no event');
        $change($event);
        self::em()->flush();
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
