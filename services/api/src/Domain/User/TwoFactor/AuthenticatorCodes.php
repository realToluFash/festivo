<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use OTPHP\TOTP;
use Psl\Math;
use Psl\Regex;
use Psl\Type;
use SensitiveParameter;

/** RFC 6238 as every authenticator reads it: six digits, 30-second steps, SHA-1, one step of drift either side. */
final class AuthenticatorCodes
{
    public const int DRIFT_STEPS = 1;

    private const string ISSUER = 'Soirely';

    /** 160 bits, as RFC 4226 recommends: 32 characters to type, where the default makes 103. */
    private const int SECRET_BYTES = 20;

    public function newSecret(): string
    {
        return TOTP::generate(null, self::SECRET_BYTES)->getSecret();
    }

    public function provisioningUri(#[SensitiveParameter] string $secret, string $label): string
    {
        $totp = TOTP::createFromSecret(Type\non_empty_string()->coerce($secret));
        $totp->setLabel(Type\non_empty_string()->coerce($label));
        $totp->setIssuer(self::ISSUER);

        return $totp->getProvisioningUri();
    }

    /** The time step the code was made for, or null when it matches none inside the window. */
    public function matchingStep(#[SensitiveParameter] string $secret, #[SensitiveParameter] string $code, int $now): ?int
    {
        if (!Regex\matches($code, '/^\d{6}$/')) {
            return null;
        }

        $totp = TOTP::createFromSecret(Type\non_empty_string()->coerce($secret));
        $period = $totp->getPeriod();
        $current = Math\div($now, $period);

        for ($step = $current - self::DRIFT_STEPS; $step <= $current + self::DRIFT_STEPS; ++$step) {
            if (\hash_equals($totp->at(Type\uint()->coerce($step * $period)), $code)) {
                return $step;
            }
        }

        return null;
    }
}
