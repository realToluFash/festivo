<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Entity\Membership;
use App\Enum\Permission;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Which of an organisation's events one member reaches, and with what, read once for a list (sc-29912). */
final readonly class EventScope
{
    /**
     * @param Membership|null       $onlyFor a Member, who reaches only the events in `$byEvent`; null for an Owner or Admin, who reach every one with their organisation's grants
     * @param array<string, Grants> $byEvent
     */
    public function __construct(
        public ?Membership $onlyFor,
        public Grants $organisation,
        private array $byEvent = [],
    ) {
    }

    /** Whether the member holds it across the organisation, or through a role on at least one event. */
    public function anywhere(Permission $permission): bool
    {
        return $this->organisation->holds($permission) || Iter\any($this->byEvent, static fn (Grants $grants): bool => $grants->holds($permission));
    }

    /** @return list<Permission> what the member's roles on events allow beyond the organisation's, each held on at least one (sc-3901) */
    public function onAnEvent(): array
    {
        return Vec\filter(Permission::cases(), fn (Permission $permission): bool => !$this->organisation->allows($permission) && Iter\any($this->byEvent, static fn (Grants $grants): bool => $grants->allows($permission)));
    }

    /**
     * The events where the member holds it, for a query to narrow to (sc-39534).
     *
     * @return list<Uuid>|null null for every event of the organisation
     */
    public function eventsHolding(Permission $permission): ?array
    {
        if (null === $this->onlyFor) {
            return $this->organisation->holds($permission) ? null : [];
        }

        return Vec\map(Vec\keys(Dict\filter($this->byEvent, static fn (Grants $grants): bool => $grants->holds($permission))), Uuid::fromString(...));
    }

    public function on(Uuid $eventId): ?Grants
    {
        return null === $this->onlyFor ? $this->organisation : $this->byEvent[$eventId->toRfc4122()] ?? null;
    }
}
