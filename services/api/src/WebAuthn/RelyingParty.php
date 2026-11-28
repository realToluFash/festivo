<?php

declare(strict_types=1);

namespace App\WebAuthn;

use Psl\Str;

/** None set, an IP address (WebAuthn Level 3 §5.1.3), or a host the origin is not on: the browser refuses every sheet. */
final readonly class RelyingParty
{
    public ?string $id;

    public function __construct(
        string $relyingPartyId,
        public string $origin,
    ) {
        $id = Str\lowercase(Str\trim($relyingPartyId));
        $host = Str\lowercase((string) \parse_url($origin, \PHP_URL_HOST));
        $onIt = $host === $id || Str\ends_with($host, '.' . $id);

        $this->id = '' === $id || !$onIt || false !== \filter_var(Str\trim($id, '[]'), \FILTER_VALIDATE_IP) ? null : $id;
    }
}
