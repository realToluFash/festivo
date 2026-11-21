<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\Payer;

/** Choose who pays while it is being checked: the parts that pass, and every refusal found. */
final class SplitDraft
{
    /** @var list<array{payer: Payer, value: int}> */
    public array $parts = [];

    /** @var list<array{propertyPath: string, message: string, code: string}> */
    public array $violations = [];
}
