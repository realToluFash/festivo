<?php

declare(strict_types=1);

namespace App\Http;

use Psl\Encoding\Base64;
use Psl\SecureRandom;
use Psl\Str;
use SensitiveParameter;

/**
 * The token of a link that is shown again whenever it is asked for, yet stored only as its SHA-256: the HMAC of a stored 256-bit random seed under the app secret, so a copy of the database alone cannot rebuild it. Calendar feeds (sc-3626) and room screens (sc-3897) share it.
 */
final readonly class LinkTokens
{
    public function __construct(
        #[SensitiveParameter]
        private string $secret,
    ) {
    }

    public static function seed(): string
    {
        return \bin2hex(SecureRandom\bytes(32));
    }

    /** @param int<1, 32> $bytes */
    public function token(string $purpose, string $seed, int $bytes = 32): string
    {
        return Base64\encode(Str\Byte\slice(\hash_hmac('sha256', $purpose . ':' . $seed, $this->secret, true), 0, $bytes), Base64\Variant::UrlSafe, padding: false);
    }

    public static function hash(#[SensitiveParameter] string $token): string
    {
        return \hash('sha256', $token);
    }
}
