<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Link\InvitationLinks;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Entity\User;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestRepository;
use Doctrine\ORM\EntityManagerInterface;

/** A duplicated event's guests as sc-1468 records them, names, contact details and companions, with no reply and nobody invited (sc-3656); the duplicator flushes. */
final readonly class GuestListCopier
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestGroupRepository $guestGroupRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /** @return int the guests copied, each once, their companions not counted */
    public function copy(Event $original, Event $copy, User $by): int
    {
        $hosts = [];
        $copied = 0;

        foreach ($this->guestRepository->findOnList($original) as $guest) {
            $host = $guest->getHost();

            if (null === $host) {
                $hosts[$guest->getId()->toRfc4122()] = $this->added(Guest::listed($copy, (string) $guest->getFullName(), (string) $guest->getNameKey(), $guest->getEmail(), $guest->getMobile(), $by, InvitationLinks::token()), $by);
                ++$copied;

                continue;
            }

            $copiedHost = $hosts[$host->getId()->toRfc4122()] ?? null;

            if (null !== $copiedHost) {
                $this->added(Guest::companionOf($copiedHost, $guest->getFullName(), $guest->getNameKey(), $guest->getPosition(), $by), $by);
            }
        }

        return $copied;
    }

    /** The original's groups, by name and with nobody in them (sc-3775): the bride's side is this wedding's, and a copy starts its own list. */
    public function copyGroups(Event $original, Event $copy): void
    {
        foreach ($this->guestGroupRepository->findOnEvent($original) as $group) {
            $this->entityManager->persist(new GuestGroup($copy, $group->getName(), $group->getNameKey()));
        }
    }

    private function added(Guest $guest, User $by): Guest
    {
        $this->entityManager->persist($guest);
        GuestAdder::recordAdded($this->auditor, $guest, $by);

        return $guest;
    }
}
