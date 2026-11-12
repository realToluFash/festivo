<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Realtime\RealtimePublisher;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Adds a guest and their companions to an event's list (sc-1468), under a lock on the event so two adds of one name
 * queue and the second hears it is already there. The audit entries hold who and when only: no name or contact
 * outlives the purge or an erasure (GDPR Art. 5(1)(e)).
 */
final readonly class GuestAdder
{
    public const string ADDED = 'guest.added';

    public function __construct(
        private GuestRepository $guestRepository,
        private GuestSerialiser $guestSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    /** Refused 409 `guest_already_listed`, naming the guest already there, unless `allowDuplicate`. */
    public function add(Event $event, NewGuest $new, User $by, bool $allowDuplicate): Guest
    {
        $guest = $this->entityManager->wrapInTransaction(function () use ($event, $new, $by, $allowDuplicate): Guest {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (!$allowDuplicate && null !== $this->guestRepository->findOneNamed($event, $new->nameKey)) {
                throw new ApiException(ErrorCode::GuestAlreadyListed, 'guest.already_listed', parameters: ['{name}' => $new->fullName]);
            }

            $guest = Guest::invited($event, $new->fullName, $new->nameKey, $new->email, $new->mobile, $by);
            $this->entityManager->persist($guest);
            $this->audited($guest, $by);

            foreach ($new->companions as $index => $name) {
                $companion = Guest::companionOf($guest, $name, null === $name ? null : NameNormaliser::key($name), $index + 1, $by);
                $this->entityManager->persist($companion);
                $this->audited($companion, $by);
            }

            $this->entityManager->flush();

            return $guest;
        });

        $this->realtimePublisher->publish(RealtimeTopic::EventGuests, $event->getId()->toRfc4122(), $this->guestSerialiser->list($event));

        return $guest;
    }

    private function audited(Guest $guest, User $by): void
    {
        $this->auditor->record(self::ADDED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
