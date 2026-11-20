<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SingleSignOn;

use App\Entity\Organisation;
use Psl\Str;

/** Soirely's own side of an organisation's connection, which the Owner gives to the identity provider. */
final readonly class ServiceUrls
{
    public function __construct(
        private string $ssoServiceOrigin,
    ) {
    }

    public function samlEntityId(Organisation $organisation): string
    {
        return $this->at('/api/sso/saml/%s', $organisation);
    }

    public function samlReplyUrl(Organisation $organisation): string
    {
        return $this->at('/api/sso/saml/%s/acs', $organisation);
    }

    public function samlMetadataUrl(Organisation $organisation): string
    {
        return $this->at('/api/sso/saml/%s/metadata', $organisation);
    }

    public function oidcRedirectUrl(Organisation $organisation): string
    {
        return $this->at('/api/sso/oidc/%s/callback', $organisation);
    }

    private function at(string $path, Organisation $organisation): string
    {
        return Str\trim_right($this->ssoServiceOrigin, '/') . Str\format($path, $organisation->getId()->toRfc4122());
    }
}
