<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Enum\Permission;
use Psl\Iter;
use Psl\Vec;

/** What one active membership allows. Owner holds every permission, including ones added later. */
final readonly class Grants
{
    /**
     * @param list<Permission> $permissions
     * @param list<Permission> $withheld    held by the role, and waiting on two-factor (sc-69)
     */
    private function __construct(
        private bool $everything,
        private array $permissions,
        private array $withheld = [],
        private bool $readOnly = false,
        private bool $heldForTwoFactor = false,
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

    /** The administrative permissions this holds, kept back until the member turns two-factor on. */
    public function withholdingAdministration(): self
    {
        return new self($this->everything, $this->permissions, Vec\filter(Permission::cases(), fn (Permission $permission): bool => $permission->isAdministrative() && $this->roleHolds($permission)), $this->readOnly, $this->heldForTwoFactor);
    }

    /** Reading only, until the member links Google or Apple. */
    public function readingOnly(): self
    {
        return new self($this->everything, $this->permissions, $this->withheld, true, $this->heldForTwoFactor);
    }

    /** Nothing at all, past the organisation's deadline for two-factor, until the member turns it on (sc-609). */
    public function heldForTwoFactor(): self
    {
        return new self($this->everything, $this->permissions, $this->withheld, $this->readOnly, true);
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

    public function isReadOnly(): bool
    {
        return $this->readOnly;
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
