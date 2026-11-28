<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Entity\Event;
use App\Entity\Guest;

/** Who is coming with no seat, once the event has a seating plan (sc-4331), on the same coming as No meal chosen (sc-82253). */
interface NotSeatedInterface
{
    /** @return list<Guest> nobody while the event has no seating plan */
    public function people(Event $event): array;
}
