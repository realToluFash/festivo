<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationChannel;
use App\Enum\NotificationPriority;
use Psl\Iter;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** The bell item once it holds a change made from 24 hours before the start until the end (AC 10). */
final readonly class EventDayItem extends EventChangeType
{
    public const string NAME = 'event_day.item';

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

    /** @param array<string, mixed> $payload */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null === $recipient || $this->isItemDue($payload, $recipient, $this->summaryFor($payload, $recipient, Type\string()->coerce($payload['changeId'] ?? ''), $this->eventChangeWording->localeOf($recipient)));
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $payload = self::latest($payloads);
        $from = Type\string()->coerce($payload['changeId'] ?? '');
        $own = Iter\all($payloads, fn (array $each): bool => $this->madeBy($each, $recipient->id));

        return $this->item($payload, $recipient, $this->summaryFor($payload, $recipient->id, $from, $recipient->locale), $from, $own);
    }

    protected function isEventDay(): bool
    {
        return true;
    }
}
