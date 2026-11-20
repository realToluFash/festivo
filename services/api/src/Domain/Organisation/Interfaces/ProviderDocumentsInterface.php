<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

/** What an identity provider publishes at an address the Owner gave: its SAML metadata, or its OpenID configuration (sc-610). */
interface ProviderDocumentsInterface
{
    /** Null when it cannot be read: unreachable, refused, not 200, or too large. */
    public function fetch(string $url): ?string;
}
