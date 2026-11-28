<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn\Model;

/** Where to send the browser, and whose sign-in it is. */
final readonly class SingleSignOnStart
{
    public function __construct(
        public string $authorizationUrl,
        public string $organisation,
        public string $provider,
    ) {
    }
}
