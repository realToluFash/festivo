<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

/** Who may reach a route. Declared as an attribute on the controller; a route without one does not load. */
interface Policy
{
}
