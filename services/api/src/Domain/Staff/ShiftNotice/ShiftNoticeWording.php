<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Entity\Event;
use App\Enum\ShiftChangeKind;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use LogicException;
use Psl\Iter;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** On an event over more than seven days, each weekday carries its date too (sc-4333, "English copy (l10n)"). */
final readonly class ShiftNoticeWording
{
    private const int LONG_EVENT_DAYS = 7;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param list<ShiftChange> $changes */
    public function title(Event $event, array $changes, string $locale): string
    {
        $several = Iter\any($changes, static fn (ShiftChange $change): bool => $change->kind->isShiftLine() || ShiftChangeKind::NoShiftLeft === $change->kind);

        return $this->trans($several ? 'staff.shift_notice.title_several' : 'staff.shift_notice.title', ['event' => $event->getName()], $locale);
    }

    /**
     * @param list<ShiftChange> $changes
     *
     * @return list<string>
     */
    public function lines(Event $event, array $changes, string $locale): array
    {
        $long = self::isLong($event);

        return Vec\map($changes, fn (ShiftChange $change): string => match ($change->kind) {
            ShiftChangeKind::StartTime, ShiftChangeKind::EndTime => $this->trans('staff.shift_notice.' . $change->kind->value, [
                'new' => $this->slot(self::given($change->start), $change->on, $long, $locale),
                'old' => $this->slot(self::given($change->oldStart), $change->on, $long, $locale),
            ], $locale),
            ShiftChangeKind::ShiftAdded, ShiftChangeKind::ShiftRemoved => $this->trans('staff.shift_notice.' . $change->kind->value, [
                'start' => $this->slot(self::given($change->start), null, $long, $locale),
                'end' => $this->slot(self::given($change->end), $change->start, $long, $locale),
            ], $locale),
            ShiftChangeKind::ShiftRetimed => $this->trans('staff.shift_notice.shift_retimed', [
                'start' => $this->slot(self::given($change->start), null, $long, $locale),
                'end' => $this->slot(self::given($change->end), $change->start, $long, $locale),
                'oldStart' => $this->slot(self::given($change->oldStart), $change->start, $long, $locale),
                'oldEnd' => $this->slot(self::given($change->oldEnd), $change->oldStart, $long, $locale),
            ], $locale),
            ShiftChangeKind::MoreChanges => $this->trans('staff.shift_notice.more_changes', ['count' => $change->count], $locale),
            ShiftChangeKind::NoShiftLeft => $this->trans('staff.shift_notice.no_shift_left', ['event' => $event->getName()], $locale),
            ShiftChangeKind::Job, ShiftChangeKind::Venue => $this->trans('staff.shift_notice.' . $change->kind->value, ['new' => $change->new, 'old' => $change->old], $locale),
            ShiftChangeKind::Date => $this->trans('staff.shift_notice.date', [
                'new' => $this->day((string) $change->new, $locale),
                'old' => $this->day((string) $change->old, $locale),
            ], $locale),
        });
    }

    public function day(string $day, string $locale): string
    {
        return $this->formatted(new DateTimeImmutable($day, new DateTimeZone('UTC')), 'EEEEdMMM', $locale);
    }

    public static function isLong(Event $event): bool
    {
        return $event->getEndsAt()->getTimestamp() - $event->getStartsAt()->getTimestamp() > self::LONG_EVENT_DAYS * 86_400;
    }

    /** A wall-clock time with its weekday unless it falls on the day of the time before it. */
    private function slot(DateTimeImmutable $wall, ?DateTimeImmutable $before, bool $long, string $locale): string
    {
        if (null !== $before && $before->format('Y-m-d') === $wall->format('Y-m-d')) {
            return $this->formatted($wall, 'HHmm', $locale);
        }

        return $this->formatted($wall, $long ? 'EEEEdMMMHHmm' : 'EEEEHHmm', $locale);
    }

    private function formatted(DateTimeImmutable $wall, string $skeleton, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern($skeleton) ?: 'EEEE HH:mm';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, new DateTimeZone('UTC'), null, $pattern);

        return $formatter?->format($wall) ?: $wall->format('l H:i');
    }

    private static function given(?DateTimeImmutable $time): DateTimeImmutable
    {
        return $time ?? throw new LogicException('A shift line carries its times.');
    }

    /** @param array<string, mixed> $parameters */
    private function trans(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }
}
