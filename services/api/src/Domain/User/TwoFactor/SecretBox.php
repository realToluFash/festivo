<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use LogicException;
use Psl\SecureRandom;
use Psl\Str\Byte;
use SensitiveParameter;

/** Encrypted, not hashed, because checking a code needs the secret; the key is TWO_FACTOR_KEY, never in code. */
final readonly class SecretBox
{
    private string $key;

    public function __construct(#[SensitiveParameter] string $twoFactorKey)
    {
        $key = \base64_decode($twoFactorKey, true);

        if (false === $key || \SODIUM_CRYPTO_SECRETBOX_KEYBYTES !== Byte\length($key)) {
            throw new LogicException('TWO_FACTOR_KEY must be 32 bytes, base64-encoded.');
        }

        $this->key = $key;
    }

    public function seal(#[SensitiveParameter] string $plain): string
    {
        $nonce = SecureRandom\bytes(\SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

        return \base64_encode($nonce . \sodium_crypto_secretbox($plain, $nonce, $this->key));
    }

    public function open(string $sealed): string
    {
        $raw = \base64_decode($sealed, true);
        $nonce = false === $raw ? '' : Byte\slice($raw, 0, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = false === $raw ? false : \sodium_crypto_secretbox_open(Byte\slice($raw, \SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, $this->key);

        if (false === $plain) {
            throw new LogicException('A two-factor secret could not be opened with the configured key.');
        }

        return $plain;
    }
}
