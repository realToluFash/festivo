<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventChangeSummary;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\EventChangeKind;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationEventRule;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Every change is sent as both kinds, and each delivery goes only if the member's summary is of its kind. */
abstract readonly class EventChangeType implements NotificationTypeInterface
{
    public function __construct(
        protected EventChangeLog $eventChangeLog,
        protected EventChangeWording $eventChangeWording,
        private TranslatorInterface $translator,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    abstract protected function isEventDay(): bool;

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    public function category(): NotificationCategory
    {
        return $this->isEventDay() ? NotificationCategory::EventDay : NotificationCategory::EventChanges;
    }

    /** A deleted event's notice still goes, as does what came before it (AC 11). */
    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::DeletionNotice;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function collapseKey(): ?string
    {
        return null;
    }

    /** @param array<string, mixed> $payload */
    public function thread(array $payload): ?string
    {
        return EventChangeLog::thread(self::eventId($payload));
    }

    /**
     * @param array<string, mixed> $payload
     * @param string               $from    the change the summary starts at when the member has no unread item
     */
    protected function summaryFor(array $payload, Uuid $reader, ?string $from, string $locale): ?EventChangeSummary
    {
        $eventId = self::eventId($payload);
        $start = $this->eventChangeLog->unreadFrom($reader, $eventId) ?? $from;

        return null === $start ? null : EventChangeSummariser::summarise(
            $this->eventChangeLog->since($eventId, $start),
            $reader->toRfc4122(),
            $this->eventChangeWording->differs($locale),
        );
    }

    /** @param array<string, mixed> $payload due only when this window holds somebody else's change, as the item may reach further back */
    protected function isDueFor(array $payload, Uuid $reader, string $since): bool
    {
        $locale = $this->eventChangeWording->localeOf($reader);
        $window = EventChangeSummariser::summarise(
            $this->eventChangeLog->since(self::eventId($payload), $since),
            $reader->toRfc4122(),
            $this->eventChangeWording->differs($locale),
        );

        return null !== $window && $this->carries($this->summaryFor($payload, $reader, $since, $locale));
    }

    /** @param array<string, mixed> $payload */
    protected function item(array $payload, Recipient $recipient, ?EventChangeSummary $summary, ?string $from): RenderedNotification
    {
        $eventId = self::eventId($payload);
        $thread = EventChangeLog::thread($eventId);

        if (null === $summary) {
            return new RenderedNotification('', '', thread: $thread);
        }

        $title = $this->eventChangeWording->title($summary, $recipient->locale);
        $lines = $this->eventChangeWording->lines($summary, $recipient->id, $recipient->locale);

        return new RenderedNotification($title, Str\join([$title, ...$lines], "\n"), $lines, self::place($eventId), $thread, $from);
    }

    /** @param array<string, mixed> $payload a deletion's push opens the bell, as its event's page is gone */
    protected function push(array $payload, Recipient $recipient, EventChangeSummary $summary): RenderedNotification
    {
        $eventId = self::eventId($payload);
        $title = $this->eventChangeWording->title($summary, $recipient->locale);
        $lines = $this->eventChangeWording->lines($summary, $recipient->id, $recipient->locale);

        return new RenderedNotification(
            $this->eventChangeLog->names($eventId)['event'],
            Str\join([$title, ...$lines], "\n"),
            place: EventChangeKind::Deleted === $summary->leading->kind ? null : self::place($eventId),
        );
    }

    /** @param array<string, mixed> $payload */
    protected function email(array $payload, Recipient $recipient, EventChangeSummary $summary): RenderedNotification
    {
        $eventId = self::eventId($payload);
        $names = $this->eventChangeLog->names($eventId);
        $locale = $recipient->locale;
        $address = $this->eventChangeWording->newAddress($summary);
        $origin = Str\trim_right($this->webOrigin, '/');
        $body = [
            $names['event'],
            '',
            $this->translator->trans('eventChanges.email.sentence', ['title' => $this->eventChangeWording->title($summary, $locale)], 'messages', $locale),
            ...$this->eventChangeWording->lines($summary, $recipient->id, $locale),
            ...null === $address ? [] : [
                '',
                $address,
                $this->link('eventChanges.email.openInMaps', 'https://www.google.com/maps/search/?api=1&query=' . \rawurlencode($address), $locale),
            ],
            ...EventChangeKind::Deleted === $summary->leading->kind ? [] : [
                '',
                $this->link('eventChanges.email.open', $origin . self::place($eventId), $locale),
            ],
            '',
            $this->translator->trans('eventChanges.email.footer', ['event' => $names['event'], 'organisation' => $names['organisation']], 'messages', $locale),
            $this->link('eventChanges.email.settings', $origin . '/app/account/notifications', $locale),
        ];

        return new RenderedNotification($this->eventChangeWording->subject($summary, $names['event'], $locale), Str\join($body, "\n"));
    }

    /** Whether a summary is this type's to carry: an item holding any Event day change is an Event day item. */
    protected function carries(?EventChangeSummary $summary): bool
    {
        return null !== $summary && $summary->eventDay === $this->isEventDay();
    }

    /** @param array<string, mixed> $payload */
    protected static function eventId(array $payload): string
    {
        return Type\string()->coerce($payload['eventId'] ?? '');
    }

    /**
     * @param non-empty-list<array<string, mixed>> $payloads
     *
     * @return array<string, mixed>
     */
    protected static function latest(array $payloads): array
    {
        return Iter\last($payloads);
    }

    private function link(string $label, string $url, string $locale): string
    {
        return $this->translator->trans('eventChanges.email.link', ['label' => $this->translator->trans($label, [], 'messages', $locale), 'url' => $url], 'messages', $locale);
    }

    private static function place(string $eventId): string
    {
        return '/app/events/' . $eventId;
    }
}
