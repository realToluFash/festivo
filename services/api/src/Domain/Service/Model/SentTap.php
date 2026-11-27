<?php

declare(strict_types=1);

namespace App\Domain\Service\Model;

/** A service write's Idempotency-Key (draft-ietf-httpapi-idempotency-key-header), made on the device when the tap was made, and the request it came with, hashed. */
final readonly class SentTap
{
    public function __construct(
        public string $key,
        public string $fingerprint,
    ) {
    }
}
