<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a menu change asked a person again for a course (sc-3913), which sets the line their RSVP shows. */
enum MenuChangeWhy: string
{
    case Removed = 'removed';
    case Ways = 'ways';
    case Choices = 'choices';
    case Allergen = 'allergen';
}
