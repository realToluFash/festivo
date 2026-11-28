<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use LogicException;
use Psl\Str;
use SensitiveParameter;

/**
 * An email address as the stop lists keep it: the HMAC-SHA256 (RFC 2104) of the address lowercased and trimmed, under GUEST_COMPLAINT_KEY, the guest complaint record's key, which nobody rotates, so the database alone cannot tell which address a row stands for (sc-93044) and a new APP_SECRET lifts nothing (sc-93364). A new key matches nothing already kept.
 */
final readonly class EmailAddressHash
{
    public const string PURPOSE = 'email-address:';

    public function __construct(
        #[SensitiveParameter]
        private string $key,
    ) {
    }

    public function of(string $address): string
    {
        if ('' === $this->key) {
            throw new LogicException('GUEST_COMPLAINT_KEY is not set.');
        }

        return \hash_hmac('sha256', self::PURPOSE . self::normalised($address), $this->key);
    }

    public static function normalised(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
