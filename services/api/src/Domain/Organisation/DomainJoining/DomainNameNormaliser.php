<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use Psl\Regex;
use Psl\Str;

/** One reading of a typed domain, and of the domain an address is at, so a listing and an address compare as equals. */
final readonly class DomainNameNormaliser
{
    /** sc-63's check for a domain, the same as the clients': labels of letters, digits and inner hyphens, at least one dot. */
    private const string HOSTNAME = '/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/';

    public static function normalise(string $typed): string
    {
        return Str\lowercase(Str\trim($typed));
    }

    public static function isHostname(string $normalised): bool
    {
        return Regex\matches($normalised, self::HOSTNAME);
    }

    /** The part after the last @, or null for something that is not an address. */
    public static function domainOf(string $address): ?string
    {
        $after = Str\after_last($address, '@');
        $domain = null === $after ? '' : self::normalise($after);

        return '' === $domain ? null : $domain;
    }
}
