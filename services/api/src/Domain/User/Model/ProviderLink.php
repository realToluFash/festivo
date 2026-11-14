<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Enum\IdentityProvider;

/** The provider a sign-in came through, and its identity to add to the account once it lets the person in. */
final readonly class ProviderLink
{
    public function __construct(
        public IdentityProvider $provider,
        public string $subject,
        public ?string $email = null,
    ) {
    }
}
