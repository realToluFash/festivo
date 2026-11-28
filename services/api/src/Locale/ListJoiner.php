<?php

declare(strict_types=1);

namespace App\Locale;

use Psl\Iter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Joins a list by the reader's language's own patterns, CLDR's as `Intl.ListFormat` has them: "two" for a pair, then "start", "middle" and "end" from the left. */
final readonly class ListJoiner
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param list<string> $items
     * @param 'and'|'unit' $style
     */
    public function join(array $items, string $style, string $locale): string
    {
        $count = Iter\count($items);
        $pattern = fn (string $part, string $first, string $second): string => $this->translator->trans('list.' . $style . '.' . $part, ['first' => $first, 'second' => $second], 'messages', $locale);

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
