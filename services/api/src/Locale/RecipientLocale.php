<?php

declare(strict_types=1);

namespace App\Locale;

final class RecipientLocale
{
    /**
     * @param string|null $recipientPreference the person's own stored choice, if they have one
     * @param string|null $eventDefault        the event's language, if it has one
     */
    public static function resolve(
        ?string $recipientPreference,
        ?string $eventDefault = null,
    ): string {
        if (SupportedLocales::supports($recipientPreference)) {
            return SupportedLocales::narrow($recipientPreference);
        }

        if (SupportedLocales::supports($eventDefault)) {
            return SupportedLocales::narrow($eventDefault);
        }

        return SupportedLocales::DEFAULT;
    }
}
