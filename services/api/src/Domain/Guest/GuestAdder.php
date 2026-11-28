<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Billing\Interfaces\HardLimitsInterface;
use App\Domain\Guest\Group\GuestGroupEditor;
use App\Domain\Guest\Link\InvitationLinks;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\NewGuest;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\GuestSource;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

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
        private GuestGroupEditor $guestGroupEditor,
        private HardLimitsInterface $hardLimits,
    ) {
    }

    /** Refused 409 `guest_already_listed`, naming the guest already there, unless `allowDuplicate`; 403 past the plan's people per event or the ceiling (sc-3930). */
    public function add(Event $event, NewGuest $new, User $by, bool $allowDuplicate): Guest
    {
        $guest = $this->entityManager->wrapInTransaction(function () use ($event, $new, $by, $allowDuplicate): Guest {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (!$allowDuplicate && null !== $this->guestRepository->findOneNamed($event, $new->nameKey)) {
                throw new ApiException(ErrorCode::GuestAlreadyListed, 'guest.already_listed', parameters: ['{name}' => $new->fullName]);
            }

            $this->hardLimits->requirePeopleRoom($event, 1 + Iter\count($new->companions));
            $guest = $this->list($event, $new, $by, GuestSource::Typed);
            $this->entityManager->flush();

            return $guest;
        });

        $this->guestListPublisher->publish($event);

        return $guest;
    }

    /**
     * Every one or none, checked against the plan as a whole in the transaction that makes them (sc-7579). A name already listed is added, as the review list warned.
     *
     * @param non-empty-list<NewGuest> $news
     *
     * @return list<Guest>
     */
    public function addAll(Event $event, array $news, User $by, GuestSource $source): array
    {
        $guests = $this->entityManager->wrapInTransaction(function () use ($event, $news, $by, $source): array {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->hardLimits->requirePeopleRoom($event, Math\sum(Vec\map($news, static fn (NewGuest $new): int => 1 + Iter\count($new->companions))));
            $guests = Vec\map($news, fn (NewGuest $new): Guest => $this->list($event, $new, $by, $source));
            $this->entityManager->flush();

            return $guests;
        });

        $this->guestListPublisher->publish($event);

        return $guests;
    }

    /** The one audit entry for a guest arriving, added here or copied with a duplicated event (sc-3656). */
    public static function recordAdded(Auditor $auditor, Guest $guest, User $by, ?GuestSource $source = null): AuditEntry
    {
        return $auditor->record(self::ADDED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName(), null === $source ? [] : ['source' => [null, $source->value]]);
    }

    private function list(Event $event, NewGuest $new, User $by, GuestSource $source): Guest
    {
        $guest = Guest::listed($event, $new->fullName, $new->nameKey, $new->email, $new->mobile, $by, InvitationLinks::token(), InvitationLinks::token());
        $guest->setLanguage($new->language);
        $guest->setGreetAs($new->greetAs);
        $guest->setGroup(null === $new->group ? null : $this->guestGroupEditor->settle($event, $new->group, $by));
        $this->entityManager->persist($guest);
        self::recordAdded($this->auditor, $guest, $by, $source);
        $this->guestNeedsRecord->write($guest, $new->needs ?? GuestNeeds::none(), $by);

        foreach ($new->companions as $index => $name) {
            $companion = Guest::companionOf($guest, $name, null === $name ? null : NameNormaliser::key($name), $index + 1, $by);
            $this->entityManager->persist($companion);
            self::recordAdded($this->auditor, $companion, $by, $source);
            $this->guestNeedsRecord->write($companion, $new->companionNeeds[$index] ?? GuestNeeds::none(), $by);
        }

        return $guest;
    }
}
