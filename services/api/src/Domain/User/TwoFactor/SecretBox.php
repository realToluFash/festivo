<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use LogicException;
use Psl\SecureRandom;
use Psl\Str\Byte;
use SensitiveParameter;

/** Encrypted, not hashed, as checking a code needs the secret. TWO_FACTOR_KEY is checked on use: every sign-in builds this. */
final readonly class SecretBox
{
    public function __construct(
        #[SensitiveParameter]
        private string $twoFactorKey,
    ) {
    }

    public function seal(#[SensitiveParameter] string $plain): string
    {
        $nonce = SecureRandom\bytes(\SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

        return \base64_encode($nonce . \sodium_crypto_secretbox($plain, $nonce, $this->key()));
    }

    public function open(string $sealed): string
    {
        $raw = \base64_decode($sealed, true);
        $nonce = false === $raw ? '' : Byte\slice($raw, 0, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = false === $raw ? false : \sodium_crypto_secretbox_open(Byte\slice($raw, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, $this->key());

        if (false === $plain) {
            throw new LogicException('A two-factor secret could not be opened with the configured key.');
        }

        return $plain;
    }

    private function key(): string
    {
        $key = \base64_decode($this->twoFactorKey, true);

        if (false === $key || \SODIUM_CRYPTO_SECRETBOX_KEYBYTES !== Byte\length($key)) {
            throw new LogicException('TWO_FACTOR_KEY must be 32 bytes, base64-encoded.');
        }

        return $key;
    }
}
