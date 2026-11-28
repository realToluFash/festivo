<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** A course as Add course and Edit course send it, checked by CourseRules. */
final readonly class CourseDetails
{
    /** @param ?string $servedAt "20:30", in the event's zone */
    public function __construct(
        public string $name,
        public ?string $servedAt,
    ) {
    }
}
