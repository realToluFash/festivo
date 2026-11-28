<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

use SensitiveParameter;

/** What an identity provider publishes at an address the Owner gave: its SAML metadata, or its OpenID configuration (sc-610). */
interface ProviderDocumentsInterface
{
    /** Null when it cannot be read: unreachable, refused, not 200, or too large. */
    public function fetch(string $url): ?string;

    /**
     * HTTP Basic, OpenID Connect's default. The body comes back whatever the status, since a refusal says why; null when nothing answers.
     *
     * @param array<string, string> $fields
     */
    public function redeem(string $endpoint, string $clientId, #[SensitiveParameter] string $clientSecret, #[SensitiveParameter] array $fields): ?string;
}
