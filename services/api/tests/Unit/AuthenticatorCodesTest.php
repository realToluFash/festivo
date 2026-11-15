<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\User\TwoFactor\AuthenticatorCodes;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Math;
use Psl\Type;

final class AuthenticatorCodesTest extends TestCase
{
    /**
     * RFC 6238's own secret, "12345678901234567890", in base32.
     *
     * @mago-expect lint:no-literal-password
     */
    private const string RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    private const int NOW = 1_800_000_000;

    #[Test]
    public function itMakesTheCodesTheRfcDoes(): void
    {
        // RFC 6238 appendix B: 94287082 at T = 59, of which an authenticator shows the last six digits.
        self::assertSame(1, new AuthenticatorCodes()->matchingStep(self::RFC_SECRET, '287082', 59));
    }

    #[Test]
    public function aCodeOneStepEitherSideOfNowIsAcceptedForDrift(): void
    {
        $codes = new AuthenticatorCodes();
        $step = Math\div(self::NOW, 30);

        self::assertSame($step - 1, $codes->matchingStep(self::RFC_SECRET, $this->codeAt(self::NOW - 30), self::NOW));
        self::assertSame($step, $codes->matchingStep(self::RFC_SECRET, $this->codeAt(self::NOW), self::NOW));
        self::assertSame($step + 1, $codes->matchingStep(self::RFC_SECRET, $this->codeAt(self::NOW + 30), self::NOW));
    }

    #[Test]
    public function twoStepsAwayIsOutsideTheWindow(): void
    {
        $codes = new AuthenticatorCodes();

        self::assertNull($codes->matchingStep(self::RFC_SECRET, $this->codeAt(self::NOW - 60), self::NOW));
        self::assertNull($codes->matchingStep(self::RFC_SECRET, $this->codeAt(self::NOW + 60), self::NOW));
    }

    #[Test]
    public function anythingButSixDigitsMatchesNothing(): void
    {
        $codes = new AuthenticatorCodes();
        $code = $this->codeAt(self::NOW);

        self::assertNull($codes->matchingStep(self::RFC_SECRET, ' ' . $code, self::NOW));
        self::assertNull($codes->matchingStep(self::RFC_SECRET, '', self::NOW));
        self::assertNull($codes->matchingStep(self::RFC_SECRET, '12345', self::NOW));
    }

    private function codeAt(int $timestamp): string
    {
        return TOTP::createFromSecret(self::RFC_SECRET)->at(Type\uint()->coerce($timestamp));
    }
}
