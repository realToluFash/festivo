<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Access;

use App\Entity\User;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use Symfony\Component\Uid\Uuid;

/** Memberships and events as plain maps: organisation id to grants, event id to organisation id. */
final class FixtureDirectories implements MembershipDirectoryInterface, EventDirectoryInterface
{
    /**
     * @param array<string, Grants> $grants
     * @param array<string, Uuid>   $events
     */
    public function __construct(
        private readonly array $grants = [],
        private readonly array $events = [],
    ) {
    }

    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        return $this->grants[$organisationId->toRfc4122()] ?? null;
    }

    public function organisationOf(Uuid $eventId): ?Uuid
    {
        return $this->events[$eventId->toRfc4122()] ?? null;
    }
}
