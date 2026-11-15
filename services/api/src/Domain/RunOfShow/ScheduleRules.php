<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Domain\Event\LocalTimeResolver;
use App\Domain\RunOfShow\Model\ItemDetails;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Regex;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a schedule item may be (sc-3893), every problem at once and each beside its field; the web form checks the same before sending. */
final readonly class ScheduleRules
{
    /** Vendors load in before the start (sc-3893, Decided 19 Oct). */
    public const int SET_UP_HOURS = 12;

    private const string LOCAL_TIME = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/';

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param array{title: string, startsAt: ?string, lengthMinutes?: ?int, place?: ?string, ownerName?: ?string, ownerRole?: ?string, note?: ?string, fixedTime?: bool, showToGuests?: bool} $body */
    public function details(Event $event, array $body): ItemDetails
    {
        $violations = [];
        $title = Str\trim($body['title']);

        if ('' === $title) {
            $violations[] = $this->violation('title', 'validation.schedule_title_required');
        } elseif (Str\length($title) > ScheduleItem::TITLE_MAXIMUM) {
            $violations[] = $this->violation('title', 'validation.schedule_title_too_long', ['{n}' => Str\length($title), '{max}' => ScheduleItem::TITLE_MAXIMUM]);
        }

        $startsAt = $this->start($event, $body['startsAt'], $violations);
        $length = $body['lengthMinutes'] ?? null;

        if (null !== $length && ($length < 0 || $length > ScheduleItem::LENGTH_MAXIMUM)) {
            $violations[] = $this->violation('lengthMinutes', 'validation.schedule_length_range', ['{max}' => ScheduleItem::LENGTH_MAXIMUM]);
        }

        $place = $this->optional($body['place'] ?? null, 'place', ScheduleItem::PLACE_MAXIMUM, 'validation.schedule_place_too_long', $violations);
        $ownerName = $this->optional($body['ownerName'] ?? null, 'ownerName', ScheduleItem::OWNER_NAME_MAXIMUM, 'validation.schedule_owner_too_long', $violations);
        $ownerRole = $this->optional($body['ownerRole'] ?? null, 'ownerRole', ScheduleItem::OWNER_ROLE_MAXIMUM, 'validation.schedule_role_too_long', $violations);
        $note = $this->optional($body['note'] ?? null, 'note', ScheduleItem::NOTE_MAXIMUM, 'validation.schedule_note_too_long', $violations);

        if ([] !== $violations || null === $startsAt) {
            throw ApiException::validation($violations);
        }

        return new ItemDetails($title, $startsAt, $length, $place, $ownerName, $ownerRole, $note, $body['fixedTime'] ?? false, $body['showToGuests'] ?? false);
    }

    /** The first moment an item may start: set-up, before the event's own start. */
    public static function earliest(Event $event): DateTimeImmutable
    {
        return $event->getStartsAt()->modify('-' . self::SET_UP_HOURS . ' hours');
    }

    /** @param list<array{propertyPath: string, message: string, code: string}> $violations */
    private function start(Event $event, ?string $typed, array &$violations): ?DateTimeImmutable
    {
        $typed = Str\trim($typed ?? '');

        if ('' === $typed) {
            $violations[] = $this->violation('startsAt', 'validation.schedule_start_required');

            return null;
        }

        $value = Regex\matches($typed, self::LOCAL_TIME) ? Str\pad_right($typed, 19, ':00') : '';
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $value, new DateTimeZone('UTC'));

        if (false === $parsed || $parsed->format('Y-m-d\TH:i:s') !== $value) {
            $violations[] = $this->violation('startsAt', 'validation.schedule_start_required');

            return null;
        }

        $zone = new DateTimeZone($event->getTimeZone());
        $at = LocalTimeResolver::resolve($parsed, $zone);
        $earliest = self::earliest($event);
        $end = $event->getEndsAt();

        if ($at < $earliest || $at > $end) {
            $violations[] = $this->violation('startsAt', 'validation.schedule_start_outside', ['{earliest}' => $this->written($earliest, $zone), '{end}' => $this->written($end, $zone)]);

            return null;
        }

        return $parsed;
    }

    /** Day and time on the 24-hour clock, as every time Soirely writes (sc-30243). */
    private function written(DateTimeImmutable $at, DateTimeZone $zone): string
    {
        $dates = SupportedLocales::dates($this->translator->getLocale());
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('EEEdMMMHHmm') ?: 'EEE d MMM HH:mm';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $zone, null, $pattern);

        return $formatter?->format($at) ?: $at->setTimezone($zone)->format('D j M H:i');
    }

    /** @param list<array{propertyPath: string, message: string, code: string}> $violations */
    private function optional(?string $typed, string $path, int $maximum, string $tooLong, array &$violations): ?string
    {
        $value = Str\trim($typed ?? '');

        if ('' === $value) {
            return null;
        }

        if (Str\length($value) > $maximum) {
            $violations[] = $this->violation($path, $tooLong, ['{n}' => Str\length($value), '{max}' => $maximum]);
        }

        return $value;
    }

    /**
     * @param array<string, int|string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
