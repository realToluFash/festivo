<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\EventChangeSummary;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use App\Enum\EventChangeKind;
use App\Locale\SupportedLocales;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use IntlTimeZone;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** `[en]`'s words for an event's changes (sc-13214, "English copy (l10n)"), one key per line and nothing joined in code. */
final readonly class EventChangeWording
{
    public function __construct(
        private TranslatorInterface $translator,
        private EntityManagerInterface $entityManager,
        private AccountLanguage $accountLanguage,
        private UserMailer $userMailer,
    ) {
    }

    public function localeOf(Uuid $userId): string
    {
        $user = $this->entityManager->find(User::class, $userId);

        return null === $user ? SupportedLocales::DEFAULT : $this->accountLanguage->of($user);
    }

    /** @return Closure(string, mixed, mixed): bool whether a field's line would read differently on its two sides, in this language */
    public function differs(string $locale): Closure
    {
        return function (string $field, mixed $before, mixed $after) use ($locale): bool {
            [$was, $is] = $this->sides($field, $before, $after, $locale);

            return $was !== $is;
        };
    }

    public function title(EventChangeSummary $summary, string $locale): string
    {
        return $this->translator->trans('eventChanges.title.' . $summary->leading->kind->value, ['name' => $summary->leading->actorName ?? ''], 'messages', $locale);
    }

    public function subject(EventChangeSummary $summary, string $event, string $locale): string
    {
        return $this->translator->trans('eventChanges.subject.' . $summary->leading->kind->value, ['event' => $event], 'messages', $locale);
    }

    /** @return list<string> the change lines in EventDetails::FIELDS order, the deletion's line when it leads, then the others line */
    public function lines(EventChangeSummary $summary, Uuid $readerId, string $locale): array
    {
        $lines = [];

        foreach ($summary->fields as $field => [$before, $after]) {
            [$was, $is] = $this->sides($field, $before, $after, $locale);
            $key = match (true) {
                'venue' === $field && null === $was => 'eventChanges.line.venueAdded',
                'venue' === $field && null === $is => 'eventChanges.line.venueRemoved',
                default => 'eventChanges.line.' . $field,
            };
            $lines[] = $this->translator->trans($key, ['new' => $is ?? '', 'old' => $was ?? ''], 'messages', $locale);
        }

        $until = $summary->leading->restorableUntil;
        $reader = $this->entityManager->find(User::class, $readerId);

        if (EventChangeKind::Deleted === $summary->leading->kind && null !== $until && null !== $reader) {
            $lines[] = $this->translator->trans('eventChanges.line.restorableUntil', ['deadline' => $this->userMailer->deadline($until, $reader, $locale)], 'messages', $locale);
        }

        $other = $summary->other;

        if (null !== $other) {
            $key = Str\format('eventChanges.others.%s%s', null === $other->actorName ? 'support' : 'name', 0 === $summary->more ? '' : 'AndMore');
            $lines[] = $this->translator->trans($key, ['name' => $other->actorName ?? '', 'count' => $summary->more], 'messages', $locale);
        }

        return $lines;
    }

    /** The venue's address when its name stays and the address moves, so the line never reads "Hall A (was Hall A)" (AC 2). */
    public function newAddress(EventChangeSummary $summary): ?string
    {
        $venue = $summary->fields['venue'][1] ?? null;

        return Type\nullable(Type\shape(['name' => Type\nullable(Type\string()), 'address' => Type\nullable(Type\string())]))->coerce($venue)['address'] ?? null;
    }

    /** @return array{0: ?string, 1: ?string} each side as its line shows it; a venue with no value is null */
    private function sides(string $field, mixed $before, mixed $after, string $locale): array
    {
        if ('venue' === $field) {
            $venue = Type\nullable(Type\shape(['name' => Type\nullable(Type\string()), 'address' => Type\nullable(Type\string())]));
            $was = $venue->coerce($before);
            $is = $venue->coerce($after);

            if (null !== $was && null !== $is && null !== $was['name'] && $was['name'] === $is['name'] && null !== $was['address'] && null !== $is['address']) {
                return [$was['address'], $is['address']];
            }

            return [null === $was ? null : $was['name'] ?? $was['address'], null === $is ? null : $is['name'] ?? $is['address']];
        }

        return [$this->value($field, Type\string()->coerce($before), $locale), $this->value($field, Type\string()->coerce($after), $locale)];
    }

    private function value(string $field, string $stored, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);

        return match ($field) {
            'date' => $this->formatted(new DateTimeImmutable($stored, new DateTimeZone('UTC')), 'EEEEdMMMMy', $dates),
            'endTime' => Str\contains($stored, ' ') ? $this->otherDay($stored, $locale) : $stored,
            'timeZone' => IntlTimeZone::createTimeZone($stored)?->getDisplayName(false, IntlTimeZone::DISPLAY_LONG_GENERIC, $dates) ?: $stored,
            default => $stored,
        };
    }

    /** "Sunday 01:00": an end on another day than the start carries its weekday in the time's slot (sc-4235). */
    private function otherDay(string $stored, string $locale): string
    {
        $at = new DateTimeImmutable($stored, new DateTimeZone('UTC'));

        return $this->translator->trans('eventChanges.otherDay', [
            'weekday' => $this->formatted($at, 'EEEE', SupportedLocales::dates($locale)),
            'time' => $at->format('H:i'),
        ], 'messages', $locale);
    }

    private function formatted(DateTimeImmutable $at, string $skeleton, string $dates): string
    {
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern($skeleton) ?: $skeleton;
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, $pattern);

        return $formatter?->format($at) ?: $at->format('Y-m-d');
    }
}
