<?php

declare(strict_types=1);

namespace App\Domain\User\Onboarding;

use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Interfaces\OnboardingGateInterface;
use Psl\Iter;

/** Verified, then complete. Every route with an account policy is behind it unless this list names it. */
final readonly class OnboardingGate implements OnboardingGateInterface
{
    /** The whole list, by route name. Logout and refresh are public, so they never reach the gate. */
    public const array EXEMPT = [
        'auth_me',
        'auth_verify_email',
        'auth_verify_resend',
        'auth_verify_resend_cooldown',
        'auth_complete_profile',
        'auth_phone_set',
        'auth_verify_phone',
        'auth_verify_phone_resend',
        'auth_verify_phone_resend_cooldown',
        'auth_verify_phone_text_instead',
        // A self-registered account in no organisation is incomplete until it joins one (sc-67).
        'invitations_mine',
        'invitations_accept',
        'invitations_decline',
    ];

    public function __construct(
        private AccountCompleteness $accountCompleteness,
    ) {
    }

    public function refusalFor(User $user, string $route): ?ErrorCode
    {
        if (Iter\contains(self::EXEMPT, $route)) {
            return null;
        }

        if (!$user->isVerified()) {
            return ErrorCode::AccountUnverified;
        }

        return $this->accountCompleteness->isComplete($user) ? null : ErrorCode::ProfileIncomplete;
    }
}
