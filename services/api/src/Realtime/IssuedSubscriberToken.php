<?php

declare(strict_types=1);

namespace App\Realtime;

use DateTimeImmutable;
use SensitiveParameter;

final readonly class IssuedSubscriberToken
{
    public function __construct(
        #[SensitiveParameter]
        public string $token,
        public DateTimeImmutable $expiresAt,
    ) {
    }
}
