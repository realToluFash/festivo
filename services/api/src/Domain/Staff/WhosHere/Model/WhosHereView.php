<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere\Model;

use App\Entity\StaffStation;
use App\Entity\User;

/** What one reader of Who's here sees and may do (sc-3918). */
final readonly class WhosHereView
{
    /** @param ?StaffStation $station a station lead's own station, the only people they see; null for everyone */
    public function __construct(
        public User $reader,
        public ?StaffStation $station,
        public bool $staffManage,
        public bool $canCover,
    ) {
    }
}
