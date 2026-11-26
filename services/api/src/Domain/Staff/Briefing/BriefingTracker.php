<?php

declare(strict_types=1);

namespace App\Domain\Staff\Briefing;

use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Enum\StaffBriefStatus;

/** Where each person's briefing stands (sc-3917), and the read their own link's open records. */
final readonly class BriefingTracker
{
    public function __construct(
        private BriefingPrinter $briefingPrinter,
    ) {
    }

    /**
     * @param ?list<StaffShift> $shifts the person's shifts, read when null
     *
     * @return 'none'|'sent'|'read'|'changed'
     */
    public function stateOf(StaffMember $entry, ?array $shifts = null, ?StaffMember $floorLead = null): string
    {
        $status = $entry->getBriefStatus();

        if (StaffBriefStatus::None === $status) {
            return 'none';
        }

        return $entry->getBriefPrint() === $this->briefingPrinter->printOf($entry, $shifts, $floorLead) ? $status->value : 'changed';
    }

    /** An open reads Read once the briefing was handed out, by a text or by a copy, marked or not; a copy from the Link column alone leaves it Not sent. The caller holds the entry's lock and flushes. Answers whether anything moved. */
    public function opened(StaffMember $entry): bool
    {
        $print = $this->printAnOpenReads($entry);

        if (null === $print) {
            return false;
        }

        $entry->setBrief(StaffBriefStatus::Read, $print);

        return true;
    }

    public function anOpenMoves(StaffMember $entry): bool
    {
        return null !== $this->printAnOpenReads($entry);
    }

    private function printAnOpenReads(StaffMember $entry): ?string
    {
        if (StaffBriefStatus::None === $entry->getBriefStatus() && null === $entry->getBriefCopyAt()) {
            return null;
        }

        $print = $this->briefingPrinter->printOf($entry);

        return StaffBriefStatus::Read === $entry->getBriefStatus() && $print === $entry->getBriefPrint() ? null : $print;
    }
}
