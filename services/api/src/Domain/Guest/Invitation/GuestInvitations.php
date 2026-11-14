<?php

declare(strict_types=1);

namespace App\Domain\Guest\Invitation;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventAction;
use App\Enum\EventPhase;
use App\Enum\GuestInvitationMethod;
use App\Enum\GuestReply;
use App\Http\Exception\ApiException;
use DateTimeZone;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Who has been invited (sc-3788): by hand, by Soirely's message, or by replying, which `Guest::reply` records itself. */
final readonly class GuestInvitations
{
    public const string MARKED = 'guest.marked_invited';

    public const string UNMARKED = 'guest.marked_not_invited';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    /** Refused 409 `event_state_invalid` unless the event's phase allows `invite`; a guest already invited stays as recorded. */
    public function mark(Guest $guest, GuestInvitationMethod $how, User $by): void
    {
        $this->change($guest, function (Guest $guest) use ($how, $by): bool {
            $this->assertInvitable($guest->getEvent());

            if (!$guest->invite($how, $this->clock->now(), $by)) {
                return false;
            }

            $this->auditor->record(self::MARKED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());

            return true;
        });
    }

    /** Refused 409 `event_state_invalid`, with the `phase`, unless the event's phase allows `invite`: marking, copying a link and Soirely's send alike. */
    public function assertInvitable(Event $event): void
    {
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now());

        if (!$phase->allows(EventAction::Invite)) {
            throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['phase' => $phase->value]);
        }
    }

    /** In any phase. Refused 409 `guest_replied` once they have replied and `guest_not_marked_by_hand` for Soirely's message; a guest not invited stays so. */
    public function unmark(Guest $guest, User $by): void
    {
        $this->change($guest, function (Guest $guest) use ($by): bool {
            if (!$guest->isInvited()) {
                return false;
            }

            if (!$guest->canUninvite()) {
                throw $this->kept($guest);
            }

            $guest->uninvite();
            $this->auditor->record(self::UNMARKED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());

            return true;
        });
    }

    /** For Messaging, once its invitation to this guest has gone: "Invited by Soirely's message". */
    public function byMessage(Guest $guest): void
    {
        $this->change($guest, function (Guest $guest): bool {
            if (!$guest->invite(GuestInvitationMethod::SoirelyMessage, $this->clock->now(), null)) {
                return false;
            }

            $this->auditor->record(self::MARKED, 'Guest', $guest->getId());

            return true;
        });
    }

    /** @param callable(Guest): bool $change */
    private function change(Guest $guest, callable $change): void
    {
        if (null !== $guest->getHost()) {
            throw ApiException::notFound('access.not_found');
        }

        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $change): bool {
            $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

            if (!$change($guest)) {
                return false;
            }

            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $this->guestListPublisher->publish($guest->getEvent());
        }
    }

    private function kept(Guest $guest): ApiException
    {
        $reply = $guest->getReply() ?? GuestReply::NoReply;

        if (GuestReply::NoReply === $reply) {
            return new ApiException(ErrorCode::GuestNotMarkedByHand, $this->translator->trans('guest.not_marked_by_hand'));
        }

        return new ApiException(ErrorCode::GuestReplied, $this->translator->trans('guest.replied'), members: [
            'reply' => $reply->value,
            'repliedAt' => $guest->getRepliedAt()?->setTimezone(new DateTimeZone($guest->getEvent()->getTimeZone()))->format(\DATE_ATOM) ?? '',
        ]);
    }
}
