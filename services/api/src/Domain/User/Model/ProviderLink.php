<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Enum\IdentityProvider;

/** A provider identity to add to an existing account, once that account has let the person in. */
final readonly class ProviderLink
{
    public function __construct(
        public IdentityProvider $provider,
        public string $subject,
    ) {
    }
}
