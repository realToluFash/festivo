<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/** Locks the event so two adds of one name queue (sc-1468). The audit holds who and when only: no name outlives the purge. */
final readonly class GuestAdder
{
    public const string ADDED = 'guest.added';

    public function __construct(
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private GuestNeedsRecord $guestNeedsRecord,
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

            $guest = Guest::listed($event, $new->fullName, $new->nameKey, $new->email, $new->mobile, $by, InvitationLinks::token());
            $guest->setLanguage($new->language);
            $this->entityManager->persist($guest);
            self::recordAdded($this->auditor, $guest, $by);
            $this->guestNeedsRecord->write($guest, $new->needs ?? GuestNeeds::none(), $by);

            foreach ($new->companions as $index => $name) {
                $companion = Guest::companionOf($guest, $name, null === $name ? null : NameNormaliser::key($name), $index + 1, $by);
                $this->entityManager->persist($companion);
                self::recordAdded($this->auditor, $companion, $by);
                $this->guestNeedsRecord->write($companion, $new->companionNeeds[$index] ?? GuestNeeds::none(), $by);
            }

            $this->entityManager->flush();

            return $guest;
        });

        $this->guestListPublisher->publish($event);

        return $guest;
    }

    /** The one audit entry for a guest arriving, added here or copied with a duplicated event (sc-3656). */
    public static function recordAdded(Auditor $auditor, Guest $guest, User $by): void
    {
        $auditor->record(self::ADDED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
