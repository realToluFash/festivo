<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use DateTimeImmutable;
use SensitiveParameter;

/**
 * The pair handed back on registration and sign-in.
 *
 * The refresh value is the only place the plain token exists. It is written
 * into the response and never stored, because the row holds its hash.
 */
final readonly class IssuedTokens
{
    public function __construct(
        #[SensitiveParameter]
        public string $accessToken,
        #[SensitiveParameter]
        public string $refreshToken,
        public DateTimeImmutable $refreshExpiresAt,
    ) {
    }
}
