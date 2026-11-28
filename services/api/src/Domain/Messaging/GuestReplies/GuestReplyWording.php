<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\GuestReplies\Model\GuestReplyTally;
use App\Locale\ListJoiner;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Iter;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** `[en]`'s words for Guest replies (sc-4331, "English copy (l10n)"), one key per line; lists are joined by each language's own patterns (ListJoiner). */
final readonly class GuestReplyWording
{
    public const int NAMES = 10;

    public function __construct(
        private TranslatorInterface $translator,
        private ListJoiner $listJoiner,
    ) {
    }

    /** The bell item's title: "3 coming, 1 not coming, 1 changed their reply". */
    public function title(GuestReplyTally $tally, string $locale): string
    {
        $counts = Vec\map_with_key(
            $tally->byCount(),
            fn (string $count, array $names): string => $this->translator->trans('guestReplies.bell.' . $count, ['count' => Iter\count($names)], 'messages', $locale),
        );

        return $this->listJoiner->join(Vec\values($counts), 'unit', $locale);
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

        return $this->listJoiner->join(
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
}
