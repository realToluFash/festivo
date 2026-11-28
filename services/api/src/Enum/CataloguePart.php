<?php

declare(strict_types=1);

namespace App\Enum;

/** The two halves of the plan catalogue, versioned apart: plan terms stay on the version a subscription was sold on, unit costs apply to everyone from the version in force (sc-3928). */
enum CataloguePart: string
{
    case Plans = 'plans';
    case UnitCosts = 'unit_costs';
}
