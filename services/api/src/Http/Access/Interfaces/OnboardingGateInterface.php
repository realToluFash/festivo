<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use App\Entity\User;
use App\Enum\ErrorCode;

interface OnboardingGateInterface
{
    /** Null to let the account through; otherwise the code naming the gate it is behind. */
    public function refusalFor(User $user, string $route): ?ErrorCode;
}
