<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationChannel;
use App\Enum\NotificationPriority;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** The member's bell item for an event's changes, there within seconds of each (AC 1). */
final readonly class EventChangesItem extends EventChangeType
{
    public const string NAME = 'event_changes.item';

    public function name(): string
    {
        return self::NAME;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Urgent;
    }

    public function channels(): array
    {
        return [NotificationChannel::InApp];
    }

    /**
     * The one that also keeps an item emptied by a field changed back, so as to take it away (AC 3).
     *
     * @param array<string, mixed> $payload
     */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        if (null === $recipient) {
            return true;
        }

        $summary = $this->summaryFor($payload, $recipient, Type\string()->coerce($payload['changeId'] ?? ''), $this->eventChangeWording->localeOf($recipient));

        return $this->carries($summary) || (null === $summary && null !== $this->eventChangeLog->unreadFrom($recipient, self::eventId($payload)));
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $payload = self::latest($payloads);
        $from = Type\string()->coerce($payload['changeId'] ?? '');

        return $this->item($payload, $recipient, $this->summaryFor($payload, $recipient->id, $from, $recipient->locale), $from);
    }

    protected function isEventDay(): bool
    {
        return false;
    }
}
