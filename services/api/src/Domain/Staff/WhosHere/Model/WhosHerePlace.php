<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere\Model;

use App\Entity\StaffMember;
use App\Entity\StaffShift;
use DateTimeImmutable;

/** Which of Who's here's lists one person is in tonight, for which shift, and when they clocked in on it. */
final readonly class WhosHerePlace
{
    public const string HERE = 'here';

    public const string NOT_HERE = 'notHere';

    public const string DIDNT_CLOCK_IN = 'didntClockIn';

    /** @param self::HERE|self::NOT_HERE|self::DIDNT_CLOCK_IN $list */
    public function __construct(
        public StaffMember $person,
        public string $list,
        public StaffShift $shift,
        public ?DateTimeImmutable $in,
    ) {
    }
}
