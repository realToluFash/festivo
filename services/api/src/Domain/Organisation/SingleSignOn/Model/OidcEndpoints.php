<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn\Model;

use SensitiveParameter;

/** What Soirely reads from an issuer's /.well-known/openid-configuration. */
final readonly class OidcEndpoints
{
    public function __construct(
        public string $issuer,
        public string $authorizationEndpoint,
        #[SensitiveParameter]
        public string $tokenEndpoint,
        public string $jwksUri,
    ) {
    }
}
