<?php

declare(strict_types=1);

namespace App\Enum;

/** The four tables venues hire (sc-4000): the one vocabulary the API, the clients, the prints and the counts read. */
enum TableShape: string
{
    case Round = 'round';
    case Rectangular = 'rectangular';
    case Head = 'head';
    case Cocktail = 'cocktail';

    /** @return array{widthCm: int, lengthCm: int, seats: int} a round or cocktail table's width and length are its diameter */
    public function defaults(): array
    {
        return match ($this) {
            self::Round => ['widthCm' => 180, 'lengthCm' => 180, 'seats' => 10],
            self::Rectangular => ['widthCm' => 180, 'lengthCm' => 76, 'seats' => 6],
            self::Head => ['widthCm' => 240, 'lengthCm' => 76, 'seats' => 4],
            self::Cocktail => ['widthCm' => 60, 'lengthCm' => 60, 'seats' => 4],
        };
    }

    public function isRound(): bool
    {
        return self::Round === $this || self::Cocktail === $this;
    }

    /** Only a long table has ends to seat and turns in 15° steps. */
    public function isLong(): bool
    {
        return !$this->isRound();
    }
}
