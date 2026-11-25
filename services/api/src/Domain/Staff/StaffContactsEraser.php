<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Audit\Auditor;
use App\Entity\StaffMember;
use App\Repository\StaffMemberRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psr\Clock\ClockInterface;

/** The entry and its name stay for its hours; a staff account (sc-4235) is the person's own and keeps its number. */
final readonly class StaffContactsEraser
{
    public const string ERASED = 'staff.contacts_erased';

    public const string AFTER = '-30 days';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffMemberRepository $staffMemberRepository,
        private Auditor $auditor,
        private StaffRosterPublisher $staffRosterPublisher,
        private ClockInterface $clock,
    ) {
    }

    /** @return int how many entries were erased */
    public function eraseDue(): int
    {
        $now = $this->clock->now();
        $due = $this->staffMemberRepository->findContactsDue($now->modify(self::AFTER));
        $byEvent = Dict\group_by($due, static fn (StaffMember $entry): string => $entry->getEvent()->getId()->toRfc4122());
        $events = [];

        foreach ($byEvent as $entries) {
            $event = $entries[0]->getEvent();
            $events[] = $event;

            foreach ($entries as $entry) {
                $entry->eraseContacts($now);
            }

            $this->auditor->record(self::ERASED, 'Event', $event->getId(), changes: ['erased' => [null, Iter\count($entries)]]);
        }

        $this->entityManager->flush();

        foreach ($events as $event) {
            $this->staffRosterPublisher->publish($event);
        }

        return Iter\count($due);
    }
}
