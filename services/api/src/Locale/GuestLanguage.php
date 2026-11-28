<?php

declare(strict_types=1);

namespace App\Locale;

use App\Entity\Guest;

/** The language a guest reads in (sc-3790), the rule packages/domain's guestLanguage holds too: /guest-language.json's cases test both. */
final class GuestLanguage
{
    /** @param list<string> $browser the browser's languages, most wanted first */
    public static function pageLanguage(?string $chosen, array $browser, ?string $host, string $organisation): string
    {
        foreach ([$chosen, ...$browser, $host] as $tag) {
            if (SupportedLocales::supports($tag)) {
                return SupportedLocales::narrow($tag);
            }
        }

        return SupportedLocales::narrow($organisation);
    }

    /** A message has no browser to ask. */
    public static function messageLanguage(?string $chosen, ?string $host, string $organisation): string
    {
        return self::pageLanguage($chosen, [], $host, $organisation);
    }

    /** Which of the three steps gave the guest's message language (sc-3960): `chose` on their page, `host` from the host's Language, or `organisation`. */
    public static function messageLanguageFrom(Guest $guest): string
    {
        return match (true) {
            SupportedLocales::supports($guest->getChosenLanguage()) => 'chose',
            SupportedLocales::supports($guest->getLanguage()) => 'host',
            default => 'organisation',
        };
    }

    public static function forMessage(Guest $guest): string
    {
        return self::messageLanguage($guest->getChosenLanguage(), $guest->getLanguage(), $guest->getEvent()->getOrganisation()->getLocale());
    }
}
