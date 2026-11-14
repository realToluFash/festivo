<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

use App\Enum\NeedKind;
use Psl\Iter;
use Psl\Vec;

/** A guest's or a companion's needs as GuestRules accepted them (sc-3777): known codes in their list's order, Other's words trimmed and only while Other is ticked, null for none. */
final readonly class GuestNeeds
{
    /**
     * @param array<value-of<NeedKind>, list<string>> $codes  by kind, each in its list's order
     * @param array<value-of<NeedKind>, ?string>      $others by kind
     */
    public function __construct(
        public array $codes,
        public array $others,
        public ?string $note,
    ) {
    }

    public static function none(): self
    {
        return new self(
            [NeedKind::Allergen->value => [], NeedKind::Diet->value => [], NeedKind::Access->value => []],
            [NeedKind::Allergen->value => null, NeedKind::Diet->value => null, NeedKind::Access->value => null],
            null,
        );
    }

    /** @return list<string> */
    public function codesOf(NeedKind $kind): array
    {
        return $this->codes[$kind->value] ?? [];
    }

    public function otherOf(NeedKind $kind): ?string
    {
        return $this->others[$kind->value] ?? null;
    }

    public function equals(self $other): bool
    {
        return Iter\all(NeedKind::cases(), fn (NeedKind $kind): bool => $this->codesOf($kind) === $other->codesOf($kind) && $this->otherOf($kind) === $other->otherOf($kind))
            && $this->note === $other->note;
    }

    /** @return list<array{NeedKind, string}> */
    public function pairs(): array
    {
        return Vec\flat_map(NeedKind::cases(), fn (NeedKind $kind): array => Vec\map($this->codesOf($kind), static fn (string $code): array => [$kind, $code]));
    }
}
