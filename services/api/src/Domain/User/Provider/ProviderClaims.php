<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\EmailAddressNormaliser;
use DateTimeImmutable;
use Psl\Str;

/** What a provider vouched for. An address is identity only when the provider says it verified it. */
final readonly class ProviderClaims
{
    /** A blank `email` is not an address (OpenID Connect Core 1.0 §5.1), so it is held as none. */
    public ?string $email;

    public function __construct(
        public string $subject,
        ?string $email,
        public bool $emailVerified,
        public ?string $name,
        /** When the person last signed in at the provider: `auth_time`, else the token's `iat`. */
        public ?DateTimeImmutable $authenticatedAt = null,
    ) {
        $this->email = null === $email || '' === Str\trim($email) ? null : $email;
    }

    public function verifiedEmail(): ?string
    {
        return $this->emailVerified && null !== $this->email ? EmailAddressNormaliser::normalise($this->email) : null;
    }
}
