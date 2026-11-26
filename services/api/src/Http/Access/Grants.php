<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Enum\EventRole;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Enum\PlanFeature;
use App\Enum\ServicePlace;
use App\Http\Exception\ApiException;
use Psl\Iter;
use Psl\Vec;

/** What one active membership allows. Owner holds every permission, including ones added later. */
final readonly class Grants
{
    /**
     * @param list<Permission>  $permissions
     * @param list<Permission>  $withheld    held by the role, and waiting on two-factor (sc-69)
     * @param list<PlanFeature> $unlocks     what the organisation's plan switches on (sc-581, sc-3928)
     */
    private function __construct(
        private bool $everything,
        private array $permissions,
        private array $withheld = [],
        private bool $readOnly = false,
        private bool $heldForTwoFactor = false,
        private ?EventRole $eventRole = null,
        private array $unlocks = [],
    ) {
    }

    public static function everything(): self
    {
        return new self(true, []);
    }

    /** @param list<Permission> $permissions */
    public static function only(array $permissions): self
    {
        return new self(false, $permissions);
    }

    /** A Member's, which come from their role on one event and from nothing in the organisation (sc-29912). */
    public static function onEvent(EventRole $role): self
    {
        return new self(false, $role->permissions(), eventRole: $role);
    }

    /** Someone from outside the organisation, who holds only the permissions of the areas their level opens (sc-71, sc-94342). */
    public static function fromOutside(EventRole $role): self
    {
        return new self(false, Vec\filter($role->permissions(), static fn (Permission $permission): bool => Iter\contains($role->areasFromOutside(), $permission->area())), eventRole: $role);
    }

    /** The administrative permissions this holds, kept back until the member turns two-factor on. */
    public function withholdingAdministration(): self
    {
        return new self($this->everything, $this->permissions, Vec\filter(Permission::cases(), fn (Permission $permission): bool => $permission->isAdministrative() && $this->roleHolds($permission)), $this->readOnly, $this->heldForTwoFactor, $this->eventRole, $this->unlocks);
    }

    /** Reading only, until the member links Google or Apple. */
    public function readingOnly(): self
    {
        return new self($this->everything, $this->permissions, $this->withheld, true, $this->heldForTwoFactor, $this->eventRole, $this->unlocks);
    }

    /** Nothing at all, past the organisation's deadline for two-factor, until the member turns it on (sc-609). */
    public function heldForTwoFactor(): self
    {
        return new self($this->everything, $this->permissions, $this->withheld, $this->readOnly, true, $this->eventRole, $this->unlocks);
    }

    /** @param list<PlanFeature> $unlocks what the organisation's plan switches on, from the catalogue (sc-581, sc-3928) */
    public function onPlan(array $unlocks): self
    {
        return new self($this->everything, $this->permissions, $this->withheld, $this->readOnly, $this->heldForTwoFactor, $this->eventRole, $unlocks);
    }

    /** 403 `plan_required` for a change to a setting the organisation's plan does not unlock; reading it stays open, so it can be shown locked. */
    public function requirePlanFor(PlanFeature $feature): void
    {
        if (!Iter\contains($this->unlocks, $feature)) {
            throw ApiException::planRequired($feature);
        }
    }

    /** The one refusal for a permission not held: 403 `two_factor_required` while two-factor keeps it back, `permission_required` otherwise. */
    public function require(Permission $permission): void
    {
        if ($this->withholds($permission)) {
            throw ApiException::twoFactorRequired($permission);
        }

        if (!$this->holds($permission)) {
            throw ApiException::permissionRequired($permission);
        }
    }

    /** 403 `permission_required` without the service, or at the half of it the level does not work: the floor's level never the pass, the pass's never the floor (sc-4002). */
    public function requireServiceAt(ServicePlace $place): void
    {
        $this->require(Permission::ServiceWork);

        if (null !== $this->eventRole && !$this->eventRole->worksAt($place)) {
            throw ApiException::permissionRequired(Permission::ServiceWork);
        }
    }

    /** Whether requireServiceAt would let this reader work the place. */
    public function servesAt(ServicePlace $place): bool
    {
        return $this->holds(Permission::ServiceWork) && (null === $this->eventRole || $this->eventRole->worksAt($place));
    }

    /** Whether the area is one this reader is shown: its read held. */
    public function opens(PermissionArea $area): bool
    {
        return $this->holds($area->reading());
    }

    public function holds(Permission $permission): bool
    {
        return !$this->heldForTwoFactor && $this->roleHolds($permission) && !$this->withholds($permission);
    }

    /** What a client may offer: under the read-only rule a change is refused, so it is not offered either. */
    public function allows(Permission $permission): bool
    {
        return $this->holds($permission) && !($this->readOnly && $permission->isChange());
    }

    public function withholds(Permission $permission): bool
    {
        return Iter\contains($this->withheld, $permission);
    }

    /** @return list<Permission> */
    public function withheld(): array
    {
        return $this->withheld;
    }

    /** @return list<Permission> the changes the role holds that the read-only rule keeps back until a provider is linked */
    public function withheldUntilLinked(): array
    {
        return $this->readOnly ? Vec\filter(Permission::cases(), fn (Permission $permission): bool => $permission->isChange() && $this->roleHolds($permission)) : [];
    }

    public function isReadOnly(): bool
    {
        return $this->readOnly;
    }

    /** The role on the event these come from, for a Member; null when they are the organisation role's. */
    public function eventRole(): ?EventRole
    {
        return $this->eventRole;
    }

    public function isHeldForTwoFactor(): bool
    {
        return $this->heldForTwoFactor;
    }

    private function roleHolds(Permission $permission): bool
    {
        return $this->everything || Iter\contains($this->permissions, $permission);
    }
}
