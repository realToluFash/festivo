<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use DateTimeImmutable;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

final readonly class IssuedTokens
{
    public function __construct(
        #[SensitiveParameter]
        public string $accessToken,
        #[SensitiveParameter]
        public string $refreshToken,
        public DateTimeImmutable $refreshExpiresAt,
        public Uuid $sessionId,
    ) {
    }
}
