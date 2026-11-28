<?php

declare(strict_types=1);

namespace App\Integrations\OpenIdConnect;

use App\Enum\IdentityProvider;

interface SigningKeysInterface
{
    /** The public key a provider signs with under this key id, as PEM; `fresh` skips the cache. */
    public function publicKey(IdentityProvider $provider, string $keyId, bool $fresh): ?string;
}
