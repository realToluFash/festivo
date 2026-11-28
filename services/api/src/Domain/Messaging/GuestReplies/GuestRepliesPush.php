<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\EventChanges\EventChangeLog;
use App\Domain\Messaging\GuestReplies\Model\GuestReplyTally;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationChannel;
use App\Enum\NotificationPriority;
use DateTimeImmutable;
use LogicException;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The hour's push (AC 5): every guest since the hour's first change that the member has not looked at, held overnight by QuietHours and collapsed at 08:00. */
final readonly class GuestRepliesPush extends GuestRepliesType
{
    public const string NAME = 'guest_replies.push';

    public function __construct(
        private GuestReplyLog $guestReplyLog,
        private GuestReplyWording $guestReplyWording,
        private EventChangeLog $eventChangeLog,
    ) {
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::Push];
    }

    public function collapseKey(array $payload): ?string
    {
        return GuestReplyLog::thread(self::eventId($payload));
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null === $recipient || !$this->unseen([$payload], $recipient)->isEmpty();
    }

    public function thread(array $payload): ?string
    {
        return GuestReplyLog::thread(self::eventId($payload));
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $eventId = self::eventId(Iter\last($payloads));
        $tally = $this->unseen($payloads, $recipient->id);

        if ($tally->isEmpty()) {
            throw new LogicException('Nothing unseen is left after it was found still due.');
        }

        $event = $this->eventChangeLog->names($eventId)['event'];

        return new RenderedNotification(
            $this->guestReplyWording->line('guestReplies.push.title', [], $recipient->locale),
            $this->guestReplyWording->push($tally, $event, $recipient->locale),
            place: GuestReplyLog::place($eventId, $this->guestReplyLog->lookedAt($recipient->id, $eventId)),
        );
    }

    /** @param non-empty-list<array<string, mixed>> $payloads from the earliest window collapsed into it, or the member's last look when that came later */
    private function unseen(array $payloads, Uuid $recipient): GuestReplyTally
    {
        $eventId = self::eventId(Iter\last($payloads));
        $from = Iter\first(Vec\sort(Vec\map($payloads, static fn (array $payload): string => Type\string()->coerce($payload['from'] ?? ''))));
        $since = new DateTimeImmutable($from ?? 'now');
        $looked = $this->guestReplyLog->lookedAt($recipient, $eventId);

        return $this->guestReplyLog->after($eventId, null !== $looked && $looked > $since ? $looked : $since);
    }
}
