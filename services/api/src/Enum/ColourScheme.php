<?php

declare(strict_types=1);

namespace App\Enum;

/** B Confetti's colour schemes (docs/design/tokens.mjs), one of which a person may pick to see Soirely in (sc-30441). */
enum ColourScheme: string
{
    case Violet = 'violet';
    case Cobalt = 'cobalt';
    case Garden = 'garden';
    case Citrus = 'citrus';
    case Berry = 'berry';
    case BlackTie = 'blacktie';
    case Sorbet = 'sorbet';
    case Terracotta = 'terracotta';
}
