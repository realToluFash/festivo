<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationChannel;
use App\Enum\NotificationPriority;
use LogicException;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** Event day's push, at any hour; its in-app delivery only refreshes an unread item, so the push can ride along. */
final readonly class EventDayNotice extends EventChangeType
{
    public const string NAME = 'event_day.notice';

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
        return [NotificationChannel::InApp, NotificationChannel::Email, NotificationChannel::Push];
    }

    /** @param array<string, mixed> $payload */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        $since = Type\string()->coerce($payload['since'] ?? '');

        if (null === $recipient) {
            return null !== EventChangeSummariser::summarise($this->eventChangeLog->since(self::eventId($payload), $since), null, $this->eventChangeWording->differs('en'));
        }

        return $this->isDueFor($payload, $recipient, $since);
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $payload = self::latest($payloads);

        if (NotificationChannel::InApp === $channel) {
            $from = $this->eventChangeLog->unreadFrom($recipient->id, self::eventId($payload));

            return null === $from
                ? new RenderedNotification('', '', thread: $this->thread($payload))
                : $this->item($payload, $recipient, $this->summaryFor($payload, $recipient->id, $from, $recipient->locale), $from);
        }

        $summary = $this->summaryFor($payload, $recipient->id, Type\string()->coerce($payload['since'] ?? ''), $recipient->locale)
            ?? throw new LogicException('Its item emptied after it was found still due.');

        return NotificationChannel::Push === $channel ? $this->push($payload, $recipient, $summary) : $this->email($payload, $recipient, $summary);
    }

    protected function isEventDay(): bool
    {
        return true;
    }
}
