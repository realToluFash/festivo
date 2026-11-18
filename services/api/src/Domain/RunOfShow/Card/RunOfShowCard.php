<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Card;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\RunOfShow\EventDay;
use App\Domain\RunOfShow\ExpectedStarts;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Locale\SupportedLocales;
use App\Repository\EventRepository;
use App\Repository\ScheduleItemRepository;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use LogicException;
use Psl\Hash;
use Psl\Str;
use Psl\Str\Grapheme;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A track's Now and Next on the lock screen of each person who pressed there (sc-66580): a silent push alone, one per track on each device, worked out when it goes.
 * Event day, so neither the night hold nor a mute keeps it back, and Event day's Push switch turns it off.
 */
final readonly class RunOfShowCard implements NotificationTypeInterface
{
    public const string NAME = 'run_of_show.card';

    /** A longer title keeps its first 39 and "…", so the time after it stays whole. */
    public const int TITLE_SHOWN = 40;

    /** The app writes its own card under the same key, so the server's replaces it: apns-collapse-id takes 64 bytes. */
    private const int KEY_HASH_LENGTH = 40;

    public function __construct(
        private EventRepository $eventRepository,
        private ScheduleItemRepository $scheduleItemRepository,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** The app works out the same from the night's track, `{eventId}|{day}|{place}`. */
    public static function key(string $eventId, string $day, ?string $place): string
    {
        return 'run-of-show:' . Str\slice(Hash\hash($eventId . '|' . $day . '|' . ($place ?? ''), Hash\Algorithm::Sha256), 0, self::KEY_HASH_LENGTH);
    }

    public static function track(ScheduleItem $item): string
    {
        return EventDay::of($item->getStartsAt()) . "\0" . ($item->getPlace() ?? '');
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::EventDay;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Urgent;
    }

    public function channels(): array
    {
        return [NotificationChannel::Push];
    }

    /** The night runs while paused too; a deleted event's card goes no more. */
    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::ChangeNotice;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    public function reachesSuppressed(): bool
    {
        return false;
    }

    public function collapseKey(array $payload): ?string
    {
        return self::key(self::eventId($payload), self::day($payload), self::place($payload));
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null !== $this->eventRepository->find(self::eventId($payload));
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $payload = $payloads[0];
        $event = $this->eventRepository->find(self::eventId($payload)) ?? throw new LogicException('Its event went after it was found still due.');
        $day = self::day($payload);
        $place = self::place($payload);
        $track = Vec\filter(
            $this->scheduleItemRepository->findOnEvent($event),
            static fn (ScheduleItem $item): bool => self::track($item) === $day . "\0" . ($place ?? ''),
        );
        $lines = $this->lines($event, $track, $place, $recipient->locale);
        $title = $this->trans('run_of_show.card.title', ['event' => $event->getName(), 'place' => $this->placeLabel($event, $day, $place, $recipient->locale)], $recipient->locale);

        return new RenderedNotification(
            $title,
            Str\join($lines, "\n"),
            $lines,
            Str\format('/app/events/%s/schedule?track=%s', $event->getId()->toRfc4122(), \rawurlencode($day . '|' . ($place ?? ''))),
            silent: true,
        );
    }

    /**
     * Now and Next as the night has them at this moment, then As of; or the end alone.
     *
     * @param list<ScheduleItem> $track
     *
     * @return list<string>
     */
    private function lines(Event $event, array $track, ?string $place, string $locale): array
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $at = $this->clock->now();
        $ordered = Vec\sort($track, static fn (ScheduleItem $a, ScheduleItem $b): int => ExpectedStarts::planned($a, $zone) <=> ExpectedStarts::planned($b, $zone));
        $now = null;
        $nowStarted = null;
        $next = null;

        foreach ($ordered as $item) {
            $startedAt = $item->getStartedAt();

            if ($item->isSkipped() || null !== $item->getEndedAt()) {
                continue;
            }

            if (null === $startedAt) {
                $next ??= $item;
            } elseif (null === $nowStarted || $startedAt < $nowStarted) {
                $now = $item;
                $nowStarted = $startedAt;
            }
        }

        if (null === $now && null === $next) {
            return [$this->trans('run_of_show.card.everything', [], $locale)];
        }

        $nextStarts = null === $next ? null : ExpectedStarts::of($track, $at, $zone)[$next->getId()->toRfc4122()];

        return [
            null === $now || null === $nowStarted
                ? $this->trans('run_of_show.card.nothing_on', [], $locale)
                : $this->trans('run_of_show.card.now', ['title' => self::shown($now->getTitle()), ...self::time($nowStarted, $zone)], $locale),
            null === $next || null === $nextStarts
                ? $this->trans('run_of_show.card.nothing_else', ['place' => $place ?? $this->trans('run_of_show.card.main', [], $locale)], $locale)
                : $this->trans('run_of_show.card.next', ['title' => self::shown($next->getTitle()), ...self::time($nextStarts, $zone)], $locale),
            $this->trans('run_of_show.card.as_of', self::time($at, $zone), $locale),
        ];
    }

    /** As the night's picker names it: the place, Main for none, and its weekday when it is not today's. */
    private function placeLabel(Event $event, string $day, ?string $place, string $locale): string
    {
        $named = $place ?? $this->trans('run_of_show.card.main', [], $locale);
        $zone = new DateTimeZone($event->getTimeZone());
        $today = EventDay::of(new DateTimeImmutable($this->clock->now()->setTimezone($zone)->format('Y-m-d H:i'), new DateTimeZone('UTC')));

        if ($day === $today) {
            return $named;
        }

        $formatter = IntlDateFormatter::create(SupportedLocales::dates($locale), IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, 'EEEE');
        $weekday = $formatter?->format(new DateTimeImmutable($day . 'T12:00:00Z')) ?: $day;

        return $this->trans('run_of_show.card.on_day', ['place' => $named, 'day' => $weekday], $locale);
    }

    /** Counted in graphemes, as the title field counts. */
    private static function shown(string $title): string
    {
        return Grapheme\length($title) > self::TITLE_SHOWN ? Grapheme\slice($title, 0, self::TITLE_SHOWN - 1) . '…' : $title;
    }

    /** @return array{time: string, hour: int} the hour for es and pt's article, "a la 01:10" */
    private static function time(DateTimeImmutable $moment, DateTimeZone $zone): array
    {
        $local = $moment->setTimezone($zone);

        return ['time' => $local->format('H:i'), 'hour' => (int) $local->format('G')];
    }

    /** @param array<string, mixed> $parameters */
    private function trans(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }

    /** @param array<string, mixed> $payload */
    private static function eventId(array $payload): string
    {
        return Type\string()->coerce($payload['eventId'] ?? '');
    }

    /** @param array<string, mixed> $payload */
    private static function day(array $payload): string
    {
        return Type\string()->coerce($payload['day'] ?? '');
    }

    /** @param array<string, mixed> $payload */
    private static function place(array $payload): ?string
    {
        return Type\nullable(Type\string())->coerce($payload['place'] ?? null);
    }
}
