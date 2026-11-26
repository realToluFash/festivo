<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Organisation\MembershipDirectory;
use App\Entity\User;
use App\Enum\Permission;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The real directory, less whatever a test withholds: a holder no seeded role makes, such as Create events without guests.manage. */
final class WithholdingMembershipDirectory implements MembershipDirectoryInterface
{
    /** @var list<Permission> */
    private array $withheld = [];

    public function __construct(
        private readonly MembershipDirectory $real,
    ) {
    }

    public function withhold(Permission $permission): void
    {
        $this->withheld[] = $permission;
    }

    public function restore(): void
    {
        $this->withheld = [];
    }

    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        return $this->less($this->real->grantsIn($user, $organisationId));
    }

    public function grantsOnEvent(User $user, Uuid $organisationId, Uuid $eventId): ?Grants
    {
        return $this->less($this->real->grantsOnEvent($user, $organisationId, $eventId));
    }

    public function isOutsideIn(User $user, Uuid $organisationId): bool
    {
        return $this->real->isOutsideIn($user, $organisationId);
    }

    public function eventScopeIn(User $user, Uuid $organisationId): ?EventScope
    {
        $scope = $this->real->eventScopeIn($user, $organisationId);

        if (null === $scope || [] === $this->withheld) {
            return $scope;
        }

        $byEvent = [];

        foreach (Permission::cases() as $permission) {
            foreach ($scope->eventsHolding($permission) ?? [] as $eventId) {
                $byEvent[$eventId->toRfc4122()] ??= $this->less($scope->on($eventId));
            }
        }

        return new EventScope($scope->onlyFor, $this->less($scope->organisation) ?? Grants::only([]), Dict\filter_nulls($byEvent));
    }

    private function less(?Grants $grants): ?Grants
    {
        if (null === $grants || [] === $this->withheld) {
            return $grants;
        }

        return Grants::only(Vec\filter(Permission::cases(), fn (Permission $permission): bool => !Iter\contains($this->withheld, $permission) && $grants->holds($permission)));
    }
}
