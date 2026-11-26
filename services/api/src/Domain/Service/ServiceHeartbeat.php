<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\EventRepository;
use Psl\Dict;
use Psl\Iter;
use Psr\Clock\ClockInterface;

/** A beat on each service topic while service is on (sc-4028): a device that hears nothing for 20 seconds knows the stream is dead, wherever on the path it died. */
final readonly class ServiceHeartbeat
{
    public const int EVERY_SECONDS = 10;

    /** A change of phase is published within this, the end included, though the clock and not a write makes it. */
    public const int LOOK_SECONDS = 1;

    public function __construct(
        private ServicePhases $servicePhases,
        private RealtimePublisher $realtimePublisher,
        private EventRepository $eventRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return int how many services it beat on */
    public function beat(): int
    {
        $now = $this->clock->now();
        $events = $this->servicePhases->on($now);

        foreach ($events as $event) {
            $this->publish($event->getId()->toRfc4122(), ['type' => 'heartbeat', 'at' => $now->format(\DATE_RFC3339_EXTENDED)]);
        }

        return Iter\count($events);
    }

    /**
     * Publishes the phase of each service that came on or went off since the last look.
     *
     * @param array<string, true> $wasOn
     *
     * @return array<string, true> the services on now, for the next look
     */
    public function look(array $wasOn): array
    {
        $now = $this->clock->now();
        $on = Dict\from_keys(Dict\map($this->servicePhases->on($now), static fn (Event $event): string => $event->getId()->toRfc4122()), static fn (): true => true);

        foreach (Dict\diff_by_key($on, $wasOn) as $id => $_) {
            $this->publish($id, ['type' => 'phase', 'phase' => 'on', 'at' => $now->format(\DATE_RFC3339_EXTENDED)]);
        }

        foreach (Dict\diff_by_key($wasOn, $on) as $id => $_) {
            $event = $this->eventRepository->find($id);

            if (null !== $event) {
                $this->publish($id, ['type' => 'phase', 'phase' => $this->servicePhases->of($event, $now)->value, 'at' => $now->format(\DATE_RFC3339_EXTENDED)]);
            }
        }

        return $on;
    }

    /** @param array<string, string> $message */
    private function publish(string $eventId, array $message): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventService, $eventId, $message);
    }
}
