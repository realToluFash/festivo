<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Link\InvitationLinks;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Entity\User;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** A duplicated event's guests as sc-1468 records them, names, contact details and companions, with no reply and nobody invited (sc-3656), inside the duplicator's transaction. */
final readonly class GuestListCopier
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestGroupRepository $guestGroupRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    private const int BATCH = 500;

    /**
     * A page at a time, each flushed and let go before the next, so a list at the ceiling fits in a request's memory.
     *
     * @param array<string, GuestGroup> $groups the copy's groups by the original's group id, as {@see copyGroups} made them
     *
     * @return int the guests copied, each once, their companions not counted
     */
    public function copy(Event $original, Event $copy, User $by, array $groups): int
    {
        $hosts = [];
        $copied = 0;

        for ($offset = 0; [] !== ($page = $this->guestRepository->findOnListPage($original, $offset, self::BATCH)); $offset += self::BATCH) {
            $copiedHosts = $this->copiedHosts($page, $hosts);
            $held = [...$page, ...Vec\values($copiedHosts)];

            foreach ($page as $guest) {
                $host = $guest->getHost();

                if (null === $host) {
                    $copiedGuest = Guest::listed($copy, (string) $guest->getFullName(), (string) $guest->getNameKey(), $guest->getEmail(), $guest->getMobile(), $by, InvitationLinks::token(), InvitationLinks::token());
                    $group = $guest->getGroup();
                    $copiedGuest->setGroup(null === $group ? null : $groups[$group->getId()->toRfc4122()] ?? null);
                    $copiedHosts[$guest->getId()->toRfc4122()] = $copiedGuest;
                    $hosts[$guest->getId()->toRfc4122()] = $copiedGuest->getId();
                    \array_push($held, $copiedGuest, $this->added($copiedGuest, $by));
                    ++$copied;

                    continue;
                }

                $held[] = $host;
                $copiedHost = $copiedHosts[$host->getId()->toRfc4122()] ?? null;

                if (null !== $copiedHost) {
                    $companion = Guest::companionOf($copiedHost, $guest->getFullName(), $guest->getNameKey(), $guest->getPosition(), $by);
                    \array_push($held, $companion, $this->added($companion, $by));
                }
            }

            $this->entityManager->flush();

            foreach ($held as $entity) {
                $this->entityManager->detach($entity);
            }
        }

        return $copied;
    }

    /**
     * The original's groups, by name and with nobody in them until {@see copy} puts each copied guest in theirs (sc-3775).
     *
     * @return array<string, GuestGroup> the copy's groups by the original's group id
     */
    public function copyGroups(Event $original, Event $copy): array
    {
        $groups = [];

        foreach ($this->guestGroupRepository->findOnEvent($original) as $group) {
            $copied = new GuestGroup($copy, $group->getName(), $group->getNameKey());
            $this->entityManager->persist($copied);
            $groups[$group->getId()->toRfc4122()] = $copied;
        }

        return $groups;
    }

    /**
     * The copies already made, and let go, of the hosts whose companions are on this page.
     *
     * @param list<Guest>         $page
     * @param array<string, Uuid> $hosts the copied host's id by the original's
     *
     * @return array<string, Guest> the copied host by the original's id
     */
    private function copiedHosts(array $page, array $hosts): array
    {
        $originals = [];
        $copiedIds = [];

        foreach ($page as $guest) {
            $originalId = $guest->getHost()?->getId()->toRfc4122();
            $copiedId = null === $originalId ? null : $hosts[$originalId] ?? null;

            if (null !== $originalId && null !== $copiedId) {
                $originals[$copiedId->toRfc4122()] = $originalId;
                $copiedIds[$copiedId->toRfc4122()] = $copiedId;
            }
        }

        $copiedHosts = [];

        foreach ([] === $copiedIds ? [] : $this->guestRepository->findBy(['id' => Vec\values($copiedIds)]) as $copiedHost) {
            $copiedHosts[$originals[$copiedHost->getId()->toRfc4122()]] = $copiedHost;
        }

        return $copiedHosts;
    }

    private function added(Guest $guest, User $by): AuditEntry
    {
        $this->entityManager->persist($guest);

        return GuestAdder::recordAdded($this->auditor, $guest, $by);
    }
}
