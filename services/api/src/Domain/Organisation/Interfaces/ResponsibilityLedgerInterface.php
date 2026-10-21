<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

use App\Domain\Organisation\Handover\Model\Responsibility;
use App\Entity\Organisation;
use App\Entity\User;

interface ResponsibilityLedgerInterface
{
    /** @return list<Responsibility> */
    public function heldBy(Organisation $organisation, User $user): array;

    /** Not flushed. */
    public function move(Responsibility $responsibility, User $to): void;
}
