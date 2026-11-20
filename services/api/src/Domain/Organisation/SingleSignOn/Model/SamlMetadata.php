<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn\Model;

/** What Soirely needs from a provider's SAML metadata. */
final readonly class SamlMetadata
{
    /** @param non-empty-list<string> $certificates base64 DER */
    public function __construct(
        public string $entityId,
        public string $signOnUrl,
        public array $certificates,
    ) {
    }
}
