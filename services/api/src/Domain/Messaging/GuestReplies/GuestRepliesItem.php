<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationChannel;
use App\Enum\NotificationPriority;
use Psl\Iter;
use Symfony\Component\Uid\Uuid;

/** The member's one bell item per event, read or unread, kept up to date with every guest they have not looked at (AC 1), and opening Changed since you looked from their last look (AC 2). */
final readonly class GuestRepliesItem extends GuestRepliesType
{
    public const string NAME = 'guest_replies.item';

    public function __construct(
        private GuestReplyLog $guestReplyLog,
        private GuestReplyWording $guestReplyWording,
    ) {
    }

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

    public function collapseKey(array $payload): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return true;
    }

    public function thread(array $payload): ?string
    {
        return GuestReplyLog::thread(self::eventId($payload));
    }

    /** With nothing left unseen, the empty subject takes the unread item away. */
    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $eventId = self::eventId(Iter\last($payloads));
        $thread = GuestReplyLog::thread($eventId);
        $looked = $this->guestReplyLog->lookedAt($recipient->id, $eventId);
        $tally = $this->guestReplyLog->after($eventId, $looked);

        if ($tally->isEmpty()) {
            return new RenderedNotification('', '', thread: $thread);
        }

        $title = $this->guestReplyWording->title($tally, $recipient->locale);
        $place = GuestReplyLog::place($eventId, $looked);

        return new RenderedNotification($title, $title, place: $place, thread: $thread, reopens: true);
    }
}
