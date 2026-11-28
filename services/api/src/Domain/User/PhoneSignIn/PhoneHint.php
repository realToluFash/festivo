<?php

declare(strict_types=1);

namespace App\Domain\User\PhoneSignIn;

use App\Entity\PhoneNumber;
use libphonenumber\PhoneNumberUtil;
use Psl\Str;
use Throwable;

/** What a page shows of a number before sign-in completes (sc-4235): its country and last four digits; the client masks it as "+351 ••• ••• 4512". */
final readonly class PhoneHint
{
    private const int SHOWN_DIGITS = 4;

    /** @return array{countryCode: ?string, lastDigits: string}|null */
    public static function of(?PhoneNumber $phone): ?array
    {
        return null === $phone ? null : self::ofNumber($phone->getNumber(), $phone->getCountryCode());
    }

    /** @return array{countryCode: ?string, lastDigits: string} */
    public static function ofNumber(string $e164, ?string $countryCode = null): array
    {
        return ['countryCode' => $countryCode ?? self::regionOf($e164), 'lastDigits' => Str\slice($e164, Str\length($e164) - self::SHOWN_DIGITS)];
    }

    private static function regionOf(string $e164): ?string
    {
        try {
            $util = PhoneNumberUtil::getInstance();

            return $util->getRegionCodeForNumber($util->parse($e164));
        } catch (Throwable) {
            return null;
        }
    }
}
