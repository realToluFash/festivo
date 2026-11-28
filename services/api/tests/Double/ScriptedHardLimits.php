<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Billing\HardLimits;
use App\Domain\Billing\Interfaces\HardLimitsInterface;
use App\Entity\Event;
use App\Entity\Organisation;

/** Allows everything unless a test calls `enforce()`, then holds the real limits; counts each moment a limit was asked about. */
final class ScriptedHardLimits implements HardLimitsInterface
{
    /** @var array<string, int> by method */
    public array $consulted = [];

    private bool $enforced = false;

    public function __construct(
        private readonly HardLimits $hardLimits,
    ) {
    }

    public function enforce(): void
    {
        $this->enforced = true;
    }

    public function asked(string $moment): int
    {
        return $this->consulted[$moment] ?? 0;
    }

    public function requireLiveRoom(Organisation $organisation): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireLiveRoom($organisation);
        }
    }

    public function requirePeopleRoom(Event $event, int $adding): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requirePeopleRoom($event, $adding);
        }
    }

    public function peopleRoom(Event $event): array
    {
        return $this->hardLimits->peopleRoom($event);
    }

    public function requireRoomForCopy(Organisation $organisation, int $people): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireRoomForCopy($organisation, $people);
        }
    }

    public function requireSeatToInvite(Organisation $organisation): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireSeatToInvite($organisation);
        }
    }

    public function requireSeatToApprove(Organisation $organisation): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireSeatToApprove($organisation);
        }
    }

    public function requireSeatToRestore(Organisation $organisation): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireSeatToRestore($organisation);
        }
    }

    public function requireSeatToAccept(Organisation $organisation): void
    {
        if ($this->consult(__FUNCTION__)) {
            $this->hardLimits->requireSeatToAccept($organisation);
        }
    }

    private function consult(string $moment): bool
    {
        $this->consulted[$moment] = $this->asked($moment) + 1;

        return $this->enforced;
    }
}
