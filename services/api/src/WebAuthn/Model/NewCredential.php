<?php

declare(strict_types=1);

namespace App\WebAuthn\Model;

/** What a checked registration leaves to store. */
final readonly class NewCredential
{
    public function __construct(
        public string $id,
        public string $publicKeyPem,
        public string $aaguid,
        public bool $backedUp,
        public int $signCount,
    ) {
    }
}
