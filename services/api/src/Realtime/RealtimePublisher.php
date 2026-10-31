<?php

declare(strict_types=1);

namespace App\Realtime;

use App\Enum\RealtimeTopic;
use Psl\Json;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

/** The only way an update reaches the hub, so every topic published is a declared one and only its subscribers get it. */
final readonly class RealtimePublisher
{
    public function __construct(
        private HubInterface $hub,
    ) {
    }

    /** @param array<string, mixed> $data */
    public function publish(RealtimeTopic $topic, string $id, array $data): void
    {
        $this->hub->publish(new Update($topic->for($id), Json\encode($data), private: true));
    }
}
