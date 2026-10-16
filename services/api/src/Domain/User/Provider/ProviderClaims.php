<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

/** What a provider vouched for. An address is identity only when the provider says it verified it. */
final readonly class ProviderClaims
{
    public function __construct(
        public string $subject,
        public ?string $email,
        public bool $emailVerified,
        public ?string $name,
    ) {
    }
}
