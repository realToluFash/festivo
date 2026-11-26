<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Staff\ShiftNotice\Model\ShiftChange;
use App\Domain\Staff\ShiftNotice\Model\ShiftTold;
use App\Entity\StaffMember;
use App\Entity\StaffShift;

/** What each person was last told, by their briefing or their last change notice, and what differs from it now. */
final readonly class ToldShifts
{
    public function __construct(
        private ShiftSnapshots $shiftSnapshots,
    ) {
    }

    /**
     * Nothing before their briefing went.
     *
     * @param ?list<StaffShift> $shifts the person's shifts, read when null
     *
     * @return list<ShiftChange>
     */
    public function changesOf(StaffMember $entry, ?array $shifts = null): array
    {
        $told = $entry->getTold();

        return null === $told ? [] : ShiftChanges::between(ShiftTold::fromArray($told), $this->shiftSnapshots->of($entry, $shifts));
    }

    /** The caller flushes. */
    public function toldNow(StaffMember $entry): void
    {
        $entry->told($this->shiftSnapshots->of($entry)->toArray());
    }
}
