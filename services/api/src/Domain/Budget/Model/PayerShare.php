<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\Payer;
use BcMath\Number;

/** A payer's share: the sum of their parts, and what has been paid against it. */
final class PayerShare
{
    /** @var list<SplitPiece> */
    public array $covers = [];

    public Number $confirmedMinor;

    public Number $potentialMinor;

    public Number $paidMinor;

    public function __construct(
        public readonly Payer $payer,
    ) {
        $this->confirmedMinor = new Number(0);
        $this->potentialMinor = new Number(0);
        $this->paidMinor = new Number(0);
    }
}
