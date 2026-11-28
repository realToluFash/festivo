<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Model;

use App\Entity\MenuCourse;

/** The course a save sent for its item (sc-3898): a course links it, null clears it. A save that sent none has no choice at all. */
final readonly class CourseChoice
{
    public function __construct(
        public ?MenuCourse $course,
    ) {
    }
}
