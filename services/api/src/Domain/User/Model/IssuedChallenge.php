<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use DateTimeImmutable;
use SensitiveParameter;

/** The first factor passed and the account has a second: this, not tokens, until a code does. */
final readonly class IssuedChallenge
{
    public function __construct(
        #[SensitiveParameter]
        public string $token,
        public DateTimeImmutable $expiresAt,
        /** @var array{app: bool, passkeys: bool} which factors the step can ask for, so it opens on the right one */
        public array $factors,
    ) {
    }
}
