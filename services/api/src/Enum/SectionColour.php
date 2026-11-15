<?php

declare(strict_types=1);

namespace App\Enum;

/** The eight a section may take (sc-3998), each 3:1 against the white canvas and chair, in the order a tie is broken. */
enum SectionColour: string
{
    case Blue = 'blue';
    case Purple = 'purple';
    case Plum = 'plum';
    case Wine = 'wine';
    case Rose = 'rose';
    case Brown = 'brown';
    case Olive = 'olive';
    case Teal = 'teal';
}
