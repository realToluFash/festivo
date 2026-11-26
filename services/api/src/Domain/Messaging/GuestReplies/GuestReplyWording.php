<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\GuestReplies\Model\GuestReplyTally;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Iter;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** `[en]`'s words for Guest replies (sc-4331, "English copy (l10n)"), one key per line; lists are joined by each language's own patterns (CLDR's, as `Intl.ListFormat` has them). */
final readonly class GuestReplyWording
{
    public const int NAMES = 10;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** The bell item's title: "3 coming, 1 not coming, 1 changed their reply". */
    public function title(GuestReplyTally $tally, string $locale): string
    {
        $counts = Vec\map_with_key(
            $tally->byCount(),
            fn (string $count, array $names): string => $this->translator->trans('guestReplies.bell.' . $count, ['count' => Iter\count($names)], 'messages', $locale),
        );

        return $this->joined(Vec\values($counts), 'unit', $locale);
    }

    public function push(GuestReplyTally $tally, string $event, string $locale): string
    {
        $key = $tally->onlyReplies() ? 'guestReplies.push.replies' : 'guestReplies.push.updates';

        return $this->translator->trans($key, ['count' => $tally->guests(), 'event' => $event], 'messages', $locale);
    }

    /** @param list<string> $names at most NAMES of them, then "{count} more" */
    public function names(array $names, string $locale): string
    {
        $shown = Vec\take($names, self::NAMES);
        $rest = Iter\count($names) - Iter\count($shown);

        return $this->joined(
            0 === $rest ? $shown : [...$shown, $this->translator->trans('guestReplies.email.more', ['count' => $rest], 'messages', $locale)],
            'and',
            $locale,
        );
    }

    public function date(DateTimeImmutable $at, string $zone, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('dMMMMy') ?: 'd MMMM y';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $zone, null, $pattern);

        return $formatter?->format($at) ?: $at->format('Y-m-d');
    }

    /** @param array<string, mixed> $parameters */
    public function line(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }

    /**
     * CLDR's list patterns: "two" for a pair, then "start", "middle" and "end" from the left.
     *
     * @param list<string> $items
     */
    private function joined(array $items, string $style, string $locale): string
    {
        $count = Iter\count($items);
        $pattern = fn (string $part, string $first, string $second): string => $this->translator->trans('guestReplies.list.' . $style . '.' . $part, ['first' => $first, 'second' => $second], 'messages', $locale);

        if ($count < 2) {
            return $items[0] ?? '';
        }

        if (2 === $count) {
            return $pattern('two', $items[0], $items[1]);
        }

        $joined = $pattern('end', $items[$count - 2], $items[$count - 1]);

        for ($index = $count - 3; $index >= 1; --$index) {
            $joined = $pattern('middle', $items[$index], $joined);
        }

        return $pattern('start', $items[0], $joined);
    }
}
