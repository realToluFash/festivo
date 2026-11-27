<?php

declare(strict_types=1);

namespace App\Domain\Billing\Interfaces;

use App\Entity\Event;
use App\Entity\Organisation;

/** Called inside the transaction that makes the thing, so two requests never both take the last place (sc-3930). */
interface HardLimitsInterface
{
    /** Refused 403 `plan_limit_reached` when one more Live or Paused event would pass the plan's live events. */
    public function requireLiveRoom(Organisation $organisation): void;

    /** Refused 403 `event_capacity_reached` past the ceiling, else 403 `plan_limit_reached` past the plan's people per event. */
    public function requirePeopleRoom(Event $event, int $adding): void;

    public function requireRoomForCopy(Organisation $organisation, int $people): void;

    /** Refused 403 `plan_limit_reached` when active members and pending invitations fill the plan's team seats. */
    public function requireSeatToInvite(Organisation $organisation): void;

    /** As an invitation sent: a request still awaiting approval holds no seat until it is approved. */
    public function requireSeatToApprove(Organisation $organisation): void;

    public function requireSeatToAccept(Organisation $organisation): void;
}
