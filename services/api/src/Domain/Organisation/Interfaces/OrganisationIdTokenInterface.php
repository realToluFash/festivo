<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

use App\Domain\Organisation\SingleSignOn\Model\OidcAnswer;
use App\Entity\SsoProvider;
use SensitiveParameter;

/** An ID token from an organisation's own identity provider (sc-610). */
interface OrganisationIdTokenInterface
{
    /** Null when any check fails. */
    public function read(SsoProvider $provider, #[SensitiveParameter] string $idToken, string $nonce): ?OidcAnswer;
}
