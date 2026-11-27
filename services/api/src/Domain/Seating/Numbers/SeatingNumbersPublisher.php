<?php

declare(strict_types=1);

namespace App\Domain\Seating\Numbers;

use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use Psl\Hash;
use Psl\Json;
use Psl\Str;
use Symfony\Contracts\Cache\CacheInterface;

/** Whenever a number changes (sc-103): the whole read, as a fresh read returns it, on the event's seating topic. A step that moves no number, such as dragging a table, publishes nothing more. */
final readonly class SeatingNumbersPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private SeatingNumbers $seatingNumbers,
        private CacheInterface $cache,
    ) {
    }

    public function publish(Event $event): void
    {
        $id = $event->getId()->toRfc4122();
        $numbers = $this->seatingNumbers->of($event);
        $seen = Hash\hash(Json\encode($numbers), Hash\Algorithm::Sha256);
        $key = 'seating_numbers_' . Str\replace($id, '-', '');

        if ($seen === $this->cache->get($key, static fn (): string => '')) {
            return;
        }

        $this->cache->delete($key);
        $this->cache->get($key, static fn (): string => $seen);
        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $id, $numbers);
    }
}
