<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Enum\PasswordFailure;
use Normalizer;
use Psl\Str;
use SensitiveParameter;

/**
 * NIST SP 800-63B. The notable part is what is absent: no composition rules, no
 * forced rotation, no restricted character set.
 */
final readonly class PasswordPolicy
{
    public const int MINIMUM_LENGTH = 12;

    /** Far above NIST's required 64, and only so a megabyte cannot be handed to a slow hash. */
    public const int MAXIMUM_LENGTH = 4096;

    /** @return list<PasswordFailure> */
    public static function check(#[SensitiveParameter] string $password): array
    {
        $normalised = self::normalise($password);
        $length = Str\length($normalised);

        $failures = [];

        if ($length < self::MINIMUM_LENGTH) {
            $failures[] = PasswordFailure::TooShort;
        }

        if ($length > self::MAXIMUM_LENGTH) {
            $failures[] = PasswordFailure::TooLong;
        }

        return $failures;
    }

    /**
     * NFKC, as NIST SP 800-63B recommends, so a password typed with a composed
     * character and the same password typed with a decomposed one are the same
     * password. Without it somebody whose keyboard produces one form cannot sign
     * in from a device that produces the other.
     *
     * **Never call this on its own.** Hashing and verifying must apply the same
     * normalisation or nobody can sign in, so both go through PasswordResolver.
     */
    public static function normalise(#[SensitiveParameter] string $password): string
    {
        $normalised = \normalizer_normalize($password, Normalizer::FORM_KC);

        // normalizer_normalize answers false on malformed UTF-8. Refusing the
        // password outright would be a worse answer than hashing what we were
        // given: the length check still applies, and a password nobody can
        // retype is the person's own problem rather than a security one.
        return false === $normalised ? $password : $normalised;
    }
}
