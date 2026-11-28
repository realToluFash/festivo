<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use App\Entity\User;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use Symfony\Component\Uid\Uuid;

interface MembershipDirectoryInterface
{
    /** Null unless the account is an active member: a suspended or departed one holds nothing. */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants;

    /** An Owner's or Admin's grants on every event of theirs; a Member's from their role on this one, or null without one (sc-29912). */
    public function grantsOnEvent(User $user, Uuid $organisationId, Uuid $eventId): ?Grants;

    /** The same answer for every event of the organisation at once, for a list. */
    public function eventScopeIn(User $user, Uuid $organisationId): ?EventScope;

    /** Whether the account, not a member, holds a live grant on one of the organisation's events from outside or through a staff link (sc-71, sc-4235). */
    public function isOutsideIn(User $user, Uuid $organisationId): bool;

    /** Whether the account held a staff link on the event that ended only because the event ended (27 Nov, sc-3918). */
    public function linkEndedWithTheEvent(User $user, Uuid $eventId): bool;
}
