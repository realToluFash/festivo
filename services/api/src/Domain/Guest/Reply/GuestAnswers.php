<?php

declare(strict_types=1);

namespace App\Domain\Guest\Reply;

use App\Audit\Auditor;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\GuestPagePhase;
use App\Enum\GuestReply;
use App\Enum\GuestReplySource;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** A guest's answer from their own page (sc-1439): one current reply, replaced by the next, open until the event starts and while it is neither paused nor over (sc-3591). */
final readonly class GuestAnswers
{
    public const string ANSWERED = 'guest.answered';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private GuestSerialiser $guestSerialiser,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /** Until the start, in the event's own zone, and only while the event is Live; sc-3780's reply-by date will close it earlier. */
    public function open(Guest $guest): bool
    {
        return GuestPagePhase::Live === $this->phase($guest) && !$this->started($guest);
    }

    public function phase(Guest $guest): GuestPagePhase
    {
        $event = $guest->getEvent();

        return GuestPagePhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $event->getEndedAt(), $this->clock->now());
    }

    public function started(Guest $guest): bool
    {
        return $this->clock->now() >= $guest->getEvent()->getStartsAt();
    }

    /** Refused 409 `event_paused` while paused, `event_concluded` once called off or over, and `replies_closed` from the start. The same answer again changes nothing and keeps its date. */
    public function answer(Guest $guest, GuestReply $reply): void
    {
        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $reply): bool {
            $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

            $refusal = $this->phase($guest)->refusal();

            if (null !== $refusal) {
                throw new ApiException($refusal, ErrorCode::EventPaused === $refusal ? 'guest.event_paused' : 'guest.event_concluded');
            }

            if ($this->started($guest)) {
                throw new ApiException(ErrorCode::RepliesClosed, 'guest.replies_closed');
            }

            if (!$guest->reply($reply, $this->clock->now(), GuestReplySource::GuestPage)) {
                return false;
            }

            $this->auditor->record(self::ANSWERED, 'Guest', $guest->getId());
            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $event = $guest->getEvent();
            $this->realtimePublisher->publish(RealtimeTopic::EventGuests, $event->getId()->toRfc4122(), $this->guestSerialiser->list($event, contacts: false));
        }
    }
}
