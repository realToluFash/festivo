<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\EmailAddressNormaliser;
use DateTimeImmutable;

/** What a provider vouched for. An address is identity only when the provider says it verified it. */
final readonly class ProviderClaims
{
    public function __construct(
        public string $subject,
        public ?string $email,
        public bool $emailVerified,
        public ?string $name,
        /** When the person last signed in at the provider: `auth_time`, else the token's `iat`. */
        public ?DateTimeImmutable $authenticatedAt = null,
    ) {
    }

    public function verifiedEmail(): ?string
    {
        return $this->emailVerified && null !== $this->email ? EmailAddressNormaliser::normalise($this->email) : null;
    }
}
