<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use BcMath\Number;
use RoundingMode;

/** Client total and internal cost at both ends of the range (sc-84), in the minor unit; the margin and its share follow from them (sc-92, decided 17 Oct). */
final readonly class MarginFigures
{
    /** Far past the tenth a share is shown to, so cutting the quotient here never moves which way it rounds. */
    private const int SCALE = 12;

    public function __construct(
        public Number $clientConfirmedMinor,
        public Number $clientPotentialMinor,
        public Number $costConfirmedMinor,
        public Number $costPotentialMinor,
    ) {
    }

    public static function none(): self
    {
        return new self(new Number(0), new Number(0), new Number(0), new Number(0));
    }

    public function plus(self $other): self
    {
        return new self(
            $this->clientConfirmedMinor->add($other->clientConfirmedMinor),
            $this->clientPotentialMinor->add($other->clientPotentialMinor),
            $this->costConfirmedMinor->add($other->costConfirmedMinor),
            $this->costPotentialMinor->add($other->costPotentialMinor),
        );
    }

    public function marginConfirmedMinor(): Number
    {
        return $this->clientConfirmedMinor->sub($this->costConfirmedMinor);
    }

    public function marginPotentialMinor(): Number
    {
        return $this->clientPotentialMinor->sub($this->costPotentialMinor);
    }

    /** The margin as a share of the client price, in tenths of a percent; none at a client price of 0. */
    public function shareConfirmedTenths(): ?Number
    {
        return self::share($this->marginConfirmedMinor(), $this->clientConfirmedMinor);
    }

    public function sharePotentialTenths(): ?Number
    {
        return self::share($this->marginPotentialMinor(), $this->clientPotentialMinor);
    }

    private static function share(Number $margin, Number $client): ?Number
    {
        return 0 === $client->compare(0) ? null : $margin->mul(1000)->div($client, self::SCALE)->round(0, RoundingMode::HalfAwayFromZero);
    }
}
