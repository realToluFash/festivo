<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn\Model;

/** Who a checked ID token says signed in. */
final readonly class OidcAnswer
{
    public function __construct(
        public ?string $email,
        public string $name,
    ) {
    }
}
