<?php

declare(strict_types=1);

namespace App\Integrations\Redis;

use Redis;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final readonly class RedisFactory
{
    public function __construct(
        #[Autowire('%env(REDIS_HOST)%')]
        private string $host,
        #[Autowire('%env(int:REDIS_PORT_INTERNAL)%')]
        private int $port,
        #[SensitiveParameter]
        #[Autowire('%env(REDIS_PASSWORD)%')]
        private string $password,
    ) {
    }

    public function create(): Redis
    {
        $redis = new Redis();
        $redis->connect($this->host, $this->port, 2.0);

        // A server with no password refuses AUTH, so the local stacks send none.
        if ('' !== $this->password) {
            $redis->auth($this->password);
        }

        return $redis;
    }
}
