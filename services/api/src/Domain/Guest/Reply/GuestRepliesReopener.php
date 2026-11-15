<?php

declare(strict_types=1);

namespace App\Domain\Guest\Reply;

use App\Audit\Auditor;
use App\Domain\Event\Model\ReplyDeadline;
use App\Domain\Guest\GuestListPublisher;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Let them change their reply (sc-3780): one guest answers again after Reply by, until the start. Pressed twice, the first stays; refused 409 `replies_open` while Reply by has not closed replies. */
final readonly class GuestRepliesReopener
{
    public const string REOPENED = 'guest.replies_reopened';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private ClockInterface $clock,
    ) {
    }

    public function reopen(Guest $guest, User $by): Guest
    {
        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $by): bool {
            $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

            if (null === ReplyDeadline::closedOn($guest->getEvent(), $this->clock->now())) {
                throw new ApiException(ErrorCode::RepliesOpen, 'guest.replies_open');
            }

            if (null !== $guest->getRepliesReopenedAt()) {
                return false;
            }

            $guest->setRepliesReopened($this->clock->now(), $by->getName());
            $guest->raiseVersion();
            $this->auditor->record(self::REOPENED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());
            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $this->guestListPublisher->publish($guest->getEvent());
        }

        return $guest;
    }
}
