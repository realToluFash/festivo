<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use Psl\Str;
use SensitiveParameter;

/**
 * An email address as the stop lists keep it: the HMAC-SHA256 (RFC 2104) of the address lowercased and trimmed, under the app secret, so the database alone cannot tell which address a row stands for (sc-93044). A new secret matches nothing already kept.
 */
final readonly class EmailAddressHash
{
    public const string PURPOSE = 'email-address:';

    public function __construct(
        #[SensitiveParameter]
        private string $secret,
    ) {
    }

    public function of(string $address): string
    {
        return \hash_hmac('sha256', self::PURPOSE . self::normalised($address), $this->secret);
    }

    public static function normalised(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
