<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use Psl\Iter;
use Psr\Clock\ClockInterface;

/** A beat on each service topic while service is on (sc-4028): a device that hears nothing for 20 seconds knows the stream is dead, wherever on the path it died. */
final readonly class ServiceHeartbeat
{
    public const int EVERY_SECONDS = 10;

    public function __construct(
        private ServicePhases $servicePhases,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /** @return int how many services it beat on */
    public function beat(): int
    {
        $now = $this->clock->now();
        $events = $this->servicePhases->on($now);

        foreach ($events as $event) {
            $this->realtimePublisher->publish(RealtimeTopic::EventService, $event->getId()->toRfc4122(), ['type' => 'heartbeat', 'at' => $now->format(\DATE_RFC3339_EXTENDED)]);
        }

        return Iter\count($events);
    }
}
