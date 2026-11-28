<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Entity\Event;
use App\Entity\Guest;

/** Who is coming with a course that asks still unanswered, as the menu's scope knows it (sc-80901). */
interface MealsNotChosenInterface
{
    /** @return list<Guest> each person once, however many courses they have left */
    public function people(Event $event): array;
}
