<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Enum\Permission;
use Psl\Iter;

/** What one active membership allows. Owner holds every permission, including ones added later. */
final readonly class Grants
{
    /** @param list<Permission> $permissions */
    private function __construct(
        private bool $everything,
        private array $permissions,
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

    public function holds(Permission $permission): bool
    {
        return $this->everything || Iter\contains($this->permissions, $permission);
    }
}
