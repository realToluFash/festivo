<?php

declare(strict_types=1);

namespace App\Realtime;

use App\Enum\RealtimeTopic;
use Psl\Json;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

/** The only way an update reaches the hub, so every topic published is a declared one and only its subscribers get it. */
final readonly class RealtimePublisher
{
    public function __construct(
        private HubInterface $hub,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * A nudge to look again: a refusing hub never fails the write that made the change, and its clients catch up on their next fetch (sc-81423).
     *
     * @param array<string, mixed> $data
     */
    public function publish(RealtimeTopic $topic, string $id, array $data): void
    {
        try {
            $this->publishOrFail($topic, $id, $data);
        } catch (RuntimeException $e) {
            $this->logger->warning('The hub refused an update; its subscribers catch up on their next fetch.', ['topic' => $topic->for($id), 'exception' => $e::class]);
        }
    }

    /**
     * For a caller that retries when the hub refuses, as the bell's delivery does (sc-3980).
     *
     * @param array<string, mixed> $data
     *
     * @throws RuntimeException when the hub refuses the update
     */
    public function publishOrFail(RealtimeTopic $topic, string $id, array $data): void
    {
        $this->hub->publish(new Update($topic->for($id), Json\encode($data), private: true));
    }
}
