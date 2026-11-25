<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\Payer;
use BcMath\Number;

/** One payer's part of one cost, settled and if all come, in the minor unit; `value` is their percentage in hundredths or their fixed amount, null for all of it and for the rest. */
final readonly class SplitPiece
{
    public function __construct(
        public SplitLine $line,
        public Payer $payer,
        public Number $confirmedMinor,
        public Number $potentialMinor,
        public ?int $value,
        public bool $rest,
    ) {
    }
}
