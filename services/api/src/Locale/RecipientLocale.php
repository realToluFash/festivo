<?php

declare(strict_types=1);

namespace App\Locale;

/**
 * Which language something SENT to a person is written in.
 *
 * Deliberately separate from the request locale, because they answer different
 * questions and conflating them is the bug this class exists to prevent.
 *
 * An organiser working in English who invites a guest whose preference is
 * Portuguese must produce a Portuguese invitation. The request is in English;
 * the message is not. Resolving outbound language from the request would send
 * every guest the language of whoever happened to press the button.
 *
 * Order: the recipient's own stored preference, then the event's default, then
 * English.
 */
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
