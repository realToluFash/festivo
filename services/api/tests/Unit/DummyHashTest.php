<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\User\Password\PasswordResolver;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * Replacing the constant with a placeholder restores the timing oracle and
 * breaks nothing else. This is the only test that notices.
 */
final class DummyHashTest extends TestCase
{
    #[Test]
    public function itIsARealArgon2idHashAtTheConfiguredCost(): void
    {
        $hash = self::dummyHash();

        self::assertStringStartsWith('$argon2id$v=19$', $hash);

        // True for a string that does not parse, and for other parameters.
        self::assertFalse(
            \sodium_crypto_pwhash_str_needs_rehash(
                $hash,
                \SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
                \SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
            ),
            'The dummy hash no longer parses at the interactive parameters, so verifying against it '
                . 'costs nothing and an unknown address is measurably faster than a wrong password.',
        );
    }

    #[Test]
    public function nothingVerifiesAgainstIt(): void
    {
        self::assertFalse(\sodium_crypto_pwhash_str_verify(self::dummyHash(), 'nobody knows this value'));
        self::assertFalse(\sodium_crypto_pwhash_str_verify(self::dummyHash(), ''));
    }

    /** The guard itself. */
    #[Test]
    public function theGuardRejectsAStringThatIsNotAHash(): void
    {
        $invented = '$argon2id$v=19$m=65536,t=4,p=1$bm90aGluZ3Rvc2VlaGVyZQ$Zf5YzL8hMvHk3qQK7xJ1vRtPZ6wCnTbXyA2eUoLmDgI';

        self::assertTrue(
            \sodium_crypto_pwhash_str_needs_rehash(
                $invented,
                \SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
                \SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
            ),
        );
    }

    private static function dummyHash(): string
    {
        $constant = new ReflectionClass(PasswordResolver::class)->getConstant('DUMMY_HASH');

        self::assertIsString($constant);

        return $constant;
    }
}
